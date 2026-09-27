# CGP v2 — Apple-inspired UI design system: **Quiet Clarity**

**Status:** original six-page baseline audited; 2026-09-27 all-routes gate addendum below supersedes earlier scope/publication statements · **Scope:** shipped route visual references plus archived concept specimens; `/tree` **surrounding chrome only** · **Audience:** Vue 3 implementers · **Date:** 2026-09-26

> A calm, legible genealogy workspace: content first, restrained warm-paper materials, deep-terracotta actions, and a deliberately distinct amber demo mode. Inspired by Apple's values of clarity, deference and subtle depth—not a copy of Apple's UI or its proprietary typeface.

## 1. Scope, relationship to previous work, and implementation boundaries

This adapts the **Warm Heritage** visual language (`.agents/shared/planning/ui-redesign/design-system.md`) for the six audited mockup screens. Carry forward the recognizable CGP terracotta and warm paper, but simplify them: no loud generation stripes or decorative glyph watermarks. Be Vietnam Pro is used consistently; no unbundled Fraunces is referenced. The **spirit** of the previous readability/accessibility contracts remains: Vietnamese text needs generous line height; demo accounts must remain visibly distinct; interaction focus is never invisible.

**Important routing note:** the current Vue app has `/tree` as the home route, plus `/login`, `/members/:id`, `/kinship`, `/feed`, `/account` and auth/404 routes. `dashboard.html` and `persons.html` below are **design propositions**, not presently shipped routes; developers can reuse their dashboard/stat and directory components where appropriate or add routes in a separately scoped implementation task. The mockup of `/tree` is intentionally a canvas **placeholder**, not a redesign of rendered nodes/connectors. Existing `/kinship`, `/feed`, `/account`, OAuth callback, email verification and not-found views should be restyled by applying the shared kit below; `settings.html` represents the account/settings visual direction. This is a design specification only—**no app source files are modified.**

### Technical contracts to preserve, not redesign

- Tree rendering remains one HTML5 Canvas connector layer, ≤300 visible person-card DOM nodes, DPR capped at 2. Do not change card geometry, connector layout or low-zoom behavior as part of this styling proposal.
- Continue using the shared avatar URL allowlist/regex validator; do not accept arbitrary remote avatars. Mockup initials are placeholders.
- Pointer capture must guard `e.target.closest('button')` before capturing. Floating controls in the mockup are buttons to remain interactive.
- Demo accounts remain non-linkable to a real person (403 first); style never implies elevated permission.
- Kinship labels use the existing versioned cache and post-commit invalidation.
- Keep functional `aria-*`, semantic headings and `data-testid` attributes of implemented components.

## 2. Principles

1. **Content wins.** Wide margins, restrained information density, no ornamental hero illustration; genealogy facts dominate chrome.
2. **One consistent material language.** Canvas `#F8F6F2`, pure-white cards, very faint hairlines and diffuse shadows; nav may use light translucency and 20px blur. No frosted overlay over dense text or full-page gradient.
3. **One primary action.** Terracotta communicates navigation, selected state, self identity, focus and primary action. Reserve saturated color for actionable moments; secondary actions are neutral.
4. **Demo stays identifiable.** Every demo entry point and account state uses the amber family **plus explicit “Demo”/“Bản dùng thử” text**, not color alone. Accessible amber text is `#9A5700` on pale `#FBF3E4`; CTA uses dark amber with white label.
5. **Genealogy detail without noise.** Generation tiers use quiet neutral-tinted dots or bars. Do not add colored left stripes to every content card. The shipped tree-card generation geometry is not retouched here.
6. **Legibility before mimicry.** Vietnamese glyphs must not clip: headings/badges line-height ≥1.45, body ≥1.6. Use self-hosted Be Vietnam Pro first; system fonts as fallback. Do not fetch SF Pro (proprietary) or CDN fonts.

## 3. Tokens — single source for mockups

The browser mockups share [`mockups/assets/tokens.css`](mockups/assets/tokens.css). Its CSS custom properties are the canonical visual constants for this design phase. In the Vue implementation map these to Tailwind CSS v4 `@theme` in `web/src/assets/main.css` and the existing UI components rather than shipping a parallel CSS framework.

### 3.1 Colors

| Role | Light | Dark | Use |
|---|---|---|---|
| `--bg-canvas` | `#F8F6F2` | `#1C1A19` | Page background |
| `--bg-canvas-deep` | `#EFEBE5` | `#151312` | Recessed tree scene behind preserved renderer |
| `--surface-card` | `#FFFFFF` | `#292624` | Cards, forms, panes |
| `--surface-well` | `#F8F6F2` | `#36312D` | Neutral buttons, segmented track, avatar fallback |
| `--surface-quiet` | `#FCFBF8` | `#24211F` | Quiet login region |
| `--ink-1` | `#1D1D1F` | `#F8F6F2` | Headings, main text |
| `--ink-2` | `#55555C` | `#C6C6CB` | Body secondary, AA legible |
| `--ink-3` | `#636369` | `#B0B0B6` | Readable captions/meta, including mobile navigation |
| `--ink-4` | `#636369` | `#B0B0B6` | Disabled *meaningful text*; muted by role/weight, not reduced contrast |
| `--ink-placeholder` | `#636369` | `#B0B0B6` | Informative input placeholders at full opacity (`::placeholder { opacity:1 }`) |
| `--hairline` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.10)` | Cards/dividers |
| `--hairline-strong` | `rgba(0,0,0,.12)` | `rgba(255,255,255,.16)` | Inputs |
| `--accent` | `#A84220` | `#D87D52` | Non-text decorative marks and focus strokes; **not** dark-mode text or white-label fills |
| `--accent-fg` | `#963A1C` | `#F2AD89` | Terracotta foreground text on cards, wells, and selection tints |
| `--accent-button` | `#A84220` | `#A84220` | White-label terracotta button and brand-mark fills |
| `--accent-hover` | `#89351B` | `#873318` | White-label button hover fill; AA both modes |
| `--accent-soft-hover` | `rgba(168,66,32,.06)` | `rgba(216,125,82,.10)` | Ghost hover tint; text remains `--accent-fg` and AA on canvas/card/well |
| `--accent-press` | `#89351B` | `#813017` | White-label button pressed fill; AA both modes |
| `--accent-tint` | `#F9EDE6` | `rgba(216,125,82,.14)` | Selected well |
| `--demo-deep` | `#9A5700` | `#FFC46B` | Amber demo text |
| `--demo-button` | `#9A5700` | `#9A5700` | White-label demo button fill |
| `--demo-hover` | `#804800` | `#804800` | White-label demo hover fill |
| `--demo-soft` | `#FBF3E4` | `rgba(255,179,64,.14)` | Demo panels |
| `--demo` | `#E8890C` | `#FFB340` | Demo marks, not copy |
| `--success` | `#34A853` | `#32D074` | **Decorative/icon/dot only** (light value fails normal-text AA on white); never semantic text |
| `--success-fg` | `#187B3C` | `#32D074` | Success text on white/card/canvas and success-soft |
| `--success-soft` | `#E9F6EE` | `rgba(50,208,116,.14)` | Success badge background; dark case must be composited |
| `--danger` | `#E5484D` | `#FF6961` | **Decorative/icon/stroke only** (light value fails normal-text AA on white); never semantic text |
| `--danger-fg` | `#B82C34` | `#FF817B` | Error/destructive text on card/canvas and danger-soft |
| `--danger-button` | `#B82C34` | `#B82C34` | White-label destructive fill |
| `--danger-hover` | `#A3222A` | `#A3222A` | White-label destructive hover fill |
| `--danger-soft` | `#FDECEC` | `rgba(255,105,97,.14)` | Error badge background; dark case must be composited |

Generation coding is **subtle and informational**, not the main palette:

| Generation | Accent light | Soft light | Accent dark | Soft dark |
|---|---|---|---|---|
| 1 | `#8C8C94` | `#F3F3F5` | `#A6A6AD` | `#262628` |
| 2 | `#6E7B8E` | `#F1F4F8` | `#8C9AAE` | `#232830` |
| 3 | `#5E7F79` | `#EFF5F4` | `#7FA098` | `#202826` |
| 4 | `#94795A` | `#F6F2EC` | `#B09472` | `#2A251F` |

Terracotta and amber are the two branding accents; green/red are semantic exceptions. OAuth provider symbols alone may use their official colors. **Foreground and fill must be selected separately:** light `--success` and `--danger` are **decorative/icon/stroke colors only**, never 12–15px copy; `--ink-3`/`--ink-4`/`--ink-placeholder` are now AA even for meaningful labels; dark `--accent` is a focus/decorative color, not text or a white-label fill. For text use `--accent-fg`, `--demo-deep`, `--success-fg`, `--danger-fg`; for white-label filled buttons use `--accent-button`, `--demo-button`, `--danger-button`. Decorative-only use is limited to non-text icons, dots, focus/border strokes and charts **accompanied by text or a programmatic name**—never communicate a state by a low-contrast color alone.

### 3.2 Type and spacing

**Stack:** `"Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Mockups include **12 local WOFF2 assets**: Vietnamese + Latin Extended + Latin for each of 400/500/600/700; `@font-face` declarations carry the @fontsource `unicode-range` for each subset so base Latin, digits, punctuation and Vietnamese marks all render in Be Vietnam Pro, without network assets. `font-display:swap` remains. Files reside at `mockups/fonts/`; this corrects the earlier four-file Vietnamese-overlay-only package. `--font-mono` remains an intentional monospace exception for some counts/dates.

| Level | Size/weight | Line-height | Tracking | Use |
|---|---:|---:|---:|---|
| Display | 34px / 700 | ≥1.45 | −0.022em | Login hero only; 28px on mobile |
| Page title | 28px / 700 | ≥1.45 | −0.019em | Screen titles (24px mobile) |
| Section | 22px / 600 | ≥1.45 | −0.015em | Major card sections |
| Subhead | 17px / 600 | ≥1.45 | −0.012em | Card headers |
| Base emphasis | 15px / 400–600 | ≥1.6 body | normal | Names / highlighted data |
| Body | 13px / 400 | ≥1.6 | normal | Descriptions, controls |
| Footnote | 12px / 400–500 | ≥1.45 | normal | Metadata, compact labels |
| Tree micro badge | 10px / 600 | ≥1.45 | +0.01em | Tree-side badges only |

`tabular-nums` for dates, counts and pagination. Spacing base: **4px**; scale `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80`. App max width **1120px** with **24px desktop / 16px mobile** gutters. Desktop nav height **56px**. Screen top pad **38px desktop / 24px mobile**. Card gap **16–18px**, card padding **18–24px**. Main mobile bottom padding ≥92px to clear the fixed tab bar and safe area.

### 3.3 Radii, materials, elevation

| Token | Value | Use |
|---|---:|---|
| `--r-sm` | 8px | Compact chips/controls |
| `--r-md` | 10px | Inputs, menu items |
| `--r-lg` | 14px | Buttons, small cards |
| `--r-xl` | 18px | Standard cards, panes |
| `--r-2xl` | 24px | Dialog, large login card |
| Pill | 999px | Badges, segmented controls, avatars only |
| `--shadow-1` | `0 1px 2px rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.03)` | Cards |
| `--shadow-2` | `0 2px 8px rgba(0,0,0,.05), 0 1px 2px rgba(0,0,0,.03)` | Menus / auth card |
| `--shadow-3` | `0 10px 32px rgba(0,0,0,.10), 0 2px 8px rgba(0,0,0,.04)` | Modal / floating control |

Dark elevation strengthens shadow opacity; **do not** turn dark cards into bright outlined tiles. Translucent sticky nav or floating controls: ~78–82% card background with `backdrop-filter: saturate(180%) blur(20px)`, 1px hairline. Provide opaque fallback if backdrop filter unsupported.

### 3.4 Motion

- Hover/focus feedback **140ms**, content transitions **240ms**, entrance **420ms** maximum.
- Curves: `cubic-bezier(.25,1,.5,1)` for ease-out and `cubic-bezier(.34,1.3,.64,1)` only for tiny spring responses.
- Buttons may press to **0.98 scale**, never bounce major layout. Screen transitions can fade/translate ≤10px.
- Reduce to effectively zero duration under `prefers-reduced-motion: reduce`; no perpetual decorative animation.

## 4. Component treatment rules

| Component | Treatment | Interaction / state |
|---|---|---|
| **Primary button** | `--accent-button` fill, white text, 14px radius, 40–46px high. Exactly one per primary task region. | `--accent-hover` and `--accent-press` are both darker *white-text-AA* fills; active scale .98; visible focus halo; disabled neutral well with readable `--ink-4` label. |
| **Secondary / ghost** | Neutral recessed fill or terracotta text on transparent. | Hover neutral fill; never introduce terracotta or an unrelated gradient. |
| **Demo CTA** | Amber panel + explicit “Demo” label and `--demo-button` fill with white label, not a terracotta button. | Retains login/state distinction; no demo binding action to a real user. |
| **Cards** | White / dark card on neutral canvas, 18px radius, 1px hairline, shadow-1. | Hover lift at most shadow-2; content never crowded. |
| **Forms** | Labels above 40px+ inputs, 10px radius, 1px strong hairline. | Focus terracotta 3px halo; error red border + text; loading disable submit and expose live status; success replaces—not overlaps—form feedback. |
| **Navigation** | 56px sticky translucent top bar; active route a neutral filled pill, not saturated. Mobile bottom tabbar with icon+label. | Active is semantic as well as visual (`aria-current="page"`); no orphan mobile routes. |
| **Modals** | 24px radius, surface-card, shadow-3, narrow max width ~480px; quiet scrim. | Escape closes, focus trapped/returned; destructive confirm requires explicit red action. |
| **Tables/lists** | Real table headers where tabular; 1px row dividers; 13px body; minimal zebra (prefer none). | Row hover in `--surface-well`; paginate; at ≤767px hide low-priority columns, never shrink Vietnamese names to unreadability. |
| **Badges** | Small text-bearing pills, neutral for informational and muted status. | Demo `--demo-deep`; self `--accent-fg`; success `--success-fg`; danger `--danger-fg`. Non-text indicator dots may use decorative tokens, but must have accompanying text. |
| **Empty/loading/error** | Centered simple icon and message, one next action; skeleton neutral well; errors actionable and announced. | Search empty state names active query and clear-filters action. |

### 3.5 Current contrast and focus

WCAG 2.1 relative luminance checks against *current opaque* token pairs: white / terracotta button `#A84220` **6.06:1**; white / hover `#89351B` **8.11:1**; foreground `#963A1C` / selected tint `#F9EDE6` **6.26:1**; dark foreground `#F2AD89` / well `#36312D` **6.80:1**; dark metadata `#B0B0B6` / well `#36312D` **5.96:1**; white / demo button `#9A5700` **5.62:1**. Semantic foreground and fill tokens remain distinct; opacity blends must be recalculated on their real composite backgrounds. Focus uses `--shadow-focus` and `:focus-visible`; disabled controls retain readable text and are non-interactive. Current dark background is `#1C1A19` and light canvas `#F8F6F2`.

## 5. Responsive map

- **< 768px:** Single-column cards; 16px gutters; app mobile tabbar; no desktop nav; searchable directory keeps **name + status**; the last desktop-only specimen-action column is intentionally hidden at ≤767px, while Nguyễn Văn Cường’s name remains the direct profile link. Generation chips scroll horizontally. Person-detail actions stack vertically. Tree side panes collapse behind buttons; the mobile mock now opens the navigation drawer by click or Enter/Space, and search opens that drawer with focus moved to its input. Close, scrim click, or Escape dismisses and restores trigger focus; Tab is contained while open. The inspector remains a desktop specimen. The canvas fills remaining viewport; none of this changes the renderer or implements search results, filtering, zoom or pan. Login collapses to one min-width-safe auth panel, independently scrollable to the demo action.
- **768–1023px:** Standard top nav; panels simplify (tree right inspector collapses) to protect the canvas. Dashboard can remain 2-column while stats fit.
- **≥1024px:** 1120px content shell; tree can use 255px left pane + flexible canvas + 280px inspector. Login uses split intro + auth card.

Account for `env(safe-area-inset-bottom)` on mobile tabbar. At 320px devices permit chip-row horizontal scroll and wrap paired actions; do not make the document itself horizontally scroll. Tester follow-up confirms login document scrollWidth = 320px in both themes at 320px, and 390px at 390px.

## 6. Mockups and audit map

These are **plain static HTML/CSS visual references**, not wired Vue routes. All six import the same token file and local fonts; open the file directly in Chrome. Append `?theme=light` to explicitly preview light mode on a dark-mode host; otherwise follow `prefers-color-scheme`.

| Screen | Mockup | Desktop light target | Mobile light target |
|---|---|---|---|
| Login / OAuth + magic link + demo | [`mockups/login.html`](mockups/login.html) | [`audit-evidence/login-desktop-light.png`](audit-evidence/login-desktop-light.png) | [`audit-evidence/login-mobile-light.png`](audit-evidence/login-mobile-light.png) |
| Dashboard / proposed home | [`mockups/dashboard.html`](mockups/dashboard.html) | [`audit-evidence/dashboard-desktop-light.png`](audit-evidence/dashboard-desktop-light.png) | [`audit-evidence/dashboard-mobile-light.png`](audit-evidence/dashboard-mobile-light.png) |
| Person detail | [`mockups/person-detail.html`](mockups/person-detail.html) | [`audit-evidence/person-detail-desktop-light.png`](audit-evidence/person-detail-desktop-light.png) | [`audit-evidence/person-detail-mobile-light.png`](audit-evidence/person-detail-mobile-light.png) |
| Person list / management (proposed) | [`mockups/persons.html`](mockups/persons.html) | [`audit-evidence/persons-desktop-light.png`](audit-evidence/persons-desktop-light.png) | [`audit-evidence/persons-mobile-light.png`](audit-evidence/persons-mobile-light.png) |
| Settings / account direction | [`mockups/settings.html`](mockups/settings.html) | [`audit-evidence/settings-desktop-light.png`](audit-evidence/settings-desktop-light.png) | [`audit-evidence/settings-mobile-light.png`](audit-evidence/settings-mobile-light.png) |
| Tree chrome & panels (placeholder canvas) | [`mockups/tree.html`](mockups/tree.html) | [`audit-evidence/tree-desktop-light.png`](audit-evidence/tree-desktop-light.png) | [`audit-evidence/tree-mobile-light.png`](audit-evidence/tree-mobile-light.png) |

Older pre-audit targets under `screenshots/` are historical and not fresh evidence. Current post-edit dark targets use `audit-evidence/{page}-{desktop,mobile}-dark.png`. Cross-page overview sheets use `audit-evidence/contact-{desktop,mobile}-{light,dark}.jpg`.

### Final mockup visual audit (Chrome CDP + ImageReader)

Fresh canonical captures: `audit-evidence/{dashboard,login,person-detail,persons,settings,tree}-{desktop,mobile}-{light,dark}.png` at 1440×900 and 390×844; four `contact-{desktop,mobile}-{light,dark}.jpg` sheets. Actual PNG image bytes were sent to ImageReader for the four sheets and the mobile dashboard; current mobile light sheet was re-inspected after correction. Chrome CDP captures set the exact viewport and measured document horizontal scroll; current mobile pages have document `scrollWidth=390` at 390px. The `persons` filter and `settings` anchor menu intentionally scroll **within** their own strips. Earlier headless `--window-size` screenshots misleadingly reported a 500px CSS viewport; CDP device metrics corrected this. `audit-evidence/capture-log.txt` records route, theme and geometry. Contact sheets are overview only; full-size PNGs retain text evidence. Bottom-of-frame cutoff on naturally scrollable pages is a fold, not automatically a defect.

**Canonical representation:** the six standalone HTML files listed above plus shared `mockups/assets/tokens.css`. No hash-routed index is maintained. `dashboard.html` and `persons.html` remain *proposed* pages, not shipped Vue routes; `tree.html` shows chrome and accessible renderer placeholder, never card/connector geometry. Other existing Vue routes (kinship/feed/auth callbacks/404) are outside this six-mockup scope. Live OD read-only inspection confirmed project `cgp-v2-apple-redesign`: its `login.html` and `tree.html` are stale against these local files, four requested standalone filenames are missing, and its separate hash-routed `index.html` is an older eight-route concept without dashboard/persons. No callable OD write MCP is available here; nothing was re-published or verified as synchronized. See `design-findings.md` for exact hashes and publication handoff. Refer to `design-findings.md` for per-screen evidence and caveats.

**Implementation-specific state rule:** the sample state cards appended below the main view are a labeled *design specimen gallery* for empty/loading/error, not simultaneous runtime UI. Implement exactly one state at a time, preserve `role=status`/`role=alert` and focus order, and wire controls to application logic. Settings depicts a demo provider-link restriction account: do not enable saves or family-data binding in demo. Only Nguyễn Văn Cường has a full profile specimen; other directory names are not falsely linked to his profile. The tree desktop inspector now shows Nguyễn Văn Cường with matching NVC initials, đời thứ 2, 1952–2020, deceased status, father Nguyễn Văn An and mother Trần Thị Hòa, and an explicitly named link to his `person-detail.html`; it no longer promises Nguyễn Minh Phúc’s profile. Login includes OAuth buttons, magic-link baseline and separate state specimens; auth callback/verification are not designed by these six pages.

**Visual verdict:** six standalone sources and their initial desktop/mobile light/dark states are visually reviewed; **PARTIAL for application/OD completeness** because these are static previews and the additional Vue route/state families remain outside scope. No Vue implementation was changed.

### Shared specimen genealogy and chart scale (implementation handoff)

The six mocks use one internally consistent *sample family*, not database fixtures: Nguyễn Văn An (1921–2008, generation 1) → Nguyễn Văn Cường (1952–2020, generation 2) → Nguyễn Thị Anh (1979–, generation 3) → her two children **Nguyễn Minh Phúc (1998–, generation 4)** and **Nguyễn Minh Tuấn (2005–, generation 4)**. Phạm Thu Hằng (2006–, generation 4) is presented as Tuấn’s *bạn đời*; no child of that couple is asserted. Cường’s desktop tree inspector and detail specimen match one another; the account/avatar is **NMP**, Phúc. Directory rows are seven illustrative people from a family of 128, not the full dataset. Demo generational totals **9 + 24 + 47 + 48 = 128** are shared with tree filters. Dashboard distribution bars use the declared scale **count ÷ 48 × 100** (rounded to two decimals): 18.75%, 50%, 97.92%, 100% respectively. A 48-person bar is therefore longer than the 47-person bar; these are *not* percentages of the full family.

### Tester follow-up — targeted affected-screen correction

The independent browser report `.agents/tester/RESULTS/2026-09-26-apple-redesign-mockups-browser-qa.md` identified (1) tree inspector identity mismatch, (2) inert mobile tree menu/search, and (3) login overflow at 320px. Targeted fixes are in the two HTML mockups only. New Chrome CDP evidence is `audit-evidence/{login,tree}-{320,390}-{light,dark}.png`, tree `-menu-open`/`-search-open` PNGs, four `tester-followup-{320,390}-{light,dark}.jpg` contact sheets, and `tester-followup-capture-log.txt`. The inspector link is a **desktop** state; its identity and `person-detail.html` target were checked from source and measured DOM but were not freshly desktop-screenshotted in this mobile-only follow-up. The mobile drawer is an intentionally tiny *presentation-only* JS affordance—not application logic. It sets `aria-expanded`, provides focus entry/return and a bounded Tab loop. All other tree toolbar and generation controls remain visual specimens; the Vue app must wire them to preserved renderer/search APIs, with the existing pointer-capture button guard, demo restrictions, and Canvas limits. Do not mistake this prototype behavior for a working genealogy search or tree.

### Independent Reviewer follow-up evidence

After the four-blocker correction, all six standalone pages were re-rendered at 1440×900 and 390×844 in both themes, with updated 24 PNGs, four `contact-*.jpg` sheets, and `audit-evidence/capture-log.txt`. ImageReader inspected all four actual contact sheets; full-resolution `persons-desktop-light.png` verifies Phúc’s new row, and `dashboard-desktop-light.png` verifies increasing bars. The first post-font full-resolution dashboard audit uncovered that a width on inline `.genbar__fill` spans was not actually painting; the final CSS adds `display:block`. Chrome CDP confirms painted fill widths 30/80/156.67/160px on a 160px track, and custom Be Vietnam Pro for ordinary text (`audit-evidence/font-render-and-bar-probe.txt`). See `design-findings.md` for reviewer-by-reviewer disposition. The visible tree inspector shows Cường’s profile; the demo account is Phúc, his **grandson through Anh**, not the inspector selection.


## 7. 2026-09-27 all-shipped-routes clarity gate addendum (supersedes six-page scope)

**Gate at inventory:** NEEDS REDESIGN for all-pages. Six published pages were a coherent palette sample, **not** a complete route contract: `/feed`, `/kinship`, `/auth/email/verify`, `/auth/oauth/callback`, and `404` lacked direct canonical references; `settings.html` omitted real account-linked-identity/contact/security surfaces; authenticated navigation incorrectly featured unshipped Dashboard/Persons routes and omitted Kinship/Feed. `/` redirects `/tree` and is not a separate page. This is a scope/IA failure, not a request to mimic Apple's appearance. The original visual premise passes Apple's *clarity values*—information hierarchy, space, restraint and legibility—conditional on route/state coverage below.

**Canonical route set after local correction:** separate HTML entries `login.html`, `tree.html` (chrome/empty placeholder, **not rendered-node/connector design**), `person-detail.html`, `kinship.html`, `feed.html`, `account.html`, `email-verify.html`, `oauth-callback.html`, `not-found.html`, all importing `assets/tokens.css` and bundled Be Vietnam Pro. **Archived visual concepts:** `dashboard.html`, `persons.html`, `settings.html`; these remain inspectable, but are NOT application routes, not linked from the authenticated top/bottom nav, and must not be implemented as part of this gate. `settings.html` is merely a privacy/preferences concept; use **`account.html`** for shipped `/account`. `person-detail.html` remains a one-person specimen; its parent tab is now Gia phả because `/members/:id` is reached through the tree, and unknown other relatives are not falsely linked to a single specimen.

### Shipped-IA and route mapping

| Vue route | Canonical design | Navigation and state contract |
|---|---|---|
| `/` | redirect to `/tree` | No dashboard/home page. |
| `/login` | `login.html` | Guest-only; provider buttons, email magic link pending/sent/error, amber Demo. No authenticated shell. |
| `/tree` | `tree.html` | Active Gia phả. Chrome/legend/panels only; preserve existing Canvas/cards exactly. Real app needs loading/error/empty/rendered states. |
| `/members/:id` | `person-detail.html` | Active parent Gia phả; breadcrumb to tree. Selected Nguyễn Văn Cường is a sample; actual data/content/buttons/relations/posts are route-owned. Loading/not-found/empty/event specimens. |
| `/kinship` | `kinship.html` | Active Quan hệ; select-two, swap, result/path, unrelated, pending, picker failure. The depicted An→Cường→Anh→Phúc path is illustrative; **do not hardcode the sample kinship term**. The actual engine and versioned cache determine labels. |
| `/feed` | `feed.html` | Active Bảng tin; public read/anonymous prompt, authenticated composer, image-URL affordance, post cards, empty/loading/error/pagination. Do not treat image placeholder as uploaded asset. |
| `/account` | `account.html` | Active Tài khoản; **guarded** auth, Demo provider-link restricted/amber, identity and contact cards, notification direction, no contacts, pending/error, unlink confirmation specimen. The provider-success example is for real accounts only. |
| `/auth/email/verify` | `email-verify.html` | Shell-free pending/verified/expired/malformed; new-link request returns to login. Retry current token is not resend. |
| `/auth/oauth/callback` | `oauth-callback.html` | Shell-free linked-success/provider/invalid-state/already-linked/demo-restricted errors. Outcome derived synchronously from callback params; do not invent loading state. Guard/navigation varies by auth status. |
| `/:pathMatch(.*)*` | `not-found.html` | Shell-free 404 with actual-tree and kinship recovery actions. |

The **four authenticated nav destinations** are always Gia phả / Quan hệ / Bảng tin / Tài khoản, with one `aria-current="page"` on the corresponding authored page. Person detail belongs to Gia phả. Standalone auth/error pages intentionally lack authenticated shell. Anonymous app shell must show sign-in affordance rather than Demo badge/avatar; visual samples assume Demo data only where stated. Do not copy the static HTML's sample identity to arbitrary users. The conceptual dashboard/person directory retain the shared shipped nav *as archived preview canvases* with no route-active tab; their content is never acceptance criteria.

### Accessibility, theming, and implementation boundaries

The same light/dark semantic tokens, local Be Vietnam Pro, focus-visible treatment, white-on-deep-terracotta primary buttons, explicit amber Demo, Vietnamese line heights, 320px navigation single-line labels, and mobile safe-area clearance apply to every route. System preference is the only theme policy. Static specimens beneath page content are **mutually exclusive visual states**, not simultaneous runtime UI, and buttons/forms in HTML are display references. In Vue use existing `AppLayout`, `AppButton`, `AppInput`, `AppDialog`, `AuthInterstitial`, `PostCard`, `KinshipResult` and all `data-testid`/`aria-*` hooks; preserve each view's business behavior/guards; introduce no route, backend/API, unrelated font/CDN or new UI framework. For `/tree`, no node/connector/layout/Canvas changes. Destructive unlink uses the existing dialog's focus trap, Escape, focus return and last-identity guard, not the specimen's in-flow group.

**Evidence and publication:** Local Chrome CDP captures in `gate-evidence/` cover all nine current route references at 1440×900 and 390×844, light/dark; plus all nine at 320×800 light/dark, with no document horizontal overflow in the final 54-cell capture. `gate-evidence/contact-{desktop,mobile}-{light,dark}.jpg` are route-family overview images; `gate-evidence/contact-{desktop,mobile}-light-states.jpg` show scrolled selected state galleries. These actual image bytes were delivered to ImageReader; do not mistake folds under mobile fixed nav for inaccessible content without a scroll check. `gate-evidence/{kinship,feed,account,person-detail}-mobile-{light,dark}-scrolled.png` demonstrate scrolling (e.g. kinship path readable after 570px). Source statuses and exact evidence per route are in `design-findings.md` below. The new local artifacts are **not yet published to OpenDesign**; before claiming cross-store sync, publish only after this local gate is approved and then re-list and re-read **each** changed OD page and shared token asset. Older OD `index.html`, `account.html`, `feed.html`, `kinship.html`, etc. remain older concepts until explicitly reconciled; neither is a substitute for canonical files.


## 8. Complete 9-route runtime state contracts & visual state sheets

To eliminate guesswork before Vue implementation, representative visual state sheets (`mockups/tree-states.html`, `mockups/account-states.html`, and `mockups/person-detail-states.html`) provide distinct hash-routed panels for complex runtime branches, complementing the main page mocks (`mockups/{login,kinship,feed,account,email-verify,oauth-callback,not-found}.html`).

### 8.1 Complete route × state specification

1. **`/login` (`LoginView.vue`):**
   - *Idle (guest):* 3 OAuth buttons (Google, Facebook, Zalo) + email magic-link input + amber Demo panel (`INV-04/05`).
   - *Magic link submit:* `magicLinkLoading = true` disables input, primary button shows spinner, magic-sent banner (`.magic-sent`) is hidden.
   - *Magic link sent:* `.magic-sent` banner displayed with checkmark icon and explanatory text; form input cleared; toast confirmation dispatched.
   - *Validation / API error:* Email input highlights with red border; toast notification dispatches `formatApiError(err)`.
   - *Demo login loading / failure:* Demo button shows spinner `demoLoading = true`; failure toast dispatches on error.
   - *Verified callback notice:* Triggered via `?verified=1` or `?verified=true`; displays emerald confirmation notice at top of auth card.
   - *Auth redirect guard:* Authenticated users hitting `/login` redirect immediately to `/tree`.

2. **`/tree` (`TreeView.vue` + `TreeVisualizer.vue`):**
   - *Rendered-tree success (renderer-owned):* One Canvas connector layer; <= 300 visible person-card DOM nodes (`TreeNodeCard.vue`); DPR <= 2 with 16.7M-pixel backing store guard; orthogonal connectors with generation color bands; GPU-accelerated pan/zoom (`translate3d + scale`).
   - *Low-zoom dot mode:* Below 0.6x zoom, full cards collapse to 14px circular dot buttons (`TreeNodeCard.vue` button marker) matching generation accent color.
   - *Button pointer-capture guard:* `pointerdown` on `closest('button')` immediately returns without capturing pointers, ensuring compass, zoom, and fit-view controls work reliably.
   - *Store loading:* Central spinner card replaces canvas viewport (`data-testid="tree-loading"`).
   - *Store error:* `EmptyState` component with failure message and outline `Thử lại` button (`data-testid="tree-retry"`).
   - *Empty tree:* `EmptyState` component; `Thêm thành viên` primary CTA visible only when `auth.isAuthenticated`.
   - *Unlinked user banner:* Blue callout banner (`INV-02`: line-height >= 1.45) prompting user to link account with tree member.
   - *Anonymous vs Demo behavior:* Anonymous users see tree chrome with `Đăng nhập để chỉnh sửa` hint instead of add button; Demo accounts display amber badge and cannot link to any tree member (backend 403-first binding).

3. **`/members/:id` (`MemberDetailView.vue`):**
   - *Hero card:* Avatar, member name, generation chip, living status chip, birth-death years, and action buttons (`Sửa`, `Xóa` for authenticated; `Đăng nhập để chỉnh sửa` hint for guest).
   - *Tab 1: Tổng quan (`overview`):* Definition list displaying family name, gender (`uiGender`), birth date, death date, notes.
   - *Tab 2: Quan hệ (`relations`):* 4 distinct groups (`Cha mẹ`, `Vợ chồng`, `Anh chị em`, `Con cái`) rendered with generation-striped cards, avatars, gender chips, and individual member profile links; empty groups display italic `group.emptyText`.
   - *Tab 3: Bảng tin (`posts`):* Displays list of `PostCard` components for this member's posts; empty list displays `Chưa có bài viết nào.`
   - *Edit modal (`MemberEditDialog.vue`):* Modal dialog with `MemberCardPreview` live preview card, full name input, gender select (`Nam`/`Nữ`), birth date, death date (disabled when `isLiving` checked), living checkbox, notes textarea, form-level API error, and submit button.
   - *Delete confirm dialog (`AppDialog.vue`):* Modal with risk warning regarding reassignment of children, outline cancel button, and red destructive delete button.
   - *Loading skeleton / Not-found fallback:* Loading card with spinner (`data-testid="member-loading"`); not-found `EmptyState` with `Về cây gia phả` recovery action.

4. **`/kinship` (`KinshipView.vue` + `KinshipResult.vue`):**
   - *Initial prompt state:* Before two members are chosen, card prompts user to select two individuals.
   - *Two-person selection:* Two combobox pickers with avatar, full name, swap button (`swapSelections`), and dialect selector (`Bắc`, `Trung`, `Nam`).
   - *Quick-demo shortcut:* Amber chip (`INV-04`) to quickly load demo pair (An -> Phúc).
   - *Calculation in-flight:* Primary button disabled with spinner (`kinshipStore.loading = true`).
   - *Result display (`KinshipResult.vue`):* Large relationship term (`data-testid="kinship-term"`, terracotta display type), grammar context sentence, metadata chips (lineage, distance, blood/marriage, dialect), and step-by-step path timeline with numbered avatar nodes, generation border colors, and role headings.
   - *Unrelated state:* Banner explaining no relationship was found in the graph.
   - *Member list load failure:* Error banner explaining failure to load member list.

5. **`/feed` (`FeedView.vue` + `PostCard.vue`):**
   - *PWA banner & header:* Install prompt banner, title, family selector dropdown, and push notification toggle.
   - *Authenticated composer:* Author avatar, borderless textarea, character counter (max 2000 runes), image URL input field with URL chips (including delete button), and submit button.
   - *Anonymous hint:* Amber/terracotta banner stating `Đăng nhập để đăng bài viết.` with login button.
   - *Feed loading:* 3-card pulsing skeleton (`data-testid="feed-loading"`).
   - *Feed error:* Red banner with error copy and outline retry button (`data-testid="feed-error"`).
   - *Empty feed:* `EmptyState` component for when family has zero posts.
   - *Feed posts list:* Chronological `PostCard` entries with author avatar, name, date, content text, and `ImageGrid`.
   - *Pagination:* `Tải thêm` outline button with loading spinner, and page-level error text if cursor fetch fails.

6. **`/account` (`AccountView.vue`):**
   - *Profile card:* Avatar, display name, Demo badge (if demo), and user ID.
   - *Demo notice:* Amber panel stating demo accounts are independent and cannot link to real OAuth providers.
   - *Linked identities list:* Grid of identity cards displaying provider icon/letter, provider name, subject identifier, linked date, and last login date.
   - *Unlink action & sole-identity guard:* Unlink button disabled with explanatory tooltip when `isSoleIdentity = true`.
   - *Confirm unlink dialog (`AppDialog.vue`):* Modal confirming disconnection of selected provider with cancel and destructive confirm button.
   - *Add provider section (real accounts only):* Buttons for Google, Facebook, Zalo; completely hidden for Demo accounts.
   - *Contact points list:* Rows for email and phone numbers with verification status badges (`Đã xác thực` / `Chưa xác thực`) and verify trigger button.
   - *Add contact form:* Select kind (`email`/`phone`), input value, and submit button.
   - *Empty contact state:* Notice displayed when zero contact points exist.
   - *Route guard:* Unauthenticated users redirect to `/login?redirect=/account`.

7. **`/auth/email/verify` (`EmailVerifyView.vue`):**
   - *Pending:* Step 2 indicator, spinner disc, `Đang xác thực liên kết...` title, and waiting message.
   - *Verified (success):* Step 3 indicator, emerald checkmark disc, `Đăng nhập thành công!` title, and 500ms auto-redirect to `/tree`.
   - *Expired / invalid:* Error disc, failure title, explanatory copy, and retry button (if token exists) or `Về trang đăng nhập` button.
   - *Missing token:* Direct error state indicating missing authentication code with return to login button.

8. **`/auth/oauth/callback` (`OAuthCallbackView.vue`):**
   - *Synchronous outcome:* Evaluated immediately from URL parameters `oauth_linked` or `oauth_error`.
   - *Success state:* Emerald checkmark disc, confirmation of linked provider name, 1.5s auto-redirect to `/account`.
   - *Error states:* Handled for `invalid_state`, `already_linked`, `provider_error`, `demo_restricted`, `server_error`.
   - *Navigation target:* Authenticated users see `Quay lại trang tài khoản`; guest users see `Về trang đăng nhập`.

9. **`/:pathMatch(.*)*` (`NotFoundView.vue`):**
   - *404 Display:* Terracotta icon disc, large 404 numeral, `Không tìm thấy trang` heading, and warm explanation.
   - *Recovery navigation:* Primary `Về cây gia phả` button, secondary `Tìm người trong họ` (Kinship) button, and browser back link.
