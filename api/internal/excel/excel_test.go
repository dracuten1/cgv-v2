package excel

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/xuri/excelize/v2"
)

func TestExcel_TemplateHeaders(t *testing.T) {
	data, err := Template()
	if err != nil {
		t.Fatalf("Template() error: %v", err)
	}

	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("excelize.OpenReader error: %v", err)
	}
	defer f.Close()

	rows, err := f.GetRows(f.GetSheetList()[0])
	if err != nil {
		t.Fatalf("GetRows error: %v", err)
	}

	if len(rows) < 2 {
		t.Fatalf("expected at least 2 rows (header + example), got %d", len(rows))
	}

	headerRow := rows[0]
	if len(headerRow) != 9 {
		t.Fatalf("expected exactly 9 columns, got %d", len(headerRow))
	}

	for i, expected := range ExportHeaders {
		if headerRow[i] != expected {
			t.Errorf("header col %d = %q, want %q", i+1, headerRow[i], expected)
		}
	}
}

func TestExcel_Roundtrip(t *testing.T) {
	// Build test data
	t1 := time.Date(1950, 5, 20, 0, 0, 0, 0, time.UTC)
	t2 := time.Date(1952, 8, 15, 0, 0, 0, 0, time.UTC)
	t3 := time.Date(1975, 12, 1, 0, 0, 0, 0, time.UTC)
	t4 := time.Date(2020, 1, 10, 0, 0, 0, 0, time.UTC)

	notes1 := "Tổ phụ"
	members := []model.Member{
		{
			ID:              "id-an",
			FamilyID:        "f-1",
			FullName:        "Nguyễn Văn An",
			Gender:          model.GenderMale,
			GenerationIndex: 1,
			BirthDate:       &t1,
			IsLiving:        true,
			Notes:           &notes1,
		},
		{
			ID:              "id-mai",
			FamilyID:        "f-1",
			FullName:        "Trần Thị Mai",
			Gender:          model.GenderFemale,
			GenerationIndex: 1,
			BirthDate:       &t2,
			DeathDate:       &t4,
			IsLiving:        false,
		},
		{
			ID:              "id-binh",
			FamilyID:        "f-1",
			FullName:        "Nguyễn Văn Bình",
			Gender:          model.GenderMale,
			GenerationIndex: 2,
			BirthDate:       &t3,
			IsLiving:        true,
		},
	}

	pc := []model.ParentChild{
		{ParentID: "id-an", ChildID: "id-binh"},
		{ParentID: "id-mai", ChildID: "id-binh"},
	}

	sp := []model.Spouse{
		{MemberA: "id-an", MemberB: "id-mai"},
	}

	// 1. Export to Excel bytes
	data, err := Export(members, pc, sp)
	if err != nil {
		t.Fatalf("Export() error: %v", err)
	}

	// Test writing to temp dir
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "export_test.xlsx")
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		t.Fatalf("WriteFile error: %v", err)
	}

	// Read file back from disk
	readData, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("ReadFile error: %v", err)
	}

	// 2. Parse staged import
	staged, err := Parse(readData)
	if err != nil {
		t.Fatalf("Parse() error: %v", err)
	}

	if len(staged.Errors) > 0 {
		t.Fatalf("Parse() unexpected errors: %v", staged.Errors)
	}

	if len(staged.Members) != 3 {
		t.Fatalf("parsed members count = %d, want 3", len(staged.Members))
	}

	// Check INV-03 roundtrip:
	// An: Male -> "Nam" in Excel -> GenderMale
	// Mai: Female -> "Nữ" in Excel -> GenderFemale
	mAn := staged.Members[0]
	if mAn.FullName != "Nguyễn Văn An" || mAn.Gender != model.GenderMale {
		t.Errorf("mAn = %+v, want Male", mAn)
	}
	if mAn.BirthDate == nil || mAn.BirthDate.Format("02/01/2006") != "20/05/1950" {
		t.Errorf("mAn.BirthDate = %v, want 20/05/1950", mAn.BirthDate)
	}
	if !mAn.IsLiving {
		t.Errorf("mAn.IsLiving = false, want true")
	}

	mMai := staged.Members[1]
	if mMai.FullName != "Trần Thị Mai" || mMai.Gender != model.GenderFemale {
		t.Errorf("mMai = %+v, want Female", mMai)
	}
	if mMai.IsLiving {
		t.Errorf("mMai.IsLiving = true, want false")
	}

	// Check ParentChild edges:
	// Binh has parents An and Mai
	if len(staged.ParentChildEdges) != 2 {
		t.Fatalf("ParentChildEdges count = %d, want 2", len(staged.ParentChildEdges))
	}

	// Check Spouse edges:
	if len(staged.SpousesEdges) != 1 {
		t.Fatalf("SpousesEdges count = %d, want 1", len(staged.SpousesEdges))
	}
}

func TestExcel_GenderCasingMatrix(t *testing.T) {
	// Create Excel sheet with various gender casings
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Gia phả"
	f.SetSheetName("Sheet1", sheet)

	for colIdx, h := range ExportHeaders {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		_ = f.SetCellValue(sheet, cell, h)
	}

	testRows := [][]string{
		{"Người 1", "nam", "1", "01/01/1990", "", "", "", "Còn sống", ""},
		{"Người 2", "NAM", "1", "01/01/1991", "", "", "", "Còn sống", ""},
		{"Người 3", "Nữ", "1", "01/01/1992", "", "", "", "Còn sống", ""},
		{"Người 4", "NỮ", "1", "01/01/1993", "", "", "", "Còn sống", ""},
		{"Người 5", "nu", "1", "01/01/1994", "", "", "", "Còn sống", ""},
		{"Người 6", "NU", "1", "01/01/1995", "", "", "", "Còn sống", ""},
	}

	for rIdx, r := range testRows {
		for cIdx, val := range r {
			cell, _ := excelize.CoordinatesToCellName(cIdx+1, rIdx+2)
			_ = f.SetCellValue(sheet, cell, val)
		}
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		t.Fatalf("Write buffer error: %v", err)
	}

	staged, err := Parse(buf.Bytes())
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	if len(staged.Errors) > 0 {
		t.Fatalf("Parse unexpected errors: %v", staged.Errors)
	}

	if len(staged.Members) != 6 {
		t.Fatalf("parsed members = %d, want 6", len(staged.Members))
	}

	if staged.Members[0].Gender != model.GenderMale || staged.Members[1].Gender != model.GenderMale {
		t.Errorf("expected male for rows 1 and 2")
	}
	if staged.Members[2].Gender != model.GenderFemale || staged.Members[3].Gender != model.GenderFemale || staged.Members[4].Gender != model.GenderFemale {
		t.Errorf("expected female for rows 3, 4, 5")
	}
}

func TestExcel_InvalidGenderCitesRow(t *testing.T) {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Gia phả"
	f.SetSheetName("Sheet1", sheet)

	for colIdx, h := range ExportHeaders {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		_ = f.SetCellValue(sheet, cell, h)
	}

	_ = f.SetCellValue(sheet, "A2", "Người Hợp Lệ")
	_ = f.SetCellValue(sheet, "B2", "Nam")

	_ = f.SetCellValue(sheet, "A3", "Người Giới Tính Sai")
	_ = f.SetCellValue(sheet, "B3", "Không Biết")

	var buf bytes.Buffer
	_ = f.Write(&buf)

	staged, err := Parse(buf.Bytes())
	if err != nil {
		t.Fatalf("unexpected Parse error: %v", err)
	}

	if len(staged.Errors) == 0 {
		t.Fatalf("expected errors for row 3, got none")
	}

	foundRow3Error := false
	for _, e := range staged.Errors {
		if strings.Contains(e, "Dòng 3") && strings.Contains(e, "Giới tính") {
			foundRow3Error = true
			break
		}
	}
	if !foundRow3Error {
		t.Errorf("expected error citing 'Dòng 3' and 'Giới tính', got %v", staged.Errors)
	}
}

func TestExcel_SerialVsStringDates(t *testing.T) {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Gia phả"
	f.SetSheetName("Sheet1", sheet)

	for colIdx, h := range ExportHeaders {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		_ = f.SetCellValue(sheet, cell, h)
	}

	// Row 2: String date "25/12/1985"
	_ = f.SetCellValue(sheet, "A2", "Người Ngày Chuỗi")
	_ = f.SetCellValue(sheet, "B2", "Nam")
	_ = f.SetCellValue(sheet, "D2", "25/12/1985")

	// Row 3: Excel serial date 31406 (1985-12-25 in Excel serial)
	_ = f.SetCellValue(sheet, "A3", "Người Ngày Serial")
	_ = f.SetCellValue(sheet, "B3", "Nữ")
	_ = f.SetCellValue(sheet, "D3", 31406)

	var buf bytes.Buffer
	_ = f.Write(&buf)

	staged, err := Parse(buf.Bytes())
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	if len(staged.Errors) > 0 {
		t.Fatalf("unexpected errors: %v", staged.Errors)
	}

	if len(staged.Members) != 2 {
		t.Fatalf("parsed members = %d, want 2", len(staged.Members))
	}

	d1 := staged.Members[0].BirthDate
	d2 := staged.Members[1].BirthDate
	if d1 == nil || d1.Format("02/01/2006") != "25/12/1985" {
		t.Errorf("d1 = %v, want 25/12/1985", d1)
	}
	if d2 == nil || d2.Format("02/01/2006") != "25/12/1985" {
		t.Errorf("d2 = %v, want 25/12/1985", d2)
	}
}

func TestExcel_DedupWithinFile(t *testing.T) {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Gia phả"
	f.SetSheetName("Sheet1", sheet)

	for colIdx, h := range ExportHeaders {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		_ = f.SetCellValue(sheet, cell, h)
	}

	// Row 2 & Row 3 have same (full_name, birth_date)
	_ = f.SetCellValue(sheet, "A2", "Nguyễn Văn Trùng")
	_ = f.SetCellValue(sheet, "B2", "Nam")
	_ = f.SetCellValue(sheet, "D2", "01/01/1990")

	_ = f.SetCellValue(sheet, "A3", "Nguyễn Văn Trùng")
	_ = f.SetCellValue(sheet, "B3", "Nam")
	_ = f.SetCellValue(sheet, "D3", "01/01/1990")

	// Row 4 has same name but different birth_date
	_ = f.SetCellValue(sheet, "A4", "Nguyễn Văn Trùng")
	_ = f.SetCellValue(sheet, "B4", "Nam")
	_ = f.SetCellValue(sheet, "D4", "02/01/1990")

	var buf bytes.Buffer
	_ = f.Write(&buf)

	staged, err := Parse(buf.Bytes())
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	if len(staged.Errors) > 0 {
		t.Fatalf("unexpected errors: %v", staged.Errors)
	}

	if staged.SkippedDuplicates != 1 {
		t.Errorf("skipped duplicates = %d, want 1", staged.SkippedDuplicates)
	}
	if len(staged.Members) != 2 {
		t.Errorf("members count = %d, want 2", len(staged.Members))
	}
}

func TestExcel_500RowsPerformance(t *testing.T) {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Gia phả"
	f.SetSheetName("Sheet1", sheet)

	for colIdx, h := range ExportHeaders {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		_ = f.SetCellValue(sheet, cell, h)
	}

	for i := 1; i <= 500; i++ {
		row := i + 1
		gender := "Nam"
		if i%2 == 0 {
			gender = "Nữ"
		}
		_ = f.SetCellValue(sheet, fmt.Sprintf("A%d", row), fmt.Sprintf("Thành Viên %d", i))
		_ = f.SetCellValue(sheet, fmt.Sprintf("B%d", row), gender)
		_ = f.SetCellValue(sheet, fmt.Sprintf("C%d", row), 1+(i%5))
		_ = f.SetCellValue(sheet, fmt.Sprintf("D%d", row), "01/01/1980")
		_ = f.SetCellValue(sheet, fmt.Sprintf("H%d", row), "Còn sống")
	}

	var buf bytes.Buffer
	_ = f.Write(&buf)
	data := buf.Bytes()

	start := time.Now()
	staged, err := Parse(data)
	duration := time.Since(start)

	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	if len(staged.Errors) > 0 {
		t.Fatalf("unexpected errors: %v", staged.Errors)
	}
	if len(staged.Members) != 500 {
		t.Fatalf("members count = %d, want 500", len(staged.Members))
	}

	// Requirement: parses < 1s
	if duration > time.Second {
		t.Errorf("parsing 500 rows took %v (> 1s)", duration)
	}
}

// ruling 2 / INV-01: Excel import with an external avatar URL (column 10)
// rejects the row citing the row number and Vietnamese error,
// while conforming /static/avatars/ paths or clean rows are accepted.
func TestExcel_AvatarURLValidation_M4(t *testing.T) {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Gia phả"
	f.SetSheetName("Sheet1", sheet)

	for colIdx, h := range ExportHeaders {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		_ = f.SetCellValue(sheet, cell, h)
	}
	// Column 10: optional Avatar URL column
	_ = f.SetCellValue(sheet, "J1", "Ảnh đại diện")

	// Row 2: Clean row with conforming bundled avatar
	_ = f.SetCellValue(sheet, "A2", "Nguyễn Văn Đẹp")
	_ = f.SetCellValue(sheet, "B2", "Nam")
	_ = f.SetCellValue(sheet, "C2", 1)
	_ = f.SetCellValue(sheet, "H2", "Còn sống")
	_ = f.SetCellValue(sheet, "J2", "/static/avatars/avatar-m1.svg")

	// Row 3: Bad row with external evil avatar URL
	_ = f.SetCellValue(sheet, "A3", "Nguyễn Văn Xấu")
	_ = f.SetCellValue(sheet, "B3", "Nam")
	_ = f.SetCellValue(sheet, "C3", 1)
	_ = f.SetCellValue(sheet, "H3", "Còn sống")
	_ = f.SetCellValue(sheet, "J3", "https://evil.example.com/a.png")

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		t.Fatalf("f.Write error: %v", err)
	}

	staged, err := Parse(buf.Bytes())
	if err != nil {
		t.Fatalf("unexpected Parse error: %v", err)
	}

	if len(staged.Errors) == 0 {
		t.Fatalf("kỳ vọng phát hiện lỗi avatar ở Row 3 nhưng không có lỗi")
	}

	foundRow3AvatarErr := false
	for _, e := range staged.Errors {
		if strings.Contains(e, "Dòng 3") && strings.Contains(e, "ảnh đại diện") {
			foundRow3AvatarErr = true
			break
		}
	}
	if !foundRow3AvatarErr {
		t.Fatalf("kỳ vọng thông báo lỗi chứa 'Dòng 3' và 'ảnh đại diện', nhận: %v", staged.Errors)
	}

	// Now verify a sheet with ONLY clean/valid rows (one with avatar, one without)
	f2 := excelize.NewFile()
	defer f2.Close()
	f2.SetSheetName("Sheet1", sheet)

	for colIdx, h := range ExportHeaders {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		_ = f2.SetCellValue(sheet, cell, h)
	}
	_ = f2.SetCellValue(sheet, "J1", "Ảnh đại diện")

	_ = f2.SetCellValue(sheet, "A2", "Nguyễn Văn Đẹp")
	_ = f2.SetCellValue(sheet, "B2", "Nam")
	_ = f2.SetCellValue(sheet, "C2", 1)
	_ = f2.SetCellValue(sheet, "H2", "Còn sống")
	_ = f2.SetCellValue(sheet, "J2", "/static/avatars/avatar-m1.svg")

	_ = f2.SetCellValue(sheet, "A3", "Trần Thị Mai")
	_ = f2.SetCellValue(sheet, "B3", "Nữ")
	_ = f2.SetCellValue(sheet, "C3", 1)
	_ = f2.SetCellValue(sheet, "H3", "Còn sống")
	_ = f2.SetCellValue(sheet, "J3", "") // empty avatar stays legal

	var buf2 bytes.Buffer
	if err := f2.Write(&buf2); err != nil {
		t.Fatalf("f2.Write error: %v", err)
	}

	staged2, err := Parse(buf2.Bytes())
	if err != nil {
		t.Fatalf("unexpected Parse error: %v", err)
	}
	if len(staged2.Errors) > 0 {
		t.Fatalf("sheet hợp lệ không được có lỗi, nhưng nhận: %v", staged2.Errors)
	}
	if len(staged2.Members) != 2 {
		t.Fatalf("kỳ vọng nhập thành công 2 thành viên, nhận %d", len(staged2.Members))
	}
	if staged2.Members[0].AvatarURL == nil || *staged2.Members[0].AvatarURL != "/static/avatars/avatar-m1.svg" {
		t.Errorf("kỳ vọng thành viên 1 có avatar /static/avatars/avatar-m1.svg, nhận %v", staged2.Members[0].AvatarURL)
	}
	if staged2.Members[1].AvatarURL != nil {
		t.Errorf("kỳ vọng thành viên 2 có nil avatar, nhận %v", *staged2.Members[1].AvatarURL)
	}
}

// M-E: Unit test pinning Excel post-commit invalidation at the service seam.
// Invalidation MUST fire after the import tx commits, and MUST NOT fire if tx fails.
type testInvalidator struct {
	invalidatedFamilies []string
}

func (ti *testInvalidator) Invalidate(familyID string) {
	ti.invalidatedFamilies = append(ti.invalidatedFamilies, familyID)
}

type testTxRunner struct {
	failTx bool
}

func (tr *testTxRunner) WithTx(ctx context.Context, fn func(ctx context.Context) error) error {
	if tr.failTx {
		return fmt.Errorf("lỗi mô phỏng transaction")
	}
	return fn(ctx)
}

type testImportRepo struct {
	failImport bool
	failBump   bool
}

func (ir *testImportRepo) ImportStaged(ctx context.Context, dbtx database.DBTX, familyID string, members []model.Member, pc []model.ParentChild, spouses []model.Spouse) error {
	if ir.failImport {
		return fmt.Errorf("lỗi import staged")
	}
	return nil
}

func (ir *testImportRepo) BumpVersion(ctx context.Context, dbtx database.DBTX, familyID string) (int64, error) {
	if ir.failBump {
		return 0, fmt.Errorf("lỗi bump version")
	}
	return 2, nil
}

func TestExcel_PostCommitInvalidation_Pin(t *testing.T) {
	// Create valid excel data
	f := excelize.NewFile()
	defer f.Close()
	sheet := "Gia phả"
	f.SetSheetName("Sheet1", sheet)
	for colIdx, h := range ExportHeaders {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		_ = f.SetCellValue(sheet, cell, h)
	}
	_ = f.SetCellValue(sheet, "A2", "Nguyễn Văn An")
	_ = f.SetCellValue(sheet, "B2", "Nam")
	_ = f.SetCellValue(sheet, "C2", 1)
	_ = f.SetCellValue(sheet, "H2", "Còn sống")

	var buf bytes.Buffer
	_ = f.Write(&buf)
	data := buf.Bytes()

	familyID := "fam-test-123"

	// Sub-test 1: Successful import triggers Invalidate exactly once AFTER commit
	inv := &testInvalidator{}
	txm := &testTxRunner{failTx: false}
	repo := &testImportRepo{}
	svc := NewService(nil, repo, txm, inv)

	summary, err := svc.ImportFamily(context.Background(), familyID, data)
	if err != nil {
		t.Fatalf("kỳ vọng import thành công, nhận err=%v", err)
	}
	if summary.Created != 1 {
		t.Fatalf("kỳ vọng created = 1, nhận %d", summary.Created)
	}
	if len(inv.invalidatedFamilies) != 1 || inv.invalidatedFamilies[0] != familyID {
		t.Fatalf("kỳ vọng Invalidate được gọi đúng 1 lần cho family %s, nhận: %v", familyID, inv.invalidatedFamilies)
	}

	// Sub-test 2: Failed transaction does NOT trigger Invalidate
	inv2 := &testInvalidator{}
	txm2 := &testTxRunner{failTx: true}
	svc2 := NewService(nil, repo, txm2, inv2)

	summary2, err2 := svc2.ImportFamily(context.Background(), familyID, data)
	if err2 == nil {
		t.Fatalf("kỳ vọng lỗi khi transaction thất bại")
	}
	if len(inv2.invalidatedFamilies) != 0 {
		t.Fatalf("kỳ vọng KHÔNG gọi Invalidate khi transaction lỗi, nhưng đã gọi: %v (summary=%+v)", inv2.invalidatedFamilies, summary2)
	}

	// Sub-test 3: Validation failure in Parse does NOT trigger Invalidate
	inv3 := &testInvalidator{}
	txm3 := &testTxRunner{failTx: false}
	svc3 := NewService(nil, repo, txm3, inv3)

	badData := []byte("not an excel file")
	_, err3 := svc3.ImportFamily(context.Background(), familyID, badData)
	if err3 == nil {
		t.Fatalf("kỳ vọng lỗi parse khi dữ liệu không phải excel")
	}
	if len(inv3.invalidatedFamilies) != 0 {
		t.Fatalf("kỳ vọng KHÔNG gọi Invalidate khi parse lỗi, nhưng đã gọi: %v", inv3.invalidatedFamilies)
	}
}
