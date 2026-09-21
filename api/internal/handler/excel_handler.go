package handler

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/gin-gonic/gin"
)

const (
	// MaxExcelUploadBytes caps file upload at 15MB.
	MaxExcelUploadBytes = 15 * 1024 * 1024
)

// ExcelHandler handles import and export of family genealogy data via Excel (.xlsx).
type ExcelHandler struct {
	excelSvc ExcelService
	families FamilyRepository
}

// NewExcelHandler creates a new ExcelHandler.
func NewExcelHandler(excelSvc ExcelService, families FamilyRepository) *ExcelHandler {
	return &ExcelHandler{
		excelSvc: excelSvc,
		families: families,
	}
}

// Export handles GET /api/v1/families/:id/export.xlsx
func (h *ExcelHandler) Export(c *gin.Context) {
	familyID := c.Param("id")

	family, err := h.families.GetByID(c.Request.Context(), familyID)
	if err != nil {
		respondError(c, err)
		return
	}

	data, err := h.excelSvc.ExportFamily(c.Request.Context(), familyID)
	if err != nil {
		respondError(c, err)
		return
	}

	slug := slugify(family.Name)
	if slug == "" {
		slug = familyID
	}
	filename := fmt.Sprintf("gia-pha-%s.xlsx", slug)

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", data)
}

// Import handles POST /api/v1/families/:id/import.xlsx (Auth required)
func (h *ExcelHandler) Import(c *gin.Context) {
	familyID := c.Param("id")

	// Limit multipart reader to 15MB
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxExcelUploadBytes)

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Thiếu tệp Excel (.xlsx) trong yêu cầu hoặc tệp vượt quá 15MB"))
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Không thể đọc tệp đã tải lên"))
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Không thể đọc nội dung tệp"))
		return
	}

	summary, err := h.excelSvc.ImportFamily(c.Request.Context(), familyID, data)
	// Even if there were parsing/validation errors recorded in summary.Errors, we return 200 with summary
	if err != nil && summary.Errors == nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, summary)
}

// slugify creates a safe filename slug from Vietnamese string.
func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	replacer := strings.NewReplacer(
		" ", "-",
		"/", "-",
		"\\", "-",
		":", "-",
		"*", "-",
		"?", "-",
		"\"", "-",
		"<", "-",
		">", "-",
		"|", "-",
	)
	return replacer.Replace(s)
}
