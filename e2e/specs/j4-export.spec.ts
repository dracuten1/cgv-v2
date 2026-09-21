import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { demoLogin } from '../helpers/auth';

/**
 * Journey 4: Excel export — round-trip through the real download.
 *
 * Grounded in web/src + api/src:
 * - TreeView.vue renders ExcelPanel once a family is selected (single seed
 *   family "Gia phả họ Nguyễn Văn" auto-selects). Export button:
 *   data-testid="excel-export" text "Xuất Excel".
 * - ExcelPanel.onExport() fetches the file as a blob and clicks a synthetic
 *   <a download> anchor — Playwright surfaces that as a 'download' event.
 *   Endpoint: GET /api/v1/families/:id/export.xlsx (public).
 * - export.go dictates the EXACT 9 Vietnamese header cells:
 *   Họ và tên | Giới tính | Đời | Ngày sinh | Ngày mất | Cha mẹ | Vợ/Chồng | Còn sống | Ghi chú
 *   (api/internal/excel/export.go ExportHeaders — asserted verbatim below).
 * - INV-03: the Giới tính column contains ONLY "Nam"/"Nữ" (ToVN mapping).
 * - Seed invariant: patriarch row "Nguyễn Văn An" exists with "Nam".
 */

const EXPECTED_HEADERS = [
  'Họ và tên',
  'Giới tính',
  'Đời',
  'Ngày sinh',
  'Ngày mất',
  'Cha mẹ',
  'Vợ/Chồng',
  'Còn sống',
  'Ghi chú',
];

test.describe('Journey 4 — Xuất Excel', () => {
  test('exports an .xlsx with the 9 dictated Vietnamese headers, Nam/Nữ genders, and the An row', async ({ page }) => {
    // 1. Demo session → tree view (Excel UI lives on /tree)
    await demoLogin(page);
    await page.goto('/tree');
    await expect(page.locator('[data-testid="tree-loading"]')).toHaveCount(0);

    // 2. Trigger the export through the real button and capture the download
    const exportBtn = page.locator('[data-testid="excel-export"]');
    await expect(exportBtn).toBeVisible();

    const artifactsDir = path.resolve(process.cwd(), 'artifacts');
    fs.mkdirSync(artifactsDir, { recursive: true });
    const targetPath = path.join(artifactsDir, 'j4-export.xlsx');

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      exportBtn.click(),
    ]);
    await download.saveAs(targetPath);

    // 3. Parse the workbook with the `xlsx` dev-dependency (Node side)
    const workbook = XLSX.readFile(targetPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    expect(sheet, 'workbook must contain a sheet').toBeTruthy();

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    expect(rows.length, 'sheet must have a header row plus data rows').toBeGreaterThan(1);

    // 4. Header row must match the 9 dictated Vietnamese headers EXACTLY
    const headerRow = (rows[0] as unknown[]).map((c) => String(c ?? ''));
    expect(headerRow).toEqual(EXPECTED_HEADERS);

    // 5. INV-03: gender column (index 1) contains ONLY "Nam" / "Nữ"
    const seenGenders = new Set<string>();
    for (let i = 1; i < rows.length; i++) {
      const gender = String((rows[i] as unknown[])[1] ?? '').trim();
      if (gender === '') continue; // trailing sparse rows tolerated
      seenGenders.add(gender);
    }
    expect(seenGenders.size).toBeGreaterThan(0);
    for (const g of seenGenders) {
      expect(['Nam', 'Nữ']).toContain(g);
    }

    // 6. The patriarch row exists with gender "Nam"
    const anRow = rows.find(
      (r) => String((r as unknown[])[0] ?? '').trim() === 'Nguyễn Văn An',
    ) as unknown[] | undefined;
    expect(anRow, 'Nguyễn Văn An row must exist in the export').toBeTruthy();
    expect(String(anRow![1]).trim()).toBe('Nam');
  });
});
