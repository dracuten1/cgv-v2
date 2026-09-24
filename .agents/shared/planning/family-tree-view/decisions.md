# Technical Decisions: Vietnamese Family Tree View Redesign (`/tree`)

## Context

The `/tree` view in CGP v2 is undergoing a comprehensive architectural redesign to match a reference Vietnamese gia phả (genealogy) chart. The target experience organizes ancestors across four generational tiers (Đời 1: Grandparents — both paternal and maternal branches side-by-side; Đời 2: Parents; Đời 3: Subject generation with spouses; Đời 4: Grandchildren). Visual styling requires white rounded cards with a subtle blue accent border, circular avatars (custom photo if uploaded, falling back to initials), Vietnamese life date conventions (`s. 1942` for living, `1940 – 2015` for deceased), and personal kinship badges calculated relative to the authenticated user ("Tôi" highlighted with a distinct ring). Connector geometry demands clean, orthogonal, light-blue lines: horizontal spouse segments with midpoint indicators and vertical T-junction parent-child drops.

This document formalizes technical decisions and architectural constraints to serve as the direct technical input for subsequent phase planning.

---

## Verified Codebase Evidence (HEAD `a8dffff`)

Before formulating decisions, key structural facts were verified across backend and frontend repositories:

1. **Avatar Storage & Serving**:
   - `members.avatar_url TEXT` already exists in PostgreSQL (`api/migrations/002_create_genealogy_tables.sql:23`), Go model (`api/internal/model/member.go:17`), API DTO (`api/internal/model/api.go:42`), and frontend types (`web/src/types/api.ts:96-107`).
   - `TreeNodeCard.vue:52-58` already contains an avatar rendering branch: `<img v-if="node.avatar_url" :src="node.avatar_url">` falling back to initials initials logic in `card-visual.ts`.
   - Seed fixtures (`api/internal/seed/fixture.go`) reference dangling paths like `/static/avatars/*.png`, but no HTTP static router exists in `router.go` and no upload endpoint exists.

2. **User Identity & Member Binding ("Tôi")**:
   - `users.member_id UUID` exists in PostgreSQL (`001_create_users_and_identities.sql`, foreign key in `002_create_genealogy_tables.sql:53-56` with `ON DELETE SET NULL`).
   - Go `UserStore.LinkMember(ctx, userID, memberID)` interface is declared (`api/internal/auth/ports.go:74`) and implemented in SQL (`api/internal/repository/auth/user_repo.go:133-137`).
   - `GET /me` already serializes `member_id` (`api/internal/handler/auth_handler.go:222-236`).
   - There is currently **zero production caller** or write endpoint to set `users.member_id` from client interactions.

3. **Kinship Computation**:
   - `GET /api/v1/kinship?from=&to=&dialect=` exists (`api/internal/handler/kinship_handler.go`), backing `KinshipEngine` with BFS LCA and Dijkstra traversal, cached per `(family_id, version)` via `engine.GetGraph(ctx, familyID, version)` (`api/internal/kinship/engine.go:23-43`).
   - `lexicon_bac.json` term coverage:
     - Tier 0: "Anh", "Chị", "Em", "Bản thân", "Chồng", "Vợ", "Anh rể", "Chị dâu", "Em rể", "Em dâu".
     - Tier +1: "Bố", "Mẹ", "Bác", "Chú", "Cô", "Cậu", "Dì", "Thím", "Mợ".
     - Tier +2: "Ông nội", "Bà nội", "Ông ngoại", "Bà ngoại".
     - Tier -1: "Con trai", "Con gái", "Cháu", "Con rể", "Con dâu".
     - Tier -2: "Cháu nội", "Cháu ngoại".

4. **Tree Visualizer & Layout**:
   - `TreeVisualizer.vue:156-190` renders edges using a single `<canvas>` element with `ctx.setLineDash([4,3])` for straight spouse links and cubic bezier curves for parent-child links. Cards are HTML elements rendered on top with culling.
   - `useTreeLayout.ts:200-216, 267-285`: Spouses that only exist in `spouse_ids` and are not root members themselves are currently skipped or leave gap reservations. Multiple roots render side-by-side at `cursorX += w + X_GAP` (`:260-263`).
   - `card-visual.ts:6-14` (initials) and `:16-28` (years): Years are formatted as `1930 – 2001`, `1930`, or `– 2001`. The prefix `s.` does not exist today. Unit tests in `web/src/test/tree-node-card.spec.ts:59,65` pin exact strings.
   - Design tokens in `web/src/assets/main.css:14-40` use cream and terracotta palettes. **No blue tokens** currently exist in `@theme`.

---

## Decision 1: Avatar Strategy

### Options Considered
- **Option 1A: Initials-only styled circular avatar.**
  - *Description*: Keep rendering two-letter initials computed via `card-visual.ts:6-14` inside a styled circular badge. Disregard image uploads and photos entirely.
  - *Pros*: Zero backend delta; zero file storage risk; strictly compliant with offline PWA constraints.
  - *Cons*: Fails reference design fidelity (the approved spec explicitly asks for photos with fallback to initials).
- **Option 1B: Full photo pipeline (upload + storage + disk serving).**
  - *Description*: Add an avatar multipart upload handler in Go, local disk storage volume in Docker Compose, static asset serving in Gin (`r.Static("/static", ...)`), and an upload modal in the frontend.
  - *Pros*: Complete end-user feature allowing profile photo uploads.
  - *Cons*: Heavy effort (new storage package, config keys, volume permissions, multipart validation, image resizing/sanitization); high regression risk; expands scope significantly beyond tree visualizer redesign.
- **Option 1C (Recommended): Hybrid approach — Initials default + `avatar_url` rendering support (v1 static bundled/URL; v2 full upload).**
  - *Description*: Leverage the existing `avatar_url` field on `TreeNode` and `Member`. Ship seed/sample images directly in `web/public/static/avatars/` so Vite serves them locally without backend changes. Ensure `TreeNodeCard.vue` cleanly renders `avatar_url` with strict image fallback handlers (`@error="showFallback = true"`). Support editing `avatar_url` via existing `PUT /members/:id`. Defer the dedicated `POST /members/:id/avatar` upload route to a follow-up phase.

### Recommendation & Rationale
**Adopt Option 1C.**
- *Effort vs Fidelity vs Risk*: High fidelity at low risk. Since `members.avatar_url` is already modeled in Go and `TreeNodeCard.vue:52-58` already supports image rendering, delivering static avatars via Vite's public asset directory (`web/public/static/avatars/`) fulfills reference design requirements immediately for demo and seed datasets without introducing filesystem mutation or multipart upload vulnerabilities into the Go backend.
- *Constraint Compliance*: Complies with **INV-01** (offline PWA) because assets placed in `web/public/` are pre-cached by Vite PWA plugins. Avoids external CDN dependencies.

### Backend Delta
- **v1**: None. The existing `PUT /api/v1/members/:id` endpoint already accepts `avatar_url` in `MemberInput` (`api/internal/handler/tree_handler.go:228`).
- **v2 (Follow-up upload option)**:
  - New route: `POST /api/v1/members/:id/avatar` in `api/internal/handler/avatar_handler.go`.
  - Max multipart limit: 5MB (deliberate: avatar portraits are small compressed images, unlike the 15MB limit allocated for complex multi-sheet Excel documents).
  - Storage service: `api/internal/storage/local.go`.
  - Router configuration: `r.Static("/static/uploads", cfg.UploadDir)` in `router.go`.

### Plan Consequences
Phase plans must include:
1. Creation of placeholder avatar graphics in `web/public/static/avatars/`.
2. Hardening `TreeNodeCard.vue` with an error state fallback to initials if the image fails to load.
3. Updating seed data/mock profiles to point to valid local relative paths (`/static/avatars/...`).

---

## Decision 2: Relationship Kinship Labels

### Options Considered
- **Option 2A: Client-side N+1 query calling `GET /api/v1/kinship?from=Tôi&to=:id`.**
  - *Description*: For every rendered tree node, issue an individual HTTP request to the kinship endpoint.
  - *Pros*: Reuses existing endpoint without new Go code.
  - *Cons*: Severe performance bottleneck. A tree with 50 nodes would trigger 50 concurrent requests on load, causing network congestion, UI jank, and thrashing the kinship engine lock.
- **Option 2B: Pure client-side computation from tree edges.**
  - *Description*: Reimplement kinship calculation logic in TypeScript within Vue composables.
  - *Pros*: Zero network calls after tree load.
  - *Cons*: Violates single source of truth. Kinship rules in Vietnamese are complex (dialect nuances: Bắc vs Trung vs Nam, affinal distinctions like Thím vs Mợ, elder vs younger distinctions). Duplicating this in frontend code creates drift and maintenance hazards.
- **Option 2C (Recommended): Batched kinship label endpoint `GET /api/v1/families/:id/kinship-labels?from=&dialect=`.**
  - *Description*: Introduce an endpoint that accepts a reference member ID (`from`) and returns a flat mapping of member IDs to Vietnamese relation badges: `{"labels": {"<member-id>": "Bố", "<member-id>": "Mẹ", ...}}`.
  - *Pros*: Single network request on tree load; reuses the existing, cached `KinshipEngine` graph in Go; respects user dialect preference (`bac`, `trung`, `nam`).
  - *Cons*: Small backend addition (one handler method, route registration, and test).

### Lexicon Coverage & Term Surface
Inspection of `api/internal/kinship/lexicon_bac.json` confirms:
- Direct parents: "Bố", "Mẹ" (line 22-23).
- Grandparents: "Ông nội", "Bà nội", "Ông ngoại", "Bà ngoại" (lines 8-11).
- Siblings: "Anh", "Chị", "Em" (lines 26-29).
- Spouses: "Chồng", "Vợ" (lines 56-57).
- Children: "Con trai", "Con gái" (lines 34-35).
- Self: "Bản thân" (line 4).

*Lexicon Gaps & Term Mapping*:
The reference design asks for shortened badges (e.g., "Nội" / "Ngoại" instead of "Ông nội" / "Bà ngoại", "Con" instead of "Con trai" / "Con gái", and "Tôi" instead of "Bản thân").
- The backend engine returns canonical terms ("Ông nội", "Bản thân", "Con trai").
- A lightweight frontend badge formatter composable (`useKinshipBadge.ts`) will map canonical terms to the display badges specified by the UI design ("Bản thân" → "Tôi", "Con trai" / "Con gái" → "Con", "Ông nội" / "Bà nội" → "Nội", "Ông ngoại" / "Bà ngoại" → "Ngoại") while preserving full terms in card tooltips.

### Unlinked User Fallback
When `auth.user.member_id` is `null` (user has not linked their profile to a tree node):
- No kinship badges are displayed on cards.
- The UI gracefully falls back to displaying generation markers ("Đời thứ N") and names only.
- A subtle banner or indicator in the toolbar prompts: *"Liên kết tài khoản của bạn với một thành viên trong cây để xem xưng hô gia đình."*

### Backend Delta
- **New Handler Method**: In `api/internal/handler/kinship_handler.go`, add `GetFamilyKinshipLabels(c *gin.Context)`.
- **Logic**: Retrieve `family_id` from URL, `from` (member UUID) from query, and `dialect` (defaulting to `bac`). Obtain family current version from `families` repository. Fetch graph from `h.engine.GetGraph(ctx, familyID, version)`. Use `h.engine.CalculateAllFrom(g, from, dialect)` (new engine method) to traverse connected nodes and populate the map.
- **Route**: `r.GET("/families/:id/kinship-labels", h.GetFamilyKinshipLabels)` in `api/internal/handler/router.go`.
- **Response DTO**: `KinshipLabelsResponse { FamilyID: string, From: string, Dialect: string, Labels: map[string]string }`.

### Plan Consequences
1. Backend phase task: Implement batched endpoint and unit tests in `kinship_handler_test.go`.
2. Frontend phase task: Add `fetchKinshipLabels(familyId, fromMemberId)` to `tree.ts` Pinia store.
3. Add `useKinshipBadge.ts` for clean term abbreviation.

---

## Decision 3: "Tôi" (Current User) Identity Mapping & Binding

### Options Considered
- **Option 3A: Frontend-only mapping using existing `auth.user.member_id` without write capability (manual seed / SQL link).**
  - *Description*: Match `auth.user?.member_id === node.id` to apply the "Tôi" ring and kinship root. Linking is done out-of-band via database seeding.
  - *Pros*: Zero backend code additions.
  - *Cons*: Cannot be demonstrated or updated by users via the application interface; fragile manual workflow.
- **Option 3B (Recommended): Frontend matching + lightweight `POST /api/v1/me/member` binding endpoint.**
  - *Description*:
    1. Frontend `TreeNodeCard.vue` checks `const isSelf = computed(() => authStore.user?.member_id === props.node.id)`. When true, applies the blue highlight ring (`ring-2 ring-tree-self-ring border-tree-self-border`) and "Tôi" badge.
    2. Backend provides a clean `POST /api/v1/me/member` endpoint taking `{ "member_id": "uuid" }` to allow authenticated users to link their account to a tree node.
  - *Pros*: Leverages existing database schema (`users.member_id` column and `UserStore.LinkMember` port already exist); provides complete end-to-end functionality.
  - *Cons*: Requires one new API route and controller handler.
- **Option 3C: Complex claim/verification workflow with administrative approval.**
  - *Description*: Members must request linkage, which family managers approve.
  - *Pros*: Enterprise security against identity impersonation.
  - *Cons*: Vast scope creep for an internal family tree viewer feature.

### Fallback & Scope Boundary
- **Fallback UX**: If `authStore.user?.member_id` is null or does not match any node in the active family tree, no node receives the "Tôi" highlight, auto-centering centers on the generation 1 root, and kinship badges are hidden.
- **Scope Guard & Strict Linking Rules (M1 - 5 Enumerated Rules)**:
  1. **Demo Isolation Guard**: If user is a demo account (`user.is_demo == true`) $\to$ reject with `403 Forbidden` (`CodeDemoIsolationViolation`, `auth.ErrDemoIsolation`). Demo accounts are NEVER linkable to real members.
  2. **Missing Member**: If requested `member_id` does not exist in `members` table $\to$ return `404 Not Found`.
  3. **Idempotent Self-Link**: If user is already linked to the *same* requested `member_id` $\to$ return `200 OK` (idempotent no-op).
  4. **Claim Conflict**: If requested `member_id` is already claimed by *another* user $\to$ reject with `409 Conflict`.
  5. **Unlinked Claim**: If user's own `member_id` is `NULL` $\to$ successfully link to requested member (`200 OK`).
  - Adding a link action directly on the tree card menu ("Đây là tôi" button on member details or card popover) is included in the tree plan. Full account settings page redesign is deferred to a follow-up.

### Backend Delta
- **Migration (M1)**: Add `api/migrations/005_unique_users_member_id.sql` with:
  ```sql
  CREATE UNIQUE INDEX idx_users_member_id_unique ON users(member_id) WHERE member_id IS NOT NULL;
  ```
- **Handler**: Add `LinkMember(c *gin.Context)` to `api/internal/handler/auth_handler.go`.
  - Check demo status: if `user.IsDemo` $\to$ return 403 `model.CodeDemoIsolationViolation`.
  - Validate `member_id` belongs to a valid member (404 on miss).
  - Enforce M1 binding rules (missing = 404, same link = 200, claimed by other = 409, unlinked = 200).
  - Route through `auth.Service` wrapping rules and calling `LinkMember(ctx, userID, memberID)` in `api/internal/repository/auth/user_repo.go`.
  - Return updated `auth.UserProfile` (uniform with `GetMe`).
- **Router**: Register `POST /api/v1/me/member` inside the protected JWT group in `api/internal/handler/router.go`.
- **Unit Tests**: Add `TestLinkMember_Success`, `TestLinkMember_Idempotent`, `TestLinkMember_Conflict_409`, `TestLinkMember_NotFound`, and `TestLinkMember_DemoIsolation_403` in `api/internal/handler/handler_test.go`.

### Plan Consequences
1. Add `linkSelfToMember(memberId: string)` action to `web/src/stores/auth.ts`.
2. In `TreeNodeCard.vue`, bind visual ring tokens conditionally to `isSelf`.
3. In `TreeVisualizer.vue`, implement auto-focus on `isSelf` node on initial load if present, coexisting with `fitView()`.

---

## Decision 4: Connector Geometry & Rendering (Canvas vs. SVG)

### Options Considered
- **Option 4A: Keep HTML5 Canvas, upgrade `drawEdges()` to orthogonal T-junctions.**
  - *Description*: Retain the single unculled `<canvas>` element in `TreeVisualizer.vue:156-190`. Replace current dashed line / bezier curves with straight horizontal lines between spouses and orthogonal 90-degree step lines (T-junctions) from spouse midpoints to children.
  - *Pros*: High rendering performance (zero additional DOM nodes); guarantees strict compliance with the `<300` DOM node budget; canvas redraws only when layout or zoom transforms settle.
  - *Cons*: Canvas lines cannot be styled directly with Tailwind CSS classes; no DOM inspection for edge debug.
- **Option 4B: Replace Canvas with an SVG overlay.**
  - *Description*: Replace `<canvas>` with an `<svg>` element containing `<line>` and `<path>` tags for all connectors.
  - *Pros*: Declarative markup; can use Tailwind stroke classes; sharp vector rendering without DPR scaling math.
  - *Cons*: Violates DOM budget constraints for large trees (100 members with 150 edges adds 150 unculled SVG DOM nodes, risking frame drops on low-end mobile devices).
- **Option 4C (Recommended Hybrid Architecture): Decoupled edge geometry composable + Canvas renderer as default, with clean SVG interface boundary.**
  - *Description*:
    1. Extract edge routing mathematics into a pure, testable composable: `useTreeConnectors.ts`. This calculates exact orthogonal paths (spouse horizontal link, midpoint junction coordinate `(mx, my)`, drop stem, and child distribution forks).
    2. Render via **HTML5 Canvas** as the primary engine in `TreeVisualizer.vue` to safeguard the DOM budget.
    3. Define edge geometry as standardized data structures (`OrthogonalEdge { type, segments: [{x1,y1,x2,y2}], midpoint?: {x,y} }`) so that transitioning to or providing an SVG overlay requires only switching a presentation component without altering layout calculations.

### Geometric Specification for Reference Design
1. **Spouse Connector**:
   - A straight horizontal line connecting `(nodeA.x + CARD_WIDTH, nodeA.y + CARD_HEIGHT / 2)` to `(nodeB.x, nodeB.y + CARD_HEIGHT / 2)`.
   - Color: Light blue `#93C5FD` (`--color-tree-connector`). Stroke width: `2px`.
   - Small filled circular junction indicator at midpoint: `radius = 3px` at `((x1 + x2)/2, y)`.
2. **Parent-Child Connector (T-Junction) (M6)**:
   - Rail coordinate (M6 fix): `y_rail = parent.y + CARD_HEIGHT + 24` (24px below card bottom, NOT `parentMidpoint.y + 24`).
   - Stem: Vertical line beginning at spouse midpoint `(mx, my)` dropping down to `y_rail`.
   - Rail: Horizontal bar spanning from leftmost child center to rightmost child center at `y_rail`.
   - Drops: Vertical line from `y_rail` down to each child node top-center `(child.x + CARD_WIDTH / 2, child.y)`.
   - Single-parent case: Stem drops directly from parent card bottom-center `(parent.x + CARD_WIDTH / 2, parent.y + CARD_HEIGHT)` to `y_rail`.

### Plan Consequences
1. Phase plan must create `web/src/composables/useTreeConnectors.ts` with comprehensive Vitest coverage for T-junction coordinates and multi-child branching.
2. Update `TreeVisualizer.vue` canvas rendering loop to execute the orthogonal draw instructions using new blue tokens.

---

## Decision 5: Layout Engine & Tree Payload Semantics

### In-Law and Root-Couple Placement
*Problem Identified in Research*: In `useTreeLayout.ts:200-216, 272-273`, spouse nodes that are only present in `spouse_ids` and are not independent roots are skipped, leaving empty gaps. Furthermore, the Go backend `GET /api/v1/families/:id/tree` emits roots as any member without parents in `parent_child`. When both grandparents of a family are roots, they are emitted as disjoint roots, and `useTreeLayout.ts:260-263` renders them as separate trees side-by-side rather than a paired couple.

### Resolution
- **Pure Client-Side Normalization**: Do not alter the backend `GET /api/v1/families/:id/tree` JSON contract. Modifying tree serialization risks breaking existing consumers (such as Excel export/import and kinship paths).
- **Client Graph Normalizer (`tree-graph-normalizer.ts`)**:
  1. Build a local member map across all generations and roots.
  2. For Generation 1 (roots), identify married pairs via `spouse_ids`. Treat the primary lineage member as the primary root and synthesize the spouse as a co-located partner block.
  3. Ensure Tier 1 places paternal grandparents and maternal grandparents as two distinct couple blocks placed side-by-side (`cursorX` advance).
  4. Children sorting: Sort sibling arrays deterministically by `birth_date ASC` (fallback to `full_name`).

### Plan Consequences
1. Create `web/src/composables/useTreeLayoutNormalizer.ts` (or expand `useTreeLayout.ts`).
2. Fix the gap bug where `spousePos` lookup fails for in-law spouses.
3. Add unit test in `web/src/test/tree-layout.spec.ts` asserting that married root couples render adjacent with horizontal spacing `X_GAP / 2`.

---

## Decision 6: Design Tokens & Palette Delta

### Current Theme Constraints
`web/src/assets/main.css:14-40` configures Tailwind v4 via `@theme`. Current colors are strictly `--color-cream-*`, `--color-terracotta-*`, `--color-slate-*`, and `--color-gen-1..4`.
There are **zero blue tokens** in `@theme`. Terracotta (`#C85A32`) is heavily used for buttons, focus rings, and active filters.

### Approved Design Tokens Addition
To satisfy the reference design (blue card borders, blue connectors, blue "Tôi" ring) while preventing ad-hoc hex sprawl and honoring **INV-01**:

```css
@theme {
  /* Existing tokens preserved... */

  /* Vietnamese Genealogy Tree Blues */
  --color-tree-bg: #F8FAFC;              /* slate-50 canvas background */
  --color-tree-card-bg: #FFFFFF;         /* clean white card surface */
  --color-tree-card-border: #BFDBFE;     /* blue-200 subtle card border */
  --color-tree-card-border-hover: #60A5FA; /* blue-400 interactive hover */
  --color-tree-connector: #93C5FD;       /* blue-300 orthogonal lines */
  --color-tree-connector-node: #3B82F6;  /* blue-500 junction dots */
  --color-tree-self-ring: #2563EB;       /* blue-600 "Tôi" highlight ring */
  --color-tree-self-badge: #DBEAFE;      /* blue-100 "Tôi" badge background */
  --color-tree-self-text: #1E40AF;       /* blue-800 "Tôi" badge text */
}

:root {
  --tree-connector: #93C5FD;
  --tree-connector-node: #3B82F6;
  --tree-self-ring: #2563EB;
}
```

### Generation Accents & Vietnamese Copy Conventions
1. **Preserve Generation Color Bands**: Keep `--color-gen-1..4` tokens and band chips ("Đời thứ N"). The left 4px accent border on `TreeNodeCard.vue` should be retained or adapted to harmonize with the thin blue card border, providing a dual cue: generation tier via accent bar and family membership via blue frame.
2. **Vietnamese Date Notation**:
   - Living member: `"s. " + birthYear` (e.g., `s. 1942`).
   - Deceased member: `birthYear + " – " + deathYear` (e.g., `1940 – 2015`).
   - Missing birth year, deceased: `"? – " + deathYear`.
   - Update `card-visual.ts:getYearsText()` and deliberately adjust the pinned test assertion in `web/src/test/tree-node-card.spec.ts:59,65`.

---

## Consolidated Backend Delta Summary

| Component | File Path | Change Description | Schema / Migration |
|---|---|---|---|
| **Migration** | `api/migrations/005_unique_users_member_id.sql` | Add partial unique index on `users(member_id) WHERE member_id IS NOT NULL` (M1) | `idx_users_member_id_unique` |
| **Auth** | `api/internal/handler/auth_handler.go` | Add `LinkMember(c *gin.Context)` enforcing 5 M1 linking rules (demo-guard 403, missing 404, idempotent 200, conflict 409, unlinked 200) | Column exists |
| **Router** | `api/internal/handler/router.go` | Register `POST /api/v1/me/member` in protected route group | None |
| **Router** | `api/internal/handler/router.go` | Register `GET /api/v1/families/:id/kinship-labels` in public group | None |
| **Kinship** | `api/internal/handler/kinship_handler.go` | Add `GetFamilyKinshipLabels` using `CalculateAllFrom` with current family version | None |
| **Kinship Engine** | `api/internal/kinship/service.go` | Invalidate kinship cache on member CRUD and Excel import (`engine.Invalidate(familyID)`) | None |
| **Tests** | `api/internal/handler/handler_test.go` | Add tests for `POST /me/member` (incl. 403 demo-isolation, 409 conflict, idempotent) and `GET /families/:id/kinship-labels` | None |

*Total Backend Impact*: 6 modified/added files, 1 new migration (`005_unique_users_member_id.sql`).

---

## Decision Summary Table

| Area | Decision | Key Rationale | Risk / Caveat |
|---|---|---|---|
| **Avatar Strategy** | Hybrid (Option 1C): Initials default + `avatar_url` static rendering. Full upload deferred. | Delivers full visual fidelity without backend storage risk; compliant with INV-01 offline PWA. | Seed avatars must use relative URLs (`/static/avatars/...`). |
| **Kinship Labels** | Batched API (Option 2C): `GET /families/:id/kinship-labels?from=&dialect=`. | Single HTTP request, reuses cached Go BFS/Dijkstra engine, avoids client code duplication. | Minor abbreviation mapping in frontend ("Bản thân" → "Tôi"). |
| **"Tôi" Identity** | Option 3B: Match `auth.user.member_id` + `POST /api/v1/me/member` + unique index migration (M1 with 5 rules). | Reuses existing SQL repository; enforces 1:1 user-member binding; guards demo isolation (403); handles 409 conflict. | Fallback gracefully when `member_id` is null (badges hidden). |
| **Connectors** | Option 4C: Canvas renderer with extracted `useTreeConnectors` math interface (M6 rail fix). | Guarantees strict compliance with ≤300 visible card components; midpoint junction dot radius r = 3px; rail at `parent.y + CARD_HEIGHT + 24`. | High-DPI canvas scaling must guard backing-store budget (M11). |
| **Tree Layout** | Client Normalizer: Pair Generation 1 roots into side-by-side couple blocks. | Avoids breaking existing `/tree` payload contract used by Excel/Kinship tools. | Frontend must sort children deterministically by birth date. |
| **Tokens & Styling** | Define semantic `--color-tree-*` blue tokens in Tailwind v4 `@theme`. | Prevents hex sprawl; keeps terracotta for buttons/forms while adopting blue reference design. | Update `tree-node-card.spec.ts` for `"s. "` birth date prefix. |
| **Public Route Load (MR-01)** | Batched label endpoint caching per `(family_id, version)`. Dedicated rate-limiting DEFERRED. | Leader deferred active rate-limiting to follow-up; kinship engine's version-keyed cache provides current mitigation against duplicate graph builds. | Follow-up initiative will introduce IP/token rate limits if needed. |
