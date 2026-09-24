package handler

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/gin-gonic/gin"
)

// KinshipHandler handles GET /api/v1/kinship and the batched labels route.
type KinshipHandler struct {
	kinshipSvc KinshipService
	members    MemberRepository
	families   FamilyRepository
}

// NewKinshipHandler creates a new KinshipHandler.
func NewKinshipHandler(kinshipSvc KinshipService, members MemberRepository, families FamilyRepository) *KinshipHandler {
	return &KinshipHandler{
		kinshipSvc: kinshipSvc,
		members:    members,
		families:   families,
	}
}

// uuidPattern validates UUID formatting for family/from identifiers
// (Task 1.1.3: 400 on malformed UUIDs).
var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// KinshipLabelsResponse is the payload of the batched labels endpoint
// (Decision 2C): one flat dictionary of memberID → kinship term relative
// to the `from` member.
type KinshipLabelsResponse struct {
	FamilyID string            `json:"family_id"`
	From     string            `json:"from"`
	Dialect  string            `json:"dialect"`
	Labels   map[string]string `json:"labels"`
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

// GetFamilyKinshipLabels handles GET /api/v1/families/:id/kinship-labels?from=&dialect=
// (Decision 2C): one batched request returning every member's kinship term
// relative to the `from` member. Dialect defaults to "bac".
func (h *KinshipHandler) GetFamilyKinshipLabels(c *gin.Context) {
	familyID := strings.TrimSpace(c.Param("id"))
	fromID := strings.TrimSpace(c.Query("from"))
	dialect := strings.TrimSpace(c.DefaultQuery("dialect", "bac"))

	if !uuidPattern.MatchString(familyID) {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Mã dòng họ không hợp lệ"))
		return
	}
	if fromID == "" || !uuidPattern.MatchString(fromID) {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Cần cung cấp mã thành viên (from) hợp lệ"))
		return
	}

	// Unknown family → 404 (M2: family 404 before graph work).
	if _, err := h.families.GetByID(c.Request.Context(), familyID); err != nil {
		respondError(c, err)
		return
	}

	labels, err := h.kinshipSvc.GetLabels(c.Request.Context(), familyID, fromID, dialect)
	if err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, KinshipLabelsResponse{
		FamilyID: familyID,
		From:     fromID,
		Dialect:  dialect,
		Labels:   labels,
	})
}
