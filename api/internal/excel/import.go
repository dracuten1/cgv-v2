package excel

import (
	"bytes"
	"crypto/rand"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/xuri/excelize/v2"
)

// StagedImport holds parsed and validated records ready for insertion.
type StagedImport struct {
	Members           []model.Member
	ParentChildEdges  []model.ParentChild
	SpousesEdges      []model.Spouse
	SkippedDuplicates int
	TotalRows         int
	Errors            []string
}

// RawRow holds the parsed string content of an Excel row.
type RawRow struct {
	RowNumber       int
	FullName        string
	GenderStr       string
	GenerationIndex int
	BirthDateStr    string
	DeathDateStr    string
	ParentsStr      string
	SpousesStr      string
	LivingStr       string
	Notes           string
}

// Parse fully parses and validates an Excel file in memory without opening a DB connection.
func Parse(data []byte) (*StagedImport, error) {
	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("không thể đọc file Excel: %w", err)
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("file Excel không có trang tính nào")
	}
	sheet := sheets[0]

	rows, err := f.GetRows(sheet)
	if err != nil {
		return nil, fmt.Errorf("không thể đọc các dòng trong trang tính: %w", err)
	}

	if len(rows) < 1 {
		return nil, fmt.Errorf("file Excel trống")
	}

	// Validate header
	headerRow := rows[0]
	if len(headerRow) < len(ExportHeaders) {
		return nil, fmt.Errorf("tiêu đề file Excel không đúng cấu trúc (yêu cầu ít nhất 9 cột theo mẫu)")
	}

	for i, expected := range ExportHeaders {
		actual := strings.TrimSpace(headerRow[i])
		if !strings.EqualFold(actual, expected) {
			return nil, fmt.Errorf("cột %d sai tiêu đề: mong muốn %q, nhận được %q", i+1, expected, actual)
		}
	}

	staged := &StagedImport{
		Members:          make([]model.Member, 0, len(rows)),
		ParentChildEdges: make([]model.ParentChild, 0),
		SpousesEdges:     make([]model.Spouse, 0),
		Errors:           make([]string, 0),
	}

	type stagedEntry struct {
		rowNum     int
		member     model.Member
		parentsRaw string
		spousesRaw string
	}

	var parsedRows []stagedEntry
	seenInFile := make(map[string]bool)
	nameToID := make(map[string]string)

	for rIdx := 1; rIdx < len(rows); rIdx++ {
		row := rows[rIdx]
		rowNum := rIdx + 1

		// Check if empty row
		isEmpty := true
		for _, cell := range row {
			if strings.TrimSpace(cell) != "" {
				isEmpty = false
				break
			}
		}
		if isEmpty {
			continue
		}

		staged.TotalRows++

		getCell := func(colIdx int) string {
			if colIdx < len(row) {
				return strings.TrimSpace(row[colIdx])
			}
			return ""
		}

		fullName := getCell(0)
		genderStr := getCell(1)
		genStr := getCell(2)
		birthStr := getCell(3)
		deathStr := getCell(4)
		parentsStr := getCell(5)
		spousesStr := getCell(6)
		livingStr := getCell(7)
		notesStr := getCell(8)

		if fullName == "" {
			staged.Errors = append(staged.Errors, fmt.Sprintf("Dòng %d, Cột 'Họ và tên': họ và tên không được để trống", rowNum))
			continue
		}

		// Gender validation via model.ParseGenderVN (INV-03)
		gender, gErr := model.ParseGenderVN(genderStr)
		if gErr != nil {
			staged.Errors = append(staged.Errors, fmt.Sprintf("Dòng %d, Cột 'Giới tính': %s", rowNum, gErr.Error()))
		}

		// Generation index
		genIndex := 1
		if genStr != "" {
			gVal, err := strconv.Atoi(genStr)
			if err != nil || gVal <= 0 {
				staged.Errors = append(staged.Errors, fmt.Sprintf("Dòng %d, Cột 'Đời': giá trị thế hệ không hợp lệ: %q", rowNum, genStr))
			} else {
				genIndex = gVal
			}
		}

		// Birth date parsing
		var birthDate *time.Time
		if birthStr != "" {
			tVal, err := parseDate(birthStr)
			if err != nil {
				staged.Errors = append(staged.Errors, fmt.Sprintf("Dòng %d, Cột 'Ngày sinh': %s", rowNum, err.Error()))
			} else {
				birthDate = tVal
			}
		}

		// Death date parsing
		var deathDate *time.Time
		if deathStr != "" {
			tVal, err := parseDate(deathStr)
			if err != nil {
				staged.Errors = append(staged.Errors, fmt.Sprintf("Dòng %d, Cột 'Ngày mất': %s", rowNum, err.Error()))
			} else {
				deathDate = tVal
			}
		}

		// Living status
		isLiving := true
		if livingStr != "" {
			switch strings.ToLower(livingStr) {
			case "còn sống", "song", "sống", "true", "1":
				isLiving = true
			case "đã mất", "da mat", "mất", "mat", "false", "0":
				isLiving = false
			default:
				staged.Errors = append(staged.Errors, fmt.Sprintf("Dòng %d, Cột 'Còn sống': giá trị không hợp lệ: %q (chỉ chấp nhận 'Còn sống' hoặc 'Đã mất')", rowNum, livingStr))
			}
		} else if deathDate != nil {
			isLiving = false
		}

		// Deduplication by (full_name, birth_date) within file
		var birthKey string
		if birthDate != nil {
			birthKey = birthDate.Format("2006-01-02")
		}
		dedupKey := strings.ToLower(fullName) + "|" + birthKey
		if seenInFile[dedupKey] {
			staged.SkippedDuplicates++
			continue
		}
		seenInFile[dedupKey] = true

		// Assign a generated UUID
		memberID := generateUUID()
		nameToID[strings.ToLower(fullName)] = memberID

		var notesPtr *string
		if notesStr != "" {
			notesPtr = &notesStr
		}

		m := model.Member{
			ID:              memberID,
			FullName:        fullName,
			Gender:          gender,
			GenerationIndex: genIndex,
			BirthDate:       birthDate,
			DeathDate:       deathDate,
			IsLiving:        isLiving,
			Notes:           notesPtr,
		}

		parsedRows = append(parsedRows, stagedEntry{
			rowNum:     rowNum,
			member:     m,
			parentsRaw: parentsStr,
			spousesRaw: spousesStr,
		})
	}

	// If there are validation errors on rows, do not proceed with edge resolution
	if len(staged.Errors) > 0 {
		return staged, nil
	}

	// Resolve parent/spouse edges
	for _, entry := range parsedRows {
		staged.Members = append(staged.Members, entry.member)

		// Resolve parents
		if entry.parentsRaw != "" {
			parentNames := splitNames(entry.parentsRaw)
			for _, pName := range parentNames {
				pID, ok := nameToID[strings.ToLower(pName)]
				if !ok {
					staged.Errors = append(staged.Errors, fmt.Sprintf("Dòng %d, Cột 'Cha mẹ': không tìm thấy người có tên %q trong file", entry.rowNum, pName))
					continue
				}
				if pID == entry.member.ID {
					staged.Errors = append(staged.Errors, fmt.Sprintf("Dòng %d, Cột 'Cha mẹ': một người không thể là cha mẹ của chính mình", entry.rowNum))
					continue
				}
				staged.ParentChildEdges = append(staged.ParentChildEdges, model.ParentChild{
					ParentID: pID,
					ChildID:  entry.member.ID,
				})
			}
		}

		// Resolve spouses
		if entry.spousesRaw != "" {
			spouseNames := splitNames(entry.spousesRaw)
			for _, spName := range spouseNames {
				spID, ok := nameToID[strings.ToLower(spName)]
				if !ok {
					staged.Errors = append(staged.Errors, fmt.Sprintf("Dòng %d, Cột 'Vợ/Chồng': không tìm thấy người có tên %q trong file", entry.rowNum, spName))
					continue
				}
				if spID == entry.member.ID {
					staged.Errors = append(staged.Errors, fmt.Sprintf("Dòng %d, Cột 'Vợ/Chồng': một người không thể kết hôn với chính mình", entry.rowNum))
					continue
				}
				least := entry.member.ID
				greatest := spID
				if least > greatest {
					least, greatest = greatest, least
				}
				staged.SpousesEdges = append(staged.SpousesEdges, model.Spouse{
					MemberA: least,
					MemberB: greatest,
				})
			}
		}
	}

	// Deduplicate spouse edges
	uniqueSpouses := make([]model.Spouse, 0, len(staged.SpousesEdges))
	seenSp := make(map[string]bool)
	for _, sp := range staged.SpousesEdges {
		key := sp.MemberA + "|" + sp.MemberB
		if !seenSp[key] {
			seenSp[key] = true
			uniqueSpouses = append(uniqueSpouses, sp)
		}
	}
	staged.SpousesEdges = uniqueSpouses

	return staged, nil
}

func splitNames(s string) []string {
	parts := strings.Split(s, ",")
	var result []string
	for _, p := range parts {
		name := strings.TrimSpace(p)
		if name != "" {
			result = append(result, name)
		}
	}
	return result
}

// parseDate accepts Excel serial number or common date formats (DD/MM/YYYY, YYYY-MM-DD, etc.)
func parseDate(s string) (*time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, nil
	}

	// Try numeric Excel serial date
	if fVal, err := strconv.ParseFloat(s, 64); err == nil && fVal > 0 {
		// Excel date serial number (day 1 is 1900-01-01)
		// Account for Excel 1900 leap year bug
		// For dates >= 60 (March 1, 1900), Excel incorrectly thinks 1900 is a leap year.
		excelEpoch := time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)
		days := math.Floor(fVal)
		if days < 60 {
			excelEpoch = time.Date(1899, 12, 31, 0, 0, 0, 0, time.UTC)
		}
		t := excelEpoch.AddDate(0, 0, int(days))
		return &t, nil
	}

	// Common string layouts
	layouts := []string{
		"02/01/2006",
		"2/1/2006",
		"02-01-2006",
		"2006-01-02",
		"2006/01/02",
		"02/01/06",
	}

	for _, layout := range layouts {
		if t, err := time.Parse(layout, s); err == nil {
			utc := t.UTC()
			return &utc, nil
		}
	}

	return nil, fmt.Errorf("định dạng ngày không hợp lệ: %q (chấp nhận DD/MM/YYYY hoặc số serial)", s)
}

func generateUUID() string {
	var b [16]byte
	_, _ = io.ReadFull(rand.Reader, b[:])
	b[6] = (b[6] & 0x0f) | 0x40 // Version 4
	b[8] = (b[8] & 0x3f) | 0x80 // Variant RFC 4122
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%12x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
