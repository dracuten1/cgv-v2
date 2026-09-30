# Rollback Rehearsal — Completed Release-Gate Record

> Executed per `phase5-plan.md` §One pinned rollback mechanism (option b). Every field below records
> an actually executed step on a disposable detached-HEAD worktree; nothing is inferred or fabricated.
> Rehearsal was performed at candidate parent `8140985` with the C4 changeset replicated on the
> detached rehearsal HEAD (identical staged changeset — see C4 identity note below).

## Rehearsal identity
- Candidate SHA (redesign candidate being rehearsed): **Phase 5 integration commit carrying this document — resolve with `git rev-parse HEAD` (parent = `8140985158ca4d449aa8679bc77baaeef7f8f3d3`); rehearsed as detached-HEAD replica `996c3b54da88313020e2e9fde89f353fab851956` built from the identical staged C4 changeset (see C4 identity note)**
- Retained baseline SHA: **`a1226ff12067dbba0aeb3fb072d549a876e67cb5`** (`a1226ff`)
- Retained baseline path (old renderer): **old SVG/DOM renderer in `web/src/components/tree/TreeVisualizer.vue` at `a1226ff` (baseline tree `17f060e98f96c2a65965ba9d937690f339fcd153`); `TreeCompassControl.vue`/`TreeNodeCard.vue`/`card-visual.ts`/`treeTokens.ts` are the only `web/src/components/tree/` files at baseline**
- Executor (who ran rehearsal): **dev-coder-phase5** (Coder working-lead instance)
- Timestamp (when rehearsal was run): **2026-09-30T22:18:59Z (UTC)**
- Reviewer (who signed off): **Independent Release Reviewer (Frontend Lead + Accessibility Reviewer) — sign-off pending at release gate**
- Overall pass/fail verdict: **PASS** — all four reverse reverts applied with 0 conflicts; resulting tree byte-identical to baseline; baseline smoke green; disposable environment discarded without shared-state mutation.

### C4 identity note
The rehearsal ran before the release commit existed on the shared branch, so the exact C4 changeset
(staged files: `web/src/test/tree-phase5-matrix.spec.ts`, `web/src/components/tree/TreeMinimap.vue`,
`.agents/tester/PACKS.md`, this document) was replicated on the detached rehearsal HEAD via
`git apply --index /tmp/c4-staged.patch && git commit` → `996c3b5` (tree `e7630cc`). Revert
applicability depends on the parent tree + changeset, not on commit metadata, so the revert outcome
is identical for the released C4 commit. Reviewer equivalence check after release-commit creation:
`git diff <C4-sim>:web <C4-release>:web` → empty (web tree identical); doc-only delta expected in
`.agents/` (this file's filled content).

## Per-step revert log
Performed in disposable worktree `/tmp/cgp-rollback-rehearsal` (`git worktree add /tmp/cgp-rollback-rehearsal HEAD`,
detached at `8140985158ca4d449aa8679bc77baaeef7f8f3d3`), in reverse dependency order. Each `--no-commit`
revert was followed by `git commit --no-edit`. Conflict outcome checked via `git status` (0 `UU`/`AA`/`DD` entries at every step).

### C4 — integration/tests/docs
- Commit label: C4 — integration/tests/docs
- SHA: **`996c3b54da88313020e2e9fde89f353fab851956`** (detached rehearsal replica of the released C4; released commit = `git rev-parse HEAD` on `feature/tree-view-redesign`)
- Revert command: **`git revert --no-commit 996c3b5` → `git commit --no-edit`** (revert commit `f50e868`)
- Conflict outcome: **0 conflicts** (exit 0; no unmerged paths)
- Result: **PASS — `git diff --name-only 8140985 HEAD` → 0 files; HEAD tree `ce57899834dd658867bab506ebf22c0cb2e8a806` == `8140985^{tree}`**

### C3 — focus/reveal/roster
- Commit label: C3 — focus/reveal/roster
- SHA: **`8140985158ca4d449aa8679bc77baaeef7f8f3d3`**
- Revert command: **`git revert --no-commit 8140985` → `git commit --no-edit`** (revert commit `d7d1001`)
- Conflict outcome: **0 conflicts**
- Result: **PASS — `git diff --name-only 30fddd4 HEAD` → 0 files (tree back to pre-C3 tip `30fddd4`)**

### C2 — navigation chrome
- Commit label: C2 — navigation chrome
- SHA: **range `5276fed..30fddd4` — 23 commits `d9fa343` (feat: generation rail, minimap, orientation w/ per-family persistence) → `30fddd4` (Phase 3 chrome + browser packs + fetch-race fixes)**
- Revert command: **`git revert --no-commit 5276fed..30fddd4` → `git commit --no-edit`** (batch revert commit `5829e53`; git applies the range newest-first = exact reverse dependency order)
- Conflict outcome: **0 conflicts**
- Result: **PASS — `git diff --name-only 5276fed HEAD` → 0 files (tree back to pre-C2 tip `5276fed`)**

### C1 — layout/frame+LOD+Canvas
- Commit label: C1 — layout/frame+LOD+Canvas
- SHA: **range `a1226ff..5276fed` — 10 commits `8e34f07` (P1 baseline TV-* fixtures) / `17956c5` (P2 anchor-frame geometry, LOD ladder, 300 budget, DPR cap) → `5276fed` (Phase 2 tests/fixes)**
- Revert command: **`git revert --no-commit a1226ff..5276fed` → `git commit --no-edit`** (batch revert commit `860f630`)
- Conflict outcome: **0 conflicts**
- Result: **PASS — after C1 revert the retained baseline path is restored (see resulting-tree check)**

## Resulting-tree check
- Check/command and resulting tree SHA: **`git diff a1226ff HEAD` → 0 lines; `git rev-parse HEAD^{tree}` = `17f060e98f96c2a65965ba9d937690f339fcd153` == `git rev-parse a1226ff^{tree}`** (byte-identical trees)
- Confirms old renderer behavior restored: **YES — `web/src/components/tree/` contains exactly the baseline file set (`TreeVisualizer.vue` old SVG/DOM renderer, `TreeNodeCard.vue`, `TreeCompassControl.vue`, `card-visual.ts`, `treeTokens.ts`); no rail/minimap/roster/chip/orientation components remain**
- Confirms no redesign code dependency remains: **YES — `grep -rEl "TreeGenerationRail|TreeMinimap|useTreeOrientation|TreeSiblingRoster|TreeRevealChip|anchorFrameTransform" web/src` → 0 matches**

## Baseline smoke check
- Baseline smoke command: **`npm --prefix web test` (= `vitest run`) executed inside `/tmp/cgp-rollback-rehearsal` (`web/node_modules` symlinked read-only from the shared checkout)**
- Result (exit/output/evidence): **exit 0 — `Test Files 39 passed (39)`, `Tests 313 passed (313)`, 19.74s — matches the baseline record "313/313 green at a1226ff" (phase1-clause-test-map.md); old renderer suite fully green on the reverted tree**

## Disposable environment and safety
- Temporary worktree/branch is disposable and will be discarded after rehearsal: **YES — `/tmp/cgp-rollback-rehearsal`, detached HEAD only (no branch created)**
- Confirm discarded without mutating shared checkout, shared history, or user data: **CONFIRMED — shared branch HEAD remained `8140985158ca4d449aa8679bc77baaeef7f8f3d3` throughout and after the rehearsal; all reverts and replica commits lived only in the detached worktree; no push, no branch mutation, no backend/database touched**
- Disposal evidence/command: **`git worktree remove /tmp/cgp-rollback-rehearsal --force` → `git worktree prune` → `git worktree list` shows only the main checkout at `8140985 [feature/tree-view-redesign]`; `/tmp/cgp-rollback-rehearsal` no longer exists**

**Release gate rule:** satisfied — all fields filled from executed steps, 0 conflicts across C4→C3→C2→C1, resulting tree byte-identical to `a1226ff`, baseline smoke 313/313, disposable environment discarded. Release decision remains with the owner per `phase5-plan.md` §Integration and rollout step 4.
