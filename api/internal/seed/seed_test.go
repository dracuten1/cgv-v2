package seed

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// TestFixture_FamilyCount: exactly 3 families (F8).
func TestFixture_FamilyCount(t *testing.T) {
	fams := seedAll()
	if len(fams) != 3 {
		t.Fatalf("seedAll() trả về %d dòng họ, muốn đúng 3", len(fams))
	}

	seen := map[string]bool{}
	for _, f := range fams {
		if seen[f.id] {
			t.Errorf("trùng lặp ID dòng họ: %s", f.id)
		}
		seen[f.id] = true
	}
}

// TestFixture_TotalMembers: the hard acceptance gate — 55 members total
// (Family 1 grew from 24 → 26 in F5 when the maternal grandparents were
// appended for tier-1 dual-couple rendering).
func TestFixture_TotalMembers(t *testing.T) {
	fams := seedAll()
	total := 0
	for _, f := range fams {
		total += len(f.memb)
	}
	if total != 55 {
		t.Fatalf("tổng số thành viên = %d, muốn đúng 55", total)
	}
}

// TestFixture_Family1SpansFiveGenerations: Family 1 has members in every
// generation 1..5; families 2-3 span at least 3 generations.
func TestFixture_Family1SpansFiveGenerations(t *testing.T) {
	fams := seedAll()
	for i, f := range fams {
		gens := map[int]int{}
		for _, m := range f.memb {
			gens[m.GenerationIndex]++
		}
		want := 3
		if i == 0 {
			want = 5
		}
		for g := 1; g <= want; g++ {
			if gens[g] == 0 {
				t.Errorf("dòng họ %q thiếu thế hệ %d", f.name, g)
			}
		}
	}
}

// TestFixture_PerFamilyTotals: the documented split 26/16/13 (Family 1 grew
// from 24 → 26 in F5).
func TestFixture_PerFamilyTotals(t *testing.T) {
	fams := seedAll()
	want := []int{26, 16, 13}
	for i, f := range fams {
		if len(f.memb) != want[i] {
			t.Errorf("dòng họ %q có %d thành viên, muốn %d", f.name, len(f.memb), want[i])
		}
	}
}

// byID indexes one family's fixture members.
func byID(t *testing.T, f seedFamily) map[string]model.Member {
	t.Helper()
	idx := make(map[string]model.Member, len(f.memb))
	for _, m := range f.memb {
		if _, dup := idx[m.ID]; dup {
			t.Errorf("trùng lặp ID thành viên trong dòng họ %s: %s", f.name, m.ID)
		}
		idx[m.ID] = m
	}
	return idx
}

// TestFixture_ParentChildEdges: every edge references existing fixture IDs,
// no self-edges, no duplicate edges, and the generation delta parent→child is
// exactly +1.
func TestFixture_ParentChildEdges(t *testing.T) {
	for _, f := range seedAll() {
		idx := byID(t, f)
		seen := map[string]bool{}
		for _, e := range f.pc {
			parent, ok := idx[e.ParentID]
			if !ok {
				t.Fatalf("dòng họ %s: biên cha con tham chiếu cha không tồn tại: %s", f.name, e.ParentID)
			}
			child, ok := idx[e.ChildID]
			if !ok {
				t.Fatalf("dòng họ %s: biên cha con tham chiếu con không tồn tại: %s", f.name, e.ChildID)
			}
			if e.ParentID == e.ChildID {
				t.Errorf("dòng họ %s: biên cha con trỏ vào chính nó: %s", f.name, e.ParentID)
			}
			key := e.ParentID + "->" + e.ChildID
			if seen[key] {
				t.Errorf("dòng họ %s: biên cha con bị lặp: %s", f.name, key)
			}
			seen[key] = true
			if delta := child.GenerationIndex - parent.GenerationIndex; delta != 1 {
				t.Errorf("dòng họ %s: %s -> %s lệch thế hệ = %d, muốn đúng 1",
					f.name, parent.FullName, child.FullName, delta)
			}
		}
	}
}

// TestFixture_SpouseEdges: spouse edges reference existing IDs, never
// self-marriage, and no duplicate pair in either order. A member must not be
// married to two different people.
func TestFixture_SpouseEdges(t *testing.T) {
	for _, f := range seedAll() {
		idx := byID(t, f)
		seen := map[string]bool{}
		for _, s := range f.sp {
			if _, ok := idx[s.MemberA]; !ok {
				t.Fatalf("dòng họ %s: biên vợ chồng tham chiếu người không tồn tại: %s", f.name, s.MemberA)
			}
			if _, ok := idx[s.MemberB]; !ok {
				t.Fatalf("dòng họ %s: biên vợ chồng tham chiếu người không tồn tại: %s", f.name, s.MemberB)
			}
			if s.MemberA == s.MemberB {
				t.Errorf("dòng họ %s: tự cưới chính mình: %s", f.name, s.MemberA)
			}
			a, b := s.MemberA, s.MemberB
			if a > b {
				a, b = b, a
			}
			key := a + "+" + b
			if seen[key] {
				t.Errorf("dòng họ %s: cặp vợ chồng bị lặp (một trong hai chiều): %s", f.name, key)
			}
			seen[key] = true
		}
	}
}

// spouseMap maps each member to their (single) fixture spouse; a member with
// multiple spouses fails the test (deterministic fixture = one spouse each).
func spouseMap(t *testing.T, f seedFamily) map[string]string {
	t.Helper()
	m := map[string]string{}
	for _, s := range f.sp {
		for _, id := range []string{s.MemberA, s.MemberB} {
			if other, exists := m[id]; exists && other != s.MemberA && other != s.MemberB {
				t.Errorf("%s có nhiều hơn một vợ/chồng trong fixture", id)
			}
		}
		m[s.MemberA] = s.MemberB
		m[s.MemberB] = s.MemberA
	}
	return m
}

// TestFixture_RootAncestor: root is Nguyễn Văn An, Gen 1, male, Family 1,
// notes "Thủy tổ gia phả"; his Gen-1 spouse is Trần Thị Đoan.
func TestFixture_RootAncestor(t *testing.T) {
	f1 := seedAll()[0]
	idx := byID(t, f1)

	root, ok := idx[RootID]
	if !ok {
		t.Fatalf("không tìm thấy thủy tổ với RootID = %s", RootID)
	}
	if root.FullName != RootAncestorName {
		t.Errorf("thủy tổ tên %q, muốn %q", root.FullName, RootAncestorName)
	}
	if root.Gender != "male" {
		t.Errorf("giới tính thủy tổ = %q, muốn \"male\"", root.Gender)
	}
	if root.GenerationIndex != 1 {
		t.Errorf("thế hệ thủy tổ = %d, muốn 1", root.GenerationIndex)
	}
	if root.FamilyID != Family1ID {
		t.Errorf("thủy tổ thuộc dòng họ %s, muốn %s", root.FamilyID, Family1ID)
	}
	if root.Notes == nil || *root.Notes != "Thủy tổ gia phả" {
		t.Errorf("ghi chú thủy tổ = %v, muốn \"Thủy tổ gia phả\"", root.Notes)
	}
	// Death is optional for the root (F8); if set, IsLiving must be false and
	// death must follow birth. Root is expected deceased (born ~1928).
	if root.BirthDate == nil || root.BirthDate.Year() < 1925 || root.BirthDate.Year() > 1930 {
		if root.BirthDate == nil {
			t.Errorf("thủy tổ thiếu ngày sinh")
		} else {
			t.Errorf("năm sinh thủy tổ = %d, muốn ~1928", root.BirthDate.Year())
		}
	}
	if !root.IsLiving {
		if root.DeathDate == nil {
			t.Errorf("thủy tổ đã mất nhưng thiếu ngày mất")
		} else if !root.DeathDate.After(*root.BirthDate) {
			t.Errorf("ngày mất thủy tổ %v không sau ngày sinh %v", root.DeathDate, root.BirthDate)
		}
		if root.DeathDate != nil && root.DeathDate.Year() < 2000 {
			t.Errorf("ngày mất thủy tổ = %d, bất hợp lý (sinh ~1928)", root.DeathDate.Year())
		}
	}

	// The Gen-1 spouse must be female and share generation 1.
	spouses := spouseMap(t, f1)
	spID, ok := spouses[RootID]
	if !ok {
		t.Fatalf("thủy tổ chưa có vợ ở thế hệ 1")
	}
	sp := idx[spID]
	if sp.Gender != "female" {
		t.Errorf("vợ thủy tổ giới tính = %q, muốn \"female\"", sp.Gender)
	}
	if sp.GenerationIndex != 1 {
		t.Errorf("vợ thủy tổ thế hệ = %d, muốn 1", sp.GenerationIndex)
	}
}

// TestFixture_KinshipJourneyPath: the E2E kinship path An → (son Kiên, Gen 2)
// → (grandson Bình, Gen 3) exists — a male Gen-3 grandson whose father is a
// male Gen-2 son of the root. This is the pair asserted to compute to
// "Ông nội / Chi nội / Cách 2 đời".
func TestFixture_KinshipJourneyPath(t *testing.T) {
	f1 := seedAll()[0]
	idx := byID(t, f1)

	grandson, ok := idx[GrandsonID]
	if !ok {
		t.Fatalf("không tìm thấy cháu nội với GrandsonID = %s", GrandsonID)
	}
	if grandson.FullName != "Nguyễn Văn Bình" {
		t.Errorf("cháu nội tên %q, muốn \"Nguyễn Văn Bình\"", grandson.FullName)
	}
	if grandson.Gender != "male" {
		t.Errorf("cháu nội giới tính = %q, muốn \"male\"", grandson.Gender)
	}
	if grandson.GenerationIndex != 3 {
		t.Errorf("cháu nội thế hệ = %d, muốn 3", grandson.GenerationIndex)
	}
	if grandson.FamilyID != Family1ID {
		t.Errorf("cháu nội thuộc dòng họ %s, muốn %s", grandson.FamilyID, Family1ID)
	}

	// The grandson's FATHER (unique male parent) must be a Gen-2 son of the
	// root. A mother alongside the father is expected in a realistic tree.
	var father *model.Member
	for _, e := range f1.pc {
		if e.ChildID != GrandsonID {
			continue
		}
		p := idx[e.ParentID]
		if p.Gender != "male" {
			continue // the mother
		}
		if father != nil {
			t.Fatalf("cháu nội có nhiều hơn một cha: %s và %s", father.FullName, p.FullName)
		}
		father = &p
	}
	if father == nil {
		t.Fatalf("cháu nội %s không có cha nào (nam) trỏ tới", GrandsonID)
	}
	if father.Gender != "male" {
		t.Errorf("cha của cháu nội giới tính = %q, muốn \"male\"", father.Gender)
	}
	if father.GenerationIndex != 2 {
		t.Errorf("cha của cháu nội thế hệ = %d, muốn 2", father.GenerationIndex)
	}

	childOfRoot := map[string]bool{}
	for _, e := range f1.pc {
		if e.ParentID == RootID {
			childOfRoot[e.ChildID] = true
		}
	}
	if !childOfRoot[father.ID] {
		t.Errorf("cha %s không phải là con của thủy tổ %s", father.FullName, RootAncestorName)
	}

	// Root → father → grandson generation distance is exactly 2.
	if father.GenerationIndex-grandson.GenerationIndex != -1 {
		t.Errorf("quãng đường thế hệ grandfather→grandson phải là 2 (qua con trai)")
	}
}

// TestFixture_UUIDShape: every fixture ID (families + members) is a fixed
// 36-char canonical lowercase UUID — determinism guarantee (no randomness,
// no short IDs).
func TestFixture_UUIDShape(t *testing.T) {
	isUUID := func(id string) bool {
		if len(id) != 36 {
			return false
		}
		for i, c := range id {
			switch i {
			case 8, 13, 18, 23:
				if c != '-' {
					return false
				}
			default:
				if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
					return false
				}
			}
		}
		return true
	}
	for _, f := range seedAll() {
		if !isUUID(f.id) {
			t.Errorf("ID dòng họ %q không đúng dạng UUID: %s", f.name, f.id)
		}
		for _, m := range f.memb {
			if !isUUID(m.ID) {
				t.Errorf("ID thành viên %q không đúng dạng UUID: %s", m.FullName, m.ID)
			}
		}
	}
}

// TestFixture_LifeDates: birth < death where both set; IsLiving is true iff
// death_date is nil; parents born ≥ 20 years before their children; spouses
// both alive at marriage (marriage after both births, before both deaths).
func TestFixture_LifeDates(t *testing.T) {
	for _, f := range seedAll() {
		idx := byID(t, f)
		for _, m := range f.memb {
			if (m.DeathDate != nil) == m.IsLiving {
				t.Errorf("%s: IsLiving=%v không khớp ngày mất %v", m.FullName, m.IsLiving, m.DeathDate)
			}
			if m.BirthDate != nil && m.DeathDate != nil && !m.BirthDate.Before(*m.DeathDate) {
				t.Errorf("%s: ngày sinh %v không trước ngày mất %v", m.FullName, m.BirthDate, m.DeathDate)
			}
			if m.BirthDate == nil {
				t.Errorf("%s: thiếu ngày sinh", m.FullName)
			}
		}
		for _, e := range f.pc {
			parent, child := idx[e.ParentID], idx[e.ChildID]
			gap := child.BirthDate.Sub(*parent.BirthDate)
			if gap < 20*365*24*time.Hour {
				t.Errorf("%s sinh %v quá gần con %s sinh %v (cần ≥ 20 năm)",
					parent.FullName, parent.BirthDate.Format("2006"), child.FullName, child.BirthDate.Format("2006"))
			}
		}
		for _, s := range f.sp {
			a, b := idx[s.MemberA], idx[s.MemberB]
			md := *s.MarriageDate
			if md.Before(*a.BirthDate) || md.Before(*b.BirthDate) {
				t.Errorf("cưới %s - %s trước ngày sinh một trong hai người", a.FullName, b.FullName)
			}
			if a.DeathDate != nil && md.After(*a.DeathDate) {
				t.Errorf("cưới %s - %s sau ngày mất của %s", a.FullName, b.FullName, a.FullName)
			}
			if b.DeathDate != nil && md.After(*b.DeathDate) {
				t.Errorf("cưới %s - %s sau ngày mất của %s", a.FullName, b.FullName, b.FullName)
			}
		}
	}
}

// TestFixture_FeedPosts: every post references an existing member (of the
// same family!) and family; 8 posts across families 1 & 2; Vietnamese
// non-empty content; images are relative paths (no external SaaS).
func TestFixture_FeedPosts(t *testing.T) {
	posts := feedPosts()
	if len(posts) < 6 || len(posts) > 8 {
		t.Fatalf("số bài viết mẫu = %d, muốn từ 6 đến 8", len(posts))
	}

	famIdx := map[string]seedFamily{}
	for _, f := range seedAll() {
		famIdx[f.id] = f
	}
	for i, p := range posts {
		fam, ok := famIdx[p.FamilyID]
		if !ok {
			t.Fatalf("bài viết %d tham chiếu dòng họ không tồn tại: %s", i, p.FamilyID)
		}
		if p.FamilyID == Family3ID {
			t.Errorf("bài viết %d thuộc dòng họ 3, chỉ họ 1 và họ 2 mới có bài", i)
		}
		memberOK := false
		for _, m := range fam.memb {
			if m.ID == p.AuthorMemberID {
				memberOK = true
				break
			}
		}
		if !memberOK {
			t.Errorf("bài viết %d: tác giả %s không thuộc dòng họ %s", i, p.AuthorMemberID, p.FamilyID)
		}
		if p.Content == "" {
			t.Errorf("bài viết %d có nội dung rỗng", i)
		}
		for _, img := range p.Images {
			if len(img) > 0 && img[0] != '/' {
				t.Errorf("bài viết %d: ảnh %q phải là đường dẫn tương đối", i, img)
			}
		}
	}
}

// TestFixture_MaternalGrandparentsLinkToThao pins the F5 acceptance clause:
// tier-1 must render BOTH root couples side-by-side (paternal An+Đoan L and
// maternal Lê+Hoàng R) so the reference-design dual-couple element is
// exercised end-to-end. Specifically:
//   - Lê Văn Khải (aaaaaaa1-…-000000000018) and Hoàng Thị Phượng
//     (aaaaaaa1-…-000000000019) are both in Family 1, Gen 1.
//   - They are spouses of each other (marriage before Thảo's birth).
//   - Both are blood parents of Lê Thị Thảo (aaaaaaa1-…-000000000006,
//     Gen 2 — the Gen-2 "mother" the F5 ruling pinpoints).
//   - Their own parents are not in the fixture (they're the apex of the
//     maternal branch) and they have no other children — keeps the family
//     focused on the journey-1 grandson's lineage.
func TestFixture_MaternalGrandparentsLinkToThao(t *testing.T) {
	const (
		khaiID   = "aaaaaaa1-0000-4000-8000-000000000018"
		phuongID = "aaaaaaa1-0000-4000-8000-000000000019"
		thaoID   = "aaaaaaa1-0000-4000-8000-000000000006"
	)
	f1 := seedAll()[0]
	idx := byID(t, f1)

	for _, id := range []string{khaiID, phuongID, thaoID} {
		if _, ok := idx[id]; !ok {
			t.Fatalf("dòng họ 1 thiếu thành viên F5: %s", id)
		}
	}
	if idx[khaiID].FullName != "Lê Văn Khải" {
		t.Errorf("tên ông ngoại = %q, muốn \"Lê Văn Khải\"", idx[khaiID].FullName)
	}
	if idx[phuongID].FullName != "Hoàng Thị Phượng" {
		t.Errorf("tên bà ngoại = %q, muốn \"Hoàng Thị Phượng\"", idx[phuongID].FullName)
	}
	if idx[khaiID].Gender != "male" || idx[khaiID].GenerationIndex != 1 {
		t.Errorf("ông ngoại giới tính/thế hệ = %q/%d, muốn male/1",
			idx[khaiID].Gender, idx[khaiID].GenerationIndex)
	}
	if idx[phuongID].Gender != "female" || idx[phuongID].GenerationIndex != 1 {
		t.Errorf("bà ngoại giới tính/thế hệ = %q/%d, muốn female/1",
			idx[phuongID].Gender, idx[phuongID].GenerationIndex)
	}

	// Marriage edge between the two maternal grandparents.
	spouses := spouseMap(t, f1)
	if got := spouses[khaiID]; got != phuongID {
		t.Errorf("ông ngoại chưa kết hôn với bà ngoại: got %q, want %q", got, phuongID)
	}
	if got := spouses[phuongID]; got != khaiID {
		t.Errorf("bà ngoại chưa kết hôn với ông ngoại: got %q, want %q", got, khaiID)
	}

	// Both must be blood parents of Thảo (the Gen-2 mother per the F5 ruling).
	motherParents := map[string]bool{}
	for _, e := range f1.pc {
		if e.ChildID != thaoID {
			continue
		}
		motherParents[e.ParentID] = true
	}
	if !motherParents[khaiID] {
		t.Errorf("ông ngoại %s không phải cha ruột của Thảo %s", khaiID, thaoID)
	}
	if !motherParents[phuongID] {
		t.Errorf("bà ngoại %s không phải mẹ ruột của Thảo %s", phuongID, thaoID)
	}

	// Maternal grandparents must not have any other children in the fixture —
	// the F5 ruling scopes them tightly to "parents of the Gen-2 mother" so
	// the tier-1 layout stays clean (one paternal + one maternal couple).
	for _, e := range f1.pc {
		if (e.ParentID == khaiID || e.ParentID == phuongID) && e.ChildID != thaoID {
			t.Errorf("maternal grandparent %s có con ngoài Thảo: %s — vi phạm phạm vi F5",
				e.ParentID, e.ChildID)
		}
	}
}

// TestFixture_AllLivingHaveAvatarsOrNot is not a rule — but gender values
// must be canonical ("male"/"female") per INV-03.
func TestFixture_GenderCanonical(t *testing.T) {
	for _, f := range seedAll() {
		for _, m := range f.memb {
			if m.Gender != "male" && m.Gender != "female" {
				t.Errorf("%s: giới tính không hợp lệ %q (chỉ male/female)", m.FullName, m.Gender)
			}
		}
	}
}

// TestFixture_AvatarsInShippedAllowlist pins the F3 contract: every seeded
// avatar_url must reference one of the 8 SVG files shipped in
// web/public/static/avatars/. Without this guard, drifting the fixture URL
// (e.g. back to a .png name) would silently reintroduce the masked-404
// anti-pattern reported by the tester — the seed would still parse, the
// column would still hold a path, and the live stack would serve the SPA
// fallback HTML in place of a real avatar.
//
// The shipped filenames are read directly from web/public/static/avatars/ so
// the test fails loudly if either side drifts (a new SVG is added → add its
// basename to fixture.go; a fixture.go URL is renamed → add/rename the SVG).
func TestFixture_AvatarsInShippedAllowlist(t *testing.T) {
	// Locate web/public/static/avatars via a bounded upward walk from cwd,
	// so the test runs whether invoked from repo-root, api/, api/internal/seed, etc.
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("không xác định được thư mục làm việc: %v", err)
	}

	var avatarDir string
	curr := cwd
	for i := 0; i < 5; i++ {
		candidate := filepath.Join(curr, "web", "public", "static", "avatars")
		if fi, err := os.Stat(candidate); err == nil && fi.IsDir() {
			avatarDir = candidate
			break
		}
		parent := filepath.Dir(curr)
		if parent == curr {
			break
		}
		curr = parent
	}

	if avatarDir == "" {
		t.Skipf("không tìm thấy web/public/static/avatars sau khi tìm ngược từ %s (chỉ chạy trong repo layout chuẩn)", cwd)
	}

	entries, err := os.ReadDir(avatarDir)
	if err != nil {
		t.Fatalf("không đọc được %s: %v", avatarDir, err)
	}
	shipped := map[string]bool{}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		shipped[e.Name()] = true
	}
	if len(shipped) == 0 {
		t.Fatalf("thư mục %s rỗng — thiếu avatar mẫu", avatarDir)
	}

	for _, f := range seedAll() {
		for _, m := range f.memb {
			if m.AvatarURL == nil || *m.AvatarURL == "" {
				continue
			}
			// Strip leading slash so we compare bare filenames.
			raw := strings.TrimPrefix(*m.AvatarURL, "/static/avatars/")
			if raw == *m.AvatarURL {
				// Path is not in the expected /static/avatars/ namespace —
				// ValidateAvatarURL would reject it at runtime, so this is a
				// separate fail from the allowlist check.
				t.Errorf("%s: avatar_url %q không nằm trong /static/avatars/", m.FullName, *m.AvatarURL)
				continue
			}
			if !shipped[raw] {
				t.Errorf(
					"%s: avatar_url %q tham chiếu %q nhưng %s chỉ chứa: %v",
					m.FullName, *m.AvatarURL, raw, avatarDir, sortedKeys(shipped),
				)
			}
		}
	}
}

// sortedKeys returns the keys of a string-set in stable order — keeps the
// test failure message deterministic.
func sortedKeys(set map[string]bool) []string {
	out := make([]string, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// TestRunWithExecutor_Regression verifies that RunWithExecutor accepts an existing DBTX
// without opening a nested transaction, and respects the already-seeded guard.
func TestRunWithExecutor_Regression(t *testing.T) {
	fake := &fakeExecutor{rowsCount: 0}
	sum, err := RunWithExecutor(context.Background(), fake)
	if err != nil {
		t.Fatalf("RunWithExecutor failed on empty database: %v", err)
	}
	if sum.Families != 3 || sum.Members != 55 {
		t.Fatalf("unexpected summary: %+v", sum)
	}

	// Test already seeded guard
	fakePopulated := &fakeExecutor{rowsCount: 1}
	_, errPop := RunWithExecutor(context.Background(), fakePopulated)
	if !errors.Is(errPop, ErrAlreadySeeded) {
		t.Fatalf("expected ErrAlreadySeeded, got %v", errPop)
	}
}

// fakeRow implements pgx.Row for scanning an integer count.
type fakeRow struct {
	val int
}

func (r fakeRow) Scan(dest ...any) error {
	if len(dest) > 0 {
		if p, ok := dest[0].(*int); ok {
			*p = r.val
			return nil
		}
		if p, ok := dest[0].(*int64); ok {
			*p = int64(r.val)
			return nil
		}
	}
	return nil
}

// fakeExecutor satisfies database.DBTX.
type fakeExecutor struct {
	rowsCount int
	execCount int
}

func (f *fakeExecutor) Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
	f.execCount++
	return pgconn.NewCommandTag("INSERT 0 1"), nil
}

func (f *fakeExecutor) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return nil, nil
}

func (f *fakeExecutor) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return fakeRow{val: f.rowsCount}
}
