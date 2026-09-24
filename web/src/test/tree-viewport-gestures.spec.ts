import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import {
  useTreeViewport,
  TAP_DISTANCE_PX,
  TAP_DURATION_MS,
} from '@/composables/useTreeViewport';

// jsdom has no PointerEvent constructor / element geometry — drive the
// composable with minimal fake events (all handlers only read coords/ids).
function fakeElement(rect: { left: number; top: number; width: number; height: number }) {
  return {
    getBoundingClientRect: () => rect,
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    // F1: viewport/canvas surface — closest('button') returns null so the
    // button-guard in onPointerDown does NOT short-circuit on canvas drags.
    closest: vi.fn(() => null),
  } as unknown as HTMLElement;
}

function fakePointerEvent(
  pointerId: number,
  clientX: number,
  clientY: number,
  currentTarget: HTMLElement,
  target?: Element | null
): PointerEvent {
  return {
    pointerId,
    clientX,
    clientY,
    currentTarget,
    target,
    preventDefault: vi.fn(),
  } as unknown as PointerEvent;
}

function fakeWheel(clientX: number, clientY: number, deltaY: number): WheelEvent {
  return {
    clientX,
    clientY,
    deltaY,
    preventDefault: vi.fn(),
  } as unknown as WheelEvent;
}

describe('useTreeViewport — gesture math (Arch §7.2)', () => {
  let nowMs: number;
  let container = ref<HTMLElement | null>(null);

  beforeEach(() => {
    nowMs = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    container = ref(fakeElement({ left: 0, top: 0, width: 1000, height: 800 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeViewport(onTap?: (x: number, y: number) => void) {
    return useTreeViewport(container, { onTap });
  }

  it('pans with a single pointer drag (translate deltas)', () => {
    const vp = makeViewport();
    const el = container.value!;

    // target = the canvas/viewport surface (closest('button') → null) → guard
    // is bypassed, setPointerCapture fires, pan state is armed.
    vp.onPointerDown(fakePointerEvent(1, 400, 300, el, el));
    expect(el.setPointerCapture).toHaveBeenCalledWith(1);
    vp.onPointerMove(fakePointerEvent(1, 450, 330, el)); // +50, +30
    expect(vp.transform.tx).toBe(50);
    expect(vp.transform.ty).toBe(30);

    vp.onPointerUp(fakePointerEvent(1, 450, 330, el));
    expect(vp.gesturing.value).toBe(false);
  });

  // F1 (2026-09-24): pointerdown whose target is a <button> (or a descendant
  // of one) must NOT call setPointerCapture and must NOT start a pan — the
  // native pointerdown→click sequence must reach the button so @click
  // handlers on the in-viewport controls (compass, zoom-in/out, fit-view)
  // actually fire.
  it('F1: pointerdown on a <button> does NOT capture pointer and does NOT start pan', () => {
    const vp = makeViewport();
    const el = container.value!;
    const btn = document.createElement('button');
    // event.target === the button itself (e.g. zoom-in / fit-view)
    const ev = fakePointerEvent(1, 400, 300, el, btn);

    vp.onPointerDown(ev);

    expect(el.setPointerCapture).not.toHaveBeenCalled();
    expect(vp.gesturing.value).toBe(false);

    // Even if a stray pointermove arrives (e.g. user holds + drags off the
    // button), the transform must not move because no pan was armed.
    vp.onPointerMove(fakePointerEvent(1, 500, 400, el, btn));
    expect(vp.transform.tx).toBe(0);
    expect(vp.transform.ty).toBe(0);
  });

  it('F1: pointerdown on a descendant of a <button> is also guarded', () => {
    const vp = makeViewport();
    const el = container.value!;
    const btn = document.createElement('button');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    btn.appendChild(svg);
    // event.target === the svg, which is inside a <button> (fit-view's icon)
    const ev = fakePointerEvent(1, 400, 300, el, svg);

    vp.onPointerDown(ev);

    expect(el.setPointerCapture).not.toHaveBeenCalled();
    expect(vp.gesturing.value).toBe(false);
  });

  it('treats a still, short press as a TAP (dist < 6px, duration < 250ms)', () => {
    const onTap = vi.fn();
    const vp = makeViewport(onTap);
    const el = container.value!;

    vp.onPointerDown(fakePointerEvent(1, 400, 300, el));
    // tiny jitter within tap threshold
    vp.onPointerMove(fakePointerEvent(1, 403, 302, el)); // dist ≈ 3.6 < 6
    nowMs = 120; // < 250ms
    vp.onPointerUp(fakePointerEvent(1, 403, 302, el));

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith(403, 302, expect.anything());
  });

  it('does NOT fire tap when movement exceeds 6px (it was a pan)', () => {
    const onTap = vi.fn();
    const vp = makeViewport(onTap);
    const el = container.value!;

    vp.onPointerDown(fakePointerEvent(1, 400, 300, el));
    vp.onPointerMove(fakePointerEvent(1, 400 + TAP_DISTANCE_PX + 5, 300, el));
    nowMs = 100;
    vp.onPointerUp(fakePointerEvent(1, 406 + TAP_DISTANCE_PX, 300, el));

    expect(onTap).not.toHaveBeenCalled();
  });

  it('does NOT fire tap when the press lasts ≥ 250ms (long press)', () => {
    const onTap = vi.fn();
    const vp = makeViewport(onTap);
    const el = container.value!;

    vp.onPointerDown(fakePointerEvent(1, 400, 300, el));
    nowMs = TAP_DURATION_MS + 50; // too slow → long press
    vp.onPointerUp(fakePointerEvent(1, 400, 300, el));

    expect(onTap).not.toHaveBeenCalled();
  });

  it('wheel zoom is centered on the cursor (world point under cursor stays fixed)', () => {
    const vp = makeViewport();

    // cursor at (500, 400); initial: zoom 1, tx 0, ty 0 → world (500, 400)
    vp.onWheel(fakeWheel(500, 400, -200)); // zoom in

    const z = vp.transform.zoom;
    expect(z).toBeGreaterThan(1);
    const worldX = (500 - vp.transform.tx) / z;
    const worldY = (400 - vp.transform.ty) / z;
    expect(worldX).toBeCloseTo(500, 5);
    expect(worldY).toBeCloseTo(400, 5);
  });

  it('wheel zoom respects max zoom clamp', () => {
    const vp = makeViewport();
    vp.onWheel(fakeWheel(500, 400, -100000));
    expect(vp.transform.zoom).toBeLessThanOrEqual(3);
  });

  it('pinch zoom (2 pointers) scales from baseline and keeps anchoring', () => {
    const vp = makeViewport();
    const el = container.value!;

    vp.onPointerDown(fakePointerEvent(1, 400, 400, el));
    vp.onPointerDown(fakePointerEvent(2, 600, 400, el)); // baseline dist = 200

    // spread to dist = 400 → zoom doubles
    vp.onPointerMove(fakePointerEvent(1, 300, 400, el));
    vp.onPointerMove(fakePointerEvent(2, 700, 400, el));

    expect(vp.transform.zoom).toBeCloseTo(2, 5);

    vp.onPointerUp(fakePointerEvent(2, 700, 400, el));
    vp.onPointerUp(fakePointerEvent(1, 300, 400, el));
    // no phantom tap after a pinch
    expect(vp.gesturing.value).toBe(false);
  });

  it('pointercancel releases gesture state without tap', () => {
    const onTap = vi.fn();
    const vp = makeViewport(onTap);
    const el = container.value!;

    vp.onPointerDown(fakePointerEvent(1, 400, 300, el));
    vp.onPointerCancel(fakePointerEvent(1, 400, 300, el));

    expect(onTap).not.toHaveBeenCalled();
    expect(vp.gesturing.value).toBe(false);
  });

  it('panBy(dx, dy) adjusts transform.tx and transform.ty', () => {
    const vp = makeViewport();
    vp.setTransform(1.5, 100, 200);
    vp.panBy(50, -30);
    expect(vp.transform.zoom).toBe(1.5);
    expect(vp.transform.tx).toBe(150);
    expect(vp.transform.ty).toBe(170);
  });

  it('worldViewport() inverts the transform into world coordinates', () => {
    const vp = makeViewport();
    vp.setTransform(2, -100, -200); // zoom 2x, panned

    const wv = vp.worldViewport();
    expect(wv.x).toBeCloseTo(50, 5); // 100/2
    expect(wv.y).toBeCloseTo(100, 5); // 200/2
    expect(wv.width).toBeCloseTo(500, 5); // 1000/2
    expect(wv.height).toBeCloseTo(400, 5); // 800/2
  });
});
