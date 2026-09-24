import { describe, it, expect } from 'vitest';
import {
  computeSpouseConnector,
  computeParentChildConnector,
} from '@/composables/useTreeConnectors';
import { CARD_WIDTH, CARD_HEIGHT } from '@/composables/useTreeLayout';
import type { PositionedNode } from '@/composables/useTreeLayout';

describe('useTreeConnectors — pure connector geometry (Decision 4C, M6, M9)', () => {
  const makeNode = (id: string, x: number, y: number): PositionedNode => ({
    id,
    full_name: `Member ${id}`,
    gender: 'male',
    generation_index: 1,
    is_living: true,
    spouse_ids: [],
    x,
    y,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  });

  describe('computeSpouseConnector', () => {
    it('produces a horizontal segment between two nodes with exact midpoint coordinates', () => {
      const nodeA = makeNode('A', 100, 50);
      const nodeB = makeNode('B', 324, 50); // nodeA right is 100 + 176 = 276. nodeB left is 324.

      const edge = computeSpouseConnector(nodeA, nodeB);

      expect(edge.type).toBe('spouse');
      expect(edge.segments).toHaveLength(1);

      const seg = edge.segments[0];
      expect(seg.x1).toBe(100 + CARD_WIDTH); // 276
      expect(seg.y1).toBe(50 + CARD_HEIGHT / 2); // 86
      expect(seg.x2).toBe(324);
      expect(seg.y2).toBe(50 + CARD_HEIGHT / 2); // 86

      // Midpoint indicator: r = 3px, (276 + 324) / 2 = 300, y = 86
      expect(edge.midpoint).toBeDefined();
      expect(edge.midpoint?.x).toBe(300);
      expect(edge.midpoint?.y).toBe(86);
      expect(edge.midpoint?.radius).toBe(3);
    });

    it('works regardless of parameter order (left-to-right deterministic)', () => {
      const nodeA = makeNode('A', 324, 50);
      const nodeB = makeNode('B', 100, 50);

      const edge = computeSpouseConnector(nodeA, nodeB);
      expect(edge.segments[0].x1).toBe(276);
      expect(edge.segments[0].x2).toBe(324);
      expect(edge.midpoint?.x).toBe(300);
    });

    it('suppresses segments if either endpoint is null/undefined (M9)', () => {
      const nodeA = makeNode('A', 100, 50);
      const edge = computeSpouseConnector(nodeA, null);
      expect(edge.segments).toHaveLength(0);
    });
  });

  describe('computeParentChildConnector', () => {
    it('produces vertical stem dropping to rail at parent.y + CARD_HEIGHT + 24 (M6 fix), horizontal rail across 3 children, and 3 vertical drops', () => {
      const parent = makeNode('P', 200, 50);
      const parentMidpoint = { x: 288, y: 50 + CARD_HEIGHT / 2 }; // spouse midpoint between parent & spouse

      // 3 children
      const child1 = makeNode('C1', 50, 218);
      const child2 = makeNode('C2', 250, 218);
      const child3 = makeNode('C3', 450, 218);

      const edge = computeParentChildConnector(parent, parentMidpoint, [child1, child2, child3]);

      expect(edge.type).toBe('parent-child');

      // M6 normative rail: parent.y (50) + CARD_HEIGHT (72) + 24 = 146
      // (Defect would have been parentMidpoint.y + 24 = 86 + 24 = 110, or inside card at 60)
      const expectedYRail = 50 + CARD_HEIGHT + 24;
      expect(expectedYRail).toBe(146);

      // Expected segments:
      // 1. Stem: from (288, 86) down to (288, 146)
      // 2. Rail: horizontal bar spanning min(child centers) to max(child centers) at yRail
      //    C1 center = 50 + 88 = 138, C3 center = 450 + 88 = 538
      // 3. Drops: 3 vertical drops from (cx, 146) to (cx, 218)
      expect(edge.segments.length).toBe(5);

      const stem = edge.segments[0];
      expect(stem.x1).toBe(parentMidpoint.x);
      expect(stem.y1).toBe(parentMidpoint.y);
      expect(stem.x2).toBe(parentMidpoint.x);
      expect(stem.y2).toBe(expectedYRail);

      const rail = edge.segments[1];
      expect(rail.x1).toBe(50 + CARD_WIDTH / 2); // 138
      expect(rail.y1).toBe(expectedYRail);
      expect(rail.x2).toBe(450 + CARD_WIDTH / 2); // 538
      expect(rail.y2).toBe(expectedYRail);

      const drop1 = edge.segments[2];
      expect(drop1.x1).toBe(child1.x + CARD_WIDTH / 2);
      expect(drop1.y1).toBe(expectedYRail);
      expect(drop1.x2).toBe(child1.x + CARD_WIDTH / 2);
      expect(drop1.y2).toBe(child1.y);

      const drop2 = edge.segments[3];
      expect(drop2.x1).toBe(child2.x + CARD_WIDTH / 2);
      expect(drop2.y1).toBe(expectedYRail);
      expect(drop2.x2).toBe(child2.x + CARD_WIDTH / 2);
      expect(drop2.y2).toBe(child2.y);

      const drop3 = edge.segments[4];
      expect(drop3.x1).toBe(child3.x + CARD_WIDTH / 2);
      expect(drop3.y1).toBe(expectedYRail);
      expect(drop3.x2).toBe(child3.x + CARD_WIDTH / 2);
      expect(drop3.y2).toBe(child3.y);
    });

    it('single-parent branch drops directly from parent card bottom-center when parentMidpoint is null', () => {
      const parent = makeNode('P', 200, 50);
      const child1 = makeNode('C1', 100, 218);
      const child2 = makeNode('C2', 300, 218);

      const edge = computeParentChildConnector(parent, null, [child1, child2]);
      const stem = edge.segments[0];
      expect(stem.x1).toBe(parent.x + CARD_WIDTH / 2);
      expect(stem.y1).toBe(parent.y + CARD_HEIGHT);
      expect(stem.y2).toBe(parent.y + CARD_HEIGHT + 24);
    });

    it('simplifies into a single vertical line if a single child is directly aligned under the anchor', () => {
      const parent = makeNode('P', 200, 50);
      // Single parent center is 200 + 88 = 288
      const child = makeNode('C1', 200, 218); // center is 288, aligned!

      const edge = computeParentChildConnector(parent, null, [child]);
      expect(edge.segments).toHaveLength(1);
      const seg = edge.segments[0];
      expect(seg.x1).toBe(288);
      expect(seg.y1).toBe(50 + CARD_HEIGHT);
      expect(seg.x2).toBe(288);
      expect(seg.y2).toBe(218);
    });

    it('suppresses edges (zero segments) when parent is null or children empty (M9)', () => {
      const parent = makeNode('P', 200, 50);

      const edgeNullParent = computeParentChildConnector(null, null, [makeNode('C1', 100, 200)]);
      expect(edgeNullParent.segments).toHaveLength(0);

      const edgeEmptyChildren = computeParentChildConnector(parent, null, []);
      expect(edgeEmptyChildren.segments).toHaveLength(0);

      const edgeNullChildren = computeParentChildConnector(parent, null, [null, undefined]);
      expect(edgeNullChildren.segments).toHaveLength(0);
    });
  });
});
