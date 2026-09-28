# Phase 4 Independent Verification — feature/apple-design-all-pages

Date: 2026-09-27/28 · Verifier: tester (independent) · Workers: 13a0aa9e, 1910ad50, a07bf4e4, b0c00694, 285823e1, c00a60af, 87d2bbd4†, 146f85ed, 791a3df0, dfbd5ed5, 550d419d, f3c62430, 5e294ca1, 63ba14b4, 381fe6fd, 3c3ef64a, 6db8074f, 861a4f62, 01b8d5eb, 2231f84e († terminated, stalled)

## VERDICT: PASS WITH FINDINGS — Phase 4 exit recommended CONDITIONAL on 3 small chrome fixes (waivable)

## Scope note (topology correction)
Requested premise: "5 commits 8e85580/e849fe0/8ffbc96/eb2c282/436df1f on base e73b2e6 (base includes api fix); tip 436df1f."
Actual: `e73b2e6 → 436df1f → 8ffbc96 → eb2c282 → 8e85580 → e849fe0 → 80ed842(tip)` — all 5 Phase-4 commits present, api fix 80ed842 stacked ON TOP (not in base). Verified range = e73b2e6..80ed842. adapters.go delta is 100% attributable to 80ed842 (empty diff e73b2e6..e849fe0 on api/), which is live-verified separately (probe: member-detail 200 ×3). All runs in this report executed at 80ed842(+test-only commits 6e5a196/4f9a10a/ea7a537/2b50ee6/7326c45 — e2e specs only). Zero production edits.

## (A) Tree chrome restyle — VERIFIED (chrome-only change confirmed)
- **Diff-guard 4/4 ZERO-byte**: useTree*.ts (4 composables), TreeNodeCard.vue, card-visual(.ts+.spec), treeTokens.ts. MAX_VISIBLE_NODES=300 intact (useTreeLayout.ts:37).
- **Hunks presentational-only**: TreeCompassControl (5 hunks: class swaps bg-card/90, rounded-2xl, ring-accent focus-visible; clicks/aria/testids identical) and TreeVisualizer (2 hunks: zoom buttons class-only). Pointerdown guard `closest('button')` early-return UNTOUCHED (0-diff useTreeViewport.ts:104). main.css +35 lines pure CSS.
- **?family preselect + first-family fallback**: source ✓ (TreeView.vue:241–250, validated against loaded families, fallback families[0]) + browser VERIFIED (requested family → picker/select/payload family_id match; default → families[0]; bogus query → fallback, no crash).
- **Demo notice**: `tree-demo-notice` (role=status, Vietnamese, auth.isDemo) — browser PASS both themes, AA.
- **State matrix (auth'd, 2 themes × 1440/390/320)**:
  - loading: light ×3 FULL PASS (min contrast 6.666, focus 5/5, 0 console, 0 overflow); dark ×3 fail ONLY on dark-compass finding below.
  - error: retry state machine PROVEN (3 cells full recover; 3 cells blocked by SPEC-side staged-family residual — not product). `tree-retry` focus-visible FAILS (product finding).
  - empty: state+contrast+overflow+focus ✓ ×6 (spec residual: expected anon auth-hint in auth'd cells — spec bug).
  - canvas/success: world hidden + cards-as-dots — **PRE-EXISTING** (see D).
  - Console bucketing: 0 errors all auth'd cells; anon /me 401 = project-whitelisted noise (feed-pack precedent).
  - Overflow: zero violations anywhere measured. Focus-visible: all pass except tree-retry.

## (B) M1 breadcrumb + journey — VERIFIED with 1 product defect
- @1440: breadcrumb '← Gia phả' visible, href /tree; desktop CTA 'Xem trên cây' href /tree?family=<fid>; mobile twin hidden. PASS.
- Contrast (real dist, both themes): breadcrumb 6.666/9.176, desktop CTA 16.83/13.927, mobile CTA 16.83/13.927 — all ≫4.5. PASS.
- Click-through journey: PASS — CTA → /tree?family=<fid> → picker value + family-name + payload family_id ✓ → breadcrumb → plain /tree → first-family fallback ✓.
- **PRODUCT DEFECT (M1)**: at 390px desktop `member-view-tree` REMAINS VISIBLE (class list carries `hidden md:…` but AppButton base `inline-flex` wins the cascade) → duplicate CTAs below 768px. Mobile twin's `md:hidden` works. Pack terminal: FAIL 4/5 (this defect only).

## (C) PD-P3-2 combobox useId — VERIFIED FIXED
Source (AppCombobox.vue:160–203 useId, label-for + aria-controls) + unit (new uniqueness spec in 313-test vitest) + live DOM (kinship pack: distinct `app-combobox-v-0`/`-v-1`, stable across swap/clear, zero behavioral delta). 10/10 kinship pack PASS.

## (D) Renderer-owned measurement — NOT CAPTURED (blocked by pre-existing defect)
Live :3456 endpoints all 200 (member-detail ×3, tree 102 nodes, health, avatars; api container freshly recreated with fix). BUT rendered tree shows **0 cards in DOM** (world 0×0, transform scale 0.337, specks only) — anon AND demo-auth'd, zero console errors. **Base A/B (e73b2e6 worktree, MIME-correct serve, same demo user): byte-identical world metrics, cardCount 0 both** → PRE-EXISTING renderer-owned defect (likely zero-size measurement/culling feedback loop), D13-excluded from this phase, NOT a Phase-4 regression. Card-text contrast measurement impossible until renderer owner fixes card population; designer ruling deferred. Evidence: /tmp/cgp-p4-{base2,tip}-tree.png|.json.

## (E) jsdom canvas specs — PRE-EXISTING ENVIRONMENT LIMITATION
Tip: 313/313 pass (21s); canvas specs pass with non-fatal `getContext` stderr noise. Base (isolated worktree): 45/45 pass, SAME noise ×15 same frame. Dependency files identical. No regression from Phase-4 range.

## (F) Full regression — ALL GREEN
| Pack | Result |
|---|---|
| web_vitest_p0 | PASS 313/313 (+1 = new PD-P3-2 test) |
| web_build_p0 | PASS (vue-tsc clean, 191 modules, INV-01 ✓, dist fresh) |
| apple_phase1_shell | PASS 16/16 |
| apple_phase2_login | PASS 5/5 |
| apple_phase2_email | PASS 5/5 |
| apple_phase2_oauth | PASS 6/6 |
| apple_phase3_memberdetail | PASS w/ residual — 10/11; matrix rows = NON-PRODUCT staging quirk (my real-dist counter-evidence: 'Xem trên cây' 13.9–16.8 vs spec-staged ~1.0; focus rows identical to prior adjudicated exit). Note: spec still records LIVE_ENDPOINT_KNOWN_DEFECT 500 while live probe shows 200 ×3 — residual question for api-debug thread (non-gating). |
| apple_phase3_kinship | PASS 10/10 (PD-P3-2 fixed) |
| apple_phase3_feed | PASS 10/10 |
| apple_phase3_misc | PASS 8/8 (Zalo 4.7467/6.4508 exact) |

## Product findings (Phase-4 chrome surface — exit conditions)
1. 🟠 **M1 duplicate CTA <768px** — desktop 'Xem trên cây' visible at 390 alongside mobile twin (MemberDetailView/AppButton class cascade). Small CSS fix.
2. 🟠 **tree-retry missing focus-visible ring** (error state, all themes).
3. 🟠 **Dark-theme compass AA violation** — `[data-testid="tree-compass"] button "Di chuyển lên"` 1.702 vs ≥4.5 (light 7.394 same element), dark loading cells ×3. Verify compass token pairing in dark.
4. 🟢 PRE-EXISTING (out of scope, D13/renderer-owned): rendered tree success state populates no cards (world 0×0) — escalate to renderer owner separately.
5. 🟢 memberdetail spec staging-quirk residual rows — recommend spec-side fix later (non-blocking).

## Harness incidents (all resolved; packs hardened)
Worker static servers: missing PATH export → "no free port"; bash-4 `${PREFIX,,}` under macOS bash 3.2; **dropped Content-Type/MIME map → blank pages (definitive root cause for 2 TIMEOUT/blank runs)** — all fixed, `/bin/bash -n` + `node --check` validated, MIME verified via network trace. Spec maturation: demo-auth contexts (CTAs auth-gated), loading staging (tree-route only), error unroute-both, journey fallback via member-detail. 2 stalled/errored workers (LLM backend outage) — 1 revived, 1 replaced; one revive budget exhausted → replacement spawned.

## Test-only commits
6e5a196, 4f9a10a, ea7a537, 2b50ee6, 7326c45 (e2e/specs/apple-phase4-*-verify.spec.cjs only). Packs stay gitignored under .agents/.

## Phase 4 exit recommendation
**CONDITIONAL PASS.** The restyle is verified chrome-only (diff-guard + hunk classification + invariants + regression suite green); preselect/demo/journey/PD-P3-2 all verified. Exit clean after fixing findings 1–3 (all ≤ few lines, exactly Phase-4 surface) + re-running apple_phase4_m1_journey (expect 5/5) and apple_phase4_tree_chrome (expect matrix green) — or waive with eyes open. Finding 4 routes to the renderer owner, not this phase.
