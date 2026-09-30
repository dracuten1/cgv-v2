/**
 * Phase 5 Integration Matrix — deferred TV-DEEP6 / TV-ORIENTATION / NAV-MAP cells
 * (phase5-plan.md evidence matrix; deferred from the P3/P4 unit gates).
 *
 * Covers three matrix families on the integrated tree:
 *  1. TV-DEEP6 (6 generations) generation-rail navigation — deep-band rendering,
 *     jump emissions, and `aria-current` tracking.
 *  2. Dọc (vertical) ↔ Ngang (horizontal) connector transposition — node, straight
 *     edge, orthogonal segment, orthogonal midpoint, and generation-band geometry.
 *  3. Minimap viewport-rect displacement during pan + proportional pointer and
 *     full keyboard (`panTo`) navigation.
 */
import { describe, it, expect, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import {
  layoutTree,
  BAND_HEIGHT,
  CARD_WIDTH,
  CARD_HEIGHT,
  type GenerationBand,
  type TreeLayout,
} from '@/composables/useTreeLayout';
import type { GenerationMeta, TreeNode } from '@/types/api';
import TreeGenerationRail from '@/components/tree/TreeGenerationRail.vue';
import TreeMinimap from '@/components/tree/TreeMinimap.vue';
import {
  TV_DEEP6_GENERATIONS,
  TV_DEEP6_ROOTS,
  TV_ORIENTATION_LANDSCAPE_PREFERRED,
  TV_WIDE8_GENERATIONS,
} from './fixtures/tree-view-fixtures';

// ─── helpers ────────────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface RectPct {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Parse the inline style of the minimap viewport rect into numeric percentages. */
function viewportRectPct(wrapper: VueWrapper): RectPct {
  const style = wrapper.find('[data-testid="minimap-viewport-rect"]').attributes('style') ?? '';
  const pick = (prop: string): number => {
    const m = style.match(new RegExp(`${prop}:\\s*(-?[\\d.]+)%`));
    expect(m, `viewport rect style must contain ${prop}`).not.toBeNull();
    return Number(m![1]);
  };
  return { left: pick('left'), top: pick('top'), width: pick('width'), height: pick('height') };
}

// ─── 1. TV-DEEP6 — generation rail with 6 deep bands ───────────────────────

describe('Phase 5 matrix — TV-DEEP6 generation rail (6 generations)', () => {
  const deep6Layout = layoutTree(TV_DEEP6_ROOTS, TV_DEEP6_GENERATIONS);
  const deep6Bands: GenerationBand[] = deep6Layout.bands;

  it('derives 6 generation bands from the TV_DEEP6 fixture (one member per generation)', () => {
    expect(TV_DEEP6_ROOTS).toHaveLength(1);
    expect(deep6Bands).toHaveLength(6);
    deep6Bands.forEach((band, i) => {
      expect(band.index).toBe(i + 1);
      expect(band.label).toBe(`Đời thứ ${i + 1}`);
      expect(band.count).toBe(1);
      // Vertical default: band coord runs along Y, one BAND_HEIGHT per generation.
      expect(band.coord).toBe(i * BAND_HEIGHT);
      expect(band.size).toBe(BAND_HEIGHT);
    });
  });

  it('renders all 6 rail buttons (rail-btn-1..6) with Đời labels, count 1, and button attributes', () => {
    const wrapper = mount(TreeGenerationRail, {
      props: { bands: deep6Bands, activeGen: 1 },
    });

    expect(wrapper.find('[data-testid="generation-rail"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="generation-rail"]').attributes('aria-label')).toBe(
      'Nhảy đến thế hệ'
    );

    for (let gen = 1; gen <= 6; gen++) {
      const btn = wrapper.find(`[data-testid="rail-btn-${gen}"]`);
      expect(btn.exists(), `rail-btn-${gen} must render`).toBe(true);
      expect(btn.attributes('type')).toBe('button');
      expect(btn.text()).toContain(`Đời ${gen}`);
      // TV-DEEP6: every generation has exactly 1 member.
      expect(btn.find('.tr-rail__count').text()).toBe('1');
    }
    // The badge dot (generation color) is present per button.
    expect(wrapper.findAll('.badge-dot')).toHaveLength(6);
  });

  it('emits jump with the deep generation index ([6] then [4]) on click', async () => {
    const wrapper = mount(TreeGenerationRail, {
      props: { bands: deep6Bands, activeGen: 1 },
    });

    await wrapper.find('[data-testid="rail-btn-6"]').trigger('click');
    expect(wrapper.emitted('jump')?.[0]).toEqual([6]);
    expect(wrapper.emitted('jump')).toHaveLength(1);

    await wrapper.find('[data-testid="rail-btn-4"]').trigger('click');
    expect(wrapper.emitted('jump')?.[1]).toEqual([4]);
    expect(wrapper.emitted('jump')).toHaveLength(2);
  });

  it('updates aria-current="true" to track the active generation', async () => {
    const wrapper = mount(TreeGenerationRail, {
      props: { bands: deep6Bands, activeGen: 1 },
    });

    // activeGen = 1 → only rail-btn-1 is current.
    expect(wrapper.find('[data-testid="rail-btn-1"]').attributes('aria-current')).toBe('true');
    expect(wrapper.find('[data-testid="rail-btn-6"]').attributes('aria-current')).toBeUndefined();

    // activeGen moves to the deepest band → aria-current follows reactively.
    await wrapper.setProps({ activeGen: 6 });
    expect(wrapper.find('[data-testid="rail-btn-6"]').attributes('aria-current')).toBe('true');
    expect(wrapper.find('[data-testid="rail-btn-1"]').attributes('aria-current')).toBeUndefined();
    for (let gen = 2; gen <= 5; gen++) {
      expect(wrapper.find(`[data-testid="rail-btn-${gen}"]`).attributes('aria-current')).toBeUndefined();
    }

    // Intermediate deep band (4) is also addressable.
    await wrapper.setProps({ activeGen: 4 });
    expect(wrapper.find('[data-testid="rail-btn-4"]').attributes('aria-current')).toBe('true');
    expect(wrapper.find('[data-testid="rail-btn-6"]').attributes('aria-current')).toBeUndefined();
  });
});

// ─── 2. Dọc ↔ Ngang — layout + connector transposition ─────────────────────

const ORIENTATION_FIXTURES: ReadonlyArray<{
  name: string;
  roots: TreeNode[];
  generations: GenerationMeta[];
  expectMidpoints: boolean;
}> = [
  {
    name: 'TV-DEEP6 (6 generations, single-line deep)',
    roots: TV_DEEP6_ROOTS,
    generations: TV_DEEP6_GENERATIONS,
    expectMidpoints: false,
  },
  {
    name: 'TV-ORIENTATION Ngang-preferred (TV-WIDE8, spouse + 8 siblings)',
    roots: TV_ORIENTATION_LANDSCAPE_PREFERRED,
    generations: TV_WIDE8_GENERATIONS,
    expectMidpoints: true,
  },
];

describe.each(ORIENTATION_FIXTURES)('Phase 5 matrix — Dọc↔Ngang transposition (%s)', (fx) => {
  const vLayout: TreeLayout = layoutTree(fx.roots, fx.generations, null, null, 'vertical');
  const hLayout: TreeLayout = layoutTree(fx.roots, fx.generations, null, null, 'horizontal');

  it('transposes every node coordinate: hNode.(x,y) === vNode.(y,x)', () => {
    expect(hLayout.orientation).toBe('horizontal');
    expect(vLayout.orientation).toBe('vertical');
    expect(hLayout.nodes).toHaveLength(vLayout.nodes.length);

    for (const hNode of hLayout.nodes) {
      const vNode = vLayout.nodeById.get(hNode.id);
      expect(vNode, `node ${hNode.id} present in both orientations`).toBeDefined();
      expect(hNode.x).toBe(vNode!.y);
      expect(hNode.y).toBe(vNode!.x);
      // Card dimensions are orientation-invariant.
      expect(hNode.width).toBe(CARD_WIDTH);
      expect(hNode.height).toBe(CARD_HEIGHT);
    }
  });

  it('transposes straight edges: h.(fromX,fromY,toX,toY) === v.(fromY,fromX,toY,toX)', () => {
    expect(hLayout.edges).toHaveLength(vLayout.edges.length);
    expect(hLayout.edges.length).toBeGreaterThan(0);

    for (let i = 0; i < hLayout.edges.length; i++) {
      const vEdge = vLayout.edges[i];
      const hEdge = hLayout.edges[i];
      expect(hEdge.id).toBe(vEdge.id);
      expect(hEdge.fromX).toBe(vEdge.fromY);
      expect(hEdge.fromY).toBe(vEdge.fromX);
      expect(hEdge.toX).toBe(vEdge.toY);
      expect(hEdge.toY).toBe(vEdge.toX);
    }
  });

  it('transposes orthogonal connector segments: h.(x1,y1,x2,y2) === v.(y1,x1,y2,x2)', () => {
    expect(hLayout.orthogonalEdges).toHaveLength(vLayout.orthogonalEdges.length);
    expect(hLayout.orthogonalEdges.length).toBeGreaterThan(0);

    for (let i = 0; i < hLayout.orthogonalEdges.length; i++) {
      const vOrtho = vLayout.orthogonalEdges[i];
      const hOrtho = hLayout.orthogonalEdges[i];
      expect(hOrtho.segments).toHaveLength(vOrtho.segments.length);
      for (let j = 0; j < vOrtho.segments.length; j++) {
        expect(hOrtho.segments[j].x1).toBe(vOrtho.segments[j].y1);
        expect(hOrtho.segments[j].y1).toBe(vOrtho.segments[j].x1);
        expect(hOrtho.segments[j].x2).toBe(vOrtho.segments[j].y2);
        expect(hOrtho.segments[j].y2).toBe(vOrtho.segments[j].x2);
      }
    }
  });

  it('transposes orthogonal edge midpoints: h.midpoint.(x,y) === v.midpoint.(y,x)', () => {
    const withMidpoint = vLayout.orthogonalEdges.filter((e) => e.midpoint).length;
    if (fx.expectMidpoints) {
      // TV-WIDE8 spouse connectors carry junction midpoints — at least one must exist.
      expect(withMidpoint).toBeGreaterThan(0);
    }

    for (let i = 0; i < vLayout.orthogonalEdges.length; i++) {
      const vOrtho = vLayout.orthogonalEdges[i];
      const hOrtho = hLayout.orthogonalEdges[i];
      if (!vOrtho.midpoint) {
        expect(hOrtho.midpoint).toBeUndefined();
        continue;
      }
      expect(hOrtho.midpoint).toBeDefined();
      expect(hOrtho.midpoint!.x).toBe(vOrtho.midpoint.y);
      expect(hOrtho.midpoint!.y).toBe(vOrtho.midpoint.x);
    }
  });

  it('orients generation bands along Y (vertical, increasing with index) and along X (horizontal, spanning generation-node bbox)', () => {
    // Vertical: coord is a Y coordinate; strictly increasing; cards sit inside their band.
    let prevCoord = -Infinity;
    for (const band of vLayout.bands) {
      expect(band.coord).toBe((band.index - 1) * BAND_HEIGHT);
      expect(band.coord).toBeGreaterThan(prevCoord);
      prevCoord = band.coord;
      expect(band.size).toBe(BAND_HEIGHT);
      for (const node of vLayout.nodes.filter((n) => n.generation_index === band.index)) {
        expect(node.y).toBeGreaterThanOrEqual(band.coord);
        expect(node.y + node.height).toBeLessThanOrEqual(band.coord + band.size);
      }
    }

    // Horizontal: coord is an X coordinate spanning the bounding box of the generation's nodes.
    for (const band of hLayout.bands) {
      const generationNodes = hLayout.nodes.filter((n) => n.generation_index === band.index);
      expect(generationNodes.length, `band ${band.index} has nodes`).toBeGreaterThan(0);
      const minX = Math.min(...generationNodes.map((n) => n.x));
      const maxX = Math.max(...generationNodes.map((n) => n.x + n.width));
      expect(band.coord).toBe(minX);
      expect(band.coord + band.size).toBe(maxX);
      expect(band.size).toBeGreaterThan(0);
      expect(band.y).toBe(band.coord);
      expect(band.height).toBe(band.size);
    }
    // Generations read left-to-right: band coords strictly increase with index.
    for (let i = 1; i < hLayout.bands.length; i++) {
      expect(hLayout.bands[i].coord).toBeGreaterThan(hLayout.bands[i - 1].coord);
    }
  });
});

// ─── 3. Minimap — pan displacement, proportional pointer, keyboard ─────────

describe('Phase 5 matrix — minimap viewport rect and input displacement', () => {
  const layout: TreeLayout = layoutTree(TV_ORIENTATION_LANDSCAPE_PREFERRED, TV_WIDE8_GENERATIONS);
  const viewport = { viewportWidth: 800, viewportHeight: 600 };
  const zoom = 0.8;

  function mountMinimap(transform: { zoom: number; tx: number; ty: number }): VueWrapper {
    return mount(TreeMinimap, {
      props: { layout, transform, ...viewport },
    });
  }

  it('displaces the viewport rect proportionally to -tx/zoom, -ty/zoom during pan', async () => {
    const wrapper = mountMinimap({ zoom, tx: 0, ty: 0 });

    const at = (tx: number, ty: number): RectPct => {
      const leftPct = clamp(((-tx / zoom) / layout.width) * 100, -20, 120);
      const topPct = clamp(((-ty / zoom) / layout.height) * 100, -20, 120);
      return { left: leftPct, top: topPct, width: 0, height: 0 };
    };

    // Origin: world (0,0) in the corner.
    let rect = viewportRectPct(wrapper);
    expect(rect.left).toBeCloseTo(at(0, 0).left, 6);
    expect(rect.top).toBeCloseTo(at(0, 0).top, 6);
    const sizeAtOrigin = { width: rect.width, height: rect.height };
    expect(sizeAtOrigin.width).toBeGreaterThan(0);

    // Pan left/up (negative tx/ty) → world origin moves right/down → rect displaces positively.
    await wrapper.setProps({ transform: { zoom, tx: -400, ty: -200 } });
    rect = viewportRectPct(wrapper);
    expect(rect.left).toBeCloseTo(at(-400, -200).left, 6);
    expect(rect.top).toBeCloseTo(at(-400, -200).top, 6);
    expect(rect.left).toBeGreaterThan(at(0, 0).left);
    expect(rect.top).toBeGreaterThan(at(0, 0).top);

    // Pan right/down (positive tx/ty) → rect displaces negatively (top clamps at -20%).
    await wrapper.setProps({ transform: { zoom, tx: 200, ty: 100 } });
    rect = viewportRectPct(wrapper);
    expect(rect.left).toBeCloseTo(at(200, 100).left, 6);
    expect(rect.top).toBeCloseTo(at(200, 100).top, 6);
    expect(rect.left).toBeLessThan(0);

    // Rect size is pan-invariant at constant zoom (only position follows the pan).
    expect(rect.width).toBeCloseTo(sizeAtOrigin.width, 6);
    expect(rect.height).toBeCloseTo(sizeAtOrigin.height, 6);
  });

  it('emits panTo scaled to layout.width/height × pointer ratio on minimap pointerdown', async () => {
    const wrapper = mountMinimap({ zoom, tx: -100, ty: -50 });
    const map = wrapper.find('[data-testid="minimap-map"]');
    mockMapRect(map.element);

    const panToCount = () => wrapper.emitted('panTo')?.length ?? 0;

    // Pointer at 25% × 25% of the minimap → world target (0.25·W, 0.25·H).
    await map.trigger('pointerdown', { clientX: 100 + 0.25 * 160, clientY: 200 + 0.25 * 64, pointerId: 1 });
    let [panX, panY] = wrapper.emitted('panTo')!.at(-1) as [number, number];
    expect(panX).toBeCloseTo(layout.width * 0.25, 9);
    expect(panY).toBeCloseTo(layout.height * 0.25, 9);
    expect(panToCount()).toBe(1);

    // Pointer at 75% × 75% → world target (0.75·W, 0.75·H): proportional, not fixed-offset.
    await map.trigger('pointerdown', { clientX: 100 + 0.75 * 160, clientY: 200 + 0.75 * 64, pointerId: 2 });
    [panX, panY] = wrapper.emitted('panTo')!.at(-1) as [number, number];
    expect(panX).toBeCloseTo(layout.width * 0.75, 9);
    expect(panY).toBeCloseTo(layout.height * 0.75, 9);
    expect(panToCount()).toBe(2);
  });

  it('emits clamped panTo offsets for the full keyboard set (arrows, Home, End, PageUp, PageDown)', async () => {
    const tx = -100;
    const ty = -50;
    const wrapper = mountMinimap({ zoom, tx, ty });
    const map = wrapper.find('[data-testid="minimap-map"]');
    mockMapRect(map.element);

    const stepX = 800 * 0.75; // 0.75 × viewportWidth
    const stepY = 600 * 0.75; // 0.75 × viewportHeight
    const baseX = -tx / zoom;
    const baseY = -ty / zoom;
    const expected = (dx: number, dy: number): [number, number] => [
      clamp(baseX + dx, 0, layout.width),
      clamp(baseY + dy, 0, layout.height),
    ];

    const presses: Array<[string, number, number]> = [
      ['ArrowRight', stepX, 0],
      ['ArrowLeft', -stepX, 0],
      ['ArrowDown', 0, stepY],
      ['ArrowUp', 0, -stepY],
      ['Home', -layout.width, -layout.height],
      ['End', layout.width, layout.height],
      ['PageUp', 0, -stepY],
      ['PageDown', 0, stepY],
    ];

    let index = 0;
    for (const [key, dx, dy] of presses) {
      await map.trigger('keydown', { key });
      const emissions = wrapper.emitted('panTo');
      expect(emissions, `panTo emitted for ${key}`).toBeDefined();
      expect(emissions).toHaveLength(index + 1);
      const [panX, panY] = emissions!.at(-1) as [number, number];
      const [wantX, wantY] = expected(dx, dy);
      expect(panX, `panTo.x for ${key}`).toBe(wantX);
      expect(panY, `panTo.y for ${key}`).toBe(wantY);
      index++;
    }

    // Terminal keys collapse to the world corners (Home = presses[4], End = presses[5]).
    const home = wrapper.emitted('panTo')!.at(-4) as [number, number];
    expect(home).toEqual([0, 0]);
    const end = wrapper.emitted('panTo')!.at(-3) as [number, number];
    expect(end).toEqual([layout.width, layout.height]);
  });
});

/** jsdom lacks layout: pin the minimap map rect so pointer ratios are deterministic. */
function mockMapRect(element: Element): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    top: 200,
    width: 160,
    height: 64,
    right: 260,
    bottom: 264,
    x: 100,
    y: 200,
    toJSON: () => {},
  });
}

