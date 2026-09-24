# Phase 4 Plan: Integration, Verification & Quality Hardening

> **Phase**: 4 of 4
> **Objective**: Update pinned test suites, verify Playwright end-to-end user flows with mock authentication and member binding, perform invariant audits (INV-01, INV-02, INV-03, $\le 300$ visible card components), and ensure the entire feature branch is green and ready for production merge.
> **Status**: Depends on Phase 1, Phase 2, & Phase 3
> **Binding Decisions**: All decisions (1C through 6), Architectural Invariants (INV-01, INV-02, INV-03).

---

## 1. Scope & Touched Files

### Frontend Tests & Specs
- `web/src/test/tree-node-card.spec.ts`: Update pinned string assertions (lines 59, 65) for `s. YYYY` format and verify chip/badge contracts.
- `web/src/test/tree-culling.spec.ts`: Re-verify viewport culling and strict $< 300$ DOM node ceiling under full orthogonal card layout.
- `web/src/test/tree-view.spec.ts`: Assert toolbar prompt for unlinked users and integration with kinship labels store.
- `e2e/specs/j1-tree.spec.ts`: Update Playwright E2E assertions for new card visual classes, "Tôi" ring, and compass navigation.

### Quality & Audits
- Invariant Audit across all modified files:
  - **INV-01**: Verification of asset self-hosting and zero CDN calls in network tabs.
  - **INV-02**: Verification of line-height $\ge 1.45$ across all updated cards and badge elements.
  - **INV-03**: Gender enum mapping fidelity (`toUiGender` / `toApiGender`).
  - **Zero `v-html`**: Codebase grep to ensure zero unsafe HTML rendering.

---

## 2. Detailed Task Breakdown

### Task 4.1: Update Pinned Unit Tests in `tree-node-card.spec.ts`
- **Anchor**: `web/src/test/tree-node-card.spec.ts:59, 65, 112`.
- **Requirements**:
  1. Consciously update test assertions pinned to legacy date formats:
     - Old: `expect(wrapper.find('[data-testid="years-text"]').text()).toBe('1930')`
     - New: `expect(wrapper.find('[data-testid="years-text"]').text()).toBe('s. 1930')`
  2. Verify deceased date range remains unchanged: `1930 – 2001`.
  3. Ensure collapsed state test (`wrapper.props({ collapsed: true })`) verifies that the dot button aria-label includes the full name and generation, while details remain unmounted.
  4. Run `npm test -- web/src/test/tree-node-card.spec.ts` (using existing package.json `"test": "vitest run"` script) and verify 100% green.

### Task 4.2: Update & Verify Playwright E2E Suite (`j1-tree.spec.ts`)
- **Anchor**: `e2e/specs/j1-tree.spec.ts` & Leader Ruling K4 / M13.
- **Requirements**:
  1. Inspect existing journey assertions in `j1-tree.spec.ts`:
     - Verifies tree loads family successfully (`[data-testid="tree-family-name"]`).
     - Verifies generation filters (`[data-testid^="filter-gen-"]`).
     - Verifies generation band labels ("Đời thứ N").
  2. **Executable "Tôi" Identity Flow (K4)**:
     - In Playwright test flow:
       a. Perform mock (non-demo) login via helper script (`auth.setup.ts` / mock OAuth callback).
       b. Execute API call `POST /api/v1/me/member` linking authenticated user to a known seed member (e.g., subject member in Generation 3).
       c. Reload `/tree`.
       d. Assert that "Tôi" badge (`[data-testid="self-badge"]`) is rendered with text "Tôi".
       e. Assert that the "Tôi" card displays the blue ring highlight (`ring-tree-self-ring`).
       f. Assert that auto-centering has fired to focus viewport around the "Tôi" card.
  3. **Visual & Navigation Assertions**:
     - Verify bottom-right Compass control is visible and functional (`[data-testid="tree-compass"]`).
     - Verify clicking Compass North/South/East/West buttons pans the visualizer canvas.
     - Verify kinship badges (`[data-testid="kinship-badge"]`) appear on related ancestor nodes (e.g. "Bố", "Mẹ", "Nội").
  4. Run full E2E test against local Docker stack (`npx playwright test e2e/specs/j1-tree.spec.ts`).

### Task 4.3: Strict Invariant & Performance Audits
- **Requirements**:
  1. **INV-01 (Offline & Self-Hosted Assets)**:
     - Verify `web/public/static/avatars/` assets load locally.
     - Grep `web/` for any external `http://` or `https://` asset URLs.
  2. **INV-02 (Vietnamese Typography & Tone Marks)**:
     - Check `TreeNodeCard.vue`, `useKinshipBadge.ts`, and `TreeCompassControl.vue`.
     - Confirm all textual wrappers maintain `line-height >= 1.45` (e.g. `leading-normal` or `leading-relaxed`). No tight leading (`leading-none`, `leading-tight`) on Vietnamese text. Ensure chip badges avoid clipping stacked diacritics on "Nội" / "Ngoại".
  3. **INV-03 (Gender Enum Conformance)**:
     - Confirm `toUiGender()` and `toApiGender()` in `api/gender.ts` remain the single point of conversion for gender fields.
  4. **DOM Budget Check ($\le 300$ Visible Cards, 1 Canvas Node)**:
     - Execute `tree-culling.spec.ts`.
     - Measure visible component count on family with 100+ members. Confirm rendered card components never exceed 300 nodes during pan and zoom, and connectors consume exactly 1 canvas DOM node.

### Task 4.4: Full Monorepo Build & Quality Gates
- **Requirements**:
  1. Backend:
     - `cd api && go test -v -race ./...` $\to$ All pass.
     - `go vet ./...` $\to$ Clean.
  2. Frontend:
     - `cd web && npm run build` $\to$ Runs real `vue-tsc -b && vite build` (type-checking + production bundle compile succeed with zero errors).
     - `cd web && npm test` $\to$ Runs real `"test": "vitest run"` (all unit test suites pass).
     - Optional helper scripts: if developer convenience scripts `"test:unit": "vitest run"` or `"type-check": "vue-tsc -b"` are desired in `web/package.json`, they may be added as non-breaking aliases to existing `"test"` and `"build"` commands.

---

## 3. Test Expectations & Verification Summary

| Test Scope | Target File | Verification Metric |
|---|---|---|
| Go Handlers & Services | `api/internal/handler/handler_test.go` | `go test ./...` 100% pass |
| Kinship Engine | `api/internal/kinship/engine_test.go` | Graph traversal & lexicon lookups pass |
| Tree Connectors (Math) | `web/src/test/tree-connectors.spec.ts` | Orthogonal edge calculation assertions |
| Tree Normalizer | `web/src/test/tree-layout.spec.ts` | Generation 1 couple pairing and sibling sorting |
| Card Presentation | `web/src/test/tree-node-card.spec.ts` | Pinned strings (`s. 1930`), avatar `@error` fallback, "Tôi" ring |
| DOM Node Budget | `web/src/test/tree-culling.spec.ts` | $\le 300$ visible card components; 1 canvas node |
| End-to-End User Flow | `e2e/specs/j1-tree.spec.ts` | Mock auth, member binding, full tree navigation and kinship verification |

---

## 4. Acceptance Criteria

- [ ] All Vitest unit tests pass (`npm test`).
- [ ] All Go backend unit and integration tests pass (`go test ./...`).
- [ ] TypeScript compilation and frontend build succeed with zero errors (`npm run build`).
- [ ] Playwright E2E test `j1-tree.spec.ts` executes mock login + `POST /me/member` binding, and verifies "Tôi" ring, badge, and auto-centering.
- [ ] Invariant audit passes 100%:
  - INV-01: Zero external asset dependencies.
  - INV-02: Zero line-height violations (< 1.45) on Vietnamese typography (including kinship badges).
  - INV-03: Gender enum mapping intact.
  - Zero `v-html` tags in Vue templates.
- [ ] DOM budget contract verified: $\le 300$ visible card components; connectors consume exactly 1 canvas node across all zoom levels and tree sizes.
