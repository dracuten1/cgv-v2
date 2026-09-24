package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/kinship"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	genrepo "github.com/dracuten1/cgv-v2/api/internal/repository/genealogy"
	"github.com/gin-gonic/gin"
)

// ===========================================================================
// Phase 1 (family-tree-view): batched kinship labels + POST /me/member
// ===========================================================================

// fakeKinshipInvalidator records Invalidate calls (M3 wiring observable).
type fakeKinshipInvalidator struct {
	mu       sync.Mutex
	families []string
}

func (f *fakeKinshipInvalidator) Invalidate(familyID string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.families = append(f.families, familyID)
}

func (f *fakeKinshipInvalidator) recorded() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]string(nil), f.families...)
}

// fakeMemberLookup backs auth.MemberLookup (M1 Rule 2 member existence).
type fakeMemberLookup struct {
	members map[string]*model.Member
}

func (f *fakeMemberLookup) GetByID(ctx context.Context, memberID string) (*model.Member, error) {
	if m, ok := f.members[memberID]; ok {
		cpy := *m
		return &cpy, nil
	}
	return nil, auth.ErrRepoNotFound
}

// kinshipGraphStore is a stateful in-memory store backing MemberRepository,
// RelationshipRepository, FamilyRepository (handler side) AND
// kinship.KinshipGraphLoader / kinship.FamilyVersionSource — so the REAL
// kinship engine can be exercised through the HTTP seam, including the
// mutate→labels freshness contract (M3/K1).
type kinshipGraphStore struct {
	mu       sync.Mutex
	members  map[string]*model.Member
	seq      int
	pc       []model.ParentChild
	sp       []model.Spouse
	families map[string]*model.Family
	// pcVersions tracks families.version per family id (guarded by mu).
	pcVersions map[string]int64
}

func newKinshipGraphStore() *kinshipGraphStore {
	return &kinshipGraphStore{
		members:  map[string]*model.Member{},
		families: map[string]*model.Family{},
	}
}

func (s *kinshipGraphStore) seedMember(id, familyID, name string, gender model.Gender, gen int) {
	s.members[id] = &model.Member{ID: id, FamilyID: familyID, FullName: name, Gender: gender, GenerationIndex: gen, IsLiving: true}
}

func (s *kinshipGraphStore) seedFamily(id, name string, version int64) {
	s.families[id] = &model.Family{ID: id, Name: name, Version: version}
	s.versionsSet(id, version)
}

// versions is keyed like families; stored in a plain map guarded by mu.
func (s *kinshipGraphStore) versionsSet(familyID string, v int64) {
	if s.pcVersions == nil {
		s.pcVersions = map[string]int64{}
	}
	s.pcVersions[familyID] = v
}

func (s *kinshipGraphStore) version(familyID string) int64 {
	if s.pcVersions == nil {
		return 0
	}
	return s.pcVersions[familyID]
}

// ---- MemberRepository ----

func (s *kinshipGraphStore) List(ctx context.Context, search string, limit, offset int) (*model.Page[model.Member], error) {
	items := []model.Member{}
	for _, m := range s.members {
		items = append(items, *m)
	}
	return &model.Page[model.Member]{Items: items, Total: int64(len(items)), Limit: limit, Offset: offset}, nil
}

func (s *kinshipGraphStore) ListByFamily(ctx context.Context, familyID string) ([]model.Member, error) {
	items := []model.Member{}
	for _, m := range s.members {
		if m.FamilyID == familyID {
			items = append(items, *m)
		}
	}
	return items, nil
}

func (s *kinshipGraphStore) GetByID(ctx context.Context, memberID string) (*genrepo.MemberWithFamily, error) {
	if m, ok := s.members[memberID]; ok {
		return &genrepo.MemberWithFamily{Member: *m, FamilyName: "Họ Nguyễn"}, nil
	}
	return nil, genrepo.ErrNotFound
}

func (s *kinshipGraphStore) GetForUpdate(ctx context.Context, dbtx database.DBTX, memberID string) (*model.Member, error) {
	if m, ok := s.members[memberID]; ok {
		cpy := *m
		return &cpy, nil
	}
	return nil, genrepo.ErrNotFound
}

func (s *kinshipGraphStore) Create(ctx context.Context, dbtx database.DBTX, mem *model.Member) (*model.Member, error) {
	s.seq++
	mem.ID = fmt.Sprintf("00000000-0000-4000-8000-%012d", s.seq)
	cpy := *mem
	s.members[mem.ID] = &cpy
	out := cpy
	return &out, nil
}

func (s *kinshipGraphStore) Update(ctx context.Context, dbtx database.DBTX, mem *model.Member) error {
	cpy := *mem
	s.members[mem.ID] = &cpy
	return nil
}

func (s *kinshipGraphStore) Delete(ctx context.Context, dbtx database.DBTX, memberID string) error {
	delete(s.members, memberID)
	return nil
}

// LoadGraph satisfies BOTH the handler MemberRepository port and
// kinship.KinshipGraphLoader — it reports the family's CURRENT version so
// the engine caches under the right snapshot key.
func (s *kinshipGraphStore) LoadGraph(ctx context.Context, familyID string) ([]model.Member, []model.ParentChild, []model.Spouse, int64, error) {
	items := []model.Member{}
	for _, m := range s.members {
		if m.FamilyID == familyID {
			items = append(items, *m)
		}
	}
	return items, s.pc, s.sp, s.version(familyID), nil
}

// ---- RelationshipRepository ----

func (s *kinshipGraphStore) AddParentChild(ctx context.Context, dbtx database.DBTX, parentID, childID string) error {
	s.pc = append(s.pc, model.ParentChild{ParentID: parentID, ChildID: childID})
	return nil
}

func (s *kinshipGraphStore) RemoveParentChild(ctx context.Context, dbtx database.DBTX, parentID, childID string) error {
	kept := s.pc[:0]
	for _, e := range s.pc {
		if e.ParentID != parentID || e.ChildID != childID {
			kept = append(kept, e)
		}
	}
	s.pc = kept
	return nil
}

func (s *kinshipGraphStore) AddSpouse(ctx context.Context, dbtx database.DBTX, memberA, memberB string, marriageDate *time.Time) error {
	s.sp = append(s.sp, model.Spouse{MemberA: memberA, MemberB: memberB})
	return nil
}

func (s *kinshipGraphStore) RemoveSpouse(ctx context.Context, dbtx database.DBTX, memberA, memberB string) error {
	kept := s.sp[:0]
	for _, e := range s.sp {
		if !((e.MemberA == memberA && e.MemberB == memberB) || (e.MemberA == memberB && e.MemberB == memberA)) {
			kept = append(kept, e)
		}
	}
	s.sp = kept
	return nil
}

func (s *kinshipGraphStore) ListRelations(ctx context.Context, memberID string) (*genrepo.MemberRelations, error) {
	rels := &genrepo.MemberRelations{
		Parents:  []model.Member{},
		Children: []model.Member{},
		Siblings: []model.Member{},
		Spouses:  []model.Member{},
	}
	for _, e := range s.pc {
		if p, ok := s.members[e.ParentID]; ok && e.ChildID == memberID {
			rels.Parents = append(rels.Parents, *p)
		}
		if c, ok := s.members[e.ChildID]; ok && e.ParentID == memberID {
			rels.Children = append(rels.Children, *c)
		}
	}
	for _, e := range s.sp {
		if e.MemberA == memberID {
			if o, ok := s.members[e.MemberB]; ok {
				rels.Spouses = append(rels.Spouses, *o)
			}
		}
		if e.MemberB == memberID {
			if o, ok := s.members[e.MemberA]; ok {
				rels.Spouses = append(rels.Spouses, *o)
			}
		}
	}
	return rels, nil
}

func (s *kinshipGraphStore) ReparentChildren(ctx context.Context, dbtx database.DBTX, deletedID string, newParentID *string) error {
	return nil
}

// ---- FamilyRepository (handler side) — thin wrapper to avoid Go method
// overloading with MemberRepository.List above. ----

type kinshipFamilyRepo struct {
	s *kinshipGraphStore
}

func (f kinshipFamilyRepo) List(ctx context.Context) ([]model.Family, error) {
	out := []model.Family{}
	for _, fam := range f.s.families {
		out = append(out, *fam)
	}
	return out, nil
}

func (f kinshipFamilyRepo) GetByID(ctx context.Context, familyID string) (*model.Family, error) {
	if fam, ok := f.s.families[familyID]; ok {
		cpy := *fam
		return &cpy, nil
	}
	return nil, genrepo.ErrNotFound
}

func (f kinshipFamilyRepo) BumpVersion(ctx context.Context, dbtx database.DBTX, familyID string) (int64, error) {
	f.s.mu.Lock()
	defer f.s.mu.Unlock()
	v := f.s.version(familyID) + 1
	f.s.versionsSet(familyID, v)
	if fam, ok := f.s.families[familyID]; ok {
		fam.Version = v
	}
	return v, nil
}

// GetVersion satisfies kinship.FamilyVersionSource (M3/K1 current version).
func (s *kinshipGraphStore) GetVersion(ctx context.Context, familyID string) (int64, error) {
	if _, ok := s.families[familyID]; !ok {
		return 0, genrepo.ErrNotFound
	}
	return s.version(familyID), nil
}

// spyEngine wraps the real kinship Engine, recording invalidations while
// forwarding them (so the staleness test proves BOTH the hook fires AND the
// cache is actually dropped).
type spyEngine struct {
	*kinship.Engine
	inner *fakeKinshipInvalidator
}

func (s *spyEngine) Invalidate(familyID string) {
	s.inner.Invalidate(familyID)
	s.Engine.Invalidate(familyID)
}

// setupKinshipRouter wires the REAL kinship Service over a stateful graph
// store with the spy invalidator — used by the labels endpoint tests.
func setupKinshipRouter(t *testing.T) (*gin.Engine, *kinshipGraphStore, *fakeKinshipInvalidator) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	cfg := &config.Config{
		Port:               8080,
		AppEnv:             config.EnvDev,
		CookieName:         "cgp_session",
		JWTSecret:          "test-secret-min-32-chars-long-123456",
		JWTIssuer:          config.ProdJWTIssuer,
		CORSAllowedOrigins: []string{"http://localhost:3456"},
		PublicBaseURL:      "http://localhost:3456",
	}

	store := newKinshipGraphStore()
	authSvc := &fakeAuthService{
		validTokens: map[string]*auth.Claims{
			"valid-token-123": {UserID: "usr-admin", IsDemo: false},
		},
		users: make(map[string]*auth.UserProfile),
	}
	kinSvc := kinship.NewService(store, store)
	inv := &fakeKinshipInvalidator{}

	r := NewRouter(Deps{
		Cfg:            cfg,
		Pinger:         &fakePinger{},
		TxManager:      &fakeTxManager{},
		AuthService:    authSvc,
		UserStore:      &fakeUserStore{users: map[string]*model.User{}},
		ContactStore:   &fakeContactStore{contacts: map[string]*model.ContactPoint{}},
		FamilyRepo:     kinshipFamilyRepo{s: store},
		MemberRepo:     store,
		RelationRepo:   store,
		KinshipSvc:     kinSvc,
		KinshipInv:     &spyEngine{Engine: kinSvc.Engine(), inner: inv},
		ExcelSvc:       &fakeExcelService{},
		FeedSvc:        &fakeFeedService{},
		SocialPostRepo: &fakeSocialPostRepo{},
		PushSvc:        &fakePushService{},
	})
	return r, store, inv
}

// seedThreeGenerationGraph: gp+gma → dad (+mom) → kid — a multi-generational
// mock graph (Task 1.3.1). All IDs are UUID-format (route validation).
func seedThreeGenerationGraph(store *kinshipGraphStore) (famID, gpID, gmaID, dadID, momID, kidID string) {
	famID = "11111111-1111-4111-8111-000000000001"
	gpID = "aaaaaaa1-0000-4000-8000-000000000001"
	gmaID = "aaaaaaa1-0000-4000-8000-000000000002"
	dadID = "aaaaaaa1-0000-4000-8000-000000000003"
	momID = "aaaaaaa1-0000-4000-8000-000000000004"
	kidID = "aaaaaaa1-0000-4000-8000-000000000005"

	store.seedFamily(famID, "Gia phả họ Nguyễn Văn", 1)
	store.seedMember(gpID, famID, "Nguyễn Văn An", model.GenderMale, 1)
	store.seedMember(gmaID, famID, "Trần Thị Đoan", model.GenderFemale, 1)
	store.seedMember(dadID, famID, "Nguyễn Văn Kiên", model.GenderMale, 2)
	store.seedMember(momID, famID, "Phạm Thị Hạnh", model.GenderFemale, 2)
	store.seedMember(kidID, famID, "Nguyễn Văn Bình", model.GenderMale, 3)

	_ = store.AddParentChild(context.Background(), nil, gpID, dadID)
	_ = store.AddParentChild(context.Background(), nil, gmaID, dadID)
	_ = store.AddParentChild(context.Background(), nil, dadID, kidID)
	_ = store.AddParentChild(context.Background(), nil, momID, kidID)
	_ = store.AddSpouse(context.Background(), nil, gpID, gmaID, nil)
	_ = store.AddSpouse(context.Background(), nil, dadID, momID, nil)
	return famID, gpID, gmaID, dadID, momID, kidID
}

// Task 1.3 — batched labels: success path over the REAL engine.
func TestGetFamilyKinshipLabels_Success(t *testing.T) {
	r, store, _ := setupKinshipRouter(t)
	famID, gpID, _, dadID, _, kidID := seedThreeGenerationGraph(store)

	req, _ := http.NewRequest("GET", "/api/v1/families/"+famID+"/kinship-labels?from="+gpID, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("kỳ vọng 200, nhận %d. Body: %s", w.Code, w.Body.String())
	}
	var res struct {
		FamilyID string            `json:"family_id"`
		From     string            `json:"from"`
		Dialect  string            `json:"dialect"`
		Labels   map[string]string `json:"labels"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("parse labels json thất bại: %v", err)
	}
	if res.FamilyID != famID || res.From != gpID {
		t.Errorf("kỳ vọng family_id/from khớp yêu cầu, nhận %s/%s", res.FamilyID, res.From)
	}
	if res.Dialect != "bac" {
		t.Errorf("kỳ vọng dialect mặc định 'bac', nhận %q", res.Dialect)
	}
	if res.Labels[dadID] != "Con trai" {
		t.Errorf("kỳ vọng nhãn con trai là 'Con trai', nhận %q", res.Labels[dadID])
	}
	if res.Labels[kidID] != "Cháu nội" {
		t.Errorf("kỳ vọng nhãn cháu nội là 'Cháu nội', nhận %q", res.Labels[kidID])
	}
	if res.Labels[gpID] != "Bản thân" {
		t.Errorf("kỳ vọng nhãn bản thân là 'Bản thân', nhận %q", res.Labels[gpID])
	}

	// From the grandchild's perspective the parent is "Bố" (plan §Task1.3.1).
	req2, _ := http.NewRequest("GET", "/api/v1/families/"+famID+"/kinship-labels?from="+kidID, nil)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("kỳ vọng 200 cho from=cháu, nhận %d", w2.Code)
	}
	var res2 struct {
		Labels map[string]string `json:"labels"`
	}
	if err := json.Unmarshal(w2.Body.Bytes(), &res2); err != nil {
		t.Fatalf("parse labels json (2) thất bại: %v", err)
	}
	if res2.Labels[dadID] != "Bố" {
		t.Errorf("kỳ vọng nhãn bố là 'Bố', nhận %q", res2.Labels[dadID])
	}
}

// Task 1.3 — missing / malformed `from` → 400.
func TestGetFamilyKinshipLabels_MissingFrom(t *testing.T) {
	r, store, _ := setupKinshipRouter(t)
	famID, _, _, _, _, _ := seedThreeGenerationGraph(store)

	// Missing from entirely
	req, _ := http.NewRequest("GET", "/api/v1/families/"+famID+"/kinship-labels", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("kỳ vọng 400 khi thiếu from, nhận %d", w.Code)
	}
	var env model.ErrorEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("parse error envelope thất bại: %v", err)
	}
	if env.Success || env.Code != model.CodeValidationError {
		t.Errorf("kỳ vọng envelope success=false code=VALIDATION_ERROR, nhận %+v", env)
	}

	// Malformed from UUID
	req2, _ := http.NewRequest("GET", "/api/v1/families/"+famID+"/kinship-labels?from=not-a-uuid", nil)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusBadRequest {
		t.Fatalf("kỳ vọng 400 khi from sai định dạng, nhận %d", w2.Code)
	}
}

// Task 1.3 — `from` valid UUID but not in the graph → 404; unknown family → 404.
func TestGetFamilyKinshipLabels_MemberNotFound(t *testing.T) {
	r, store, _ := setupKinshipRouter(t)
	famID, _, _, _, _, _ := seedThreeGenerationGraph(store)

	stranger := "99999999-9999-4999-8999-999999999999"
	req, _ := http.NewRequest("GET", "/api/v1/families/"+famID+"/kinship-labels?from="+stranger, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("kỳ vọng 404 khi from không thuộc đồ thị, nhận %d. Body: %s", w.Code, w.Body.String())
	}
	var env model.ErrorEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("parse error envelope thất bại: %v", err)
	}
	if env.Code != model.CodeNotFound {
		t.Errorf("kỳ vọng code NOT_FOUND, nhận %s", env.Code)
	}

	unknownFam := "88888888-8888-4888-8888-888888888888"
	gpID2 := "aaaaaaa1-0000-4000-8000-000000000001"
	req2, _ := http.NewRequest("GET", "/api/v1/families/"+unknownFam+"/kinship-labels?from="+gpID2, nil)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusNotFound {
		t.Fatalf("kỳ vọng 404 khi dòng họ không tồn tại, nhận %d", w2.Code)
	}
}

// Task 1.3 — mutate→labels staleness: after POST /members commits (version
// bump + engine invalidate), the NEXT labels call must reflect the new
// member without a server restart (M3/K1).
func TestGetFamilyKinshipLabels_StalenessAfterMutate(t *testing.T) {
	r, store, inv := setupKinshipRouter(t)
	famID, _, _, _, _, kidID := seedThreeGenerationGraph(store)

	// Baseline labels from the existing child's perspective.
	req0, _ := http.NewRequest("GET", "/api/v1/families/"+famID+"/kinship-labels?from="+kidID, nil)
	w0 := httptest.NewRecorder()
	r.ServeHTTP(w0, req0)
	if w0.Code != http.StatusOK {
		t.Fatalf("kỳ vọng 200 cho baseline labels, nhận %d", w0.Code)
	}

	// Mutate: create a new child of kidID through the PROTECTED endpoint.
	body := `{"family_id":"` + famID + `","full_name":"Nguyễn Văn Sáu","gender":"nam","parent_ids":["` + kidID + `"]}`
	req, _ := http.NewRequest("POST", "/api/v1/members", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3456")
	req.AddCookie(&http.Cookie{Name: "cgp_session", Value: "valid-token-123"})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("kỳ vọng 201 tạo thành viên, nhận %d. Body: %s", w.Code, w.Body.String())
	}
	var created model.Member
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatalf("parse member json thất bại: %v", err)
	}

	// M3 wiring: the mutation must have invalidated the family cache.
	calls := inv.recorded()
	found := false
	for _, f := range calls {
		if f == famID {
			found = true
		}
	}
	if !found {
		t.Fatalf("kỳ vọng Invalidate(%s) được gọi sau mutation, nhận %v", famID, calls)
	}

	// Labels AFTER the mutation must include the new member — no restart.
	req2, _ := http.NewRequest("GET", "/api/v1/families/"+famID+"/kinship-labels?from="+created.ID, nil)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("kỳ vọng 200 cho labels sau mutation, nhận %d. Body: %s", w2.Code, w2.Body.String())
	}
	var res struct {
		Labels map[string]string `json:"labels"`
	}
	if err := json.Unmarshal(w2.Body.Bytes(), &res); err != nil {
		t.Fatalf("parse labels json thất bại: %v", err)
	}
	if res.Labels[kidID] != "Bố" {
		t.Errorf("kỳ vọng thành viên cũ vẫn có nhãn 'Bố', nhận %q", res.Labels[kidID])
	}
	if len(res.Labels) < 6 {
		t.Errorf("kỳ vọng từ điển nhãn gồm cả thành viên mới (%d nhãn), nhận %d nhãn: %v", 6, len(res.Labels), res.Labels)
	}
}

// ---------------------------------------------------------------------------
// POST /api/v1/me/member — M1 five-rule binding via the REAL auth.Service
// ---------------------------------------------------------------------------

const (
	linkTestFamID    = "11111111-1111-4111-8111-000000000001"
	linkTestMemberA  = "aaaaaaa1-0000-4000-8000-000000000001"
	linkTestMemberB  = "aaaaaaa1-0000-4000-8000-000000000002"
	linkTestStranger = "99999999-9999-4999-8999-999999999999"
)

// setupLinkMemberRouter wires a real auth.Service (in-memory repos) with the
// member lookup port and returns the pieces the M1 tests assert on.
func setupLinkMemberRouter(t *testing.T) (*gin.Engine, *inMemUserRepo, *auth.Service) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	cfg := &config.Config{
		Port:               8080,
		AppEnv:             config.EnvDev,
		CookieName:         config.ProdCookieName,
		JWTSecret:          "test-secret-min-32-chars-long-123456",
		JWTIssuer:          config.ProdJWTIssuer,
		CORSAllowedOrigins: []string{"http://localhost:3456"},
		PublicBaseURL:      "http://localhost:3456",
	}

	userStore := newInMemUserRepo()
	memberLookup := &fakeMemberLookup{members: map[string]*model.Member{
		linkTestMemberA: {ID: linkTestMemberA, FamilyID: linkTestFamID, FullName: "Nguyễn Văn An", Gender: model.GenderMale, GenerationIndex: 1, IsLiving: true},
		linkTestMemberB: {ID: linkTestMemberB, FamilyID: linkTestFamID, FullName: "Nguyễn Văn Bình", Gender: model.GenderMale, GenerationIndex: 2, IsLiving: true},
	}}

	realAuthSvc := auth.NewService(cfg, &fakeTxManager{}, auth.ServiceDeps{
		Users:      userStore,
		Identities: newInMemIdentityRepo(),
		Contacts:   newInMemContactRepo(),
		Tokens:     &inMemMagicLinkRepo{},
		Sessions:   newInMemSessionRepo(),
		Locker:     &inMemContactLocker{},
		Outbox:     &inMemOutboxRepo{},
		Members:    memberLookup,
	})

	r := NewRouter(Deps{
		Cfg:            cfg,
		Pinger:         &fakePinger{},
		TxManager:      &fakeTxManager{},
		AuthService:    realAuthSvc,
		UserStore:      userStore,
		ContactStore:   &fakeContactStore{contacts: map[string]*model.ContactPoint{}},
		FamilyRepo:     &fakeFamilyRepo{families: map[string]*model.Family{}},
		MemberRepo:     &fakeMemberRepo{members: map[string]*model.Member{}},
		RelationRepo:   &fakeRelationRepo{},
		KinshipSvc:     &fakeKinshipService{},
		KinshipInv:     &fakeKinshipInvalidator{},
		ExcelSvc:       &fakeExcelService{},
		FeedSvc:        &fakeFeedService{},
		SocialPostRepo: &fakeSocialPostRepo{},
		PushSvc:        &fakePushService{},
	})
	return r, userStore, realAuthSvc
}

// linkTestCookie mints a session cookie for a user through the real JWT path.
func linkTestCookie(t *testing.T, svc *auth.Service, user *model.User) *http.Cookie {
	t.Helper()
	token, err := svc.IssueToken(*user)
	if err != nil {
		t.Fatalf("không thể ký token thử nghiệm: %v", err)
	}
	return &http.Cookie{Name: config.ProdCookieName, Value: token}
}

func postMeMember(r *gin.Engine, cookie *http.Cookie, body string) *httptest.ResponseRecorder {
	req, _ := http.NewRequest("POST", "/api/v1/me/member", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3456")
	if cookie != nil {
		req.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// Task 1.2/1.3 — Rule 5: unlinked user links a valid member → 200 and the
// profile carries the member_id (uniform UserProfile, no new DTO).
