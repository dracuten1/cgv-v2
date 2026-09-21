package handler

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/gin-gonic/gin"
)

const (
	// ContextKeyClaims stores *auth.Claims in the Gin context.
	ContextKeyClaims = "cgp.auth.claims"
	// ContextKeyUserID stores user ID string in the Gin context.
	ContextKeyUserID = "cgp.auth.user_id"
	// HeaderRequestID is the correlation ID HTTP header.
	HeaderRequestID = "X-Request-ID"
)

// RequestLogger returns a Gin middleware logging HTTP requests with slog and injecting X-Request-ID.
func RequestLogger(logger *slog.Logger) gin.HandlerFunc {
	if logger == nil {
		logger = slog.Default()
	}
	return func(c *gin.Context) {
		reqID := c.GetHeader(HeaderRequestID)
		if reqID == "" {
			buf := make([]byte, 16)
			if _, err := rand.Read(buf); err == nil {
				reqID = hex.EncodeToString(buf)
			} else {
				reqID = fmt.Sprintf("%d", time.Now().UnixNano())
			}
			c.Header(HeaderRequestID, reqID)
		}

		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()
		clientIP := c.ClientIP()
		method := c.Request.Method

		if raw != "" {
			path = path + "?" + raw
		}

		logger.Info("HTTP Yêu cầu",
			slog.String("request_id", reqID),
			slog.String("method", method),
			slog.String("path", path),
			slog.Int("status", status),
			slog.Duration("latency", latency),
			slog.String("client_ip", clientIP),
		)
	}
}

// RecoveryMiddleware returns a Gin middleware recovering from panics with a Vietnamese error envelope.
func RecoveryMiddleware(logger *slog.Logger) gin.HandlerFunc {
	if logger == nil {
		logger = slog.Default()
	}
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				reqID := c.GetHeader(HeaderRequestID)
				logger.Error("KHẨN CẤP: Phục hồi sau sự cố sập luồng xử lý (panic)",
					slog.String("request_id", reqID),
					slog.Any("panic", r),
				)
				c.AbortWithStatusJSON(http.StatusInternalServerError,
					model.NewErrorEnvelope(model.CodeInternalError, "Đã xảy ra lỗi nghiêm trọng trong hệ thống"))
			}
		}()
		c.Next()
	}
}

// CORSMiddleware configures CORS headers: permissive in dev mode, same-origin in prod/demo.
func CORSMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		if cfg.AppEnv == config.EnvDev {
			if origin != "" {
				c.Header("Access-Control-Allow-Origin", origin)
			} else {
				c.Header("Access-Control-Allow-Origin", "*")
			}
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, X-Request-ID")
		} else {
			// In production/demo, Vue SPA and API are reverse-proxied behind Nginx under the same origin.
			// When an Origin is sent that matches host, echo it.
			if origin != "" {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Access-Control-Allow-Credentials", "true")
				c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, X-Request-ID")
			}
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// AuthMiddleware extracts JWT token from cfg.CookieName and verifies it via authService.
func AuthMiddleware(cfg *config.Config, authSvc AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		cookieName := cfg.CookieName
		if cookieName == "" {
			if cfg.DemoMode {
				cookieName = config.DemoCookieName
			} else {
				cookieName = config.ProdCookieName
			}
		}

		tokenStr, err := c.Cookie(cookieName)
		if err != nil || tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized,
				model.NewErrorEnvelope(model.CodeUnauthorized, "Yêu cầu đăng nhập để thực hiện thao tác này"))
			return
		}

		claims, err := authSvc.VerifyToken(tokenStr)
		if err != nil || claims == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized,
				model.NewErrorEnvelope(model.CodeUnauthorized, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn"))
			return
		}

		c.Set(ContextKeyClaims, claims)
		c.Set(ContextKeyUserID, claims.UserID)
		c.Next()
	}
}

// GetClaims retrieves *auth.Claims from Gin context.
func GetClaims(c *gin.Context) (*auth.Claims, bool) {
	val, ok := c.Get(ContextKeyClaims)
	if !ok {
		return nil, false
	}
	claims, ok := val.(*auth.Claims)
	return claims, ok
}

// GetUserID retrieves user ID from Gin context.
func GetUserID(c *gin.Context) string {
	val, ok := c.Get(ContextKeyUserID)
	if !ok {
		return ""
	}
	s, _ := val.(string)
	return s
}
