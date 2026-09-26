# CGP v2 — Design System Spec (App-wide "Warm Heritage" Extension)

**Status:** Proposal for implementation · **Anchor:** shipped `/tree` redesign (commit 210ddc4) · **Scope:** all screens except `/tree` (already done)

**Goal:** every screen feels like the tree — cream paper, white cards, terracotta accent, generation pastels, Fraunces display type — instead of the current cold slate-neutral look on login/auth/404/kinship/detail/feed.

**Mockups (browser-previewable):** see Open Design project `cgp-v2-ui-redesign` — files `01-login.html` … `06-feed-composer.html`.

---

## 0. Hard invariants (non-negotiable, project-wide)

| # | Invariant | Rule |
|---|---|---|
| INV-01 | Self-hosted fonts only | `@fontsource` imports in `main.css`; **no** CDN fonts/assets in production. Mockups embed base64 woff2. |
| INV-02 | Vietnamese diacritics never clip | `line-height` floors: **1.45 display / 1.6 body** (already global in `main.css` — keep). Never use `leading-none`/`leading-tight` on Vietnamese text; the tree card uses inline `style="line-height:1.45"` on `text-[10px]` badges — keep that idiom. |
| INV-03 | PWA identity | `theme_color #C85A32` on `background #FDFBF7` — unchanged. |
| INV-04 | Tailwind 4.1 utility-first | tokens live in `@theme` (`main.css`); class names below are copy-pasteable. |
| INV-05 | Demo distinction | Demo accounts and demo entry points are always **amber** — never terracotta (see §4.6). |
| INV-06 | Accessibility | visible focus ring on every interactive element (§4.7), WCAG AA text contrast, semantic headings/landmarks, `aria-*` preserved from current markup. The implemented UI kit strictly enforces INV-06 (visible focus ring) across all interactive elements; static HTML mockups omit focus rings purely for visual brevity — mockups are visual reference, the UI kit is the contract. |

---

## 1. Color tokens (all already in `@theme` — this is the consolidated map)

### 1.1 Surfaces
| Token | Hex | Use |
|---|---|---|
| `--color-cream` | `#FDFBF7` | Page background (all screens) |
| `--color-cream-card` | `#FFFFFF` | Cards, dropdowns, headers, dialogs |
| `--color-cream-muted` | `#F5EFE6` | Muted fill: secondary buttons, hover wells, table zebra |

### 1.2 Terracotta ramp (primary brand)
| Token | Hex | Tailwind class | Use |
|---|---|---|---|
| `--color-terracotta` | `#C85A32` | `bg-terracotta` / `text-terracotta` | Primary buttons, active nav, links, focus ring |
| `--color-terracotta-hover` | `#B24E2A` | `hover:bg-terracotta-hover` | Primary hover |
| `--color-terracotta-dark` | `#983F1E` | `text-terracotta-dark` | Text on soft bg, active nav text, emphasis |
| `--color-terracotta-border-hover` | `#F3D5C6` | `hover:bg-terracotta-border-hover` | Hover fill for terracotta-soft controls — applied as a background utility (`hover:bg-*`); the border remains `--color-terracotta-border` (`#F4D0C2`) |


### 1.3 Generation pastels (heritage coding — extend app-wide)
| Gen | Accent | Soft | Classes |
|---|---|---|---|
| 1 | `#E07A5F` | `#FBECE8` | `bg-gen-1` / `bg-gen-1-soft` |
| 2 | `#81B29A` | `#EDF5F1` | `bg-gen-2` / `bg-gen-2-soft` |
| 3 | `#6B9080` | `#EAF0EE` | `bg-gen-3` / `bg-gen-3-soft` |
| 4 | `#D4A373` | `#FAF3EB` | `bg-gen-4` / `bg-gen-4-soft` |

Fallback when generation unknown: terracotta pair (`--color-terracotta` / `--color-terracotta-soft`). Reuse existing helpers `genAccentVar(n)` / `genSoftVar(n)` from `tree/card-visual.ts`.

### 1.4 Neutral scale (slate — text, borders, secondary)
| Role | Class | Hex |
|---|---|---|
| Heading text | `text-slate-800` | `#1E293B` (global body color) |
| Body text | `text-slate-700` | `#334155` |
| Secondary text | `text-slate-500` | `#64748B` (= `--color-slate-neutral`) |
| Caption/placeholder | `text-slate-400` | `#94A3B8` |
| Hairline border | `border-slate-200` | `#E2E8F0` (cards, dividers) |
| Control border | `border-slate-300` | `#CBD5E1` (inputs, outline buttons) |
| Disabled fill | `bg-slate-100` | `#F1F5F9` |

### 1.5 Semantic hues (50/200/600-700-800 pattern)
| Meaning | Hue | Filled chip / micro-badge | Notes |
|---|---|---|---|
| Success / verified / living | emerald | `bg-emerald-50 text-emerald-700 border-emerald-200` | success circle `bg-emerald-100 text-emerald-600` |
| **Demo / trial** | **amber** | `bg-amber-100 text-amber-800` (+ `border-amber-200` button variant) | INV-04 — see §4.6 |
| Male | sky | `bg-sky-50 text-sky-700 border-sky-200` | gender micro-badge |
| Female | rose | `bg-rose-50 text-rose-700 border-rose-200` | gender micro-badge |
| Destructive | red | `bg-red-600 text-white` (button) / `bg-red-50 text-red-700 border-red-200` (banner) | |
| Self / info (tree lineage) | blue | `bg-tree-self-badge text-tree-self-text border-blue-200` | keeps tree's identity ring lineage |

### 1.6 Tree-scene blues (context-scoped — do NOT reuse outside tree canvas)
`--color-tree-bg #F8FAFC`, `--color-tree-card-border #BFDBFE`, `--color-tree-connector #93C5FD`, `--color-tree-self-ring #2563EB`, etc. remain tree-only.

### 1.8 Provider brand colors (explicit exceptions)
Google, Facebook, and Zalo marks may retain their official brand colors inside provider icons only. These are the sole approved non-token brand-color exceptions; all surrounding controls use registered theme tokens. `#F3D5C6` is registered exclusively as `--color-terracotta-border-hover`.


- **Banned slate-blue family**: `#4e6d8c`, `#5b7a99`, `#7d9cb8`, `#e9f0f6`, `#eef3f8`, `#f4f8fb` (and all other slate-blue hexes). They are not part of the registered token set and dilute the warm heritage aesthetic. Always use the registered neutral slate ramp (§1.4) or generation pastels (§1.3) instead.
- **Banned stray soft-terracotta hexes**: Do not invent arbitrary tints (e.g. `#c08370`). Use the canonical terracotta tokens: `--color-terracotta-soft` (`#F9EAE1`), `--color-terracotta-border` (`#F4D0C2`), `--color-terracotta-border-hover` (`#F3D5C6`), `--color-terracotta` (`#C85A32`), `--color-terracotta-hover` (`#B24E2A`), and `--color-terracotta-dark` (`#983F1E`).

---

## 2. Typography

Fonts (self-hosted via `@fontsource`, weights already imported):
- **Display — Fraunces 600/700**: brand, page titles, person names, kinship term, big numerals (404). Warm, bookish serif = the heritage voice.
- **Body — Be Vietnam Pro 400/500/600/700**: everything else. Excellent Vietnamese diacritic design.

Scale (line-heights respect INV-02):

| Step | Classes | Use |
|---|---|---|
| Display XL | `text-4xl font-display font-bold leading-[1.45]` (36px) | Kinship result term |
| Display L | `text-3xl font-display font-bold tracking-tight` (30px) | Login hero title |
| Display M | `text-2xl font-display font-bold` (24px) | Page titles (Kinship, Feed, Detail) |
| Display S | `text-lg font-display font-semibold` (18px) | Card/section titles |
| Body L | `text-base` (16px) | Composer input, hero intro |
| Body M | `text-sm` (14px) | Default body, buttons md, form labels (`font-medium text-slate-700`) |
| Body S | `text-xs` (12px) | Captions, meta, timestamps, chips |
| Micro | `text-[11px]` / `text-[10px]` + inline `style="line-height:1.45"` | Tree meta row, micro-badges |

Rules:
- Numbers/years: `font-mono text-[10px]` (existing idiom) or `tabular-nums`.
- Person names inside dense UI: `font-display font-semibold` (tree card idiom) — extends to pickers, relation cards, post authors.
- Uppercase eyebrow labels: `text-xs uppercase tracking-wider font-semibold text-slate-400` (kinship result idiom).

---

## 3. Space, radii, shadows, elevation

- **Spacing**: Tailwind 4-space scale; card padding `p-5` (desktop) / `p-4` (mobile), section gap `space-y-6`, intra-group `gap-2`/`gap-3`. Page gutters `p-4 sm:p-6`.
- **Radii**: `rounded-full` (chips, avatars, frosted widgets) · `rounded-xl` (page cards, dialogs) · `rounded-lg` (buttons, inputs, compact cards, tree cards) · `rounded-md` never for cards.
  - **Radius unification decision**: All page cards and dialogs use `rounded-xl` per §4 radii formula, applied consistently across all application views. Mockup 01 and 02 instances with `rounded-2xl` page cards are acknowledged visual drift; mockup HTML files remain as unchanged visual reference. In the codebase, there is no mixing — ONE formula (`rounded-xl` for page cards/dialogs) everywhere.
- **Shadows** (restrained, warm): `shadow-xs` default card · `shadow-sm` primary button, self-ring card · `shadow-md` hover card, floating widget · `shadow-lg` dropdowns/popovers. Never `shadow-xl+` in app chrome.
- **Hover elevation idiom** (from tree): `shadow-xs hover:shadow-md transition-all` — cards lift slightly.
- **Breakpoints**: `md` (768px) is the single app breakpoint — header↔bottom-nav swap, 1-col↔2-col forms. `sm` (640px) for minor padding/typography steps. `lg` only for 3-col relation grids.

---

## 4. Component formulas (copy-paste recipes)

### 4.1 Page card
```html
<div class="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
```
Sections inside a card separated by `border-t border-slate-100`.

### 4.2 Gen-stripe card (tree card idiom, extended to relation cards / picker rows)
```html
<!-- 4px semantic left stripe via border; gen accent from genAccentVar(n) -->
<div class="bg-white rounded-lg border border-slate-200 shadow-xs hover:shadow-md transition-all"
     style="border-left-width:4px; border-left-color: var(--gen-2);">
```

### 4.3 Pill chip (`AppChip`)
Base: `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium leading-normal`
| Variant | Classes |
|---|---|
| Primary/active | `bg-terracotta-soft text-terracotta-dark border-terracotta-border` hover `hover:bg-terracotta-border-hover` |
| Neutral | `bg-white text-slate-600 border-slate-300` hover `hover:bg-slate-50` |
| Success | `bg-emerald-50 text-emerald-700 border-emerald-200` |
| Warning (hôn phối/demo-adjacent) | `bg-amber-50 text-amber-800 border-amber-200` |

### 4.4 Micro-badge (gender, "Tôi", kinship, Demo, gen label)
```html
<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-normal
             bg-sky-50 text-sky-700 border border-sky-200">Nam</span>
```
Swap hue per §1.5. Demo badge: `bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-amber-200` (matches existing header idiom, gains a border).

### 4.5 Buttons (`AppButton` — keep API, adjust variant classes)
| Variant | Classes | Change vs today |
|---|---|---|
| primary | `bg-terracotta text-white hover:bg-terracotta-hover focus-visible:ring-terracotta shadow-sm` | replace `bg-[#C85A32]` literals with tokens |
| outline | `border border-slate-300 bg-white text-slate-700 hover:bg-cream-muted hover:border-slate-400 focus-visible:ring-terracotta` | hover warms from slate-50 → cream-muted |
| secondary | `bg-cream-muted text-slate-700 hover:bg-slate-200 focus-visible:ring-slate-400` | unchanged |
| ghost | `text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-300` | unchanged |
| danger | `bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500` | unchanged |
| **demo (new)** | `bg-amber-400 text-amber-950 hover:bg-amber-300 focus-visible:ring-amber-500 border border-amber-500/40 shadow-sm` | INV-04: demo CTA is amber, not terracotta |
Sizes: `sm px-3 py-1.5 text-xs` · `md px-4 py-2 text-sm` · `lg px-5 py-3 text-base`.

### 4.6 Demo affordance (INV-04)
- Demo login CTA on `/login`: amber `demo` button inside a `bg-amber-50/60 border-amber-200` panel with sparkles icon; caption keeps "gia phả mẫu Nguyễn Văn An" wording.
- Demo session badge (header, feed): `bg-amber-100 text-amber-800` micro-badge — as today, plus `border-amber-200`.
- Never use terracotta for anything demo-only.

### 4.7 Focus & states
- **Focus-ring completeness rule (INV-06)**: The implemented UI kit enforces visible focus rings (`focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-terracotta`) on **ALL** interactive elements (buttons, links, inputs, combobox triggers, tabs). Static mockups omit focus rings purely for visual brevity — mockups are visual reference, the kit is the contract.
- Global focus: `focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-terracotta` (buttons/links); inputs use `focus:ring-2 focus:ring-terracotta focus:border-transparent` (no offset).
- Tree canvas keeps `focus:ring-offset-1` (denser surface).
- Input: `block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 hover:border-slate-400` + focus above. Error: `border-red-500 focus:ring-red-500` + `text-xs text-red-600` message.
- Disabled: `opacity-60 cursor-not-allowed` (buttons) / `bg-slate-100 text-slate-500` (inputs).
- Empty state (`EmptyState`): warm it — icon disc `bg-terracotta-soft text-terracotta` replacing slate-100/slate-400; keep title `font-display`.

### 4.8 Frosted floating widget (compass idiom — reuse for mobile action bars / FAB)
```html
<div class="bg-white/90 backdrop-blur rounded-full shadow-md border border-slate-200 p-1.5 select-none">
```

### 4.9 Avatar system (unified)
- Sizes: `w-9 h-9` (tree card, picker rows, relation cards) · `w-10 h-10` (post author) · `w-12 h-12` (composer) · `w-14 h-14` (member detail hero) · `w-6 h-6` (mobile nav overflow).
- Photo: `rounded-full object-cover border border-slate-200 bg-slate-100` (M4 URL validation upstream; `@error` → fallback).
- Initials fallback: `rounded-full flex items-center justify-center font-display font-semibold uppercase` tinted by **generation pair** — `style="background-color: var(--gen-N-soft); color: var(--gen-N)"` (fallback terracotta pair).
- **Initials convention split**: Non-tree UI kit components use `web/src/utils/initials.ts` (first + last name word, e.g. "Nguyễn An" → "NA"), while the tree view uses `web/src/tree/card-visual.ts` (last two given-name words, e.g. "Văn An" → "VA"). The tree is a shipped reference design and deliberately keeps its own convention.
- Identity ring: `ring-2 ring-offset-1` — self = `ring-tree-self-ring` (blue), selected = `ring-terracotta` (tree idiom, extended).

### 4.10 Banners / notices
- Success: `bg-emerald-50 border-emerald-200 text-emerald-800` with `M5 13l4 4L19 7` check icon.
- Error: `bg-red-50 border-red-200 text-red-700`.
- Warm hint (login-to-post etc.): `bg-terracotta-soft border-[#F4D0C2] text-terracotta-dark`.
- Radius `rounded-lg` (inline notice) / `rounded-xl` (panel), `p-3`/`p-4`, `text-sm`, icon `w-4 h-4`.

---

## 5. Iconography direction

Inline Heroicons-outline SVGs (24×24 viewBox, `stroke="currentColor"`, `stroke-width=2` for controls / `1.5` for large illustration discs) — **no icon package** (INV: keep deps flat). Centralize as a small `web/src/components/icons/` set of functional components (`<IconPencil class="w-4 h-4"/>`) so paths stop being copy-pasted per-view.

App-wide set (name → where used):

| Icon (Heroicons v2 outline name) | Used in |
|---|---|
| `user-group` | Kinship nav (mobile+desktop), kinship empty state |
| custom tree | Tree nav (existing path already shipped) |
| `newspaper` | Feed nav |
| `user-circle` / `user` | Account nav, member detail, picker rows |
| `pencil-square` | Member edit |
| `trash` | Member delete |
| `magnifying-glass` | People-picker search, empty search |
| `chevron-up/down/left/right` | Selects, compass, collapse |
| `x-mark` | Chip dismiss, dialog close, clear selection |
| `check` | Selected option, verified inline |
| `check-circle` | Auth success, email verified, living status |
| `exclamation-triangle` | Error banners, demo hint |
| `exclamation-circle` | 404 / not-found empty states |
| `arrow-right` / `arrow-left` | Kinship direction, back links |
| `arrows-pointing-out` | Tree zoom hint (tree only) |
| `photo` | Feed image URL adder, image chips |
| `link` | URL field affordance |
| `paper-airplane` | "Đăng bài" submit |
| `sparkles` | Demo affordances (INV-04) |
| `envelope` | Magic-link form, email verify |
| `envelope-open` | Magic-link sent confirmation |
| `shield-check` | Verified-account notice |
| `bell` | Notification toggle |
| `arrow-down-tray` | PWA install prompt |
| `map-pin` / `calendar-days` | Member bio rows (future) |
| `heart` | Feed like affordance (future) |
| `adjustments-horizontal` | Dialect select affordance |

Style rules: stroke inherits `currentColor`; sizing via class (`w-4 h-4` inline, `w-5 h-5` nav, `w-8 h-8` empty-state disc); decorative icons `aria-hidden="true"`, actionable ones get `aria-label`.

---

## 6. Screen-level recipes (summary — mockups are canonical)

1. **Login** `/login` — cream page, centered `max-w-md` card; brand lockup = terracotta `Phả` rounded-lg glyph + Fraunces wordmark + tagline; OAuth outline buttons w/ provider marks; "Hoặc email" divider on card bg; magic-link row (envelope icon input + outline send); "Thử nghiệm" divider; **demo panel in amber** (§4.6). Ghost heritage: oversized `Phả` Fraunces glyph at 5% opacity + gen-pastel dot cluster behind card. Mobile: same card `p-4`, full-width.
2. **Auth interstitials** `/auth/email/verify`, `/auth/oauth/callback` — ONE shared `AuthInterstitial` pattern: same login-card chrome, status disc (spinner terracotta / emerald check-circle / rose exclamation), title + copy, action row (Retry outline + "Về trang đăng nhập" text link). Both routes render the same component with props.
3. **404** — cream page, `exclamation-circle` disc in terracotta-soft; display `404` in Fraunces terracotta with gen-pastel dot cluster; copy; primary "Về cây gia phả" + ghost "Tìm người trong họ" (`/kinship`). Responsive by centering.
4. **Kinship** `/kinship` — keep page header + quick-demo chip; **PeoplePickerCombobox**: AppInput-style trigger with `magnifying-glass`, dropdown rows = avatar (photo w/ initials fallback, §4.9) + name (font-display semibold) + `Đời N` gen micro-badge + gender micro-badge; selected state = compact gen-stripe chip w/ avatar + x-mark clear; swap button between the two pickers on desktop (chevron-left/right, mobile stacked); dialect AppSelect; results: term hero (Fraunces 4xl terracotta, quoted), metadata chips, path timeline where each step shows avatar + name + gen micro-badge (replacing bare numbered dots).
5. **Member detail** `/members/:id` — hero card with `w-14` photo avatar (initials fallback gen-tinted), name + gen chip + living chip + years `font-mono`; actions right; tab underline active `border-terracotta text-terracotta-dark`; relations grid: gen-stripe cards w/ avatar + name + gen label (+ gender micro-badge); posts tab reuses `PostCard` idiom verbatim (author avatar photo fallback, timestamp, content, image grid).
6. **Feed composer** — card `p-4`: row = `w-10` avatar + borderless textarea (`bg-transparent resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40 focus-visible:ring-inset`, placeholder "Chia sẻ câu chuyện với gia đình…", 3 rows); divider; image-URL row = ghost input w/ `link` icon prefix + outline sm "Thêm ảnh"; queued images = chips w/ `photo` icon + truncate + x-mark; footer row = helper text "Bài viết hiển thị cho cả gia đình" (xs slate-400) + primary "Đăng bài" (paper-airplane). Anonymous state = warm hint banner (§4.10).

---

## 7. Implementation notes

- All hex literals in templates (`bg-[#C85A32]` etc.) should migrate to the `@theme` tokens (`bg-terracotta`) — tokens already exist; only `--color-terracotta-border #F4D0C2` is new.
- No new dependencies: picker is a styled combobox built on existing `AppInput` + dropdown markup already in `KinshipView`; icons are inline SVGs.
- `AppButton` gains `demo` variant; `AppChip` variants unchanged; `EmptyState` icon disc warms.
- Order of work: tokens/cleanup → shared AuthInterstitial + 404 → Login → Kinship picker → Member detail → Feed composer.

### 7.1 API-derived constraints
- **Feed constraints**: The feed API has NO visibility selector, NO member tagging, and NO reaction bar. `CreatePostInput` accepts `content` (string) + `images[]` (string array of URLs) only. UI components must not render unbacked controls for visibility/privacy or tags. Feed content budget: MaxContentRunes = 5000 (Go runes, api/internal/feed/service.go); client mirrors via `[...content].length` + native `maxlength`.
- **Kinship path constraints**: Kinship path steps carry member IDs only — the API response does not provide per-step relation labels. The client calculates and renders `"Đời thứ N"` and gender badges for intermediate steps.
- **Member relation constraints**: Member relations returned by the backend are strictly `parents`, `children`, `siblings`, and `spouses`. There is NO grandchildren section and NO branch badge.
- **Avatar constraints**: Avatars are restricted to 8 bundled SVGs under `/static/avatars` (enforced via M4 shared regex validation in backend/frontend) plus initials fallback only. There is no custom photo upload or arbitrary external image URL support for avatars.
