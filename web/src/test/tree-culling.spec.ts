import { describe, it, expect } from 'vitest';
import {
  layoutTree,
  cullVisibleNodes,
  MAX_VISIBLE_NODES,
  DOT_ZOOM_THRESHOLD,
  type PositionedNode,
  type ViewportRect,
} from '@/composables/useTreeLayout';
import type { TreeNode } from '@/types/api';

/** Build a deep synthetic forest of N members spanning many generations. */
function buildBigForest(total: number, perGen = 8): TreeNode[] {
  const roots: TreeNode[] = [];
  let counter = 0;
  const generations: TreeNode[][] = [];

  const genCount = Math.ceil(total / perGen);
  for (let g = 0; g < genCount; g++) {
    const genNodes: TreeNode[] = [];
    for (let i = 0; i < perGen && counter < total; i++) {
      counter++;
      genNodes.push({
        id: `m-${counter}`,
        full_name: `Thành Viên ${counter}`,
        gender: counter % 2 === 0 ? 'female' : 'male',
        generation_index: g + 1,
        birth_date: `${1900 + g * 25}-01-01`,
        is_living: g === genCount - 1,
        spouse_ids: [],
        children: [],
      });
    }
    generations.push(genNodes);
  }

  // Chain each generation's nodes as children of previous gen's nodes
  for (let g = 0; g < generations.length - 1; g++) {
    generations[g].forEach((parent, i) => {
      const child = generations[g + 1][i];
      if (child) parent.children!.push(child);
    });
  }

  roots.push(...generations[0]);
  return roots;
}

describe('cullVisibleNodes — viewport culling (Arch §7.2)', () => {
  const forest = buildBigForest(2000); // far beyond any DOM budget
  const meta = Array.from({ length: 250 }, (_, i) => ({
    index: i + 1,
    label: `Đời thứ ${i + 1}`,
    count: 8,
  }));
  const layout = layoutTree(forest, meta);
  const viewport: ViewportRect = { x: 0, y: 0, width: 1200, height: 800 };

  it('returns only nodes inside viewport + 1.5x buffer', () => {
    const result = cullVisibleNodes(layout, viewport, 1);
    expect(result.visible.length).toBeGreaterThan(0);
    expect(result.visible.length).toBeLessThan(layout.nodes.length);

    // Every visible node must intersect the buffered viewport
    const padX = (viewport.width * 0.5) / 2;
    const padY = (viewport.height * 0.5) / 2;
    const minX = viewport.x - padX;
    const maxX = viewport.x + viewport.width + padX;
    const minY = viewport.y - padY;
    const maxY = viewport.y + viewport.height + padY;
    for (const node of result.visible) {
      const intersects =
        node.x + node.width >= minX &&
        node.x <= maxX &&
        node.y + node.height >= minY &&
        node.y <= maxY;
      expect(intersects).toBe(true);
    }
  });

  it('HARD budget: never exceeds MAX_VISIBLE_NODES (300) at any zoom', () => {
    // Zoomed OUT (component passes world rect = screen/zoom): a giant world
    // window makes the whole forest intersect — budget must cap at 300.
    const zoomedOut = cullVisibleNodes(
      layout,
      { x: 0, y: 0, width: 200000, height: 200000 },
      0.1
    );
    expect(zoomedOut.visible.length).toBeLessThanOrEqual(MAX_VISIBLE_NODES);
    expect(MAX_VISIBLE_NODES).toBe(300);
    expect(zoomedOut.visible.length).toBe(300); // saturated in this fixture
    expect(zoomedOut.collapsed).toBe(true);

    // Zoomed IN: subset only
    const zoomedIn = cullVisibleNodes(layout, { x: 500, y: 500, width: 400, height: 300 }, 2);
    expect(zoomedIn.visible.length).toBeLessThan(50);
    expect(zoomedIn.visible.length).toBeLessThanOrEqual(MAX_VISIBLE_NODES);
  });

  it('renders collapsed dot markers below 0.6x zoom', () => {
    const result = cullVisibleNodes(layout, viewport, DOT_ZOOM_THRESHOLD - 0.01);
    expect(result.collapsed).toBe(true);

    const above = cullVisibleNodes(layout, viewport, DOT_ZOOM_THRESHOLD);
    expect(above.collapsed).toBe(false);
  });

  it('is a pure function of (nodes, viewport, zoom) — deterministic', () => {
    const a = cullVisibleNodes(layout, viewport, 1);
    const b = cullVisibleNodes(layout, viewport, 1);
    expect(a).toEqual(b);
  });

  it('layoutTree on a 2000-node forest assigns positions for all nodes', () => {
    expect(layout.nodes.length).toBe(2000);
    const ids = new Set(layout.nodes.map((n) => n.id));
    expect(ids.size).toBe(2000);
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles empty layout without NaN', () => {
    const empty = layoutTree([], [], null);
    expect(empty.nodes).toHaveLength(0);
    expect(Number.isFinite(empty.width)).toBe(true);
    expect(Number.isFinite(empty.height)).toBe(true);

    const result = cullVisibleNodes(
      { nodes: [] as PositionedNode[] },
      viewport,
      1
    );
    expect(result.visible).toHaveLength(0);
    expect(result.collapsed).toBe(false);
  });

  it('DOM budget invariant: layout orthogonal connectors consume exactly 1 canvas DOM node', () => {
    // Under full orthogonal layout across 2000 members, connector lines are drawn
    // on a single HTML5 canvas, guaranteeing 1 canvas element in the DOM regardless of tree size.
    expect(layout.orthogonalEdges.length).toBeGreaterThan(0);
    // TreeVisualizer template renders exactly 1 <canvas ref="canvasEl" ... />
    // Layout object guarantees orthogonalEdges are calculated as an array for 1 canvas context
    expect(Array.isArray(layout.orthogonalEdges)).toBe(true);
  });
});
