import { test, expect, type Page } from '@playwright/test';
import { demoLogin } from '../helpers/auth';

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
 * - Grandson discovery: GET /api/v1/members (public) returns items with
 *   { id, full_name, generation_index, parent_ids, family_id }. The grandson
 *   is the generation-3 member whose parent_ids chain leads to
 *   aaaaaaa1-0000-4000-8000-000000000001 (An). The demo session cookie rides
 *   along on page.request automatically.
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

interface MembersPage {
  items?: MemberItem[];
}

async function fetchMembers(page: Page): Promise<MemberItem[]> {
  const resp = await page.request.get('/api/v1/members?limit=100');
  expect(resp.ok()).toBeTruthy();
  const body = (await resp.json()) as MembersPage;
  return body.items ?? [];
}

/** Pick the generation-3 member whose parent chain leads to the root An. */
async function discoverGrandson(page: Page): Promise<MemberItem> {
  const items = await fetchMembers(page);
  const byId = new Map(items.map((m) => [m.id, m]));

  // Walk up from each generation-3 candidate; keep the one whose ancestor
  // chain contains the root (An).
  const hasAncestralPathToRoot = (start: MemberItem): boolean => {
    const seen = new Set<string>();
    const stack = [...(start.parent_ids ?? [])];
    while (stack.length) {
      const cur = stack.pop() as string;
      if (cur === ROOT_ID) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      const parent = byId.get(cur);
      if (parent?.parent_ids?.length) stack.push(...parent.parent_ids);
    }
    return false;
  };

  const grandson = items.find(
    (m) => m.generation_index === 3 && m.id !== ROOT_ID && hasAncestralPathToRoot(m),
  );
  expect(grandson, 'a generation-3 descendant of An must exist in the seed data').toBeTruthy();
  return grandson!;
}

test.describe('Journey 2 — Xưng hô (Kinship)', () => {
  test('grandson calling Nguyễn Văn An yields exactly "Ông nội" / Cách 2 đời / Chi nội', async ({ page }) => {
    // 1. Demo session
    await demoLogin(page);

    // 2. Open kinship view
    await page.goto('/kinship');

    // 3. Discover the grandson via the public members API
    const grandson = await discoverGrandson(page);
    expect(grandson.full_name).not.toBe('');

    // 4. Select source (grandson) and target (An) through the real pickers.
    //    Term semantics: term = what picker-1 calls picker-2 → grandson first.
    const picker1 = page.locator('[data-testid="picker-input-1"]');
    const picker2 = page.locator('[data-testid="picker-input-2"]');

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
