import { test, expect } from '@playwright/test';
import { demoLogin, loginViaMock } from '../helpers/auth';

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
 * - Maternal grandparents "Lê Văn Khải" and "Hoàng Thị Phượng" visible
 *   (F5 — both Gen-1 couples render side-by-side per D1; ordering may
 *   be L/R or R/L depending on layout determinism).
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

    // F5: tier-1 must render BOTH root couples (paternal + maternal) so the
    // reference-design dual-couple element is exercised. Both maternal
    // grandparents are Gen 1 in Family 1 (seed fixture.go, IDs
    // aaaaaaa1-…-000000000018 / 000000000019). Assert by accessible name only
    // — keeps the check zoom-independent and ordering-agnostic.
    const maternalGrandfather = page.getByRole('button', { name: 'Lê Văn Khải, Đời thứ 1' });
    await expect(maternalGrandfather).toBeVisible();
    const maternalGrandmother = page.getByRole('button', { name: 'Hoàng Thị Phượng, Đời thứ 1' });
    await expect(maternalGrandmother).toBeVisible();

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

  test('renders patriarch Nguyễn Văn An and all 5 generation headings (demo login)', async ({ page }) => {
    // 1. Enter via demo session — dev-mode dual-issuer relaxation (jwt.go:105-108, 1cb4fd7)
    // accepts demo-issuer tokens minted by the dev-mode service.
    await demoLogin(page);

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

  /**
   * Executable "Tôi" Identity & Kinship Journey (Task 4.2 / Leader Ruling K4 & M13):
   * 1. Mock (non-demo) login via helper.
   * 2. Bind authenticated user to seed member Nguyễn Văn Bình (Generation 3: bbbbbbb2-0000-4000-8000-000000000002).
   * 3. Reload /tree.
   * 4. Assert "Tôi" badge rendered on self card with text "Tôi".
   * 5. Assert self card button has highlight ring "ring-tree-self-ring".
   * 6. Assert auto-centering fired to focus viewport on "Tôi" node (data-view-centered="self").
   * 7. Assert Compass navigation control visible and functional (clicking North moves canvas transform).
   * 8. Assert Kinship badges appear on related ancestor nodes (e.g. "Bố" / "Nội").
   */
  test('authenticates non-demo user, binds to Gen-3 member, verifies "Tôi" identity, auto-centering, compass, and kinship badges', async ({ page, request }) => {
    // 1. Mock non-demo login with verified email.
    // STABLE identity (original design): the fixed code maps to one durable
    // user; on re-runs the re-bind of the SAME member is idempotent
    // (auth.Service.LinkMember Rule 3 → 200). Effective only since the
    // helper replaces (not appends) the code param — see e2e/helpers/auth.ts.
    await loginViaMock(page, 'verified_email:j1-identity-test@cgp.test');

    // 2. Link authenticated user to Gen-3 grandson Nguyễn Văn Bình
    // GrandsonID: bbbbbbb2-0000-4000-8000-000000000002 (Family 1, Gen 3)
    // Cross-reference: BINH_ID = fixture.go:32 GrandsonID (Nguyễn Văn Bình) — keep in sync with seed.
    const BINH_ID = 'bbbbbbb2-0000-4000-8000-000000000002';
    // CSRF middleware (api/internal/handler/middleware.go CSRFMiddleware)
    // rejects state-changing requests without Origin/Referer; Playwright's
    // page.request sends neither — mimic a same-origin browser fetch.
    const origin = new URL(page.url()).origin;
    const linkResp = await page.request.post('/api/v1/me/member', {
      headers: { Origin: origin },
      data: { member_id: BINH_ID },
    });
    expect(linkResp.ok()).toBeTruthy();
    const linkedProfile = await linkResp.json();
    expect(linkedProfile.User.member_id).toBe(BINH_ID);

    // 3. Reload /tree to pick up the newly linked member and fetch kinship labels
    await page.goto('/tree');
    await expect(page.locator('[data-testid="tree-loading"]')).toHaveCount(0);

    // 4. Assert "Tôi" badge ([data-testid="self-badge"]) rendered with text "Tôi"
    const selfBadge = page.locator('[data-testid="self-badge"]');
    await expect(selfBadge).toBeVisible();
    await expect(selfBadge).toHaveText('Tôi');

    // 5. Assert "Tôi" card displays the blue ring highlight (ring-tree-self-ring)
    const selfCardBtn = page.getByRole('button', { name: /Nguyễn Văn Bình, Đời thứ 3/i });
    await expect(selfCardBtn).toBeVisible();
    const cardClass = await selfCardBtn.getAttribute('class');
    expect(cardClass).toContain('ring-tree-self-ring');

    // 6. Assert auto-centering fired to focus viewport around "Tôi" card
    const viewport = page.locator('.tree-viewport');
    await expect(viewport).toHaveAttribute('data-view-centered', 'self');

    // 7. Verify bottom-right Compass control is visible and functional
    const compass = page.locator('[data-testid="tree-compass"]');
    await expect(compass).toBeVisible();

    const world = page.locator('[data-testid="tree-world"]');
    const initialTransform = await world.getAttribute('style');

    // Click compass-north to pan
    const compassNorth = page.locator('[data-testid="compass-north"]');
    await expect(compassNorth).toBeVisible();
    await compassNorth.click();

    // Verify canvas world transform changed after panning
    const pannedTransform = await world.getAttribute('style');
    expect(pannedTransform).not.toEqual(initialTransform);

    // 8. Verify kinship badges ([data-testid="kinship-badge"]) appear on ancestor nodes
    // Relative to Bình (Gen 3):
    // - Patriarch An (Gen 1) is "Ông nội" (badge text "Nội", title "Ông nội")
    // - Father Kiên (Gen 2) is "Bố" (badge text "Bố", title "Bố")
    const patriarchCard = page.getByRole('button', { name: /Nguyễn Văn An, Đời thứ 1/i });
    await expect(patriarchCard).toBeVisible();
    const patriarchBadge = patriarchCard.locator('[data-testid="kinship-badge"]');
    await expect(patriarchBadge).toBeVisible();
    await expect(patriarchBadge).toHaveText('Nội');
    await expect(patriarchBadge).toHaveAttribute('title', 'Ông nội');

    const fatherCard = page.getByRole('button', { name: /Nguyễn Văn Kiên, Đời thứ 2/i });
    await expect(fatherCard).toBeVisible();
    const fatherBadge = fatherCard.locator('[data-testid="kinship-badge"]');
    await expect(fatherBadge).toBeVisible();
    await expect(fatherBadge).toHaveText('Bố');
    await expect(fatherBadge).toHaveAttribute('title', 'Bố');
  });
});
