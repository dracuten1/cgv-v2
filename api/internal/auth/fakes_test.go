package auth_test

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// fakeTx is an in-memory TxRunner that invokes fn directly (no DB).
type fakeTx struct {
	runs      int
	failsWith error
}

func (f *fakeTx) WithTx(ctx context.Context, fn func(ctx context.Context) error) error {
	f.runs++
	if f.failsWith != nil {
		return f.failsWith
	}
	return fn(ctx)
}

// memCore is the shared in-memory state behind every port fake.
type memCore struct {
	mu sync.Mutex

	users      map[string]*model.User
	identities map[string]*model.Identity // key: provider + ":" + subject
	contacts   map[string]*model.ContactPoint
	tokens     map[string]*tokenRow
	sessions   map[string]*sessionRow
	locked     []string

	// failIdentInserts makes Identity Insert return ErrDuplicateIdentity
	// for the next N calls (retry-wrapper tests).
	failIdentInserts int
	// failUserInserts makes User Create fail once (fatal-path test).
	failUserInserts int

	userSeq    int
	identSeq   int
	contactSeq int
}

type tokenRow struct {
	tokenHash  string
	email      string
	expiresAt  time.Time
	consumedAt *time.Time
}

type sessionRow struct {
	jti       string
	userID    string
	expiresAt time.Time
	revokedAt *time.Time
}

func newMemCore() *memCore {
	return &memCore{
		users:      make(map[string]*model.User),
		identities: make(map[string]*model.Identity),
		contacts:   make(map[string]*model.ContactPoint),
		tokens:     make(map[string]*tokenRow),
		sessions:   make(map[string]*sessionRow),
	}
}

// seedUser pre-creates a user row and returns its ID.
func (c *memCore) seedUser(displayName string, isDemo bool) string {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.userSeq++
	id := fmt.Sprintf("u-%04d", c.userSeq)
	c.users[id] = &model.User{ID: id, DisplayName: displayName, IsDemo: isDemo, CreatedAt: time.Now()}
	return id
}

// seedContact pre-creates a contact point row.
func (c *memCore) seedContact(userID, kind, value string, verified bool) string {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.contactSeq++
	id := fmt.Sprintf("c-%04d", c.contactSeq)
	key := kind + ":" + auth.NormalizeContact(kind, value)
	c.contacts[key] = &model.ContactPoint{
		ID: id, UserID: userID, Kind: kind,
		Value: auth.NormalizeContact(kind, value), Verified: verified, CreatedAt: time.Now(),
	}
	return id
}

// seedIdentity pre-creates an identity row.
func (c *memCore) seedIdentity(userID, provider, subject string) string {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.identSeq++
	id := fmt.Sprintf("i-%04d", c.identSeq)
	c.identities[provider+":"+subject] = &model.Identity{
		ID: id, UserID: userID, Provider: provider, ProviderSubject: subject,
		LinkedAt: time.Now(), LastLoginAt: time.Now(),
	}
	return id
}

// ---------------------------------------------------------------------------
// memUsers — auth.UserStore
// ---------------------------------------------------------------------------

type memUsers struct{ core *memCore }

func (m *memUsers) GetByID(_ context.Context, userID string) (*model.User, error) {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	u, ok := m.core.users[userID]
	if !ok {
		return nil, auth.ErrRepoNotFound
	}
	cpy := *u
	return &cpy, nil
}

func (m *memUsers) GetByIDForUpdate(ctx context.Context, userID string) (*model.User, error) {
	return m.GetByID(ctx, userID)
}

func (m *memUsers) Create(_ context.Context, displayName string, isDemo bool) (*model.User, error) {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	if m.core.failUserInserts > 0 {
		m.core.failUserInserts--
		return nil, fmt.Errorf("lỗi chèn người dùng giả lập")
	}
	m.core.userSeq++
	u := &model.User{ID: fmt.Sprintf("u-%04d", m.core.userSeq), DisplayName: displayName, IsDemo: isDemo, CreatedAt: time.Now()}
	m.core.users[u.ID] = u
	cpy := *u
	return &cpy, nil
}

func (m *memUsers) LinkMember(_ context.Context, userID, memberID string) error {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	u, ok := m.core.users[userID]
	if !ok {
		return auth.ErrRepoNotFound
	}
	u.MemberID = &memberID
	return nil
}

// GetByMemberID resolves the user holding a member link (auth.UserStore).
func (m *memUsers) GetByMemberID(_ context.Context, memberID string) (*model.User, error) {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	for _, u := range m.core.users {
		if u.MemberID != nil && *u.MemberID == memberID {
			cpy := *u
			return &cpy, nil
		}
	}
	return nil, nil
}

func (m *memUsers) ListIdentities(_ context.Context, userID string) ([]model.Identity, error) {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	out := []model.Identity{}
	for _, i := range m.core.identities {
		if i.UserID == userID {
			out = append(out, *i)
		}
	}
	return out, nil
}

func (m *memUsers) ListContacts(_ context.Context, userID string) ([]model.ContactPoint, error) {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	out := []model.ContactPoint{}
	for _, c := range m.core.contacts {
		if c.UserID == userID {
			out = append(out, *c)
		}
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// memIdentities — auth.IdentityStore
// ---------------------------------------------------------------------------

type memIdentities struct{ core *memCore }

func (m *memIdentities) FindByProviderSubject(_ context.Context, provider, subject string) (*model.Identity, error) {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	i, ok := m.core.identities[provider+":"+subject]
	if !ok {
		return nil, auth.ErrRepoNotFound
	}
	cpy := *i
	return &cpy, nil
}

func (m *memIdentities) Insert(_ context.Context, userID, provider, subject string) (*model.Identity, error) {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	if m.core.failIdentInserts > 0 {
		m.core.failIdentInserts--
		return nil, auth.ErrDuplicateIdentity
	}
	key := provider + ":" + subject
	if _, exists := m.core.identities[key]; exists {
		return nil, auth.ErrDuplicateIdentity
	}
	m.core.identSeq++
	i := &model.Identity{
		ID: fmt.Sprintf("i-%04d", m.core.identSeq), UserID: userID,
		Provider: provider, ProviderSubject: subject,
		LinkedAt: time.Now(), LastLoginAt: time.Now(),
	}
	m.core.identities[key] = i
	cpy := *i
	return &cpy, nil
}

func (m *memIdentities) TouchLastLogin(_ context.Context, identityID string) error {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	for _, i := range m.core.identities {
		if i.ID == identityID {
			i.LastLoginAt = time.Now()
			return nil
		}
	}
	return auth.ErrRepoNotFound
}

func (m *memIdentities) CountByUser(_ context.Context, userID string) (int, error) {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	n := 0
	for _, i := range m.core.identities {
		if i.UserID == userID {
			n++
		}
	}
	return n, nil
}

func (m *memIdentities) Delete(_ context.Context, identityID, userID string) error {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	for key, i := range m.core.identities {
		if i.ID == identityID && i.UserID == userID {
			delete(m.core.identities, key)
			return nil
		}
	}
	return auth.ErrRepoNotFound
}

func (m *memIdentities) ListByUser(_ context.Context, userID string) ([]model.Identity, error) {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	out := []model.Identity{}
	for _, i := range m.core.identities {
		if i.UserID == userID {
			out = append(out, *i)
		}
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// memContacts — auth.ContactStore
// ---------------------------------------------------------------------------

type memContacts struct{ core *memCore }

func (m *memContacts) FindByKindValue(_ context.Context, kind, value string) (*model.ContactPoint, error) {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	c, ok := m.core.contacts[kind+":"+auth.NormalizeContact(kind, value)]
	if !ok {
		return nil, auth.ErrRepoNotFound
	}
	cpy := *c
	return &cpy, nil
}

func (m *memContacts) Insert(_ context.Context, userID, kind, value string, verified bool, verifiedVia string) (*model.ContactPoint, error) {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	key := kind + ":" + auth.NormalizeContact(kind, value)
	if existing, ok := m.core.contacts[key]; ok {
		// Mirror UNIQUE(kind,value) semantics.
		return existing, nil
	}
	m.core.contactSeq++
	var via *string
	if verifiedVia != "" {
		via = &verifiedVia
	}
	c := &model.ContactPoint{
		ID: fmt.Sprintf("c-%04d", m.core.contactSeq), UserID: userID, Kind: kind,
		Value: auth.NormalizeContact(kind, value), Verified: verified,
		VerifiedVia: via, CreatedAt: time.Now(),
	}
	m.core.contacts[key] = c
	cpy := *c
	return &cpy, nil
}

func (m *memContacts) MarkVerified(_ context.Context, contactID, via string) error {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	for _, c := range m.core.contacts {
		if c.ID == contactID {
			c.Verified = true
			c.VerifiedVia = &via
			return nil
		}
	}
	return auth.ErrRepoNotFound
}

func (m *memContacts) GetByID(_ context.Context, contactID string) (*model.ContactPoint, error) {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	for _, c := range m.core.contacts {
		if c.ID == contactID {
			cpy := *c
			return &cpy, nil
		}
	}
	return nil, auth.ErrRepoNotFound
}

func (m *memContacts) ListByUser(_ context.Context, userID string) ([]model.ContactPoint, error) {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	out := []model.ContactPoint{}
	for _, c := range m.core.contacts {
		if c.UserID == userID {
			out = append(out, *c)
		}
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// memTokens — auth.MagicLinkStore
// ---------------------------------------------------------------------------

type memTokens struct{ core *memCore }

func (m *memTokens) Insert(_ context.Context, tokenHash, email string, expiresAt time.Time) error {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	m.core.tokens[tokenHash] = &tokenRow{tokenHash: tokenHash, email: email, expiresAt: expiresAt}
	return nil
}

func (m *memTokens) Consume(_ context.Context, tokenHash string) (string, error) {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	row, ok := m.core.tokens[tokenHash]
	if !ok || row.consumedAt != nil || !time.Now().Before(row.expiresAt) {
		return "", auth.ErrTokenUsedOrExpired
	}
	now := time.Now()
	row.consumedAt = &now
	return row.email, nil
}

// ---------------------------------------------------------------------------
// memSessions — auth.SessionStore
// ---------------------------------------------------------------------------

type memSessions struct{ core *memCore }

func (m *memSessions) Insert(_ context.Context, jti, userID string, expiresAt time.Time) error {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	m.core.sessions[jti] = &sessionRow{jti: jti, userID: userID, expiresAt: expiresAt}
	return nil
}

func (m *memSessions) RevokeByJti(_ context.Context, jti string) error {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	if row, ok := m.core.sessions[jti]; ok {
		now := time.Now()
		row.revokedAt = &now
	}
	return nil
}

// ---------------------------------------------------------------------------
// memLocker — auth.ContactLocker (records lock calls for assertions)
// ---------------------------------------------------------------------------

type memLocker struct{ core *memCore }

func (m *memLocker) AcquireContactAdvisoryLock(_ context.Context, kind, value string) error {
	m.core.mu.Lock()
	defer m.core.mu.Unlock()
	m.core.locked = append(m.core.locked, kind+":"+value)
	return nil
}

// locksTaken returns a copy of every (kind:value) advisory lock acquired.
func (c *memCore) locksTaken() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]string, len(c.locked))
	copy(out, c.locked)
	return out
}

// ---------------------------------------------------------------------------
// fakeOutbox — auth.OutboxEnqueuer
// ---------------------------------------------------------------------------

type fakeOutbox struct {
	mu     sync.Mutex
	events []outboxRow
}

type outboxRow struct {
	Email string
	Link  string
}

func (o *fakeOutbox) EnqueueMagicLink(_ context.Context, email, linkURL string) error {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.events = append(o.events, outboxRow{Email: email, Link: linkURL})
	return nil
}

func (o *fakeOutbox) snapshot() []outboxRow {
	o.mu.Lock()
	defer o.mu.Unlock()
	out := make([]outboxRow, len(o.events))
	copy(out, o.events)
	return out
}

// Compile-time port conformance for every fake.
var (
	_ auth.UserStore      = (*memUsers)(nil)
	_ auth.IdentityStore  = (*memIdentities)(nil)
	_ auth.ContactStore   = (*memContacts)(nil)
	_ auth.MagicLinkStore = (*memTokens)(nil)
	_ auth.SessionStore   = (*memSessions)(nil)
	_ auth.ContactLocker  = (*memLocker)(nil)
	_ auth.OutboxEnqueuer = (*fakeOutbox)(nil)
)
