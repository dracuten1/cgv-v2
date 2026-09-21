// Package config provides application configuration and fail-fast validation.
//
// Invariants enforced here:
//   - INV-01: Zero Cost / OSS — purely self-contained configuration.
//   - INV-04: Fail-fast pre-listen validation for Mode A Demo and Production.
package config

import (
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"strconv"
	"strings"
)

// AppEnv defines the environment type (dev, demo, prod).
type AppEnv string

const (
	// EnvDev represents the local development environment.
	EnvDev AppEnv = "dev"
	// EnvDemo represents the isolated demo environment (Mode A).
	EnvDemo AppEnv = "demo"
	// EnvProd represents the production environment.
	EnvProd AppEnv = "prod"
)

// Demo-specific constant invariants per architecture spec and ADR-011.
const (
	DemoJWTIssuer  = "cgp-demo"
	ProdJWTIssuer  = "cgp-prod"
	DemoCookieName = "cgp_demo_session"
	ProdCookieName = "cgp_session"
)

// Typed configuration validation errors.
var (
	ErrMockOAuthForbidden = fmt.Errorf("vi phạm bảo mật: MOCK_OAUTH_ENABLED chỉ được phép kích hoạt trong môi trường phát triển (dev)")
	ErrJWTSecretTooShort  = fmt.Errorf("cấu hình bảo mật không hợp lệ: JWT_SECRET phải có độ dài tối thiểu 32 ký tự trong môi trường demo/prod")
)

// Config holds the runtime configuration parameters for the CGP v2 API backend.
type Config struct {
	// Server
	Port   int
	AppEnv AppEnv

	// Mode A Demo Isolation
	DemoMode bool

	// Database
	DatabaseURL string

	// Auth & Sessions
	JWTSecret  string
	JWTIssuer  string
	CookieName string

	// OAuth Providers (zero paid SaaS)
	ZaloClientID     string
	ZaloClientSecret string

	GoogleClientID     string
	GoogleClientSecret string

	FacebookClientID     string
	FacebookClientSecret string

	// MockOAuthEnabled allows local dev/testing without real provider secrets.
	MockOAuthEnabled bool

	// SMTP for Email Magic Link (free standard SMTP)
	SMTPHost string
	SMTPPort int
	SMTPUser string
	SMTPPass string
	SMTPFrom string

	// Web Push (free VAPID keys)
	VAPIDPublicKey  string
	VAPIDPrivateKey string

	// AutoSeed runs database migrations and seeds on startup if DB is empty.
	AutoSeed bool

	// CORSAllowedOrigins is the parsed allow-list of CORS origins.
	CORSAllowedOrigins []string

	// PublicBaseURL is the public base URL of the application (e.g. http://localhost:3456).
	PublicBaseURL string
}

// getEnvOrDefault reads an environment variable or falls back to a default value.
func getEnvOrDefault(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}

// getEnvBool reads an environment variable as a boolean.
func getEnvBool(key string, fallback bool) bool {
	val, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}
	b, err := strconv.ParseBool(val)
	if err != nil {
		return fallback
	}
	return b
}

// getEnvInt reads an environment variable as an integer.
func getEnvInt(key string, fallback int) int {
	val, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return fallback
	}
	return n
}

// Load reads configuration from environment variables and applies derived defaults.
func Load() (*Config, error) {
	port := getEnvInt("PORT", 8080)
	rawEnv := strings.ToLower(strings.TrimSpace(getEnvOrDefault("APP_ENV", string(EnvDev))))

	var env AppEnv
	switch rawEnv {
	case string(EnvDemo):
		env = EnvDemo
	case string(EnvProd):
		env = EnvProd
	default:
		env = EnvDev
	}

	demoMode := getEnvBool("DEMO_MODE", env == EnvDemo)

	// Database DSN: accept either DATABASE_URL or CGP_DB_DSN.
	dbURL := getEnvOrDefault("DATABASE_URL", "")
	if dbURL == "" {
		dbURL = getEnvOrDefault("CGP_DB_DSN", "")
	}

	jwtSecret := getEnvOrDefault("JWT_SECRET", "")

	// Derived JWT Issuer: demo -> cgp-demo, else cgp-prod. Allow explicit override from env if set.
	jwtIssuer := getEnvOrDefault("JWT_ISSUER", "")
	if jwtIssuer == "" {
		if demoMode {
			jwtIssuer = DemoJWTIssuer
		} else {
			jwtIssuer = ProdJWTIssuer
		}
	}

	// Derived Cookie Name: demo -> cgp_demo_session, else cgp_session. Allow override.
	cookieName := getEnvOrDefault("COOKIE_NAME", "")
	if cookieName == "" {
		if demoMode {
			cookieName = DemoCookieName
		} else {
			cookieName = ProdCookieName
		}
	}

	mockOAuth := getEnvBool("MOCK_OAUTH_ENABLED", env == EnvDev)
	autoSeed := getEnvBool("AUTO_SEED", true)

	rawCORS := getEnvOrDefault("CORS_ALLOWED_ORIGINS", "http://localhost:3456,http://localhost:3457")
	var corsOrigins []string
	for _, o := range strings.Split(rawCORS, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			corsOrigins = append(corsOrigins, o)
		}
	}

	publicBaseURL := strings.TrimRight(strings.TrimSpace(getEnvOrDefault("PUBLIC_BASE_URL", "http://localhost:3456")), "/")

	cfg := &Config{
		Port:                 port,
		AppEnv:               env,
		DemoMode:             demoMode,
		DatabaseURL:          dbURL,
		JWTSecret:            jwtSecret,
		JWTIssuer:            jwtIssuer,
		CookieName:           cookieName,
		CORSAllowedOrigins:   corsOrigins,
		PublicBaseURL:        publicBaseURL,
		ZaloClientID:         getEnvOrDefault("ZALO_CLIENT_ID", ""),
		ZaloClientSecret:     getEnvOrDefault("ZALO_CLIENT_SECRET", ""),
		GoogleClientID:       getEnvOrDefault("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret:   getEnvOrDefault("GOOGLE_CLIENT_SECRET", ""),
		FacebookClientID:     getEnvOrDefault("FACEBOOK_CLIENT_ID", ""),
		FacebookClientSecret: getEnvOrDefault("FACEBOOK_CLIENT_SECRET", ""),
		MockOAuthEnabled:     mockOAuth,
		SMTPHost:             getEnvOrDefault("SMTP_HOST", ""),
		SMTPPort:             getEnvInt("SMTP_PORT", 587),
		SMTPUser:             getEnvOrDefault("SMTP_USER", ""),
		SMTPPass:             getEnvOrDefault("SMTP_PASS", ""),
		SMTPFrom:             getEnvOrDefault("SMTP_FROM", "noreply@cgp.local"),
		VAPIDPublicKey:       getEnvOrDefault("VAPID_PUBLIC_KEY", ""),
		VAPIDPrivateKey:      getEnvOrDefault("VAPID_PRIVATE_KEY", ""),
		AutoSeed:             autoSeed,
	}

	return cfg, nil
}

// Validate checks configuration invariants.
// Returns a non-nil error describing the violation in Vietnamese.
// Callers should invoke ValidateOrDie() during boot before net.Listen.
func (c *Config) Validate() error {
	isStrict := c.AppEnv == EnvProd || c.AppEnv == EnvDemo || c.DemoMode

	// 1. Database DSN requirement for prod/demo.
	if isStrict && strings.TrimSpace(c.DatabaseURL) == "" {
		return fmt.Errorf("cấu hình cơ sở dữ liệu không hợp lệ: DATABASE_URL/CGP_DB_DSN bắt buộc trong môi trường %s", c.AppEnv)
	}

	// 2. JWT Secret requirement for prod/demo.
	if isStrict {
		if strings.TrimSpace(c.JWTSecret) == "" {
			return fmt.Errorf("cấu hình bảo mật không hợp lệ: JWT_SECRET không được để trống trong môi trường %s", c.AppEnv)
		}
		if len(c.JWTSecret) < 32 {
			return ErrJWTSecretTooShort
		}
	}

	// C4: MockOAuth forbidden in prod/demo modes.
	if c.MockOAuthEnabled && c.AppEnv != EnvDev {
		return ErrMockOAuthForbidden
	}

	// W5: Validate PUBLIC_BASE_URL if set (reject trailing path other than / or empty).
	if c.PublicBaseURL != "" {
		u, err := url.Parse(c.PublicBaseURL)
		if err != nil || u.Scheme == "" || u.Host == "" {
			return fmt.Errorf("cấu hình không hợp lệ: PUBLIC_BASE_URL '%s' không phải URL hợp lệ", c.PublicBaseURL)
		}
		if u.Path != "" && u.Path != "/" {
			return fmt.Errorf("cấu hình không hợp lệ: PUBLIC_BASE_URL '%s' không được chứa đường dẫn con khác '/'", c.PublicBaseURL)
		}
	}

	// 3. Mode A Demo Isolation Matrix (INV-04, ADR-011).
	if c.DemoMode {
		// JWT Issuer must strictly match "cgp-demo".
		if c.JWTIssuer != DemoJWTIssuer {
			return fmt.Errorf("vi phạm cô lập Demo (Mode A): JWT_ISSUER phải là '%s', hiện tại là '%s'", DemoJWTIssuer, c.JWTIssuer)
		}

		// Cookie name must strictly match "cgp_demo_session".
		if c.CookieName != DemoCookieName {
			return fmt.Errorf("vi phạm cô lập Demo (Mode A): COOKIE_NAME phải là '%s', hiện tại là '%s'", DemoCookieName, c.CookieName)
		}

		// Database isolation heuristic: DSN must contain "demo" (in db name or path or query).
		if c.DatabaseURL != "" && !dsnContainsDemo(c.DatabaseURL) {
			return fmt.Errorf("vi phạm cô lập Demo (Mode A): DATABASE_URL không chứa định danh 'demo' để bảo đảm cách ly vật lý")
		}
	}

	return nil
}

// dsnContainsDemo checks if the database URL or DSN contains the substring "demo" in its database name or query.
func dsnContainsDemo(raw string) bool {
	lower := strings.ToLower(raw)
	// If it's a URL like postgres://user:pass@host:5432/cgp_demo
	if u, err := url.Parse(raw); err == nil && u.Path != "" {
		pathLower := strings.ToLower(u.Path)
		if strings.Contains(pathLower, "demo") {
			return true
		}
	}
	// Fallback to substring search on full DSN (handles key=value style connection strings like dbname=cgp_demo)
	return strings.Contains(lower, "demo")
}

// ValidateOrDie runs Validate() and on error prints structured Vietnamese log line and calls os.Exit(1).
// This guarantees crash-before-listen behavior per INV-04 / Gotcha §8.
func (c *Config) ValidateOrDie() {
	if err := c.Validate(); err != nil {
		slog.Error("KHỞI ĐỘNG THẤT BẠI: vi phạm ràng buộc cấu hình hệ thống",
			slog.String("loi", err.Error()),
			slog.String("moi_truong", string(c.AppEnv)),
			slog.Bool("demo_mode", c.DemoMode),
		)
		os.Exit(1)
	}
}
