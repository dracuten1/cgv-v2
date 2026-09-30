import type { PositionedNode } from './useTreeLayout';
import type { TreeNode } from '@/types/api';

/**
 * Information about siblings that are outside the current reading frame/viewport budget.
 */
export interface HiddenSiblingsInfo {
  anchorId: string;
  anchorName: string;
  generationIndex: number;
  totalSiblings: number;
  hiddenCount: number;
  hiddenSiblings: PositionedNode[];
  allSiblings: PositionedNode[];
}

/**
 * Builds a map from child ID to parent IDs from TreeNode forest.
 */
export function buildParentMap(roots: TreeNode[]): Map<string, string[]> {
  const parentMap = new Map<string, string[]>();
  const visited = new Set<string>();

  function walk(node: TreeNode) {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    const children = node.children ?? [];
    for (const child of children) {
      const existing = parentMap.get(child.id) ?? [];
      if (!existing.includes(node.id)) {
        existing.push(node.id);
      }
      for (const spouseId of node.spouse_ids ?? []) {
        if (!existing.includes(spouseId)) {
          existing.push(spouseId);
        }
      }
      parentMap.set(child.id, existing);
      walk(child);
    }
  }

  for (const root of roots) {
    walk(root);
  }
  return parentMap;
}

/**
 * Computes hidden siblings for a given anchor node within the layout.
 *
 * Siblings are nodes that share at least one parent (or roots at the same generation
 * if no parent map exists and multiple roots share generation).
 *
 * Out-of-budget (hidden) siblings are those sibling nodes that are NOT in visibleNodeIds.
 */
export function computeHiddenSiblings(
  layoutNodes: PositionedNode[],
  rawRoots: TreeNode[],
  anchorId: string,
  visibleNodeIds: Set<string>
): HiddenSiblingsInfo | null {
  const anchorNode = layoutNodes.find((n) => n.id === anchorId);
  if (!anchorNode) return null;

  const parentMap = buildParentMap(rawRoots);
  const anchorParents = parentMap.get(anchorId) ?? [];

  let siblingNodes: PositionedNode[] = [];

  if (anchorParents.length > 0) {
    // Has known parents: siblings are all other children of these parents
    const parentSet = new Set(anchorParents);
    siblingNodes = layoutNodes.filter((node) => {
      if (node.id === anchorId) return false;
      if (node.generation_index !== anchorNode.generation_index) return false;
      const nodeParents = parentMap.get(node.id) ?? [];
      return nodeParents.some((p) => parentSet.has(p));
    });
  } else {
    // If anchor is a root or has children who are siblings:
    // If anchor has children, we also check if children have out-of-budget siblings!
    // But first, does anchor itself have siblings (co-roots)?
    siblingNodes = layoutNodes.filter((node) => {
      if (node.id === anchorId) return false;
      if (node.generation_index !== anchorNode.generation_index) return false;
      if (anchorNode.spouse_ids.includes(node.id)) return false;
      const nodeParents = parentMap.get(node.id) ?? [];
      return nodeParents.length === 0;
    });

    // If anchor itself has no siblings, check anchor's children if anchor is parent:
    if (siblingNodes.length === 0) {
      // Find all children of anchor
      const childrenNodes = layoutNodes.filter((node) => {
        const parents = parentMap.get(node.id) ?? [];
        return parents.includes(anchorId);
      });
      // If there are multiple children and some are hidden, treat children as the sibling group
      if (childrenNodes.length > 1) {
        const hiddenChildren = childrenNodes.filter((c) => !visibleNodeIds.has(c.id));
        if (hiddenChildren.length > 0) {
          return {
            anchorId,
            anchorName: anchorNode.full_name,
            generationIndex: childrenNodes[0].generation_index,
            totalSiblings: childrenNodes.length,
            hiddenCount: hiddenChildren.length,
            hiddenSiblings: hiddenChildren,
            allSiblings: childrenNodes,
          };
        }
      }
    }
  }

  if (siblingNodes.length === 0) {
    return null;
  }

  const hiddenSiblings = siblingNodes.filter((node) => !visibleNodeIds.has(node.id));

  return {
    anchorId,
    anchorName: anchorNode.full_name,
    generationIndex: anchorNode.generation_index,
    totalSiblings: siblingNodes.length,
    hiddenCount: hiddenSiblings.length,
    hiddenSiblings,
    allSiblings: siblingNodes,
  };
}
