import { describe, expect, it } from 'vitest';
import { canvasBackingSize } from '@/components/tree/canvasBackingSize';

describe('connector canvas backing store', () => {
  it('caps DPR at 2 and backing pixels at 16M, including DPR=1 and ceil rounding', () => {
    expect(canvasBackingSize(300, 200, 3)).toMatchObject({ dpr: 2, width: 600, height: 400 });
    for (const [width, height, deviceDpr] of [[3000, 3000, 2], [5000, 4000, 1], [3999, 4001, 1.5]]) {
      const backing = canvasBackingSize(width, height, deviceDpr);
      expect(backing.width * backing.height).toBeLessThanOrEqual(16_000_000);
      expect(backing.dpr).toBeLessThanOrEqual(Math.min(deviceDpr, 2));
      expect(backing.width).toBe(Math.ceil(width * backing.dpr));
      expect(backing.height).toBe(Math.ceil(height * backing.dpr));
    }
    expect(canvasBackingSize(5000, 4000, 1).dpr).toBeLessThan(1);
  });
});
