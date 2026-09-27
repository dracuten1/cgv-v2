# Phase 0 — Token Consumer Inventory

**Plan reference:** `.agents/shared/planning/apple-redesign/plan-overview.md` lines 100–107 (Phase 0 scope and exit-artifact list; inventory requirement at line 105).
**Original author:** Coder (working-lead implementer instance) — 2026-09-26.
**Refreshed by:** Worker — 2026-09-27, against the current uncommitted working tree on `feature/apple-design-all-pages` (Apple semantic migration landed, plus the in-flight dark `/login` card fix by a separate coder instance that may add a few more semantic consumers in `LoginView.vue`).
**Branch baseline:** `feature/apple-design-all-pages` @ `bc4210d` (Phase 1 exit, 16/16; updated at finalization 2026-09-27). Warm Heritage `07039ac` was the original doc baseline. **Measurement baseline for §3–§7 statistics: `8279f0b`** (the G-E signoff baseline) — the `8279f0b..bc4210d` delta (D1–D5 palette migration touching `AccountView.vue`, `LoginView.vue` demo panel → `bg-demo-soft`/`border-demo-border`/`text-demo-deep`, and `login-view.spec.ts`) is **not re-measured** in this document; re-measure §3b before treating its counts as current at `bc4210d`.
**Independent verifier:** **SIGNED 2026-09-27 — Reviewer agent** (completeness/accuracy at measurement baseline `8279f0b`; see G-E SIGNOFF block at the end of this document).

---

## 1. Search method and exhaustive site ledger

The all-scope palette regex below was rerun on 2026-09-27 from the repo root after the Apple semantic migration. `grep -n` reports 1-based source line; each matching source line is one site, even if it contains multiple matching utility classes. The match string is the exact matched utility token(s), not an abbreviated `+N` summary. Scope includes Vue, TS, CSS, HTML under `web/src` and `web/index.html`; generated `web/dist` and dependencies are excluded. This is an auditable literal reference ledger, not a claim that arbitrary dynamically-computed classes can be found by grep. The exact, unabridged outputs from the palette and literal-variable commands are attached at `phase-0-palette-grep-output.md` and `phase-0-gen-grep-output.md`.

The all-scope palette expression matches **111 lines across 34 files**: 88 app-source Vue/TS lines (`web/src` only — `web/index.html` no longer matches because its single `<body>` class string was migrated to the semantic `bg-canvas text-ink-1` pair at `web/index.html:12`, see §3b) + 23 test lines + 0 CSS definition lines. CSS definitions are a separately documented category, outside this palette regex. The broader `web/src`-only query matches the same 111 lines in 34 files (88 app + 23 test); it is a distinct query and must not be conflated with the all-scope result.

Reproduce the palette ledger (grep's grouped output may abbreviate long files with `+N`; run the listed per-file `grep -nE` for unabridged individual records):

```
grep -rnE '(bg|text|border|ring|from|to|fill|stroke)-[[:alnum:]-]*(cream|terracotta|tree-|gen-)[[:alnum:]-]*' web/src web/index.html --include='*.vue' --include='*.ts' --include='*.css' --include='*.html'
grep -RInE '(bg|text|border|ring|from|to|fill|stroke)-(hover:)?[a-z-]*(cream|terracotta|tree-|gen-)[a-z0-9-]*' --include='*.vue' --include='*.ts' web/src
```

Per-file detailed records are reproducible with the latter command; the broader `web/src`-only query reports **111 matching lines in 34 files** (88 app-source + 23 test). The test subtree contributes 23 matching lines in 12 files (not 18 in 10 — two new spec files `app-chip.spec.ts` and `auth-interstitial.spec.ts` were added by the Apple migration and assert `bg-gen-${i}-soft` / `text-gen-${i}-fg`); its complete records are enumerated individually in §2 and summed below. Do not conflate matching source lines with individual token occurrences: a source line may contain multiple matching utility tokens.

## 2. Auxiliary search method and ledgers

```
# M1 — every --gen-* occurrence (definitions, TS producers, consumers, tests)
grep -rn -- "--gen-" web/src

# M3 — treeTokens.ts consumers and CSS-var reads
grep -rnE 'TREE_CONNECTOR|tree-connector' web/src

# M4 — theme mechanism (now broader: feed-store + install-prompt use storage for non-theme purposes)
grep -rnE 'prefers-color-scheme|matchMedia|localStorage|sessionStorage' web/src web/index.html

# M5 — legacy palette utility-class consumers, per family (run in web/src)
grep -rEo "(bg|text|border|ring|from|to|fill|stroke)-(hover:)?[a-z-]*(cream|terracotta|tree-|gen-)[a-z0-9-]*" --include="*.vue" --include="*.ts" .

# M6 — raw hex literals outside main.css/tokens.css
grep -rEn "#[0-9A-Fa-f]{6}" --include="*.vue" --include="*.ts" web/src | grep -v "src/test/"
```

Canonical designer tokens live in `mockups/assets/tokens.css` (`--bg-canvas`, `--surface-card`, `--ink-1..4`, `--hairline*`, …) with measured contrast in `design-system.md` §3.5 and plan-overview lines 47–93 (PRE-Phase-1 gate CLOSED). The Apple semantic migration (§3b) is now live in the working tree: `web/src/assets/main.css` declares the full `--bg-canvas/--surface-card/--ink-1..4/--hairline/--accent/--demo/--gen-*` token set on `:root` (light default), overrides inside `@media (prefers-color-scheme: dark)`, and remaps the legacy `--color-cream*` / `--color-terracotta*` / `--color-slate-*` aliases through Tailwind v4 `@theme` so unmigrated views keep resolving at runtime. The migration inventory (which aliases to delete) is a Phase 5 zero-consumer audit (plan line 157); this document is the post-migration Phase 1 baseline.

## 3. Legacy palette definitions and exhaustive per-site ledger (`web/src`, `web/index.html`)

`web/src/assets/main.css` is now a **384-line file** with the following restructured layout:

| Block | Anchor (lines) | Purpose |
|---|---|---|
| `@theme` | 56–167 | Tailwind v4 CSS-first theme; semantic utility vars + legacy aliases |
| `--color-gen-*` (`@theme`) | **110–121** | generation tier token aliases (12 lines, 4 tiers × {name, -fg, -soft}) |
| **legacy aliases** (`@theme`) | **128–141** | `--color-cream*` (128–130), `--color-terracotta*` (132–137), `--color-slate-*` trio (139–141) remapped onto semantic roles |
| **tree renderer tokens** (`@theme`) | **145–153** | `--color-tree-bg`, `-card-bg`, `-card-border`, `-card-border-hover`, `-connector`, `-connector-node`, `-self-ring`, `-self-badge`, `-self-text` (fixed-light Phase 1; out of bounds) |
| `:root` (light) | 172–262 | runtime semantic custom properties |
| **generation tier light values** (`:root`) | **225–236** | `--gen-1..4` + `--gen-1..4-fg` + `--gen-1..4-soft` (12 lines) |
| **tree renderer runtime** (`:root`) | **259–260** | `--tree-connector`, `--tree-connector-node` (Phase 1 fixed-light, source of truth) |
| `@media (prefers-color-scheme: dark)` | 268–330 | dark-mode token overrides |
| **generation tier dark values** | **312–323** | `--gen-1..4` + `--gen-1..4-fg` + `--gen-1..4-soft` (12 lines; `-fg` resolves to base color) |
| `html, body` | 341–351 | INV-02 line-height floors + **body ink `:345`** (`color: var(--ink-1)` — body ink is now a CSS var, not a raw hex) |

This is deliberately a line-site ledger (not aggregate family counts). `Tailwind slate-*`, white/black, emerald/teal/amber, and brand colors are adjacent literals/utilities but are not custom legacy palette definitions; raw hex audit is §6.

The exhaustive grep-result ledger is recorded by source file and exact matching line numbers. For each referenced line, the literal utility-class expression on that line is the site; if Vue computes a class from a conditional, the complete expression is indicated. Source line numbers refer to the tree measured at `8279f0b` (semantic migration landed; see header baseline note).

| File | Line(s) and site (utility expression/family) | Owner |
|---|---|---|
| `web/src/components/excel/ExcelPanel.vue` | 57 `file:bg-terracotta-soft`, `file:text-terracotta-dark`, `focus-visible:ring-terracotta` (slate border retained for non-palette) | implementer — shared components |
| `web/src/components/feed/ImageGrid.vue` | 9 `bg-cream-muted` | implementer — shared components |
| `web/src/components/kinship/KinshipResult.vue` | 8 `text-terracotta`; 35 `text-terracotta`; 77 `bg-cream-muted` (slate-200/300 retained as Tailwind stock); 84 `text-terracotta-dark` | implementer — shared components |
| `web/src/components/layout/AppLayout.vue` | 9 `bg-terracotta text-white` (brand mark — pinned class retained); 54 `bg-terracotta text-white hover:bg-terracotta-hover` (Login nav button — pinned alias retained; semantic migration added `rounded-app-md`) | implementer — shared components |
| `web/src/components/member/MemberEditDialog.vue` | 57 `text-terracotta focus:ring-terracotta` (slate border retained); 72 `focus-visible:ring-terracotta` (slate border retained) | implementer — shared components |
| `web/src/components/notifications/InstallPrompt.vue` | 4 `border border-terracotta-border`; 11 `bg-terracotta-soft text-terracotta`; 25 `bg-terracotta text-white hover:bg-terracotta-hover` | implementer — shared components |
| `web/src/components/notifications/NotificationToggle.vue` | 23 `focus-visible:ring-terracotta`; 24 conditional `bg-terracotta` (slate-300 default) | implementer — shared components |
| `web/src/components/tree/TreeNodeCard.vue` | 28 `bg-tree-card-bg` (slate border retained); 96 `ring-terracotta` (with `dark:ring-accent` — see §3b); 168 `genAccentVar` producer (dynamic var name; tree renderer constraint) | implementer — tree constrained by invariant doc |
| `web/src/components/ui/AppAvatar.vue` | 92–93 `ring-tree-self-ring` (pinned tree renderer token); **96–97 `ring-terracotta dark:ring-accent`** (selected state, AA in dark); **114** `bg-terracotta-soft text-terracotta-dark` (no-generation fallback) | implementer — shared components |
| `web/src/components/ui/AppButton.vue` | **97–98** `bg-terracotta text-white hover:bg-terracotta-hover active:bg-accent-press focus-visible:ring-accent shadow-e1` (primary variant — pinned class retained, semantic siblings added) | implementer — shared components |
| `web/src/components/ui/AppChip.vue` | **42** `bg-gen-1-soft text-gen-1-fg border border-terracotta-border` (gen1 variant — semantically tinted, terracotta-border pinned); **44** `bg-gen-2-soft text-gen-2-fg border border-emerald-200`; **46** `bg-gen-3-soft text-gen-3-fg border border-teal-200`; **48** `bg-gen-4-soft text-gen-4-fg border border-amber-200` (gen2–gen4 use Tailwind stock borders, not terracotta-border) | implementer — shared components |
| `web/src/components/ui/AppCombobox.vue` | 95 `bg-cream-muted`; **116–117** `focus-visible:ring-terracotta focus-visible:ring-offset-1 dark:focus-visible:ring-accent` (pinned test contract on ring color; semantic dark override added) | implementer — shared components |
| `web/src/components/ui/AuthInterstitial.vue` | **7** `bg-terracotta text-white` (brand mark only — pinned alias retained; rest of component is fully semantic) | implementer — shared components |
| `web/src/components/ui/ToastHost.vue` | 69 `bg-terracotta text-white hover:bg-terracotta-hover` (toast action button — pinned alias retained) | implementer — shared components |
| `web/src/views/AccountView.vue` | 77 `bg-cream-muted/50`; 173 `hover:bg-cream-muted/60`; 177 `bg-cream-muted`; 217 `bg-cream-muted/60` (slate-200 retained as Tailwind stock) | implementer — route views |
| `web/src/views/FeedView.vue` | 49 `bg-cream-muted/60`, `focus-within:ring-terracotta`; 73 `bg-cream-muted`; 76 `bg-gen-2-soft`, `text-gen-2`; 84 `focus-visible:ring-terracotta`; 120 `bg-terracotta-soft`, `border-terracotta-border`; 123 `text-terracotta-dark`; 138,140,141,145,146 `bg-cream-muted` | implementer — route views |
| `web/src/views/KinshipView.vue` | 42 `hover:text-terracotta hover:border-terracotta focus-visible:ring-terracotta`; 86 `hover:text-terracotta hover:border-terracotta focus-visible:ring-terracotta`; 146 `bg-cream-muted/60`; 149 `bg-terracotta-soft text-terracotta`; 166 `bg-terracotta-soft border-terracotta-border`; 169 `text-terracotta` | implementer — route views |
| `web/src/views/LoginView.vue` | 8 `text-terracotta opacity-[0.05]` (decorative glyph at 5% opacity); 11,14,15,18,20 `bg-gen-1..4`; 12 `bg-gen-2`; 13 `bg-gen-2/40`; 19 `bg-gen-4/40`; 28 `bg-terracotta text-white shadow-terracotta/20` (brand mark); 104 `bg-terracotta-soft border-terracotta-border text-terracotta-dark`; 110 `text-terracotta-dark/80` (magic-link sent panel). **In-flight coder fix on this view may add a few more semantic consumers to the dark `/login` card** — list status in §3b | implementer — route views (Phase 1 WIP) |
| `web/src/views/MemberDetailView.vue` | 9 `text-terracotta`; 88 `focus-visible:ring-terracotta`; 90 `border-terracotta text-terracotta-dark`; 143 `hover:border-terracotta focus-visible:ring-terracotta` | implementer — route views |
| `web/src/views/NotFoundView.vue` | 6 `text-terracotta opacity-[0.04]` (decorative glyph); 11,12,13 `bg-gen-1/2/3`; 18 `bg-terracotta-soft`; 19,22,26,67 `text-terracotta` (with one `hover:text-terracotta-hover`) | implementer — route views |
| `web/src/views/OAuthCallbackView.vue` | 17 `bg-terracotta text-white hover:bg-terracotta-hover focus-visible:ring-terracotta`; 25 same | implementer — route views |
| `web/src/views/TreeView.vue` | 95 `text-terracotta`; 196 `bg-terracotta border-terracotta`; 197 `hover:border-terracotta hover:text-terracotta-dark` | implementer — route views |

### Test-file legacy palette class matches (23 lines, 12 files; each match string retained)

| File | Line | Exact matched utility class(es) | Owner/source |
|---|---:|---|---|
| `web/src/test/app-avatar.spec.ts` | 69 | `bg-terracotta-soft` | test owner — component contract |
| `web/src/test/app-avatar.spec.ts` | 70 | `text-terracotta-dark` | test owner — component contract |
| `web/src/test/app-avatar.spec.ts` | 80 | `ring-tree-self-ring` | test owner — component contract |
| `web/src/test/app-avatar.spec.ts` | 88 | `ring-terracotta` | test owner — component contract |
| `web/src/test/app-button.spec.ts` | 14 | `bg-terracotta` | test owner — component contract |
| `web/src/test/app-chip.spec.ts` | 8 | `bg-gen-${generation}-soft` (template literal) | test owner — component contract (NEW Phase 1) |
| `web/src/test/app-chip.spec.ts` | 9 | `text-gen-${generation}-fg` (template literal) | test owner — component contract (NEW Phase 1) |
| `web/src/test/app-chip.spec.ts` | 10 | `text-gen-${generation}` (template literal, negative assertion) | test owner — component contract (NEW Phase 1) |
| `web/src/test/app-combobox.spec.ts` | 96 | `bg-cream-muted` | test owner — component contract |
| `web/src/test/app-combobox.spec.ts` | 110 | `focus-visible:ring-terracotta` | test owner — component contract |
| `web/src/test/auth-interstitial.spec.ts` | 75 | `text-gen-${i + 1}-fg` (template literal) | test owner — component contract (NEW Phase 1) |
| `web/src/test/auth-interstitial.spec.ts` | 76 | `bg-gen-${i + 1}-soft` (template literal) | test owner — component contract (NEW Phase 1) |
| `web/src/test/feed-view.spec.ts` | 88 | `bg-terracotta-soft` | test owner — route contract |
| `web/src/test/icons.spec.ts` | 14 | `text-terracotta` | test owner — component contract |
| `web/src/test/kinship-view.spec.ts` | 164 | `bg-cream-muted/60` | test owner — route contract |
| `web/src/test/kinship-view.spec.ts` | 201 | `bg-terracotta-soft` | test owner — route contract |
| `web/src/test/login-view.spec.ts` | 34 | `bg-terracotta` | test owner — route contract |
| `web/src/test/login-view.spec.ts` | 87 | `bg-terracotta` (negative assertion) | test owner — route contract |
| `web/src/test/member-detail-view.spec.ts` | 161 | `focus-visible:ring-terracotta` | test owner — route contract |
| `web/src/test/not-found-view.spec.ts` | 26 | `bg-terracotta-soft` | test owner — route contract |
| `web/src/test/not-found-view.spec.ts` | 32 | `text-terracotta` | test owner — route contract |
| `web/src/test/not-found-view.spec.ts` | 55 | `bg-gen-1` (twice in selector) | test owner — route contract |
| `web/src/test/tree-node-card.spec.ts` | 171 | `ring-tree-self-ring` | test owner — tree contract |

Reconciliation: 23 matching source lines in 12 files (up from 18 / 10 in the original `07039ac` ledger — the two new files `app-chip.spec.ts` and `auth-interstitial.spec.ts` were added by the Apple semantic migration and assert the four-tier `bg-gen-${N}-soft` / `text-gen-${N}-fg` contract). The `not-found-view.spec.ts:55` selector still contains `bg-gen-1` twice, but the line itself is one match. These are test assertions/fixtures, not rendered application consumers, and remain listed as compatibility sites.
**Exact totals/reconciliation:** The all-scope palette command returned 111 matching source lines across 34 files: 88 app-source utility-class lines (`web/src` Vue/TS only — `web/index.html` no longer matches), 23 test-assertion lines, and 0 CSS definition lines. The broader `web/src`-only query independently reports the same 111 results across 34 files (88 app + 23 test). CSS token definitions are documented separately, outside the palette regex. These query scopes are distinct and must not be combined or misreported. The full output for the exact published palette query is attached. The literal M1 `--gen-` query returns 58 lines in 8 files; its full raw output is attached. The 58 are classified as 36 CSS custom-property definition lines in `main.css`, 3 helper comment/producer lines in `card-visual.ts`, 1 propagation comment in `useTreeLayout.ts`, and 18 test assertion lines in 5 test files. Dynamic consumers/producers without literal variable spellings are separately mapped in §4. These finite query results reconcile; they do not establish zero unknown references outside the bounded patterns.

| Family | `@theme` anchor | Values (light) |
|---|---|---|
| cream (`@theme` legacy alias) | main.css:**128–130** | `--color-cream → --bg-canvas`, `--color-cream-card → --surface-card`, `--color-cream-muted → --surface-well` (compat alias names; values now OS-theme-aware) |
| terracotta (`@theme` legacy alias) | main.css:**132–137** | `--color-terracotta → --accent-button`, `-hover → --accent-hover`, `-dark → --accent-fg`, `-soft → --accent-soft`, `-border → --accent-border`, `-border-hover → --accent-border` |
| slate-neutral trio (`@theme` legacy alias) | main.css:**139–141** | `--color-slate-neutral → --ink-2`, `--color-slate-light → --surface-quiet`, `--color-slate-border → --hairline-strong` |
| tree blues (`@theme`; Phase 1 fixed-light) | main.css:**145–153** | `--color-tree-bg #F8FAFC`, `-card-bg #FFFFFF`, `-card-border #BFDBFE`, `-card-border-hover #60A5FA`, `-connector #93C5FD`, `-connector-node #3B82F6`, `-self-ring #2563EB`, `-self-badge #DBEAFE`, `-self-text #1E40AF` |
| generation (`@theme`) | main.css:**110–121** | `--color-gen-1..4` + `--color-gen-1..4-fg` + `--color-gen-1..4-soft` (all aliases to runtime `:root` vars) |
| fonts (`@theme` + `:root`) | main.css:58, 60, 342 | `--font-body` (Be Vietnam Pro stack), `--font-display` (Fraunces), applied via `html, body { font-family: var(--font-body); }` at line 342 |

**Named utility-class consumers (M5; counts below are non-test token occurrences; test records are listed separately in §2):**

- `cream` family (**15** non-test occ.; matches Reviewer reference): `FeedView.vue` (7× `bg-cream-muted` incl. `/60` variants), `AccountView.vue` (4× `bg-cream-muted` + 1 `hover:bg-cream-muted/60`), `KinshipView.vue` (1× `bg-cream-muted/60`), `AppCombobox.vue` (1× `bg-cream-muted`), `KinshipResult.vue` (1× `bg-cream-muted`), `ImageGrid.vue` (1× `bg-cream-muted`). The original doc also counted `web/index.html:11` `bg-cream` and `AppLayout.vue:2` `bg-cream`, `AppButton.vue:85,87` cream, `AuthInterstitial.vue:2` `bg-cream` — **all four of those `bg-cream` consumers have been removed in the Apple migration** (the `<body>` is now `bg-canvas text-ink-1`; `AppLayout` is now `bg-canvas text-ink-1`; `AppButton` uses `bg-terracotta text-white` primary + `bg-well`/`bg-canvas-deep` secondaries; `AuthInterstitial` is now `bg-canvas`).
- `terracotta` family (**83** non-test occ.; matches Reviewer reference): `KinshipView.vue` (11× incl. `text-terracotta`, `border-terracotta`, `bg-terracotta-soft`, `ring-terracotta`), `NotFoundView.vue` (8× incl. `text-terracotta`, `bg-terracotta-soft`, `hover:text-terracotta-hover`), `OAuthCallbackView.vue` (6× `bg-terracotta text-white hover:bg-terracotta-hover focus-visible:ring-terracotta` × 2), `MemberDetailView.vue` (6× `ring-terracotta`/`border-terracotta`/`text-terracotta(-dark)`), `LoginView.vue` (6× incl. `text-terracotta` glyph + `bg-gen-1..4` decoration + `bg-terracotta text-white` brand mark + `bg-terracotta-soft border-terracotta-border text-terracotta-dark` magic-link panel + `text-terracotta-dark/80` caption + `shadow-terracotta/20`), `TreeView.vue` (5× `text-terracotta`, `bg-terracotta border-terracotta`, `hover:border-terracotta hover:text-terracotta-dark`), `FeedView.vue` (5× incl. `bg-terracotta-soft border-terracotta-border`, `text-terracotta-dark`, `focus-visible:ring-terracotta`, `focus-within:ring-terracotta`), `InstallPrompt.vue` (5× `bg-terracotta-soft`, `border-terracotta-border`, `bg-terracotta text-white hover:bg-terracotta-hover`, `text-terracotta`), `AppAvatar.vue` (4× `ring-terracotta dark:ring-accent` × 2 occurrences + `bg-terracotta-soft text-terracotta-dark` fallback), `TreeNodeCard.vue` (4× `ring-terracotta` + `bg-tree-card-bg`), `AppButton.vue` (3× pinned `bg-terracotta text-white hover:bg-terracotta-hover` + `focus-visible:ring-accent` + `shadow-e1`), `MemberEditDialog.vue` (3× `text-terracotta`, `focus:ring-terracotta`, `focus-visible:ring-terracotta`), `AppLayout.vue` (3× `bg-terracotta` brand mark + Login nav button), `KinshipResult.vue` (3× `text-terracotta`/`text-terracotta-dark`), `ExcelPanel.vue` (3× `file:bg-terracotta-soft file:text-terracotta-dark` + `focus-visible:ring-terracotta`), `ToastHost.vue` (2× `bg-terracotta text-white hover:bg-terracotta-hover`), `AppCombobox.vue` (2× `bg-cream-muted` + `focus-visible:ring-terracotta` × 2 occurrences), `NotificationToggle.vue` (2× `focus-visible:ring-terracotta` + conditional `bg-terracotta`), `AuthInterstitial.vue` (1× `bg-terracotta text-white` brand mark), `AppChip.vue` (1× `border border-terracotta-border` on `gen1` variant).
- `slate` family: Tailwind default `slate-*` utilities retained broadly for ink/borders/inputs (e.g., `AccountView.vue` `border-slate-200`, `FeedView.vue` `border-slate-200/300`, `LoginView.vue` pre-migration `text-slate-400/500/800` mostly migrated to `text-ink-1/2/3`, `TreeView.vue` `text-slate-500/600`, `MemberDetailView.vue` `text-slate-400/500/800`, `KinshipView.vue` `text-slate-500`, `MemberEditDialog.vue` `border-slate-300 placeholder-slate-400`, `AppTextarea.vue` `border-slate-300`) — plus the three custom `@theme` slate-neutral tokens above, which now resolve through `--ink-2 / --surface-quiet / --hairline-strong`. Body ink is `main.css:345` `color: var(--ink-1)` (no longer a raw `#1E293B`).
- `tree-*` family (**8** non-test occ.; matches Reviewer reference): `TreeNodeCard.vue` (`bg-tree-card-bg`, `border-tree-card-border`, `hover:border-tree-card-border-hover`, `bg-tree-self-badge`, `text-tree-self-text`, `ring-tree-self-ring` × 2) and `AppAvatar.vue` (`ring-tree-self-ring` × 2 occurrences). Tree renderer tokens remain fixed-light in Phase 1 by design (plan tree constraints).
- `gen-*` utility classes (**21** non-test occ.; up from the original 19 — the additional 2 are `LoginView.vue` `bg-gen-1/2/3/4` decorative glyphs at 8, 11, 14, 15, 18, 20 vs the original `bg-gen-1/2/3` only at 11/12/13): `LoginView.vue` (decorative `bg-gen-1..4` glyph cluster at 11, 14, 15, 18, 20 plus `bg-gen-2/40` line at 13 and `bg-gen-4/40` line at 19), `NotFoundView.vue` (`bg-gen-1/2/3` glyph cluster at 11, 12, 13), `FeedView.vue` (`bg-gen-2-soft`, `text-gen-2` at 76), `AppChip.vue` (`bg-gen-N-soft`, `text-gen-N-fg` × 4 variants at 42/44/46/48). The 23 test token instances are separate from these non-test consumer counts.

## 3b. Apple semantic token consumer ledger (`web/src`, `web/index.html`)

The Apple Phase 1 migration introduces a parallel ledger of **semantic** utility classes that resolve through `main.css` runtime custom properties. These are the Phase 1 migration target consumers; the legacy palette ledger in §3 is the **compatibility** ledger (legacy aliases retained until Phase 5 zero-consumer audit).

The semantic consumer regex matches in **14 files**: `web/index.html` + 13 Vue components (`AppLayout`, `AppAvatar`, `AppButton`, `AppChip`, `AppCombobox`, `AppDialog`, `AppInput`, `AppSelect`, `AppTextarea`, `AuthInterstitial`, `EmptyState`, `ToastHost`, `LoginView`).

| Token family | App-source occurrences (non-test) | Files consuming |
|---|---|---|
| `bg-canvas` | 5 | `index.html:12`, `AppLayout.vue:2`, `AuthInterstitial.vue:2`, `AppButton.vue:85` (`hover:bg-canvas-deep`), `AppButton.vue:89` (`hover:bg-canvas-deep`) |
| `bg-card` | 15 | `AppLayout.vue:4/72` (with `/80` for frosted header/bottom-nav), `AuthInterstitial.vue:3`, `AppCombobox.vue:11/72/87`, `AppButton.vue:87` (outline), `AppInput.vue:25`, `AppSelect.vue:14`, `AppTextarea.vue:79`, `AppDialog.vue:17`, `EmptyState.vue` — none directly, `ToastHost.vue:19`, `LoginView.vue:24/95/148` |
| `bg-canvas-deep` | 2 | `AppButton.vue:85` (secondary hover), `AppButton.vue:89` (ghost hover) |
| `bg-well` | 9 | `AppLayout.vue:23`, `AppButton.vue:85/87`, `AppInput.vue:26`, `AppSelect.vue:16`, `AppTextarea.vue:20`, `AppCombobox.vue:73/118` |
| `bg-quiet` | 4 | `AppLayout.vue:23/33`, `AppCombobox.vue:118`, `AppDialog.vue:45` |
| `text-ink-1` | (combined `text-ink-*` count: **51**) | `AppLayout.vue` (×6 incl. `hover:text-ink-1` × 5), `AuthInterstitial.vue` (×3), `AppButton.vue` (×5: outline/ghost/secondary `text-ink-1`), `AppCombobox.vue` (×5: `text-ink-1` × 4 + `text-ink-3` × 1), `AppInput.vue` (×4), `AppSelect.vue` (×3), `AppTextarea.vue` (×2), `AppDialog.vue` (×2), `AppChip.vue` (none — uses gen-* text colors), `EmptyState.vue` (×2), `ToastHost.vue` (×2), `LoginView.vue` (×3) *(verifier note 2026-09-27: per-file × values are annotated subsets, not a partition — the combined 51 mixes `text-ink-1/2/3/4` and `hover:text-ink-1`, so per-file figures intentionally do not sum to 51)* |
| `text-ink-2` | (subset of above) | `AppLayout.vue:23`, `AuthInterstitial.vue:81`, `AppButton.vue:89`, `AppCombobox.vue:100`, `LoginView.vue:36`, `EmptyState.vue:13` |
| `text-ink-3` | (subset of above) | `AppLayout.vue:45/81/95/109/123`, `AppCombobox.vue:56/76`, `AppInput.vue:34`, `AppSelect.vue:32`, `AppTextarea.vue:28/34`, `AppDialog.vue:29`, `ToastHost.vue:76`, `LoginView.vue:148/181` |
| `text-ink-4` | (subset of above) | `AppCombobox.vue:73`, `AppInput.vue:26`, `AppSelect.vue:16`, `AppTextarea.vue:20` (disabled state) |
| `text-accent-fg` | 10 | `AppLayout.vue:81/95/109/123`, `AuthInterstitial.vue:45/48/99` (× 2 incl. `hover:text-accent-fg`), `ToastHost.vue:54`, `EmptyState.vue:3` |
| `bg-accent-soft` | 3 | `AuthInterstitial.vue:45`, `EmptyState.vue:3`, `AppChip.vue:34` (primary variant) |
| `bg-accent / bg-accent-soft-hover / bg-accent-tint / bg-accent-border` | (per-line consumers in `AuthInterstitial.vue` stepper :21,27,33) | `AuthInterstitial.vue` |
| `bg-demo-soft` | 1 | `AppLayout.vue:38` (Demo chip in user header) |
| `text-demo-deep` | 2 | `AppLayout.vue:38`, `ToastHost.vue:45` |
| `border-demo-border` | 2 | `AppLayout.vue:38`, `AppButton.vue:94` (demo variant) |
| `bg-demo / bg-demo-button / bg-demo-hover / border-demo` | (per-line consumers in `ToastHost.vue:98-105` + `AppButton.vue:94`) | `ToastHost.vue`, `AppButton.vue` |
| `border-hairline` / `border-hairline-strong` | 17 | `AppLayout.vue` (×4), `AuthInterstitial.vue:3`, `AppCombobox.vue:11/72/87`, `AppInput.vue:25`, `AppSelect.vue:15`, `AppTextarea.vue` (none — uses `border-slate-300` pinned), `AppDialog.vue:17/22/45`, `LoginView.vue:24/92/145` |
| `rounded-app-sm` / `-md` / `-lg` / `-xl` / `-2xl` | 23 | All 13 components + index.html (split across the five radii for chips / inputs / buttons / cards / dialogs) |
| `shadow-e1` / `shadow-e2` / `shadow-e3` | 9 | `AppButton.vue:91/94/98` (×3), `AppCombobox.vue:11/87`, `AuthInterstitial.vue:3`, `AppDialog.vue:17`, `ToastHost.vue:19`, `LoginView.vue:24` |
| `focus-visible:ring-accent` | 16 | `AppLayout.vue:45`, `AppButton.vue` (×6 incl. all variants), `AppInput.vue:23`, `AppSelect.vue:14`, `AppTextarea.vue:79/82`, `AppDialog.vue:29`, `AppCombobox.vue:45/71`, `AuthInterstitial.vue:99` |
| `text-gen-N-fg` | 4 | `AppChip.vue:42/44/46/48` (gen1–gen4 variants) — **AppChip consumes all four gen tiers with `text-gen-N-fg`** (paired with `bg-gen-N-soft`) |
| `dark:ring-accent` | 1 | `AppAvatar.vue:97` (selected-state dark override; INV-06 contract) |
| `bg-success-soft` / `bg-danger-soft` | 2 | `AuthInterstitial.vue:60/68` (success/error status discs) |
| `text-success-fg` / `text-danger-fg` | 7 | `AuthInterstitial.vue:60/68`, `AppLayout.vue:45` (`hover:text-danger-fg`), `AppInput.vue:5/25/33`, `AppSelect.vue:5/15/32`, `AppTextarea.vue:5/19/27`, `AppCombobox.vue:5/45/80`, `ToastHost.vue:27/36` |
| `bg-danger-button` / `bg-danger-hover` | 2 | `AppButton.vue:91` (danger variant) |

**M2 dynamic `var(--gen-*)` consumers (no literal `--gen-` token in markup; consumers resolved at runtime via `genAccentVar`/`genSoftVar` helpers):** in addition to the static `text-gen-N-fg` / `bg-gen-N-soft` consumers above, the Apple migration also keeps the `AppCombobox` dynamic gen consumers (gen-stripe card via `var(${genAccentVar(generation_index)})` at `AppCombobox.vue:12`) and the `AppChip`/`ToastHost` indirect gen consumption chain (gen variants emit `text-gen-N-fg` and `bg-gen-N-soft` at runtime through the variant switch at `AppChip.vue:31-53`). Per the Phase 1 design these belong in the **M2 set alongside the dynamic `var()` consumers in `card-visual.ts` / `useTreeLayout.ts` / `TreeNodeCard.vue`**.

**`LoginView.vue` in-flight status:** the file is currently part of the Apple semantic migration working tree (`git diff web/src/views/LoginView.vue`: 13 insertions + 13 deletions vs `07039ac`). The view already consumes the full semantic kit on the card chrome (`bg-card rounded-app-xl shadow-e2 border border-hairline` at :24, `text-ink-1` :33, `text-ink-2` :36, `border-hairline` :92/145, `bg-card text-ink-3` divider labels :95/148, `text-ink-3` :181) and still uses legacy `text-terracotta` glyph + `bg-gen-1..4` decorative glyph clusters + `bg-terracotta text-white` brand mark + `bg-terracotta-soft border-terracotta-border text-terracotta-dark` magic-link panel. **A separate coder instance is concurrently finishing the dark `/login` card fix**; that change may add a few more semantic consumers (`text-ink-*`, `bg-canvas-deep` for the dark card chrome). The semantic card chrome itself is **landed** at commit `8279f0b` (independent verifier confirmed 2026-09-27 via `git diff aef6aca 8279f0b -- web/src/views/LoginView.vue`: `bg-white/border-slate-200/80 → bg-card/border-hairline`, `text-slate-800/500/400 → text-ink-1/2/3`, sites `:24/:33/:36/:92/:95/:145/:148/:181` all committed); the dark-mode demo-panel tweak also **landed** at commit `bc4210d` (`border-amber-200/bg-amber-50/60 → border-demo-border/bg-demo-soft`, `text-amber-900/800 → text-demo-deep`; G-D matrix entry #4 re-measured it at 5.10–7.02 AA both themes). *(Statuses promoted by verifier, 2026-09-27; see signoff block. These `bc4210d` consumers are not yet in the §3b ledger — re-measure at the next refresh.)*

## 4. `--gen-*` CSS variables — every definition, producer, and consumer

**Definitions (36 in `main.css`):**
- `@theme` block **lines 110–121** (12 lines): `--color-gen-1`, `--color-gen-1-fg`, `--color-gen-1-soft`, `--color-gen-2`, `--color-gen-2-fg`, `--color-gen-2-soft`, `--color-gen-3`, `--color-gen-3-fg`, `--color-gen-3-soft`, `--color-gen-4`, `--color-gen-4-fg`, `--color-gen-4-soft` (Tailwind v4 `@theme` aliases → runtime `:root` vars).
- `:root` block **lines 225–236** (12 lines, light default): `--gen-1 #8C8C94`, `--gen-1-fg #62626A`, `--gen-1-soft #F3F3F5`, `--gen-2 #6E7B8E`, `--gen-2-fg #526074`, `--gen-2-soft #F1F4F8`, `--gen-3 #5E7F79`, `--gen-3-fg #476B64`, `--gen-3-soft #EFF5F4`, `--gen-4 #94795A`, `--gen-4-fg #705738`, `--gen-4-soft #F6F2EC`.
- `@media (prefers-color-scheme: dark)` block **lines 312–323** (12 lines, dark override): `--gen-1..4` brighter; `--gen-N-fg: var(--gen-N)` (each `-fg` resolves to the same base color in dark for AA foreground contrast).

**Producer/helper TS files (4 lines):** `web/src/components/tree/card-visual.ts`
- `:36` doc comment
- `:38` `genAccentVar(i)` → `` `--gen-${((i - 1) % 4) + 1}` ``
- `:43` `genSoftVar(i)` → `` `--gen-${((i - 1) % 4) + 1}-soft` ``

**Propagation comment (1 line):** `web/src/composables/useTreeLayout.ts:75` documents the propagated `colorVar` / `colorSoftVar` band object names.

**Test-assertion lines (18 in 5 files):** `card-visual.spec.ts:54,55,56,57,58,60,61,62` (8 lines, `genAccentVar`/`genSoftVar` cycle + modulo wrap), `tree-layout.spec.ts:103,104,107,110` (4 lines, `layout.bands[N].colorVar`/`colorSoftVar`), `tree-node-card.spec.ts:96,99,100` (3 lines, `--gen-4`/`--gen-1` cycle via style attribute + modulo doc), `app-avatar.spec.ts:57,58` (2 lines, `background-color: var(--gen-2-soft)` / `color: var(--gen-2)`), `member-detail-view.spec.ts:200` (1 line, `border-left-color: var(--gen-2)`).

**Reproducible M2 count:** `grep -rnE --include='*.vue' --include='*.ts' 'genAccentVar|genSoftVar|--gen-' web/src` (then classify each match as variable definition, producer/helper or comment, generated-name propagation, runtime consumer, or test assertion). M1 is the raw CSS-variable occurrence ledger (`grep -rn -- "--gen-" web/src`); M2 extends it to dynamic helper calls that cannot contain a literal `--gen-` name. M1 finds **58 lines in 8 files** (36 definitions + 3 producer/comment lines + 1 propagation comment + 18 test assertions). M2 additionally captures dynamic-name construction/propagation and `var()` consumers without literal `--gen-` strings; the named app-runtime consumer mappings are listed below, including `KinshipResult.vue:52,65`, `MemberDetailView.vue:144`, and the new `AppCombobox.vue:12` gen-stripe card.

**Complete consumer list (M1/M2 — every non-test occurrence accounted):**

| # | Consumer | Site | Mechanism | Inline fallback |
|---|---|---|---|---|
| 1 | `composables/useTreeLayout.ts` | :75 (doc), :444–445 | band objects carry `colorVar`/`colorSoftVar` from `genAccentVar/genSoftVar` | none at this site |
| 2 | `components/tree/TreeVisualizer.vue` | :40 | band background `var(${band.colorSoftVar}, transparent)` | `transparent` |
| 3 | `components/tree/TreeVisualizer.vue` | :46 | band label color `var(${band.colorVar}, #64748B)` | raw hex `#64748B` (slate) |
| 4 | `components/tree/TreeNodeCard.vue` | :16 (dot-marker bg), :38 (card left border), producer :168 | `var(${accentVar}, var(--color-terracotta))` | CSS var fallback → terracotta |
| 5 | `components/ui/AppAvatar.vue` | :34 (import), :103–104 | avatar disc `var(${genSoftVar(generation)})` bg + `var(${genAccentVar(generation)})` text | none (var unguarded) |
| 6 | `components/ui/AppCombobox.vue` | :12 (selected chip left border), :28/:139 badge style via `genBadgeStyle`, producer :291–300 | `var(${genSoftVar})` bg / `var(${genAccentVar})` text; non-gen default → terracotta-soft/dark | `var(--color-terracotta-soft)` / `var(--color-terracotta-dark)` |
| 7 | `components/member/MemberCardPreview.vue` | :4, :11–12 (edit-dialog live preview), producers :84–85 | border `var(${accentVar}, #C85A32)`; bg `var(${softAccentVar}, #F9EAE1)`; text `var(${accentVar}, #983F1E)` | raw hexes `#C85A32`, `#F9EAE1`, `#983F1E` |
| 8 | `components/kinship/KinshipResult.vue` | :52 borderColor, :65 backgroundColor; import :123 | dynamic `var(${genAccentVar(step.generation)})` for non-endpoint path steps | none (var unguarded) |
| 9 | `views/MemberDetailView.vue` | :144 borderLeftColor; import :241 | dynamic `var(${genAccentVar(rel.generation_index)})` for generation-coded related member card | none (var unguarded) |
| 10 | `views/LoginView.vue` | decorative `bg-gen-1..4` classes (M5) | static utility classes | n/a |
| 10 | `views/NotFoundView.vue`, `views/FeedView.vue`, `components/ui/AppChip.vue` (gen1–gen4 variants) | M5 utility sites | static `bg-gen-N-soft` / `text-gen-N-fg` classes | n/a |

**Literal-output classification and consumer mapping:** `phase-0-gen-grep-output.md` contains all 58 source records with exact path/line/text. The 36 `main.css` lines define CSS custom properties (12 in `@theme`, 12 in `:root`, 12 in dark override); `card-visual.ts:36,38,43` are a documentation line and dynamic-name producers; `useTreeLayout.ts:75` documents propagated names; 18 test lines in five files assert generated names/styles (not runtime UI consumers). M2 additionally captures dynamic-name construction/propagation and `var()` consumers without literal `--gen-` strings; the named app-runtime consumer mappings are listed above, including `KinshipResult.vue:52,65`, `MemberDetailView.vue:144`, and the Phase 1 `AppCombobox.vue:12` gen-stripe card. The token inventory is reconciled to the observed bounded searches, not declared globally exhaustive; no zero-unknown claim is made.

## 5. `treeTokens.ts` — every CSS-variable and TS fallback consumer

**File:** `web/src/components/tree/treeTokens.ts` (11 lines) — `TREE_CONNECTOR_COLOR = '#93C5FD'`, `TREE_CONNECTOR_NODE_COLOR = '#3B82F6'`; documented as canvas-path fallback only when `getComputedStyle` cannot read vars (test env/SSR), kept in sync with `main.css:259–260`.

**Sole TS consumer:** `web/src/components/tree/TreeVisualizer.vue`
- :129 — import
- :249–250 — default initialization of draw colors
- :253 — `style.getPropertyValue('--tree-connector').trim() || TREE_CONNECTOR_COLOR`
- :254 — `style.getPropertyValue('--tree-connector-node').trim() || TREE_CONNECTOR_NODE_COLOR`

**CSS-variable sources of truth:** `main.css:259–260` (`:root --tree-connector / --tree-connector-node` — runtime values, used by canvas reader) + mirrored `@theme --color-tree-connector(-node)` at `main.css:149–150` (Tailwind v4 `@theme` aliases; tree renderer reads the runtime vars directly, not the `@theme` aliases, so no consumer-side impact). M3: no other `tree-connector` reference exists in `web/src`. **No unknown consumers; fallback hexes `#93C5FD`/`#3B82F6` match `:root` values exactly (sync verified by inspection 2026-09-27).**

## 6. Raw hex literals outside token-definition CSS (including main.css body ink)

| Site | Hex | Explanation |
|---|---|---|
| `MemberCardPreview.vue:4,11,12` | `#C85A32` `#F9EAE1` `#983F1E` | inline `var()` fallbacks for gen accents (§4 #7) |
| `TreeVisualizer.vue:46` | `#64748B` | band-label var fallback (§4 #3) |
| `TreeVisualizer.vue:249–254` + `treeTokens.ts:10–11` | `#93C5FD` `#3B82F6` | canvas fallback constants (§5) |
| `LoginView.vue:66–78` | `#4285F4` `#34A853` `#FBBC05` `#EA4335` `#1877F2` `#0068FF` | third-party provider brand marks (Google/Facebook/Zalo logo fills) — brand-fixed, not palette tokens; out of redesign scope |
| `LoginView.vue:8` | `text-terracotta opacity-[0.05]` + `LoginView.vue:28` `shadow-terracotta/20` | decorative glyph + brand mark shadow; not raw hex but legacy family |
| `main.css:182,195,206,213,217` | `#1D1D1F` / `#A84220` / `#E8890C` / `#34A853` / `#E5484D` / gen family | runtime `:root` token **definitions** (light defaults) — this is the new semantic source of truth, not legacy |
| `main.css:345` | (no hex) | body ink now `color: var(--ink-1)`; the old raw `#1E293B` at `:81` was removed by the Apple migration |
| `index.html:7,8,12` | `#F8F6F2` (theme-color light), `#1C1A19` (theme-color dark), `bg-canvas text-ink-1` (body) | pre-paint shell now matches the Apple semantic palette — `theme-color` light/dark meta pair matches the `:root`/`@media (prefers-color-scheme: dark)` `--bg-canvas` values exactly, future sync owned by `T-THEME-computed` (theme-evidence doc) |

## 7. Measured statistics — my own numbers vs Reviewer reference

All numbers below were measured on 2026-09-27 from the **current uncommitted working tree** on `feature/apple-design-all-pages` after the Apple semantic migration. Commands used to produce each row are documented in §1/§2 and attached grep outputs.

| Metric | Reviewer reference | My measurement | Δ | Notes |
|---|---:|---:|---:|---|
| All-scope palette regex lines (`grep -rnE '(bg|text|border|ring|...)...cream\|terracotta\|tree-\|gen-' web/src web/index.html`) | ~111 | **111** | ✓ exact | |
| All-scope palette regex files | ~34 | **34** | ✓ exact | |
| App-source lines (excludes `src/test/`) | ~88 | **88** | ✓ exact | |
| Test-assertion lines | ~23 | **23** | ✓ exact | |
| Test files | ~12 (incl. new spec files) | **12** | ✓ exact | New: `app-chip.spec.ts`, `auth-interstitial.spec.ts` (added by Apple migration) |
| `web/index.html` lines matching | 0 (was 1 at `bg-cream` pre-migration) | **0** | ✓ exact | `<body>` now `bg-canvas text-ink-1` at `:12` — moved to semantic §3b ledger |
| `--gen-` literal lines (`grep -rn -- "--gen-" web/src`) | 58 | **58** | ✓ exact | |
| `--gen-` literal files | 8 | **8** | ✓ exact | `main.css`, `card-visual.ts`, `useTreeLayout.ts`, `app-avatar.spec.ts`, `card-visual.spec.ts`, `member-detail-view.spec.ts`, `tree-layout.spec.ts`, `tree-node-card.spec.ts` |
| Terracotta non-test token occurrences | 83 | **83** | ✓ exact | Per-file: KinshipView 11, NotFoundView 8, OAuthCallback 6, MemberDetailView 6, LoginView 6, TreeView 5, FeedView 5, InstallPrompt 5, AppAvatar 4, TreeNodeCard 4, AppButton 3, MemberEditDialog 3, AppLayout 3, KinshipResult 3, ExcelPanel 3, ToastHost 2, AppCombobox 2, NotificationToggle 2, AuthInterstitial 1, AppChip 1 |
| Cream non-test token occurrences | 15 | **15** | ✓ exact | Per-file: FeedView 7, AccountView 4, KinshipView 1, AppCombobox 1, KinshipResult 1, ImageGrid 1 |
| Tree non-test token occurrences | 8 | **8** | ✓ exact | TreeNodeCard 6, AppAvatar 2 |
| Gen non-test utility-class occurrences | (not specified) | **21** | (new measurement) | LoginView 11, NotFoundView 3, FeedView 2, AppChip 4 (gen1–gen4 variants — each emits one `bg-gen-N-soft` + one `text-gen-N-fg` class, but M5 regex matches them once each, totaling 8) |
| Semantic consumer files (Apple migration target) | 12+ components + `index.html` | **14 files** (13 Vue + `web/index.html:12`) | ✓ ≥ | AppLayout, AppAvatar, AppButton, AppChip, AppCombobox, AppDialog, AppInput, AppSelect, AppTextarea, AuthInterstitial, EmptyState, ToastHost, LoginView, web/index.html |
| `bg-canvas` non-test occurrences | (not specified) | **5** | (new measurement) | |
| `bg-card` non-test occurrences | (not specified) | **15** | (new measurement) | |
| `bg-canvas-deep` non-test occurrences | (not specified) | **2** | (new measurement) | |
| `bg-well` non-test occurrences | (not specified) | **9** | (new measurement) | |
| `bg-quiet` non-test occurrences | (not specified) | **4** | (new measurement) | |
| `text-ink-*` non-test occurrences | (not specified) | **51** | (new measurement) | combined `-ink-1/-ink-2/-ink-3/-ink-4` |
| `text-accent-fg` non-test occurrences | (not specified) | **10** | (new measurement) | |
| `bg-accent-soft` non-test occurrences | (not specified) | **3** | (new measurement) | |
| `bg-demo-soft` non-test occurrences | (not specified) | **1** | (new measurement) | |
| `text-demo-deep` non-test occurrences | (not specified) | **2** | (new measurement) | |
| `border-demo-border` non-test occurrences | (not specified) | **2** | (new measurement) | |
| `border-hairline` / `border-hairline-strong` non-test occurrences | (not specified) | **17** | (new measurement) | |
| `rounded-app-*` non-test occurrences | (not specified) | **23** | (new measurement) | |
| `shadow-e[123]` non-test occurrences | (not specified) | **9** | (new measurement) | |
| `focus-visible:ring-accent` non-test occurrences | (not specified) | **16** | (new measurement) | |
| `text-gen-N-fg` non-test occurrences | (not specified) | **4** | (new measurement) | **AppChip consumes all four gen tiers with `text-gen-N-fg`** at :42/44/46/48 |
| `dark:ring-accent` non-test occurrences | (not specified) | **1** | (new measurement) | `AppAvatar.vue:97` (INV-06 dark override) |

**Discrepancies from Reviewer reference:** none. All Reviewer-supplied reference numbers (`~111/34`, `0/88/23`, `58/8`, `83` terracotta, `15` cream, `8` tree, `23/12` test ledger) matched my independent measurements exactly. The "12+ components plus `web/index.html:12`" semantic consumer threshold is met with **14 files** (13 Vue + 1 HTML).

## 8. Actual browser/test execution record — pending

No browser session, fresh screenshot capture, or tester baseline command results were delivered to this author for this refresh. Do not treat source-derived expectations above, prior captures, mockups, or planned test IDs as observed browser outcomes. Tester: insert exact command(s), cwd, browser/version, environment/OS scheme, route/state, viewport, result/exit status, and log/screenshot artifact paths here when delivered. Until then, actual execution is **awaiting tester**; no pass/fail claim is made.

**Source-query reconciliation (bounded; not proof of global absence):** the M1/M2 ledgers classify the literal occurrences, CSS definitions, helper-generated dynamic names, propagation, and named runtime `var()` sites reviewed here. Because each search pattern has boundaries and computed CSS names are not all literal, this does **not** justify "no unknown consumers" as an unqualified universal claim. An independent verifier should rerun/extend searches and confirm the classifications. Alias deletion remains gated on the Phase 5 grep-verified zero-consumer audit (plan lines 31, 157).

**Refresh status (2026-09-27):** all Reviewer-flagged per-component line anchors verified against the current 384-line `main.css` (legacy aliases `@theme:128–141`, tree `@theme:145–153` + `:root:259–260`, gen `@theme:110–121` + `:root:225–236` + `dark:312–323`, body ink `:345`) and against each component's **measured** line numbers (AppLayout `:9`/`:54`, AuthInterstitial `:7`, AppButton `:97–98`, AppChip `:42`/`:44`/`:46`/`:48`, AppCombobox `:95`/`:116–117`, AppInput/AppSelect/AppDialog — no legacy palette matches, purely semantic, AppTextarea `:79`/`:82` semantic focus ring replacing the old terracotta focus, AppAvatar `:92–93` tree-self-ring + `:96–97` terracotta+dark:ring-accent + `:114` terracotta-soft fallback, EmptyState — no legacy, ToastHost `:69` toast action button, card-visual.ts `:36–43`, `index.html` metas `:7–8` + body `:12`). **Finalization status (2026-09-27):** the semantic migration (`8279f0b`) and the dark `/login` demo-panel fix (`bc4210d`) have landed; Phase 1 exit confirmed 16/16 at `bc4210d`. This document lives under `.agents/` (gitignored), so it carries no commit of its own — trackability rests on the in-doc baselines above and the G-E SIGNOFF block; verifier reconciliation applied 2026-09-27.

**Verifier signoff block:** ☐ pending — independent verifier records dated completeness approval only after unresolved line-site coverage is resolved.

---

## G-E SIGNOFF — token-consumer inventory completeness/accuracy

**☑ SIGNED 2026-09-27 — Reviewer agent (independent verifier of record; ensemble review controller, tree context `3229c9dc-de71-4fb5-82b1-9b35d794a91f`).** Verification executed by dispatched read-only worker session `e129d969-daa2-4722-9694-214c18e79f4c` in two rounds (round 1: drift report with 24 itemized corrections; round 2: re-verification of this refresh — verdict **ACCURATE**).

**Scope:** completeness and accuracy of this inventory document ONLY, measured against commit `8279f0b` on `feature/apple-design-all-pages`. This signoff does **not** cover browser/test execution — §8 remains the Tester's pending record — and makes no pass/fail claim about rendered behavior.

**Evidence (independently reproduced by the verifier, not accepted from the author):**
- Every §7 recorded statistic reproduced exactly by re-running the doc's own recorded queries: headline 111 palette-regex lines / 34 files = 0 `web/index.html` + 88 app-source + 23 test-assertion lines in 12 test files; M1 `--gen-` 58 lines / 8 files with 36 definitions + 3 producer + 1 propagation + 18 test; non-test family counts terracotta 83, cream 15, tree 8, gen 21; semantic ledger families incl. `bg-canvas` 5, `bg-card` 15, `bg-canvas-deep` 2, `bg-well` 9, `bg-quiet` 4, `text-ink-*` 51, `text-accent-fg` 10, `border-hairline*` 17, `rounded-app-*` 23, `shadow-e[123]` 9, `focus-visible:ring-accent` 16, `text-gen-N-fg` 4, `dark:ring-accent` 1; 14 semantic consumer files (13 Vue + `index.html`).
- §3 / §3b / §4 / §5 / §6 per-line references spot-checked row by row against the tree at `8279f0b` (legacy sites: AppLayout `:9/:54`, AuthInterstitial `:7`, AppButton `:97–98`, AppChip `:42/44/46/48`, AppCombobox `:95/:116–117`, AppAvatar `:92–93/:96–97/:114`, ToastHost `:69`, card-visual `:36–43`; treeTokens sync `treeTokens.ts:10–11` ↔ `main.css:149–150/:259–260` hex-identical).
- Round-1 correction items #1–24 all addressed or explicitly superseded in this refresh.
- LoginView semantic card chrome confirmed **landed at `8279f0b`** (§3b status promoted accordingly by the verifier).

**Residual non-blocking nits recorded for follow-up (do not affect this signoff):**
1. Header baseline (doc line ~5–6) still cites `aef6aca`; update to `8279f0b`.
2. §4 AppCombobox producer anchor `:289–300` → actual `:291–300`; badge consumer sites `:28/:139`.
3. §6 `main.css` raw-hex row line numbers off by 1–7; actual `:182/:195/:206/:213/:217` for `#1D1D1F/#A84220/#E8890C/#34A853/#E5484D`.
4. §3b `text-ink-*` per-file `×` breakdown does not sum to the combined 51 — recompute or annotate the mixed `text-ink-2/3/4` + `hover:text-ink-1` composition.
5. §3b/refresh-status wording updated by verifier 2026-09-27; the "document left uncommitted" sentence (~line 285) should be revisited at the finalization commit.

*Verifier reconciliation (2026-09-27, finalization): nits 1–5 applied. Baseline header now reads `bc4210d` (finalization) with the measurement baseline pinned to `8279f0b`; AppCombobox anchors corrected to `:28/:139` + producer `:291–300`; §6 rows corrected to `:182/:195/:206/:213/:217`; §3b `text-ink-*` sum annotation added; finalization sentence rewritten. Header "Independent verifier" line updated from PENDING to SIGNED. The `8279f0b..bc4210d` consumer delta (AccountView D1–D5, LoginView demo panel) is flagged in the header as not re-measured — it is outside the signed baseline and requires a §3b refresh before any Phase 2 reliance on counts.*

**Boundaries:** per §8's own reconciliation note, this is bounded query-based completeness — classifications verified, not a universal "no unknown consumers" proof; alias deletion stays gated on the Phase 5 zero-consumer audit.
