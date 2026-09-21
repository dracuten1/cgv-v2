package auth_test

import (
	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/config"
)

// newHarness builds a fully-wired Service over fresh in-memory fakes and
// returns the pieces tests assert on.
func newHarness(demo bool) (*auth.Service, *memCore, *fakeOutbox, *fakeTx) {
	cfg := newTestConfig(demo)
	cfg.AppEnv = config.EnvDev // mock OAuth tests require dev env
	core := newMemCore()
	outbox := &fakeOutbox{}
	tx := &fakeTx{}
	svc := auth.NewService(cfg, tx, auth.ServiceDeps{
		Users:      &memUsers{core: core},
		Identities: &memIdentities{core: core},
		Contacts:   &memContacts{core: core},
		Tokens:     &memTokens{core: core},
		Sessions:   &memSessions{core: core},
		Locker:     &memLocker{core: core},
		Outbox:     outbox,
	})
	return svc, core, outbox, tx
}

// realConfig is a dev-mode config with mock OAuth enabled for
// provider-independent tests.
func realConfig() *config.Config {
	cfg := newTestConfig(false)
	cfg.AppEnv = config.EnvDev
	cfg.MockOAuthEnabled = true
	return cfg
}
