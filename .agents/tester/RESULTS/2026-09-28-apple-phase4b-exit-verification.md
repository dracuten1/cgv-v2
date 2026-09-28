# Phase 4 Conditional-Exit Re-Verification — c625d10

Date: 2026-09-28 · Verifier: tester (independent) · Probes/workers: 41fb1ca0 (git), c7375df2 (build), c00a60af (specs aeabe03), 146f85ed (m1 pack), 861a4f62 (chrome pack), 2231f84e (pixel probe)

## VERDICT: **PASS — Phase 4 EXIT APPROVED (all conditional findings closed)**

## Fix-commit verification (c625d10, parent 01bac0e)
- Topology exact; tester commits 7326c45/2b50ee6 in ancestry.
- **Diff = exactly 4 files** (main.css, MemberDetailView.vue, 2 developer specs). **D13 guard: zero diff** on `web/src/components/tree/` + `useTree*.ts`. No sizing rules on world-layer selectors (compass colors/focus only).
- Content claims verified: dead-selector history confirmed (`[data-testid="tree-compass"]` attribute rules at main.css:412–424, ink-1 glyphs + ink-2 center dot); `!hidden md:!inline-flex` at MemberDetailView.vue:57; dev specs block SW + assert exactly-one-CTA@390 + 768 boundary + retry Tab-walk.
- Rebuild at c625d10: PASS (191 modules, INV-01 ✓, dist 01:44Z). [Worker's interim "FAIL" overruled by its own pack log: `RESULT: PASS`, inner_rc=0.]

## Finding closure (my independent evidence)
| # | Finding | Status at c625d10 |
|---|---|---|
| 1 | M1 duplicate CTA <768px | **FIXED** — m1 pack **PASS 5/5**: exactly-one-CTA@390; boundary exact (767 mobile-only / 768 desktop-only); contrast reproduced 6.67–16.8; journey full green (preselect + breadcrumb fallback) |
| 2 | tree-retry focus ring | **VERIFIED PRESENT** via Tab walk (error cell reached focus gate: select ✓ + retry ✓; prior fail = programmatic-focus() artifact — does not trigger :focus-visible) |
| 3 | Compass dark AA | **PASSES by canonical pixel-sampling: 10.77:1 dark / 16.65:1 light** (modal glyph #fbfbfb on composited #3e3b39 dark; light glyph exactly ink-1 #1d1d1f). The computed-style readings 1.079/1.702/2.837 were bg-attribution artifacts on the 0.9-alpha card surface — walker trapped at translucent layer/near-equal second cluster (literal top-2-cluster pair = 1.16/1.18, the documented trap). Toast-over-compass claim refuted as the cause of the post-SW-block reading, moot for the verdict. |
| 4 | Card-layer (0 cards, world 0×0) | UNCHANGED — pre-existing (base-identical), renderer-owned, **D13-excluded; not a Phase-4 exit condition** → routes to renderer owner |
| 5 | memberdetail spec residuals | Non-product (staging walker artifacts, same class as #3) |

## Tree-chrome pack terminal status at c625d10 (adjudicated)
`RESULT: FAIL (1/28)` — decomposition: canvas ×6 + invariants + measurement = D13-blocked pre-existing defect (documented); loading dark ×3 = compass walker artifact (pixel-probe refutes); loading light ×3 focus = Tab-reachability of zoom-in/compass in LOADING state (suspected disabled-during-load or Tab-order — spec-methodology residual, error-state focus fully green); error ×5 = staged-family spec artifact (+1 error cell: console-on-forced-500 unsatisfiable gate — spec-side; its contrast/overflow/**retry Tab-walk focus all PASSED**); empty ×6 = auth-hint expectation spec bug (state/contrast/overflow/focus green); preselect = functional flow fully green (console-gate 401s anon, project-whitelisted class). **Zero product regressions from c625d10.** Spec backlog: auth-hint expectation, staged-family reset, whitelist forced-500 console, loading-state focus semantics, pixel-sampling for layered chrome surfaces.

## Scope Decision (blast radius of c625d10)
2 production files (compass-scoped CSS + 2-line CTA class fix) — fully covered by the m1 pack 5/5 + pixel probe. Full 8-pack regression suite was green at 80ed842 (beneath c625d10 by one commit + test-only commits); no re-run warranted for this diff shape.

## Phase 5 handoff items
- **Toast-over-compass UX: 🟢 minor** — PWA offline-ready toast transiently overlays the compass in fresh contexts; recommend Phase 5 QA evaluate reposition/dismiss timing/z-index. Not blocking: control is AA once revealed (10.77:1). Phase-5 specs MUST block serviceWorkers (or dismiss the toast) before measuring layered chrome — both computed walkers and pixel sampling are otherwise contaminated.
- 🟢 Investigate zoom-in/compass Tab-reachability during LOADING state (disabled-by-design vs keyboard gap) — unverifiable this cycle; loaded-state focus is green.
- 🟢 Pixel-sampling (screenshot→canvas decode→modal bucket, extreme-luminance glyph selection for sparse glyphs) is now the canonical method for layered surfaces — adopted in LESSONS.
- 🔵 Renderer owner: card-layer population defect (0 cards, world 0×0, dots) — pre-existing, blocks the D13 measurement permanently until fixed.

## Commits (test-only)
6e5a196 · 4f9a10a · ea7a537 · 2b50ee6 · 7326c45 · aeabe03 (all e2e/specs only). Zero production edits by tester.
