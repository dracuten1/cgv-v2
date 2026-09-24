# Vietnamese Family Tree View Redesign — Plan Overview

> **Target**: Comprehensive redesign of the `/tree` page in CGP v2 into an authentic Vietnamese family tree (Gia Phả) visualizer matching the approved reference design.
> **Scope**: Monorepo (`api/` Go REST backend, `web/` Vue 3 + Tailwind v4 SPA, shared contracts).
> **Input / Source of Truth**: `.agents/shared/planning/family-tree-view/decisions.md` (HEAD `a8dffff`, Decisions 1C, 2C, 3B, 4C, 5, 6).

---

## 1. Executive Summary & Design Specification

The redesigned `/tree` view displays ancestors and descendants across 4 generational tiers (top to bottom):
1. **Tier 1 (Đời 1)**: Both paternal and maternal grandparent **couples** placed side-by-side.
2. **Tier 2 (Đời 2)**: Parents and aunts/uncles with respective spouses.
3. **Tier 3 (Đời 3)**: Subject generation (self, siblings, cousins) with spouses; widest generational tiers in the middle.
4. **Tier 4 (Đời 4)**: Children/grandchildren.

### Visual Language & Card Styling
- **Cards**: Clean white cards (`#FFFFFF`, `--color-tree-card-bg`) with rounded corners (`rounded-lg`), subtle blue border (`#BFDBFE`, `--color-tree-card-border`), and hover elevation (`#60A5FA`, `--color-tree-card-border-hover`). Retains the 4px left accent bar (`--gen-1..4`) as a dual cue for generation tier alongside the blue frame.
- **Avatars**: Circular portrait avatar (sample/uploaded photo if `avatar_url` is present, falling back to 2-letter initials with robust `@error` image fallback).
- **Typography & Details**: Bold Vietnamese full name (`font-display font-semibold`, line-height $\ge 1.45$ strictly honoring **INV-02**), life span formatted per Vietnamese conventions: `s. 1942` for living members, `1940 – 2015` for deceased members.
- **Identity & Kinship**:
  - Authenticated user's node ("Tôi") is highlighted with a distinctive blue ring (`#2563EB`, `--color-tree-self-ring`) and "Tôi" badge (`#DBEAFE` background, `#1E40AF` text).
  - All other tree nodes display Vietnamese kinship badges relative to "Tôi" (e.g., `Bố`, `Mẹ`, `Nội`, `Ngoại`, `Anh`, `Chị`, `Em`, `Chồng`, `Vợ`, `Con`), computed via a high-performance batched backend endpoint and mapped through a lightweight abbreviation composable. Full canonical terms remain accessible in tooltips.
- **Orthogonal Connectors**:
  - Horizontal light-blue line (`#93C5FD`, `--color-tree-connector`, 2px) connecting spouses with a small filled circular junction indicator (`r = 3px`, `#3B82F6`, `--color-tree-connector-node`) at the midpoint.
  - Parent $\to$ children: Vertical T-junction drop starting from spouse midpoint (stem: vertical drop to intermediate distribution rail at `y_rail = parent.y + CARD_HEIGHT + 24`, 24px below the parent card bottom $\to$ horizontal distribution rail across sibling centers $\to$ vertical drops into each child top-center). Single-parent branches drop directly from bottom-center of the parent card.
- **Navigation & Controls**: Pan (drag/touch), zoom (wheel/pinch, 0.1x to 3x, buttons), "Đời thứ N" generation band headers, and a bottom-right navigation control (Compass / Pan-reset cluster) coexisting with existing Zoom +/−/Fit controls.

---

## 2. In-Scope vs. Out-of-Scope

### In-Scope
- **Backend**:
  - `005_unique_users_member_id.sql`: Unique partial index migration `idx_users_member_id_unique` on `users(member_id) WHERE member_id IS NOT NULL` (M1).
  - `GET /api/v1/families/:id/kinship-labels?from=&dialect=` batched kinship label computation leveraging cached `KinshipEngine` with current family version and `CalculateAllFrom`.
  - Invalidate kinship cache upon member mutations and Excel import (`engine.Invalidate(familyID)`).
  - `POST /api/v1/me/member` protected endpoint allowing authenticated users to bind `users.member_id` to a member node (with strict 5 M1 rules: demo-guard $\to$ 403, own NULL $\to$ 200, same $\to$ 200 idempotent, claimed by other $\to$ 409 conflict, missing member $\to$ 404).
  - Seed fixture updates linking seed avatar assets into `web/public/static/avatars/` with relative URL validation (`^/static/avatars/[A-Za-z0-9_-]+\.(png|svg|webp|jpg)$`).
  - Comprehensive Go tests for new endpoints in `api/internal/handler/handler_test.go` (including 403 demo-isolation, 409 conflict, idempotency, and cache invalidation).
- **Frontend**:
  - New theme tokens in `web/src/assets/main.css`: `--color-tree-*` blue palette in `@theme` and `:root`.
  - Client-side graph normalizer (`tree-graph-normalizer.ts` / updated `useTreeLayout.ts`) to pair root couples, include in-law spouses, and deterministically sort siblings by `birth_date ASC`.
  - Pure connector geometry composable `useTreeConnectors.ts` computing orthogonal spouse lines, midpoint junctions, and parent-child rails/drops with 100% Vitest coverage.
  - HTML5 Canvas connector renderer in `TreeVisualizer.vue` rendering orthogonal edges while preserving the `<300` DOM node budget.
  - Redesigned `TreeNodeCard.vue` with circular avatar (with `@error` fallback to initials), Vietnamese date notation (`s. 1942`), kinship badges, and "Tôi" blue ring styling.
  - "Đây là tôi" (Link account to this member) action directly accessible on the tree card menu/popover.
  - Bottom-right Compass / Pan-Reset navigation control component (`TreeCompassControl.vue`).
  - Auto-center / focus on "Tôi" node on initial load if linked, smoothly falling back to `fitView()`.
  - Pinia store integration (`stores/tree.ts` and `stores/auth.ts`).
  - Full test updates (Vitest specs + Playwright E2E `j1-tree.spec.ts`).

### Out-of-Scope (Explicitly Deferred)
- **Avatar File Upload Pipeline**: Multipart upload endpoint (`POST /members/:id/avatar`), disk storage service, and upload modals are deferred to a dedicated follow-up phase (Decision 1C). Static avatars in `web/public/static/avatars/` fulfill v1 requirements.
- **Account Settings Redesign**: Full settings page redesign is out of scope; identity linking is achieved via card action and `POST /me/member`.
- **Backend Tree Serialization Changes**: Backend payload `GET /families/:id/tree` schema is untouched; all couple pairing and in-law placement is normalized client-side (Decision 5).
- **Backend Graph Depth/Cycle Guard**: The Go backend has no verified DAG/cycle guard (only a DB self-loop check); cycle prevention is owned client-side by the frontend normalizer's `visitedSet` (per `phase2-plan.md:63`).

---

## 3. Architecture & Key Invariants

1. **INV-01 (Offline & Self-Hosted Assets)**: Zero external CDN font/image dependencies. Avatars live in `web/public/static/avatars/` and are precached by Vite PWA. Fonts remain `@fontsource`.
2. **INV-02 (Vietnamese Typography & Diacritics)**: Line-height $\ge 1.45$ maintained across all cards, badges, and tooltips so stacked Vietnamese tone marks (hỏi, ngã, nặng, sắc, huyền) never clip.
3. **INV-03 (Gender Enum Safety)**: Strict `toUiGender()` / `toApiGender()` conversions in `api/gender.ts` remain unchanged.
4. **Zero `v-html`**: All Vietnamese names, dates, and kinship terms rendered as bare DOM text; quotes or styling applied strictly via CSS.
5. **Strict DOM Budget ($\le 300$ Visible Cards)**: Orthogonal connectors are rendered onto a single unculled `<canvas>` element (Decision 4C). Visible card components are capped at $\le 300$ using viewport culling (1.5x buffer) and collapse to 14px dot buttons below 0.6x zoom. Connectors consume exactly 1 DOM node (the canvas).
6. **Pinia Invalidation Contract**: All member/identity mutations invalidate the tree store via `treeStore.invalidate()`.

---

## 4. Phase Overview & Phasing Table

The implementation is broken into four distinct, sequential, test-green phases:

| Phase | Title | Primary Focus | Key Deliverables | Risk Level |
|---|---|---|---|:---:|
| **Phase 1** | **Backend Delta & Data Contracts** | Kinship labels endpoint, user-member binding, unique index migration, cache invalidation, avatar validation, seed avatars, and store actions | `005_unique_users_member_id.sql`, `GET .../kinship-labels`, `POST /me/member`, `useKinshipBadge.ts`, Go handler tests (409 conflict, staleness), Pinia store methods, `web/public/static/avatars/` | **Low** |
| **Phase 2** | **Layout Engine & Orthogonal Connectors** | Root-couple pairing (FamilyUnit model), in-law prune/dedup, orthogonal geometry composable (M6 rail fix), both-endpoints visibility filter, canvas redraw with DPR guard | `useTreeConnectors.ts`, `FamilyUnit` graph normalizer in `useTreeLayout.ts`, `TreeVisualizer.vue` canvas loop (token cache, DPR backing-store guard), Vitest suites | **Medium** |
| **Phase 3** | **Card Redesign, Kinship Badges & Navigation** | Card visual styling, "Tôi" identity, kinship badge display, avatar error latch reset, compass control | Redesigned `TreeNodeCard.vue` (`@click.stop.prevent` on link, avatar error reset watcher), `TreeCompassControl.vue`, "Đây là tôi" link action | **Low** |
| **Phase 4** | **Integration, Verification & Quality Hardening** | Pinned test updates, E2E validation with mock login & member binding, invariant audit, and performance checks | Updated `tree-node-card.spec.ts` (`s. 1930`), `j1-tree.spec.ts` with mock-auth bind test, mobile viewport test, DOM budget verification ($\le 300$ cards, 1 canvas) | **Low** |

---

## 5. Dependency & Coupling Map

```
               [Phase 1: Backend Delta & Data Contracts]
               - GET /families/:id/kinship-labels
               - POST /me/member
               - Store actions (treeStore, authStore)
               - Seed avatar assets
                                 │
                                 ▼
               [Phase 2: Layout & Orthogonal Connectors]
               - Client-side root couple normalizer
               - In-law placement bugfix
               - useTreeConnectors.ts (Orthogonal geometry)
               - Canvas drawing loop (T-junctions & spouse midpoints)
                                 │
                                 ▼
               [Phase 3: Visual Cards, Identity & Navigation]
               - TreeNodeCard.vue redesign (tokens, borders, avatars)
               - Vietnamese date formatting ("s. 1942")
               - useKinshipBadge.ts & relative badge display
               - "Tôi" blue ring highlight & auto-centering
               - TreeCompassControl.vue & "Đây là tôi" card link
                                 │
                                 ▼
               [Phase 4: Integration, Hardening & E2E]
               - Update pinned test assertions (dates, chips)
               - E2E Playwright j1-tree.spec.ts verification
               - Invariant audit (INV-01, INV-02, INV-03, <300 DOM)
```

---

## 6. Consolidated Risk Register

| Risk ID | Description | Impact | Mitigation Strategy | Owner |
|---|---|---|---|---|
| **R-01** | Root couple pairing logic distorts subtree spacing | Children overlapping or excessively stretched across grandparent branches | Strict bounding box calculation in normalizer; 2-pass bbox layout (M10); dedicated Vitest coverage with multi-root family fixtures. | Frontend Lead |
| **R-02** | Avatar image load failure / 404 | Broken image icon inside circular card frame | Add `@error="hasAvatarError = true"` on `<img>` tag in `TreeNodeCard.vue`, falling back immediately to initials badge; watch `avatar_url` to reset latch (M12). | Frontend Lead |
| **R-03** | Canvas texture cliff on wide trees on iOS Safari | Browser crash or blank canvas if canvas surface exceeds backing-store limit | DPR scaling clamp (`dpr = min(devicePixelRatio, 2)`) and backing-store guard (`width * height <= 16_777_216` degrading to `dpr = 1` on overflow) to be implemented in Phase 2 (`phase2-plan.md:123-133`) (M11). | Frontend Lead |
| **R-04** | Pinned Vitest breakage due to date format change | CI pipeline failure on `tree-node-card.spec.ts` | Unified on `s. 1942` (with space); Phase 4 consciously updates test assertions from `"1930"` to `"s. 1930"` in lockstep with `card-visual.ts`. | QA / Test Engineer |
| **R-05** | Unlinked user experience degrades | Missing badges causing awkward card layout | Clean fallback: cards without kinship labels render cleanly with name and life dates; gentle prompt in toolbar. | Design / Frontend |
| **R-06** | Inadvertent DOM node budget breach | Performance degradation on mobile devices | Connectors remain 100% on Canvas (exactly 1 DOM node). Cards remain capped at $\le 300$ visible components via viewport culling. | Frontend Lead |
| **R-07 (MR-01)** | Public kinship-labels endpoint CPU load / spam | Kinship calculation denial of service | Cache graph per `(familyID, version)`; add basic rate-limiting or throttle on public route; batched endpoint computes all labels in one graph traversal pass. | Backend Lead |
| **R-08 (MR-02)** | Concurrent double-linking of `users.member_id` | Multiple users claim the same tree node | Partial unique index migration `005_unique_users_member_id.sql` guarantees single claimant; backend rejects conflicts with HTTP 409 (M1). | Backend Lead |
| **R-09 (MR-03)** | Generation filter hides endpoint node, causing connector visual defect | Dangling connector lines pointing to empty canvas space | Both-endpoints-visible invariant in `useTreeConnectors`: suppress parent-child or spouse edge if either endpoint is filtered out (M9). | Frontend Lead |
| **R-10 (MR-04)** | Vietnamese diacritics clipping on compact badges | Stacked marks on "Nội" / "Ngoại" clipped by chip padding | Enforce **INV-02** line-height $\ge 1.45$ on badge classes (`leading-normal` or `leading-relaxed`, avoiding `py-0.2` tight constraints). | Design / Frontend |
| **R-11 (MR-05)** | E2E tests cannot assert "Tôi" ring on demo accounts | CI unable to test self-badge or auto-center in automated runs | Mock login provisioning in Playwright helper executes `POST /api/v1/me/member` binding step before navigating to `/tree` (M13). | QA / Test Engineer |

---

## 7. Overall Acceptance Criteria

- [ ] **Vietnamese Layout Fidelity**:
  - Generation 1 displays paternal and maternal grandparents as paired couples side-by-side.
  - In-law spouses properly placed adjacent to their partners with zero phantom gaps.
  - Sibling arrays sorted deterministically by `birth_date ASC` (fallback to `full_name`).
- [ ] **Connector Geometry**:
  - Horizontal spouse connectors render with light blue `#93C5FD` and a junction dot at midpoint (`r = 3px`, `#3B82F6`).
  - Parent-child connectors render as clean orthogonal T-junctions (rail at `parent.y + CARD_HEIGHT + 24` $\to$ child drops).
- [ ] **Card Appearance & Details**:
  - Cards feature a clean white surface, thin blue border (`#BFDBFE`), and 4px generation accent bar.
  - Circular avatar displays image if available, with immediate fallback to initials on error or missing URL.
  - Life dates follow `s. 1942` for living and `1940 – 2015` for deceased.
- [ ] **Kinship & "Tôi" Identity**:
  - Authenticated user's node displays "Tôi" badge and distinct blue ring (`#2563EB`).
  - Tree nodes display correct abbreviated Vietnamese kinship badges (`Bố`, `Mẹ`, `Nội`, `Ngoại`, `Con`, etc.) relative to "Tôi".
  - Unlinked users see a prompt to link their identity, and cards render cleanly without badges.
  - Authenticated user can link their identity directly via "Đây là tôi" button on the card.
- [ ] **Navigation & Performance**:
  - Tree includes bottom-right Compass / Pan-reset control alongside zoom buttons.
  - Auto-centers on "Tôi" node upon tree load if present.
  - Total visible card components $\le 300$; connectors consume exactly 1 DOM node (canvas).
- [ ] **Quality & Invariants**:
  - All existing and new Go tests pass (`go test ./...`).
  - All Vitest unit tests pass (`npm run test:unit`).
  - Playwright E2E tests pass (`npx playwright test e2e/specs/j1-tree.spec.ts`).
  - Zero `v-html` additions; line-height $\ge 1.45$ verified on all typography.
