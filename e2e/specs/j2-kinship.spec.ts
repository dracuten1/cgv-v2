import { test, expect, type Page } from '@playwright/test';
import { loginViaMock } from '../helpers/auth';

/**
 * Journey 2: Kinship (Xưng hô) — Nguyễn Văn An ↔ grandson (INV-05).
 *
 * Grounded in web/src + api/src:
 * - KinshipView.vue: picker inputs data-testid="picker-input-1" /
 *   "picker-input-2", calculate button data-testid="calculate-btn",
 *   result container data-testid="kinship-result-container". Dropdown options
 *   are buttons inside the absolutely-positioned list (classes include
 *   "absolute" and "z-30"), one button per member showing full_name.
 * - KinshipResult.vue: term element data-testid="kinship-term". NOTE its CSS
 *   class kinship-term-quoted adds U+201C/U+201D around the term via
 *   ::before/::after (web/src/assets/main.css) — those are VISUAL ONLY and
 *   never appear in el.textContent, which is why this spec asserts raw
 *   textContent and separately forbids quote characters (INV-05).
 * - API direction semantics (api/internal/seed/integration_kinship_test.go):
 *   Calculate(GrandsonID, RootID) === "Ông nội" — the term is what the FIRST
 *   (from) member calls the SECOND (to) member. So the grandson is placed in
 *   picker 1 and the patriarch An in picker 2.
 * - Grandson discovery: GET /api/v1/members items do NOT carry parent_ids;
 *   the parent-child structure is public at GET /api/v1/families/:id/tree
 *   (nested `children`, same payload TreeVisualizer renders). The grandson
 *   is the first generation-3 node under root aaaaaaa1-0000-4000-8000-000000000001
 *   (An). The demo session cookie rides along on page.request automatically.
 */

const ROOT_ID = 'aaaaaaa1-0000-4000-8000-000000000001'; // Nguyễn Văn An
const ROOT_NAME = 'Nguyễn Văn An';

interface MemberItem {
  id: string;
  full_name: string;
  generation_index?: number;
  parent_ids?: string[];
  family_id?: string;
}

interface TreeNode {
  id: string;
  full_name: string;
  generation_index?: number;
  children?: TreeNode[];
}

/**
 * Pick the generation-3 descendant of the patriarch An.
 *
 * GET /api/v1/members items carry NO parent_ids (verified: keys are id,
 * full_name, gender, generation_index, family_id, dates, notes…) — the public
 * parent-child structure lives in GET /api/v1/families/:id/tree as nested
 * `children` (the same payload TreeVisualizer renders). Walk it from An's
 * root node and take the first generation-3 node (DFS).
 */
async function discoverGrandson(page: Page): Promise<MemberItem> {
  const famsResp = await page.request.get('/api/v1/families');
  expect(famsResp.ok()).toBeTruthy();
  const fams = (await famsResp.json()) as { families?: { id: string; name: string }[] };
  const family = (fams.families ?? []).find((f) => f.name === 'Gia phả họ Nguyễn Văn') ??
    fams.families?.[0];
  expect(family, 'seed family "Gia phả họ Nguyễn Văn" must exist').toBeTruthy();

  const treeResp = await page.request.get(`/api/v1/families/${family!.id}/tree`);
  expect(treeResp.ok()).toBeTruthy();
  const tree = (await treeResp.json()) as { roots?: TreeNode[] };
  const root = (tree.roots ?? []).find((r) => r.id === ROOT_ID);
  expect(root, 'patriarch An must be a root of the seed family tree').toBeTruthy();

  const stack = [...(root!.children ?? [])];
  let grandson: TreeNode | undefined;
  while (stack.length && !grandson) {
    const node = stack.shift() as TreeNode;
    stack.unshift(...(node.children ?? []));
    if (node.generation_index === 3) grandson = node;
  }
  expect(grandson, 'a generation-3 descendant of An must exist in the seed data').toBeTruthy();
  return { id: grandson!.id, full_name: grandson!.full_name };
}

test.describe('Journey 2 — Xưng hô (Kinship)', () => {
  test('grandson calling Nguyễn Văn An yields exactly "Ông nội" / Cách 2 đời / Chi nội', async ({ page }) => {
    // 1. Mock session
    // demo login blocked by app bug (iss/is_demo mismatch, jwt.go:41+94) — mock login per leader contract
    await loginViaMock(page);

    // 2. Open kinship view
    await page.goto('/kinship');

    // 3. Discover the grandson via the public members API
    const grandson = await discoverGrandson(page);
    expect(grandson.full_name).not.toBe('');

    // 4. Select source (grandson) and target (An) through the real pickers.
    //    Term semantics: term = what picker-1 calls picker-2 → grandson first.
    // AppInput attribute fallthrough puts the testid on the wrapper div;
    // the fillable <input> is nested inside it.
    const picker1 = page.locator('[data-testid="picker-input-1"] input');
    const picker2 = page.locator('[data-testid="picker-input-2"] input');

    const dropdownOption = (name: string) =>
      page.locator('.absolute.z-30 button', { hasText: name }).first();

    await picker1.click();
    await picker1.fill(grandson.full_name);
    await dropdownOption(grandson.full_name).click();

    await picker2.click();
    await picker2.fill(ROOT_NAME);
    await dropdownOption(ROOT_NAME).click();

    // 5. Calculate
    await page.locator('[data-testid="calculate-btn"]').click();
    await expect(page.locator('[data-testid="kinship-result-container"]')).toBeVisible();

    // 6. INV-05: raw textContent of the term element must be exactly "Ông nội"
    const termLocator = page.locator('[data-testid="kinship-term"]');
    const rawTerm = await termLocator.evaluate((el) => el.textContent ?? '');
    expect(rawTerm).toBe('Ông nội');

    // …and must contain NO quote characters (visual quotes are CSS-only)
    for (const q of ['"', "'", '\u201C', '\u201D']) {
      expect(rawTerm.includes(q), `term must not contain quote char ${q}`).toBe(false);
    }

    // 7. Distance badge "Cách 2 đời" and lineage "Chi nội" visible
    await expect(page.getByText('Cách 2 đời', { exact: true })).toBeVisible();
    await expect(page.getByText('Chi nội', { exact: true })).toBeVisible();
  });
});
