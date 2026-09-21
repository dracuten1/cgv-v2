package kinship

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/model"
)

type mockLoader struct {
	members []model.Member
	pc      []model.ParentChild
	sp      []model.Spouse
	version int64
	calls   int
}

func (m *mockLoader) LoadGraph(ctx context.Context, familyID string) ([]model.Member, []model.ParentChild, []model.Spouse, int64, error) {
	m.calls++
	return m.members, m.pc, m.sp, m.version, nil
}

func build5GenFixture() (members []model.Member, pc []model.ParentChild, sp []model.Spouse) {
	// Gen 1:
	// Nguyen Van An (1940, male) married Tran Thi Mai (1942, female)
	tAn := time.Date(1940, 1, 1, 0, 0, 0, 0, time.UTC)
	tMai := time.Date(1942, 1, 1, 0, 0, 0, 0, time.UTC)
	an := model.Member{ID: "m-an", FamilyID: "f-1", FullName: "Nguyễn Văn An", Gender: model.GenderMale, GenerationIndex: 1, BirthDate: &tAn, IsLiving: true}
	mai := model.Member{ID: "m-mai", FamilyID: "f-1", FullName: "Trần Thị Mai", Gender: model.GenderFemale, GenerationIndex: 1, BirthDate: &tMai, IsLiving: true}
	sp = append(sp, model.Spouse{MemberA: "m-an", MemberB: "m-mai"})

	// Gen 2:
	// Son 1: Nguyen Van Binh (1965, male) - older son
	// Son 2: Nguyen Van Cuong (1970, male) - younger son
	// Daughter 1: Nguyen Thi Dung (1968, female)
	tBinh := time.Date(1965, 1, 1, 0, 0, 0, 0, time.UTC)
	tCuong := time.Date(1970, 1, 1, 0, 0, 0, 0, time.UTC)
	tDung := time.Date(1968, 1, 1, 0, 0, 0, 0, time.UTC)
	tHoa := time.Date(1967, 1, 1, 0, 0, 0, 0, time.UTC)
	tHung := time.Date(1966, 1, 1, 0, 0, 0, 0, time.UTC)

	binh := model.Member{ID: "m-binh", FamilyID: "f-1", FullName: "Nguyễn Văn Bình", Gender: model.GenderMale, GenerationIndex: 2, BirthDate: &tBinh, IsLiving: true}
	cuong := model.Member{ID: "m-cuong", FamilyID: "f-1", FullName: "Nguyễn Văn Cường", Gender: model.GenderMale, GenerationIndex: 2, BirthDate: &tCuong, IsLiving: true}
	dung := model.Member{ID: "m-dung", FamilyID: "f-1", FullName: "Nguyễn Thị Dung", Gender: model.GenderFemale, GenerationIndex: 2, BirthDate: &tDung, IsLiving: true}

	// In-laws in Gen 2:
	// Binh married Le Thi Hoa (1967)
	// Dung married Pham Van Hung (1966)
	hoa := model.Member{ID: "m-hoa", FamilyID: "f-1", FullName: "Lê Thị Hoa", Gender: model.GenderFemale, GenerationIndex: 2, BirthDate: &tHoa, IsLiving: true}
	hung := model.Member{ID: "m-hung", FamilyID: "f-1", FullName: "Phạm Văn Hùng", Gender: model.GenderMale, GenerationIndex: 2, BirthDate: &tHung, IsLiving: true}
	sp = append(sp, model.Spouse{MemberA: "m-binh", MemberB: "m-hoa"})
	sp = append(sp, model.Spouse{MemberA: "m-dung", MemberB: "m-hung"})

	pc = append(pc,
		model.ParentChild{ParentID: "m-an", ChildID: "m-binh"},
		model.ParentChild{ParentID: "m-mai", ChildID: "m-binh"},
		model.ParentChild{ParentID: "m-an", ChildID: "m-cuong"},
		model.ParentChild{ParentID: "m-mai", ChildID: "m-cuong"},
		model.ParentChild{ParentID: "m-an", ChildID: "m-dung"},
		model.ParentChild{ParentID: "m-mai", ChildID: "m-dung"},
	)

	// Gen 3:
	// Son of Binh (son's son): Nguyen Van Duc (1990, male) -> grandson via son
	// Daughter of Dung (daughter's daughter): Pham Thi Huong (1992, female) -> grandchild via daughter
	// Son of Cuong: Nguyen Van Giang (1995, male)
	tDuc := time.Date(1990, 1, 1, 0, 0, 0, 0, time.UTC)
	tHuong := time.Date(1992, 1, 1, 0, 0, 0, 0, time.UTC)
	tGiang := time.Date(1995, 1, 1, 0, 0, 0, 0, time.UTC)

	duc := model.Member{ID: "m-duc", FamilyID: "f-1", FullName: "Nguyễn Văn Đức", Gender: model.GenderMale, GenerationIndex: 3, BirthDate: &tDuc, IsLiving: true}
	huong := model.Member{ID: "m-huong", FamilyID: "f-1", FullName: "Phạm Thị Hương", Gender: model.GenderFemale, GenerationIndex: 3, BirthDate: &tHuong, IsLiving: true}
	giang := model.Member{ID: "m-giang", FamilyID: "f-1", FullName: "Nguyễn Văn Giang", Gender: model.GenderMale, GenerationIndex: 3, BirthDate: &tGiang, IsLiving: true}

	pc = append(pc,
		model.ParentChild{ParentID: "m-binh", ChildID: "m-duc"},
		model.ParentChild{ParentID: "m-hoa", ChildID: "m-duc"},
		model.ParentChild{ParentID: "m-dung", ChildID: "m-huong"},
		model.ParentChild{ParentID: "m-hung", ChildID: "m-huong"},
		model.ParentChild{ParentID: "m-cuong", ChildID: "m-giang"},
	)

	// Gen 4:
	// Son of Duc: Nguyen Van Khoa (2015, male) -> great-grandchild
	tKhoa := time.Date(2015, 1, 1, 0, 0, 0, 0, time.UTC)
	khoa := model.Member{ID: "m-khoa", FamilyID: "f-1", FullName: "Nguyễn Văn Khoa", Gender: model.GenderMale, GenerationIndex: 4, BirthDate: &tKhoa, IsLiving: true}
	pc = append(pc, model.ParentChild{ParentID: "m-duc", ChildID: "m-khoa"})

	// Gen 5:
	// Son of Khoa: Nguyen Van Long (2024, male) -> great-great-grandchild
	tLong := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	long := model.Member{ID: "m-long", FamilyID: "f-1", FullName: "Nguyễn Văn Long", Gender: model.GenderMale, GenerationIndex: 5, BirthDate: &tLong, IsLiving: true}
	pc = append(pc, model.ParentChild{ParentID: "m-khoa", ChildID: "m-long"})

	// Unrelated member in the family (disconnected)
	lonely := model.Member{ID: "m-lonely", FamilyID: "f-1", FullName: "Người Lạ", Gender: model.GenderMale, GenerationIndex: 1, IsLiving: true}

	members = []model.Member{an, mai, binh, cuong, dung, hoa, hung, duc, huong, giang, khoa, long, lonely}
	return members, pc, sp
}

func TestEngine_KinshipCalculations(t *testing.T) {
	members, pc, sp := build5GenFixture()
	loader := &mockLoader{
		members: members,
		pc:      pc,
		sp:      sp,
		version: 1,
	}
	engine := NewEngine(loader)
	ctx := context.Background()

	g, err := engine.GetGraph(ctx, "f-1", 1)
	if err != nil {
		t.Fatalf("unexpected GetGraph error: %v", err)
	}

	// 1. Acceptance Criterion 4:
	// Duc (grandson) -> An (grandfather):
	// exact assertion: term:"Ông nội", line:"Chi nội", generation_distance:2, distance_label:"Cách 2 đời", is_blood:true
	resDucToAn, err := engine.Calculate(g, "m-duc", "m-an", "bac")
	if err != nil {
		t.Fatalf("unexpected Calculate error: %v", err)
	}
	if resDucToAn.Term != "Ông nội" {
		t.Errorf("resDucToAn.Term = %q, want 'Ông nội'", resDucToAn.Term)
	}
	if resDucToAn.Line != "Chi nội" {
		t.Errorf("resDucToAn.Line = %q, want 'Chi nội'", resDucToAn.Line)
	}
	if resDucToAn.GenerationDistance != 2 {
		t.Errorf("resDucToAn.GenerationDistance = %d, want 2", resDucToAn.GenerationDistance)
	}
	if resDucToAn.DistanceLabel != "Cách 2 đời" {
		t.Errorf("resDucToAn.DistanceLabel = %q, want 'Cách 2 đời'", resDucToAn.DistanceLabel)
	}
	if !resDucToAn.IsBlood {
		t.Errorf("resDucToAn.IsBlood = false, want true")
	}

	// An -> Duc (grandfather to grandson via son):
	resAnToDuc, err := engine.Calculate(g, "m-an", "m-duc", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resAnToDuc.Term != "Cháu nội" {
		t.Errorf("resAnToDuc.Term = %q, want 'Cháu nội'", resAnToDuc.Term)
	}
	if resAnToDuc.Line != "Chi nội" {
		t.Errorf("resAnToDuc.Line = %q, want 'Chi nội'", resAnToDuc.Line)
	}
	if resAnToDuc.GenerationDistance != 2 {
		t.Errorf("resAnToDuc.GenerationDistance = %d, want 2", resAnToDuc.GenerationDistance)
	}
	if resAnToDuc.DistanceLabel != "Cách 2 đời" {
		t.Errorf("resAnToDuc.DistanceLabel = %q, want 'Cách 2 đời'", resAnToDuc.DistanceLabel)
	}
	if !resAnToDuc.IsBlood {
		t.Errorf("resAnToDuc.IsBlood = false, want true")
	}

	// 2. An -> grandchild via DAUGHTER (Huong):
	// An -> Huong: "Cháu ngoại", "Chi ngoại"
	resAnToHuong, err := engine.Calculate(g, "m-an", "m-huong", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resAnToHuong.Term != "Cháu ngoại" {
		t.Errorf("resAnToHuong.Term = %q, want 'Cháu ngoại'", resAnToHuong.Term)
	}
	if resAnToHuong.Line != "Chi ngoại" {
		t.Errorf("resAnToHuong.Line = %q, want 'Chi ngoại'", resAnToHuong.Line)
	}
	if resAnToHuong.GenerationDistance != 2 {
		t.Errorf("resAnToHuong.GenerationDistance = %d, want 2", resAnToHuong.GenerationDistance)
	}
	if !resAnToHuong.IsBlood {
		t.Errorf("resAnToHuong.IsBlood = false, want true")
	}

	// Huong -> An: "Ông ngoại", "Chi ngoại"
	resHuongToAn, err := engine.Calculate(g, "m-huong", "m-an", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resHuongToAn.Term != "Ông ngoại" {
		t.Errorf("resHuongToAn.Term = %q, want 'Ông ngoại'", resHuongToAn.Term)
	}
	if resHuongToAn.Line != "Chi ngoại" {
		t.Errorf("resHuongToAn.Line = %q, want 'Chi ngoại'", resHuongToAn.Line)
	}
	if resHuongToAn.GenerationDistance != 2 {
		t.Errorf("resHuongToAn.GenerationDistance = %d, want 2", resHuongToAn.GenerationDistance)
	}
	if resHuongToAn.DistanceLabel != "Cách 2 đời" {
		t.Errorf("resHuongToAn.DistanceLabel = %q, want 'Cách 2 đời'", resHuongToAn.DistanceLabel)
	}
	if !resHuongToAn.IsBlood {
		t.Errorf("resHuongToAn.IsBlood = false, want true")
	}

	// 3. Spouse term Chồng/Vợ Δg=0
	resAnToMai, err := engine.Calculate(g, "m-an", "m-mai", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resAnToMai.Term != "Vợ" {
		t.Errorf("resAnToMai.Term = %q, want 'Vợ'", resAnToMai.Term)
	}
	if resAnToMai.Line != "Hôn phối" {
		t.Errorf("resAnToMai.Line = %q, want 'Hôn phối'", resAnToMai.Line)
	}
	if resAnToMai.GenerationDistance != 0 {
		t.Errorf("resAnToMai.GenerationDistance = %d, want 0", resAnToMai.GenerationDistance)
	}
	if resAnToMai.DistanceLabel != "Cùng thế hệ" {
		t.Errorf("resAnToMai.DistanceLabel = %q, want 'Cùng thế hệ'", resAnToMai.DistanceLabel)
	}
	if resAnToMai.IsBlood {
		t.Errorf("resAnToMai.IsBlood = true, want false")
	}

	resMaiToAn, err := engine.Calculate(g, "m-mai", "m-an", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resMaiToAn.Term != "Chồng" {
		t.Errorf("resMaiToAn.Term = %q, want 'Chồng'", resMaiToAn.Term)
	}
	if resMaiToAn.Line != "Hôn phối" {
		t.Errorf("resMaiToAn.Line = %q, want 'Hôn phối'", resMaiToAn.Line)
	}
	if resMaiToAn.GenerationDistance != 0 {
		t.Errorf("resMaiToAn.GenerationDistance = %d, want 0", resMaiToAn.GenerationDistance)
	}
	if resMaiToAn.IsBlood {
		t.Errorf("resMaiToAn.IsBlood = true, want false")
	}

	// 4. Siblings Anh/Chị/Em by birth-year seniority:
	// Binh (1965, male), Dung (1968, female), Cuong (1970, male)
	// Cuong to Binh (younger brother looking at older brother):
	resCuongToBinh, err := engine.Calculate(g, "m-cuong", "m-binh", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resCuongToBinh.Term != "Anh" {
		t.Errorf("resCuongToBinh.Term = %q, want 'Anh'", resCuongToBinh.Term)
	}
	if resCuongToBinh.Line != "Đồng tông" {
		t.Errorf("resCuongToBinh.Line = %q, want 'Đồng tông'", resCuongToBinh.Line)
	}
	if resCuongToBinh.GenerationDistance != 0 {
		t.Errorf("resCuongToBinh.GenerationDistance = %d, want 0", resCuongToBinh.GenerationDistance)
	}
	if !resCuongToBinh.IsBlood {
		t.Errorf("resCuongToBinh.IsBlood = false, want true")
	}

	// Cuong to Dung (younger brother looking at older sister):
	resCuongToDung, err := engine.Calculate(g, "m-cuong", "m-dung", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resCuongToDung.Term != "Chị" {
		t.Errorf("resCuongToDung.Term = %q, want 'Chị'", resCuongToDung.Term)
	}

	// Binh to Cuong (older brother looking at younger brother):
	resBinhToCuong, err := engine.Calculate(g, "m-binh", "m-cuong", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resBinhToCuong.Term != "Em" {
		t.Errorf("resBinhToCuong.Term = %q, want 'Em'", resBinhToCuong.Term)
	}

	// 5. Uncle variants:
	// Duc's father is Binh (1965).
	// Duc looking at Cuong (1970, younger brother of father) -> Chú
	resDucToCuong, err := engine.Calculate(g, "m-duc", "m-cuong", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resDucToCuong.Term != "Chú" {
		t.Errorf("resDucToCuong.Term = %q, want 'Chú'", resDucToCuong.Term)
	}
	if resDucToCuong.Line != "Chi nội" {
		t.Errorf("resDucToCuong.Line = %q, want 'Chi nội'", resDucToCuong.Line)
	}
	if resDucToCuong.GenerationDistance != 1 {
		t.Errorf("resDucToCuong.GenerationDistance = %d, want 1", resDucToCuong.GenerationDistance)
	}

	// Giang's father is Cuong (1970).
	// Giang looking at Binh (1965, older brother of father) -> Bác
	resGiangToBinh, err := engine.Calculate(g, "m-giang", "m-binh", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resGiangToBinh.Term != "Bác" {
		t.Errorf("resGiangToBinh.Term = %q, want 'Bác'", resGiangToBinh.Term)
	}
	if resGiangToBinh.Line != "Chi nội" {
		t.Errorf("resGiangToBinh.Line = %q, want 'Chi nội'", resGiangToBinh.Line)
	}

	// Duc looking at Dung (father's sister) -> Cô
	resDucToDung, err := engine.Calculate(g, "m-duc", "m-dung", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resDucToDung.Term != "Cô" {
		t.Errorf("resDucToDung.Term = %q, want 'Cô'", resDucToDung.Term)
	}
	if resDucToDung.Line != "Chi nội" {
		t.Errorf("resDucToDung.Line = %q, want 'Chi nội'", resDucToDung.Line)
	}

	// Huong's mother is Dung.
	// Huong looking at Cuong (mother's younger brother) -> Cậu, Chi ngoại
	resHuongToCuong, err := engine.Calculate(g, "m-huong", "m-cuong", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resHuongToCuong.Term != "Cậu" {
		t.Errorf("resHuongToCuong.Term = %q, want 'Cậu'", resHuongToCuong.Term)
	}
	if resHuongToCuong.Line != "Chi ngoại" {
		t.Errorf("resHuongToCuong.Line = %q, want 'Chi ngoại'", resHuongToCuong.Line)
	}

	// 6. Great-grandchild (Khoa - Gen 4) & Great-great-grandchild (Long - Gen 5)
	resAnToKhoa, err := engine.Calculate(g, "m-an", "m-khoa", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resAnToKhoa.Term != "Chắt" {
		t.Errorf("resAnToKhoa.Term = %q, want 'Chắt'", resAnToKhoa.Term)
	}
	if resAnToKhoa.GenerationDistance != 3 {
		t.Errorf("resAnToKhoa.GenerationDistance = %d, want 3", resAnToKhoa.GenerationDistance)
	}

	resAnToLong, err := engine.Calculate(g, "m-an", "m-long", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resAnToLong.Term != "Chút" {
		t.Errorf("resAnToLong.Term = %q, want 'Chút'", resAnToLong.Term)
	}
	if resAnToLong.GenerationDistance != 4 {
		t.Errorf("resAnToLong.GenerationDistance = %d, want 4", resAnToLong.GenerationDistance)
	}

	// 7. Dijkstra fallback: no-blood-relation in-law path resolves via spouse edge:
	// Duc's mother is Hoa (in-law).
	// Relationship between Duc's mother Hoa and An (father-in-law)
	resHoaToAn, err := engine.Calculate(g, "m-hoa", "m-an", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resHoaToAn.IsBlood {
		t.Errorf("resHoaToAn.IsBlood = true, want false")
	}
	if resHoaToAn.Line != "Hôn phối" {
		t.Errorf("resHoaToAn.Line = %q, want 'Hôn phối'", resHoaToAn.Line)
	}
	if resHoaToAn.GenerationDistance != 1 {
		t.Errorf("resHoaToAn.GenerationDistance = %d, want 1", resHoaToAn.GenerationDistance)
	}
	if resHoaToAn.Term == "" {
		t.Errorf("resHoaToAn.Term should not be empty")
	}

	// Relationship between Hoa (Binh's wife) and Cuong (Binh's brother)
	resHoaToCuong, err := engine.Calculate(g, "m-hoa", "m-cuong", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resHoaToCuong.IsBlood {
		t.Errorf("resHoaToCuong.IsBlood = true, want false")
	}
	if resHoaToCuong.Line != "Hôn phối" {
		t.Errorf("resHoaToCuong.Line = %q, want 'Hôn phối'", resHoaToCuong.Line)
	}

	// 8. Disconnected member
	resLonely, err := engine.Calculate(g, "m-an", "m-lonely", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resLonely.Term != "Không xác định được quan hệ" {
		t.Errorf("resLonely.Term = %q, want 'Không xác định được quan hệ'", resLonely.Term)
	}
	if len(resLonely.Path) != 0 {
		t.Errorf("resLonely.Path should be empty, got %v", resLonely.Path)
	}
	if resLonely.IsBlood {
		t.Errorf("resLonely.IsBlood = true, want false")
	}

	// 9. Same person
	resSelf, err := engine.Calculate(g, "m-an", "m-an", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resSelf.Term != "Bản thân" {
		t.Errorf("resSelf.Term = %q, want 'Bản thân'", resSelf.Term)
	}
	if !resSelf.IsBlood {
		t.Errorf("resSelf.IsBlood = false, want true")
	}
	if resSelf.GenerationDistance != 0 {
		t.Errorf("resSelf.GenerationDistance = %d, want 0", resSelf.GenerationDistance)
	}
}

func TestEngine_VersionCacheAndInvalidation(t *testing.T) {
	members, pc, sp := build5GenFixture()
	loader := &mockLoader{
		members: members,
		pc:      pc,
		sp:      sp,
		version: 1,
	}
	engine := NewEngine(loader)
	ctx := context.Background()

	// Initial load: calls = 1
	g1, err := engine.GetGraph(ctx, "f-1", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if loader.calls != 1 {
		t.Errorf("loader.calls = %d, want 1", loader.calls)
	}
	if g1.Version != 1 {
		t.Errorf("g1.Version = %d, want 1", g1.Version)
	}

	// Second load with same version: cache hit, calls still 1
	g2, err := engine.GetGraph(ctx, "f-1", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if loader.calls != 1 {
		t.Errorf("loader.calls = %d, want 1", loader.calls)
	}
	if g1 != g2 {
		t.Errorf("expected g1 == g2 (pointer equality)")
	}

	// Bump version in loader and request new version: reload triggered
	loader.version = 2
	g3, err := engine.GetGraph(ctx, "f-1", 2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if loader.calls != 2 {
		t.Errorf("loader.calls = %d, want 2", loader.calls)
	}
	if g3.Version != 2 {
		t.Errorf("g3.Version = %d, want 2", g3.Version)
	}

	// Invalidate familyID clears all versions from cache
	engine.Invalidate("f-1")
	_, err = engine.GetGraph(ctx, "f-1", 2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if loader.calls != 3 {
		t.Errorf("loader.calls = %d, want 3", loader.calls)
	}
}

func TestEngine_DepthCap(t *testing.T) {
	// Build a 15-generation chain
	var members []model.Member
	var pc []model.ParentChild

	for i := 1; i <= 15; i++ {
		id := fmt.Sprintf("m-%d", i)
		members = append(members, model.Member{
			ID:              id,
			FamilyID:        "f-deep",
			FullName:        fmt.Sprintf("Người %d", i),
			Gender:          model.GenderMale,
			GenerationIndex: i,
			IsLiving:        true,
		})
		if i > 1 {
			pc = append(pc, model.ParentChild{
				ParentID: fmt.Sprintf("m-%d", i-1),
				ChildID:  id,
			})
		}
	}

	g := NewGraph("f-deep", 1, members, pc, nil)
	engine := NewEngine(nil)

	// Distance between m-1 and m-14 is 13 (> 12 depth cap for blood LCA)
	// Ancestor search depth cap is 12, so m-1 won't be reachable from m-14 via parent BFS
	res, err := engine.Calculate(g, "m-14", "m-1", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Since depth cap is 12, blood LCA is not found; and there are no spouse edges,
	// so it falls back to disconnected
	if res.Term != "Không xác định được quan hệ" {
		t.Errorf("res.Term = %q, want 'Không xác định được quan hệ'", res.Term)
	}

	// Distance between m-1 and m-12 is 11 (within 12 cap)
	resWithinCap, err := engine.Calculate(g, "m-12", "m-1", "bac")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resWithinCap.IsBlood {
		t.Errorf("resWithinCap.IsBlood = false, want true")
	}
	if resWithinCap.GenerationDistance != 11 {
		t.Errorf("resWithinCap.GenerationDistance = %d, want 11", resWithinCap.GenerationDistance)
	}
}
