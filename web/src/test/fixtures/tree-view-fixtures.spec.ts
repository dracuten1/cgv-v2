/**
 * Fixture self-verification — Phase 1 baseline (a1226ff).
 *
 * Validates the TV-* static fixtures' structural invariants so later phases
 * (P2 geometry, P3 navigation, P4 reveal, P5 matrix) can rely on them without
 * re-deriving counts. Pure test-data checks; imports fixtures only.
 */
import { describe, it, expect } from 'vitest';
import type { TreeNode } from '@/types/api';
import {
  countTreeNodes,
  TV_ROOT_ROOTS,
  TV_CHILDLESS_ROOTS,
  TV_WIDE8_ROOTS,
  TV_WIDE8_SIBLING_COUNT,
  TV_DEEP6_ROOTS,
  TV_DEEP6_GENERATION_COUNT,
  TV_DENSE300_ROOTS,
  TV_DENSE300_TOTAL,
  TV_DENSE300_GENERATIONS,
  TV_CULLED_FOCUS_ROOTS,
  TV_CULLED_FOCUS_TARGET_ID,
  TV_LOD_BOUNDARY_ROOTS,
  TV_LOD_EXPECTED,
  TV_REFLOW_BASE_ROOTS,
  TV_REFLOW_MUTATED_ROOTS,
  TV_REFLOW_ANCHOR_ID,
  TV_DEMO_USER_CONTEXT,
  TV_AVATAR_MISSING_ROOTS,
  TV_AVATAR_BROKEN_URL,
  TV_AVATAR_VALID_URL,
  TV_MISSING_ANCHOR_ID,
  TV_MISSING_ANCHOR_ROOTS,
  TV_FIXTURE_REGISTRY,
} from './tree-view-fixtures';

/** Collect every node id in a forest. */
function collectIds(roots: TreeNode[]): Set<string> {
  const ids = new Set<string>();
  const walk = (nodes: TreeNode[]): void => {
    for (const n of nodes) {
      ids.add(n.id);
      walk(n.children ?? []);
    }
  };
  walk(roots);
  return ids;
}

describe('TV-* fixture invariants (Phase 1 baseline)', () => {
  it('TV-ROOT: single lonely root, no children, no spouse', () => {
    expect(TV_ROOT_ROOTS).toHaveLength(1);
    expect(TV_ROOT_ROOTS[0].children).toHaveLength(0);
    expect(TV_ROOT_ROOTS[0].spouse_ids).toHaveLength(0);
    expect(countTreeNodes(TV_ROOT_ROOTS)).toBe(1);
  });

  it('TV-CHILDLESS: root couple, zero children', () => {
    expect(countTreeNodes(TV_CHILDLESS_ROOTS)).toBe(2);
    for (const root of TV_CHILDLESS_ROOTS) expect(root.children).toHaveLength(0);
    expect(TV_CHILDLESS_ROOTS[0].spouse_ids).toContain(TV_CHILDLESS_ROOTS[1].id);
  });

  it('TV-WIDE8: exactly 8 gen-2 single childless siblings under a root couple', () => {
    expect(TV_WIDE8_SIBLING_COUNT).toBeGreaterThanOrEqual(8);
    const gen2 = TV_WIDE8_ROOTS[0].children ?? [];
    expect(gen2).toHaveLength(TV_WIDE8_SIBLING_COUNT);
    for (const sib of gen2) expect(sib.children).toHaveLength(0);
    expect(countTreeNodes(TV_WIDE8_ROOTS)).toBe(2 + TV_WIDE8_SIBLING_COUNT);
  });

  it('TV-DEEP6: single-line chain spanning >4 generations (6)', () => {
    expect(TV_DEEP6_GENERATION_COUNT).toBeGreaterThan(4);
    expect(TV_DEEP6_GENERATION_COUNT).toBe(6);
    expect(countTreeNodes(TV_DEEP6_ROOTS)).toBe(6);
    // strictly one node per generation, chained
    let gen = 1;
    let node: TreeNode | undefined = TV_DEEP6_ROOTS[0];
    while (node) {
      expect(node.generation_index).toBe(gen);
      node = node.children?.[0];
      gen += 1;
    }
    expect(gen - 1).toBe(TV_DEEP6_GENERATION_COUNT);
  });

  it('TV-DENSE300: exactly 300 nodes across 5 generations', () => {
    expect(countTreeNodes(TV_DENSE300_ROOTS)).toBe(TV_DENSE300_TOTAL);
    expect(TV_DENSE300_TOTAL).toBe(300);
    const metaTotal = TV_DENSE300_GENERATIONS.reduce((s, g) => s + g.count, 0);
    expect(metaTotal).toBe(TV_DENSE300_TOTAL);
  });

  it('TV-CULLED-FOCUS: target id exists in the complete model', () => {
    expect(collectIds(TV_CULLED_FOCUS_ROOTS).has(TV_CULLED_FOCUS_TARGET_ID)).toBe(true);
  });

  it('TV-LOD-BOUNDARY: the 9 zoom probes map to ratified §13.2 tiers', () => {
    expect(TV_LOD_EXPECTED).toHaveLength(9);
    expect(TV_LOD_EXPECTED).toEqual([
      { zoom: 0.4199, tier: 'dot' },
      { zoom: 0.42, tier: 'chip' },
      { zoom: 0.4201, tier: 'chip' },
      { zoom: 0.6499, tier: 'chip' },
      { zoom: 0.65, tier: 'name-only' },
      { zoom: 0.6501, tier: 'name-only' },
      { zoom: 0.8499, tier: 'name-only' },
      { zoom: 0.85, tier: 'full-card' },
      { zoom: 0.8501, tier: 'full-card' },
    ]);
    // oracle is monotone non-decreasing in tier rank
    const rank = { dot: 0, chip: 1, 'name-only': 2, 'full-card': 3 } as const;
    for (let i = 1; i < TV_LOD_EXPECTED.length; i++) {
      expect(rank[TV_LOD_EXPECTED[i].tier]).toBeGreaterThanOrEqual(rank[TV_LOD_EXPECTED[i - 1].tier]);
    }
    expect(TV_LOD_BOUNDARY_ROOTS.length).toBeGreaterThan(0);
  });

  it('TV-REFLOW: mutated tree differs by exactly one added gen-2 child, anchor intact', () => {
    const baseIds = collectIds(TV_REFLOW_BASE_ROOTS);
    const mutIds = collectIds(TV_REFLOW_MUTATED_ROOTS);
    expect(mutIds.size - baseIds.size).toBe(1);
    expect(baseIds.has(TV_REFLOW_ANCHOR_ID)).toBe(true);
    expect(mutIds.has(TV_REFLOW_ANCHOR_ID)).toBe(true);
    const added = [...mutIds].filter((id) => !baseIds.has(id));
    expect(added).toHaveLength(1);
    expect(added[0]).toBe('tv-rf-c2');
  });

  it('TV-DEMO: demo context hides link-self, expects 403-first binding', () => {
    expect(TV_DEMO_USER_CONTEXT.isDemo).toBe(true);
    expect(TV_DEMO_USER_CONTEXT.expect.linkSelfButtonVisible).toBe(false);
    expect(TV_DEMO_USER_CONTEXT.expect.linkSelfApiStatus).toBe(403);
    expect(TV_DEMO_USER_CONTEXT.expect.demoNoticeVisible).toBe(true);
  });

  it('TV-AVATAR-MISSING: covers absent, broken, and valid bundled avatar URLs', () => {
    expect(TV_AVATAR_MISSING_ROOTS).toHaveLength(3);
    expect(TV_AVATAR_MISSING_ROOTS[0].avatar_url).toBeUndefined();
    expect(TV_AVATAR_MISSING_ROOTS[1].avatar_url).toBe(TV_AVATAR_BROKEN_URL);
    expect(TV_AVATAR_MISSING_ROOTS[2].avatar_url).toBe(TV_AVATAR_VALID_URL);
    // avatar policy: bundled /static/avatars only (M4)
    for (const n of TV_AVATAR_MISSING_ROOTS) {
      if (n.avatar_url) expect(n.avatar_url.startsWith('/static/avatars/')).toBe(true);
    }
  });

  it('TV-MISSING-ANCHOR: anchor id absent from the model', () => {
    expect(collectIds(TV_MISSING_ANCHOR_ROOTS).has(TV_MISSING_ANCHOR_ID)).toBe(false);
  });

  it('registry: countTreeNodes agrees with per-fixture constants', () => {
    expect(countTreeNodes(TV_FIXTURE_REGISTRY['TV-ROOT'].roots)).toBe(1);
    expect(countTreeNodes(TV_FIXTURE_REGISTRY['TV-WIDE8'].roots)).toBe(10);
    expect(countTreeNodes(TV_FIXTURE_REGISTRY['TV-DENSE300'].roots)).toBe(300);
    expect(countTreeNodes(TV_FIXTURE_REGISTRY['TV-DEEP6'].roots)).toBe(6);
  });
});
