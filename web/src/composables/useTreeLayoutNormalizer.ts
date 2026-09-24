/**
 * useTreeLayoutNormalizer — Pure normalization for raw TreeResponse.roots.
 *
 * Requirements (Task 2.2 / Decisions 5, D1, M7, M10):
 * 1. In-law splice & root-prune (M7): in-laws who arrive as top-level roots are spliced into spouseNode
 *    and explicitly removed from roots so they render EXACTLY ONCE.
 * 2. Tier-1 grandparent couple ordering (D1):
 *    Paternal grandparent couple LEFT, maternal grandparent couple RIGHT, traced upwards from
 *    authStore.user?.member_id (or provided anchorMemberId).
 *    Fallback to FullName ASC when trace unavailable.
 * 3. Deterministic sibling sorting: birth_date ASC (fallback full_name).
 * 4. Immutability Invariant (M10): never mutate input roots in-place; return cloned structures.
 *
 * FamilyUnit is retained as a documented type for downstream consumers (e.g. tests, future graph
 * consumers) but is no longer constructed by the normalizer. Spouse pairing happens directly in
 * useTreeLayout's positioning pass to keep this normalizer lean.
 */

import type { TreeNode } from '@/types/api';

/**
 * @deprecated No longer constructed by the normalizer. Kept as a documented type for downstream
 * consumers and future graph code paths.
 */
export interface FamilyUnit {
  id: string;
  primaryNode: TreeNode;
  spouseNode?: TreeNode;
  children: TreeNode[];
}

/**
 * Deep-clones a TreeNode or array of TreeNodes to honor M10 immutability invariant.
 * M-G guard: visited set prevents cyclic-payload stack overflow before M8 graph guards run.
 */
function cloneTreeNode(node: TreeNode, visited = new Set<string>()): TreeNode {
  if (visited.has(node.id)) {
    return {
      ...node,
      spouse_ids: [...(node.spouse_ids ?? [])],
      children: [],
    };
  }
  visited.add(node.id);
  return {
    ...node,
    spouse_ids: [...(node.spouse_ids ?? [])],
    children: (node.children ?? []).map((c) => cloneTreeNode(c, visited)),
  };
}

/**
 * Helper to collect all nodes into an id -> TreeNode map (from a cloned tree).
 */
function buildNodeMap(nodes: TreeNode[], map = new Map<string, TreeNode>(), visited = new Set<string>()): Map<string, TreeNode> {
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    visited.add(node.id);
    map.set(node.id, node);
    if (node.children && node.children.length > 0) {
      buildNodeMap(node.children, map, visited);
    }
  }
  return map;
}

/**
 * Deterministic comparator for siblings: birth_date ASC, fallback to full_name.
 */
export function compareSiblings(a: TreeNode, b: TreeNode): number {
  if (a.birth_date && b.birth_date) {
    const diff = a.birth_date.localeCompare(b.birth_date);
    if (diff !== 0) return diff;
  } else if (a.birth_date && !b.birth_date) {
    return -1;
  } else if (!a.birth_date && b.birth_date) {
    return 1;
  }
  return (a.full_name || '').localeCompare(b.full_name || '');
}

/**
 * Traces ancestry from anchorMemberId to identify paternal vs maternal branch members.
 * Returns sets of member IDs belonging to the paternal lineage and maternal lineage respectively.
 */
function traceAncestryBranches(
  allNodesMap: Map<string, TreeNode>,
  anchorMemberId: string | null | undefined
): { paternalSet: Set<string>; maternalSet: Set<string> } {
  const paternalSet = new Set<string>();
  const maternalSet = new Set<string>();

  if (!anchorMemberId) {
    return { paternalSet, maternalSet };
  }

  // Build child -> parents map from children arrays
  const parentMap = new Map<string, string[]>();
  for (const [id, node] of allNodesMap.entries()) {
    for (const child of node.children ?? []) {
      const p = parentMap.get(child.id) ?? [];
      if (!p.includes(id)) {
        p.push(id);
      }
      parentMap.set(child.id, p);
    }
    // Also consider spouse relationships: if node has children, spouse might also be parent
    for (const spouseId of node.spouse_ids ?? []) {
      for (const child of node.children ?? []) {
        const p = parentMap.get(child.id) ?? [];
        if (!p.includes(spouseId)) {
          p.push(spouseId);
        }
        parentMap.set(child.id, p);
      }
    }
  }

  // Find parents of anchorMemberId
  const parents = parentMap.get(anchorMemberId) ?? [];
  let fatherId: string | null = null;
  let motherId: string | null = null;

  for (const pid of parents) {
    const pNode = allNodesMap.get(pid);
    if (pNode?.gender === 'male' && !fatherId) {
      fatherId = pid;
    } else if (pNode?.gender === 'female' && !motherId) {
      motherId = pid;
    } else if (!fatherId) {
      fatherId = pid;
    } else if (!motherId) {
      motherId = pid;
    }
  }

  const collectAncestors = (startId: string, set: Set<string>, visited = new Set<string>()) => {
    if (visited.has(startId)) return;
    visited.add(startId);
    set.add(startId);
    const pList = parentMap.get(startId) ?? [];
    for (const p of pList) {
      collectAncestors(p, set, visited);
    }
  };

  if (fatherId) {
    collectAncestors(fatherId, paternalSet);
  }
  if (motherId) {
    collectAncestors(motherId, maternalSet);
  }

  return { paternalSet, maternalSet };
}

/**
 * Normalizes an array of roots:
 * 1. Deep clones to maintain immutability (M10).
 * 2. Identifies in-laws and spouses to assemble FamilyUnits.
 * 3. Prunes spliced in-laws from root positions (M7).
 * 4. Orders generation 1 roots according to Tier-1 paternal left, maternal right (D1) or FullName ASC fallback.
 * 5. Deterministically sorts children throughout all levels (birth_date ASC).
 */
export function normalizeTreeRoots(
  rawRoots: TreeNode[],
  anchorMemberId?: string | null
): { roots: TreeNode[] } {
  if (!rawRoots || rawRoots.length === 0) {
    return { roots: [] };
  }

  // M10: Never mutate input roots
  const cloneVisited = new Set<string>();
  const clonedRoots: TreeNode[] = rawRoots.map((r) => cloneTreeNode(r, cloneVisited));

  // Map of all cloned nodes
  const allNodesMap = buildNodeMap(clonedRoots);

  // Recursively sort children deterministically
  const sortChildrenRecursively = (node: TreeNode, visited: Set<string>) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    if (node.children && node.children.length > 0) {
      node.children.sort(compareSiblings);
      for (const child of node.children) {
        sortChildrenRecursively(child, visited);
      }
    }
  };

  const sortVisited = new Set<string>();
  for (const root of clonedRoots) {
    sortChildrenRecursively(root, sortVisited);
  }

  // M7: In-law splice & root-prune.
  // In-laws often arrive as roots with children: [] but listed in a primary node's spouse_ids.
  // Identify root IDs that are spouses of another root that has children or is primary.
  const prunedRootIds = new Set<string>();
  const rootMap = new Map<string, TreeNode>();
  for (const r of clonedRoots) {
    rootMap.set(r.id, r);
  }

  // Helper to determine if node B is in-law spouse of node A
  // A root with 0 children who is in spouse_ids of another root with children is an in-law.
  // Or if both are roots of Gen 1, pair them.
  for (const r of clonedRoots) {
    if (prunedRootIds.has(r.id)) continue;
    for (const spouseId of r.spouse_ids ?? []) {
      const spouseRoot = rootMap.get(spouseId);
      if (spouseRoot && spouseRoot.id !== r.id && !prunedRootIds.has(spouseRoot.id)) {
        // Decide primary vs spouse:
        // 1. If one has children and the other doesn't, the one with children is primary.
        // 2. If both have no children or both have children, blood-left / male-left / determinism.
        const rHasChildren = (r.children && r.children.length > 0);
        const sHasChildren = (spouseRoot.children && spouseRoot.children.length > 0);

        if (rHasChildren && !sHasChildren) {
          prunedRootIds.add(spouseRoot.id);
        } else if (!rHasChildren && sHasChildren) {
          prunedRootIds.add(r.id);
        } else {
          // If both have children or neither, keep the male or lexicographically first as primary
          if (r.gender === 'male' && spouseRoot.gender === 'female') {
            prunedRootIds.add(spouseRoot.id);
          } else if (r.gender === 'female' && spouseRoot.gender === 'male') {
            prunedRootIds.add(r.id);
          } else if (r.id < spouseRoot.id) {
            prunedRootIds.add(spouseRoot.id);
          } else {
            prunedRootIds.add(r.id);
          }
        }
      }
    }
  }

  // Surviving primary roots
  const effectiveRoots = clonedRoots.filter((r) => !prunedRootIds.has(r.id));

  // Ancestry trace for Tier-1 grandparents ordering (D1)
  const { paternalSet, maternalSet } = traceAncestryBranches(allNodesMap, anchorMemberId);

  // Classify and sort effective roots
  effectiveRoots.sort((a, b) => {
    // 1. Generation index ASC
    if (a.generation_index !== b.generation_index) {
      return a.generation_index - b.generation_index;
    }

    // 2. If Generation 1 and ancestry trace is available
    if (a.generation_index === 1 && (paternalSet.size > 0 || maternalSet.size > 0)) {
      const aIsPaternal = paternalSet.has(a.id) || (a.spouse_ids ?? []).some((s) => paternalSet.has(s));
      const bIsPaternal = paternalSet.has(b.id) || (b.spouse_ids ?? []).some((s) => paternalSet.has(s));
      const aIsMaternal = maternalSet.has(a.id) || (a.spouse_ids ?? []).some((s) => maternalSet.has(s));
      const bIsMaternal = maternalSet.has(b.id) || (b.spouse_ids ?? []).some((s) => maternalSet.has(s));

      if (aIsPaternal && !bIsPaternal) return -1;
      if (!aIsPaternal && bIsPaternal) return 1;
      if (aIsMaternal && !bIsMaternal) return 1;
      if (!aIsMaternal && bIsMaternal) return -1;
    }

    // Fallback: FullName ASC
    return (a.full_name || '').localeCompare(b.full_name || '');
  });

  return {
    roots: effectiveRoots,
  };
}
