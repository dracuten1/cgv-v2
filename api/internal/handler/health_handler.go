package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/gin-gonic/gin"
)

// HealthHandler handles health check routes.
type HealthHandler struct {
	pinger Pinger
}

// NewHealthHandler creates a new HealthHandler.
func NewHealthHandler(pinger Pinger) *HealthHandler {
	return &HealthHandler{pinger: pinger}
}

// Check handles GET /api/v1/health and GET /healthz
func (h *HealthHandler) Check(c *gin.Context) {
	dbStatus := "up"
	status := "ok"

	if h.pinger != nil {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 1*time.Second)
		defer cancel()

		if err := h.pinger.Ping(ctx); err != nil {
			dbStatus = "down"
			status = "error"
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status":  status,
				"db":      dbStatus,
				"version": "2.0.0",
				"time":    time.Now().UTC().Format(time.RFC3339),
				"error":   model.NewErrorEnvelope(model.CodeInternalError, "Không thể kết nối cơ sở dữ liệu"),
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  status,
		"db":      dbStatus,
		"version": "2.0.0",
		"time":    time.Now().UTC().Format(time.RFC3339),
	})
}
