# Architecture recommendation — Quiet Clarity implementation

**Status:** Historical foundation-first recommendation; all-pages design gate reopened 2026-09-27, do NOT treat this status as implementation authorization · **Scope:** presentation layer only · **Date:** 2026-09-26

## Decision

Adopt a **foundation-first, semantic-token migration through the existing Vue UI kit**. Map the canonical values in `mockups/assets/tokens.css` to Tailwind v4 `@theme` in `web/src/assets/main.css`, supply light/dark runtime variable values, then migrate shared shell/controls before individual shipped views. Do not create a second component library, duplicate mockup CSS, or use view-local hex literals as the theme architecture. Mockup dashboard/persons remain visual references, **not routes**; `/tree` stays home.

**This follows** `plan-overview.md` phases 0–5 and `design-system.md` §§1–3. Worker inspection found `main.css` already owns `@theme`, while the shared `AppLayout.vue` wraps routes and the `components/ui/` kit supplies controls across views. **User-verified current-state evidence:** fixed light only (`web/index.html` uses `bg-cream`; `web/src/assets/main.css` has fixed `:root` values); no app-source `prefers-color-scheme`/`matchMedia` handling, saved theme preference, or user override. Dark support is new, not merely a palette replacement. **Theme policy is system-preference-only:** automatically honor OS light/dark; no manual toggle, override, or persistence. First paint matches current OS preference without wrong-theme flash; live OS changes update immediately; reload reflects current OS. Phase 0 verifies and tests this contract.

## Approach comparison

| Approach | Complexity | Scalability | Maintainability | Risk | Cost | Recommendation |
|---|---|---|---|---|---|---|
| A. Semantic tokens → existing kit → shipped views | Medium migration, low steady-state | High across routes/themes | High: one semantic source | Medium, gated and reversible | Medium initial; low future | **Adopt** |
| B. View-local styling and minimal shared changes | High duplicated overrides | Low as routes/themes grow | Low: drift in shell, dialogs and views | High: dark islands and mixed visual language | Lower first screen; high cumulative | Reject as primary strategy; allow only view-specific layout |

Evidence: `main.css` contains Warm Heritage `@theme` colors and no dark infrastructure; `AppLayout.vue`, `AppButton.vue`, `AppInput.vue`, `AppDialog.vue`, `ToastHost.vue` and `AuthInterstitial.vue` carry shared palette classes. Workers identified hardcoded `bg-white`/slate classes in views and literal-color assertions in existing unit tests. View-local changes cannot consistently restyle the persistent shell or shared overlays.

## Integration boundaries

1. **Canonical values and theme ownership.** Treat `mockups/assets/tokens.css` as the design-phase reference; expose semantic canvas/surface/ink/hairline/accent/demo/status, typography, radius, shadow and motion roles from the existing stylesheet. Implement light and dark values for the **same roles** using OS preference only, initialized **CSS-first at the earliest stylesheet/root**: declare token sets under `@media (prefers-color-scheme: dark)` in `main.css` so document background and tokens resolve at stylesheet-parse time, before Vue mounts — no JavaScript-driven theme initialization, no wrong-theme flash, no `localStorage` persistence. Live OS appearance changes propagate through CSS media evaluation; reload reflects current OS. Include document/body background and browser `theme-color`, not only component interiors. Keep self-hosted Be Vietnam Pro, eliminate old Fraunces presentation without fetching fonts/CDNs, and preserve global Vietnamese line-height floors (headings/badges ≥1.45; body ≥1.6).
2. **Compatibility during migration.** Keep existing `--gen-1..4` variable names consumed by `card-visual.ts`, `AppAvatar.vue`, `AppCombobox.vue` and tree cards; update values only within the approved chrome/presentation scope. Preserve `treeTokens.ts` connector CSS-variable fallback behavior and synchronize fallback values with any changed CSS variables. Keep old color aliases temporarily until all consumers — including inline tree-card fallbacks — are migrated; then remove dead heritage tokens rather than silently aliasing light-only values into dark mode.
3. **Shared kit first.** Move `AppLayout`, buttons, inputs/selects/comboboxes, cards, dialogs, avatars, chips, toasts, empty/loading/error states and auth interstitials to semantic roles. Amber demo styling must have explicit Demo/Bản dùng thử text and must never inherit blue primary styling. Retain actual `aria-*`, `data-testid`, focus, keyboard and router behavior. OAuth provider marks may keep official brand colors.
4. **Responsive shell, then views.** Align one shell contract for 320px through desktop: gutters, mobile tabs, bottom-content clearance and safe-area insets; ensure light/dark overlays and contrast. Verify reduced-motion behavior globally. Migrate `/login`, auth callbacks/email verification, 404, `/members/:id`, `/kinship`, `/feed`, `/account`, and `/tree` chrome according to plan phases. Reuse dashboard/persons visual patterns where applicable, without adding routes or API calls.
5. **Strict tree/backend boundary.** `/tree` work is surrounding chrome only: do not alter its single Canvas connector renderer, card geometry/connectors/layout, ≤300 visible cards, DPR≤2/16.7M-pixel guard, GPU pan/zoom or low-zoom dot buttons. Keep the `closest('button')` guard before pointer capture. Avatar URLs remain limited by the shared `api/internal/model/validation.go` regex to bundled `/static/avatars`; demo identities remain non-linkable under the API's 403-first rule. Preserve Go API contracts and the versioned kinship cache with post-commit CRUD/Excel invalidation. A renderer, authorization or data-flow diff is a stop-and-rescope event, not a styling exception.

## Mockup & screenshot reference map

**Exactly six HTML mockups** exist under `mockups/`: `login.html`, `dashboard.html`, `person-detail.html`, `persons.html`, `settings.html`, `tree.html`. **Screenshot inventory** under `screenshots/` comprises 24 screen captures (6 mockups × light/dark × desktop/mobile) plus 4 cross-page contact sheets (28 PNG files total).

| Shipped view/route | Direct mockup? | Visual baseline / review criteria |
|---|---|---|
| `/login` (`LoginView.vue`) | Yes (`login.html`) | Match 1:1 for layout, OAuth buttons, magic-link input, demo CTA. Review: light/dark × desktop/mobile/320px. |
| `/tree` (`TreeView.vue`) | Chrome only (`tree.html`) | Canvas placeholder in mockup; match top bar, legend pane, inspector pane, compass, zoom controls. Review: light/dark × desktop/mobile/320px; renderer untouched. |
| `/members/:id` (`MemberDetailView.vue`) | Yes (`person-detail.html`) | Match metadata card, relationship section, action stacking. Review: light/dark × desktop/mobile/320px. |
| `/account` (`AccountView.vue`) | Direction (`settings.html`) | Match profile panel, linked providers list, security actions. Review: light/dark × desktop/mobile/320px. |
| `/auth/oauth/callback` (`OAuthCallbackView.vue`) | **No direct mockup** | Borrow `AuthInterstitial.vue` + `card` + `brand__mark` + shared spinner. States: loading/error/success per tokens. Review: light/dark × desktop/mobile/320px. |
| `/auth/email/verify` (`EmailVerifyView.vue`) | **No direct mockup** | Borrow `AuthInterstitial.vue` + shared card/heading kit. States: pending/verified/expired/resent per tokens. Review: light/dark × desktop/mobile/320px. |
| `/:pathMatch(.*)*` (`NotFoundView.vue`) | **No direct mockup** | Borrow shared empty/error kit (`card`, `btn--secondary`, `btn--primary`, heading, icon). Review: light/dark × desktop/mobile/320px. |
| `/kinship` (`KinshipView.vue`) | **No direct mockup** | Borrow directory filters, combobox, generation pills, result cards from `persons.html`; stat card patterns from `dashboard.html`. Review: light/dark × desktop/mobile/320px. |
| `/feed` (`FeedView.vue`) | **No direct mockup** | Borrow activity card, composer, segmented control from `dashboard.html` + `person-detail.html`. Review: light/dark × desktop/mobile/320px. |

Every review criterion uses the same gate: 320px no horizontal document overflow; reduced-motion respected; visible focus; semantic headings; functional `aria-*`/`data-testid`; amber demo explicit-text; contrast matrix (see below) holds.

## Sequencing and regression gates

### PRE-Phase-1 — Designer artifact correction & approval (CLOSED)
- **Owner: Designer.** Responsible for the canonical design artifacts and their internal consistency: `design-system.md` (§§3.1 tokens, §3.5 contrast matrix), `mockups/assets/tokens.css` (light `:root` + dark media block), six HTML mockups, and 28-file screenshot inventory.
- **Exit criteria (met):**
  1. Semantic status/low-emphasis/hover token pairs revised to AA in both themes (`--ink-3`/`--ink-4`/`--ink-placeholder` unified at `#636369` light / `#B0B0B6` dark; `--accent-hover`/`--accent-press` AA in both themes; separate `*-fg` foreground tokens for accent, demo, success, danger; decorative raw hues explicitly restricted to non-text marks).
  2. Published measured pair matrix in `design-system.md` §3.5 covering both themes.
  3. Six HTML mockups + 24 screen screenshots + 4 contact sheets regenerated and consistent with revised tokens.
- **Status: CLOSED.** Verified against latest `tokens.css`: all measured text pairs meet ≥4.5:1 (normal) / ≥3:1 (large), and all functional non-text indicators meet ≥3:1. Remaining sub-3:1 values are strictly decorative and exempt from both floors: `--hairline` / `--hairline-strong` card & input dividers, and light raw `--demo` (#E8890C, 2.62:1) which is never indicator-eligible — all functional amber UI uses `--demo-deep` (≥5.10:1) or `--demo-button` (≥5.62:1) with explicit "Demo"/"Bản dùng thử" text. Light raw `--success` (3.06:1) and raw `--danger` (3.91:1) meet the 3:1 indicator floor for non-text dots/icons only and are forbidden as text (use `--success-fg` 5.33:1 / `--danger-fg` 6.09:1).

### Phase 0 — Evidence baseline, compatibility inventory, theme contract tests
- **Inventory and auditable exit artifacts:** Record router table, route × state × theme × viewport coverage, baseline tests, hardcoded palette utilities, font references, and literal-class assertions; exclude dashboard/persons routes. Produce a named inventory/matrix record that lists all `--gen-*` definitions/references/consumers and every `treeTokens.ts` CSS-variable/TS fallback consumer, plus theme baseline evidence/test map. Record the verified fixed-light baseline (`index.html` `bg-cream`, fixed `:root` in `main.css`, no app-source OS theme handling, storage, or override). Test cold loads in OS light and dark (no wrong-theme first paint), both live OS transition directions, reload in both modes, and no theme storage/control. These inventories and tests are required Phase 0 exit artifacts, not informal checklist items.
- **Contrast gate (consumes closed pre-gate):** Treat the closed pre-gate matrix as ground truth for Phase 1. Phase 0 re-verifies a sampled subset in-browser (computed styles against `tokens.css` values) rather than re-measuring from scratch; any diff between computed values and canonical tokens reopens the pre-gate for designer review. Placeholder text is assessed under normal-text criteria only when it conveys necessary information and never substitutes for a visible label.

### Phase 1 — Theme foundation
- Implement the CSS-first system-only theme lifecycle with the shared foundation; migrate the shared kit/shell as a unit. Check both themes' computed colors, AA text contrast, visible focus, amber demo semantics, Vietnamese glyph clearance, 320px overflow, safe areas and reduced motion. Update kit tests to assert semantic intent rather than obsolete terracotta names; keep typecheck/build green. Do not accept shared light-only dialogs or toasts in dark mode. Gate on all Phase 0 exit artifacts, theme lifecycle test evidence, and the closed pre-gate contrast matrix.

### Phases 2–3 — Route migration
- Move existing auth/system and content routes onto shared controls; update route tests alongside each view. Exercise loading/empty/error/success, keyboard navigation, direct URL entry, CRUD/feed/kinship/account actions, and preserved test hooks. Review light/dark × desktop/mobile screenshots against the mockup & screenshot reference map without treating the unshipped mockup screens (dashboard/persons) as route acceptance targets.

### Phase 4 — Tree chrome
- Assert renderer-sensitive files and backend authorization/validation behavior are unchanged; run tree layout/culling/connector/viewport tests and `e2e/specs/j1-tree.spec.ts`. Check variable fallbacks, low zoom, pointer controls, bundled-avatar validation and demo 403-first tests. Check TreeNodeCard Vietnamese line-height without altering geometry.

### Phase 5 — Release
- Run Vue unit tests, typecheck, production build, relevant Go suites and functional browser E2E. Audit changed routes, API requests, `aria-*`, `data-testid`, dependencies, external font requests and remaining hardcoded old-palette classes. Review all shipped screens and interstitials in four visual modes (light/dark × desktop/mobile), including 320px and reduced motion. Exercise cold loads in both OS modes without wrong-theme flash, both live OS transitions, reload in each mode, and verify no theme storage/control/override. Log defects instead of waiving gates. For live E2E use the Docker stack at `localhost:3456`; never direct a local API to host `127.0.0.1:5432`.

## Risk register

- 🔴 **Behavioral boundary breach:** A styling PR that modifies tree renderer, avatar validation, demo binding or kinship invalidation could change security/data behavior. Require explicit diff review and the targeted regression suites above; stop on such changes.
- 🟡 **Dark-mode islands:** Existing white/slate literals in shared controls and views do not change when semantic variables change. Sweep the kit first, then each route; use a narrowly allowlisted static audit plus computed-style/browser review.
- 🟡 **Migration compatibility:** `--gen-*`, tree CSS fallbacks and inline old-token references can become unresolved or light-only if removed prematurely. Track references and remove legacy variables only after final consumer audit.
- 🟡 **Test false confidence:** Current unit tests assert heritage classes, while jsdom cannot prove browser contrast or theme appearance. Migrate assertions and require visual/computed-style checks in real browsers.
- 🟢 **Component reuse:** Shared responsive primitives can simplify later approved directory/dashboard work, but this task creates neither route.

## Resolved decisions

1. **System-preference-only theme policy.** Honor OS light/dark automatically, with no manual toggle, user override, or persistence. First paint follows current OS preference without wrong-theme flash via CSS-first initialization in the earliest stylesheet (`@media (prefers-color-scheme: dark)` block in `main.css`, before Vue mount); OS changes update live through CSS media evaluation; reload reflects current OS. This is the explicit decision in `plan-overview.md`; Phase 0 tests cold loads in both modes, live transitions, reload, and absence of theme storage/control. No unresolved theme policy question remains.

2. **Designer artifact correction (pre-Phase-1 gate) — CLOSED.** The designer revised and re-published the canonical tokens (`tokens.css`), the contrast matrix (`design-system.md` §3.5), the six HTML mockups, and the 24-screenshot + 4-contact-sheet inventory. Verified matrix: all meaningful-text pairs ≥4.5:1 in both themes (normal text); all functional non-text indicators ≥3:1; decorative tokens (`--hairline`, raw `--accent`/`--demo`/`--success`/`--danger`) are exempt from the text floor and are permitted only as non-text marks accompanied by text or programmatic name. Phase 0 samples in-browser computed values against this matrix and reopens the pre-gate only on a diff.

3. **Tree-card generation accents remain renderer-owned.** Existing `--gen-*` values consumed by tree cards/card-visual are outside the chrome-only visual boundary; semantic generation treatments are scoped to surrounding UI (legend, filters, inspector), and any renderer-side value change requires separate authorization.

4. **Screenshot-to-shipped-view mapping (see reference map above).** Six mockups cover login, dashboard (proposition only), person-detail, persons (proposition only), settings, and tree chrome. Shipped routes lacking direct mockups (`/auth/oauth/callback`, `/auth/email/verify`, 404, `/kinship`, `/feed`) are baselined on the shared component kit and borrowed patterns documented in the reference map, with light/dark × desktop/mobile/320px review criteria.


## All-pages gate override (2026-09-27)

The earlier “PRE-Phase-1 — CLOSED” statement applied **only** to six design-phase static samples and color pairs; it did not establish nine shipped route/state designs. A new user-directed all-pages design gate is **NEEDS REDESIGN / PARTIAL** until new direct route references and OD mirrors are reviewed and published. See `design-system.md` §7 and `design-findings.md` gate update for local deliverables and outstanding work. Do not begin Vue implementation on the strength of this historical approval.
