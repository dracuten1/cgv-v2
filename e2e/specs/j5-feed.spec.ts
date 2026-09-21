import { test, expect } from '@playwright/test';
import { loginViaMock } from '../helpers/auth';

/**
 * Journey 5: Bảng tin (Feed) — compose, attach image, publish, verify.
 *
 * Grounded in web/src:
 * - FeedView.vue composer (authenticated): form data-testid="composer-form"
 *   containing a textarea (placeholder "Chia sẻ câu chuyện với gia đình…"),
 *   an image-URL input (placeholder "Dán URL ảnh…", no upload endpoint —
 *   images are JSONB URL arrays) plus the "Thêm ảnh" button, and the
 *   type=submit button "Đăng bài".
 * - stores/feed.ts createPost(): POST then refetch — the new post appears
 *   at the TOP of data-testid="feed-list".
 * - PostCard.vue: author display name element data-testid="post-author"
 *   (post.author_display_name) inside each <article>.
 * - Image attachment: a same-origin http(s) image URL exercises the URL
 *   path (the API validates scheme http(s) only — data: URLs are 400).
 */

// Same-origin http(s) asset (API rejects data: URLs with 400 VALIDATION_ERROR).
const POST_IMAGE_URL = 'http://localhost:3456/static/uploads/ong-kien-tre.jpg';

test.describe('Journey 5 — Bảng tin (Feed)', () => {
  test('composes a post with a unique marker + image URL and shows it with author attribution', async ({ page }) => {
    const marker = `E2E-J5-${Date.now()}`;

    // 1. Mock session → feed view
    // demo login blocked by app bug (iss/is_demo mismatch, jwt.go:41+94) — mock login per leader contract
    await loginViaMock(page);
    await page.goto('/feed');

    // 2. The composer renders for authenticated users
    const composer = page.locator('[data-testid="composer-form"]');
    await expect(composer).toBeVisible();

    // 3. Fill content with the unique marker
    const textarea = composer.locator('textarea');
    await textarea.fill(`${marker} — câu chuyện thử nghiệm cho bảng tin dòng họ.`);

    // 4. Attach image metadata through the real URL input + "Thêm ảnh"
    const urlInput = composer.locator('input[type="url"]');
    await urlInput.fill(POST_IMAGE_URL);
    await composer.getByRole('button', { name: 'Thêm ảnh' }).click();
    // The attached image chip (truncated URL preview) appears in the composer
    await expect(composer.locator('span[title], .truncate').first()).toBeVisible();

    // 5. Submit
    await composer.getByRole('button', { name: 'Đăng bài' }).click();

    // 6. The post appears in the timeline with the marker (timeline refreshes
    //    via store refetch after create; belt-and-braces waitFor)
    const feedList = page.locator('[data-testid="feed-list"]');
    await expect(feedList).toBeVisible();
    const createdPost = feedList.locator('article', { hasText: marker }).first();
    await expect(createdPost).toBeVisible({ timeout: 15000 });

    // 7. …with author attribution (author display name element, non-empty)
    const authorEl = createdPost.locator('[data-testid="post-author"]');
    await expect(authorEl).toBeVisible();
    const authorText = ((await authorEl.textContent()) || '').trim();
    expect(authorText.length).toBeGreaterThan(0);

    // 8. The image metadata round-trips into the rendered ImageGrid
    await expect(createdPost.locator('img').first()).toHaveAttribute('src', POST_IMAGE_URL);
  });
});
