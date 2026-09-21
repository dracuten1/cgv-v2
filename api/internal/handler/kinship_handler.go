package handler

import (
	"net/http"
	"strings"

	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/gin-gonic/gin"
)

// KinshipHandler handles GET /api/v1/kinship
type KinshipHandler struct {
	kinshipSvc KinshipService
	members    MemberRepository
}

// NewKinshipHandler creates a new KinshipHandler.
func NewKinshipHandler(kinshipSvc KinshipService, members MemberRepository) *KinshipHandler {
	return &KinshipHandler{
		kinshipSvc: kinshipSvc,
		members:    members,
	}
}

// Calculate handles GET /api/v1/kinship?from=&to=&dialect=
func (h *KinshipHandler) Calculate(c *gin.Context) {
	fromID := strings.TrimSpace(c.Query("from"))
	toID := strings.TrimSpace(c.Query("to"))
	dialect := strings.TrimSpace(c.DefaultQuery("dialect", "bac"))

	if fromID == "" || toID == "" {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Cần cung cấp đầy đủ thông tin từ (from) và đến (to)"))
		return
	}

	// Resolve 'from' member to determine familyID
	fromMember, err := h.members.GetByID(c.Request.Context(), fromID)
	if err != nil {
		respondError(c, err)
		return
	}

	toMember, err := h.members.GetByID(c.Request.Context(), toID)
	if err != nil {
		respondError(c, err)
		return
	}

	// Cross-family check
	if fromMember.FamilyID != toMember.FamilyID {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Hai thành viên không thuộc cùng dòng họ"))
		return
	}

	res, err := h.kinshipSvc.Calculate(c.Request.Context(), fromMember.FamilyID, fromID, toID, dialect)
	if err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, res)
}
