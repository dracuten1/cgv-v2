package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/excel"
	"github.com/dracuten1/cgv-v2/api/internal/feed"
	"github.com/dracuten1/cgv-v2/api/internal/kinship"
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

// LinkMember satisfies the extended AuthService interface; M1-rule behavior
// is exercised against the REAL auth.Service in TestLinkMember_*.
func (a *fakeAuthService) LinkMember(ctx context.Context, userID, memberID string) (*auth.UserProfile, error) {
	return nil, auth.ErrUserNotFound
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

type fakeKinshipService struct {
	labelsByFrom map[string]map[string]string
}

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

// GetLabels returns the pre-canned dictionary for fromID when configured.
func (k *fakeKinshipService) GetLabels(ctx context.Context, familyID, fromID, dialect string) (map[string]string, error) {
	if k == nil || k.labelsByFrom == nil {
		return map[string]string{}, nil
	}
	if labels, ok := k.labelsByFrom[fromID]; ok {
		return labels, nil
	}
	return nil, kinship.ErrMemberNotFound
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

// GetByMemberID resolves the user currently holding a member link.
func (u *fakeUserStore) GetByMemberID(ctx context.Context, memberID string) (*model.User, error) {
	for _, usr := range u.users {
		if usr.MemberID != nil && *usr.MemberID == memberID {
			cpy := *usr
			return &cpy, nil
		}
	}
	return nil, nil
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
		KinshipInv:     &fakeKinshipInvalidator{},
		ExcelSvc:       excelSvc,
		FeedSvc:        feedSvc,
		SocialPostRepo: socialPostRepo,
		PushSvc:        pushSvc,
	})

	return r, memberRepo, authSvc, pinger
}

// 1. Assert route registration (all PROMPT §5 routes + /healthz)
