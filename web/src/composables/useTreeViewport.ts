/**
 * useTreeViewport — gesture composable (Arch §7.2)
 *
 * Unified Pointer Events: pan (1 pointer), pinch zoom (2 pointers),
 * wheel zoom centered on cursor (desktop), tap-vs-pan discrimination
 * (Euclidean distance < 6px within 250ms).
 *
 * Pure state math lives here; the component applies ONLY
 * translate3d(tx, ty, 0) + scale(zoom) with will-change: transform.
 * jsdom-safe: no geometry reads required for the math itself.
 */
import { reactive, ref, type Ref } from 'vue';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 3;

/** Tap discrimination thresholds (spec). */
export const TAP_DISTANCE_PX = 6;
export const TAP_DURATION_MS = 250;

export interface TransformState {
  zoom: number;
  tx: number;
  ty: number;
}

interface ActivePointer {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
}

export interface TreeViewportOptions {
  minZoom?: number;
  maxZoom?: number;
  /** fired on a true tap (not a pan) with the tap's client coords */
  onTap?: (clientX: number, clientY: number, event: PointerEvent) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function useTreeViewport(
  container: Ref<HTMLElement | null>,
  options: TreeViewportOptions = {}
) {
  const minZoom = options.minZoom ?? MIN_ZOOM;
  const maxZoom = options.maxZoom ?? MAX_ZOOM;

  const transform = reactive<TransformState>({ zoom: 1, tx: 0, ty: 0 });
  /** true while a pan/pinch gesture is in flight (used to disable card hover) */
  const gesturing = ref(false);

  const pointers = new Map<number, ActivePointer>();
  /** pinch baseline */
  let pinchStartDist = 0;
  let pinchStartZoom = 1;
  let pinchStartCenter = { x: 0, y: 0 };
  /** pan/tap baseline */
  let gestureStartTime = 0;
  let moved = false;

  function clientPoint(event: PointerEvent): { x: number; y: number } {
    return { x: event.clientX, y: event.clientY };
  }

  function pointerDist(): number {
    const pts = [...pointers.values()];
    if (pts.length < 2) return 0;
    const dx = pts[0].lastX - pts[1].lastX;
    const dy = pts[0].lastY - pts[1].lastY;
    return Math.hypot(dx, dy);
  }

  function pointerCenter(): { x: number; y: number } {
    const pts = [...pointers.values()];
    const sumX = pts.reduce((acc, p) => acc + p.lastX, 0);
    const sumY = pts.reduce((acc, p) => acc + p.lastY, 0);
    return { x: sumX / pts.length, y: sumY / pts.length };
  }

  function zoomAt(clientX: number, clientY: number, nextZoom: number): void {
    const clamped = clamp(nextZoom, minZoom, maxZoom);
    const rect = container.value?.getBoundingClientRect();
    const originX = rect ? clientX - rect.left : clientX;
    const originY = rect ? clientY - rect.top : clientY;
    // keep the world point under the cursor fixed
    const worldX = (originX - transform.tx) / transform.zoom;
    const worldY = (originY - transform.ty) / transform.zoom;
    transform.zoom = clamped;
    transform.tx = originX - worldX * clamped;
    transform.ty = originY - worldY * clamped;
  }

  function onPointerDown(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    const p = clientPoint(event);
    pointers.set(event.pointerId, {
      startX: p.x,
      startY: p.y,
      lastX: p.x,
      lastY: p.y,
    });

    if (pointers.size === 1) {
      gestureStartTime = performance.now();
      moved = false;
      gesturing.value = true;
    } else if (pointers.size === 2) {
      pinchStartDist = pointerDist();
      pinchStartZoom = transform.zoom;
      const c = pointerCenter();
      pinchStartCenter = { x: c.x, y: c.y };
    }
  }

  function onPointerMove(event: PointerEvent): void {
    const active = pointers.get(event.pointerId);
    if (!active) return;
    const p = clientPoint(event);

    if (pointers.size === 1) {
      const dx = p.x - active.lastX;
      const dy = p.y - active.lastY;
      transform.tx += dx;
      transform.ty += dy;

      const total = Math.hypot(p.x - active.startX, p.y - active.startY);
      if (total >= TAP_DISTANCE_PX) moved = true;
    } else if (pointers.size >= 2) {
      active.lastX = p.x;
      active.lastY = p.y;
      const dist = pointerDist();
      if (pinchStartDist > 0 && dist > 0) {
        const nextZoom = pinchStartZoom * (dist / pinchStartDist);
        // zoom anchored at the pinch center
        const rect = container.value?.getBoundingClientRect();
        const originX = rect ? pinchStartCenter.x - rect.left : pinchStartCenter.x;
        const originY = rect ? pinchStartCenter.y - rect.top : pinchStartCenter.y;
        const clamped = clamp(nextZoom, minZoom, maxZoom);
        const worldX = (originX - transform.tx) / transform.zoom;
        const worldY = (originY - transform.ty) / transform.zoom;
        transform.zoom = clamped;
        transform.tx = originX - worldX * clamped;
        transform.ty = originY - worldY * clamped;
      }
      moved = true;
      active.lastX = p.x;
      active.lastY = p.y;
      return;
    }

    active.lastX = p.x;
    active.lastY = p.y;
  }

  function onPointerUp(event: PointerEvent): void {
    const active = pointers.get(event.pointerId);
    if (!active) return;

    // tap discrimination: single pointer, short, near-stationary
    if (pointers.size === 1 && !moved) {
      const duration = performance.now() - gestureStartTime;
      const dist = Math.hypot(
        active.lastX - active.startX,
        active.lastY - active.startY
      );
      if (duration < TAP_DURATION_MS && dist < TAP_DISTANCE_PX) {
        options.onTap?.(active.lastX, active.lastY, event);
      }
    }

    pointers.delete(event.pointerId);
    if (pointers.size === 0) {
      gesturing.value = false;
    } else if (pointers.size === 1) {
      // downgrade pinch → pan: rebase the surviving pointer
      gestureStartTime = performance.now();
      moved = true; // avoid a phantom tap after pinch
    }
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  }

  function onPointerCancel(event: PointerEvent): void {
    pointers.delete(event.pointerId);
    if (pointers.size === 0) {
      gesturing.value = false;
    }
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0015);
    zoomAt(event.clientX, event.clientY, transform.zoom * factor);
  }

  /** Programmatic zoom (toolbar +/- buttons) centered on the viewport. */
  function zoomBy(factor: number): void {
    const rect = container.value?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 0;
    const cy = rect ? rect.height / 2 : 0;
    zoomAt(
      rect ? rect.left + cx : cx,
      rect ? rect.top + cy : cy,
      transform.zoom * factor
    );
  }

  function setTransform(zoom: number, tx: number, ty: number): void {
    transform.zoom = clamp(zoom, minZoom, maxZoom);
    transform.tx = tx;
    transform.ty = ty;
  }

  /** Viewport rect in WORLD coordinates (for culling math). */
  function worldViewport(): { x: number; y: number; width: number; height: number } {
    const rect = container.value?.getBoundingClientRect();
    const width = rect?.width || 0;
    const height = rect?.height || 0;
    return {
      x: -transform.tx / transform.zoom,
      y: -transform.ty / transform.zoom,
      width: width / transform.zoom,
      height: height / transform.zoom,
    };
  }

  return {
    transform,
    gesturing,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onWheel,
    zoomBy,
    setTransform,
    worldViewport,
  };
}
