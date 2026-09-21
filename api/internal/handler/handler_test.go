package handler

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
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
	"github.com/golang-jwt/jwt/v5"
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
	// Scripted sentinel codes let tests exercise each error branch without a
	// real provider; no existing test uses these magic code values.
	switch code {
	case "bad_state":
		return nil, auth.ErrInvalidState
	case "already_linked":
		return nil, auth.ErrAlreadyLinked
	case "provider_fail":
		return nil, auth.ErrProviderExchange
	case "demo_restricted":
		return nil, auth.ErrDemoIsolation
	case "server_boom":
		return nil, errors.New("khủng hoảng chưa phân loại")
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
		Port:               8080,
		AppEnv:             config.EnvDev,
		CookieName:         "cgp_session",
		JWTSecret:          "test-secret-min-32-chars-long-123456",
		MockOAuthEnabled:   true,
		CORSAllowedOrigins: []string{"http://localhost:3456", "http://localhost:3457"},
		PublicBaseURL:      "http://localhost:3456",
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
		{"POST", "/api/v1/auth/email/verify"},
		{"POST", "/api/v1/auth/demo"},
		{"POST", "/api/v1/auth/logout"},
		{"GET", "/api/v1/me"},
		{"GET", "/api/v1/me/link/:provider/start"},
		{"POST", "/api/v1/me/link/:provider/start"},
		{"GET", "/api/v1/me/link/:provider/callback"},
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
	reqVN.Header.Set("Origin", "http://localhost:3456")
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
	reqAPI.Header.Set("Origin", "http://localhost:3456")
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
	reqInv.Header.Set("Origin", "http://localhost:3456")
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
	req.Header.Set("Origin", "http://localhost:3456")
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
	reqImp.Header.Set("Origin", "http://localhost:3456")
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
	if len(treeResp.Generations) > 0 && treeResp.Generations[0].Label != "Đời thứ 1" {
		t.Errorf("kỳ vọng Label 'Đời thứ 1', nhận %s", treeResp.Generations[0].Label)
	}
}

// 10. CORS allow-list tests
func TestCORSMiddleware(t *testing.T) {
	r, _, _, _ := setupTestRouter()

	// Origin in list → headers echoed
	req1, _ := http.NewRequest("GET", "/healthz", nil)
	req1.Header.Set("Origin", "http://localhost:3456")
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	if w1.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3456" {
		t.Errorf("expected Access-Control-Allow-Origin to be echoed, got %q", w1.Header().Get("Access-Control-Allow-Origin"))
	}
	if w1.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Errorf("expected Access-Control-Allow-Credentials: true")
	}

	// Origin not in list → no CORS headers echoed
	req2, _ := http.NewRequest("GET", "/healthz", nil)
	req2.Header.Set("Origin", "http://malicious.example.com")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("expected no Access-Control-Allow-Origin for untrusted origin, got %q", w2.Header().Get("Access-Control-Allow-Origin"))
	}

	// Preflight OPTIONS in list → 204
	req3, _ := http.NewRequest("OPTIONS", "/api/v1/me", nil)
	req3.Header.Set("Origin", "http://localhost:3456")
	w3 := httptest.NewRecorder()
	r.ServeHTTP(w3, req3)
	if w3.Code != http.StatusNoContent {
		t.Errorf("expected 204 for allowed preflight OPTIONS, got %d", w3.Code)
	}
	if w3.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3456" {
		t.Errorf("expected Access-Control-Allow-Origin echoed on preflight")
	}

	// Preflight OPTIONS not in list → 403 Forbidden and no echo
	req4, _ := http.NewRequest("OPTIONS", "/api/v1/me", nil)
	req4.Header.Set("Origin", "http://malicious.example.com")
	w4 := httptest.NewRecorder()
	r.ServeHTTP(w4, req4)
	if w4.Code != http.StatusForbidden {
		t.Errorf("expected 403 for untrusted preflight OPTIONS, got %d", w4.Code)
	}
	if w4.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("expected no Access-Control-Allow-Origin for untrusted preflight")
	}
}

// 11. CSRF Origin check tests (W1)
func TestCSRFOriginCheck(t *testing.T) {
	r, _, _, _ := setupTestRouter()

	// POST without Origin or Referer → 403
	body := `{"kind":"email","value":"test@example.com"}`
	req1, _ := http.NewRequest("POST", "/api/v1/me/contacts", bytes.NewBufferString(body))
	req1.Header.Set("Content-Type", "application/json")
	req1.AddCookie(&http.Cookie{Name: "cgp_session", Value: "valid-token-123"})
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusForbidden {
		t.Errorf("expected 403 for POST without Origin/Referer, got %d", w1.Code)
	}

	// POST with allowed Origin → passes (201 Created)
	req2, _ := http.NewRequest("POST", "/api/v1/me/contacts", bytes.NewBufferString(body))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Origin", "http://localhost:3456")
	req2.AddCookie(&http.Cookie{Name: "cgp_session", Value: "valid-token-123"})
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusCreated {
		t.Errorf("expected 201 for POST with allowed Origin, got %d. Body: %s", w2.Code, w2.Body.String())
	}

	// POST with foreign Origin → 403
	req3, _ := http.NewRequest("POST", "/api/v1/me/contacts", bytes.NewBufferString(body))
	req3.Header.Set("Content-Type", "application/json")
	req3.Header.Set("Origin", "http://evil.com")
	req3.AddCookie(&http.Cookie{Name: "cgp_session", Value: "valid-token-123"})
	w3 := httptest.NewRecorder()
	r.ServeHTTP(w3, req3)
	if w3.Code != http.StatusForbidden {
		t.Errorf("expected 403 for POST with foreign Origin, got %d", w3.Code)
	}
}

// 12. Ownership 404 on contact verify (W3)
func TestContactVerifyOwnership(t *testing.T) {
	// Add contact cp-other belonging to usr-other
	// The fake router has contacts map, let's test via handler directly or inject into contacts
	// Note setupTestRouter created contactStore which has GetByID
	// Let's create a custom setup with two users
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{
		Port:               8080,
		AppEnv:             config.EnvDev,
		CookieName:         "cgp_session",
		JWTSecret:          "test-secret-min-32-chars-long-123456",
		MockOAuthEnabled:   true,
		CORSAllowedOrigins: []string{"http://localhost:3456"},
		PublicBaseURL:      "http://localhost:3456",
	}
	contacts := &fakeContactStore{
		contacts: map[string]*model.ContactPoint{
			"cp-owner": {
				ID:       "cp-owner",
				UserID:   "usr-admin",
				Kind:     model.ContactKindEmail,
				Value:    "owner@example.com",
				Verified: false,
			},
			"cp-other": {
				ID:       "cp-other",
				UserID:   "usr-victim",
				Kind:     model.ContactKindEmail,
				Value:    "victim@example.com",
				Verified: false,
			},
		},
	}
	authSvc := &fakeAuthService{
		validTokens: map[string]*auth.Claims{
			"token-admin": {UserID: "usr-admin", IsDemo: false},
		},
	}
	router := NewRouter(Deps{
		Cfg:          cfg,
		Pinger:       &fakePinger{},
		TxManager:    &fakeTxManager{},
		AuthService:  authSvc,
		UserStore:    &fakeUserStore{},
		ContactStore: contacts,
		FamilyRepo:   &fakeFamilyRepo{},
		MemberRepo:   &fakeMemberRepo{},
		RelationRepo: &fakeRelationRepo{},
		KinshipSvc:   &fakeKinshipService{},
		ExcelSvc:     &fakeExcelService{},
		FeedSvc:      &fakeFeedService{},
		SocialPostRepo: &fakeSocialPostRepo{},
		PushSvc:      &fakePushService{},
	})

	// User A (usr-admin) calls verify on User B's (usr-victim) contact cp-other → 404
	reqOther, _ := http.NewRequest("POST", "/api/v1/me/contacts/cp-other/verify", nil)
	reqOther.Header.Set("Origin", "http://localhost:3456")
	reqOther.AddCookie(&http.Cookie{Name: "cgp_session", Value: "token-admin"})
	wOther := httptest.NewRecorder()
	router.ServeHTTP(wOther, reqOther)
	if wOther.Code != http.StatusNotFound {
		t.Errorf("expected 404 for cross-user contact verify, got %d", wOther.Code)
	}

	// User A calls verify on own contact cp-owner → 200
	reqOwn, _ := http.NewRequest("POST", "/api/v1/me/contacts/cp-owner/verify", nil)
	reqOwn.Header.Set("Origin", "http://localhost:3456")
	reqOwn.AddCookie(&http.Cookie{Name: "token-admin", Value: "token-admin"})
	reqOwn.AddCookie(&http.Cookie{Name: "cgp_session", Value: "token-admin"})
	wOwn := httptest.NewRecorder()
	router.ServeHTTP(wOwn, reqOwn)
	if wOwn.Code != http.StatusOK {
		t.Errorf("expected 200 for own contact verify, got %d. Body: %s", wOwn.Code, wOwn.Body.String())
	}
}

// inMemAuthRepo holds in-memory stores for real auth integration tests.
type inMemUserRepo struct {
	mu      sync.Mutex
	users   map[string]*model.User
	userSeq int
}

func newInMemUserRepo() *inMemUserRepo {
	return &inMemUserRepo{users: make(map[string]*model.User)}
}

func (r *inMemUserRepo) GetByID(ctx context.Context, userID string) (*model.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	u, ok := r.users[userID]
	if !ok {
		return nil, auth.ErrRepoNotFound
	}
	cpy := *u
	return &cpy, nil
}

func (r *inMemUserRepo) GetByIDForUpdate(ctx context.Context, userID string) (*model.User, error) {
	return r.GetByID(ctx, userID)
}

func (r *inMemUserRepo) Create(ctx context.Context, displayName string, isDemo bool) (*model.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.userSeq++
	id := fmt.Sprintf("usr-%04d", r.userSeq)
	u := &model.User{ID: id, DisplayName: displayName, IsDemo: isDemo, CreatedAt: time.Now()}
	r.users[id] = u
	cpy := *u
	return &cpy, nil
}

func (r *inMemUserRepo) LinkMember(ctx context.Context, userID, memberID string) error {
	return nil
}

type inMemIdentityRepo struct {
	mu         sync.Mutex
	identities map[string]*model.Identity
	identSeq   int
}

func newInMemIdentityRepo() *inMemIdentityRepo {
	return &inMemIdentityRepo{identities: make(map[string]*model.Identity)}
}

func (r *inMemIdentityRepo) FindByProviderSubject(ctx context.Context, provider, subject string) (*model.Identity, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := provider + ":" + subject
	id, ok := r.identities[key]
	if !ok {
		return nil, auth.ErrRepoNotFound
	}
	cpy := *id
	return &cpy, nil
}

func (r *inMemIdentityRepo) Insert(ctx context.Context, userID, provider, subject string) (*model.Identity, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := provider + ":" + subject
	if _, exists := r.identities[key]; exists {
		return nil, auth.ErrDuplicateIdentity
	}
	r.identSeq++
	id := &model.Identity{
		ID:              fmt.Sprintf("ident-%04d", r.identSeq),
		UserID:          userID,
		Provider:        provider,
		ProviderSubject: subject,
		LinkedAt:        time.Now(),
		LastLoginAt:     time.Now(),
	}
	r.identities[key] = id
	cpy := *id
	return &cpy, nil
}

func (r *inMemIdentityRepo) TouchLastLogin(ctx context.Context, identityID string) error {
	return nil
}

func (r *inMemIdentityRepo) CountByUser(ctx context.Context, userID string) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	count := 0
	for _, id := range r.identities {
		if id.UserID == userID {
			count++
		}
	}
	return count, nil
}

func (r *inMemIdentityRepo) Delete(ctx context.Context, identityID, userID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for k, id := range r.identities {
		if id.ID == identityID && id.UserID == userID {
			delete(r.identities, k)
			return nil
		}
	}
	return auth.ErrRepoNotFound
}

func (r *inMemIdentityRepo) ListByUser(ctx context.Context, userID string) ([]model.Identity, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var list []model.Identity
	for _, id := range r.identities {
		if id.UserID == userID {
			list = append(list, *id)
		}
	}
	return list, nil
}

type inMemSessionRepo struct {
	mu       sync.Mutex
	sessions map[string]string
}

func newInMemSessionRepo() *inMemSessionRepo {
	return &inMemSessionRepo{sessions: make(map[string]string)}
}

func (s *inMemSessionRepo) Insert(ctx context.Context, jti, userID string, expiresAt time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[jti] = userID
	return nil
}

func (s *inMemSessionRepo) RevokeByJti(ctx context.Context, jti string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, jti)
	return nil
}

type inMemContactRepo struct {
	mu       sync.Mutex
	contacts map[string]*model.ContactPoint
	seq      int
}

func newInMemContactRepo() *inMemContactRepo {
	return &inMemContactRepo{contacts: make(map[string]*model.ContactPoint)}
}

func (c *inMemContactRepo) FindByKindValue(ctx context.Context, kind, value string) (*model.ContactPoint, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	key := kind + ":" + value
	if cp, ok := c.contacts[key]; ok {
		cpy := *cp
		return &cpy, nil
	}
	return nil, auth.ErrRepoNotFound
}

func (c *inMemContactRepo) Insert(ctx context.Context, userID, kind, value string, verified bool, verifiedVia string) (*model.ContactPoint, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.seq++
	cp := &model.ContactPoint{
		ID:          fmt.Sprintf("cp-%04d", c.seq),
		UserID:      userID,
		Kind:        kind,
		Value:       value,
		Verified:    verified,
		VerifiedVia: &verifiedVia,
		CreatedAt:   time.Now(),
	}
	c.contacts[kind+":"+value] = cp
	c.contacts[cp.ID] = cp
	cpy := *cp
	return &cpy, nil
}

func (c *inMemContactRepo) MarkVerified(ctx context.Context, contactID, via string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if cp, ok := c.contacts[contactID]; ok {
		cp.Verified = true
		cp.VerifiedVia = &via
	}
	return nil
}

func (c *inMemContactRepo) GetByID(ctx context.Context, contactID string) (*model.ContactPoint, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if cp, ok := c.contacts[contactID]; ok {
		cpy := *cp
		return &cpy, nil
	}
	return nil, auth.ErrRepoNotFound
}

func (c *inMemContactRepo) ListByUser(ctx context.Context, userID string) ([]model.ContactPoint, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	var list []model.ContactPoint
	seen := make(map[string]bool)
	for _, cp := range c.contacts {
		if cp.UserID == userID && !seen[cp.ID] {
			seen[cp.ID] = true
			list = append(list, *cp)
		}
	}
	return list, nil
}

type inMemMagicLinkRepo struct{}

func (m *inMemMagicLinkRepo) Insert(ctx context.Context, tokenHash, email string, expiresAt time.Time) error {
	return nil
}
func (m *inMemMagicLinkRepo) Consume(ctx context.Context, tokenHash string) (string, error) {
	return "test@example.com", nil
}

type inMemContactLocker struct{}

func (l *inMemContactLocker) AcquireContactAdvisoryLock(ctx context.Context, kind, value string) error {
	return nil
}

type inMemOutboxRepo struct{}

func (o *inMemOutboxRepo) EnqueueMagicLink(ctx context.Context, email, linkURL string) error {
	return nil
}

// 13. Real Round-Trip Integration Test for Account Linking & OAuth Callbacks (C2)
func TestLinkCallbackFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Stub Google OAuth server simulating token exchange and userinfo endpoints
	oauthServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			code := r.FormValue("code")
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"access_token": "token-for-" + code,
				"token_type":   "Bearer",
				"expires_in":   3600,
			})
		case "/userinfo":
			authHdr := r.Header.Get("Authorization")
			tok := strings.TrimPrefix(authHdr, "Bearer ")
			sub := strings.TrimPrefix(tok, "token-for-")
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"sub":            "sub-" + sub,
				"name":           "Google User " + sub,
				"email":          sub + "@gmail.com",
				"email_verified": true,
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer oauthServer.Close()

	cfg := &config.Config{
		Port:                 8080,
		AppEnv:               config.EnvDev,
		CookieName:           config.ProdCookieName,
		JWTSecret:            "test-secret-min-32-chars-long-123456",
		JWTIssuer:            config.ProdJWTIssuer,
		GoogleClientID:       "test-google-client-id",
		GoogleClientSecret:   "test-google-client-secret",
		CORSAllowedOrigins:   []string{"http://localhost:3456"},
		PublicBaseURL:        "http://localhost:3456",
	}

	userStore := newInMemUserRepo()
	identStore := newInMemIdentityRepo()
	sessionStore := newInMemSessionRepo()
	contactStore := newInMemContactRepo()
	txMgr := &fakeTxManager{}

	realAuthSvc := auth.NewService(cfg, txMgr, auth.ServiceDeps{
		Users:      userStore,
		Identities: identStore,
		Contacts:   contactStore,
		Tokens:     &inMemMagicLinkRepo{},
		Sessions:   sessionStore,
		Locker:     &inMemContactLocker{},
		Outbox:     &inMemOutboxRepo{},
	})
	realAuthSvc.SetGoogleEndpoints(oauthServer.URL+"/auth", oauthServer.URL+"/token", oauthServer.URL+"/userinfo")

	router := NewRouter(Deps{
		Cfg:          cfg,
		Pinger:       &fakePinger{},
		TxManager:    txMgr,
		AuthService:  realAuthSvc,
		UserStore:    userStore,
		ContactStore: contactStore,
		FamilyRepo:   &fakeFamilyRepo{},
		MemberRepo:   &fakeMemberRepo{},
		RelationRepo: &fakeRelationRepo{},
		KinshipSvc:   &fakeKinshipService{},
		ExcelSvc:     &fakeExcelService{},
		FeedSvc:      &fakeFeedService{},
		SocialPostRepo: &fakeSocialPostRepo{},
		PushSvc:      &fakePushService{},
	})

	ctx := context.Background()

	// -------------------------------------------------------------------------
	// (i) Login callback (normal flow) still works
	// -------------------------------------------------------------------------
	wLogin := httptest.NewRecorder()
	rLogin, _ := http.NewRequest("GET", "/api/v1/auth/google/login", nil)
	router.ServeHTTP(wLogin, rLogin)
	if wLogin.Code != http.StatusFound {
		t.Fatalf("(i) expected 302 for login start, got %d", wLogin.Code)
	}
	loginLoc, _ := url.Parse(wLogin.Header().Get("Location"))
	loginState := loginLoc.Query().Get("state")
	var loginCookie *http.Cookie
	for _, c := range wLogin.Result().Cookies() {
		if c.Name == "cgp_oauth_state" {
			loginCookie = c
			break
		}
	}
	if loginCookie == nil {
		t.Fatal("(i) expected cgp_oauth_state cookie from login")
	}

	// Provider redirects back with login authorization code
	wCb1 := httptest.NewRecorder()
	rCb1, _ := http.NewRequest("GET", "/api/v1/auth/google/callback?code=login_user_1&state="+loginState, nil)
	rCb1.AddCookie(loginCookie)
	router.ServeHTTP(wCb1, rCb1)
	if wCb1.Code != http.StatusOK {
		t.Fatalf("(i) expected 200 for normal login callback, got %d. Body: %s", wCb1.Code, wCb1.Body.String())
	}
	var loginResp struct {
		User model.User `json:"user"`
	}
	if err := json.Unmarshal(wCb1.Body.Bytes(), &loginResp); err != nil {
		t.Fatalf("(i) unmarshal login response: %v", err)
	}
	user1ID := loginResp.User.ID
	if user1ID == "" {
		t.Fatal("(i) expected non-empty user ID from login response")
	}

	var sessionCookie1 *http.Cookie
	for _, c := range wCb1.Result().Cookies() {
		if c.Name == config.ProdCookieName && c.Value != "" {
			sessionCookie1 = c
			break
		}
	}
	if sessionCookie1 == nil {
		t.Fatal("(i) expected session cookie set on login callback")
	}

	// Verify initial identity persisted
	if _, err := identStore.FindByProviderSubject(ctx, model.ProviderGoogle, "sub-login_user_1"); err != nil {
		t.Fatalf("(i) expected initial identity persisted: %v", err)
	}

	// -------------------------------------------------------------------------
	// (ii) Link callback via link-state JWT dispatch → identity linked to session user
	// -------------------------------------------------------------------------
	wLinkStart := httptest.NewRecorder()
	rLinkStart, _ := http.NewRequest("POST", "/api/v1/me/link/google/start", nil)
	rLinkStart.Header.Set("Origin", "http://localhost:3456")
	rLinkStart.AddCookie(sessionCookie1)
	router.ServeHTTP(wLinkStart, rLinkStart)
	if wLinkStart.Code != http.StatusOK {
		t.Fatalf("(ii) expected 200 for link start, got %d. Body: %s", wLinkStart.Code, wLinkStart.Body.String())
	}

	var linkStartResp struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal(wLinkStart.Body.Bytes(), &linkStartResp); err != nil {
		t.Fatalf("(ii) unmarshal link start response: %v", err)
	}
	linkLoc, _ := url.Parse(linkStartResp.URL)
	linkState := linkLoc.Query().Get("state")

	var linkCookie1 *http.Cookie
	for _, c := range wLinkStart.Result().Cookies() {
		if c.Name == "cgp_oauth_state" {
			linkCookie1 = c
			break
		}
	}
	if linkCookie1 == nil {
		t.Fatal("(ii) expected cgp_oauth_state cookie from link start")
	}

	// Complete link at the public callback endpoint
	wLinkCb := httptest.NewRecorder()
	rLinkCb, _ := http.NewRequest("GET", "/api/v1/auth/google/callback?code=link_account_alpha&state="+linkState, nil)
	rLinkCb.AddCookie(linkCookie1)
	rLinkCb.AddCookie(sessionCookie1)
	router.ServeHTTP(wLinkCb, rLinkCb)
	if wLinkCb.Code != http.StatusOK {
		t.Fatalf("(ii) expected 200 for link callback, got %d. Body: %s", wLinkCb.Code, wLinkCb.Body.String())
	}

	// Assert persisted linkage in the repository
	linkedIdent, err := identStore.FindByProviderSubject(ctx, model.ProviderGoogle, "sub-link_account_alpha")
	if err != nil {
		t.Fatalf("(ii) expected newly linked identity to exist in store: %v", err)
	}
	if linkedIdent.UserID != user1ID {
		t.Fatalf("(ii) expected identity linked to User 1 (%q), got %q", user1ID, linkedIdent.UserID)
	}

	// Verify User 1 now has 2 identities
	user1Idents, err := identStore.ListByUser(ctx, user1ID)
	if err != nil || len(user1Idents) != 2 {
		t.Fatalf("(ii) expected User 1 to have 2 identities, got %d (err: %v)", len(user1Idents), err)
	}

	// -------------------------------------------------------------------------
	// (iii) Already-linked identity → 409 Conflict
	// -------------------------------------------------------------------------
	// Seed a separate user User 2 with active session
	user2, err := userStore.Create(ctx, "User 2", false)
	if err != nil {
		t.Fatalf("(iii) create user 2: %v", err)
	}
	token2, err := realAuthSvc.IssueToken(*user2)
	if err != nil {
		t.Fatalf("(iii) issue token user 2: %v", err)
	}
	sessionCookie2 := &http.Cookie{Name: config.ProdCookieName, Value: token2}

	// User 2 starts linking
	wLinkStart2 := httptest.NewRecorder()
	rLinkStart2, _ := http.NewRequest("POST", "/api/v1/me/link/google/start", nil)
	rLinkStart2.Header.Set("Origin", "http://localhost:3456")
	rLinkStart2.AddCookie(sessionCookie2)
	router.ServeHTTP(wLinkStart2, rLinkStart2)
	if wLinkStart2.Code != http.StatusOK {
		t.Fatalf("(iii) expected 200 for user 2 link start, got %d", wLinkStart2.Code)
	}
	var linkStartResp2 struct {
		URL string `json:"url"`
	}
	_ = json.Unmarshal(wLinkStart2.Body.Bytes(), &linkStartResp2)
	linkLoc2, _ := url.Parse(linkStartResp2.URL)
	linkState2 := linkLoc2.Query().Get("state")
	var linkCookie2 *http.Cookie
	for _, c := range wLinkStart2.Result().Cookies() {
		if c.Name == "cgp_oauth_state" {
			linkCookie2 = c
			break
		}
	}

	// User 2 tries to link the SAME Google account (sub-link_account_alpha) already bound to User 1
	wConflict := httptest.NewRecorder()
	rConflict, _ := http.NewRequest("GET", "/api/v1/auth/google/callback?code=link_account_alpha&state="+linkState2, nil)
	rConflict.AddCookie(linkCookie2)
	rConflict.AddCookie(sessionCookie2)
	router.ServeHTTP(wConflict, rConflict)
	if wConflict.Code != http.StatusConflict {
		t.Fatalf("(iii) expected 409 for already-linked identity, got %d. Body: %s", wConflict.Code, wConflict.Body.String())
	}

	// -------------------------------------------------------------------------
	// (iv) Bad/invalid state → 400 Bad Request
	// -------------------------------------------------------------------------
	wBadState := httptest.NewRecorder()
	rBadState, _ := http.NewRequest("GET", "/api/v1/auth/google/callback?code=some_code&state=tampered.or.invalid.state", nil)
	router.ServeHTTP(wBadState, rBadState)
	if wBadState.Code != http.StatusBadRequest {
		t.Fatalf("(iv) expected 400 for bad state, got %d. Body: %s", wBadState.Code, wBadState.Body.String())
	}

	// -------------------------------------------------------------------------
	// (v) Link callback path /api/v1/me/link/:provider/callback is genuinely reachable
	//     without any JWT cookie (no AuthMiddleware 401)
	// -------------------------------------------------------------------------
	wLinkStart3 := httptest.NewRecorder()
	rLinkStart3, _ := http.NewRequest("POST", "/api/v1/me/link/google/start", nil)
	rLinkStart3.Header.Set("Origin", "http://localhost:3456")
	rLinkStart3.AddCookie(sessionCookie1)
	router.ServeHTTP(wLinkStart3, rLinkStart3)
	var linkStartResp3 struct {
		URL string `json:"url"`
	}
	_ = json.Unmarshal(wLinkStart3.Body.Bytes(), &linkStartResp3)
	linkLoc3, _ := url.Parse(linkStartResp3.URL)
	linkState3 := linkLoc3.Query().Get("state")
	var linkCookie3 *http.Cookie
	for _, c := range wLinkStart3.Result().Cookies() {
		if c.Name == "cgp_oauth_state" {
			linkCookie3 = c
			break
		}
	}

	// Call /api/v1/me/link/google/callback WITHOUT JWT session cookie
	wMeCallback := httptest.NewRecorder()
	rMeCallback, _ := http.NewRequest("GET", "/api/v1/me/link/google/callback?code=link_account_beta&state="+linkState3, nil)
	rMeCallback.AddCookie(linkCookie3) // only state cookie, NO session cookie!
	router.ServeHTTP(wMeCallback, rMeCallback)
	if wMeCallback.Code != http.StatusOK {
		t.Fatalf("(v) expected 200 for public /me/link/google/callback, got %d. Body: %s", wMeCallback.Code, wMeCallback.Body.String())
	}

	// Verify identity was linked to User 1 despite NO session cookie on the callback request
	linkedBeta, err := identStore.FindByProviderSubject(ctx, model.ProviderGoogle, "sub-link_account_beta")
	if err != nil || linkedBeta.UserID != user1ID {
		t.Fatalf("(v) expected beta identity linked to User 1, got %+v (err: %v)", linkedBeta, err)
	}
}

// ---------------------------------------------------------------------------
// HandleCallback link-intent takeover prevention, asserted through the LIVE
// route (real Service + real router + httptest Google stub). Ported from the
// deleted service-level TestCompleteLink_SessionSwapTakeoverPrevention; the
// production properties now live entirely in the HandleCallback link
// dispatch (burn-on-read nonce, link-state JWT verification, session
// cross-check) and completeLinkWithClaims (ErrAlreadyLinked → 409).
// ---------------------------------------------------------------------------

// signTestState mirrors internal/auth's bindState ("payload.hmac(payload)")
// so the test can mint its own state parameters — including ones carrying
// deliberately malformed link-state JWTs — that unbind cleanly at the route.
func signTestState(secret, payload string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	return payload + "." + hex.EncodeToString(mac.Sum(nil))
}

// testLinkStateClaims mirrors auth.LinkStateClaims (same JSON contract) so
// tests can sign link-state JWTs with a chosen purpose/aud/iss defect.
type testLinkStateClaims struct {
	UserID   string `json:"sub"`
	Provider string `json:"provider"`
	Nonce    string `json:"nonce"`
	Purpose  string `json:"purpose"`
	jwt.RegisteredClaims
}

func TestHandleCallback_LinkIntent_SessionSwapTakeoverPrevention(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Stub Google OAuth server: code → access token → userinfo (sub "sub-<code>").
	oauthServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			code := r.FormValue("code")
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"access_token": "token-for-" + code,
				"token_type":   "Bearer",
				"expires_in":   3600,
			})
		case "/userinfo":
			authHdr := r.Header.Get("Authorization")
			tok := strings.TrimPrefix(authHdr, "Bearer ")
			sub := strings.TrimPrefix(tok, "token-for-")
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"sub":            "sub-" + sub,
				"name":           "Google User " + sub,
				"email":          sub + "@gmail.com",
				"email_verified": true,
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer oauthServer.Close()

	cfg := &config.Config{
		Port:               8080,
		AppEnv:             config.EnvDev,
		CookieName:         config.ProdCookieName,
		JWTSecret:          "test-secret-min-32-chars-long-123456",
		JWTIssuer:          config.ProdJWTIssuer,
		GoogleClientID:     "test-google-client-id",
		GoogleClientSecret: "test-google-client-secret",
		CORSAllowedOrigins: []string{"http://localhost:3456"},
		PublicBaseURL:      "http://localhost:3456",
	}

	userStore := newInMemUserRepo()
	identStore := newInMemIdentityRepo()
	sessionStore := newInMemSessionRepo()
	contactStore := newInMemContactRepo()
	txMgr := &fakeTxManager{}

	realAuthSvc := auth.NewService(cfg, txMgr, auth.ServiceDeps{
		Users:      userStore,
		Identities: identStore,
		Contacts:   contactStore,
		Tokens:     &inMemMagicLinkRepo{},
		Sessions:   sessionStore,
		Locker:     &inMemContactLocker{},
		Outbox:     &inMemOutboxRepo{},
	})
	realAuthSvc.SetGoogleEndpoints(oauthServer.URL+"/auth", oauthServer.URL+"/token", oauthServer.URL+"/userinfo")

	router := NewRouter(Deps{
		Cfg:            cfg,
		Pinger:         &fakePinger{},
		TxManager:      txMgr,
		AuthService:    realAuthSvc,
		UserStore:      userStore,
		ContactStore:   contactStore,
		FamilyRepo:     &fakeFamilyRepo{},
		MemberRepo:     &fakeMemberRepo{},
		RelationRepo:   &fakeRelationRepo{},
		KinshipSvc:     &fakeKinshipService{},
		ExcelSvc:       &fakeExcelService{},
		FeedSvc:        &fakeFeedService{},
		SocialPostRepo: &fakeSocialPostRepo{},
		PushSvc:        &fakePushService{},
	})

	ctx := context.Background()

	// seedSession creates a fresh user and returns (userID, session cookie).
	seedSession := func(t *testing.T, name string) (string, *http.Cookie) {
		t.Helper()
		u, err := userStore.Create(ctx, name, false)
		if err != nil {
			t.Fatalf("create %s: %v", name, err)
		}
		tok, err := realAuthSvc.IssueToken(*u)
		if err != nil {
			t.Fatalf("issue token for %s: %v", name, err)
		}
		return u.ID, &http.Cookie{Name: config.ProdCookieName, Value: tok}
	}

	// startLink drives POST /me/link/google/start and returns the authorize
	// state parameter plus the burn-on-read state cookie it minted.
	startLink := func(t *testing.T, sess *http.Cookie) (string, *http.Cookie) {
		t.Helper()
		w := httptest.NewRecorder()
		r, _ := http.NewRequest("POST", "/api/v1/me/link/google/start", nil)
		r.Header.Set("Origin", "http://localhost:3456")
		r.AddCookie(sess)
		router.ServeHTTP(w, r)
		if w.Code != http.StatusOK {
			t.Fatalf("link start: expected 200, got %d. Body: %s", w.Code, w.Body.String())
		}
		var resp struct {
			URL string `json:"url"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("link start: unmarshal response: %v", err)
		}
		loc, err := url.Parse(resp.URL)
		if err != nil {
			t.Fatalf("link start: parse authorize URL: %v", err)
		}
		state := loc.Query().Get("state")
		if state == "" {
			t.Fatal("link start: expected non-empty state parameter")
		}
		var stateCookie *http.Cookie
		for _, c := range w.Result().Cookies() {
			if c.Name == "cgp_oauth_state" {
				stateCookie = c
				break
			}
		}
		if stateCookie == nil {
			t.Fatal("link start: expected cgp_oauth_state cookie")
		}
		return state, stateCookie
	}

	// stateCookieNonce extracts the raw nonce from a signed cookie value
	// ("nonce.hmac"; the nonce itself never contains a dot).
	stateCookieNonce := func(cookieVal string) string {
		return cookieVal[:strings.LastIndexByte(cookieVal, '.')]
	}

	// callback GETs the public Google callback endpoint.
	callback := func(t *testing.T, code, state string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
		t.Helper()
		r, _ := http.NewRequest("GET", "/api/v1/auth/google/callback?code="+code+"&state="+state, nil)
		for _, c := range cookies {
			r.AddCookie(c)
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, r)
		return w
	}

	// forgedLinkState binds a hand-signed link-state JWT (with deliberately
	// wrong purpose/aud/iss) to the live state cookie's nonce, yielding a
	// callback state parameter whose ONLY defect is the given claim.
	forgedLinkState := func(t *testing.T, userID, nonce, purpose, aud, iss string) string {
		t.Helper()
		claims := &testLinkStateClaims{
			UserID:   userID,
			Provider: model.ProviderGoogle,
			Nonce:    nonce,
			Purpose:  purpose,
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer:    iss,
				Audience:  jwt.ClaimStrings{aud},
				IssuedAt:  jwt.NewNumericDate(time.Now()),
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(10 * time.Minute)),
			},
		}
		signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(cfg.JWTSecret))
		if err != nil {
			t.Fatalf("sign forged link-state JWT: %v", err)
		}
		return signTestState(cfg.JWTSecret, signed+"|test-verifier")
	}

	t.Run("happy_path_linkage_persisted", func(t *testing.T) {
		userAID, sessA := seedSession(t, "TP Happy User A")
		state, stateCookie := startLink(t, sessA)

		w := callback(t, "tp-happy", state, stateCookie, sessA)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200 for link callback, got %d. Body: %s", w.Code, w.Body.String())
		}

		// Linkage persisted and owned by User A.
		linked, err := identStore.FindByProviderSubject(ctx, model.ProviderGoogle, "sub-tp-happy")
		if err != nil {
			t.Fatalf("expected linked identity persisted: %v", err)
		}
		if linked.UserID != userAID {
			t.Fatalf("expected identity owned by %q, got %q", userAID, linked.UserID)
		}
		idents, err := identStore.ListByUser(ctx, userAID)
		if err != nil || len(idents) != 1 {
			t.Fatalf("expected User A to have exactly 1 identity, got %d (err: %v)", len(idents), err)
		}
	})

	t.Run("replayed_state_nonce_rejected", func(t *testing.T) {
		userAID, sessA := seedSession(t, "TP Replay User")
		state, stateCookie := startLink(t, sessA)

		w1 := callback(t, "tp-replay", state, stateCookie, sessA)
		if w1.Code != http.StatusOK {
			t.Fatalf("expected 200 on first link callback, got %d. Body: %s", w1.Code, w1.Body.String())
		}

		// Replay the byte-identical callback: the burn-on-read nonce is spent.
		w2 := callback(t, "tp-replay", state, stateCookie, sessA)
		if w2.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for replayed state nonce, got %d. Body: %s", w2.Code, w2.Body.String())
		}

		// The replay linked nothing new.
		idents, err := identStore.ListByUser(ctx, userAID)
		if err != nil || len(idents) != 1 {
			t.Fatalf("expected exactly 1 identity after replay, got %d (err: %v)", len(idents), err)
		}
	})

	t.Run("mismatched_state_nonce_rejected", func(t *testing.T) {
		_, sessA := seedSession(t, "TP Mismatch User")
		_, cookieA := startLink(t, sessA)
		stateB, _ := startLink(t, sessA)

		// Cookie from start #1 + state param from start #2 → nonce mismatch.
		w := callback(t, "tp-mismatch", stateB, cookieA)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for mismatched state nonce, got %d. Body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("absent_state_cookie_rejected", func(t *testing.T) {
		_, sessA := seedSession(t, "TP Absent Cookie User")
		state, _ := startLink(t, sessA)

		// Valid link-state param, but the burn-on-read cookie is missing.
		w := callback(t, "tp-absent", state)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for absent state cookie, got %d. Body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("wrong_purpose_rejected", func(t *testing.T) {
		userAID, sessA := seedSession(t, "TP Purpose User")
		_, stateCookie := startLink(t, sessA)
		forged := forgedLinkState(t, userAID, stateCookieNonce(stateCookie.Value), "login", "link", cfg.JWTIssuer)

		w := callback(t, "tp-purpose", forged, stateCookie)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for wrong purpose claim, got %d. Body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("wrong_audience_rejected", func(t *testing.T) {
		userAID, sessA := seedSession(t, "TP Audience User")
		_, stateCookie := startLink(t, sessA)
		forged := forgedLinkState(t, userAID, stateCookieNonce(stateCookie.Value), auth.LinkStatePurpose, cfg.JWTIssuer, cfg.JWTIssuer)

		w := callback(t, "tp-audience", forged, stateCookie)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for wrong audience claim, got %d. Body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("wrong_issuer_rejected", func(t *testing.T) {
		userAID, sessA := seedSession(t, "TP Issuer User")
		_, stateCookie := startLink(t, sessA)
		forged := forgedLinkState(t, userAID, stateCookieNonce(stateCookie.Value), auth.LinkStatePurpose, "link", config.DemoJWTIssuer)

		w := callback(t, "tp-issuer", forged, stateCookie)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for wrong issuer claim, got %d. Body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("cross_user_session_cookie_rejected", func(t *testing.T) {
		_, sessA := seedSession(t, "TP Cross User A")
		userBID, sessB := seedSession(t, "TP Cross User B")
		state, stateCookie := startLink(t, sessA) // link intent minted for A

		// Presented with B's session cookie: must fail closed.
		w := callback(t, "tp-cross", state, stateCookie, sessB)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for cross-user session cookie, got %d. Body: %s", w.Code, w.Body.String())
		}

		// Neither user gained the identity.
		if _, err := identStore.FindByProviderSubject(ctx, model.ProviderGoogle, "sub-tp-cross"); err == nil {
			t.Fatal("cross-user session must not link the identity")
		}
		identsB, err := identStore.ListByUser(ctx, userBID)
		if err != nil || len(identsB) != 0 {
			t.Fatalf("expected User B to have 0 identities, got %d (err: %v)", len(identsB), err)
		}
	})

	t.Run("already_linked_conflict_409", func(t *testing.T) {
		userAID, sessA := seedSession(t, "TP Owner A")
		_, sessB := seedSession(t, "TP Attacker B")

		// User A legitimately links the Google account sub-tp-conflict.
		stateA, cookieA := startLink(t, sessA)
		wA := callback(t, "tp-conflict", stateA, cookieA, sessA)
		if wA.Code != http.StatusOK {
			t.Fatalf("expected 200 for User A link, got %d. Body: %s", wA.Code, wA.Body.String())
		}

		// User B tries to claim the SAME provider account → 409, no takeover.
		stateB, cookieB := startLink(t, sessB)
		wB := callback(t, "tp-conflict", stateB, cookieB, sessB)
		if wB.Code != http.StatusConflict {
			t.Fatalf("expected 409 for already-linked identity, got %d. Body: %s", wB.Code, wB.Body.String())
		}

		// Ownership unchanged.
		linked, err := identStore.FindByProviderSubject(ctx, model.ProviderGoogle, "sub-tp-conflict")
		if err != nil || linked.UserID != userAID {
			t.Fatalf("expected identity still owned by User A %q, got %+v (err: %v)", userAID, linked, err)
		}
	})
}

func TestVerifyMagicLinkPOST(t *testing.T) {
	r, _, _, _ := setupTestRouter()

	// 1. GET to /api/v1/auth/email/verify should not match or method not allowed
	reqGET, _ := http.NewRequest("GET", "/api/v1/auth/email/verify?token=valid-token", nil)
	wGET := httptest.NewRecorder()
	r.ServeHTTP(wGET, reqGET)
	if wGET.Code != http.StatusNotFound && wGET.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 404 or 405 for GET /api/v1/auth/email/verify, got %d", wGET.Code)
	}

	// 2. POST with valid token body
	body := `{"token":"valid-token"}`
	reqPOST, _ := http.NewRequest("POST", "/api/v1/auth/email/verify", strings.NewReader(body))
	reqPOST.Header.Set("Content-Type", "application/json")
	reqPOST.Header.Set("Origin", "http://localhost:3456")
	wPOST := httptest.NewRecorder()
	r.ServeHTTP(wPOST, reqPOST)
	if wPOST.Code != http.StatusOK {
		t.Fatalf("expected 200 for POST /api/v1/auth/email/verify, got %d. Body: %s", wPOST.Code, wPOST.Body.String())
	}

	// 3. POST with empty token → 401
	bodyEmpty := `{"token":""}`
	reqEmpty, _ := http.NewRequest("POST", "/api/v1/auth/email/verify", strings.NewReader(bodyEmpty))
	reqEmpty.Header.Set("Content-Type", "application/json")
	reqEmpty.Header.Set("Origin", "http://localhost:3456")
	wEmpty := httptest.NewRecorder()
	r.ServeHTTP(wEmpty, reqEmpty)
	if wEmpty.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for empty token, got %d", wEmpty.Code)
	}

	// 4. POST with expired token → 401
	bodyExpired := `{"token":"expired"}`
	reqExpired, _ := http.NewRequest("POST", "/api/v1/auth/email/verify", strings.NewReader(bodyExpired))
	reqExpired.Header.Set("Content-Type", "application/json")
	reqExpired.Header.Set("Origin", "http://localhost:3456")
	wExpired := httptest.NewRecorder()
	r.ServeHTTP(wExpired, reqExpired)
	if wExpired.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for expired token, got %d", wExpired.Code)
	}

	// 5. POST with bad JSON body → 400
	reqBadJSON, _ := http.NewRequest("POST", "/api/v1/auth/email/verify", strings.NewReader("invalid-json"))
	reqBadJSON.Header.Set("Content-Type", "application/json")
	reqBadJSON.Header.Set("Origin", "http://localhost:3456")
	wBadJSON := httptest.NewRecorder()
	r.ServeHTTP(wBadJSON, reqBadJSON)
	if wBadJSON.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for malformed json, got %d", wBadJSON.Code)
	}
}

// ---------------------------------------------------------------------------
// OAuth callback browser/JSON content negotiation (SPA redirect seam)
// ---------------------------------------------------------------------------

const (
	browserAccept = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
	// oauthSeamBase mirrors cfg.PublicBaseURL of setupTestRouter.
	oauthSeamBase = "http://localhost:3456"
)

// callbackGet fires a GET at the login callback endpoint with the given
// Accept header ("" = no header at all) and hostile Host override ("" = none).
func callbackGet(r *gin.Engine, code, accept, hostOverride string) *httptest.ResponseRecorder {
	target := "/api/v1/auth/google/callback?code=" + code + "&state=any-state"
	req, _ := http.NewRequest("GET", target, nil)
	if hostOverride != "" {
		req.Host = hostOverride
	}
	if accept != "" {
		req.Header.Set("Accept", accept)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// assertOAuthRedirect asserts a 302 whose Location is EXACTLY the SPA seam
// URL with the given query (never derived from the request Host).
func assertOAuthRedirect(t *testing.T, w *httptest.ResponseRecorder, query string) {
	t.Helper()
	if w.Code != http.StatusFound {
		t.Fatalf("expected 302 redirect, got %d. Body: %s", w.Code, w.Body.String())
	}
	want := oauthSeamBase + "/auth/oauth/callback?" + query
	if got := w.Header().Get("Location"); got != want {
		t.Fatalf("expected Location %q, got %q", want, got)
	}
}

// TestOAuthCallbackBrowserRedirect covers the negotiation matrix on the
// callback seam: browser Accept → 302 with stable ?oauth_error= / ?oauth_linked=
// codes; JSON or missing Accept → historical envelopes byte-for-byte; and the
// open-redirect guard against a hostile Host header.
func TestOAuthCallbackBrowserRedirect(t *testing.T) {
	r, _, _, _ := setupTestRouter()

	// (1) Browser Accept + invalid state → 302 ?oauth_error=invalid_state
	assertOAuthRedirect(t, callbackGet(r, "bad_state", browserAccept, ""), "oauth_error=invalid_state")

	// (2) Browser Accept + already-linked / provider failure rows
	assertOAuthRedirect(t, callbackGet(r, "already_linked", browserAccept, ""), "oauth_error=already_linked")
	assertOAuthRedirect(t, callbackGet(r, "provider_fail", browserAccept, ""), "oauth_error=provider_error")
	// Demo isolation and unclassified errors pin the rest of the fixed code set.
	assertOAuthRedirect(t, callbackGet(r, "demo_restricted", browserAccept, ""), "oauth_error=demo_restricted")
	assertOAuthRedirect(t, callbackGet(r, "server_boom", browserAccept, ""), "oauth_error=server_error")

	// Case-insensitive Accept matching: TEXT/HTML is still browser mode.
	assertOAuthRedirect(t, callbackGet(r, "bad_state", "TEXT/HTML; charset=utf-8", ""), "oauth_error=invalid_state")

	// (3) Browser Accept + success → 302 ?oauth_linked=google WITH session cookie
	wOK := callbackGet(r, "good_code", browserAccept, "")
	if wOK.Code != http.StatusFound {
		t.Fatalf("(3) expected 302 on success, got %d. Body: %s", wOK.Code, wOK.Body.String())
	}
	assertOAuthRedirect(t, wOK, "oauth_linked=google")
	var sessionCookie *http.Cookie
	for _, c := range wOK.Result().Cookies() {
		if c.Name == "cgp_session" && c.Value != "" {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil {
		t.Fatal("(3) expected session cookie set on the 302 response")
	}

	// (4) XHR Accept → JSON envelopes unchanged
	wJSON400 := callbackGet(r, "bad_state", "application/json", "")
	if wJSON400.Code != http.StatusBadRequest {
		t.Fatalf("(4) expected 400 JSON for invalid state, got %d. Body: %s", wJSON400.Code, wJSON400.Body.String())
	}
	var env400 model.ErrorEnvelope
	if err := json.Unmarshal(wJSON400.Body.Bytes(), &env400); err != nil {
		t.Fatalf("(4) unmarshal 400 envelope: %v", err)
	}
	if env400.Code != model.CodeValidationError || env400.Success {
		t.Errorf("(4) expected VALIDATION_ERROR success=false envelope, got %+v", env400)
	}

	wJSON409 := callbackGet(r, "already_linked", "application/json", "")
	if wJSON409.Code != http.StatusConflict {
		t.Fatalf("(4) expected 409 JSON for already-linked, got %d. Body: %s", wJSON409.Code, wJSON409.Body.String())
	}
	var env409 model.ErrorEnvelope
	if err := json.Unmarshal(wJSON409.Body.Bytes(), &env409); err != nil {
		t.Fatalf("(4) unmarshal 409 envelope: %v", err)
	}
	if env409.Code != model.CodeConflict || env409.Success {
		t.Errorf("(4) expected CONFLICT success=false envelope, got %+v", env409)
	}

	wJSON502 := callbackGet(r, "provider_fail", "application/json", "")
	if wJSON502.Code != http.StatusBadGateway {
		t.Fatalf("(4) expected 502 JSON for provider failure, got %d. Body: %s", wJSON502.Code, wJSON502.Body.String())
	}

	// (5) Open-redirect guard: hostile Host header must not leak into Location.
	assertOAuthRedirect(t, callbackGet(r, "bad_state", browserAccept, "evil.example.com"), "oauth_error=invalid_state")

	// (6) No Accept header at all → JSON mode (safe default for API clients).
	wNoAccept := callbackGet(r, "bad_state", "", "")
	if wNoAccept.Code != http.StatusBadRequest {
		t.Fatalf("(6) expected 400 JSON with no Accept header, got %d. Body: %s", wNoAccept.Code, wNoAccept.Body.String())
	}
	var envNoAccept model.ErrorEnvelope
	if err := json.Unmarshal(wNoAccept.Body.Bytes(), &envNoAccept); err != nil {
		t.Fatalf("(6) unmarshal no-Accept envelope: %v", err)
	}
	if envNoAccept.Code != model.CodeValidationError {
		t.Errorf("(6) expected VALIDATION_ERROR envelope, got %+v", envNoAccept)
	}

	// JSON success must remain byte-shaped as before (200 + user/is_new envelope).
	wJSONOK := callbackGet(r, "good_code", "application/json", "")
	if wJSONOK.Code != http.StatusOK {
		t.Fatalf("expected 200 JSON on success, got %d. Body: %s", wJSONOK.Code, wJSONOK.Body.String())
	}
	var successResp struct {
		User  model.User `json:"user"`
		IsNew bool       `json:"is_new"`
	}
	if err := json.Unmarshal(wJSONOK.Body.Bytes(), &successResp); err != nil {
		t.Fatalf("unmarshal JSON success envelope: %v", err)
	}
	if successResp.User.ID != "usr-1" {
		t.Errorf("expected user usr-1 in JSON success envelope, got %+v", successResp)
	}
}

// TestOAuthCallbackBrowserRedirectRealFlow replays the seam against the REAL
// auth service (stub Google endpoints): browser success carries the session
// cookie on the 302, and already-linked / provider-exchange failures redirect
// with their stable codes while JSON mode keeps the envelopes.
func TestOAuthCallbackBrowserRedirectRealFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var failTokenExchange bool
	oauthServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			w.Header().Set("Content-Type", "application/json")
			if failTokenExchange {
				w.WriteHeader(http.StatusInternalServerError)
				_ = json.NewEncoder(w).Encode(map[string]any{"error": "server_error"})
				return
			}
			code := r.FormValue("code")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"access_token": "token-for-" + code,
				"token_type":   "Bearer",
				"expires_in":   3600,
			})
		case "/userinfo":
			sub := strings.TrimPrefix(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "), "token-for-")
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"sub":            "sub-" + sub,
				"name":           "Google User " + sub,
				"email":          sub + "@gmail.com",
				"email_verified": true,
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer oauthServer.Close()

	cfg := &config.Config{
		Port:               8080,
		AppEnv:             config.EnvDev,
		CookieName:         config.ProdCookieName,
		JWTSecret:          "test-secret-min-32-chars-long-123456",
		JWTIssuer:          config.ProdJWTIssuer,
		GoogleClientID:     "test-google-client-id",
		GoogleClientSecret: "test-google-client-secret",
		CORSAllowedOrigins: []string{"http://localhost:3456"},
		PublicBaseURL:      "http://localhost:3456",
	}

	userStore := newInMemUserRepo()
	identStore := newInMemIdentityRepo()
	sessionStore := newInMemSessionRepo()
	contactStore := newInMemContactRepo()
	txMgr := &fakeTxManager{}

	realAuthSvc := auth.NewService(cfg, txMgr, auth.ServiceDeps{
		Users:      userStore,
		Identities: identStore,
		Contacts:   contactStore,
		Tokens:     &inMemMagicLinkRepo{},
		Sessions:   sessionStore,
		Locker:     &inMemContactLocker{},
		Outbox:     &inMemOutboxRepo{},
	})
	realAuthSvc.SetGoogleEndpoints(oauthServer.URL+"/auth", oauthServer.URL+"/token", oauthServer.URL+"/userinfo")

	router := NewRouter(Deps{
		Cfg:            cfg,
		Pinger:         &fakePinger{},
		TxManager:      txMgr,
		AuthService:    realAuthSvc,
		UserStore:      userStore,
		ContactStore:   contactStore,
		FamilyRepo:     &fakeFamilyRepo{},
		MemberRepo:     &fakeMemberRepo{},
		RelationRepo:   &fakeRelationRepo{},
		KinshipSvc:     &fakeKinshipService{},
		ExcelSvc:       &fakeExcelService{},
		FeedSvc:        &fakeFeedService{},
		SocialPostRepo: &fakeSocialPostRepo{},
		PushSvc:        &fakePushService{},
	})

	ctx := context.Background()

	// Start a login flow: grab state + state cookie.
	wLogin := httptest.NewRecorder()
	rLogin, _ := http.NewRequest("GET", "/api/v1/auth/google/login", nil)
	router.ServeHTTP(wLogin, rLogin)
	if wLogin.Code != http.StatusFound {
		t.Fatalf("expected 302 for login start, got %d", wLogin.Code)
	}
	loginLoc, _ := url.Parse(wLogin.Header().Get("Location"))
	loginState := loginLoc.Query().Get("state")
	var stateCookie *http.Cookie
	for _, c := range wLogin.Result().Cookies() {
		if c.Name == "cgp_oauth_state" {
			stateCookie = c
			break
		}
	}
	if stateCookie == nil {
		t.Fatal("expected cgp_oauth_state cookie from login")
	}

	// (a) Browser login callback → 302 ?oauth_linked=google + session cookie.
	wBrowserOK := httptest.NewRecorder()
	rBrowserOK, _ := http.NewRequest("GET", "/api/v1/auth/google/callback?code=real_user_1&state="+loginState, nil)
	rBrowserOK.Header.Set("Accept", browserAccept)
	rBrowserOK.AddCookie(stateCookie)
	router.ServeHTTP(wBrowserOK, rBrowserOK)
	if wBrowserOK.Code != http.StatusFound {
		t.Fatalf("(a) expected 302 for browser login callback, got %d. Body: %s", wBrowserOK.Code, wBrowserOK.Body.String())
	}
	wantOK := oauthSeamBase + "/auth/oauth/callback?oauth_linked=google"
	if got := wBrowserOK.Header().Get("Location"); got != wantOK {
		t.Fatalf("(a) expected Location %q, got %q", wantOK, got)
	}
	var sessionCookie *http.Cookie
	for _, c := range wBrowserOK.Result().Cookies() {
		if c.Name == config.ProdCookieName && c.Value != "" {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil {
		t.Fatal("(a) expected session cookie on the browser 302")
	}
	if _, err := identStore.FindByProviderSubject(ctx, model.ProviderGoogle, "sub-real_user_1"); err != nil {
		t.Fatalf("(a) expected identity persisted: %v", err)
	}

	// (b) Same Google identity linked to User 2 → browser 302 ?oauth_error=already_linked.
	user2, err := userStore.Create(ctx, "User 2", false)
	if err != nil {
		t.Fatalf("(b) create user 2: %v", err)
	}
	token2, err := realAuthSvc.IssueToken(*user2)
	if err != nil {
		t.Fatalf("(b) issue token user 2: %v", err)
	}
	sessionCookie2 := &http.Cookie{Name: config.ProdCookieName, Value: token2}

	wLinkStart := httptest.NewRecorder()
	rLinkStart, _ := http.NewRequest("POST", "/api/v1/me/link/google/start", nil)
	rLinkStart.Header.Set("Origin", "http://localhost:3456")
	rLinkStart.AddCookie(sessionCookie2)
	router.ServeHTTP(wLinkStart, rLinkStart)
	if wLinkStart.Code != http.StatusOK {
		t.Fatalf("(b) expected 200 for link start, got %d. Body: %s", wLinkStart.Code, wLinkStart.Body.String())
	}
	var linkStartResp struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal(wLinkStart.Body.Bytes(), &linkStartResp); err != nil {
		t.Fatalf("(b) unmarshal link start: %v", err)
	}
	linkLoc, _ := url.Parse(linkStartResp.URL)
	linkState := linkLoc.Query().Get("state")
	var linkCookie *http.Cookie
	for _, c := range wLinkStart.Result().Cookies() {
		if c.Name == "cgp_oauth_state" {
			linkCookie = c
			break
		}
	}
	if linkCookie == nil {
		t.Fatal("(b) expected cgp_oauth_state cookie from link start")
	}

	wConflict := httptest.NewRecorder()
	rConflict, _ := http.NewRequest("GET", "/api/v1/auth/google/callback?code=real_user_1&state="+linkState, nil)
	rConflict.Header.Set("Accept", browserAccept)
	rConflict.AddCookie(linkCookie)
	rConflict.AddCookie(sessionCookie2)
	router.ServeHTTP(wConflict, rConflict)
	if wConflict.Code != http.StatusFound {
		t.Fatalf("(b) expected 302 for browser already-linked, got %d. Body: %s", wConflict.Code, wConflict.Body.String())
	}
	wantConflict := oauthSeamBase + "/auth/oauth/callback?oauth_error=already_linked"
	if got := wConflict.Header().Get("Location"); got != wantConflict {
		t.Fatalf("(b) expected Location %q, got %q", wantConflict, got)
	}

	// (c) Provider exchange failure → browser 302 ?oauth_error=provider_error.
	wLinkStart3 := httptest.NewRecorder()
	rLinkStart3, _ := http.NewRequest("POST", "/api/v1/me/link/google/start", nil)
	rLinkStart3.Header.Set("Origin", "http://localhost:3456")
	rLinkStart3.AddCookie(sessionCookie2)
	router.ServeHTTP(wLinkStart3, rLinkStart3)
	var linkStartResp3 struct {
		URL string `json:"url"`
	}
	_ = json.Unmarshal(wLinkStart3.Body.Bytes(), &linkStartResp3)
	linkLoc3, _ := url.Parse(linkStartResp3.URL)
	linkState3 := linkLoc3.Query().Get("state")
	var linkCookie3 *http.Cookie
	for _, c := range wLinkStart3.Result().Cookies() {
		if c.Name == "cgp_oauth_state" {
			linkCookie3 = c
			break
		}
	}

	failTokenExchange = true
	defer func() { failTokenExchange = false }()
	wProviderFail := httptest.NewRecorder()
	rProviderFail, _ := http.NewRequest("GET", "/api/v1/auth/google/callback?code=whatever&state="+linkState3, nil)
	rProviderFail.Header.Set("Accept", browserAccept)
	rProviderFail.AddCookie(linkCookie3)
	rProviderFail.AddCookie(sessionCookie2)
	router.ServeHTTP(wProviderFail, rProviderFail)
	if wProviderFail.Code != http.StatusFound {
		t.Fatalf("(c) expected 302 for browser provider failure, got %d. Body: %s", wProviderFail.Code, wProviderFail.Body.String())
	}
	wantProviderFail := oauthSeamBase + "/auth/oauth/callback?oauth_error=provider_error"
	if got := wProviderFail.Header().Get("Location"); got != wantProviderFail {
		t.Fatalf("(c) expected Location %q, got %q", wantProviderFail, got)
	}

	// (d) JSON mode on the real service: success stays a 200 envelope and
	// invalid state stays a 400 envelope — negotiation must not leak.
	wLogin2 := httptest.NewRecorder()
	rLogin2, _ := http.NewRequest("GET", "/api/v1/auth/google/login", nil)
	router.ServeHTTP(wLogin2, rLogin2)
	loginLoc2, _ := url.Parse(wLogin2.Header().Get("Location"))
	loginState2 := loginLoc2.Query().Get("state")
	var stateCookie2 *http.Cookie
	for _, c := range wLogin2.Result().Cookies() {
		if c.Name == "cgp_oauth_state" {
			stateCookie2 = c
			break
		}
	}

	failTokenExchange = false
	wJSONOK := httptest.NewRecorder()
	rJSONOK, _ := http.NewRequest("GET", "/api/v1/auth/google/callback?code=real_user_3&state="+loginState2, nil)
	rJSONOK.Header.Set("Accept", "application/json")
	rJSONOK.AddCookie(stateCookie2)
	router.ServeHTTP(wJSONOK, rJSONOK)
	if wJSONOK.Code != http.StatusOK {
		t.Fatalf("(d) expected 200 JSON for login callback, got %d. Body: %s", wJSONOK.Code, wJSONOK.Body.String())
	}
	var jsonOK struct {
		User model.User `json:"user"`
	}
	if err := json.Unmarshal(wJSONOK.Body.Bytes(), &jsonOK); err != nil || jsonOK.User.ID == "" {
		t.Fatalf("(d) expected JSON user envelope, got %s (err: %v)", wJSONOK.Body.String(), err)
	}

	wJSONBad := httptest.NewRecorder()
	rJSONBad, _ := http.NewRequest("GET", "/api/v1/auth/google/callback?code=x&state=tampered.state", nil)
	rJSONBad.Header.Set("Accept", "application/json")
	router.ServeHTTP(wJSONBad, rJSONBad)
	if wJSONBad.Code != http.StatusBadRequest {
		t.Fatalf("(d) expected 400 JSON for invalid state, got %d. Body: %s", wJSONBad.Code, wJSONBad.Body.String())
	}
	var env400 model.ErrorEnvelope
	if err := json.Unmarshal(wJSONBad.Body.Bytes(), &env400); err != nil || env400.Code != model.CodeValidationError {
		t.Fatalf("(d) expected VALIDATION_ERROR envelope, got %s (err: %v)", wJSONBad.Body.String(), err)
	}
}
