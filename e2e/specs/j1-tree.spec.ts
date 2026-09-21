import { test, expect } from '@playwright/test';
import { demoLogin } from '../helpers/auth';

/**
 * Journey 1: Tree visualizer & generation navigation.
 *
 * Real DOM layout (from web/src):
 * - TreeView.vue renders an h1 with data-testid="tree-family-name"
 * - Member cards (TreeNodeCard.vue) render an accessible button whose
 *   aria-label is "${m.full_name}, Đời thứ ${m.generation_index}". The card
 *   also renders a div with textContent equal to the member's full name.
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
    // 1. Enter via demo session
    await demoLogin(page);

    // 2. Navigate to /tree (or click desktop nav "Gia phả")
    if (!page.url().includes('/tree')) {
      await page.goto('/tree');
    }

    // 3. Wait for tree to load (not loading, not error)
    await expect(page.locator('[data-testid="tree-loading"]')).toHaveCount(0);

    // Patriarch must be visible immediately
    const patriarch = page.getByText('Nguyễn Văn An', { exact: true }).first();
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
