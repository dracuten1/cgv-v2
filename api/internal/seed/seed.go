// Package seed implements the deterministic demo-data seeder for Cây Gia Phả
// v2 (PROMPT.md §6 F8). The fixture (fixture.go) is pure compile-time data:
// fixed UUIDv4-format IDs, fixed dates, no rand/time.Now — repeated runs on
// an empty database produce byte-identical logical state.
package seed

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// ErrAlreadySeeded is returned by Run when the database already contains
// family rows (the abort-if-populated guard).
var ErrAlreadySeeded = errors.New("Dữ liệu đã tồn tại trong cơ sở dữ liệu")

// seedEpoch is the fixed instant stamped on feed_posts rows so seeded feeds
// sort deterministically (posts appear in fixture order, 1h apart). Never
// time.Now — determinism is an F8 acceptance clause.
var seedEpoch = time.Date(2026, time.January, 1, 8, 0, 0, 0, time.UTC)

// Summary reports what one seeder run wrote.
type Summary struct {
	Families         int
	Members          int
	ParentChildEdges int
	SpouseEdges      int
	FeedPosts        int
}

// seedAll assembles the whole fixture (also exercised directly by seed_test).
func seedAll() []seedFamily {
	f1 := family1()
	f2 := family2()
	f3 := family3()
	return []seedFamily{f1, f2, f3}
}

// Run is the reusable seeder entrypoint:
//  1. applies pending migrations (idempotent — safe on a fresh database);
//  2. aborts WITHOUT writing anything when any family already exists
//     (ErrAlreadySeeded) — unless forceOpts overrides the guard;
//  3. inserts the entire fixture inside ONE transaction (a failure anywhere
//     rolls the whole seed back, leaving no partial state).
func Run(ctx context.Context, pool *pgxpool.Pool) (Summary, error) {
	return runOpts(ctx, pool, false)
}

// Force is the -force variant: wipes the genealogy tables (families,
// members, parent_child, spouses, feed_posts — never users / identities /
// sessions / outbox / tokens) and re-seeds the fixture fresh.
//
// Deviation from the suggested `TRUNCATE ... CASCADE`: verified on Postgres
// 16, CASCADE also truncates `users` (users.member_id FK-references members;
// ON DELETE SET NULL does NOT apply to TRUNCATE), and a plain TRUNCATE
// REFUSES whenever any user row exists even after member_id is nulled. To
// honor the "never wipe accounts" contract we DELETE instead — row-wise FK
// actions apply, so users survive with member_id set to NULL.
func Force(ctx context.Context, pool *pgxpool.Pool) (Summary, error) {
	return runOpts(ctx, pool, true)
}

func runOpts(ctx context.Context, pool *pgxpool.Pool, force bool) (Summary, error) {
	if err := database.Migrate(ctx, pool); err != nil {
		return Summary{}, err
	}

	if force {
		if err := clearGenealogyTables(ctx, pool); err != nil {
			return Summary{}, fmt.Errorf("không thể xóa dữ liệu cũ: %w", err)
		}
	} else if populated, err := anyFamilyExists(ctx, pool); err != nil {
		return Summary{}, err
	} else if populated {
		return Summary{}, ErrAlreadySeeded
	}

	families := seedAll()

	var sum Summary
	// ONE transaction: any error rolls back the whole seed (no partial state).
	err := database.NewTxManager(pool).WithTx(ctx, func(ctx context.Context) error {
		exec := database.GetExecutor(ctx, pool)
		var err error
		sum, err = insertAll(ctx, exec, families)
		return err
	})
	if err != nil {
		return Summary{}, err
	}
	return sum, nil
}

// anyFamilyExists reports whether the families table has any row.
func anyFamilyExists(ctx context.Context, pool *pgxpool.Pool) (bool, error) {
	var n int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM families`).Scan(&n); err != nil {
		return false, fmt.Errorf("không thể kiểm tra dữ liệu dòng họ: %w", err)
	}
	return n > 0, nil
}

// clearGenealogyTables wipes the genealogy + feed tables via ordered DELETEs.
// Row-wise FK actions apply: deleting members nulls users.member_id (ON
// DELETE SET NULL) — account rows themselves are never touched.
func clearGenealogyTables(ctx context.Context, pool *pgxpool.Pool) error {
	return database.NewTxManager(pool).WithTx(ctx, func(ctx context.Context) error {
		exec := database.GetExecutor(ctx, pool)
		// Children first, parents last — FK CASCADE would handle the order,
		// but explicit order keeps the intent readable.
		for _, stmt := range []string{
			`DELETE FROM feed_posts`,
			`DELETE FROM spouses`,
			`DELETE FROM parent_child`,
			`DELETE FROM members`,
			`DELETE FROM families`,
		} {
			if _, err := exec.Exec(ctx, stmt); err != nil {
				return fmt.Errorf("không thể xóa dữ liệu gia phả (%s): %w", stmt, err)
			}
		}
		return nil
	})
}

// spouseEdgeID derives the fixed spouses.id for edge j of family i — a pure
// function of position, so re-seeding reproduces identical primary keys
// (spouses.id otherwise defaults to gen_random_uuid(), which is NOT
// deterministic across runs).
func spouseEdgeID(familyIdx, edgeIdx int) string {
	return fmt.Sprintf("ddddddd%d-0000-4000-8000-%012d", familyIdx+1, edgeIdx+1)
}

// insertAll writes families, members, edges and feed posts. All inserts use
// explicit fixed IDs and fixed timestamps — never gen_random_uuid()/NOW().
func insertAll(ctx context.Context, exec database.DBTX, families []seedFamily) (Summary, error) {
	var sum Summary

	famStmt := `INSERT INTO families (id, name, created_at) VALUES ($1, $2, $3)`
	for i, fam := range families {
		if _, err := exec.Exec(ctx, famStmt, fam.id, fam.name, seedEpoch); err != nil {
			return sum, fmt.Errorf("không thể tạo dòng họ %s: %w", fam.name, err)
		}
		sum.Families++

		memberStmt := `
			INSERT INTO members (id, family_id, full_name, gender, generation_index,
			                     birth_date, death_date, is_living, avatar_url, notes, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
		for _, m := range fam.memb {
			if _, err := exec.Exec(ctx, memberStmt,
				m.ID, m.FamilyID, m.FullName, m.Gender.String(), m.GenerationIndex,
				m.BirthDate, m.DeathDate, m.IsLiving, m.AvatarURL, m.Notes, seedEpoch,
			); err != nil {
				return sum, fmt.Errorf("không thể tạo thành viên %s: %w", m.FullName, err)
			}
			sum.Members++
		}

		pcStmt := `INSERT INTO parent_child (parent_id, child_id) VALUES ($1, $2)`
		for _, e := range fam.pc {
			if _, err := exec.Exec(ctx, pcStmt, e.ParentID, e.ChildID); err != nil {
				return sum, fmt.Errorf("không thể tạo quan hệ cha mẹ - con (%s -> %s): %w",
					e.ParentID, e.ChildID, err)
			}
			sum.ParentChildEdges++
		}

		spStmt := `INSERT INTO spouses (id, member_a, member_b, marriage_date) VALUES ($1, $2, $3, $4)`
		for j, s := range fam.sp {
			least, greatest := s.MemberA, s.MemberB
			if least > greatest { // canonical order guard — mirrors genrepo.AddSpouse
				least, greatest = greatest, least
			}
			edgeID := spouseEdgeID(i, j)
			if _, err := exec.Exec(ctx, spStmt, edgeID, least, greatest, s.MarriageDate); err != nil {
				return sum, fmt.Errorf("không thể tạo quan hệ vợ chồng (%s - %s): %w",
					s.MemberA, s.MemberB, err)
			}
			sum.SpouseEdges++
		}
	}

	postStmt := `
		INSERT INTO feed_posts (id, family_id, author_member_id, content, images, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`
	for i, p := range feedPosts() {
		images, err := model.ImagesToJSON(p.Images)
		if err != nil {
			return sum, err
		}
		id := fmt.Sprintf("eeeeeee1-0000-4000-8000-%012d", i+1)
		createdAt := seedEpoch.Add(time.Duration(i) * time.Hour)
		if _, err := exec.Exec(ctx, postStmt,
			id, p.FamilyID, strPtr(p.AuthorMemberID), p.Content, images, createdAt,
		); err != nil {
			return sum, fmt.Errorf("không thể tạo bài viết mẫu %d: %w", i+1, err)
		}
		sum.FeedPosts++
	}
	return sum, nil
}
