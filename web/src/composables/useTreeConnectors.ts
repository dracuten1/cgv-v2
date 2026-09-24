/**
 * useTreeConnectors — Pure geometric calculation composable for orthogonal lines (Decision 4C / M6 / M9).
 *
 * All functions here are PURE (no DOM, no canvas, no reactivity).
 * Calculates orthogonal lines, spouse links, midpoints, and T-junction drops.
 */

import { CARD_HEIGHT } from './useTreeLayout';
import type { PositionedNode } from './useTreeLayout';

export interface LineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface OrthogonalEdge {
  id: string;
  type: 'spouse' | 'parent-child';
  segments: LineSegment[];
  midpoint?: { x: number; y: number; radius: number };
}

/**
 * Computes an orthogonal edge between two spouse nodes.
 * - Horizontal line between adjacent cards at vertical midpoint (y + height / 2).
 * - Midpoint dot metadata with radius r = 3px.
 * - Respects M9: if either node is missing/undefined, returns an empty edge with no segments.
 */
export function computeSpouseConnector(
  nodeA: PositionedNode | null | undefined,
  nodeB: PositionedNode | null | undefined
): OrthogonalEdge {
  if (!nodeA || !nodeB) {
    return {
      id: `sp-${nodeA?.id ?? 'unknown'}~${nodeB?.id ?? 'unknown'}`,
      type: 'spouse',
      segments: [],
    };
  }

  const [left, right] = nodeA.x <= nodeB.x ? [nodeA, nodeB] : [nodeB, nodeA];
  const pairKey = [nodeA.id, nodeB.id].sort().join('~');

  const x1 = left.x + left.width;
  const y1 = left.y + left.height / 2;
  const x2 = right.x;
  const y2 = right.y + right.height / 2;

  const mx = (x1 + x2) / 2;
  const my = y1;

  return {
    id: `sp-${pairKey}`,
    type: 'spouse',
    segments: [
      {
        x1,
        y1,
        x2,
        y2,
      },
    ],
    midpoint: {
      x: mx,
      y: my,
      radius: 3,
    },
  };
}

/**
 * Computes an orthogonal T-junction edge connecting parent(s) to children.
 *
 * M6 Rail Geometry:
 * y_rail = parent.y + CARD_HEIGHT + 24 (24px below card bottom, NOT parentMidpoint.y + 24).
 *
 * M9 Both-Endpoints-Visible Invariant:
 * If parent is missing or children is empty, edge is suppressed (zero segments).
 * Any child in children that is null/undefined is skipped; if no visible children remain, suppressed.
 *
 * Single child directly aligned under stem anchor:
 * Simplifies to a single vertical line from stem anchor directly down to child top.
 */
export function computeParentChildConnector(
  parent: PositionedNode | null | undefined,
  parentMidpoint: { x: number; y: number } | null | undefined,
  children: (PositionedNode | null | undefined)[]
): OrthogonalEdge {
  const edgeId = `pc-${parent?.id ?? 'unknown'}`;

  // M9 guard: parent must be present
  if (!parent) {
    return {
      id: edgeId,
      type: 'parent-child',
      segments: [],
    };
  }

  // Filter valid/visible children
  const visibleChildren = children.filter((c): c is PositionedNode => c != null);
  if (visibleChildren.length === 0) {
    return {
      id: edgeId,
      type: 'parent-child',
      segments: [],
    };
  }

  const stemStartX = parentMidpoint ? parentMidpoint.x : parent.x + parent.width / 2;
  const stemStartY = parentMidpoint ? parentMidpoint.y : parent.y + parent.height;

  // Normative M6 rail coordinate: parent.y + CARD_HEIGHT + 24
  const yRail = parent.y + CARD_HEIGHT + 24;

  // Single-child optimization: if single child directly aligned under stem anchor
  if (visibleChildren.length === 1) {
    const child = visibleChildren[0];
    const childCenterX = child.x + child.width / 2;
    if (Math.abs(childCenterX - stemStartX) < 0.001) {
      // Directly aligned vertical drop from stemStartY straight to child.y
      return {
        id: `${edgeId}-${child.id}`,
        type: 'parent-child',
        segments: [
          {
            x1: stemStartX,
            y1: stemStartY,
            x2: childCenterX,
            y2: child.y,
          },
        ],
      };
    }
  }

  // Multi-child or non-aligned single child:
  // 1. Stem: vertical line from stemStart to (stemStartX, yRail)
  const segments: LineSegment[] = [
    {
      x1: stemStartX,
      y1: stemStartY,
      x2: stemStartX,
      y2: yRail,
    },
  ];

  // 2. Rail: horizontal segment from min(childCenter.x) to max(childCenter.x)
  const childCenterXs = visibleChildren.map((c) => c.x + c.width / 2);
  const minChildX = Math.min(...childCenterXs, stemStartX);
  const maxChildX = Math.max(...childCenterXs, stemStartX);

  if (maxChildX > minChildX) {
    segments.push({
      x1: minChildX,
      y1: yRail,
      x2: maxChildX,
      y2: yRail,
    });
  }

  // 3. Drops: vertical line for each child from (childCenter.x, yRail) to (childCenter.x, child.y)
  for (const child of visibleChildren) {
    const cx = child.x + child.width / 2;
    segments.push({
      x1: cx,
      y1: yRail,
      x2: cx,
      y2: child.y,
    });
  }

  return {
    id: edgeId,
    type: 'parent-child',
    segments,
  };
}
