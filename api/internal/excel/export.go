package excel

import (
	"bytes"
	"fmt"
	"strings"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/xuri/excelize/v2"
)

// The 9 dictated Vietnamese columns:
// Họ và tên | Giới tính | Đời | Ngày sinh | Ngày mất | Cha mẹ | Vợ/Chồng | Còn sống | Ghi chú
var ExportHeaders = []string{
	"Họ và tên",
	"Giới tính",
	"Đời",
	"Ngày sinh",
	"Ngày mất",
	"Cha mẹ",
	"Vợ/Chồng",
	"Còn sống",
	"Ghi chú",
}

// Export generates an .xlsx file containing 9 columns from members, parent-child, and spouses relations.
func Export(members []model.Member, pc []model.ParentChild, sp []model.Spouse) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Gia phả"
	f.SetSheetName("Sheet1", sheet)

	// Build ID -> Name lookup
	nameMap := make(map[string]string, len(members))
	for _, m := range members {
		nameMap[m.ID] = m.FullName
	}

	// Build parents map: childID -> []parentNames
	parentsMap := make(map[string][]string)
	for _, edge := range pc {
		if pName, ok := nameMap[edge.ParentID]; ok {
			parentsMap[edge.ChildID] = append(parentsMap[edge.ChildID], pName)
		}
	}

	// Build spouses map: memberID -> []spouseNames
	spousesMap := make(map[string][]string)
	for _, edge := range sp {
		if bName, ok := nameMap[edge.MemberB]; ok {
			spousesMap[edge.MemberA] = append(spousesMap[edge.MemberA], bName)
		}
		if aName, ok := nameMap[edge.MemberA]; ok {
			spousesMap[edge.MemberB] = append(spousesMap[edge.MemberB], aName)
		}
	}

	// Set header row
	for colIdx, header := range ExportHeaders {
		cell, err := excelize.CoordinatesToCellName(colIdx+1, 1)
		if err != nil {
			return nil, fmt.Errorf("không thể tạo tọa độ ô: %w", err)
		}
		if err := f.SetCellValue(sheet, cell, header); err != nil {
			return nil, fmt.Errorf("không thể ghi tiêu đề: %w", err)
		}
	}

	// Set data rows
	for rowIdx, m := range members {
		row := rowIdx + 2

		// 1. Họ và tên
		_ = f.SetCellValue(sheet, fmt.Sprintf("A%d", row), m.FullName)

		// 2. Giới tính (INV-03: ToVN => "Nam" / "Nữ")
		_ = f.SetCellValue(sheet, fmt.Sprintf("B%d", row), m.Gender.ToVN())

		// 3. Đời
		_ = f.SetCellValue(sheet, fmt.Sprintf("C%d", row), m.GenerationIndex)

		// 4. Ngày sinh (DD/MM/YYYY)
		birthStr := ""
		if m.BirthDate != nil {
			birthStr = m.BirthDate.Format("02/01/2006")
		}
		_ = f.SetCellValue(sheet, fmt.Sprintf("D%d", row), birthStr)

		// 5. Ngày mất (DD/MM/YYYY)
		deathStr := ""
		if m.DeathDate != nil {
			deathStr = m.DeathDate.Format("02/01/2006")
		}
		_ = f.SetCellValue(sheet, fmt.Sprintf("E%d", row), deathStr)

		// 6. Cha mẹ (comma-separated)
		pList := parentsMap[m.ID]
		_ = f.SetCellValue(sheet, fmt.Sprintf("F%d", row), strings.Join(pList, ", "))

		// 7. Vợ/Chồng (comma-separated)
		spList := spousesMap[m.ID]
		_ = f.SetCellValue(sheet, fmt.Sprintf("G%d", row), strings.Join(spList, ", "))

		// 8. Còn sống ("Còn sống" / "Đã mất")
		livingStr := "Còn sống"
		if !m.IsLiving {
			livingStr = "Đã mất"
		}
		_ = f.SetCellValue(sheet, fmt.Sprintf("H%d", row), livingStr)

		// 9. Ghi chú
		noteStr := ""
		if m.Notes != nil {
			noteStr = *m.Notes
		}
		_ = f.SetCellValue(sheet, fmt.Sprintf("I%d", row), noteStr)
	}

	// Set column widths
	colWidths := map[string]float64{
		"A": 24, // Họ và tên
		"B": 12, // Giới tính
		"C": 8,  // Đời
		"D": 15, // Ngày sinh
		"E": 15, // Ngày mất
		"F": 25, // Cha mẹ
		"G": 25, // Vợ/Chồng
		"H": 14, // Còn sống
		"I": 30, // Ghi chú
	}
	for col, width := range colWidths {
		_ = f.SetColWidth(sheet, col, col, width)
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, fmt.Errorf("không thể xuất file Excel: %w", err)
	}

	return buf.Bytes(), nil
}

// formatDate formats a *time.Time to DD/MM/YYYY
func formatDate(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format("02/01/2006")
}
