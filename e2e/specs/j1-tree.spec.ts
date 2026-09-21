import { test, expect } from '@playwright/test';
import { loginViaMock } from '../helpers/auth';

/**
 * Journey 1: Tree visualizer & generation navigation.
 *
 * Real DOM layout (from web/src):
 * - TreeView.vue renders an h1 with data-testid="tree-family-name"
 * - Member nodes (TreeNodeCard.vue) render an accessible button whose
 *   aria-label is "${m.full_name}, Đời thứ ${m.generation_index}". Below 0.6x
 *   zoom the card collapses to a 14px dot marker (no visible name text);
 *   the accessible name is present in BOTH modes.
 * - Generation headings:
 *   1. Generation filter chips (TreeView.vue: data-testid="filter-gen-N"):
 *      each chip has textContent "Đời thứ N (count)".
 *   2. Layout band headers (TreeVisualizer.vue):
 *      rendered above each generation lane with text "Đời thứ N".
 *
 * Assertions:
 * - Patriarch "Nguyễn Văn An" visible in tree immediately.
 * - Exact-diacritic headings "Đời thứ 1" through "Đời thứ 5" all visible.
 */
test.describe('Journey 1 — Cây gia phả (Tree visualizer)', () => {
  test('renders patriarch Nguyễn Văn An and all 5 generation headings', async ({ page }) => {
    // 1. Enter via mock session
    // demo login blocked by app bug (iss/is_demo mismatch, jwt.go:41+94) — mock login per leader contract
    await loginViaMock(page);

    // 2. Navigate to /tree (or click desktop nav "Gia phả")
    if (!page.url().includes('/tree')) {
      await page.goto('/tree');
    }

    // 3. Wait for tree to load (not loading, not error)
    await expect(page.locator('[data-testid="tree-loading"]')).toHaveCount(0);

    // Patriarch must be visible immediately. TreeNodeCard renders either the
    // full card (zoom >= 0.6x) or a collapsed 14px dot marker — BOTH carry the
    // accessible name "${full_name}, Đời thứ ${generation_index}" (aria-label);
    // the visible <p> name text only exists in full-card mode. Assert via the
    // accessible name so the check is zoom-independent (exact name + generation).
    const patriarch = page.getByRole('button', { name: 'Nguyễn Văn An, Đời thứ 1' });
    await expect(patriarch).toBeVisible();

    // 4. Assert all 5 generations are visible with exact Vietnamese diacritics.
    // We check both the generation filter chip strip and the live DOM headings.
    for (let gen = 1; gen <= 5; gen++) {
      const headingText = `Đời thứ ${gen}`;

      // (a) Generation filter chip has data-testid="filter-gen-N" and starts with "Đời thứ N"
      const chip = page.locator(`[data-testid="filter-gen-${gen}"]`);
      await expect(chip).toBeVisible();
      const chipText = (await chip.textContent()) || '';
      expect(chipText).toContain(headingText);

      // (b) Live DOM textContent matching the exact heading
      const liveHeading = page.getByText(headingText, { exact: false }).first();
      await expect(liveHeading).toBeVisible();
    }
  });
});
