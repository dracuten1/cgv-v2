package excel

import (
	"bytes"
	"fmt"

	"github.com/xuri/excelize/v2"
)

// Template generates an empty 9-column Excel file with headers and an example row.
func Template() ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Mẫu nhập liệu"
	f.SetSheetName("Sheet1", sheet)

	// Set headers
	for colIdx, header := range ExportHeaders {
		cell, err := excelize.CoordinatesToCellName(colIdx+1, 1)
		if err != nil {
			return nil, fmt.Errorf("không thể tạo tọa độ ô: %w", err)
		}
		if err := f.SetCellValue(sheet, cell, header); err != nil {
			return nil, fmt.Errorf("không thể ghi tiêu đề: %w", err)
		}
	}

	// Example row (Row 2)
	example := []any{
		"Nguyễn Văn An",     // Họ và tên
		"Nam",               // Giới tính
		1,                   // Đời
		"01/01/1950",        // Ngày sinh
		"",                  // Ngày mất
		"",                  // Cha mẹ
		"Trần Thị Mai",      // Vợ/Chồng
		"Còn sống",          // Còn sống
		"Thủy tổ họ Nguyễn", // Ghi chú
	}

	for colIdx, val := range example {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 2)
		_ = f.SetCellValue(sheet, cell, val)
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
		return nil, fmt.Errorf("không thể tạo mẫu Excel: %w", err)
	}

	return buf.Bytes(), nil
}
