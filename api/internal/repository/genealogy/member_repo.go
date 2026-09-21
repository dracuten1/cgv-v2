package genrepo

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// MemberRepository handles member operations.
type MemberRepository struct {
	pool *pgxpool.Pool
}

// NewMemberRepository creates a new MemberRepository.
func NewMemberRepository(pool *pgxpool.Pool) *MemberRepository {
	return &MemberRepository{pool: pool}
}

// MemberWithFamily includes member data and family name.
type MemberWithFamily struct {
	model.Member
	FamilyName string `json:"family_name"`
}

// List returns a paginated list of members, optionally filtered by search query.
func (r *MemberRepository) List(ctx context.Context, search string, limit, offset int) (*model.Page[model.Member], error) {
	exec := database.GetExecutor(ctx, r.pool)

	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	search = strings.TrimSpace(search)
	var countQuery string
	var listQuery string
	var countArgs []any
	var listArgs []any

	if search != "" {
		countQuery = `SELECT COUNT(*) FROM members WHERE full_name ILIKE $1`
		countArgs = []any{"%" + search + "%"}
		listQuery = `
			SELECT id, family_id, full_name, gender, generation_index,
			       birth_date, death_date, is_living, avatar_url, notes, created_at
			FROM members
			WHERE full_name ILIKE $1
			ORDER BY generation_index ASC, created_at ASC
			LIMIT $2 OFFSET $3`
		listArgs = []any{"%" + search + "%", limit, offset}
	} else {
		countQuery = `SELECT COUNT(*) FROM members`
		listQuery = `
			SELECT id, family_id, full_name, gender, generation_index,
			       birth_date, death_date, is_living, avatar_url, notes, created_at
			FROM members
			ORDER BY generation_index ASC, created_at ASC
			LIMIT $1 OFFSET $2`
		listArgs = []any{limit, offset}
	}

	var total int64
	if err := exec.QueryRow(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, fmt.Errorf("không thể đếm số lượng thành viên: %w", err)
	}

	rows, err := exec.Query(ctx, listQuery, listArgs...)
	if err != nil {
		return nil, fmt.Errorf("không thể truy vấn danh sách thành viên: %w", err)
	}
	defer rows.Close()

	var members []model.Member
	for rows.Next() {
		var m model.Member
		var genderStr string
		if err := rows.Scan(
			&m.ID, &m.FamilyID, &m.FullName, &genderStr, &m.GenerationIndex,
			&m.BirthDate, &m.DeathDate, &m.IsLiving, &m.AvatarURL, &m.Notes, &m.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("không thể đọc dữ liệu thành viên: %w", err)
		}
		m.Gender = model.Gender(genderStr)
		members = append(members, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("lỗi trong danh sách thành viên: %w", err)
	}

	return &model.Page[model.Member]{
		Items:  members,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	}, nil
}

// ListByFamily returns all members belonging to a family.
func (r *MemberRepository) ListByFamily(ctx context.Context, familyID string) ([]model.Member, error) {
	exec := database.GetExecutor(ctx, r.pool)
	query := `
		SELECT id, family_id, full_name, gender, generation_index,
		       birth_date, death_date, is_living, avatar_url, notes, created_at
		FROM members
		WHERE family_id = $1
		ORDER BY generation_index ASC, created_at ASC`

	rows, err := exec.Query(ctx, query, familyID)
	if err != nil {
		return nil, fmt.Errorf("không thể truy vấn thành viên dòng họ %s: %w", familyID, err)
	}
	defer rows.Close()

	var members []model.Member
	for rows.Next() {
		var m model.Member
		var genderStr string
		if err := rows.Scan(
			&m.ID, &m.FamilyID, &m.FullName, &genderStr, &m.GenerationIndex,
			&m.BirthDate, &m.DeathDate, &m.IsLiving, &m.AvatarURL, &m.Notes, &m.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("không thể đọc dữ liệu thành viên: %w", err)
		}
		m.Gender = model.Gender(genderStr)
		members = append(members, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("lỗi trong danh sách thành viên dòng họ: %w", err)
	}

	return members, nil
}

// GetByID returns a member by ID, with family name joined.
func (r *MemberRepository) GetByID(ctx context.Context, memberID string) (*MemberWithFamily, error) {
	exec := database.GetExecutor(ctx, r.pool)
	query := `
		SELECT m.id, m.family_id, m.full_name, m.gender, m.generation_index,
		       m.birth_date, m.death_date, m.is_living, m.avatar_url, m.notes, m.created_at,
		       f.name
		FROM members m
		JOIN families f ON m.family_id = f.id
		WHERE m.id = $1`

	var m MemberWithFamily
	var genderStr string
	err := exec.QueryRow(ctx, query, memberID).Scan(
		&m.ID, &m.FamilyID, &m.FullName, &genderStr, &m.GenerationIndex,
		&m.BirthDate, &m.DeathDate, &m.IsLiving, &m.AvatarURL, &m.Notes, &m.CreatedAt,
		&m.FamilyName,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("không thể truy vấn thành viên %s: %w", memberID, err)
	}
	m.Gender = model.Gender(genderStr)
	return &m, nil
}

// GetForUpdate locks the member row using SELECT ... FOR UPDATE.
func (r *MemberRepository) GetForUpdate(ctx context.Context, dbtx database.DBTX, memberID string) (*model.Member, error) {
	query := `
		SELECT id, family_id, full_name, gender, generation_index,
		       birth_date, death_date, is_living, avatar_url, notes, created_at
		FROM members
		WHERE id = $1
		FOR UPDATE`

	var m model.Member
	var genderStr string
	err := dbtx.QueryRow(ctx, query, memberID).Scan(
		&m.ID, &m.FamilyID, &m.FullName, &genderStr, &m.GenerationIndex,
		&m.BirthDate, &m.DeathDate, &m.IsLiving, &m.AvatarURL, &m.Notes, &m.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("không thể khóa thành viên %s: %w", memberID, err)
	}
	m.Gender = model.Gender(genderStr)
	return &m, nil
}

// Create inserts a new member into the database.
func (r *MemberRepository) Create(ctx context.Context, dbtx database.DBTX, m *model.Member) (*model.Member, error) {
	query := `
		INSERT INTO members (family_id, full_name, gender, generation_index,
		                     birth_date, death_date, is_living, avatar_url, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at`

	err := dbtx.QueryRow(
		ctx, query,
		m.FamilyID, m.FullName, m.Gender.String(), m.GenerationIndex,
		m.BirthDate, m.DeathDate, m.IsLiving, m.AvatarURL, m.Notes,
	).Scan(&m.ID, &m.CreatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrDuplicate
		}
		return nil, fmt.Errorf("không thể tạo thành viên: %w", err)
	}
	return m, nil
}

// Update updates an existing member's fields.
func (r *MemberRepository) Update(ctx context.Context, dbtx database.DBTX, m *model.Member) error {
	query := `
		UPDATE members
		SET full_name = $1, gender = $2, generation_index = $3,
		    birth_date = $4, death_date = $5, is_living = $6,
		    avatar_url = $7, notes = $8
		WHERE id = $9`

	tag, err := dbtx.Exec(
		ctx, query,
		m.FullName, m.Gender.String(), m.GenerationIndex,
		m.BirthDate, m.DeathDate, m.IsLiving,
		m.AvatarURL, m.Notes, m.ID,
	)
	if err != nil {
		return fmt.Errorf("không thể cập nhật thành viên %s: %w", m.ID, err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// Delete removes a member by ID.
func (r *MemberRepository) Delete(ctx context.Context, dbtx database.DBTX, memberID string) error {
	tag, err := dbtx.Exec(ctx, `DELETE FROM members WHERE id = $1`, memberID)
	if err != nil {
		return fmt.Errorf("không thể xóa thành viên %s: %w", memberID, err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// LoadGraph retrieves all members, parent_child edges, spouses edges, and current version
// for the given family in ≤ 3 queries + 1 version query.
func (r *MemberRepository) LoadGraph(ctx context.Context, familyID string) (
	members []model.Member,
	pc []model.ParentChild,
	sp []model.Spouse,
	version int64,
	err error,
) {
	exec := database.GetExecutor(ctx, r.pool)

	// 1. Get version
	verQuery := `SELECT version FROM families WHERE id = $1`
	if err := exec.QueryRow(ctx, verQuery, familyID).Scan(&version); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, nil, 0, ErrNotFound
		}
		return nil, nil, nil, 0, fmt.Errorf("không thể lấy phiên bản dòng họ: %w", err)
	}

	// 2. Query members
	mQuery := `
		SELECT id, family_id, full_name, gender, generation_index,
		       birth_date, death_date, is_living, avatar_url, notes, created_at
		FROM members
		WHERE family_id = $1
		ORDER BY generation_index ASC, created_at ASC`
	mRows, err := exec.Query(ctx, mQuery, familyID)
	if err != nil {
		return nil, nil, nil, 0, fmt.Errorf("không thể đọc danh sách thành viên: %w", err)
	}
	defer mRows.Close()

	for mRows.Next() {
		var m model.Member
		var genderStr string
		if err := mRows.Scan(
			&m.ID, &m.FamilyID, &m.FullName, &genderStr, &m.GenerationIndex,
			&m.BirthDate, &m.DeathDate, &m.IsLiving, &m.AvatarURL, &m.Notes, &m.CreatedAt,
		); err != nil {
			return nil, nil, nil, 0, fmt.Errorf("lỗi đọc thành viên: %w", err)
		}
		m.Gender = model.Gender(genderStr)
		members = append(members, m)
	}
	if err := mRows.Err(); err != nil {
		return nil, nil, nil, 0, fmt.Errorf("lỗi danh sách thành viên: %w", err)
	}

	// 3. Query parent_child
	pcQuery := `
		SELECT pc.parent_id, pc.child_id
		FROM parent_child pc
		JOIN members m ON pc.parent_id = m.id
		WHERE m.family_id = $1`
	pcRows, err := exec.Query(ctx, pcQuery, familyID)
	if err != nil {
		return nil, nil, nil, 0, fmt.Errorf("không thể đọc quan hệ cha mẹ - con: %w", err)
	}
	defer pcRows.Close()

	for pcRows.Next() {
		var edge model.ParentChild
		if err := pcRows.Scan(&edge.ParentID, &edge.ChildID); err != nil {
			return nil, nil, nil, 0, fmt.Errorf("lỗi đọc cạnh cha mẹ - con: %w", err)
		}
		pc = append(pc, edge)
	}
	if err := pcRows.Err(); err != nil {
		return nil, nil, nil, 0, fmt.Errorf("lỗi danh sách cha mẹ - con: %w", err)
	}

	// 4. Query spouses
	spQuery := `
		SELECT s.id, s.member_a, s.member_b, s.marriage_date
		FROM spouses s
		JOIN members m ON s.member_a = m.id
		WHERE m.family_id = $1`
	spRows, err := exec.Query(ctx, spQuery, familyID)
	if err != nil {
		return nil, nil, nil, 0, fmt.Errorf("không thể đọc quan hệ vợ chồng: %w", err)
	}
	defer spRows.Close()

	for spRows.Next() {
		var edge model.Spouse
		if err := spRows.Scan(&edge.ID, &edge.MemberA, &edge.MemberB, &edge.MarriageDate); err != nil {
			return nil, nil, nil, 0, fmt.Errorf("lỗi đọc cạnh vợ chồng: %w", err)
		}
		sp = append(sp, edge)
	}
	if err := spRows.Err(); err != nil {
		return nil, nil, nil, 0, fmt.Errorf("lỗi danh sách vợ chồng: %w", err)
	}

	return members, pc, sp, version, nil
}
