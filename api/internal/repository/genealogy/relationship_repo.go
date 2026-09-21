package genrepo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// RelationshipRepository handles parent_child and spouses tables.
type RelationshipRepository struct {
	pool *pgxpool.Pool
}

// NewRelationshipRepository creates a new RelationshipRepository.
func NewRelationshipRepository(pool *pgxpool.Pool) *RelationshipRepository {
	return &RelationshipRepository{pool: pool}
}

// MemberRelations bundles all 1-hop relations for a member.
type MemberRelations struct {
	Parents  []model.Member `json:"parents"`
	Children []model.Member `json:"children"`
	Siblings []model.Member `json:"siblings"`
	Spouses  []model.Member `json:"spouses"`
}

// AddParentChild creates a parent-child directed edge.
func (r *RelationshipRepository) AddParentChild(ctx context.Context, dbtx database.DBTX, parentID, childID string) error {
	if parentID == childID {
		return fmt.Errorf("không thể thiết lập quan hệ cha con cho cùng một người: %s", parentID)
	}
	query := `INSERT INTO parent_child (parent_id, child_id) VALUES ($1, $2)`
	_, err := dbtx.Exec(ctx, query, parentID, childID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return ErrDuplicate
		}
		return fmt.Errorf("không thể thêm quan hệ cha mẹ - con: %w", err)
	}
	return nil
}

// RemoveParentChild removes a parent-child edge.
func (r *RelationshipRepository) RemoveParentChild(ctx context.Context, dbtx database.DBTX, parentID, childID string) error {
	tag, err := dbtx.Exec(ctx, `DELETE FROM parent_child WHERE parent_id = $1 AND child_id = $2`, parentID, childID)
	if err != nil {
		return fmt.Errorf("không thể xóa quan hệ cha mẹ - con: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// AddSpouse inserts a spouse edge enforcing canonical order: (LEAST(a,b), GREATEST(a,b)).
func (r *RelationshipRepository) AddSpouse(ctx context.Context, dbtx database.DBTX, memberA, memberB string, marriageDate *time.Time) error {
	if memberA == memberB {
		return fmt.Errorf("không thể thiết lập quan hệ vợ chồng cho cùng một người: %s", memberA)
	}
	// Canonical ordering: memberA < memberB
	least := memberA
	greatest := memberB
	if least > greatest {
		least, greatest = greatest, least
	}

	query := `
		INSERT INTO spouses (member_a, member_b, marriage_date)
		VALUES ($1, $2, $3)`
	_, err := dbtx.Exec(ctx, query, least, greatest, marriageDate)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return ErrDuplicate
		}
		return fmt.Errorf("không thể thêm quan hệ vợ chồng: %w", err)
	}
	return nil
}

// RemoveSpouse removes a marriage edge regardless of input order.
func (r *RelationshipRepository) RemoveSpouse(ctx context.Context, dbtx database.DBTX, memberA, memberB string) error {
	least := memberA
	greatest := memberB
	if least > greatest {
		least, greatest = greatest, least
	}

	tag, err := dbtx.Exec(ctx, `DELETE FROM spouses WHERE member_a = $1 AND member_b = $2`, least, greatest)
	if err != nil {
		return fmt.Errorf("không thể xóa quan hệ vợ chồng: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListRelations returns parents, children, siblings, and spouses for memberID.
func (r *RelationshipRepository) ListRelations(ctx context.Context, memberID string) (*MemberRelations, error) {
	exec := database.GetExecutor(ctx, r.pool)

	res := &MemberRelations{
		Parents:  []model.Member{},
		Children: []model.Member{},
		Siblings: []model.Member{},
		Spouses:  []model.Member{},
	}

	// 1. Parents (parent_id where child_id = memberID)
	parentsQuery := `
		SELECT m.id, m.family_id, m.full_name, m.gender, m.generation_index,
		       m.birth_date, m.death_date, m.is_living, m.avatar_url, m.notes, m.created_at
		FROM members m
		JOIN parent_child pc ON m.id = pc.parent_id
		WHERE pc.child_id = $1
		ORDER BY m.birth_date ASC, m.created_at ASC`
	pRows, err := exec.Query(ctx, parentsQuery, memberID)
	if err != nil {
		return nil, fmt.Errorf("không thể truy vấn cha mẹ của %s: %w", memberID, err)
	}
	defer pRows.Close()
	for pRows.Next() {
		var m model.Member
		var genderStr string
		if err := pRows.Scan(
			&m.ID, &m.FamilyID, &m.FullName, &genderStr, &m.GenerationIndex,
			&m.BirthDate, &m.DeathDate, &m.IsLiving, &m.AvatarURL, &m.Notes, &m.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("lỗi đọc cha mẹ: %w", err)
		}
		m.Gender = model.Gender(genderStr)
		res.Parents = append(res.Parents, m)
	}
	if err := pRows.Err(); err != nil {
		return nil, fmt.Errorf("lỗi danh sách cha mẹ: %w", err)
	}

	// 2. Children (child_id where parent_id = memberID)
	childrenQuery := `
		SELECT m.id, m.family_id, m.full_name, m.gender, m.generation_index,
		       m.birth_date, m.death_date, m.is_living, m.avatar_url, m.notes, m.created_at
		FROM members m
		JOIN parent_child pc ON m.id = pc.child_id
		WHERE pc.parent_id = $1
		ORDER BY m.birth_date ASC, m.created_at ASC`
	cRows, err := exec.Query(ctx, childrenQuery, memberID)
	if err != nil {
		return nil, fmt.Errorf("không thể truy vấn con cái của %s: %w", memberID, err)
	}
	defer cRows.Close()
	for cRows.Next() {
		var m model.Member
		var genderStr string
		if err := cRows.Scan(
			&m.ID, &m.FamilyID, &m.FullName, &genderStr, &m.GenerationIndex,
			&m.BirthDate, &m.DeathDate, &m.IsLiving, &m.AvatarURL, &m.Notes, &m.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("lỗi đọc con cái: %w", err)
		}
		m.Gender = model.Gender(genderStr)
		res.Children = append(res.Children, m)
	}
	if err := cRows.Err(); err != nil {
		return nil, fmt.Errorf("lỗi danh sách con cái: %w", err)
	}

	// 3. Siblings: members sharing at least one parent, excluding memberID itself
	siblingsQuery := `
		SELECT DISTINCT m.id, m.family_id, m.full_name, m.gender, m.generation_index,
		       m.birth_date, m.death_date, m.is_living, m.avatar_url, m.notes, m.created_at
		FROM members m
		JOIN parent_child pc ON m.id = pc.child_id
		WHERE pc.parent_id IN (
			SELECT parent_id FROM parent_child WHERE child_id = $1
		) AND m.id <> $1
		ORDER BY m.birth_date ASC, m.created_at ASC`
	sRows, err := exec.Query(ctx, siblingsQuery, memberID)
	if err != nil {
		return nil, fmt.Errorf("không thể truy vấn anh chị em của %s: %w", memberID, err)
	}
	defer sRows.Close()
	for sRows.Next() {
		var m model.Member
		var genderStr string
		if err := sRows.Scan(
			&m.ID, &m.FamilyID, &m.FullName, &genderStr, &m.GenerationIndex,
			&m.BirthDate, &m.DeathDate, &m.IsLiving, &m.AvatarURL, &m.Notes, &m.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("lỗi đọc anh chị em: %w", err)
		}
		m.Gender = model.Gender(genderStr)
		res.Siblings = append(res.Siblings, m)
	}
	if err := sRows.Err(); err != nil {
		return nil, fmt.Errorf("lỗi danh sách anh chị em: %w", err)
	}

	// 4. Spouses (member_a or member_b)
	spousesQuery := `
		SELECT m.id, m.family_id, m.full_name, m.gender, m.generation_index,
		       m.birth_date, m.death_date, m.is_living, m.avatar_url, m.notes, m.created_at
		FROM members m
		JOIN spouses s ON (m.id = s.member_b AND s.member_a = $1)
		               OR (m.id = s.member_a AND s.member_b = $1)
		ORDER BY m.created_at ASC`
	spRows, err := exec.Query(ctx, spousesQuery, memberID)
	if err != nil {
		return nil, fmt.Errorf("không thể truy vấn vợ chồng của %s: %w", memberID, err)
	}
	defer spRows.Close()
	for spRows.Next() {
		var m model.Member
		var genderStr string
		if err := spRows.Scan(
			&m.ID, &m.FamilyID, &m.FullName, &genderStr, &m.GenerationIndex,
			&m.BirthDate, &m.DeathDate, &m.IsLiving, &m.AvatarURL, &m.Notes, &m.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("lỗi đọc vợ chồng: %w", err)
		}
		m.Gender = model.Gender(genderStr)
		res.Spouses = append(res.Spouses, m)
	}
	if err := spRows.Err(); err != nil {
		return nil, fmt.Errorf("lỗi danh sách vợ chồng: %w", err)
	}

	return res, nil
}

// ReparentChildren safely updates children of a member before deletion:
// If newParentID is provided, it updates parent_child edges pointing to deletedID to point to newParentID.
// If the edge (newParentID, child) already exists, it deletes the redundant edge with deletedID.
// If newParentID is nil, all parent_child edges for deletedID as parent are removed.
func (r *RelationshipRepository) ReparentChildren(ctx context.Context, dbtx database.DBTX, deletedID string, newParentID *string) error {
	if newParentID == nil {
		// Just delete parent edges where deletedID is parent
		_, err := dbtx.Exec(ctx, `DELETE FROM parent_child WHERE parent_id = $1`, deletedID)
		if err != nil {
			return fmt.Errorf("không thể xóa quan hệ cha con khi xóa thành viên: %w", err)
		}
		return nil
	}

	// For each child of deletedID:
	// If newParentID is already parent of child, delete edge (deletedID, child)
	// Else update parent_id to newParentID
	query := `
		INSERT INTO parent_child (parent_id, child_id)
		SELECT $1, child_id FROM parent_child WHERE parent_id = $2
		ON CONFLICT (parent_id, child_id) DO NOTHING`
	if _, err := dbtx.Exec(ctx, query, *newParentID, deletedID); err != nil {
		return fmt.Errorf("không thể chuyển liên kết con cái sang cha mẹ mới: %w", err)
	}

	// Now delete the old parent_child records for deletedID
	if _, err := dbtx.Exec(ctx, `DELETE FROM parent_child WHERE parent_id = $1`, deletedID); err != nil {
		return fmt.Errorf("không thể hoàn tất chuyển liên kết con cái: %w", err)
	}

	return nil
}
