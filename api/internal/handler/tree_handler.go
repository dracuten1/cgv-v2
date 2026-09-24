package handler

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	genrepo "github.com/dracuten1/cgv-v2/api/internal/repository/genealogy"
	"github.com/gin-gonic/gin"
)

// TreeHandler handles families, members, tree hierarchy, and relationship mutations.
type TreeHandler struct {
	txMgr     TxRunner
	families  FamilyRepository
	members   MemberRepository
	relations RelationshipRepository
	posts     SocialPostRepository
	// kinshipInv clears the kinship engine cache after member mutations
	// (MUST-FIX M3/K1). May be nil (tests / degraded wiring).
	kinshipInv KinshipCacheInvalidator
}

// NewTreeHandler creates a new TreeHandler.
func NewTreeHandler(
	txMgr TxRunner,
	families FamilyRepository,
	members MemberRepository,
	relations RelationshipRepository,
	posts SocialPostRepository,
	kinshipInv KinshipCacheInvalidator,
) *TreeHandler {
	return &TreeHandler{
		txMgr:      txMgr,
		families:   families,
		members:    members,
		relations:  relations,
		posts:      posts,
		kinshipInv: kinshipInv,
	}
}

// invalidateKinship drops cached kinship graphs for a family (M3/K1) —
// called AFTER the mutation transaction commits so readers reload fresh.
func (h *TreeHandler) invalidateKinship(familyID string) {
	if h.kinshipInv != nil {
		h.kinshipInv.Invalidate(familyID)
	}
}

// GenerationMeta represents the metadata for a single generation tier.
type GenerationMeta struct {
	Index int    `json:"index"`
	Label string `json:"label"`
	Count int    `json:"count"`
}

// TreeResponse is the payload returned by GET /api/v1/families/:id/tree.
type TreeResponse struct {
	FamilyID    string            `json:"family_id"`
	Version     int64             `json:"version"`
	Generations []GenerationMeta  `json:"generations"`
	Roots       []*model.TreeNode `json:"roots"`
}

// ListFamilies handles GET /api/v1/families
func (h *TreeHandler) ListFamilies(c *gin.Context) {
	list, err := h.families.List(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}
	if list == nil {
		list = []model.Family{}
	}
	c.JSON(http.StatusOK, gin.H{"families": list})
}

// GetTree handles GET /api/v1/families/:id/tree
func (h *TreeHandler) GetTree(c *gin.Context) {
	familyID := c.Param("id")

	members, pc, sp, version, err := h.members.LoadGraph(c.Request.Context(), familyID)
	if err != nil {
		respondError(c, err)
		return
	}

	// 1. Index members and spouses
	nodeMap := make(map[string]*model.TreeNode, len(members))
	genCounts := make(map[int]int)

	// Map spouses for quick lookup: memberID -> []spouseIDs
	spouseMap := make(map[string][]string)
	for _, edge := range sp {
		spouseMap[edge.MemberA] = append(spouseMap[edge.MemberA], edge.MemberB)
		spouseMap[edge.MemberB] = append(spouseMap[edge.MemberB], edge.MemberA)
	}

	for _, m := range members {
		var bDate, dDate *string
		if m.BirthDate != nil {
			s := m.BirthDate.Format("2006-01-02")
			bDate = &s
		}
		if m.DeathDate != nil {
			s := m.DeathDate.Format("2006-01-02")
			dDate = &s
		}
		avatar := ""
		if m.AvatarURL != nil {
			avatar = *m.AvatarURL
		}

		spouses := spouseMap[m.ID]
		if spouses == nil {
			spouses = []string{}
		}

		nodeMap[m.ID] = &model.TreeNode{
			ID:              m.ID,
			FullName:        m.FullName,
			Gender:          m.Gender,
			GenerationIndex: m.GenerationIndex,
			BirthDate:       bDate,
			DeathDate:       dDate,
			IsLiving:        m.IsLiving,
			AvatarURL:       avatar,
			SpouseIDs:       spouses,
			Children:        []*model.TreeNode{},
		}
		genCounts[m.GenerationIndex]++
	}

	// 2. Build parent -> children map and find child IDs
	childIDs := make(map[string]bool)
	for _, edge := range pc {
		childIDs[edge.ChildID] = true
		parent := nodeMap[edge.ParentID]
		child := nodeMap[edge.ChildID]
		if parent != nil && child != nil {
			// Avoid duplicate children addition
			alreadyChild := false
			for _, existing := range parent.Children {
				if existing.ID == child.ID {
					alreadyChild = true
					break
				}
			}
			if !alreadyChild {
				parent.Children = append(parent.Children, child)
			}
		}
	}

	// 3. Identify root nodes (members with no parents in parent_child)
	var roots []*model.TreeNode
	for _, m := range members {
		if !childIDs[m.ID] {
			if node, ok := nodeMap[m.ID]; ok {
				roots = append(roots, node)
			}
		}
	}
	if roots == nil {
		roots = []*model.TreeNode{}
	}

	// Sort roots by GenerationIndex, then FullName
	sort.Slice(roots, func(i, j int) bool {
		if roots[i].GenerationIndex != roots[j].GenerationIndex {
			return roots[i].GenerationIndex < roots[j].GenerationIndex
		}
		return roots[i].FullName < roots[j].FullName
	})

	// 4. Build generations list: "Đời thứ 1" .. "Đời thứ N"
	var genIndices []int
	for idx := range genCounts {
		genIndices = append(genIndices, idx)
	}
	sort.Ints(genIndices)

	generations := make([]GenerationMeta, 0, len(genIndices))
	for _, idx := range genIndices {
		generations = append(generations, GenerationMeta{
			Index: idx,
			Label: fmt.Sprintf("Đời thứ %d", idx),
			Count: genCounts[idx],
		})
	}

	c.JSON(http.StatusOK, TreeResponse{
		FamilyID:    familyID,
		Version:     version,
		Generations: generations,
		Roots:       roots,
	})
}

// ListMembers handles GET /api/v1/members?q=&page=&limit=
func (h *TreeHandler) ListMembers(c *gin.Context) {
	q := c.Query("q")
	limitStr := c.DefaultQuery("limit", "20")
	pageStr := c.DefaultQuery("page", "1")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}
	page, err := strconv.Atoi(pageStr)
	if err != nil || page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit

	res, err := h.members.List(c.Request.Context(), q, limit, offset)
	if err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, res)
}

// MemberInput is the request payload for creating/updating a member.
type MemberInput struct {
	FamilyID        string   `json:"family_id"`
	FullName        string   `json:"full_name" binding:"required"`
	Gender          string   `json:"gender" binding:"required"` // 'nam'/'nữ' or 'male'/'female'
	GenerationIndex int      `json:"generation_index"`
	BirthDate       *string  `json:"birth_date"`
	DeathDate       *string  `json:"death_date"`
	IsLiving        *bool    `json:"is_living"`
	AvatarURL       *string  `json:"avatar_url"`
	Notes           *string  `json:"notes"`
	ParentIDs       []string `json:"parent_ids"`
	SpouseIDs       []string `json:"spouse_ids"`
}

// parseMemberGender parses gender accepting both Vietnamese and English forms (INV-03).
func parseMemberGender(raw string) (model.Gender, error) {
	raw = strings.TrimSpace(raw)
	// Try Vietnamese first
	if g, err := model.ParseGenderVN(raw); err == nil {
		return g, nil
	}
	// Try English
	if g, err := model.ParseGenderAPI(raw); err == nil {
		return g, nil
	}
	return "", fmt.Errorf("giá trị giới tính không hợp lệ: %q (chấp nhận 'nam'/'nữ' hoặc 'male'/'female')", raw)
}

// parseOptionalDate parses an optional YYYY-MM-DD date string.
func parseOptionalDate(s *string) (*time.Time, error) {
	if s == nil || strings.TrimSpace(*s) == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", strings.TrimSpace(*s))
	if err != nil {
		// Also try RFC3339
		t2, err2 := time.Parse(time.RFC3339, strings.TrimSpace(*s))
		if err2 != nil {
			return nil, fmt.Errorf("định dạng ngày không hợp lệ: phải là YYYY-MM-DD")
		}
		return &t2, nil
	}
	return &t, nil
}

// avatarURLPattern enforces INV-01 (self-hosted assets only, MUST-FIX M4):
// avatar_url must be a bundled /static/avatars/ path — external https://
// URLs are rejected (SSRF / IP-leak guard) with 400.
var avatarURLPattern = regexp.MustCompile(`^/static/avatars/[A-Za-z0-9_-]+\.(png|svg|webp|jpg)$`)

// validateAvatarURL rejects non-conforming MemberInput.AvatarURL values.
// An absent or empty value is legal (clears the avatar).
func validateAvatarURL(avatarURL *string) error {
	if avatarURL == nil || *avatarURL == "" {
		return nil
	}
	if !avatarURLPattern.MatchString(*avatarURL) {
		return fmt.Errorf("đường dẫn ảnh đại diện không hợp lệ: chỉ chấp nhận /static/avatars/<tên>.(png|svg|webp|jpg)")
	}
	return nil
}

// CreateMember handles POST /api/v1/members (Auth required)
func (h *TreeHandler) CreateMember(c *gin.Context) {
	var input MemberInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Dữ liệu thành viên không hợp lệ"))
		return
	}

	if strings.TrimSpace(input.FamilyID) == "" {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Mã dòng họ không được để trống"))
		return
	}

	if err := validateAvatarURL(input.AvatarURL); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, err.Error()))
		return
	}

	gender, err := parseMemberGender(input.Gender)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeInvalidGender, err.Error()))
		return
	}

	bDate, err := parseOptionalDate(input.BirthDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, err.Error()))
		return
	}
	dDate, err := parseOptionalDate(input.DeathDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, err.Error()))
		return
	}

	isLiving := true
	if input.IsLiving != nil {
		isLiving = *input.IsLiving
	} else if dDate != nil {
		isLiving = false
	}

	genIndex := input.GenerationIndex
	if genIndex <= 0 {
		genIndex = 1
	}

	var created *model.Member
	err = h.txMgr.WithTx(c.Request.Context(), func(txCtx context.Context) error {
		exec := database.GetExecutor(txCtx, nil)

		m := &model.Member{
			FamilyID:        input.FamilyID,
			FullName:        strings.TrimSpace(input.FullName),
			Gender:          gender,
			GenerationIndex: genIndex,
			BirthDate:       bDate,
			DeathDate:       dDate,
			IsLiving:        isLiving,
			AvatarURL:       input.AvatarURL,
			Notes:           input.Notes,
		}

		res, err := h.members.Create(txCtx, exec, m)
		if err != nil {
			return err
		}
		created = res

		// Attach parents
		for _, parentID := range input.ParentIDs {
			parentID = strings.TrimSpace(parentID)
			if parentID != "" {
				if err := h.relations.AddParentChild(txCtx, exec, parentID, created.ID); err != nil {
					return err
				}
			}
		}

		// Attach spouses
		for _, spouseID := range input.SpouseIDs {
			spouseID = strings.TrimSpace(spouseID)
			if spouseID != "" {
				if err := h.relations.AddSpouse(txCtx, exec, created.ID, spouseID, nil); err != nil {
					return err
				}
			}
		}

		// Bump family version
		if _, err := h.families.BumpVersion(txCtx, exec, input.FamilyID); err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		respondError(c, err)
		return
	}

	// M3/K1: member mutation committed → drop cached kinship graphs.
	h.invalidateKinship(input.FamilyID)

	c.JSON(http.StatusCreated, created)
}

// MemberDetailResponse bundles member info, relations, and recent authored posts.
type MemberDetailResponse struct {
	genrepo.MemberWithFamily
	Relations *genrepo.MemberRelations `json:"relations"`
	Posts     []model.Post             `json:"posts"`
}

// GetMember handles GET /api/v1/members/:id
func (h *TreeHandler) GetMember(c *gin.Context) {
	memberID := c.Param("id")

	member, err := h.members.GetByID(c.Request.Context(), memberID)
	if err != nil {
		respondError(c, err)
		return
	}

	relations, err := h.relations.ListRelations(c.Request.Context(), memberID)
	if err != nil {
		respondError(c, err)
		return
	}

	posts, err := h.posts.ListByAuthor(c.Request.Context(), nil, memberID, 10)
	if err != nil || posts == nil {
		posts = []model.Post{}
	}

	c.JSON(http.StatusOK, MemberDetailResponse{
		MemberWithFamily: *member,
		Relations:        relations,
		Posts:            posts,
	})
}

// UpdateMember handles PUT /api/v1/members/:id (Auth required)
func (h *TreeHandler) UpdateMember(c *gin.Context) {
	memberID := c.Param("id")

	var input MemberInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Dữ liệu thành viên không hợp lệ"))
		return
	}

	if err := validateAvatarURL(input.AvatarURL); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, err.Error()))
		return
	}

	gender, err := parseMemberGender(input.Gender)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeInvalidGender, err.Error()))
		return
	}

	bDate, err := parseOptionalDate(input.BirthDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, err.Error()))
		return
	}
	dDate, err := parseOptionalDate(input.DeathDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, err.Error()))
		return
	}

	isLiving := true
	if input.IsLiving != nil {
		isLiving = *input.IsLiving
	} else if dDate != nil {
		isLiving = false
	}

	genIndex := input.GenerationIndex
	if genIndex <= 0 {
		genIndex = 1
	}

	var mutatedFamilyID string
	err = h.txMgr.WithTx(c.Request.Context(), func(txCtx context.Context) error {
		exec := database.GetExecutor(txCtx, nil)

		current, err := h.members.GetForUpdate(txCtx, exec, memberID)
		if err != nil {
			return err
		}
		mutatedFamilyID = current.FamilyID

		m := &model.Member{
			ID:              memberID,
			FamilyID:        current.FamilyID,
			FullName:        strings.TrimSpace(input.FullName),
			Gender:          gender,
			GenerationIndex: genIndex,
			BirthDate:       bDate,
			DeathDate:       dDate,
			IsLiving:        isLiving,
			AvatarURL:       input.AvatarURL,
			Notes:           input.Notes,
		}

		if err := h.members.Update(txCtx, exec, m); err != nil {
			return err
		}

		// Update relations if parent_ids or spouse_ids are supplied in input
		if input.ParentIDs != nil {
			// Clear old parents
			currRels, err := h.relations.ListRelations(txCtx, memberID)
			if err == nil && currRels != nil {
				for _, p := range currRels.Parents {
					_ = h.relations.RemoveParentChild(txCtx, exec, p.ID, memberID)
				}
			}
			for _, pid := range input.ParentIDs {
				pid = strings.TrimSpace(pid)
				if pid != "" {
					_ = h.relations.AddParentChild(txCtx, exec, pid, memberID)
				}
			}
		}

		if input.SpouseIDs != nil {
			// Clear old spouses
			currRels, err := h.relations.ListRelations(txCtx, memberID)
			if err == nil && currRels != nil {
				for _, sp := range currRels.Spouses {
					_ = h.relations.RemoveSpouse(txCtx, exec, memberID, sp.ID)
				}
			}
			for _, spID := range input.SpouseIDs {
				spID = strings.TrimSpace(spID)
				if spID != "" {
					_ = h.relations.AddSpouse(txCtx, exec, memberID, spID, nil)
				}
			}
		}

		// Bump version
		if _, err := h.families.BumpVersion(txCtx, exec, current.FamilyID); err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		respondError(c, err)
		return
	}

	// M3/K1: member mutation committed → drop cached kinship graphs.
	h.invalidateKinship(mutatedFamilyID)

	c.JSON(http.StatusOK, gin.H{"message": "Cập nhật thành viên thành công"})
}

// DeleteMember handles DELETE /api/v1/members/:id (Auth required)
// Orphan-safe in ONE tx: GetForUpdate -> reparent children to surviving spouse if any else leave parentless (preserving generation index) -> delete member -> BumpVersion.
func (h *TreeHandler) DeleteMember(c *gin.Context) {
	memberID := c.Param("id")

	var mutatedFamilyID string
	err := h.txMgr.WithTx(c.Request.Context(), func(txCtx context.Context) error {
		exec := database.GetExecutor(txCtx, nil)

		// 1. Lock member for update
		m, err := h.members.GetForUpdate(txCtx, exec, memberID)
		if err != nil {
			return err
		}
		mutatedFamilyID = m.FamilyID

		// 2. Fetch current relations to find spouses and children
		rels, err := h.relations.ListRelations(txCtx, memberID)
		if err != nil {
			return err
		}

		// 3. Find surviving spouse if any
		var newParentID *string
		if rels != nil && len(rels.Spouses) > 0 {
			// Pick the first surviving spouse, or first spouse
			for _, sp := range rels.Spouses {
				if sp.IsLiving {
					sID := sp.ID
					newParentID = &sID
					break
				}
			}
			if newParentID == nil && len(rels.Spouses) > 0 {
				sID := rels.Spouses[0].ID
				newParentID = &sID
			}
		}

		// 4. Reparent children (safely preserves generational indices)
		if err := h.relations.ReparentChildren(txCtx, exec, memberID, newParentID); err != nil {
			return err
		}

		// 5. Remove any parent_child edges where memberID was the child
		if rels != nil {
			for _, p := range rels.Parents {
				_ = h.relations.RemoveParentChild(txCtx, exec, p.ID, memberID)
			}
			// Remove spouse edges
			for _, sp := range rels.Spouses {
				_ = h.relations.RemoveSpouse(txCtx, exec, memberID, sp.ID)
			}
		}

		// 6. Delete member row
		if err := h.members.Delete(txCtx, exec, memberID); err != nil {
			return err
		}

		// 7. Bump family version
		if _, err := h.families.BumpVersion(txCtx, exec, m.FamilyID); err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		respondError(c, err)
		return
	}

	// M3/K1: member mutation committed → drop cached kinship graphs.
	h.invalidateKinship(mutatedFamilyID)

	c.JSON(http.StatusOK, gin.H{"message": "Xóa thành viên thành công"})
}
