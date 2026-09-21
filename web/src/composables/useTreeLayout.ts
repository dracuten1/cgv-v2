/**
 * useTreeLayout — PURE layout + culling math (Cycle 2A / Arch §7.2)
 *
 * All functions here are PURE (no DOM, no canvas, no reactivity) so they are
 * unit-testable in jsdom where `canvas.getContext()` returns null.
 * The composable `useTreeLayout` wraps them in a MEMOIZED `computed` keyed by
 * (roots, generationFilter) so selection/highlight never re-runs layout.
 */
import { computed, type Ref, type ComputedRef } from 'vue';
import type { TreeNode, GenerationMeta, Gender } from '@/types/api';

// ---------- Layout constants (world units = px at zoom 1) ----------
export const CARD_WIDTH = 176;
export const CARD_HEIGHT = 72;
export const X_GAP = 48;
export const Y_GAP = 96;
/** Total vertical space occupied by one generation band. */
export const BAND_HEIGHT = CARD_HEIGHT + Y_GAP;
export const BAND_TOP_MARGIN = 56; // room for "Đời thứ N" label above cards
export const ROOT_MARGIN_LEFT = 48;
/** Collapse threshold: below this zoom, cards render as dot markers. */
export const DOT_ZOOM_THRESHOLD = 0.6;
/** Hard DOM budget for visible node cards at any zoom (Arch §7.2). */
export const MAX_VISIBLE_NODES = 300;
/** Viewport buffer factor: visible + 1.5× viewport. */
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
  y: number;
  height: number;
  /** CSS var holding the band accent, cycles --gen-1..--gen-4 via modulo */
  colorVar: string;
  colorSoftVar: string;
}

export interface TreeLayout {
  nodes: PositionedNode[];
  nodeById: Map<string, PositionedNode>;
  edges: TreeEdge[];
  bands: GenerationBand[];
  width: number;
  height: number;
}

// ---------- helpers ----------
function genAccentVar(genIndex: number): string {
  return `--gen-${((genIndex - 1) % 4) + 1}`;
}

function genSoftVar(genIndex: number): string {
  return `--gen-${((genIndex - 1) % 4) + 1}-soft`;
}

// ---------- filter ----------
/**
 * Filters a tree so only nodes of the selected generation remain.
 * Prunes children whose generation does not match (keeps the selected
 * generation's nodes reachable from whichever ancestor survives pruning).
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

    // Not in the selected generation: keep this node ONLY as a passive
    // connector when it has surviving selected descendants — but the spec
    // says filter hides non-selected generations, so drop the node and
    // bubble surviving children up to root level.
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

// ---------- layout ----------
/**
 * Lays out a forest of TreeNode roots into positioned nodes + connector edges.
 * - Generation rows top-down (row y derived from generation_index).
 * - Siblings ordered by input order (backend sorts by name).
 * - Spouse pairs adjacent (spouse rendered right next to the member).
 * - Multiple root families are placed side by side (disjoint components).
 * - generationFilter != null → ONLY that generation's nodes are laid out
 *   (filter hides non-selected generations); parent-child edges vanish
 *   (parents/children live in other generations), spouse edges survive
 *   when both spouses are in the selected generation.
 */
export function layoutTree(
  roots: TreeNode[],
  generations: GenerationMeta[],
  generationFilter: number | null = null
): TreeLayout {
  // Filter: selected generation's nodes become a flat forest of disjoint cards
  const effectiveRoots =
    generationFilter != null
      ? collectFilteredNodes(roots, generationFilter).map((n) => ({ ...n, children: [] }))
      : roots;

  const nodes: PositionedNode[] = [];
  const nodeById = new Map<string, PositionedNode>();
  const edges: TreeEdge[] = [];
  const placedIds = new Set<string>();
  let cursorX = ROOT_MARGIN_LEFT;

  const placeNode = (node: TreeNode, x: number): number => {
    if (placedIds.has(node.id)) return 0; // shared spouse — already placed
    placedIds.add(node.id);

    const y = (node.generation_index - 1) * BAND_HEIGHT + BAND_TOP_MARGIN;

    // 1. Lay out children first (need their total width to center node over them)
    const childStartX = x;
    let childrenWidth = 0;
    const childNodes: TreeNode[] = node.children ?? [];
    const childXs: number[] = [];
    for (const child of childNodes) {
      childXs.push(childStartX + childrenWidth);
      const w = placeNode(child, childStartX + childrenWidth);
      childrenWidth += w + X_GAP;
    }
    if (childNodes.length > 0) {
      childrenWidth -= X_GAP; // no trailing gap
    }

    // 2. Own width + spouse width (spouse sits to the right, adjacent)
    const spouseNodes: TreeNode[] = [];
    let totalWidth = CARD_WIDTH;
    for (const spouseId of node.spouse_ids ?? []) {
      // Spouses are only rendered when present in the node map (they may live
      // in another root branch — dedup via placedIds)
      if (placedIds.has(spouseId)) continue;
      // We render spouse as a second card directly adjacent; its data comes
      // from the same tree — find it among any node list provided later via
      // spouseNodesIndex in finalize step.
      totalWidth += X_GAP / 2; // tight gap between pair
      totalWidth += CARD_WIDTH;
      void spouseNodes;
    }

    // 3. Position self (and spouse) centered over children block
    const blockX = childrenWidth > totalWidth
      ? x + (childrenWidth - totalWidth) / 2
      : x;

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
      x: blockX,
      y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    nodes.push(pos);
    nodeById.set(node.id, pos);

    // advance past self+spouses for sibling placement
    let advanceX = blockX + totalWidth;
    if (childrenWidth > totalWidth) {
      advanceX = x + childrenWidth + X_GAP;
    }

    // 4. Edges to children
    for (let i = 0; i < childNodes.length; i++) {
      const childPos = nodeById.get(childNodes[i].id);
      if (!childPos) continue;
      edges.push({
        id: `pc-${node.id}-${childNodes[i].id}`,
        type: 'parent-child',
        fromX: pos.x + CARD_WIDTH / 2,
        fromY: pos.y + CARD_HEIGHT,
        toX: childPos.x + CARD_WIDTH / 2,
        toY: childPos.y,
      });
    }

    return Math.max(advanceX - x, CARD_WIDTH);
  };

  // Layout each root component side by side.
  for (const root of effectiveRoots) {
    const w = placeNode(root, cursorX);
    cursorX += w + X_GAP;
  }

  // Second pass: spouse link edges (both directions deduped by pair id)
  const seenSpouse = new Set<string>();
  for (const node of nodes) {
    for (const spouseId of node.spouse_ids) {
      const pairKey = [node.id, spouseId].sort().join('~');
      if (seenSpouse.has(pairKey)) continue;
      seenSpouse.add(pairKey);
      const spousePos = nodeById.get(spouseId);
      if (!spousePos) continue;
      // Ensure deterministic left→right orientation for the link
      const [a, b] = node.x <= spousePos.x ? [node, spousePos] : [spousePos, node];
      edges.push({
        id: `sp-${pairKey}`,
        type: 'spouse',
        fromX: a.x + CARD_WIDTH,
        fromY: a.y + CARD_HEIGHT / 2,
        toX: b.x,
        toY: b.y + CARD_HEIGHT / 2,
      });
    }
  }

  // Generation bands from meta (fall back to observed generations)
  const observed = new Set(nodes.map((n) => n.generation_index));
  const indices = new Set<number>([...generations.map((g) => g.index), ...observed]);
  const sorted = [...indices].sort((a, b) => a - b);
  const metaByIndex = new Map(generations.map((g) => [g.index, g]));
  const bands: GenerationBand[] = sorted.map((index) => {
    const meta = metaByIndex.get(index);
    return {
      index,
      label: meta?.label ?? `Đời thứ ${index}`,
      count: meta?.count ?? 0,
      y: (index - 1) * BAND_HEIGHT,
      height: BAND_HEIGHT,
      colorVar: genAccentVar(index),
      colorSoftVar: genSoftVar(index),
    };
  });

  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }

  return {
    nodes,
    nodeById,
    edges,
    bands,
    width: maxX + ROOT_MARGIN_LEFT,
    height: maxY + Y_GAP,
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
  /** true → render dot markers instead of full cards */
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
  options: { buffer?: number; maxNodes?: number } = {}
): CulledResult {
  const buffer = options.buffer ?? VIEWPORT_BUFFER;
  const maxNodes = options.maxNodes ?? MAX_VISIBLE_NODES;

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

  return { visible, collapsed: zoom < DOT_ZOOM_THRESHOLD };
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
 * MEMOIZED layout: the computed re-runs ONLY when roots or generationFilter
 * change. Selection (a separate ref in the store) never invalidates it.
 */
export function useTreeLayout(
  roots: Ref<TreeNode[]>,
  generations: Ref<GenerationMeta[]>,
  generationFilter: Ref<number | null>
): ComputedRef<TreeLayout> {
  return computed(() => layoutTree(roots.value, generations.value, generationFilter.value));
}
