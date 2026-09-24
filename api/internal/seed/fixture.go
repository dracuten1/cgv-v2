package seed

import (
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// This file is the ONLY source of seed data. Every value is a compile-time
// literal (or a fixed date helper): no rand, no time.Now(), no generated
// UUIDs — two runs on an empty database yield byte-identical logical state
// (PROMPT.md §6 F8 determinism clause).

// Fixed family IDs (deterministic UUIDv4-format literals).
const (
	// Family1ID is "Gia phả họ Nguyễn Văn" — the demo family (root + grandson).
	Family1ID = "11111111-1111-4111-8111-000000000001"
	// Family2ID is "Gia phả họ Trần Thị".
	Family2ID = "22222222-2222-4222-8222-000000000002"
	// Family3ID is "Gia phả họ Lê Hoàng".
	Family3ID = "33333333-3333-4333-8333-000000000003"
)

// Named fixture members referenced by tests and the Playwright E2E journeys.
const (
	// RootID is the fixed UUID of Nguyễn Văn An — the Gen-1 patriarch of
	// Family 1 ("Thủy tổ gia phả"). E2E Journey 1 verifies his name on /tree.
	RootID = "aaaaaaa1-0000-4000-8000-000000000001"
	// GrandsonID is the fixed UUID of Nguyễn Văn Bình — Gen-3 male, son of
	// Nguyễn Văn Kiên (a Gen-2 son of An). The E2E kinship journey picks
	// Bình → An and asserts "Ông nội / Chi nội / Cách 2 đời".
	GrandsonID = "bbbbbbb2-0000-4000-8000-000000000002"
)

// Family names (PROMPT.md §6 F8: realistic Vietnamese family names).
const (
	Family1Name = "Gia phả họ Nguyễn Văn"
	Family2Name = "Gia phả họ Trần Thị"
	Family3Name = "Gia phả họ Lê Hoàng"
)

// RootAncestorName is the root ancestor's full name (F8 acceptance).
const RootAncestorName = "Nguyễn Văn An"

// date builds a UTC date literal — deterministic seed data only.
func date(year, month, day int) *time.Time {
	t := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	return &t
}

// Family1 seeds "Gia phả họ Nguyễn Văn" — 26 members spanning generations
// 1..5, rooted at Nguyễn Văn An.
//
// Notation: Gen / name / (birth–death | birth– ) [avatar]
func family1() seedFamily {
	f := seedFamily{id: Family1ID, name: Family1Name}

	// ---- Generation 1 (4 members): 2 root couples — paternal (An+Đoan)
	//                                 + maternal grandparents of the main
	//                                 grandson Bình (parents of Thảo) -------
	an := f.member("aaaaaaa1-0000-4000-8000-000000000001", RootAncestorName, model.GenderMale, 1,
		date(1928, 3, 15), date(2015, 10, 2), "/static/avatars/avatar-m1.svg", "Thủy tổ gia phả")
	doan := f.member("aaaaaaa1-0000-4000-8000-000000000002", "Trần Thị Đoan", model.GenderFemale, 1,
		date(1932, 7, 21), date(2018, 4, 9), "/static/avatars/avatar-f1.svg", "Vợ thủy tổ, quê làng Phú Thứ")
	// Maternal grandparents of Bình (parents of Thảo). IDs appended at the
	// tail of the Family1 ID space so all pre-existing member UUIDs stay
	// byte-stable (F5 stability contract).
	khai := f.member("aaaaaaa1-0000-4000-8000-000000000018", "Lê Văn Khải", model.GenderMale, 1,
		date(1926, 4, 12), date(2012, 8, 22), "/static/avatars/avatar-m3.svg",
		"Ông ngoại họ Lê, làng Phú Thứ")
	phuong := f.member("aaaaaaa1-0000-4000-8000-000000000019", "Hoàng Thị Phượng", model.GenderFemale, 1,
		date(1930, 11, 3), date(2019, 6, 10), "/static/avatars/avatar-f4.svg",
		"Bà ngoại họ Lê, quê làng Đông")

	// ---- Generation 2 (5 members: 3 children of An + 2 in-laws) -----------
	kien := f.member("aaaaaaa1-0000-4000-8000-000000000003", "Nguyễn Văn Kiên", model.GenderMale, 2,
		date(1954, 1, 20), nil, "", "Con trưởng, nguyên thợ mộc làng")
	cuc := f.member("aaaaaaa1-0000-4000-8000-000000000004", "Nguyễn Thị Cúc", model.GenderFemale, 2,
		date(1956, 9, 3), nil, "/static/avatars/avatar-f2.svg", "")
	hung := f.member("aaaaaaa1-0000-4000-8000-000000000005", "Nguyễn Văn Hùng", model.GenderMale, 2,
		date(1960, 5, 11), nil, "", "")
	thao := f.member("aaaaaaa1-0000-4000-8000-000000000006", "Lê Thị Thảo", model.GenderFemale, 2,
		date(1957, 2, 14), nil, "", "Vợ ông Kiên, giáo viên tiểu học")
	tuan := f.member("aaaaaaa1-0000-4000-8000-000000000007", "Phạm Văn Tuấn", model.GenderMale, 2,
		date(1959, 11, 30), nil, "", "Chồng bà Cúc, kỹ thuật viên bưu điện")

	// ---- Generation 3 (7 members: 5 grandchildren + 2 in-laws) ------------
	binh := f.member(GrandsonID, "Nguyễn Văn Bình", model.GenderMale, 3,
		date(1978, 6, 18), nil, "/static/avatars/avatar-m2.svg", "Cháu đích tôn, kỹ sư phần mềm")
	mai := f.member("aaaaaaa1-0000-4000-8000-000000000008", "Nguyễn Thị Mai", model.GenderFemale, 3,
		date(1980, 12, 25), nil, "", "")
	nam := f.member("aaaaaaa1-0000-4000-8000-000000000009", "Nguyễn Văn Nam", model.GenderMale, 3,
		date(1983, 4, 7), nil, "", "")
	lan := f.member("aaaaaaa1-0000-4000-8000-00000000000a", "Nguyễn Thị Lan", model.GenderFemale, 3,
		date(1985, 8, 19), nil, "", "")
	phong := f.member("aaaaaaa1-0000-4000-8000-00000000000b", "Nguyễn Văn Phong", model.GenderMale, 3,
		date(1988, 10, 1), nil, "", "")
	huong := f.member("aaaaaaa1-0000-4000-8000-00000000000c", "Đỗ Thị Hương", model.GenderFemale, 3,
		date(1981, 3, 27), nil, "", "Vợ ông Bình")
	dat := f.member("aaaaaaa1-0000-4000-8000-00000000000d", "Vũ Văn Đạt", model.GenderMale, 3,
		date(1984, 6, 5), nil, "", "Chồng bà Lan")

	// ---- Generation 4 (6 members: 4 great-grandchildren + 2 in-laws) ------
	minh := f.member("aaaaaaa1-0000-4000-8000-00000000000e", "Nguyễn Văn Minh", model.GenderMale, 4,
		date(2005, 2, 14), nil, "", "")
	nga := f.member("aaaaaaa1-0000-4000-8000-00000000000f", "Nguyễn Thị Nga", model.GenderFemale, 4,
		date(2007, 7, 30), nil, "/static/avatars/avatar-f3.svg", "")
	duc := f.member("aaaaaaa1-0000-4000-8000-000000000010", "Nguyễn Văn Đức", model.GenderMale, 4,
		date(2010, 9, 9), nil, "", "")
	trang := f.member("aaaaaaa1-0000-4000-8000-000000000011", "Nguyễn Thị Trang", model.GenderFemale, 4,
		date(2013, 12, 12), nil, "", "")
	linh := f.member("aaaaaaa1-0000-4000-8000-000000000012", "Hoàng Thị Linh", model.GenderFemale, 4,
		date(2006, 10, 8), nil, "", "Vợ ông Minh")
	son := f.member("aaaaaaa1-0000-4000-8000-000000000013", "Bùi Văn Sơn", model.GenderMale, 4,
		date(2008, 4, 22), nil, "", "Chồng bà Nga")

	// ---- Generation 5 (4 members) -----------------------------------------
	bao := f.member("aaaaaaa1-0000-4000-8000-000000000014", "Nguyễn Văn Bảo", model.GenderMale, 5,
		date(2031, 1, 10), nil, "", "")
	anhl := f.member("aaaaaaa1-0000-4000-8000-000000000015", "Nguyễn Thị Anh", model.GenderFemale, 5,
		date(2033, 5, 16), nil, "", "")
	duyen := f.member("aaaaaaa1-0000-4000-8000-000000000016", "Nguyễn Thị Duyên", model.GenderFemale, 5,
		date(2036, 8, 3), nil, "", "")
	giang := f.member("aaaaaaa1-0000-4000-8000-000000000017", "Nguyễn Văn Giang", model.GenderMale, 5,
		date(2039, 11, 21), nil, "", "")

	// Spouse edges (each family's married couples per generation).
	f.spouse(an, doan, 1952)
	f.spouse(khai, phuong, 1950) // Lê Văn Khải + Hoàng Thị Phượng (maternal grandparents of Bình)
	f.spouse(kien, thao, 1976)
	f.spouse(cuc, tuan, 1980)
	f.spouse(binh, huong, 2004)
	f.spouse(lan, dat, 2008)
	f.spouse(minh, linh, 2029)
	f.spouse(nga, son, 2030)

	// Parent-child edges (blood parents only; generation delta +1 enforced by
	// validateFixture and by the seeder's SQL CHECK-free invariant tests).
	f.child(an, kien)
	f.child(an, cuc)
	f.child(an, hung)
	f.child(doan, kien)
	f.child(doan, cuc)
	f.child(doan, hung)

	// Maternal grandparents → Thảo (so tier-1 renders the couple side-by-side
	// with An+Đoan per the reference design).
	f.child(khai, thao)
	f.child(phuong, thao)

	f.child(kien, binh)
	f.child(kien, mai)
	f.child(thao, binh)
	f.child(thao, mai)
	f.child(hung, nam)
	f.child(hung, lan)
	f.child(cuc, phong)
	f.child(tuan, phong)

	f.child(binh, minh)
	f.child(huong, minh)
	f.child(binh, nga)
	f.child(huong, nga)
	f.child(mai, duc)
	f.child(nam, trang)
	f.child(minh, bao)
	f.child(linh, bao)
	f.child(nga, anhl)
	f.child(son, anhl)
	f.child(duc, duyen)
	f.child(trang, giang)

	return f
}

// Family2 seeds "Gia phả họ Trần Thị" — 16 members spanning generations 1..4.
func family2() seedFamily {
	f := seedFamily{id: Family2ID, name: Family2Name}

	// ---- Generation 1 (2 members) ------------------------------------------
	cong := f.member("bbbbbbb2-1111-4000-8000-000000000001", "Trần Văn Công", model.GenderMale, 1,
		date(1930, 2, 8), date(2012, 6, 17), "", "Thủy tổ họ Trần tại xóm chợ")
	hanh := f.member("bbbbbbb2-1111-4000-8000-000000000002", "Nguyễn Thị Hạnh", model.GenderFemale, 1,
		date(1935, 9, 26), nil, "", "Vợ thủy tổ")

	// ---- Generation 2 (4 members: 2 children + 2 in-laws) ------------------
	tam := f.member("bbbbbbb2-1111-4000-8000-000000000003", "Trần Văn Tâm", model.GenderMale, 2,
		date(1958, 4, 2), nil, "", "")
	hue := f.member("bbbbbbb2-1111-4000-8000-000000000004", "Trần Thị Huế", model.GenderFemale, 2,
		date(1961, 11, 13), nil, "", "")
	dung := f.member("bbbbbbb2-1111-4000-8000-000000000005", "Lý Văn Dũng", model.GenderMale, 2,
		date(1957, 8, 24), nil, "", "Chồng bà Huế")
	hoa := f.member("bbbbbbb2-1111-4000-8000-000000000006", "Phan Thị Hòa", model.GenderFemale, 2,
		date(1960, 3, 18), nil, "", "Vợ ông Tâm")

	// ---- Generation 3 (7 members: 5 grandchildren + 2 in-laws) -------------
	ducanh := f.member("bbbbbbb2-1111-4000-8000-000000000007", "Trần Văn Đức Anh", model.GenderMale, 3,
		date(1982, 6, 6), nil, "/static/avatars/avatar-m3.svg", "")
	thuy := f.member("bbbbbbb2-1111-4000-8000-000000000008", "Trần Thị Thúy", model.GenderFemale, 3,
		date(1984, 1, 29), nil, "", "")
	quang := f.member("bbbbbbb2-1111-4000-8000-000000000009", "Trần Văn Quang", model.GenderMale, 3,
		date(1986, 10, 15), nil, "", "")
	ngoc := f.member("bbbbbbb2-1111-4000-8000-00000000000a", "Trần Thị Ngọc", model.GenderFemale, 3,
		date(1989, 7, 4), nil, "", "")
	hai := f.member("bbbbbbb2-1111-4000-8000-00000000000b", "Trần Văn Hải", model.GenderMale, 3,
		date(1992, 12, 3), nil, "", "")
	lien := f.member("bbbbbbb2-1111-4000-8000-00000000000c", "Đinh Thị Liễu", model.GenderFemale, 3,
		date(1985, 5, 21), nil, "", "Vợ ông Quang")
	truong := f.member("bbbbbbb2-1111-4000-8000-00000000000d", "Hà Văn Trường", model.GenderMale, 3,
		date(1988, 9, 9), nil, "", "Chồng bà Ngọc")

	// ---- Generation 4 (3 members) ------------------------------------------
	khanh := f.member("bbbbbbb2-1111-4000-8000-00000000000e", "Trần Văn Khánh", model.GenderMale, 4,
		date(2011, 3, 8), nil, "", "")
	chimai := f.member("bbbbbbb2-1111-4000-8000-00000000000f", "Trần Thị Chi Mai", model.GenderFemale, 4,
		date(2014, 6, 25), nil, "", "")
	baochau := f.member("bbbbbbb2-1111-4000-8000-000000000010", "Trần Bảo Châu", model.GenderFemale, 4,
		date(2017, 9, 1), nil, "", "")

	// Spouses
	f.spouse(cong, hanh, 1953)
	f.spouse(tam, hoa, 1979)
	f.spouse(hue, dung, 1981)
	f.spouse(quang, lien, 2010)
	f.spouse(ngoc, truong, 2012)

	// Parent-child
	f.child(cong, tam)
	f.child(cong, hue)
	f.child(hanh, tam)
	f.child(hanh, hue)

	f.child(tam, ducanh)
	f.child(tam, thuy)
	f.child(hoa, ducanh)
	f.child(hoa, thuy)
	f.child(hue, quang)
	f.child(dung, quang)
	f.child(hue, ngoc)
	f.child(dung, ngoc)
	f.child(hue, hai)

	f.child(ducanh, khanh)
	f.child(lien, chimai)
	f.child(ngoc, baochau)
	f.child(truong, baochau)

	return f
}

// Family3 seeds "Gia phả họ Lê Hoàng" — 13 members spanning generations 1..4.
func family3() seedFamily {
	f := seedFamily{id: Family3ID, name: Family3Name}

	// ---- Generation 1 (2 members) ------------------------------------------
	hoang := f.member("ccccccc3-2222-4000-8000-000000000001", "Lê Hoàng Thiện", model.GenderMale, 1,
		date(1936, 4, 12), date(2019, 1, 28), "", "Thủy tổ họ Lê Hoàng, thợ nề giỏi nhất vùng")
	hien := f.member("ccccccc3-2222-4000-8000-000000000002", "Bùi Thị Hiền", model.GenderFemale, 1,
		date(1940, 10, 6), nil, "", "")

	// ---- Generation 2 (3 members: 2 children + 1 in-law) -------------------
	thanh := f.member("ccccccc3-2222-4000-8000-000000000003", "Lê Hoàng Thanh", model.GenderMale, 2,
		date(1962, 7, 19), nil, "", "")
	xuan := f.member("ccccccc3-2222-4000-8000-000000000004", "Lê Thị Xuân", model.GenderFemale, 2,
		date(1965, 2, 11), nil, "", "")
	my := f.member("ccccccc3-2222-4000-8000-000000000005", "Ngô Thị Mỹ", model.GenderFemale, 2,
		date(1964, 12, 28), nil, "", "Vợ ông Thanh")

	// ---- Generation 3 (5 members: 4 grandchildren + 1 in-law) --------------
	trung := f.member("ccccccc3-2222-4000-8000-000000000006", "Lê Hoàng Trung", model.GenderMale, 3,
		date(1987, 5, 5), nil, "/static/avatars/avatar-m4.svg", "")
	thao := f.member("ccccccc3-2222-4000-8000-000000000007", "Lê Hoàng Thảo", model.GenderFemale, 3,
		date(1990, 8, 16), nil, "", "")
	tu := f.member("ccccccc3-2222-4000-8000-000000000008", "Lê Hoàng Tú", model.GenderMale, 3,
		date(1993, 1, 31), nil, "", "")
	vy := f.member("ccccccc3-2222-4000-8000-000000000009", "Lê Hoàng Vy", model.GenderFemale, 3,
		date(1996, 11, 23), nil, "", "")
	hung := f.member("ccccccc3-2222-4000-8000-00000000000a", "Trịnh Văn Hưng", model.GenderMale, 3,
		date(1989, 3, 14), nil, "", "Chồng bà Thảo")

	// ---- Generation 4 (3 members) ------------------------------------------
	anhl := f.member("ccccccc3-2222-4000-8000-00000000000b", "Lê Hoàng Anh", model.GenderMale, 4,
		date(2016, 2, 9), nil, "", "")
	midu := f.member("ccccccc3-2222-4000-8000-00000000000c", "Lê Hoàng Mì Du", model.GenderFemale, 4,
		date(2019, 7, 7), nil, "", "")
	baolam := f.member("ccccccc3-2222-4000-8000-00000000000d", "Lê Hoàng Bảo Lâm", model.GenderMale, 4,
		date(2022, 4, 4), nil, "", "")

	// Spouses
	f.spouse(hoang, hien, 1958)
	f.spouse(thanh, my, 1985)
	f.spouse(thao, hung, 2013)

	// Parent-child
	f.child(hoang, thanh)
	f.child(hoang, xuan)
	f.child(hien, thanh)
	f.child(hien, xuan)

	f.child(thanh, trung)
	f.child(my, trung)
	f.child(thanh, thao)
	f.child(my, thao)
	f.child(xuan, tu)
	f.child(xuan, vy)

	f.child(trung, anhl)
	f.child(thao, midu)
	f.child(hung, midu)
	f.child(thao, baolam)

	return f
}

// seedFamily accumulates the members, parent-child and spouse edges of one
// fixture family. Order of accumulation is fixture order — deterministic.
type seedFamily struct {
	id    string
	name  string
	memb  []model.Member
	pc    []model.ParentChild
	sp    []model.Spouse
	postn []feedPostSeed
}

// member appends a fixture member and returns its fixed UUID.
func (f *seedFamily) member(id, fullName string, gender model.Gender, gen int,
	birth, death *time.Time, avatar, notes string) string {
	f.memb = append(f.memb, model.Member{
		ID:              id,
		FamilyID:        f.id,
		FullName:        fullName,
		Gender:          gender,
		GenerationIndex: gen,
		BirthDate:       birth,
		DeathDate:       death,
		IsLiving:        death == nil,
		AvatarURL:       strPtr(avatar),
		Notes:           strPtr(notes),
	})
	return id
}

// child appends a parent→child blood edge.
func (f *seedFamily) child(parentID, childID string) {
	f.pc = append(f.pc, model.ParentChild{ParentID: parentID, ChildID: childID})
}

// spouse appends a marriage edge with a deterministic marriage date (year,
// June 15) between two fixture members of this family.
func (f *seedFamily) spouse(a, b string, year int) {
	f.sp = append(f.sp, model.Spouse{
		MemberA:      a,
		MemberB:      b,
		MarriageDate: date(year, 6, 15),
	})
}

// feedPostSeed is one feed_posts fixture row (inserted via direct SQL).
type feedPostSeed struct {
	FamilyID       string
	AuthorMemberID string
	Content        string
	Images         []string
}

// feedPosts returns the deterministic feed_posts fixture: 8 posts across
// Family 1 & Family 2, authored by real fixture members (INV-02 Vietnamese).
// created_at is assigned by the seeder from a fixed epoch — never time.Now().
func feedPosts() []feedPostSeed {
	return []feedPostSeed{
		{
			FamilyID:       Family1ID,
			AuthorMemberID: RootID,
			Content:        "Cả nhà ơi, cuối tuần này tổ chức giỗ tổ tại nhà cụ An, mọi người sắp xếp về đông đủ nhé.",
			Images:         []string{},
		},
		{
			FamilyID:       Family1ID,
			AuthorMemberID: "aaaaaaa1-0000-4000-8000-000000000003", // Nguyễn Văn Kiên
			Content:        "Đã dọn dẹp nhà thờ họ xong, bàn thờ tổ tiên đã được lau chùi sạch sẽ.",
			Images:         []string{"/static/uploads/nha-tho-ho-1.jpg"},
		},
		{
			FamilyID:       Family1ID,
			AuthorMemberID: GrandsonID,
			Content:        "Hôm nay cháu tìm được thêm hai tấm ảnh cũ của ông nội thời trẻ, xin gửi lên đây để cả nhà cùng xem.",
			Images:         []string{"/static/uploads/ong-kien-tre.jpg", "/static/uploads/ong-kien-truong-thanh.jpg"},
		},
		{
			FamilyID:       Family1ID,
			AuthorMemberID: "aaaaaaa1-0000-4000-8000-00000000000c", // Đỗ Thị Hương
			Content:        "Mình đã cập nhật ngày sinh của bé Bảo vào gia phả, bác chị nào xem lại giúp nhé.",
			Images:         []string{},
		},
		{
			FamilyID:       Family1ID,
			AuthorMemberID: "aaaaaaa1-0000-4000-8000-00000000000e", // Nguyễn Văn Minh
			Content:        "Tết năm nay nhà mình tổ chức chụp ảnh kỷ niệm cả đại gia đình, đề nghị mọi người chuẩn bị áo truyền thống.",
			Images:         []string{},
		},
		{
			FamilyID:       Family2ID,
			AuthorMemberID: "bbbbbbb2-1111-4000-8000-000000000003", // Trần Văn Tâm
			Content:        "Họ Trần mình tròn trăm năm xây nhà thờ họ, mai mời cả họ về dự lễ kỷ niệm.",
			Images:         []string{"/static/uploads/nha-tho-ho-tran.jpg"},
		},
		{
			FamilyID:       Family2ID,
			AuthorMemberID: "bbbbbbb2-1111-4000-8000-000000000009", // Trần Văn Quang
			Content:        "Cháu vừa chép xong bài chúc Tết của cụ Công ngày xưa, đăng lên đây cho con cháu sau này đọc.",
			Images:         []string{},
		},
		{
			FamilyID:       Family2ID,
			AuthorMemberID: "bbbbbbb2-1111-4000-8000-000000000004", // Trần Thị Huế
			Content:        "Ai còn giữ cuốn gia phả tay của cụ thân gửi giúp mình scans, mình sẽ nhập lại vào hệ thống.",
			Images:         []string{},
		},
	}
}

// strPtr returns nil for the empty string, a pointer otherwise — keeps the
// fixture literals readable (empty avatar/notes map to SQL NULL).
func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
