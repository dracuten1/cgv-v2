package genrepo

import (
	"context"
	"fmt"

	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ImportRepository handles bulk import operations and member counting.
type ImportRepository struct {
	pool *pgxpool.Pool
}

// NewImportRepository creates a new ImportRepository.
func NewImportRepository(pool *pgxpool.Pool) *ImportRepository {
	return &ImportRepository{pool: pool}
}

// CountMembers returns the total number of members in a family.
func (r *ImportRepository) CountMembers(ctx context.Context, familyID string) (int64, error) {
	exec := database.GetExecutor(ctx, r.pool)
	query := `SELECT COUNT(*) FROM members WHERE family_id = $1`
	var count int64
	if err := exec.QueryRow(ctx, query, familyID).Scan(&count); err != nil {
		return 0, fmt.Errorf("không thể đếm số lượng thành viên dòng họ: %w", err)
	}
	return count, nil
}

// ImportStaged inserts members, parent_child relationships, and spouses in a single transaction.
// Pre-condition: dbtx is an active transaction with appropriate timeout.
// INV-01 / M4 defense-in-depth: if any member.AvatarURL is invalid (non-bundled path),
// the insert is rejected with an error.
func (r *ImportRepository) ImportStaged(
	ctx context.Context,
	dbtx database.DBTX,
	familyID string,
	members []model.Member,
	pc []model.ParentChild,
	spouses []model.Spouse,
) error {
	// Defense-in-depth M4 guard on avatar_url
	for i := range members {
		if err := model.ValidateAvatarURL(members[i].AvatarURL); err != nil {
			return fmt.Errorf("không thể thêm thành viên %s: đường dẫn ảnh đại diện không hợp lệ (INV-01): %s", members[i].FullName, *members[i].AvatarURL)
		}
	}

	// 1. Insert members
	memberStmt := `
		INSERT INTO members (id, family_id, full_name, gender, generation_index,
		                     birth_date, death_date, is_living, avatar_url, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`
	for i := range members {
		m := &members[i]
		m.FamilyID = familyID
		if m.ID != "" {
			_, err := dbtx.Exec(
				ctx, memberStmt,
				m.ID, m.FamilyID, m.FullName, m.Gender.String(), m.GenerationIndex,
				m.BirthDate, m.DeathDate, m.IsLiving, m.AvatarURL, m.Notes,
			)
			if err != nil {
				return fmt.Errorf("không thể thêm thành viên %s: %w", m.FullName, err)
			}
		} else {
			err := dbtx.QueryRow(
				ctx,
				`INSERT INTO members (family_id, full_name, gender, generation_index,
				                     birth_date, death_date, is_living, avatar_url, notes)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				 RETURNING id, created_at`,
				m.FamilyID, m.FullName, m.Gender.String(), m.GenerationIndex,
				m.BirthDate, m.DeathDate, m.IsLiving, m.AvatarURL, m.Notes,
			).Scan(&m.ID, &m.CreatedAt)
			if err != nil {
				return fmt.Errorf("không thể thêm thành viên %s: %w", m.FullName, err)
			}
		}
	}

	// 2. Insert parent_child edges
	pcStmt := `
		INSERT INTO parent_child (parent_id, child_id)
		VALUES ($1, $2)
		ON CONFLICT (parent_id, child_id) DO NOTHING`
	for _, edge := range pc {
		if edge.ParentID == edge.ChildID || edge.ParentID == "" || edge.ChildID == "" {
			continue
		}
		if _, err := dbtx.Exec(ctx, pcStmt, edge.ParentID, edge.ChildID); err != nil {
			return fmt.Errorf("không thể thêm liên kết cha mẹ con (%s -> %s): %w", edge.ParentID, edge.ChildID, err)
		}
	}

	// 3. Insert spouses edges (canonical order: least < greatest)
	spStmt := `
		INSERT INTO spouses (member_a, member_b, marriage_date)
		VALUES ($1, $2, $3)
		ON CONFLICT (member_a, member_b) DO NOTHING`
	for _, sp := range spouses {
		if sp.MemberA == sp.MemberB || sp.MemberA == "" || sp.MemberB == "" {
			continue
		}
		least := sp.MemberA
		greatest := sp.MemberB
		if least > greatest {
			least, greatest = greatest, least
		}
		if _, err := dbtx.Exec(ctx, spStmt, least, greatest, sp.MarriageDate); err != nil {
			return fmt.Errorf("không thể thêm liên kết vợ chồng (%s - %s): %w", least, greatest, err)
		}
	}

	return nil
}
