package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/excel"
	"github.com/dracuten1/cgv-v2/api/internal/feed"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	genrepo "github.com/dracuten1/cgv-v2/api/internal/repository/genealogy"
	"github.com/gin-gonic/gin"
)

// Fake implementations for router & endpoint unit tests without database

type fakePinger struct {
	down bool
}

func (p *fakePinger) Ping(ctx context.Context) error {
	if p.down {
		return errors.New("connection refused")
	}
	return nil
}

type fakeTxManager struct{}

func (t *fakeTxManager) WithTx(ctx context.Context, fn func(ctx context.Context) error) error {
	return fn(ctx)
}

type fakeAuthService struct {
	validTokens map[string]*auth.Claims
	users       map[string]*auth.UserProfile
}

func (a *fakeAuthService) LoginURL(w http.ResponseWriter, r *http.Request, provider string) (string, error) {
	if provider == "disabled" {
		return "", auth.ErrProviderDisabled
	}
	return "https://oauth.example.com/auth", nil
}

func (a *fakeAuthService) HandleCallback(ctx context.Context, w http.ResponseWriter, r *http.Request, provider, code, stateParam string) (*auth.AuthResult, error) {
	if code == "bad_state" {
		return nil, auth.ErrInvalidState
	}
	u := model.User{ID: "usr-1", DisplayName: "Test User"}
	return &auth.AuthResult{
		User:       u,
		Token:      "valid-token-usr-1",
		CookieName: "cgp_session",
		IsNew:      false,
	}, nil
}

func (a *fakeAuthService) SendMagicLink(ctx context.Context, email, verifyBaseURL string) error {
	if email == "invalid" {
		return auth.ErrInvalidToken
	}
	return nil
}

func (a *fakeAuthService) VerifyMagicLink(ctx context.Context, rawToken string) (*auth.AuthResult, error) {
	if rawToken == "expired" {
		return nil, auth.ErrTokenUsedOrExpired
	}
	u := model.User{ID: "usr-2", DisplayName: "Magic User"}
	return &auth.AuthResult{
		User:       u,
		Token:      "valid-token-usr-2",
		CookieName: "cgp_session",
		IsNew:      true,
	}, nil
}

func (a *fakeAuthService) StartDemoSession(ctx context.Context) (*auth.AuthResult, error) {
	u := model.User{ID: "usr-demo", DisplayName: "Demo User", IsDemo: true}
	return &auth.AuthResult{
		User:       u,
		Token:      "demo-token",
		CookieName: "cgp_demo_session",
		IsNew:      false,
	}, nil
}

func (a *fakeAuthService) Logout(ctx context.Context, jti string) error {
	return nil
}

func (a *fakeAuthService) CurrentUser(ctx context.Context, userID string) (*auth.UserProfile, error) {
	if p, ok := a.users[userID]; ok {
		return p, nil
	}
	return &auth.UserProfile{
		User:       model.User{ID: userID, DisplayName: "Default User"},
		Identities: []model.Identity{},
		Contacts:   []model.ContactPoint{},
	}, nil
}

func (a *fakeAuthService) StartLinkProvider(w http.ResponseWriter, r *http.Request, userID, provider string) (string, error) {
	return "https://oauth.example.com/link", nil
}

func (a *fakeAuthService) CompleteLink(ctx context.Context, w http.ResponseWriter, r *http.Request, userID, provider, code, stateParam string) error {
	return nil
}

func (a *fakeAuthService) UnlinkIdentity(ctx context.Context, userID, identityID string) error {
	if identityID == "last" {
		return auth.ErrLastIdentity
	}
	return nil
}

func (a *fakeAuthService) VerifyToken(tokenStr string) (*auth.Claims, error) {
	if c, ok := a.validTokens[tokenStr]; ok {
		return c, nil
	}
	return nil, auth.ErrInvalidToken
}

type fakeContactStore struct {
	contacts map[string]*model.ContactPoint
}

func (c *fakeContactStore) Insert(ctx context.Context, userID, kind, value string, verified bool, verifiedVia string) (*model.ContactPoint, error) {
	cp := &model.ContactPoint{
		ID:       "cp-1",
		UserID:   userID,
		Kind:     kind,
		Value:    value,
		Verified: verified,
	}
	return cp, nil
}

func (c *fakeContactStore) GetByID(ctx context.Context, contactID string) (*model.ContactPoint, error) {
	if cp, ok := c.contacts[contactID]; ok {
		return cp, nil
	}
	return nil, genrepo.ErrNotFound
}

func (c *fakeContactStore) MarkVerified(ctx context.Context, contactID, via string) error {
	return nil
}

type fakeFamilyRepo struct {
	families map[string]*model.Family
	version  int64
}

func (f *fakeFamilyRepo) List(ctx context.Context) ([]model.Family, error) {
	var res []model.Family
	for _, fam := range f.families {
		res = append(res, *fam)
	}
	return res, nil
}

func (f *fakeFamilyRepo) GetByID(ctx context.Context, familyID string) (*model.Family, error) {
	if fam, ok := f.families[familyID]; ok {
		return fam, nil
	}
	return nil, genrepo.ErrNotFound
}

func (f *fakeFamilyRepo) BumpVersion(ctx context.Context, dbtx database.DBTX, familyID string) (int64, error) {
	f.version++
	return f.version, nil
}

type fakeMemberRepo struct {
	members map[string]*model.Member
}

func (m *fakeMemberRepo) List(ctx context.Context, search string, limit, offset int) (*model.Page[model.Member], error) {
	var items []model.Member
	for _, mem := range m.members {
		items = append(items, *mem)
	}
	return &model.Page[model.Member]{
		Items:  items,
		Total:  int64(len(items)),
		Limit:  limit,
		Offset: offset,
	}, nil
}

func (m *fakeMemberRepo) ListByFamily(ctx context.Context, familyID string) ([]model.Member, error) {
	var items []model.Member
	for _, mem := range m.members {
		if mem.FamilyID == familyID {
			items = append(items, *mem)
		}
	}
	return items, nil
}

func (m *fakeMemberRepo) GetByID(ctx context.Context, memberID string) (*genrepo.MemberWithFamily, error) {
	if mem, ok := m.members[memberID]; ok {
		return &genrepo.MemberWithFamily{
			Member:     *mem,
			FamilyName: "Họ Nguyễn",
		}, nil
	}
	return nil, genrepo.ErrNotFound
}

func (m *fakeMemberRepo) GetForUpdate(ctx context.Context, dbtx database.DBTX, memberID string) (*model.Member, error) {
	if mem, ok := m.members[memberID]; ok {
		return mem, nil
	}
	return nil, genrepo.ErrNotFound
}

func (m *fakeMemberRepo) Create(ctx context.Context, dbtx database.DBTX, mem *model.Member) (*model.Member, error) {
	mem.ID = fmt.Sprintf("mem-%d", len(m.members)+1)
	m.members[mem.ID] = mem
	return mem, nil
}

func (m *fakeMemberRepo) Update(ctx context.Context, dbtx database.DBTX, mem *model.Member) error {
	m.members[mem.ID] = mem
	return nil
}

func (m *fakeMemberRepo) Delete(ctx context.Context, dbtx database.DBTX, memberID string) error {
	delete(m.members, memberID)
	return nil
}

func (m *fakeMemberRepo) LoadGraph(ctx context.Context, familyID string) ([]model.Member, []model.ParentChild, []model.Spouse, int64, error) {
	var items []model.Member
	for _, mem := range m.members {
		if mem.FamilyID == familyID {
			items = append(items, *mem)
		}
	}
	return items, []model.ParentChild{}, []model.Spouse{}, 1, nil
}

type fakeRelationRepo struct{}

func (r *fakeRelationRepo) AddParentChild(ctx context.Context, dbtx database.DBTX, parentID, childID string) error {
	return nil
}

func (r *fakeRelationRepo) RemoveParentChild(ctx context.Context, dbtx database.DBTX, parentID, childID string) error {
	return nil
}

func (r *fakeRelationRepo) AddSpouse(ctx context.Context, dbtx database.DBTX, memberA, memberB string, marriageDate *time.Time) error {
	return nil
}

func (r *fakeRelationRepo) RemoveSpouse(ctx context.Context, dbtx database.DBTX, memberA, memberB string) error {
	return nil
}

func (r *fakeRelationRepo) ListRelations(ctx context.Context, memberID string) (*genrepo.MemberRelations, error) {
	return &genrepo.MemberRelations{
		Parents:  []model.Member{},
		Children: []model.Member{},
		Siblings: []model.Member{},
		Spouses:  []model.Member{},
	}, nil
}

func (r *fakeRelationRepo) ReparentChildren(ctx context.Context, dbtx database.DBTX, deletedID string, newParentID *string) error {
	return nil
}

type fakeKinshipService struct{}

func (k *fakeKinshipService) Calculate(ctx context.Context, familyID, fromID, toID string, dialect string) (model.KinshipResult, error) {
	return model.KinshipResult{
		Term:               "Ông nội",
		Line:               "Chi nội",
		GenerationDistance: 2,
		DistanceLabel:      "Cách 2 đời",
		IsBlood:            true,
		Dialect:            dialect,
		Path:               []string{fromID, toID},
	}, nil
}

type fakeExcelService struct{}

func (e *fakeExcelService) ExportFamily(ctx context.Context, familyID string) ([]byte, error) {
	return []byte("fake-excel-data"), nil
}

func (e *fakeExcelService) ImportFamily(ctx context.Context, familyID string, data []byte) (excel.ImportSummary, error) {
	return excel.ImportSummary{Created: 5, SkippedDuplicates: 0}, nil
}

type fakeFeedService struct {
	posts []model.Post
}

func (f *fakeFeedService) List(ctx context.Context, familyID string, limit int, cursor feed.Cursor) ([]model.Post, error) {
	return f.posts, nil
}

func (f *fakeFeedService) Create(ctx context.Context, familyID string, authorUserID string, authorMemberID *string, content string, images []string) (*model.Post, error) {
	p := &model.Post{
		ID:             "post-1",
		FamilyID:       familyID,
		AuthorMemberID: authorMemberID,
		Content:        content,
		Images:         images,
		CreatedAt:      time.Now(),
	}
	return p, nil
}

type fakeSocialPostRepo struct{}

func (s *fakeSocialPostRepo) ListByAuthor(ctx context.Context, dbtx database.DBTX, memberID string, limit int) ([]model.Post, error) {
	return []model.Post{}, nil
}

type fakePushService struct{}

func (p *fakePushService) Subscribe(ctx context.Context, userID, endpoint, p256dh, auth string) error {
	return nil
}

func (p *fakePushService) Unsubscribe(ctx context.Context, endpoint string) error {
	return nil
}

type fakeUserStore struct {
	users map[string]*model.User
}

func (u *fakeUserStore) GetByID(ctx context.Context, userID string) (*model.User, error) {
	if usr, ok := u.users[userID]; ok {
		return usr, nil
	}
	return &model.User{ID: userID, DisplayName: "User " + userID}, nil
}

func (u *fakeUserStore) GetByIDForUpdate(ctx context.Context, userID string) (*model.User, error) {
	return u.GetByID(ctx, userID)
}

func (u *fakeUserStore) Create(ctx context.Context, displayName string, isDemo bool) (*model.User, error) {
	return &model.User{ID: "new-user", DisplayName: displayName, IsDemo: isDemo}, nil
}

func (u *fakeUserStore) LinkMember(ctx context.Context, userID, memberID string) error {
	return nil
}

func setupTestRouter() (*gin.Engine, *fakeMemberRepo, *fakeAuthService, *fakePinger) {
	gin.SetMode(gin.TestMode)

	cfg := &config.Config{
		Port:             8080,
		AppEnv:           config.EnvDev,
		CookieName:       "cgp_session",
		JWTSecret:        "test-secret-min-32-chars-long-123456",
		MockOAuthEnabled: true,
	}

	pinger := &fakePinger{}
	authSvc := &fakeAuthService{
		validTokens: map[string]*auth.Claims{
			"valid-token-123": {
				UserID: "usr-admin",
				IsDemo: false,
			},
		},
		users: make(map[string]*auth.UserProfile),
	}
	familyRepo := &fakeFamilyRepo{
		families: map[string]*model.Family{
			"fam-1": {ID: "fam-1", Name: "Nguyễn Tộc", Version: 1},
			"fam-2": {ID: "fam-2", Name: "Trần Tộc", Version: 1},
		},
	}
	memberRepo := &fakeMemberRepo{
		members: map[string]*model.Member{
			"mem-1":    {ID: "mem-1", FamilyID: "fam-1", FullName: "Nguyễn Văn An", Gender: model.GenderMale, GenerationIndex: 1},
			"mem-2":    {ID: "mem-2", FamilyID: "fam-1", FullName: "Nguyễn Văn Bình", Gender: model.GenderMale, GenerationIndex: 2},
			"mem-diff": {ID: "mem-diff", FamilyID: "fam-2", FullName: "Trần Thị Cúc", Gender: model.GenderFemale, GenerationIndex: 1},
		},
	}
	contactStore := &fakeContactStore{contacts: make(map[string]*model.ContactPoint)}
	userStore := &fakeUserStore{users: make(map[string]*model.User)}
	txMgr := &fakeTxManager{}
	relationRepo := &fakeRelationRepo{}
	kinshipSvc := &fakeKinshipService{}
	excelSvc := &fakeExcelService{}
	feedSvc := &fakeFeedService{}
	socialPostRepo := &fakeSocialPostRepo{}
	pushSvc := &fakePushService{}

	r := NewRouter(Deps{
		Cfg:            cfg,
		Pinger:         pinger,
		TxManager:      txMgr,
		AuthService:    authSvc,
		UserStore:      userStore,
		ContactStore:   contactStore,
		FamilyRepo:     familyRepo,
		MemberRepo:     memberRepo,
		RelationRepo:   relationRepo,
		KinshipSvc:     kinshipSvc,
		ExcelSvc:       excelSvc,
		FeedSvc:        feedSvc,
		SocialPostRepo: socialPostRepo,
		PushSvc:        pushSvc,
	})

	return r, memberRepo, authSvc, pinger
}

// 1. Assert route registration (all PROMPT §5 routes + /healthz)
func TestRouteRegistration(t *testing.T) {
	r, _, _, _ := setupTestRouter()

	expectedRoutes := []struct {
		method string
		path   string
	}{
		{"GET", "/healthz"},
		{"GET", "/api/v1/health"},
		{"GET", "/api/v1/auth/providers"},
		{"GET", "/api/v1/auth/:provider/login"},
		{"GET", "/api/v1/auth/:provider/callback"},
		{"POST", "/api/v1/auth/email/magic-link"},
		{"GET", "/api/v1/auth/email/verify"},
		{"POST", "/api/v1/auth/demo"},
		{"POST", "/api/v1/auth/logout"},
		{"GET", "/api/v1/me"},
		{"GET", "/api/v1/me/link/:provider/start"},
		{"DELETE", "/api/v1/me/identities/:id"},
		{"POST", "/api/v1/me/contacts"},
		{"POST", "/api/v1/me/contacts/:id/verify"},
		{"GET", "/api/v1/families"},
		{"GET", "/api/v1/families/:id/tree"},
		{"GET", "/api/v1/members"},
		{"POST", "/api/v1/members"},
		{"GET", "/api/v1/members/:id"},
		{"PUT", "/api/v1/members/:id"},
		{"DELETE", "/api/v1/members/:id"},
		{"GET", "/api/v1/kinship"},
		{"GET", "/api/v1/families/:id/export.xlsx"},
		{"POST", "/api/v1/families/:id/import.xlsx"},
		{"GET", "/api/v1/families/:id/feed"},
		{"POST", "/api/v1/families/:id/feed"},
		{"POST", "/api/v1/push/subscribe"},
		{"DELETE", "/api/v1/push/subscribe"},
	}

	routes := r.Routes()
	routeSet := make(map[string]bool)
	for _, route := range routes {
		key := fmt.Sprintf("%s %s", route.Method, route.Path)
		routeSet[key] = true
	}

	for _, er := range expectedRoutes {
		key := fmt.Sprintf("%s %s", er.method, er.path)
		if !routeSet[key] {
			t.Errorf("thiếu route bắt buộc trong bảng route: %s", key)
		}
	}
}

// 2. 401 envelope on protected route without cookie
func TestProtectedRoutesUnauthorized(t *testing.T) {
	r, _, _, _ := setupTestRouter()

	req, _ := http.NewRequest("GET", "/api/v1/me", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("kỳ vọng mã 401, nhận %d", w.Code)
	}

	var env model.ErrorEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("lỗi parse JSON error envelope: %v", err)
	}

	if env.Success {
		t.Errorf("kỳ vọng success=false, nhận true")
	}
	if env.Code != model.CodeUnauthorized {
		t.Errorf("kỳ vọng code UNAUTHORIZED, nhận %s", env.Code)
	}
	if env.Message == "" {
		t.Errorf("kỳ vọng thông báo tiếng Việt có nội dung, nhận rỗng")
	}
}

// 3. Valid-token cookie passes middleware
func TestValidTokenCookiePasses(t *testing.T) {
	r, _, _, _ := setupTestRouter()

	req, _ := http.NewRequest("GET", "/api/v1/me", nil)
	req.AddCookie(&http.Cookie{
		Name:  "cgp_session",
		Value: "valid-token-123",
	})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("kỳ vọng mã 200, nhận %d. Body: %s", w.Code, w.Body.String())
	}
}

// 4. Health endpoint shape with fake pinger
func TestHealthEndpoints(t *testing.T) {
	r, _, _, pinger := setupTestRouter()

	// 4a. Health up
	req, _ := http.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("kỳ vọng 200 cho /healthz, nhận %d", w.Code)
	}

	var res map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("parse json thất bại: %v", err)
	}
	if res["status"] != "ok" || res["db"] != "up" {
		t.Errorf("kỳ vọng status=ok, db=up, nhận status=%v, db=%v", res["status"], res["db"])
	}

	// 4b. Health down
	pinger.down = true
	req2, _ := http.NewRequest("GET", "/api/v1/health", nil)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)

	if w2.Code != http.StatusServiceUnavailable {
		t.Fatalf("kỳ vọng 503 khi db down, nhận %d", w2.Code)
	}
}

// 5. Gender boundary: POST /members accepts "nữ" AND "female" (INV-03)
func TestGenderBoundaryAcceptance(t *testing.T) {
	r, memberRepo, _, _ := setupTestRouter()

	// 5a. Accept "nữ"
	bodyVN := `{"family_id":"fam-1","full_name":"Nguyễn Thị Hoa","gender":"nữ"}`
	reqVN, _ := http.NewRequest("POST", "/api/v1/members", bytes.NewBufferString(bodyVN))
	reqVN.Header.Set("Content-Type", "application/json")
	reqVN.AddCookie(&http.Cookie{Name: "cgp_session", Value: "valid-token-123"})
	wVN := httptest.NewRecorder()
	r.ServeHTTP(wVN, reqVN)

	if wVN.Code != http.StatusCreated {
		t.Fatalf("kỳ vọng 201 cho gender='nữ', nhận %d. Body: %s", wVN.Code, wVN.Body.String())
	}
	var createdVN model.Member
	if err := json.Unmarshal(wVN.Body.Bytes(), &createdVN); err != nil {
		t.Fatalf("parse member json thất bại: %v", err)
	}
	if createdVN.Gender != model.GenderFemale {
		t.Errorf("kỳ vọng gender lưu nội bộ là 'female', nhận %s", createdVN.Gender)
	}

	// 5b. Accept "female"
	bodyAPI := `{"family_id":"fam-1","full_name":"Nguyễn Thị Lan","gender":"female"}`
	reqAPI, _ := http.NewRequest("POST", "/api/v1/members", bytes.NewBufferString(bodyAPI))
	reqAPI.Header.Set("Content-Type", "application/json")
	reqAPI.AddCookie(&http.Cookie{Name: "cgp_session", Value: "valid-token-123"})
	wAPI := httptest.NewRecorder()
	r.ServeHTTP(wAPI, reqAPI)

	if wAPI.Code != http.StatusCreated {
		t.Fatalf("kỳ vọng 201 cho gender='female', nhận %d. Body: %s", wAPI.Code, wAPI.Body.String())
	}
	var createdAPI model.Member
	if err := json.Unmarshal(wAPI.Body.Bytes(), &createdAPI); err != nil {
		t.Fatalf("parse member json thất bại: %v", err)
	}
	if createdAPI.Gender != model.GenderFemale {
		t.Errorf("kỳ vọng gender lưu nội bộ là 'female', nhận %s", createdAPI.Gender)
	}

	// 5c. Reject invalid gender
	bodyInvalid := `{"family_id":"fam-1","full_name":"Ai Đó","gender":"khac"}`
	reqInv, _ := http.NewRequest("POST", "/api/v1/members", bytes.NewBufferString(bodyInvalid))
	reqInv.Header.Set("Content-Type", "application/json")
	reqInv.AddCookie(&http.Cookie{Name: "cgp_session", Value: "valid-token-123"})
	wInv := httptest.NewRecorder()
	r.ServeHTTP(wInv, reqInv)

	if wInv.Code != http.StatusBadRequest {
		t.Fatalf("kỳ vọng 400 cho gender không hợp lệ, nhận %d", wInv.Code)
	}
	var env model.ErrorEnvelope
	_ = json.Unmarshal(wInv.Body.Bytes(), &env)
	if env.Code != model.CodeInvalidGender {
		t.Errorf("kỳ vọng CodeInvalidGender, nhận %s", env.Code)
	}

	_ = memberRepo
}

// 6. Kinship 400 cross-family
func TestKinshipCrossFamilyRejection(t *testing.T) {
	r, _, _, _ := setupTestRouter()

	// mem-1 is in fam-1, mem-diff is in fam-2
	req, _ := http.NewRequest("GET", "/api/v1/kinship?from=mem-1&to=mem-diff", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("kỳ vọng 400 cho quan hệ khác dòng họ, nhận %d", w.Code)
	}

	var env model.ErrorEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("lỗi parse json: %v", err)
	}
	if !strings.Contains(env.Message, "Hai thành viên không thuộc cùng dòng họ") {
		t.Errorf("kỳ vọng thông báo 'Hai thành viên không thuộc cùng dòng họ', nhận: %s", env.Message)
	}

	// Valid same-family calculation succeeds
	reqSame, _ := http.NewRequest("GET", "/api/v1/kinship?from=mem-1&to=mem-2", nil)
	wSame := httptest.NewRecorder()
	r.ServeHTTP(wSame, reqSame)

	if wSame.Code != http.StatusOK {
		t.Fatalf("kỳ vọng 200 cho quan hệ cùng dòng họ, nhận %d", wSame.Code)
	}
	var kinRes model.KinshipResult
	if err := json.Unmarshal(wSame.Body.Bytes(), &kinRes); err != nil {
		t.Fatalf("lỗi parse kinship result: %v", err)
	}
	if kinRes.Term != "Ông nội" {
		t.Errorf("kỳ vọng 'Ông nội', nhận %s", kinRes.Term)
	}
}

// 7. Error envelope JSON shape verification
func TestErrorEnvelopeShape(t *testing.T) {
	r, _, _, _ := setupTestRouter()

	req, _ := http.NewRequest("DELETE", "/api/v1/me/identities/last", nil)
	req.AddCookie(&http.Cookie{Name: "cgp_session", Value: "valid-token-123"})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Fatalf("kỳ vọng mã 409 cho hủy định danh cuối cùng, nhận %d", w.Code)
	}

	var env model.ErrorEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("lỗi parse json: %v", err)
	}

	if env.Success != false {
		t.Errorf("kỳ vọng Success == false")
	}
	if env.Code != model.CodeLastIdentityCannotBeRemoved {
		t.Errorf("kỳ vọng Code == LAST_IDENTITY_CANNOT_BE_REMOVED, nhận %s", env.Code)
	}
	if env.Message == "" {
		t.Errorf("kỳ vọng Message không được rỗng")
	}
}

// 8. Excel export and import test
func TestExcelEndpoints(t *testing.T) {
	r, _, _, _ := setupTestRouter()

	// Export
	reqExp, _ := http.NewRequest("GET", "/api/v1/families/fam-1/export.xlsx", nil)
	wExp := httptest.NewRecorder()
	r.ServeHTTP(wExp, reqExp)

	if wExp.Code != http.StatusOK {
		t.Fatalf("kỳ vọng 200 khi xuất Excel, nhận %d", wExp.Code)
	}
	if !strings.Contains(wExp.Header().Get("Content-Type"), "openxmlformats") {
		t.Errorf("kỳ vọng content-type openxmlformats, nhận %s", wExp.Header().Get("Content-Type"))
	}

	// Import
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	part, _ := mw.CreateFormFile("file", "gia-pha.xlsx")
	_, _ = io.WriteString(part, "dummy excel content")
	_ = mw.Close()

	reqImp, _ := http.NewRequest("POST", "/api/v1/families/fam-1/import.xlsx", &buf)
	reqImp.Header.Set("Content-Type", mw.FormDataContentType())
	reqImp.AddCookie(&http.Cookie{Name: "cgp_session", Value: "valid-token-123"})
	wImp := httptest.NewRecorder()
	r.ServeHTTP(wImp, reqImp)

	if wImp.Code != http.StatusOK {
		t.Fatalf("kỳ vọng 200 khi nhập Excel, nhận %d. Body: %s", wImp.Code, wImp.Body.String())
	}
}

// 9. Tree hierarchy endpoint test
func TestTreeHierarchyEndpoint(t *testing.T) {
	r, _, _, _ := setupTestRouter()

	req, _ := http.NewRequest("GET", "/api/v1/families/fam-1/tree", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("kỳ vọng 200 cho /families/:id/tree, nhận %d", w.Code)
	}

	var treeResp TreeResponse
	if err := json.Unmarshal(w.Body.Bytes(), &treeResp); err != nil {
		t.Fatalf("lỗi parse TreeResponse: %v", err)
	}

	if treeResp.FamilyID != "fam-1" {
		t.Errorf("kỳ vọng FamilyID 'fam-1', nhận %s", treeResp.FamilyID)
	}
	if len(treeResp.Generations) == 0 {
		t.Errorf("kỳ vọng Generations không rỗng")
	}
	if len(treeResp.Generations) > 0 && treeResp.Generations[0].Label != "Đời thứ 1" {
		t.Errorf("kỳ vọng Label 'Đời thứ 1', nhận %s", treeResp.Generations[0].Label)
	}
}
