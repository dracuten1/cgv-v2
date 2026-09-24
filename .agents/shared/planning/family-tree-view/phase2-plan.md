# Phase 2 Plan: Layout Engine & Orthogonal Connectors

> **Phase**: 2 of 4
> **Objective**: Implement client-side root-couple normalization, in-law spouse placement bugfixes, pure orthogonal edge mathematics in `useTreeConnectors.ts`, and the upgraded HTML5 Canvas renderer in `TreeVisualizer.vue`.
> **Status**: Depends on Phase 1
> **Binding Decisions**: Decision 4C (Orthogonal connector geometry & Canvas renderer), Decision 5 (Client-side root-couple normalizer), Decision 6 (Theme blue tokens).

---

## 1. Scope & Touched Files

### Frontend (`web/`)
- `web/src/assets/main.css`: Add `--color-tree-*` blue design tokens in `@theme` and raw `:root` variables.
- **NEW** `web/src/composables/useTreeConnectors.ts`: Pure geometric calculation composable for orthogonal lines, spouse links, midpoints, and T-junction drops.
- **NEW** `web/src/composables/useTreeLayoutNormalizer.ts`: Normalizes raw `TreeResponse.roots` to pair generation 1 couples, resolve in-laws, and sort siblings.
- `web/src/composables/useTreeLayout.ts`: Integrate normalizer, fix in-law gap bug (`:200-216, :272-273`), and compute orthogonal edges via `useTreeConnectors`.
- `web/src/components/tree/TreeVisualizer.vue`: Update `drawEdges()` to render orthogonal spouse connectors, midpoint junction dots, and T-junction parent-child rails onto the Canvas.
- **NEW** `web/src/test/tree-connectors.spec.ts`: Dedicated Vitest unit tests for connector geometry.
- `web/src/test/tree-layout.spec.ts`: Update/expand assertions for root couple pairing and in-law placement.

---

## 2. Detailed Task Breakdown

### Task 2.1: Add Blue Design Tokens to `main.css`
- **Anchor**: `web/src/assets/main.css:14-54`.
- **Requirements**:
  1. In `@theme`, register the approved tokens (Decision 6):
     ```css
     --color-tree-bg: #F8FAFC;
     --color-tree-card-bg: #FFFFFF;
     --color-tree-card-border: #BFDBFE;
     --color-tree-card-border-hover: #60A5FA;
     --color-tree-connector: #93C5FD;
     --color-tree-connector-node: #3B82F6;
     --color-tree-self-ring: #2563EB;
     --color-tree-self-badge: #DBEAFE;
     --color-tree-self-text: #1E40AF;
     ```
  2. In `:root`, register raw CSS variables for direct access in Canvas 2D contexts:
     ```css
     --tree-connector: #93C5FD;
     --tree-connector-node: #3B82F6;
     --tree-self-ring: #2563EB;
     ```
  3. Ensure existing generation tokens (`--color-gen-1..4`) and Vietnamese font imports remain intact.

### Task 2.2: Implement Client-Side Tree Normalizer (`useTreeLayoutNormalizer.ts`)
- **Anchor**: `web/src/composables/useTreeLayout.ts:145-215` & Decisions 5, D1, M7, M8.
- **Requirements**:
  1. Create `web/src/composables/useTreeLayoutNormalizer.ts`.
  2. **FamilyUnit Intermediate Graph Model (M8)**:
     - Define intermediate `FamilyUnit` structure:
       ```ts
       export interface FamilyUnit {
         id: string;
         primaryNode: TreeNode;
         spouseNode?: TreeNode;
         children: TreeNode[];
       }
       ```
     - Intermediate representation groups couple blocks and explicitly manages child ownership prior to coordinate allocation.
     - **Cycle Prevention & Visited Set**: Acknowledge that the Go backend has no verified DAG/cycle guard (only DB self-loop check). The frontend normalizer OWNS a `visitedSet: Set<string>` to unconditionally prevent infinite normalization cycles.
  3. **Tier-1 Grandparent Couple Ordering (D1)**:
     - Trace ancestry upwards from "Tôi" (current user `authStore.user?.member_id`) to identify the paternal grandparent couple and maternal grandparent couple.
     - Position the paternal grandparent couple block on the left and maternal grandparent couple block on the right.
     - **Runtime Fallback**: If ancestry trace is unavailable (unlinked user or disconnected branch), order couples by `FullName ASC`.
  4. **In-Law Splice & Root-Prune (M7/K5)**:
     - For in-law spouses who arrive as top-level roots (`tree_handler.go:~150-160`) or exist in `spouse_ids`, splice them into the partner's `FamilyUnit`.
     - **Explicit Prune Step**: Immediately remove the spliced in-law from the roots array so that in-laws are rendered EXACTLY ONCE (no duplicate cards).
  5. **Deterministic Children Sorting**: Sort sibling arrays deterministically by `birth_date ASC` (fallback to `full_name`).
  6. **Immutability Invariant (M10)**: Never mutate `treeStore.roots` in-place (`shallowRef` shared with KinshipView); return normalized cloned structures.

### Task 2.3: Build Pure Geometric Composable (`useTreeConnectors.ts`)
- **Anchor**: Decision 4C, M6, M9.
- **Requirements**:
  1. Define standard geometric data structures:
     ```ts
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
     ```
  2. Implement `computeSpouseConnector(nodeA: PositionedNode, nodeB: PositionedNode): OrthogonalEdge`:
     - Determine left/right orientation: `[left, right] = nodeA.x <= nodeB.x ? [nodeA, nodeB] : [nodeB, nodeA]`.
     - Line segment: From `(left.x + left.width, left.y + left.height / 2)` to `(right.x, right.y + right.height / 2)`.
     - Calculate midpoint: `mx = (left.x + left.width + right.x) / 2`, `my = left.y + left.height / 2`.
     - Attach midpoint indicator metadata: `{ x: mx, y: my, radius: 3 }` (midpoint junction dot radius r = 3px).
  3. Implement `computeParentChildConnector(parent: PositionedNode, parentMidpoint: { x: number; y: number } | null, children: PositionedNode[]): OrthogonalEdge`:
     - **M6 Rail Geometry Fix**: The intermediate horizontal rail MUST be calculated as:
       `y_rail = parent.y + CARD_HEIGHT + 24` (24px below card bottom, NOT `parentMidpoint.y + 24`).
     - Stem: Vertical line from `(parentMidpoint.x, parentMidpoint.y)` (or parent card bottom-center for single parents) down to `y_rail`.
     - Rail: Horizontal segment from leftmost child center `min(child.x + child.width / 2)` to rightmost child center `max(child.x + child.width / 2)` at `y_rail`.
     - Drops: Vertical line for each child from `(child.x + child.width / 2, y_rail)` down to `(child.x + child.width / 2, child.y)`.
     - If single child directly aligned under midpoint, simplify into a single vertical line.
  4. **Both-Endpoints-Visible Invariant (M9/K6)**:
     - When generation filtering hides an edge endpoint node, the edge MUST be suppressed.
     - Never draw dangling stems, rails, or connectors pointing to hidden/unmounted cards.

### Task 2.4: Integrate Layout Passes & Canvas Renderer in `TreeVisualizer.vue`
- **Anchor**: `web/src/composables/useTreeLayout.ts:237-285` and `web/src/components/tree/TreeVisualizer.vue:156-190`.
- **Requirements**:
  1. **2-Pass Bounding Box Sibling Layout (M10)**:
     - In `useTreeLayout.ts:237-240`, execute pass 1 to calculate subtree widths, and pass 2 to position sibling blocks.
     - Detect sibling block overlap in pass 2 and advance `cursorX` by the actual subtree bounding box rather than naive single-card increments.
  2. **Token-vs-Hex Discipline**:
     - In `TreeVisualizer.vue`, read CSS variable colors once per layout pass:
       ```ts
       const style = getComputedStyle(document.documentElement);
       const connectorColor = style.getPropertyValue('--tree-connector').trim() || '#93C5FD';
       const nodeColor = style.getPropertyValue('--tree-connector-node').trim() || '#3B82F6';
       ```
     - Cache these values; do not use hardcoded hex literals in the draw loop.
  3. **Canvas Backing-Store & DPR Guard (M11)**:
     - In `TreeVisualizer.vue:161-166`:
       ```ts
       let dpr = Math.min(window.devicePixelRatio || 1, 2);
       const pixelCount = layout.value.width * dpr * layout.value.height * dpr;
       if (pixelCount > 16_777_216) {
         console.warn('Canvas backing store exceeds 16M pixels; falling back to dpr=1 to prevent texture overflow');
         dpr = 1;
       }
       ```
     - Protects iOS Safari from canvas texture crashes on wide trees.

---

## 3. Test Expectations & Verification

- **Vitest Unit Tests**:
  - `web/src/test/tree-connectors.spec.ts` (NEW):
    - Assert `computeSpouseConnector` produces a horizontal segment between two nodes with exact midpoint coordinates.
    - Assert `computeParentChildConnector` produces vertical stem dropping to rail at `y_rail = parent.y + CARD_HEIGHT + 24` (validating M6 fix over defect `parentMidpoint.y + 24`), horizontal rail across 3 children, and 3 vertical drops.
    - Assert single-child case drops directly without horizontal rail.
    - Assert **both-endpoints-visible invariant (M9/K6)**: when an endpoint node is filtered out, the connector is suppressed and zero edge segments are emitted.
  - `web/src/test/tree-layout.spec.ts`:
    - Test root-couple pairing: Two root spouses are placed at `y = 0` with adjacent `x` coordinates.
    - Test in-law placement & deduplication (M7/K5): In-law who arrives as top-level root and spouse_id is rendered EXACTLY ONCE; verify rendered node count.
    - Test Tier-1 couple ordering (D1): Paternal couple placed left of maternal couple when ancestry trace is present; fallback to `FullName ASC` when trace unavailable.
    - Test 2-pass bounding box sibling overlap (M10): Adjacent sibling subtrees do not overlap; `cursorX` respects bounding box width.
    - Test deterministic sorting: Older sibling (`1960`) placed to the left of younger sibling (`1965`).
  - Verify visible card components in `tree-culling.spec.ts` remain strictly $\le 300$, with connectors consuming exactly 1 canvas DOM node.

## 4. Acceptance Criteria

- [ ] All tree connectors render as orthogonal 90-degree lines using cached `--tree-connector` token.
- [ ] Spouse connections feature a solid blue junction circle at the exact midpoint (`r = 3px`, `--tree-connector-node`).
- [ ] Parent-to-children branches form clean T-junctions with intermediate rail at `parent.y + CARD_HEIGHT + 24`.
- [ ] Generation 1 displays paternal and maternal grandparents as paired couples side-by-side per D1 ordering.
- [ ] In-law spouses are spliced and pruned from roots so they render exactly once without phantom gaps.
- [ ] Connectors are suppressed when either endpoint node is hidden by generation filtering.
- [ ] Canvas renderer implements DPR clamping ($\le 2$) and 16M backing-store pixel guard.
- [ ] DOM budget contract verified: $\le 300$ visible card components; connectors = 1 canvas node.
- [ ] All Vitest tests in `tree-connectors.spec.ts` and `tree-layout.spec.ts` pass cleanly.
