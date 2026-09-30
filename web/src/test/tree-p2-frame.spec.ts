import { describe, expect, it } from 'vitest';
import { anchorFrameTransform, canvasPersonBudget, cullVisibleNodes, layoutTree, treeLodTier } from '@/composables/useTreeLayout';
import {
  TV_FIXTURE_REGISTRY, TV_LOD_EXPECTED, TV_CULLED_FOCUS_TARGET_ID,
  TV_REFLOW_BASE_ROOTS, TV_REFLOW_MUTATED_ROOTS, TV_REFLOW_ANCHOR_ID,
  TV_ROOT_GENERATIONS, TV_DENSE300_ROOTS, TV_DENSE300_GENERATIONS,
} from './fixtures/tree-view-fixtures';

import { availableTreeViewportHeight } from '@/components/tree/treeViewportHeight';

describe('tree viewport available height', () => {
  it('never extends through the nav when fewer than 240px remain', () => {
    expect(availableTreeViewportHeight(600, 760)).toBe(144);
    expect(availableTreeViewportHeight(755, 760)).toBe(0);
    expect(availableTreeViewportHeight(426.4, 734)).toBe(291);
  });
});

describe('P2 anchor frame, LOD and combined budget', () => {
  it('GEO-FRAME: centers each fixture anchor, follows the 48px formula and stays NAME or better', () => {
    for (const key of ['TV-ROOT', 'TV-CHILDLESS', 'TV-WIDE8', 'TV-DEEP6'] as const) {
      const fixture = TV_FIXTURE_REGISTRY[key];
      const layout = layoutTree(fixture.roots, fixture.generations);
      const anchor = layout.nodeById.get(fixture.roots[0].id)!;
      for (const width of [320, 390, 1024, 1280, 1440]) {
        const height = width === 320 ? 900 : 844;
        const frame = anchorFrameTransform(layout, anchor.id, { width, height })!;
        expect(frame.zoom).toBe(Math.max(.65, Math.min(1, (width - 48) / frame.frameWidth, (height - 48) / frame.frameHeight)));
        expect(frame.zoom).toBeGreaterThanOrEqual(.65);
        // Narrow reading frames center the admitted neighborhood, not the first root's
        // center (which would clip its adjacent spouse entirely).
        if (width > 360) expect(frame.tx + (anchor.x + anchor.width / 2) * frame.zoom).toBeCloseTo(width / 2);
        else {
          const projected = layout.nodes.map(node => ({
            left: frame.tx + node.x * frame.zoom,
            right: frame.tx + (node.x + node.width) * frame.zoom,
            top: frame.ty + node.y * frame.zoom,
            bottom: frame.ty + (node.y + node.height) * frame.zoom,
          }));
          // A positive center alone can still leave every card (and its name) clipped.
          expect(projected.some(card => card.left >= 0 && card.right <= width && card.top >= 0 && card.bottom <= height)).toBe(true);
        }
        expect(frame.ty + (anchor.y + anchor.height / 2) * frame.zoom).toBeCloseTo(height / 2);
      }
    }
  });

  it('LOD-BOUNDARY: exact P1 nine-probe oracle', () => {
    for (const { zoom, tier } of TV_LOD_EXPECTED) expect(treeLodTier(zoom)).toBe(tier);
  });

  it('REFLOW-SAME-ANCHOR: changed geometry cannot implicitly replace the preserved transform', () => {
    const base = layoutTree(TV_REFLOW_BASE_ROOTS, TV_ROOT_GENERATIONS);
    const mutated = layoutTree(TV_REFLOW_MUTATED_ROOTS, TV_ROOT_GENERATIONS);
    const initial = anchorFrameTransform(base, TV_REFLOW_ANCHOR_ID, { width: 390, height: 844 })!;
    expect(mutated.nodeById.has(TV_REFLOW_ANCHOR_ID)).toBe(true);
    expect(initial.zoom).toBeGreaterThanOrEqual(.65);
    // Pure geometry can change; the visualizer must decide whether to invoke it.
    expect(anchorFrameTransform(mutated, TV_REFLOW_ANCHOR_ID, { width: 390, height: 844 })).not.toBeNull();
  });

  it('BUDGET-300: reserved roster rows reduce canvas controls across every LOD', () => {
    const layout = layoutTree(TV_DENSE300_ROOTS, TV_DENSE300_GENERATIONS);
    const viewport = { x: -1e6, y: -1e6, width: 2e6, height: 2e6 };
    for (const zoom of [.1, .5, .7, 1]) {
      for (const rows of [0, 1, 20, 300]) {
        const visible = cullVisibleNodes(layout, viewport, zoom, { rosterRows: rows }).visible.length;
        expect(visible).toBe(canvasPersonBudget(rows));
        expect(visible + rows).toBeLessThanOrEqual(300);
      }
    }
  });

  it('INV-FOCUS: full model contains a target excluded by viewport culling', () => {
    const fixture = TV_FIXTURE_REGISTRY['TV-CULLED-FOCUS'];
    const layout = layoutTree(fixture.roots, fixture.generations);
    const target = layout.nodeById.get(TV_CULLED_FOCUS_TARGET_ID)!;
    const visible = cullVisibleNodes(layout, { x: 0, y: 0, width: 320, height: 480 }, 1).visible;
    expect(target).toBeDefined();
    expect(visible.some((node) => node.id === target.id)).toBe(false);
    expect(anchorFrameTransform(layout, target.id, { width: 320, height: 900 })).not.toBeNull();
  });
});
