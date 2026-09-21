package handler

import (
	"net/http"
	"strings"

	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/gin-gonic/gin"
)

// PushHandler handles Web Push subscriptions.
type PushHandler struct {
	pushSvc PushService
}

// NewPushHandler creates a new PushHandler.
func NewPushHandler(pushSvc PushService) *PushHandler {
	return &PushHandler{pushSvc: pushSvc}
}

// PushSubscribeRequest is the body for registering a push subscription.
type PushSubscribeRequest struct {
	Endpoint string `json:"endpoint" binding:"required"`
	P256DH   string `json:"p256dh" binding:"required"`
	Auth     string `json:"auth" binding:"required"`
}

// Subscribe handles POST /api/v1/push/subscribe (Auth required)
func (h *PushHandler) Subscribe(c *gin.Context) {
	userID := GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, model.NewErrorEnvelope(model.CodeUnauthorized, "Chưa đăng nhập"))
		return
	}

	var req PushSubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Thông tin đăng ký nhận thông báo không đầy đủ"))
		return
	}

	if err := h.pushSvc.Subscribe(c.Request.Context(), userID, req.Endpoint, req.P256DH, req.Auth); err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Đăng ký nhận thông báo thành công",
	})
}

// Unsubscribe handles DELETE /api/v1/push/subscribe?endpoint=
func (h *PushHandler) Unsubscribe(c *gin.Context) {
	endpoint := strings.TrimSpace(c.Query("endpoint"))
	if endpoint == "" {
		// Also check JSON body if endpoint not in query
		var req struct {
			Endpoint string `json:"endpoint"`
		}
		if err := c.ShouldBindJSON(&req); err == nil {
			endpoint = strings.TrimSpace(req.Endpoint)
		}
	}

	if endpoint == "" {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Thiếu địa chỉ endpoint cần hủy"))
		return
	}

	if err := h.pushSvc.Unsubscribe(c.Request.Context(), endpoint); err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Hủy đăng ký nhận thông báo thành công",
	})
}
