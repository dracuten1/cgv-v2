/** Size the single connector canvas without exceeding the mobile backing-store budget. */
export function canvasBackingSize(cssWidth: number, cssHeight: number, devicePixelRatio = 1) {
  const area = Math.max(1, cssWidth * cssHeight);
  const requested = Math.min(Math.max(0.01, devicePixelRatio || 1), 2, Math.sqrt(16_000_000 / area));
  let dpr = requested;
  let width = Math.ceil(cssWidth * dpr);
  let height = Math.ceil(cssHeight * dpr);
  // Ceil rounding can exceed the cap even if the continuous area does not.
  if (width * height > 16_000_000) {
    let low = 0;
    let high = requested;
    for (let i = 0; i < 32; i++) {
      const mid = (low + high) / 2;
      if (Math.ceil(cssWidth * mid) * Math.ceil(cssHeight * mid) <= 16_000_000) low = mid;
      else high = mid;
    }
    dpr = low;
    width = Math.ceil(cssWidth * dpr);
    height = Math.ceil(cssHeight * dpr);
  }
  return { width, height, dpr };
}
