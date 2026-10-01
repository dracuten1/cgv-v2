# Feeds-main design findings — draft coverage (2026-10-01 UTC)

Status: **PARTIAL / pending publish**. OpenDesign project `cgp-v2-apple-redesign`; new independent draft `feed-main-draft.html` created, not substituted for canonical `feed.html`. Awaiting owner's forthcoming page-inventory findings before finalizing. Existing 2026-09-28 approval applies to the older baseline only; no approval of this draft. No application changes.

## OpenDesign artifact inventory and visual evidence

OD raw route prefix: `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/` (current daemon session). The nine existing page screenshots below are **desktop 1280×800, light, initial content only**. A contact sheet was inspected as actual image bytes with ImageReader (`evidence/od-inventory-contact.png`); fine text/state claims cannot be inferred from its reduced thumbnails. The original feed screenshot `evidence/od-feed-desktop.png` was also individually inspected. Existing route references are exact OD files, not proof of app route conformance.

| Screen | OD file | Captured image | Status |
|---|---|---|---|
| Feeds | `feed.html` | `evidence/od-feed-desktop.png` | current baseline; draft pending publish |
| Family tree | `tree.html` | `evidence/od-tree-desktop.png` | current baseline; no change |
| Kinship | `kinship.html` | `evidence/od-kinship-desktop.png` | current baseline; no change |
| Account | `account.html` | `evidence/od-account-desktop.png` | current baseline; no change |
| Login | `login.html` | `evidence/od-login-desktop.png` | current baseline; no change |
| Person detail | `person-detail.html` | `evidence/od-person-detail-desktop.png` | current baseline; no change |
| Dashboard proposal | `dashboard.html` | `evidence/od-dashboard-desktop.png` | unverified as shipped app route |
| Persons proposal | `persons.html` | `evidence/od-persons-desktop.png` | unverified as shipped app route |
| Settings | `settings.html` | `evidence/od-settings-desktop.png` | unverified as shipped app route |
| Email verification, OAuth callback, not found, account/person/tree state sheets | respective OD files inventoried through `list_files` | no pixel capture | unverified for visual review |

Source also inventoried via OD `list_files`: `assets/tokens.css`, `apple-redesign-design-system.md`, `tree-render-states.html`, `tree-states.html`, `person-detail-states.html`, `account-states.html`, etc. OD read-back verified `feed.html`, portions of shared tokens, and new draft. The tree orientation/anchor decisions remain untouched.

## Draft matrix: `feed-main-draft.html?state=<state>&theme=light`, dark = omit theme with Chrome `--force-dark-mode`

All rows target OD file `feed-main-draft.html` (draft version 1, tool-returned version id `47942276-e063-44fe-a1c6-094328c184be`, tool-returned contentDigest `eb1f42675675f532564d419bf5b8a5f20c21fae6da9c338b9e337eff9398493c`; not a computed bytes hash or approval). Screenshot files show first viewport only; `content` mobile light was delivered to ImageReader; other draft captures were saved but **not visually analyzed** yet. Playwright checked 390px document scrollWidth=390 for content/empty/error/demo, so ImageReader's apparent right-edge clipping is not confirmed as document overflow. Main page extends vertically and requires scroll; fixed tab bar covers the lower part of the first viewport by design.

| State | 1280×800 light | 1280×800 dark | 390×844 light | 390×844 dark | Status |
|---|---|---|---|---|---|
| content | `evidence/draft-content-1280x800-light.png` | missing | `evidence/draft-content-390x844-light.png` (ImageReader) | `evidence/draft-content-390x844-dark.png` | pending publish |
| demo | `evidence/draft-demo-1280x800-light.png` | missing | missing | missing | unverified |
| empty | missing | missing | `evidence/draft-empty-390x844-light.png` | missing | unverified |
| loading | missing | missing | missing | `evidence/draft-loading-390x844-dark.png` | unverified |
| error | missing | `evidence/draft-error-1280x800-dark.png` | missing | missing | unverified |
| guest | missing | missing | `evidence/draft-guest-390x844-light.png` | missing | unverified |

App URL when implemented: likely `/feed`, but not visually audited against the draft; implementation approval **BLOCKED** until owner identifies and approves final OD content. No local app code modified. Draft design routes link to existing OD pages; no claim about deployed app navigation.

## Findings and next checks

- Baseline feed is a narrow stream with composer above stories, limited in-context paths to other pages, a bulky illustrative image slot, and a demo chip whose meaning may not be obvious. New draft introduces concise orientation, shortcut panel to tree/kinship/account, and keeps posting/stories central. Distinct empty/loading/error/guest/demo query states exist as visual specimens; not production behavior.
- Draft currently needs review against owner's forthcoming inventory before replacing/revising canonical `feed.html`. In particular confirm which pages should be linked (person detail versus account), whether anonymous read is allowed, and whether demo-specific header must be conditional. Evaluate 320px, 390px, desktop and both themes with full scroll captures, keyboard focus, contrast and all states before final handoff.
- Shared OD token stylesheet preserves existing warm palette, typography and mobile tab bar. Tree anchor precedence and per-family Dọc/Ngang persistence were not changed by this work.

## 2026-10-01 route-audit reconciliation and v2 draft QA

Owner-relayed route audit: `/` currently redirects `/tree`; authenticated default and guest-only returns also go `/tree`; shell nav remains Tree → Kinship → Feed → Account; Feed is public and family-scoped with localStorage selection unlike Tree `?family=`. Profile has an embedded posts tab only. No author/detail post links, reactions, comments, uploads, privacy controls or member tags. Composer 1–5000 runes; URL images API max 10/client max 9; posts page size 20. The revised OD draft preserves existing nav order, avoids unsupported post actions and profile deep links, and introduces separate no-family and inline paging-error visual states. Demo badge is state-conditional. `feed.html` remains unchanged.

**Recommendation vs visual scope:** Making `/feed` the actual entry for `/`, authenticated defaults and guest return paths is a routing/product decision requiring owner approval and Developer implementation; this OD file only visualizes a primary Feed experience. Tree anchor precedence (linked user → route param → root), Dọc default, and per-family orientation persistence remain untouched. Feed family selection is shown as Feed-scoped; no cross-route sync is promised.

**Current draft identity:** OD `cgp-v2-apple-redesign/feed-main-draft.html`, tool-reported version 2 id `679a352f-a079-4cd5-ad4c-17df27b99ce1`, digest `bcfd49b79e1867f2023a7126c2a1bd76c818b8f083ca4c59fac4df1f7968e2f2`. Independently fetched raw preview returned 12461 bytes, SHA-256 `bcfd49b79e1867f2023a7126c2a1bd76c818b8f083ca4c59fac4df1f7968e2f2` at verification time. This is a bytes hash of retrieved content, not a guarantee of immutable OD revision or approval. `list_files(since=...)` showed only draft changed and `get_file` re-read its revised heading/styles.

**v2 capture matrix (one OD page × states × viewport × theme):** Each cell exists at `evidence/v2-{state}-{width}x{height}-{theme}.png`, full-page capture. Rows: `content`, `guest`, `no-family`, `empty`, `loading`, `error`, `paging-error`, `demo`. Columns: `1280x800-light`, `1280x800-dark`, `390x844-light`, `390x844-dark`, `320x800-light`. Thus **40 captured / 40 browser-structure checked**, with Playwright verifying each expected state visibility, four mobile nav links in established order, and scrollWidth exactly matching viewport (no document horizontal overflow). **Visually inspected actual image bytes:** `evidence/v2-states-390-light-contact.png` and `evidence/v2-states-390-dark-contact.png` (contact sheets of all eight full-page 390px states each). These prove broad hierarchy and state differentiation, not fine text, contrast or per-cell visual sign-off. Prior draft v1 contact sheets `draft-remaining-mobile-contact.png` and `draft-remaining-desktop-contact.png` were inspected but do not represent current v2. All 16 current mobile 390px state images were included in the two sheets; 24 other v2 capture images were **not** sent to vision. Their browser structure was checked only.

**Corrected vision cautions:** Contact-sheet model inferred guest composer visible and dark fixed-nav overlap; direct browser DOM confirms guest composer is `hidden`/display:none, and a bottom-scroll measurement puts mobile paging error above fixed tab bar (error bottom 744px, tab top 783px at 390×844). Scaled full-page thumbnails can visually superimpose the fixed nav in odd positions. The paging-error notice is compact but is 358×142px and fully readable in DOM geometry; fine visual judgment still requires individual full-res check.

**Remaining blockers for implementation/sign-off:** no new owner approval of v2 content; canonical `feed.html` not replaced; primary-route decision not authorized; full-resolution per-state/accessibility review incomplete. The draft's buttons for Post and Load More are illustrative with explicit accessible labels, not functional prototype actions; Developer must wire existing app behavior and maintain honest server/client constraints. Existing older baseline approval does not apply to this changed draft. Overall **PARTIAL / pending publish** for design, **BLOCKED** for implementation gate.

**Additional native-width image inspection:** ImageReader separately received actual bytes for `evidence/v2-paging-error-390x844-light.png` (390×1510 full-page) and `evidence/v2-guest-390x844-light.png` (full-page). It confirmed guest composer absent and paging error readable after existing posts. Its claimed fixed-tab overlay across mid-page content is a **full-page screenshot stitching artifact**, not established as real viewport occlusion: browser bottom-scroll geometry showed paging error bottom 744px versus fixed-tab top 783px, and document has bottom padding. No horizontal clipping was observed. Browser/vision does not establish contrast ratios or keyboard accessibility; those remain unverified.

## 2026-10-01 final pre-approval design review — v3 draft

**Artifact / publication status:** `cgp-v2-apple-redesign/feed-main-draft.html` is still a separate draft, status `pending publish`; canonical `feed.html` remains `current`, fetched 8633 bytes SHA-256 `3aab66cd82bb073552149bdd2328fb32e01b18f71685ffb01f20d99a85904186`. No app code changes. New draft v3 tool-returned version id `4c8a5c76-7220-48db-9a5f-3a54c1286896`; fresh daemon raw fetch 12773 bytes SHA-256 `6be0ed0d6fe4aa357386e9f358bb82044260fe402c304f4ac473cf38fda79e87`. Raw preview: `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/feed-main-draft.html` (daemon-session lifetime). Tool `list_files(since=...)` showed only this draft changed, and `get_file` re-read it.

**v3 corrective delta:** No-family state now contains an explicitly labeled Feed family selector and no longer misdirects selection to Tree; heading identifies absence of selected family. Owner route audit says Feed selection is localStorage-scoped and Tree uses independent `?family=`/anchor precedence. This OD control is a design specimen with a sample option, not a promise of app data behavior. All other v2 content/state arrangements remain visually equivalent; v2 captures are not falsely relabeled as v3 captures.

**Visual evidence distinction:** v2 full-page browser captures cover 8 states × 5 viewport/theme columns = 40 cells; v2 image bytes actually sent to vision: both eight-state 390px contact sheets (`v2-states-390-light-contact.png`, `v2-states-390-dark-contact.png`), desktop-light eight-state contact (`v2-review-1280-light.png`), desktop-dark five representative states (`v2-review-1280-dark.png`), 320px-light eight-state contact (`v2-review-320-light.png`), native 390px guest/paging-error light. These are broad state/visual checks; contact-sheet scaling limits fine contrast judgments. v3 *changed* screens captured and browser-checked at 320/light (no-family, content, guest, paging-error), 390/dark (no-family, error), 1280/light (no-family, content): see `evidence/v3-{state}-{width}x{height}-{theme}.png`. Native image bytes inspected for `v3-no-family-320x800-light.png` and ordinary bottom-scroll viewport `v3-no-family-320-viewport-bottom.png`; the selector was visible and unobstructed in the latter. These eight v3 captures are NOT all claimed as image-reader-inspected. No v3 1280/dark or 390/light screenshot was recaptured after the no-family-only change; prior v2 sheets remain evidence for unchanged layouts, not a fresh v3 screenshot.

**Keyboard / accessibility checks:** At 320px, light and dark, sequential Tab reached skip link, brand, composer, image-URL toggle, post button, family select, pagination button, shortcuts and mobile nav. After settling transitions, `:focus-visible` applied shared terracotta 3px focus ring to the tested textarea, buttons and select (and links). No-family DOM exposed only its visible selector, navigation and links, not hidden composer. Browser checks confirmed 320px document scrollWidth=320; all eight states at bottom-scroll had no interactive control trapped at the fixed-tab top edge. The apparent overlap on full-page screenshots is fixed-element stitching: no-family selector at scroll bottom occupied y637–677 while tab began y739 in a normal 320×800 viewport. Loading has `role=status`/live region, initial and paging errors `role=alert`, tabs have accessible names and active `aria-current=page`; this is a browser DOM check, not a full assistive-technology audit.

**Contrast spot-check:** Computed CSS light and dark color values from rendered preview, then WCAG luminance math for key text/surfaces: light tertiary on canvas 5.53:1, light tertiary on white 5.97:1, intro secondary on tint 6.44:1, amber demo heading on demo tint 5.10:1, red error heading on white 6.09:1; dark tertiary on card 6.97:1, red error on card 6.21:1, accent on dark card 7.96:1. These checked pairings meet 4.5:1 normal text; not an exhaustive audit of translucent blends or every element.

**Findings / caveats:** No confirmed blocking *visual* defect in bounded reviewed states. Guest load-more is valid because Feed read is public; guest composer is hidden (verified). No family option/sample and buttons in OD are illustrative; final Developer work must use actual families, actual 1–5000-rune validation and URL-image limits, and existing 20/page pagination, not assume OD prototype supplies application behavior. Product/routing decision to make `/feed` entry and auth returns remains outside OD visual scope; existing `/` and returns still lead `/tree`. Legacy `feed.html` is untouched. **No new owner approval**; implementation gate remains `BLOCKED`, design review `PARTIAL / pending publish` until authorized owner decides exact final artifact/content and landing-route policy.

## 2026-10-01 feeds-main-qa — post-implementation visual QA (real app vs approved OD draft v3)

**Approved baseline re-verified before QA:** OD `cgp-v2-apple-redesign/feed-main-draft.html` fetched live: 12773 bytes, SHA-256 `6be0ed0d6fe4aa357386e9f358bb82044260fe402c304f4ac473cf38fda79e87`, byte-identical to `.agents/shared/planning/feeds-main-redesign/feed-main-draft.verified-v3.html`. Approval record as relayed by orchestrator: owner decision 2026-10-01, note `1b78ca38`, scope `/`, signin normal+demo, guest defaults → `/feed`, `?redirect=` preserved, `/tree` reachable, nav order unchanged (external record; not an OD approval; not re-asserted by Designer).

**Environment:** built `web/dist` fresh from feature/feeds-main-redesign working tree (`PATH=/usr/local/bin:web/node_modules/.bin`, `vue-tsc -b && vite build`). Served static+SPA on isolated `127.0.0.1:3490` with `/api/*` proxied to live `127.0.0.1:3456`; a second isolated server `3491` proxied `/api/*` to a dead port for real network-failure states. Never touched host 5432. NOTE: the cgp-v2 compose stack was found stopped (exited 0, 9h ago) and was **restarted as-is** (`docker compose -f compose.yaml up -d`); api/web/postgres healthy on 3456 again. QA servers 3490/3491 were killed after captures; live 3456 untouched logically.

**Coverage matrix (fresh captures in `evidence-qa/`):**

| Check | Route/state × viewport × theme | Method | Result |
|---|---|---|---|
| Landing `/` → `/feed` | 1280 light | URL/DOM | PASS |
| Guest content (public read, no composer, login CTA) | 1280 light+dark, 390 light+dark | screenshot + vision (sheet-desktop, sheet-mobile-misc) | PASS |
| Loading skeleton (`feed-loading`, role=status) | 390 light (real delayed-API capture) | screenshot + vision | PASS |
| Feed initial error (`feed-error`, role=alert + retry) | 1280 light, 390 dark (real aborted-API capture) | screenshot + vision | PASS |
| Families-list error (`family-error`) | 1280 dark, 390 light (dead-proxy 502) | screenshot + vision | PASS (polish note 1) |
| Family selector (labeled native select, 4 options, Feed-scoped) | 390 light open + DOM | screenshot + DOM | PASS (native dropdown OS-rendered; options DOM-verified) |
| Skip link focus | 1280 light | screenshot + vision | PASS (polish note 4) |
| Nav order Tree→Kinship→Feed→Account, brand→/feed, `aria-current` | /tree /kinship /account /login /feed, desktop+390 | DOM | PASS |
| `?redirect=` preserved; authed /login → /feed | /account, /login?redirect=/feed | URL/DOM | PASS |
| 404 page renders with working nav exits | /nope-404 | DOM text | PASS |
| Empty state (`feed-empty` EmptyState) | — | **code-verified only** | markup matches draft intent |
| No-family (`no-family` note + selector; auto-selects first family so rare) | — | **code-verified only** | PASS; localStorage Feed-scoped, no tree sync (decision preserved) |
| Paging error (`feed-page-error` inline alert + retry, nextCursor-gated) | — | **code-verified only** | matches draft inline-paging-error pattern |
| Demo amber notice + Demo chip (`demo-notice`, demo tokens) | — | **code-verified only** | markup verified; demo session NOT reachable: `POST /api/v1/auth/demo` → 403 (501 right after restart) |
| Authenticated composer (counter 0/5000 runes, URL images, aria-invalid) | — | **code-verified only** | magic-link login not completable in QA env |

Vision delivered actual image bytes for two contact sheets (`sheet-desktop.png` 4 images, `sheet-mobile-misc.png` 6 images) via one-image-per-call ImageReader. Earlier v3 draft evidence remains at `evidence/`.

**Findings — no blocking defects; polish (non-blocking):**
1. `family-error` (families-list failure) renders as bare red text without border/retry, lighter than the `feed-error` card pattern; suggest reusing the bordered alert + retry (matches draft error treatment).
2. Offline-ready toast ("Ứng dụng đã sẵn sàng hoạt động ngoại tuyến") overlaid content near the mobile tabbar during loading/error captures (InstallPrompt/PWA); confirm auto-dismiss timing/offset.
3. Copy deltas vs draft (non-structural): eyebrow "Chuyện nhà" (draft: "Cây Gia Phả · Dòng họ đang chọn"), section "Bảng tin gia đình" (draft: "Bài viết mới"), rail "Lối tắt" (draft: "Bắt đầu từ gia đình bạn"); NotificationToggle retained. Owner may accept or request copy alignment.
4. Skip-link focus ring hugs the viewport corner (left/top 8px); consider small padding increase.

**Environment-blocked (not a frontend defect):** demo login endpoint refuses sessions in the restored stack (403/501), so demo amber and authenticated composer could not be screenshot-verified; both are code-verified above. Tree `?family` and anchor/orientation decisions untouched by this feature (verified `/tree?family=...` independent of Feed selection).

**Verdict: PARTIAL — no blocking visual defects; reachable-state conformance to approved OD draft v3 is PASS; demo/composer remain code-verified only due to environment; polish items 1–4 optional (within the 2-cycle correction budget if owner requests).**

## 2026-10-01 feeds-main-canonicalize — OD source-of-truth canonicalization record

**Action (OD project `cgp-v2-apple-redesign`):** promoted owner-approved draft v3 content to the canonical Feed artifact and removed the draft, leaving exactly one canonical Feed design file.

- **Before:** `feed.html` = old baseline, 8633 bytes, SHA-256 `3aab66cd82bb073552149bdd2328fb32e01b18f71685ffb01f20d99a85904186` (approved 2026-09-28 baseline; superseded, identity retained here). `feed-main-draft.html` = approved v3, 12773 bytes, SHA `6be0ed0d6fe4aa357386e9f358bb82044260fe402c304f4ac473cf38fda79e87` (owner approval 2026-10-01, note `1b78ca38`).
- **Write:** approved bytes written to `feed.html` via OpenDesign MCP `write_file` (stdio MCP server `od mcp`, daemon 127.0.0.1:7456). Tool-reported new version id `3a3094af-c7bd-4295-b5c4-4933f414454d` (feed.html version 4).
- **Verification (retrieved bytes, daemon raw route):** `feed.html` → HTTP 200, **12773 bytes, SHA-256 `6be0ed0d6fe4aa357386e9f358bb82044260fe402c304f4ac473cf38fda79e87` — byte-identical to the approved v3 content.** Re-verified again after draft deletion.
- **Draft removal:** `feed-main-draft.html` deleted via OD MCP `delete_file` (ok:true); raw route now 404; `list_files` (43 files) contains exactly one feed-related entry: `feed.html`. The canonical OD reference for `/feed` is now **`cgp-v2-apple-redesign/feed.html`** (preview `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/feed.html`, daemon-session lifetime).
- **Known consequence (non-blocking, flagged):** byte-identity requirement kept the artifact's internal self-links (`brand` href, active nav, tabbar "Bảng tin") pointing at `feed-main-draft.html`, which now 404s inside OD preview. Fixing those hrefs would change the SHA and therefore requires a new owner-approved content revision; not done unilaterally.
- Local snapshot `.agents/shared/planning/feeds-main-redesign/feed-main-draft.verified-v3.html` (same SHA) remains as external evidence of the approved content. Runtime MCP session to OpenDesign was erroring (empty ToolException); writes/reads were performed through the same OD MCP stdio server driven directly (`od mcp` CLI, JSON-RPC), with daemon raw-route read-back verification above. No application code or other OD files touched.
