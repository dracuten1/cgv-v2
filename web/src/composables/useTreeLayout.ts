/**
 * useTreeLayout — PURE layout + culling math (Cycle 2A / Arch §7.2 / Phase 2)
 *
 * All functions here are PURE (no DOM, no canvas, no reactivity) so they are
 * unit-testable in jsdom where `canvas.getContext()` returns null.
 * The composable `useTreeLayout` wraps them in a MEMOIZED `computed` keyed by
 * (roots, generationFilter) so selection/highlight never re-runs layout.
 *
 * Phase 2 Integration:
 * - Integrates useTreeLayoutNormalizer (M7 in-law prune, D1 grandparent ordering, deterministic sorting).
 * - Implements 2-pass bounding box sibling layout (M10): pass 1 calculates subtree widths,
 *   pass 2 positions sibling blocks with cursorX advancing by actual subtree bbox without overlap.
 * - Computes OrthogonalEdge[] via useTreeConnectors (Decision 4C, M6 rail fix, M9 suppression).
 */
import { computed, type Ref, type ComputedRef } from 'vue';
import type { TreeNode, GenerationMeta, Gender } from '@/types/api';
import { normalizeTreeRoots } from './useTreeLayoutNormalizer';
import { genAccentVar, genSoftVar } from '@/components/tree/card-visual';
import {
  computeSpouseConnector,
  computeParentChildConnector,
  type OrthogonalEdge,
} from './useTreeConnectors';

// ---------- Layout constants (world units = px at zoom 1) ----------
export const CARD_WIDTH = 176;
export const CARD_HEIGHT = 72;
export const X_GAP = 48;
export const Y_GAP = 96;
/** Total vertical space occupied by one generation band. */
export const BAND_HEIGHT = CARD_HEIGHT + Y_GAP;
export const BAND_TOP_MARGIN = 56; // room for "Đời thứ N" label above cards
export const ROOT_MARGIN_LEFT = 48;
export type TreeOrientation = 'vertical' | 'horizontal';
export type TreeLodTier = 'full-card' | 'name-only' | 'chip' | 'dot';
export function treeLodTier(zoom: number): TreeLodTier {
  if (zoom >= 0.85) return 'full-card';
  if (zoom >= 0.65) return 'name-only';
  if (zoom >= 0.42) return 'chip';
  return 'dot';
}
/** Hard cap for visible interactive person controls (cards/chips/dots). */
export const MAX_VISIBLE_NODES = 300;
/** Reserve one unit per roster person row before projecting canvas controls. */
export function canvasPersonBudget(rosterRows: number): number {
  return Math.max(0, MAX_VISIBLE_NODES - Math.min(MAX_VISIBLE_NODES, Math.max(0, Math.floor(rosterRows))));
}

/** Reading-frame geometry uses nearby generations and a width budget, never world bounds. */
export function anchorFrameTransform(
  layout: Pick<TreeLayout, 'nodes' | 'nodeById'> & { orientation?: TreeOrientation },
  anchorId: string,
  viewport: { width: number; height: number }
): { zoom: number; tx: number; ty: number; frameWidth: number; frameHeight: number } | null {
  const anchor = layout.nodeById.get(anchorId);
  if (!anchor) return null;
  const isHorizontal = layout.orientation === 'horizontal';
  const primaryDim = isHorizontal ? viewport.height : viewport.width;
  const budget = Math.floor((primaryDim - 48) / 0.65);
  const centerCross = isHorizontal ? anchor.y + anchor.height / 2 : anchor.x + anchor.width / 2;
  const nearby = layout.nodes.filter((node) => {
    if (Math.abs(node.generation_index - anchor.generation_index) > 1) return false;
    const nodeCross = isHorizontal ? node.y + node.height / 2 : node.x + node.width / 2;
    const extra = (!isHorizontal && viewport.width <= 360) ? node.width / 2 : 0;
    return Math.abs(nodeCross - centerCross) <= budget / 2 + extra;
  });
  const minX = Math.min(...nearby.map((node) => node.x));
  const maxX = Math.max(...nearby.map((node) => node.x + node.width));
  const minY = Math.min(...nearby.map((node) => node.y));
  const maxY = Math.max(...nearby.map((node) => node.y + node.height));
  const frameWidth = Math.max(1, isHorizontal ? (maxX - minX) : Math.min(budget, maxX - minX));
  const frameHeight = Math.max(1, isHorizontal ? Math.min(budget, maxY - minY) : (maxY - minY));
  const zoom = Math.max(0.65, Math.min(1, (viewport.width - 48) / frameWidth, (viewport.height - 48) / frameHeight));
  return {
    zoom,
    tx: viewport.width / 2 - (viewport.width <= 360 && !isHorizontal ? (minX + maxX) / 2 : (anchor.x + anchor.width / 2)) * zoom,
    ty: viewport.height / 2 - (anchor.y + anchor.height / 2) * zoom,
    frameWidth,
    frameHeight,
  };
}

export const VIEWPORT_BUFFER = 1.5;

// ---------- Layout output types ----------
export interface PositionedNode {
  id: string;
  full_name: string;
  gender: Gender;
  generation_index: number;
  birth_date?: string | null;
  death_date?: string | null;
  is_living: boolean;
  avatar_url?: string;
  spouse_ids: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TreeEdge {
  id: string;
  type: 'parent-child' | 'spouse';
  /** parent (or member A) center-bottom */
  fromX: number;
  fromY: number;
  /** child (or member B) center-top */
  toX: number;
  toY: number;
}

export interface GenerationBand {
  index: number;
  label: string;
  count: number;
  /** Primary coordinate along the generation axis: y for vertical, x for horizontal */
  coord: number;
  /** Size along the generation axis: height for vertical, width for horizontal */
  size: number;
  /** Legacy alias for y coordinate */
  y: number;
  /** Legacy alias for height */
  height: number;
  /** CSS var holding the band accent, cycles --gen-1..--gen-4 via modulo */
  colorVar: string;
  colorSoftVar: string;
}

export interface TreeLayout {
  nodes: PositionedNode[];
  nodeById: Map<string, PositionedNode>;
  edges: TreeEdge[];
  orthogonalEdges: OrthogonalEdge[];
  bands: GenerationBand[];
  width: number;
  height: number;
  orientation: TreeOrientation;
}

// ---------- filter ----------
/**
 * Filters a tree so only nodes of the selected generation remain.
 * Prunes children whose generation does not match.
 * null filter = all generations.
 */
export function filterRootsByGeneration(
  roots: TreeNode[],
  generationFilter: number | null
): TreeNode[] {
  if (generationFilter == null) return roots;

  const walk = (node: TreeNode): TreeNode | null => {
    const children = (node.children ?? [])
      .map(walk)
      .filter((c): c is TreeNode => c !== null);

    if (node.generation_index === generationFilter) {
      return { ...node, children };
    }

    if (children.length > 0) {
      return null;
    }
    return null;
  };

  const filtered: TreeNode[] = [];
  for (const root of roots) {
    const kept = walk(root);
    if (kept) {
      filtered.push(kept);
    }
  }
  return filtered;
}

/**
 * When a generation filter is active the pruned forest may disconnect mid-tree
 * branches; collect ALL surviving nodes (not just root paths) so every member
 * of the selected generation is still rendered.
 */
export function collectFilteredNodes(
  roots: TreeNode[],
  generationFilter: number | null
): TreeNode[] {
  if (generationFilter == null) return roots;

  const selected: TreeNode[] = [];
  const walk = (node: TreeNode): void => {
    if (node.generation_index === generationFilter) {
      selected.push(node);
    }
    for (const child of node.children ?? []) walk(child);
  };
  for (const root of roots) walk(root);
  return selected;
}

// ---------- 2-pass Bounding Box Layout (M10) ----------
interface SubtreeMetrics {
  nodeWidth: number;
  childrenWidth: number;
  totalWidth: number;
  childMetrics: Map<string, SubtreeMetrics>;
}

function calculateSubtreeMetrics(
  node: TreeNode,
  allNodesMap: Map<string, TreeNode>,
  placedSpouseIds: Set<string>
): SubtreeMetrics {
  // Spouse width: adjacent spouse cards placed next to node
  let spouseCount = 0;
  for (const spouseId of node.spouse_ids ?? []) {
    if (!placedSpouseIds.has(spouseId)) {
      const spouseNode = allNodesMap.get(spouseId);
      if (spouseNode) {
        spouseCount++;
      }
    }
  }

  const nodeWidth = CARD_WIDTH + (spouseCount > 0 ? spouseCount * (CARD_WIDTH + X_GAP / 2) : 0);

  const childMetrics = new Map<string, SubtreeMetrics>();
  let childrenWidth = 0;
  const childNodes = node.children ?? [];

  for (let i = 0; i < childNodes.length; i++) {
    const child = childNodes[i];
    const m = calculateSubtreeMetrics(child, allNodesMap, placedSpouseIds);
    childMetrics.set(child.id, m);
    childrenWidth += m.totalWidth;
    if (i < childNodes.length - 1) {
      childrenWidth += X_GAP;
    }
  }

  const totalWidth = Math.max(nodeWidth, childrenWidth);

  return {
    nodeWidth,
    childrenWidth,
    totalWidth,
    childMetrics,
  };
}

// ---------- layout ----------
/**
 * Lays out a forest of TreeNode roots into positioned nodes + connector edges.
 * - Generation rows top-down (row y derived from generation_index).
 * - Sibling order deterministic (birth_date ASC, fallback full_name).
 * - Normalizes root couples side-by-side and prunes spliced in-laws.
 * - 2-pass bounding-box positioning ensures subtrees never overlap.
 * - Generates both legacy TreeEdge[] and orthogonal OrthogonalEdge[] (with M6 rail fix & M9 visibility guard).
 */
export function layoutTree(
  rawRoots: TreeNode[],
  generations: GenerationMeta[],
  generationFilter: number | null = null,
  anchorMemberId?: string | null,
  orientation: TreeOrientation = 'vertical'
): TreeLayout {
  // 1. Normalization pass (client-side couple pairing, in-law root prune, D1 grandparent order)
  const normalized = normalizeTreeRoots(rawRoots, anchorMemberId);

  // Filter: selected generation's nodes become a flat forest of disjoint cards
  const effectiveRoots =
    generationFilter != null
      ? collectFilteredNodes(normalized.roots, generationFilter).map((n) => ({ ...n, children: [] }))
      : normalized.roots;

  // Build allNodesMap for quick lookup
  const allNodesMap = new Map<string, TreeNode>();
  const indexNode = (n: TreeNode, visited = new Set<string>()) => {
    if (visited.has(n.id)) return;
    visited.add(n.id);
    allNodesMap.set(n.id, n);
    for (const c of n.children ?? []) indexNode(c, visited);
  };
  for (const r of normalized.roots) indexNode(r);
  for (const r of rawRoots) indexNode(r);

  const nodes: PositionedNode[] = [];
  const nodeById = new Map<string, PositionedNode>();
  const edges: TreeEdge[] = [];
  const orthogonalEdges: OrthogonalEdge[] = [];

  const placedIds = new Set<string>();

  // Pass 1: Measure subtree bounding boxes
  const rootMetrics = new Map<string, SubtreeMetrics>();
  for (const root of effectiveRoots) {
    const m = calculateSubtreeMetrics(root, allNodesMap, placedIds);
    rootMetrics.set(root.id, m);
  }

  // Pass 2: Position nodes using metrics
  const positionSubtree = (
    node: TreeNode,
    startX: number,
    metrics: SubtreeMetrics
  ): void => {
    if (placedIds.has(node.id)) return;
    placedIds.add(node.id);

    const y = (node.generation_index - 1) * BAND_HEIGHT + BAND_TOP_MARGIN;

    // Determine self X offset within this subtree bounding box
    // Center the (node + spouses) block over the subtree totalWidth
    const selfBlockWidth = metrics.nodeWidth;
    let selfX = startX;
    if (metrics.totalWidth > selfBlockWidth) {
      selfX = startX + (metrics.totalWidth - selfBlockWidth) / 2;
    }

    const pos: PositionedNode = {
      id: node.id,
      full_name: node.full_name,
      gender: node.gender,
      generation_index: node.generation_index,
      birth_date: node.birth_date ?? null,
      death_date: node.death_date ?? null,
      is_living: node.is_living,
      avatar_url: node.avatar_url,
      spouse_ids: node.spouse_ids ?? [],
      x: selfX,
      y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    nodes.push(pos);
    nodeById.set(node.id, pos);

    // Position adjacent spouses
    let currentSpouseX = selfX + CARD_WIDTH + X_GAP / 2;
    const positionedSpouseNodes: PositionedNode[] = [];

    for (const spouseId of node.spouse_ids ?? []) {
      if (placedIds.has(spouseId)) {
        const existing = nodeById.get(spouseId);
        if (existing) positionedSpouseNodes.push(existing);
        continue;
      }

      const spouseNode = allNodesMap.get(spouseId);
      if (spouseNode) {
        placedIds.add(spouseId);
        const spousePos: PositionedNode = {
          id: spouseNode.id,
          full_name: spouseNode.full_name,
          gender: spouseNode.gender,
          generation_index: spouseNode.generation_index ?? node.generation_index,
          birth_date: spouseNode.birth_date ?? null,
          death_date: spouseNode.death_date ?? null,
          is_living: spouseNode.is_living,
          avatar_url: spouseNode.avatar_url,
          spouse_ids: spouseNode.spouse_ids ?? [node.id],
          x: currentSpouseX,
          y,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
        };
        nodes.push(spousePos);
        nodeById.set(spouseNode.id, spousePos);
        positionedSpouseNodes.push(spousePos);
        currentSpouseX += CARD_WIDTH + X_GAP / 2;
      }
    }

    // Position children subtrees
    const childNodes = node.children ?? [];
    let childCursorX = startX;
    if (metrics.totalWidth > metrics.childrenWidth && metrics.childrenWidth > 0) {
      childCursorX = startX + (metrics.totalWidth - metrics.childrenWidth) / 2;
    }

    for (const child of childNodes) {
      const childMetric = metrics.childMetrics.get(child.id);
      if (childMetric) {
        positionSubtree(child, childCursorX, childMetric);
        childCursorX += childMetric.totalWidth + X_GAP;
      }
    }
  };

  let cursorX = ROOT_MARGIN_LEFT;
  for (const root of effectiveRoots) {
    const m = rootMetrics.get(root.id)!;
    positionSubtree(root, cursorX, m);
    cursorX += m.totalWidth + X_GAP;
  }

  // Generate Edges
  // 1. Spouse Edges (both legacy TreeEdge and OrthogonalEdge)
  const seenSpouse = new Set<string>();
  for (const node of nodes) {
    for (const spouseId of node.spouse_ids) {
      const pairKey = [node.id, spouseId].sort().join('~');
      if (seenSpouse.has(pairKey)) continue;
      seenSpouse.add(pairKey);

      const spousePos = nodeById.get(spouseId);
      // M9: both endpoints visible
      if (!spousePos) continue;

      const [a, b] = node.x <= spousePos.x ? [node, spousePos] : [spousePos, node];
      edges.push({
        id: `sp-${pairKey}`,
        type: 'spouse',
        fromX: a.x + CARD_WIDTH,
        fromY: a.y + CARD_HEIGHT / 2,
        toX: b.x,
        toY: b.y + CARD_HEIGHT / 2,
      });

      const orthoSpouse = computeSpouseConnector(a, b);
      if (orthoSpouse.segments.length > 0) {
        orthogonalEdges.push(orthoSpouse);
      }
    }
  }

  // 2. Parent-Child Edges
  // Find all parent nodes in nodes that have children
  const seenParentChildren = new Set<string>();
  for (const node of nodes) {
    const rawNode = allNodesMap.get(node.id);
    const childNodes = rawNode?.children ?? [];
    if (childNodes.length === 0) continue;

    // Find positioned children (M9: only visible children count)
    const positionedChildren: PositionedNode[] = [];
    for (const c of childNodes) {
      const cPos = nodeById.get(c.id);
      if (cPos) {
        positionedChildren.push(cPos);
        // Legacy TreeEdge
        edges.push({
          id: `pc-${node.id}-${c.id}`,
          type: 'parent-child',
          fromX: node.x + CARD_WIDTH / 2,
          fromY: node.y + CARD_HEIGHT,
          toX: cPos.x + CARD_WIDTH / 2,
          toY: cPos.y,
        });
      }
    }

    if (positionedChildren.length === 0) continue;

    // Check if this parent has a spouse with whom children are shared
    let parentMidpoint: { x: number; y: number } | null = null;
    let spousePos: PositionedNode | undefined;
    for (const sId of node.spouse_ids) {
      spousePos = nodeById.get(sId);
      if (spousePos) break;
    }

    if (spousePos) {
      const [left, right] = node.x <= spousePos.x ? [node, spousePos] : [spousePos, node];
      parentMidpoint = {
        x: (left.x + left.width + right.x) / 2,
        y: left.y + left.height / 2,
      };
    }

    const coupleKey = spousePos
      ? [node.id, spousePos.id].sort().join('~')
      : node.id;

    if (!seenParentChildren.has(coupleKey)) {
      seenParentChildren.add(coupleKey);
      const orthoPc = computeParentChildConnector(node, parentMidpoint, positionedChildren);
      if (orthoPc.segments.length > 0) {
        orthogonalEdges.push(orthoPc);
      }
    }
  }

  // Generation bands from meta (fall back to observed generations)
  const observed = new Set(nodes.map((n) => n.generation_index));
  const indices = new Set<number>([...generations.map((g) => g.index), ...observed]);
  const sorted = [...indices].sort((a, b) => a - b);
  const metaByIndex = new Map(generations.map((g) => [g.index, g]));
  const bands: GenerationBand[] = sorted.map((index) => {
    const meta = metaByIndex.get(index);
    const bandCoord = (index - 1) * BAND_HEIGHT;
    return {
      index,
      label: meta?.label ?? `Đời thứ ${index}`,
      count: meta?.count ?? 0,
      coord: bandCoord,
      size: BAND_HEIGHT,
      y: bandCoord,
      height: BAND_HEIGHT,
      colorVar: genAccentVar(index),
      colorSoftVar: genSoftVar(index),
    };
  });

  if (orientation === 'horizontal') {
    // Coordinate transposition for horizontal (Ngang: generations left-to-right)
    for (const node of nodes) {
      const origX = node.x;
      const origY = node.y;
      node.x = origY;
      node.y = origX;
    }

    for (const edge of edges) {
      const origFromX = edge.fromX;
      const origFromY = edge.fromY;
      const origToX = edge.toX;
      const origToY = edge.toY;
      edge.fromX = origFromY;
      edge.fromY = origFromX;
      edge.toX = origToY;
      edge.toY = origToX;
    }

    for (const ortho of orthogonalEdges) {
      for (const seg of ortho.segments) {
        const origX1 = seg.x1;
        const origY1 = seg.y1;
        const origX2 = seg.x2;
        const origY2 = seg.y2;
        seg.x1 = origY1;
        seg.y1 = origX1;
        seg.x2 = origY2;
        seg.y2 = origX2;
      }
      if (ortho.midpoint) {
        const origMx = ortho.midpoint.x;
        const origMy = ortho.midpoint.y;
        ortho.midpoint.x = origMy;
        ortho.midpoint.y = origMx;
      }
    }

    // Bands carry the generation axis coordinate; horizontal renderers consume coord as x.
    // Derive each horizontal band from the actual transposed card bounds so uneven,
    // sparse, and extreme generations stay aligned with their nodes.
    const nodesByGeneration = new Map<number, PositionedNode[]>();
    for (const node of nodes) {
      const generationNodes = nodesByGeneration.get(node.generation_index) ?? [];
      generationNodes.push(node);
      nodesByGeneration.set(node.generation_index, generationNodes);
    }
    for (const band of bands) {
      const generationNodes = nodesByGeneration.get(band.index);
      if (!generationNodes?.length) continue;
      const minX = Math.min(...generationNodes.map((node) => node.x));
      const maxX = Math.max(...generationNodes.map((node) => node.x + node.width));
      band.coord = minX;
      band.size = maxX - minX;
      band.y = minX;
      band.height = band.size;
    }
  }

  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }

  const marginX = orientation === 'horizontal' ? Y_GAP : ROOT_MARGIN_LEFT;
  const marginY = orientation === 'horizontal' ? ROOT_MARGIN_LEFT : Y_GAP;

  return {
    nodes,
    nodeById,
    edges,
    orthogonalEdges,
    bands,
    width: maxX + marginX,
    height: maxY + marginY,
    orientation,
  };
}

// ---------- culling ----------
export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CulledResult {
  visible: PositionedNode[];
  tier: TreeLodTier;
  /** Compatibility flag for consumers that only distinguish dots from cards. */
  collapsed: boolean;
}

/**
 * Viewport culling (Arch §7.2):
 * - window = viewport rect expanded by 1.5× buffer
 * - HARD budget: at most MAX_VISIBLE_NODES (300) cards
 * - zoom < DOT_ZOOM_THRESHOLD → collapsed dot markers
 * Pure — no DOM access — so jsdom-safe.
 */
export function cullVisibleNodes(
  layout: Pick<TreeLayout, 'nodes'>,
  viewport: ViewportRect,
  zoom: number,
  options: { buffer?: number; rosterRows?: number } = {}
): CulledResult {
  const buffer = options.buffer ?? VIEWPORT_BUFFER;
  const maxNodes = canvasPersonBudget(options.rosterRows ?? 0);

  const padX = (viewport.width * (buffer - 1)) / 2;
  const padY = (viewport.height * (buffer - 1)) / 2;
  const minX = viewport.x - padX;
  const maxX = viewport.x + viewport.width + padX;
  const minY = viewport.y - padY;
  const maxY = viewport.y + viewport.height + padY;

  const visible: PositionedNode[] = [];
  for (const node of layout.nodes) {
    if (visible.length >= maxNodes) break;
    if (
      node.x + node.width >= minX &&
      node.x <= maxX &&
      node.y + node.height >= minY &&
      node.y <= maxY
    ) {
      visible.push(node);
    }
  }

  return { visible, tier: treeLodTier(zoom), collapsed: zoom < 0.65 };
}

// ---------- bounds helper for fit-to-view ----------
export function layoutBounds(layout: Pick<TreeLayout, 'width' | 'height' | 'nodes'>): {
  width: number;
  height: number;
} {
  if (layout.nodes.length === 0) {
    return { width: layout.width || 1, height: layout.height || 1 };
  }
  return { width: layout.width, height: layout.height };
}

/**
 * Compute zoom + translate so the whole layout fits inside the viewport
 * (used for the fit-to-view on load guarantee: root "Nguyễn Văn An" visible).
 */
export function fitToViewport(
  layout: Pick<TreeLayout, 'width' | 'height'>,
  viewport: { width: number; height: number },
  padding = 32
): { zoom: number; tx: number; ty: number } {
  const safeW = Math.max(layout.width, 1);
  const safeH = Math.max(layout.height, 1);
  const zoom = Math.min(
    (viewport.width - padding * 2) / safeW,
    (viewport.height - padding * 2) / safeH,
    1
  );
  const clamped = Math.max(zoom, 0.05);
  return {
    zoom: clamped,
    tx: (viewport.width - safeW * clamped) / 2,
    ty: (viewport.height - safeH * clamped) / 2,
  };
}

// ---------- composable (memoized) ----------
/**
 * MEMOIZED layout: the computed re-runs ONLY when roots, generationFilter, anchorMemberId, or orientation change.
 */
export function useTreeLayout(
  roots: Ref<TreeNode[]>,
  generations: Ref<GenerationMeta[]>,
  generationFilter: Ref<number | null>,
  anchorMemberId?: Ref<string | null | undefined>,
  orientation?: Ref<TreeOrientation>
): ComputedRef<TreeLayout> {
  return computed(() =>
    layoutTree(
      roots.value,
      generations.value,
      generationFilter.value,
      anchorMemberId?.value,
      orientation?.value ?? 'vertical'
    )
  );
}
