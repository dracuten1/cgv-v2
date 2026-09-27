# Phase 0 — Route × State × Theme × Viewport Matrix

**Plan reference:** `.agents/shared/planning/apple-redesign/plan-overview.md` lines 100–107 (Phase 0 scope and exit-artifact list; matrix requirement at line 104).
**Author:** Coder (working-lead implementer instance) — 2026-09-26.
**Independent verifier:** **PENDING — not assigned, not signed.** Per plan line 114 a different, independent verifier must record dated signoff. This artifact is a completeness submission only; **no signoff is claimed here.**
> **[2026-09-27 header annotation — G-D status update]** The original line above is preserved as the historical pre-signing record. G-D has since been signed **RETROSPECTIVELY** by the Tester agent (independent verifier, ≠ Coder/matrix author) under leader authorization dated 2026-09-27 — see the § "G-D Signoff — RETROSPECTIVE BASELINE (2026-09-27)" at the end of this document for the signed entry, coverage table, found-and-fixed record, and explicit limits (G-E remains unsigned; `/auth/oauth/callback` and `/` redirect unobserved; Phase 5 full matrix reserved).
**Branch baseline:** `feature/apple-style-redesign` @ `07039ac`. Working tree: clean except pre-existing untracked `.screenshots/` (20 files, ~2.9 MB — prior live-app evidence; recorded, left untouched).

---

## 1. Method and scope

- Router table read from source: `web/src/router/index.ts` (lines 4–84). Nine shipped views/interstitials; `/` redirects to `/tree` (line 5–8) and is not a distinct view.
- States and expected behavior are source-derived unless explicitly marked observed with a cited test/browser record. Browser execution evidence is **not present for this matrix**: there are no tester-owner logs / references demonstrating the route-state-theme-viewport cells. Existing `.screenshots/` captures and mockups are visual references, not observations made by this task; no file under `.screenshots/` was inspected or altered.
- Theme axis is **OS-preference only** (plan lines 23–28). The checked-in source is fixed light (source-derived finding); thus dark rendering is an expected baseline mismatch, not a measured browser result. Post-Phase-1 behavior is future test scope in `phase-0-theme-browser-evidence.md`.
- Viewports: desktop = 1440×900, mobile = 390×844, and 320px = minimum-width check. Viewport coverage is a future test requirement unless a cell carries an actual cited observation.
- Cell grammar: `EXPECTED (source)` means code inspection predicts behavior; `OBSERVED` is reserved for executed, referenced evidence; `FUT` denotes a future test; `N/A` has a source-based reason. No source expectation is presented as a rendered observation.


## 2. Router table (source: `web/src/router/index.ts`)

| # | Path | Name | Component | Guard meta |
|---|------|------|-----------|------------|
| 1 | `/login` | `login` | `LoginView.vue` | `guest: true` |
| 2 | `/auth/email/verify` | `email-verify` | `EmailVerifyView.vue` | `guest: true` |
| 3 | `/auth/oauth/callback` | `oauth-callback` | `OAuthCallbackView.vue` | — |
| 4 | `/tree` | `tree` | `TreeView.vue` | — (home; auth enforced by data layer) |
| 5 | `/members/:id` | `member-detail` | `MemberDetailView.vue` | — |
| 6 | `/kinship` | `kinship` | `KinshipView.vue` | — |
| 7 | `/feed` | `feed` | `FeedView.vue` | — |
| 8 | `/account` | `account` | `AccountView.vue` | `requiresAuth: true` |
| 9 | `/:pathMatch(.*)*` | `not-found` | `NotFoundView.vue` | — |

Guard behavior (lines 95–131): `requiresAuth` → redirect `/login?redirect=…`; `guest` + authenticated → redirect `/tree`; document title set per route. Redirect targets are themselves matrix rows 1 and 4.

---

**Cell label convention:** `PASS-BL` means expected light-theme baseline from source/test reference, not browser-observed; `FAIL-BL(expected)` means expected mismatch against the dark-theme target from fixed-light source, not a measured failure. `FUT:` marks future browser test work. These labels apply per each of the three viewport cells in their theme column.

Rows in §§3.3–3.9 apply the listed state independently to all six cells: light × desktop 1440×900, mobile 390×844, 320px; and dark × those same three viewports. The test/evidence column is the reference for each applicable cell; where a state/theme cell is not applicable, its N/A reason is stated in that row. Unless a row explicitly cites an observed cell, labels below are expectations/future coverage, not evidence that any cell was executed.

### 3.1 `/login` — `LoginView.vue`

States from source: idle form (success-ready), magic-link submit in-flight (loading), validation error, API error (toasts, lines 254–265), demo login failure toast (line 278), `?verified=1` confirmation toast (lines 287–289).

| State | Light theme × desktop / mobile / 320px | Dark theme × desktop / mobile / 320px | Source / future evidence | Status / owner |
|---|---|---|---|---|
| Success (idle form, providers, demo entry) | EXPECTED (source); visual reference only, not observed | EXPECTED fixed-light mismatch (source); not observed | `LoginView.vue`; mockup is reference. Browser run pending. | FUT; tester executor / implementer |
| Loading (magic-link re-request submit) | EXPECTED (source); not observed | EXPECTED fixed-light mismatch; not observed | `LoginView.vue:254–265`; `login-view.spec.ts`; browser pending | FUT; tester / implementer |
| Success (magic-link re-request accepted; success feedback) | EXPECTED (source); not observed | EXPECTED fixed-light mismatch; not observed | `LoginView.vue:260` calls `authApi.sendMagicLink`; success feedback source path; browser pending | FUT; tester / implementer |
| Error (validation/API failure) | EXPECTED (source); not observed | EXPECTED fixed-light mismatch; not observed | `LoginView.vue:254–265`; `login-view.spec.ts`; browser pending | FUT; tester / implementer |
| Demo login failure / verified toast | EXPECTED (source); not observed | EXPECTED fixed-light mismatch; not observed | `LoginView.vue:278`, `:287–289`; browser pending | FUT; tester / implementer |
| Empty | N/A — login form has no list/empty state | N/A — same route semantics; theme does not create a new state | source | N/A |

Each applicable cell represents each of the six combinations (light/dark × desktop 1440×900/mobile 390×844/320px). No cell is currently marked OBSERVED. No owner log is cited for these routes in the tester baseline; `phase-0-test-baseline.md` covers Go/Vitest/build only, not browser observations. A future browser run must record exact route, state, scheme, viewport, owner, command/tool, result and evidence reference per combination before cells can be upgraded to OBSERVED. |

### 3.2 `/auth/email/verify` — `EmailVerifyView.vue` (**explicit states per plan line 102**)

Implementation states: `'loading' | 'success' | 'error'` (`EmailVerifyView.vue:28`), rendered through `AuthInterstitial` with statuses `working|success|error` (`AuthInterstitial.vue:116`); DOM hooks `data-testid="verify-{state}"` (line 2). Default error copy names expiry: "Liên kết xác thực đã hết hạn hoặc không đúng định dạng." (lines 30–31).

| Plan state | Maps to code | Light theme × desktop / mobile / 320px | Dark theme × desktop / mobile / 320px | Test/evidence provenance | Status / owner |
|---|---|---|---|---|---|
| **Pending** | `state='loading'` → `interstitialStatus='working'`, step 2, source lines 38–57 | EXPECTED spinner state from source; not browser-observed | EXPECTED fixed-light mismatch from source; not browser-observed | `email-verify-view.spec.ts`; browser pending | FUT; tester spec / implementer browser |
| **Verified** | `state='success'`, success interstitial, auto-redirect after 500ms (79–82) | EXPECTED success then redirect from source; not browser-observed | EXPECTED fixed-light mismatch; not browser-observed | `email-verify-view.spec.ts`; browser pending | FUT; tester / implementer |
| **Expired / invalid** | API rejection renders `state='error'`; used/expired token backend contract `magic_link.go:69`, UI lines 83–87; malformed token shares error UI | EXPECTED error interstitial from source; not browser-observed | EXPECTED fixed-light mismatch; not browser-observed | `email-verify-view.spec.ts`; stale/expired token browser scenario pending | FUT; tester / implementer |
| **Resent / request new link** | N/A on this route: retry re-verifies same token (`EmailVerifyView.vue:9`); link request is `/login` (`LoginView.vue:260`) | N/A on verify route at desktop/mobile/320; test resend on login | N/A on verify route at desktop/mobile/320; test resend on login | `/login` rows above own resend states | N/A |
| Missing token | error state, lines 69–74, `retryable=false` | EXPECTED error from source; not browser-observed | EXPECTED fixed-light mismatch; not browser-observed | `email-verify-view.spec.ts`; browser pending | FUT; tester |

Pending, verified, and expired are applicable verification states, not verified runtime observations here. The tester baseline record cited in §1 does not include route-browser executions or establish these cells. Each applicable state still requires six viewport/scheme browser checks; no cell is promoted to OBSERVED without a route-specific owner evidence reference.

### 3.3 `/auth/oauth/callback` — `OAuthCallbackView.vue`

Outcome is computed synchronously from query params (lines 65–104): `oauth_error` (5 known codes + default) or `oauth_linked=google|facebook|zalo`; neither → generic error.

| State | Light × desktop (1440×900) / mobile (390×844) / 320px | Dark × desktop (1440×900) / mobile (390×844) / 320px | Planned test / evidence | Owner |
|---|---|---|---|---|
| Success (linked, per provider) | PASS-BL (success interstitial + "Quay lại trang tài khoản"; auto-redirect `/account` after 1.5 s when authenticated, lines 114–122) | FAIL-BL(expected) → FUT:T-THEME-cold | `web/src/test/oauth-callback-view.spec.ts`; live evidence `.screenshots/live-02-oauth-success.png` | tester + implementer |
| Error ×5 (`invalid_state`, `already_linked`, `provider_error`, `demo_restricted`, `server_error`) + unknown-param default | PASS-BL (error interstitial, nav target `/account` authed / `/login` guest, lines 106–112) | FAIL-BL(expected) → FUT:T-THEME-cold/live | oauth-callback-view.spec.ts all codes; live evidence `.screenshots/live-02-oauth-error.png` | tester + implementer |
| Loading | **N/A — rendering is synchronous from query params; the asynchronous phase happens at the provider redirect, before this route mounts.** No `working` state is wired (`status` is `success`/`error` only, line 4). | same | — | — |
| Empty | N/A — outcome computed always yields success or error (lines 99–103). | same | — | — |

### 3.4 `/tree` — `TreeView.vue` (+ `TreeVisualizer.vue`, home route)

States from source: `store.loading` spinner (`TreeView.vue:91–101`, `data-testid="tree-loading"`), error EmptyState + retry (`103–113`, `tree-retry`), empty-tree EmptyState + add CTA (`116–130`), success (world layer, bands, canvas, cards). Canvas renderer invariants → `phase-0-tree-baseline.md`.

| State | Light × desktop (1440×900) / mobile (390×844) / 320px | Dark × desktop (1440×900) / mobile (390×844) / 320px | Planned test / evidence | Owner |
|---|---|---|---|---|
| Loading | PASS-BL (spinner card) | FAIL-BL(expected) → FUT:T-THEME-live | `web/src/test/tree-view.spec.ts` | tester |
| Error (load failure, retry) | PASS-BL | FAIL-BL(expected) → FUT:T-THEME-live | tree-view.spec.ts | tester |
| Empty (no members) | PASS-BL | FAIL-BL(expected) → FUT:T-THEME-live | tree-view.spec.ts | tester |
| Success (rendered tree) | PASS-BL (`tree.html`, `tree-*.png`; invariants per tree-baseline doc) | FAIL-BL(expected) → FUT:T-THEME-cold/live + T-TREE-browser-* | tree-*.spec.ts suite + `T-TREE-*` browser map | tester + implementer |

### 3.5 `/members/:id` — `MemberDetailView.vue`

| State | Light × desktop (1440×900) / mobile (390×844) / 320px | Dark × desktop (1440×900) / mobile (390×844) / 320px | Planned test / evidence | Owner |
|---|---|---|---|---|
| Loading (first load, no cached member) | PASS-BL (`member-loading` skeleton, lines 5–7) | FAIL-BL(expected) → FUT:T-THEME-live | `web/src/test/member-detail-view.spec.ts` | tester |
| Error / not found (EmptyState, lines 17–25) | PASS-BL | FAIL-BL(expected) → FUT:T-THEME-live | member-detail-view.spec.ts | tester |
| Success (tabs overview/relations/posts; `tab-panel-*` hooks) | PASS-BL (`person-detail.html`, `person-detail-*.png`) | FAIL-BL(expected) → FUT:T-THEME-cold/live | member-detail-view.spec.ts | tester |
| Empty sub-states (e.g., empty relations group, line 135) | PASS-BL | FAIL-BL(expected) → FUT:T-THEME-live | member-detail-view.spec.ts | tester |
| Action feedback (delete success/error toasts, lines 314–318) | PASS-BL | FAIL-BL(expected) → FUT:T-THEME-live | member-detail-view.spec.ts | tester |

### 3.6 `/kinship` — `KinshipView.vue` (+ `KinshipResult.vue`)

| State | Light × desktop (1440×900) / mobile (390×844) / 320px | Dark × desktop (1440×900) / mobile (390×844) / 320px | Planned test / evidence | Owner |
|---|---|---|---|---|
| Success (form ready; result rendered) | PASS-BL (mockup-borrowed patterns per plan line 21) | FAIL-BL(expected) → FUT:T-THEME-cold/live | `web/src/test/kinship-view.spec.ts`, `kinship-result.spec.ts` | tester |
| Loading (calculation in-flight: `kinshipStore.loading` on submit button, line 115; member-options loading `loadingMembers`, lines 61/76/253–264) | PASS-BL (disabled/pending controls) | FAIL-BL(expected) → FUT:T-THEME-live | kinship-view.spec.ts | tester |
| Error (validation toast line 284; API failure toast) | PASS-BL | FAIL-BL(expected) → FUT:T-THEME-live | kinship-view.spec.ts | tester |
| Empty (pre-calculation result area) | PASS-BL | FAIL-BL(expected) → FUT:T-THEME-live | kinship-view.spec.ts | tester |

### 3.7 `/feed` — `FeedView.vue` (+ `PostCard.vue`, `ImageGrid.vue`)

| State | Light × desktop (1440×900) / mobile (390×844) / 320px | Dark × desktop (1440×900) / mobile (390×844) / 320px | Planned test / evidence | Owner |
|---|---|---|---|---|
| Loading (initial + pagination "Đang tải…"/"Tải thêm", lines 163–181) | PASS-BL | FAIL-BL(expected) → FUT:T-THEME-live | `web/src/test/feed-view.spec.ts`, `feed-store.spec.ts` | tester |
| Empty (EmptyState, line 163) | PASS-BL | FAIL-BL(expected) → FUT:T-THEME-live | feed-view.spec.ts | tester |
| Error (store error toast, lines 313; load failure) | PASS-BL | FAIL-BL(expected) → FUT:T-THEME-live | feed-view.spec.ts | tester |
| Success (composer, posts, images) | PASS-BL (`dashboard.html`/`person-detail.html` borrowed patterns per plan line 24) | FAIL-BL(expected) → FUT:T-THEME-cold/live | `feed-view.spec.ts` + `image-grid.spec.ts`; PostCard coverage is in `feed-view.spec.ts:121` and `member-detail-view.spec.ts:217` (no dedicated PostCard spec) | tester |

### 3.8 `/account` — `AccountView.vue`

| State | Light × desktop (1440×900) / mobile (390×844) / 320px | Dark × desktop (1440×900) / mobile (390×844) / 320px | Planned test / evidence | Owner |
|---|---|---|---|---|
| Success (profile, linked identities, contact points, notifications) | PASS-BL (`settings.html`, `settings-*.png`) | FAIL-BL(expected) → FUT:T-THEME-cold/live | `web/src/test/account-view.spec.ts` | tester |
| Loading (fetchMe via router guard, `router/index.ts:99–101`) | PASS-BL (source-derived expectation: shell render while fetchMe resolves; not observed) | FAIL-BL(expected) → FUT:T-THEME-live | account-view.spec.ts | tester |
| Error (unlink failure lines 402–418; contact add/verify failures lines 432–454; logout failure line 466 — toasts) | PASS-BL | FAIL-BL(expected) → FUT:T-THEME-live | account-view.spec.ts | tester |
| Empty (no linked identities / no contact points) | PASS-BL | FAIL-BL(expected) → FUT:T-THEME-live | account-view.spec.ts | tester |
| Guard redirect (unauthenticated → `/login?redirect=/account`) | PASS-BL (router behavior) | N/A — theme-independent routing behavior | `web/src/test/router-guards.spec.ts` | tester |

### 3.9 `/:pathMatch(.*)*` — `NotFoundView.vue`

| State | Light × desktop (1440×900) / mobile (390×844) / 320px | Dark × desktop (1440×900) / mobile (390×844) / 320px | Planned test / evidence | Owner |
|---|---|---|---|---|
| Success (static 404 content) | PASS-BL (shared empty/error kit per plan line 20) | FAIL-BL(expected) → FUT:T-THEME-cold | `web/src/test/not-found-view.spec.ts` | tester |
| Loading / Error / Empty | N/A — static view; no async data, no list semantics (single render path). | same | — | — |

---

**Observed-state status:** all remaining route tables are source-derived expectations and future test assignments, not runtime observations. Existing Vitest suite evidence is available from tester record `.agents/shared/planning/apple-redesign/phase-0-test-baseline.md` (§4), but it does not establish actual rendered/browser behavior for each route × state × theme × viewport cell. `PASS-BL` and `FAIL-BL(expected)` use the cell-label definitions in §3; neither claims browser observation, and dark mismatch is source-derived, not measured. The named tester record contains no route browser sessions. No claim is made that every combination was executed. Independent verifier signoff remains pending.

---

## G-D Signoff — RETROSPECTIVE BASELINE (2026-09-27)

**Verifier:** Tester agent (ensemble `tester` instance), independent of the Coder and of the matrix author, per D4 ownership.
**Authorization basis:** Leader decision recorded 2026-09-27 — the pre-coding G-D window passed when the Phase 1 foundation landed; the verifier's live-SPA observations are designated the retrospective baseline evidence. This entry records that disposition; it is **not** a claim that a pre-coding signoff occurred.
**Evidence runs (all live Vue SPA, pack-served fresh `web/dist`, `/api/*` proxied to the existing healthy `:3456` backend; never local API, never host 5432/8088):**
- `…/RESULTS/2026-09-27-apple-phase1-verification.md` (full defect/adjudication history)
- `…/RESULTS/2026-09-27-apple-phase1-exit-vitest.log` (unit 39 files/271 tests PASS @ bc4210d)
- `…/RESULTS/2026-09-27-apple-phase1-exit-build.log` (typecheck+build PASS; dist fresh vs sources; semantic tokens compiled)
- `…/RESULTS/2026-09-27-apple-phase1-exit-browser2.log` + `apple_phase1_shell_e2e/summary-2026-09-27T16-05-15-381Z.json` (**16/16 PASS, OUTER_EXIT=0** @ web tree bc4210d, spec d78975c)

**Minimum-subset observation coverage (plan-overview G-D minimum: `/login`, `/tree` chrome, `/members/:id`, `/account` direction) — SATISFIED:**

| Route | Observed cells (method: rendered computed styles, WCAG composite backgrounds, in-page evaluator; ratios independently recomputed) |
|---|---|
| `/login` | 1440/390/320 × light/dark (6 cells, zero overflow), focus/functional ≥5.62:1, demo amber 5.62:1, demo-panel D5 fixed 5.10 L / 7.02 D, dark card surface min 5.62:1 |
| `/tree` chrome | demo-login lands `/tree`; aria-current="page" "Gia phả"; title/path asserted |
| `/members/:id` | real `AppChip` gen1–4 via pack-owned vite-dev fixture (`web/gen-chip-contrast.html`), both themes: 5.36–6.24:1 |
| `/account` | 4 cells (1440/390 × light/dark): min 6.199 L / 6.247 D after semantic migration |
| Also observed | `/auth/email/verify` link hover (dark 7.96 both states; light 7.19 settled; one recorded light "before" 1.89 is a 150ms `transition-colors` sampling tail, not a resting state), `/kinship` + `/feed` reachable probes, OS live preference switch both directions, Fraunces 15 same-origin loads / 0 external |

**Found-and-fixed baseline record (design-readiness decision inputs):**
1. Dark `/login` auth card surface 1.08:1 → fixed (`--surface-card` semantic, min 5.62:1).
2. Gen1–4 chips 1.81–2.14:1 → fixed (`--gen-N-fg`, 5.18–6.24 both themes).
3. AuthInterstitial hover ~1.8:1 → fixed (≥7.19 both themes).
4. D1–D5 at `8279f0b` (account slate palette 1.19/3.64/1.61/4.41; login demo copy 2.68–3.72) → fixed at `bc4210d` (15.59/6.85/6.20/5.10+ / 5.10–7.02).

**Design-readiness decision:** PASS — design references and baseline states are understood, coherent, and implementable against the running SPA; every surfaced defect was remediated and re-measured green.
**Explicit limits of this entry:** (a) retrospective only — no pre-coding observation occurred; (b) `/auth/oauth/callback` and `/` redirect were not observed live; (c) this covers the G-D **minimum subset**, not the ~201-cell Phase 5 release matrix, which remains reserved; (d) **G-E (token-consumer inventory) remains unsigned** and is not addressed by this entry.

*Verifier cross-reference (2026-09-27, Reviewer agent — G-E verifier of record): limit (d) was accurate at this entry's authoring time; G-E **was subsequently signed on 2026-09-27** in `phase-0-token-consumer-inventory.md` (scope: completeness/accuracy at measurement baseline `8279f0b`; §8 browser/test execution expressly excluded and remains a Tester record).*

*Signed (system-recorded): Tester — independent verifier, 2026-09-27, evidence as cited above.*
