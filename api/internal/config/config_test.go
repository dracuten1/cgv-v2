package config

import (
	"strings"
	"testing"
)

func TestConfigValidate_MisconfigMatrix(t *testing.T) {
	tests := []struct {
		name        string
		cfg         Config
		wantErr     bool
		errContains string
	}{
		{
			name: "valid dev minimal",
			cfg: Config{
				Port:       8080,
				AppEnv:     EnvDev,
				DemoMode:   false,
				JWTSecret:  "",
				JWTIssuer:  ProdJWTIssuer,
				CookieName: ProdCookieName,
			},
			wantErr: false,
		},
		{
			name: "valid demo full isolation",
			cfg: Config{
				Port:          8080,
				AppEnv:        EnvDemo,
				DemoMode:      true,
				DatabaseURL:   "postgres://cgp_demo:cgp_demo@localhost:5433/cgp_demo?sslmode=disable",
				JWTSecret:     "demo-secret-value-must-be-32-chars-long",
				JWTIssuer:     DemoJWTIssuer,
				CookieName:    DemoCookieName,
				PublicBaseURL: "http://localhost:3456",
			},
			wantErr: false,
		},
		{
			name: "missing JWT secret in prod",
			cfg: Config{
				Port:          8080,
				AppEnv:        EnvProd,
				DemoMode:      false,
				DatabaseURL:   "postgres://cgp:cgp@localhost:5432/cgp_prod",
				JWTSecret:     "",
				JWTIssuer:     ProdJWTIssuer,
				CookieName:    ProdCookieName,
				PublicBaseURL: "http://localhost:3456",
			},
			wantErr:     true,
			errContains: "JWT_SECRET",
		},
		{
			name: "missing database url in demo",
			cfg: Config{
				Port:          8080,
				AppEnv:        EnvDemo,
				DemoMode:      true,
				DatabaseURL:   "",
				JWTSecret:     "demo-secret-value-must-be-32-chars-long",
				JWTIssuer:     DemoJWTIssuer,
				CookieName:    DemoCookieName,
				PublicBaseURL: "http://localhost:3456",
			},
			wantErr:     true,
			errContains: "DATABASE_URL",
		},
		{
			name: "bad demo issuer",
			cfg: Config{
				Port:          8080,
				AppEnv:        EnvDemo,
				DemoMode:      true,
				DatabaseURL:   "postgres://cgp_demo:cgp_demo@localhost:5433/cgp_demo",
				JWTSecret:     "demo-secret-value-must-be-32-chars-long",
				JWTIssuer:     ProdJWTIssuer, // wrong: cgp-prod in demo
				CookieName:    DemoCookieName,
				PublicBaseURL: "http://localhost:3456",
			},
			wantErr:     true,
			errContains: DemoJWTIssuer,
		},
		{
			name: "shared cookie name in demo",
			cfg: Config{
				Port:          8080,
				AppEnv:        EnvDemo,
				DemoMode:      true,
				DatabaseURL:   "postgres://cgp_demo:cgp_demo@localhost:5433/cgp_demo",
				JWTSecret:     "demo-secret-value-must-be-32-chars-long",
				JWTIssuer:     DemoJWTIssuer,
				CookieName:    ProdCookieName, // wrong: prod session cookie leaks into demo
				PublicBaseURL: "http://localhost:3456",
			},
			wantErr:     true,
			errContains: DemoCookieName,
		},
		{
			name: "non-demo DSN in demo mode",
			cfg: Config{
				Port:          8080,
				AppEnv:        EnvDemo,
				DemoMode:      true,
				DatabaseURL:   "postgres://cgp:cgp@localhost:5432/cgp_prod",
				JWTSecret:     "demo-secret-value-must-be-32-chars-long",
				JWTIssuer:     DemoJWTIssuer,
				CookieName:    DemoCookieName,
				PublicBaseURL: "http://localhost:3456",
			},
			wantErr:     true,
			errContains: "demo",
		},
		{
			name: "demo flag without demo env still validated",
			cfg: Config{
				Port:          8080,
				AppEnv:        EnvDev,
				DemoMode:      true, // DEMO_MODE=true but env=dev must still enforce the matrix
				DatabaseURL:   "postgres://cgp_demo:cgp_demo@localhost:5433/cgp_demo",
				JWTSecret:     "demo-secret-value-must-be-32-chars-long",
				JWTIssuer:     ProdJWTIssuer, // wrong: prod issuer under DEMO_MODE=true
				CookieName:    DemoCookieName,
				PublicBaseURL: "http://localhost:3456",
			},
			wantErr:     true,
			errContains: DemoJWTIssuer,
		},
		{
			name: "jwt secret too short in prod",
			cfg: Config{
				Port:          8080,
				AppEnv:        EnvProd,
				DatabaseURL:   "postgres://cgp:cgp@localhost:5432/cgp_prod",
				JWTSecret:     "short-secret-16b",
				JWTIssuer:     ProdJWTIssuer,
				CookieName:    ProdCookieName,
				PublicBaseURL: "http://localhost:3456",
			},
			wantErr:     true,
			errContains: "tối thiểu 32",
		},
		{
			name: "jwt secret too short in demo mode",
			cfg: Config{
				Port:          8080,
				AppEnv:        EnvDemo,
				DemoMode:      true,
				DatabaseURL:   "postgres://cgp_demo:cgp_demo@localhost:5433/cgp_demo",
				JWTSecret:     "short-demo-secret-16b",
				JWTIssuer:     DemoJWTIssuer,
				CookieName:    DemoCookieName,
				PublicBaseURL: "http://localhost:3456",
			},
			wantErr:     true,
			errContains: "tối thiểu 32",
		},
		{
			name: "mock oauth in prod rejected",
			cfg: Config{
				Port:             8080,
				AppEnv:           EnvProd,
				DatabaseURL:      "postgres://cgp:cgp@localhost:5432/cgp_prod",
				JWTSecret:        "demo-secret-value-must-be-32-chars-long",
				JWTIssuer:        ProdJWTIssuer,
				CookieName:       ProdCookieName,
				PublicBaseURL:    "http://localhost:3456",
				MockOAuthEnabled: true,
			},
			wantErr:     true,
			errContains: "MOCK_OAUTH_ENABLED",
		},
		{
			name: "mock oauth in demo rejected",
			cfg: Config{
				Port:             8080,
				AppEnv:           EnvDemo,
				DemoMode:         true,
				DatabaseURL:      "postgres://cgp_demo:cgp_demo@localhost:5433/cgp_demo",
				JWTSecret:        "demo-secret-value-must-be-32-chars-long",
				JWTIssuer:        DemoJWTIssuer,
				CookieName:       DemoCookieName,
				PublicBaseURL:    "http://localhost:3456",
				MockOAuthEnabled: true,
			},
			wantErr:     true,
			errContains: "MOCK_OAUTH_ENABLED",
		},
		{
			name: "mock oauth in dev with demo mode rejected",
			cfg: Config{
				Port:             8080,
				AppEnv:           EnvDev,
				DemoMode:         true,
				DatabaseURL:      "postgres://cgp_demo:cgp_demo@localhost:5433/cgp_demo",
				JWTSecret:        "demo-secret-value-must-be-32-chars-long",
				JWTIssuer:        DemoJWTIssuer,
				CookieName:       DemoCookieName,
				PublicBaseURL:    "http://localhost:3456",
				MockOAuthEnabled: true,
			},
			wantErr:     true,
			errContains: "MOCK_OAUTH_ENABLED",
		},
		{
			name: "cross-secret issuer mismatch - demo issuer in prod mode rejected",
			cfg: Config{
				Port:          8080,
				AppEnv:        EnvProd,
				DatabaseURL:   "postgres://cgp:cgp@localhost:5432/cgp_prod",
				JWTSecret:     "demo-secret-value-must-be-32-chars-long",
				JWTIssuer:     DemoJWTIssuer, // wrong: cgp-demo in prod
				CookieName:    ProdCookieName,
				PublicBaseURL: "http://localhost:3456",
			},
			wantErr:     true,
			errContains: DemoJWTIssuer,
		},
		{
			name: "mock oauth in dev allowed",
			cfg: Config{
				Port:             8080,
				AppEnv:           EnvDev,
				MockOAuthEnabled: true,
			},
			wantErr: false,
		},
		{
			name: "public base url with bad path rejected",
			cfg: Config{
				Port:          8080,
				AppEnv:        EnvDev,
				PublicBaseURL: "http://localhost:3456/subpath",
			},
			wantErr:     true,
			errContains: "PUBLIC_BASE_URL",
		},
		{
			name: "empty public base url in prod rejected",
			cfg: Config{
				Port:          8080,
				AppEnv:        EnvProd,
				DatabaseURL:   "postgres://cgp:cgp@localhost:5432/cgp_prod",
				JWTSecret:     "demo-secret-value-must-be-32-chars-long",
				JWTIssuer:     ProdJWTIssuer,
				CookieName:    ProdCookieName,
				PublicBaseURL: "",
			},
			wantErr:     true,
			errContains: "PUBLIC_BASE_URL",
		},
		{
			name: "empty public base url in demo rejected",
			cfg: Config{
				Port:          8080,
				AppEnv:        EnvDemo,
				DemoMode:      true,
				DatabaseURL:   "postgres://cgp_demo:cgp_demo@localhost:5433/cgp_demo",
				JWTSecret:     "demo-secret-value-must-be-32-chars-long",
				JWTIssuer:     DemoJWTIssuer,
				CookieName:    DemoCookieName,
				PublicBaseURL: "",
			},
			wantErr:     true,
			errContains: "PUBLIC_BASE_URL",
		},
		{
			name: "empty public base url in dev allowed",
			cfg: Config{
				Port:          8080,
				AppEnv:        EnvDev,
				PublicBaseURL: "",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.cfg.Validate()
			if (err != nil) != tt.wantErr {
				t.Fatalf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr && !strings.Contains(err.Error(), tt.errContains) {
				t.Fatalf("Validate() error = %q, want it to contain %q", err.Error(), tt.errContains)
			}
			if tt.wantErr && !isVietnamese(err.Error()) {
				t.Fatalf("Validate() error %q must be a Vietnamese user-facing message (INV-02)", err.Error())
			}
		})
	}
}

// TestConfigLoad_DerivedDefaults verifies env parsing and derived JWT issuer/cookie name.
func TestConfigLoad_DerivedDefaults(t *testing.T) {
	t.Run("dev defaults", func(t *testing.T) {
		t.Setenv("APP_ENV", "")
		t.Setenv("DEMO_MODE", "")
		t.Setenv("PORT", "")
		t.Setenv("DATABASE_URL", "")
		t.Setenv("CGP_DB_DSN", "")
		t.Setenv("JWT_SECRET", "")
		t.Setenv("JWT_ISSUER", "")
		t.Setenv("COOKIE_NAME", "")
		t.Setenv("MOCK_OAUTH_ENABLED", "")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("Load() unexpected error: %v", err)
		}
		if cfg.Port != 8080 {
			t.Errorf("Port = %d, want 8080", cfg.Port)
		}
		if cfg.AppEnv != EnvDev {
			t.Errorf("AppEnv = %q, want %q", cfg.AppEnv, EnvDev)
		}
		if cfg.JWTIssuer != ProdJWTIssuer {
			t.Errorf("JWTIssuer = %q, want %q", cfg.JWTIssuer, ProdJWTIssuer)
		}
		if cfg.CookieName != ProdCookieName {
			t.Errorf("CookieName = %q, want %q", cfg.CookieName, ProdCookieName)
		}
		if !cfg.MockOAuthEnabled {
			t.Errorf("MockOAuthEnabled = false, want true in dev")
		}
		if !cfg.AutoSeed {
			t.Errorf("AutoSeed = false, want default true")
		}
	})

	t.Run("demo derivation", func(t *testing.T) {
		t.Setenv("APP_ENV", "demo")
		t.Setenv("DEMO_MODE", "true")
		t.Setenv("DATABASE_URL", "")
		t.Setenv("CGP_DB_DSN", "postgres://cgp_demo:cgp_demo@localhost:5433/cgp_demo")
		t.Setenv("JWT_ISSUER", "")
		t.Setenv("COOKIE_NAME", "")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("Load() unexpected error: %v", err)
		}
		if cfg.JWTIssuer != DemoJWTIssuer {
			t.Errorf("JWTIssuer = %q, want %q", cfg.JWTIssuer, DemoJWTIssuer)
		}
		if cfg.CookieName != DemoCookieName {
			t.Errorf("CookieName = %q, want %q", cfg.CookieName, DemoCookieName)
		}
		if cfg.DatabaseURL == "" {
			t.Errorf("DatabaseURL should fall back to CGP_DB_DSN")
		}
	})

	t.Run("DATABASE_URL takes precedence over CGP_DB_DSN", func(t *testing.T) {
		t.Setenv("DATABASE_URL", "postgres://a@h/db_one")
		t.Setenv("CGP_DB_DSN", "postgres://b@h/db_two")

		cfg, err := Load()
		if err != nil {
			t.Fatalf("Load() unexpected error: %v", err)
		}
		if cfg.DatabaseURL != "postgres://a@h/db_one" {
			t.Errorf("DatabaseURL = %q, want the DATABASE_URL value", cfg.DatabaseURL)
		}
	})
}

// isVietnamese reports whether the string contains at least one Vietnamese-specific
// letter (precomposed diacritic letters). Used to enforce INV-02 (Vietnamese-first
// messages).
func isVietnamese(s string) bool {
	// Vietnamese-specific base letters outside Latin Extended Additional.
	vietnameseBase := "ăâđêôơưĂÂĐÊÔƠƯ"
	for _, r := range s {
		// Latin Extended Additional (U+1E00–U+1EFF) holds the bulk of the
		// precomposed Vietnamese letters (ạ ế ỗ ợ ứ …).
		if (r >= 0x1E00 && r <= 0x1EFF) || strings.ContainsRune(vietnameseBase, r) {
			return true
		}
	}
	return false
}
