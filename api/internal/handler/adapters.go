package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/excel"
	"github.com/dracuten1/cgv-v2/api/internal/feed"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	genrepo "github.com/dracuten1/cgv-v2/api/internal/repository/genealogy"
	socialrepo "github.com/dracuten1/cgv-v2/api/internal/repository/social"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Pinger tests database connectivity.
type Pinger interface {
	Ping(ctx context.Context) error
}

// AuthService defines the auth domain interface needed by handlers.
type AuthService interface {
	LoginURL(w http.ResponseWriter, r *http.Request, provider string) (string, error)
	HandleCallback(ctx context.Context, w http.ResponseWriter, r *http.Request, provider, code, stateParam string) (*auth.AuthResult, error)
	SendMagicLink(ctx context.Context, email, verifyBaseURL string) error
	VerifyMagicLink(ctx context.Context, rawToken string) (*auth.AuthResult, error)
	StartDemoSession(ctx context.Context) (*auth.AuthResult, error)
	Logout(ctx context.Context, jti string) error
	CurrentUser(ctx context.Context, userID string) (*auth.UserProfile, error)
	StartLinkProvider(w http.ResponseWriter, r *http.Request, userID, provider string) (string, error)
	UnlinkIdentity(ctx context.Context, userID, identityID string) error
	VerifyToken(tokenStr string) (*auth.Claims, error)
}

// ContactStore defines contact point operations for /me/contacts.
type ContactStore interface {
	Insert(ctx context.Context, userID, kind, value string, verified bool, verifiedVia string) (*model.ContactPoint, error)
	GetByID(ctx context.Context, contactID string) (*model.ContactPoint, error)
	MarkVerified(ctx context.Context, contactID, via string) error
}

// FamilyRepository defines family queries.
type FamilyRepository interface {
	List(ctx context.Context) ([]model.Family, error)
	GetByID(ctx context.Context, familyID string) (*model.Family, error)
	BumpVersion(ctx context.Context, dbtx database.DBTX, familyID string) (int64, error)
}

// MemberRepository defines member queries and graph loading.
type MemberRepository interface {
	List(ctx context.Context, search string, limit, offset int) (*model.Page[model.Member], error)
	ListByFamily(ctx context.Context, familyID string) ([]model.Member, error)
	GetByID(ctx context.Context, memberID string) (*genrepo.MemberWithFamily, error)
	GetForUpdate(ctx context.Context, dbtx database.DBTX, memberID string) (*model.Member, error)
	Create(ctx context.Context, dbtx database.DBTX, m *model.Member) (*model.Member, error)
	Update(ctx context.Context, dbtx database.DBTX, m *model.Member) error
	Delete(ctx context.Context, dbtx database.DBTX, memberID string) error
	LoadGraph(ctx context.Context, familyID string) ([]model.Member, []model.ParentChild, []model.Spouse, int64, error)
}

// RelationshipRepository defines family relationship operations.
type RelationshipRepository interface {
	AddParentChild(ctx context.Context, dbtx database.DBTX, parentID, childID string) error
	RemoveParentChild(ctx context.Context, dbtx database.DBTX, parentID, childID string) error
	AddSpouse(ctx context.Context, dbtx database.DBTX, memberA, memberB string, marriageDate *time.Time) error
	RemoveSpouse(ctx context.Context, dbtx database.DBTX, memberA, memberB string) error
	ListRelations(ctx context.Context, memberID string) (*genrepo.MemberRelations, error)
	ReparentChildren(ctx context.Context, dbtx database.DBTX, deletedID string, newParentID *string) error
}

// KinshipService defines kinship calculation.
type KinshipService interface {
	Calculate(ctx context.Context, familyID, fromID, toID string, dialect string) (model.KinshipResult, error)
}

// ExcelService defines Excel export and import operations.
type ExcelService interface {
	ExportFamily(ctx context.Context, familyID string) ([]byte, error)
	ImportFamily(ctx context.Context, familyID string, data []byte) (excel.ImportSummary, error)
}

// FeedService defines family feed operations.
type FeedService interface {
	List(ctx context.Context, familyID string, limit int, cursor feed.Cursor) ([]model.Post, error)
	Create(ctx context.Context, familyID string, authorUserID string, authorMemberID *string, content string, images []string) (*model.Post, error)
}

// SocialPostRepository defines post author listing for member details tab.
type SocialPostRepository interface {
	ListByAuthor(ctx context.Context, dbtx database.DBTX, memberID string, limit int) ([]model.Post, error)
}

// PushService defines Web Push subscriptions.
type PushService interface {
	Subscribe(ctx context.Context, userID, endpoint, p256dh, auth string) error
	Unsubscribe(ctx context.Context, endpoint string) error
}

// TxRunner encapsulates database transactions.
type TxRunner interface {
	WithTx(ctx context.Context, fn func(ctx context.Context) error) error
}

// ExcelImportAdapter adapts genrepo.ImportRepository and genrepo.FamilyRepository to excel.ExcelImportRepo.
type ExcelImportAdapter struct {
	ImportRepo *genrepo.ImportRepository
	FamilyRepo *genrepo.FamilyRepository
}

// ImportStaged satisfies excel.ExcelImportRepo.
func (a *ExcelImportAdapter) ImportStaged(
	ctx context.Context,
	dbtx database.DBTX,
	familyID string,
	members []model.Member,
	pc []model.ParentChild,
	spouses []model.Spouse,
) error {
	return a.ImportRepo.ImportStaged(ctx, dbtx, familyID, members, pc, spouses)
}

// BumpVersion satisfies excel.ExcelImportRepo.
func (a *ExcelImportAdapter) BumpVersion(ctx context.Context, dbtx database.DBTX, familyID string) (int64, error) {
	return a.FamilyRepo.BumpVersion(ctx, dbtx, familyID)
}

// FeedPostAdapter adapts socialrepo.PostRepository with GetExecutor(ctx, pool) to feed.PostStore.
type FeedPostAdapter struct {
	Repo *socialrepo.PostRepository
	Pool *pgxpool.Pool
}

func (a *FeedPostAdapter) Create(ctx context.Context, post *model.Post) (*model.Post, error) {
	exec := database.GetExecutor(ctx, a.Pool)
	return a.Repo.Create(ctx, exec, post)
}

func (a *FeedPostAdapter) GetByID(ctx context.Context, postID string) (*model.Post, error) {
	exec := database.GetExecutor(ctx, a.Pool)
	return a.Repo.GetByID(ctx, exec, postID)
}

func (a *FeedPostAdapter) ListByFamily(ctx context.Context, familyID string, limit int, cursor feed.Cursor) ([]model.Post, error) {
	exec := database.GetExecutor(ctx, a.Pool)
	c := socialrepo.Cursor{CreatedAt: cursor.CreatedAt, ID: cursor.ID}
	return a.Repo.ListByFamily(ctx, exec, familyID, limit, c)
}

func (a *FeedPostAdapter) ListByAuthor(ctx context.Context, memberID string, limit int) ([]model.Post, error) {
	exec := database.GetExecutor(ctx, a.Pool)
	return a.Repo.ListByAuthor(ctx, exec, memberID, limit)
}

// FeedOutboxAdapter adapts socialrepo.OutboxRepository with GetExecutor to feed.OutboxEnqueuer.
type FeedOutboxAdapter struct {
	Repo *socialrepo.OutboxRepository
	Pool *pgxpool.Pool
}

func (a *FeedOutboxAdapter) EnqueueFeedCreated(ctx context.Context, payload []byte) (*model.OutboxEvent, error) {
	exec := database.GetExecutor(ctx, a.Pool)
	return a.Repo.EnqueueFeedCreated(ctx, exec, payload)
}

// AuthorNamerAdapter implements feed.AuthorNamer using UserStore and optional MemberRepository.
type AuthorNamerAdapter struct {
	Users   auth.UserStore
	Members MemberRepository
}

func (a *AuthorNamerAdapter) AuthorDisplayName(ctx context.Context, userID string, memberID *string) (string, error) {
	if memberID != nil && *memberID != "" && a.Members != nil {
		if m, err := a.Members.GetByID(ctx, *memberID); err == nil && m != nil && m.FullName != "" {
			return m.FullName, nil
		}
	}
	if a.Users != nil {
		if u, err := a.Users.GetByID(ctx, userID); err == nil && u != nil && u.DisplayName != "" {
			return u.DisplayName, nil
		}
	}
	return "Thành viên gia đình", nil
}

// PushStoreAdapter adapts socialrepo.PushRepository with GetExecutor to push.PushStore.
type PushStoreAdapter struct {
	Repo *socialrepo.PushRepository
	Pool *pgxpool.Pool
}

func (a *PushStoreAdapter) Upsert(ctx context.Context, sub model.PushSubscription) error {
	exec := database.GetExecutor(ctx, a.Pool)
	return a.Repo.Upsert(ctx, exec, sub)
}

func (a *PushStoreAdapter) DeleteByEndpoint(ctx context.Context, endpoint string) error {
	exec := database.GetExecutor(ctx, a.Pool)
	return a.Repo.DeleteByEndpoint(ctx, exec, endpoint)
}

func (a *PushStoreAdapter) ListForFamily(ctx context.Context, familyID string) ([]model.PushSubscription, error) {
	exec := database.GetExecutor(ctx, a.Pool)
	return a.Repo.ListForFamily(ctx, exec, familyID)
}

// OutboxStoreAdapter adapts socialrepo.OutboxRepository with GetExecutor to push.OutboxStore.
type OutboxStoreAdapter struct {
	Repo *socialrepo.OutboxRepository
	Pool *pgxpool.Pool
}

func (a *OutboxStoreAdapter) FetchPending(ctx context.Context, limit int) ([]model.OutboxEvent, error) {
	exec := database.GetExecutor(ctx, a.Pool)
	return a.Repo.FetchPending(ctx, exec, limit)
}

func (a *OutboxStoreAdapter) MarkProcessed(ctx context.Context, ids []string) error {
	exec := database.GetExecutor(ctx, a.Pool)
	return a.Repo.MarkProcessed(ctx, exec, ids)
}
