# Phase 3 Plan: Card Redesign, Kinship Badges & Navigation

> **Phase**: 3 of 4
> **Objective**: Redesign `TreeNodeCard.vue` to match reference styling (thin blue border, circular avatar with error fallback, Vietnamese date notation `s. 1942`), implement personal kinship badges via `useKinshipBadge.ts`, support "Tôi" identity highlighting with auto-centering, and integrate the bottom-right Compass navigation control.
> **Status**: Depends on Phase 1 & Phase 2
> **Binding Decisions**: Decision 1C (Avatar error fallback), Decision 2C (Kinship badge abbreviation), Decision 3B ("Tôi" identity & linking), Decision 6 (Visual tokens & Vietnamese date format).

---

## 1. Scope & Touched Files

### Frontend (`web/`)
- `web/src/components/tree/card-visual.ts`: Update `getYearsText()` to use Vietnamese `s. YYYY` notation for living members.
- **NEW** `web/src/composables/useKinshipBadge.ts`: Maps backend canonical kinship terms to concise badges ("Tôi", "Nội", "Ngoại", "Con", etc.).
- `web/src/components/tree/TreeNodeCard.vue`: Full visual redesign (white card, blue border, circular avatar with `@error` fallback, "Tôi" ring, kinship badge chip).
- `web/src/composables/useTreeViewport.ts`: Export programmatic `panBy(dx: number, dy: number): void` helper modifying `transform.tx += dx; transform.ty += dy` (or calling `setTransform`).
- **NEW** `web/src/components/tree/TreeCompassControl.vue`: Bottom-right navigation control (North/South/East/West pan buttons + center reset).
- `web/src/components/tree/TreeVisualizer.vue`: Integrate `TreeCompassControl.vue`, implement auto-focus on "Tôi" node on load (coexisting with `fitView()`).
- `web/src/views/TreeView.vue`: Trigger `fetchKinshipLabels` when family loads, add unlinked user banner prompt in toolbar.
- **NEW** `web/src/test/kinship-badge.spec.ts`: Unit test for term abbreviations.
- `web/src/test/tree-node-card.spec.ts`: Update existing assertions and add tests for "Tôi" ring, kinship badge, and avatar fallback.

---

## 2. Detailed Task Breakdown

### Task 3.1: Vietnamese Date Formatting in `card-visual.ts`
- **Anchor**: `web/src/components/tree/card-visual.ts:16-27` & Decision 6.
- **Requirements**:
  1. Refactor `getYearsText(birthDate?: string | null, deathDate?: string | null, isLiving: boolean = true)`:
     - If `isLiving` (or `deathDate` is null/empty) and `birthDate` exists: return `s. ${birthYear}` (e.g., `s. 1942`).
     - If deceased with both birth and death dates: return `${birthYear} – ${deathYear}` (e.g., `1940 – 2015`).
     - If deceased with only death date: return `? – ${deathYear}`.
     - If deceased with only birth date: return `${birthYear} – ?`.
     - If no dates: return empty string `""`.
  2. Note: This change updates output format. Existing unit test assertions in `tree-node-card.spec.ts:59,65` will be consciously updated to match in Phase 4, Task 4.1.

### Task 3.2: Create Kinship Badge Composable (`useKinshipBadge.ts`)
- **Anchor**: Decision 2C (Lexicon coverage and term mapping).
- **Requirements**:
  1. Implement `formatKinshipBadge(canonicalTerm?: string): { badge: string; full: string }`:
     - Mapping dictionary:
       - `"Bản thân"` $\to$ `"Tôi"`
       - `"Ông nội"`, `"Bà nội"` $\to$ `"Nội"`
       - `"Ông ngoại"`, `"Bà ngoại"` $\to$ `"Ngoại"`
       - `"Con trai"`, `"Con gái"` $\to$ `"Con"`
       - `"Cháu nội"`, `"Cháu ngoại"` $\to$ `"Cháu"`
       - Direct relations pass through: `"Bố"`, `"Mẹ"`, `"Anh"`, `"Chị"`, `"Em"`, `"Chồng"`, `"Vợ"`.
     - Return `{ badge: shortened, full: canonicalTerm }`.
     - If `canonicalTerm` is undefined, return empty.

### Task 3.3: Redesign `TreeNodeCard.vue`
- **Anchor**: `web/src/components/tree/TreeNodeCard.vue:1-90` & Decisions 1C, 3B, 6.
- **Requirements**:
  1. **Visual Styling**:
     - Replace outer border classes with `border border-tree-card-border bg-tree-card-bg rounded-lg hover:border-tree-card-border-hover`.
     - Preserve the 4px left accent bar: `border-l-4` using `style="{ borderLeftColor: 'var(' + genAccentVar(node.generation_index) + ')' }"`.
  2. **Avatar Image & Robust Error Fallback (M12)**:
     - Introduce reactive flag: `const hasAvatarError = ref(false)`.
     - **Latch Reset Watcher (M12)**: Add `watch(() => props.node.avatar_url, () => { hasAvatarError.value = false; })` so that updated URLs or card component recycling resets a latched error.
     - Avatar circle:
       ```html
       <div class="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-slate-200 bg-slate-100 font-medium text-xs text-slate-600">
         <img
           v-if="node.avatar_url && !hasAvatarError"
           :src="node.avatar_url"
           :alt="node.full_name"
           class="w-full h-full object-cover"
           @error="hasAvatarError = true"
         />
         <span v-else>{{ initials }}</span>
       </div>
       ```
  3. **"Tôi" Identity Highlighting**:
     - Check: `const isSelf = computed(() => authStore.user?.member_id === props.node.id)`.
     - When `isSelf` is true, apply blue ring: `ring-2 ring-tree-self-ring shadow-sm`.
  4. **Kinship Badge Display**:
     - Lookup label: `const rawKinship = computed(() => treeStore.kinshipLabels[props.node.id])`.
     - If `isSelf` is true: Render badge `"Tôi"` with styling `bg-tree-self-badge text-tree-self-text font-semibold`.
     - Else if `rawKinship` exists: Render badge `formatKinshipBadge(rawKinship).badge` with `bg-blue-50 text-blue-700 border border-blue-200`.
     - Tooltip: `title="rawKinship"` for full term accessibility.
     - Line-height strictly $\ge 1.45$ (**INV-02** compliant, no clipping of diacritics).
  5. **"Đây là tôi" (Link Self) Quick Action & Event Shield (M12)**:
     - When user is authenticated, has no `member_id` (or viewing card menu), render an intuitive "Đây là tôi" button on the card popover / action menu.
     - **Click Hijack Prevention (M12)**: Attach `@click.stop.prevent="handleLinkSelf"` on the button to prevent triggering parent card click navigation (`/members/:id` in `TreeNodeCard.vue:126-131`).
     - Handler executes `authStore.linkSelfToMember(node.id)`.

### Task 3.4: Build Compass Navigation Control (`TreeCompassControl.vue`)
- **Anchor**: Goal specification (pan/zoom controls + compass) and `web/src/composables/useTreeViewport.ts`.
- **Requirements**:
  1. In `useTreeViewport.ts`, add and export `panBy(dx: number, dy: number): void`:
     ```ts
     function panBy(dx: number, dy: number): void {
       setTransform(transform.zoom, transform.tx + dx, transform.ty + dy);
     }
     ```
  2. Create `web/src/components/tree/TreeCompassControl.vue`.
  3. Four directional pan buttons: North, South, East, West (using SVG arrow icons) invoking `viewport.panBy(dx, dy)`.
  4. Clicking a directional button dispatches a pan step (e.g., North: `panBy(0, 80)`, South: `panBy(0, -80)`, East: `panBy(-80, 0)`, West: `panBy(80, 0)`).
  5. Center button: Resets pan to origin or focuses on "Tôi" node via `setTransform(1, 0, 0)` or `focusNode(selfId)`.
  6. Positioned fixed in the bottom-right corner immediately above or adjacent to existing `+ / − / Fit` buttons.
  7. Styled with Tailwind: `bg-white/90 backdrop-blur rounded-full shadow-md border border-slate-200 p-1.5`.

### Task 3.5: Auto-Centering on "Tôi" Node in `TreeVisualizer.vue`
- **Anchor**: `web/src/components/tree/TreeVisualizer.vue:145-155, 196-209`.
- **Requirements**:
  1. On initial mount and layout completion:
     - Check if `authStore.user?.member_id` matches a rendered node.
     - If found: Calculate viewport translation `(tx, ty)` to center the "Tôi" card in the container at standard zoom `1.0`.
     - If not found (unlinked user): Fall back to standard `fitView()`.
  2. Toolbar prompt: If `authStore.user` is logged in but `member_id` is null, show gentle info chip in `TreeView.vue`: *"Liên kết tài khoản của bạn với một thành viên trong cây để xem xưng hô gia đình."*

---

## 3. Test Expectations & Verification

- **Vitest Unit Tests**:
  - `web/src/test/kinship-badge.spec.ts` (NEW):
    - Assert `"Bản thân"` $\to$ `"Tôi"`.
    - Assert `"Ông nội"` $\to$ `"Nội"`, `"Bà ngoại"` $\to$ `"Ngoại"`.
    - Assert `"Con trai"` $\to$ `"Con"`.
  - `web/src/test/tree-node-card.spec.ts`:
    - Update life span assertions to expect `s. 1930` for living members.
    - Test that `node.avatar_url` error triggers fallback to initials.
    - Test that `isSelf` applies the `ring-tree-self-ring` class and renders `"Tôi"` badge.
    - Test that other nodes render relative kinship badges from `treeStore.kinshipLabels`.

---

## 4. Acceptance Criteria

- [ ] Cards render with clean white surfaces, subtle blue borders, and generation accent bars.
- [ ] Circular avatars display photos if valid; broken URLs fall back seamlessly to 2-letter initials, and error latch resets on URL change.
- [ ] Life dates display as `s. 1942` for living members and `1940 – 2015` for deceased members.
- [ ] Current user's card displays a distinct blue ring and "Tôi" badge.
- [ ] Other cards display abbreviated Vietnamese kinship badges (`Bố`, `Mẹ`, `Nội`, `Ngoại`, `Con`) with full terms in tooltips.
- [ ] Authenticated users can link their account to a card via "Đây là tôi" button without triggering card navigation.
- [ ] Bottom-right Compass navigation control enables 4-way panning and center reset.
- [ ] Tree auto-centers on "Tôi" node upon initial load when linked.
- [ ] All typography satisfies **INV-02** (line-height $\ge 1.45$).
