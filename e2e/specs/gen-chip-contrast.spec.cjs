const { test, expect } = require('@playwright/test');

const base = process.env.GEN_CHIP_BASE || 'http://127.0.0.1:5173';
function luminance(rgb) {
  const channels = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!channels) throw new Error(`Expected opaque RGB color: ${rgb}`);
  const [r, g, b] = channels.slice(1).map(Number).map(v => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(fg, bg) {
  const a = luminance(fg), b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test('real AppChip generation text is AA on soft backgrounds in both schemes', async ({ page }) => {
  await page.goto(`${base}/gen-chip-contrast.html`);
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const variant of ['gen1', 'gen2', 'gen3', 'gen4']) {
      const chip = page.locator(`[data-generation="${variant}"]`);
      await expect(chip).toBeVisible();
      const colors = await chip.evaluate(el => {
        const style = getComputedStyle(el);
        return { fg: style.color, bg: style.backgroundColor, text: el.textContent };
      });
      const ratio = contrast(colors.fg, colors.bg);
      console.log(`${scheme} ${variant}: ${colors.fg} / ${colors.bg} = ${ratio.toFixed(3)}:1`);
      expect(ratio, `${scheme} ${variant}: ${JSON.stringify(colors)}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});
