# CGP v2 — Apple-inspired UI design system: **Quiet Clarity**

**Status:** audited static mockup source of truth (2026-09-26); not a shipped app or Open Design sync · **Scope:** six standalone presentation references; `/tree` **surrounding chrome only** · **Audience:** Vue 3 implementers · **Date:** 2026-09-26

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

**Implementation-specific state rule:** the sample state cards appended below the main view are a labeled *design specimen gallery* for empty/loading/error, not simultaneous runtime UI. Implement exactly one state at a time, preserve `role=status`/`role=alert` and focus order, and wire controls to application logic. Settings depicts a demo-read-only account: do not enable saves or family-data binding in demo. Only Nguyễn Văn Cường has a full profile specimen; other directory names are not falsely linked to his profile. The tree desktop inspector now shows Nguyễn Văn Cường with matching NVC initials, đời thứ 2, 1952–2020, deceased status, father Nguyễn Văn An and mother Trần Thị Hòa, and an explicitly named link to his `person-detail.html`; it no longer promises Nguyễn Minh Phúc’s profile. Login includes OAuth buttons, magic-link baseline and separate state specimens; auth callback/verification are not designed by these six pages.

**Visual verdict:** six standalone sources and their initial desktop/mobile light/dark states are visually reviewed; **PARTIAL for application/OD completeness** because these are static previews and the additional Vue route/state families remain outside scope. No Vue implementation was changed.

### Shared specimen genealogy and chart scale (implementation handoff)

The six mocks use one internally consistent *sample family*, not database fixtures: Nguyễn Văn An (1921–2008, generation 1) → Nguyễn Văn Cường (1952–2020, generation 2) → Nguyễn Thị Anh (1979–, generation 3) → her two children **Nguyễn Minh Phúc (1998–, generation 4)** and **Nguyễn Minh Tuấn (2005–, generation 4)**. Phạm Thu Hằng (2006–, generation 4) is presented as Tuấn’s *bạn đời*; no child of that couple is asserted. Cường’s desktop tree inspector and detail specimen match one another; the account/avatar is **NMP**, Phúc. Directory rows are seven illustrative people from a family of 128, not the full dataset. Demo generational totals **9 + 24 + 47 + 48 = 128** are shared with tree filters. Dashboard distribution bars use the declared scale **count ÷ 48 × 100** (rounded to two decimals): 18.75%, 50%, 97.92%, 100% respectively. A 48-person bar is therefore longer than the 47-person bar; these are *not* percentages of the full family.

### Tester follow-up — targeted affected-screen correction

The independent browser report `.agents/tester/RESULTS/2026-09-26-apple-redesign-mockups-browser-qa.md` identified (1) tree inspector identity mismatch, (2) inert mobile tree menu/search, and (3) login overflow at 320px. Targeted fixes are in the two HTML mockups only. New Chrome CDP evidence is `audit-evidence/{login,tree}-{320,390}-{light,dark}.png`, tree `-menu-open`/`-search-open` PNGs, four `tester-followup-{320,390}-{light,dark}.jpg` contact sheets, and `tester-followup-capture-log.txt`. The inspector link is a **desktop** state; its identity and `person-detail.html` target were checked from source and measured DOM but were not freshly desktop-screenshotted in this mobile-only follow-up. The mobile drawer is an intentionally tiny *presentation-only* JS affordance—not application logic. It sets `aria-expanded`, provides focus entry/return and a bounded Tab loop. All other tree toolbar and generation controls remain visual specimens; the Vue app must wire them to preserved renderer/search APIs, with the existing pointer-capture button guard, demo restrictions, and Canvas limits. Do not mistake this prototype behavior for a working genealogy search or tree.

### Independent Reviewer follow-up evidence

After the four-blocker correction, all six standalone pages were re-rendered at 1440×900 and 390×844 in both themes, with updated 24 PNGs, four `contact-*.jpg` sheets, and `audit-evidence/capture-log.txt`. ImageReader inspected all four actual contact sheets; full-resolution `persons-desktop-light.png` verifies Phúc’s new row, and `dashboard-desktop-light.png` verifies increasing bars. The first post-font full-resolution dashboard audit uncovered that a width on inline `.genbar__fill` spans was not actually painting; the final CSS adds `display:block`. Chrome CDP confirms painted fill widths 30/80/156.67/160px on a 160px track, and custom Be Vietnam Pro for ordinary text (`audit-evidence/font-render-and-bar-probe.txt`). See `design-findings.md` for reviewer-by-reviewer disposition. The visible tree inspector shows Cường’s profile; the demo account is Phúc, his **grandson through Anh**, not the inspector selection.
