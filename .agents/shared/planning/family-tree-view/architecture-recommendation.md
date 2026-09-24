# Architecture Recommendation — family-tree-view (`/tree` redesign)

> **Date**: 2026-09-24T15:06Z · **Prepared by**: Architect (controller) — competitive fan-out, 7 analyst workers
> **Instances**: canvas `a0967e65`, svg `23db0ab1`, library `1295cd4f`, layout `2d59d8f3`, backend `2ac5d651`, avatar `f2937305`, risk-scan `d78dfd9c`
> **Inputs**: `plan-overview.md`, `decisions.md`, `phase1-4-plan.md`, live source at branch `feature/family-tree-view`
> **Status**: COMPLETE — all 7 fan-in nodes done. ⚠️ DEGRADED: skill bank partial miss (see §Gaps).

**Axis legend (all matrices)**: Complexity / Risk / Cost — *lower is better*. Scalability / Maintainability — *higher is better*.

---

## Executive Verdicts

| # | Focus area | Verdict |
|---|---|---|
| 1 | **Decision 4C — connector rendering** | ✅ **CONFIRM Canvas** + pure `useTreeConnectors` seam. SVG overlay = credible, *documented* fallback (not default). Third-party libraries: ❌ REJECT. One spec defect MUST-FIX (Y-rail collision). |
| 2 | **Layout engine** | ⚡ **CONDITIONAL APPROVAL** — direction right (client-side normalizer, composable seam), but 4 concrete defects: rail-inside-card geometry, in-law double-placement, filter×connector crash mode, shared-state mutation risk. Adopt intermediate `FamilyUnit` graph model. |
| 3 | **Backend delta** | ✅ **CONFIRM endpoints; do NOT flip to client-side kinship.** 6 MUST-FIX items, incl. a **pre-existing** kinship cache-staleness defect the new endpoint would amplify. |
| 4 | **Avatar strategy** | ✅ **CONFIRM Decision 1C** (static `web/public/static/avatars/`) for this milestone. 3 hardening MUST-FIXes (backend URL validation, error-flag reset, seed filename sync). |
| 5 | **Phase dependency & risk** | ✅ **Phasing sound** with minor re-sequencing. R-04 UNDERSTATED, R-03 OVERSTATED; register 5 missing risks; unify the `s.1942` vs `s. 1942` contract **now**. |

---

## 1. Decision 4C — Connector Rendering: Canvas vs SVG vs Library

### Approach comparison

| Approach | Complexity | Scalability | Maintainability | Risk | Cost | Recommendation |
|---|---|---|---|---|---|---|
| **A: Canvas + composable seam** (plan 4C default) | **Low** — geometry isolated in pure composable; canvas strokes plain segments | **High** — edges = 1 DOM node; pan/zoom is GPU-composited CSS transform (no per-frame redraw); ~900–1200 primitive calls ≈ 0.08–0.25 ms desktop / <0.8 ms mobile per redraw | **Med** — no Tailwind classes on canvas (manual token sync); no DOM inspection for edge debug | **Low-Med** — iOS/Safari canvas texture cliff on wide worlds × DPR 3 (12,000 px world ≈ 162 MB backing store) — mitigable (M11) | **Low** — reuses existing canvas + gesture engine | ✅ **RECOMMENDED** — plan default confirmed by all three analyses |
| **B: SVG overlay** (plan 4B) | **Med** — culling/straddling-edge logic reintroduces the complexity SVG was meant to avoid | **Med** — compound paths ≈ 95 nodes @100 members / 140 @150; fine for browsers, but counts against mobile perf headroom | **High** — declarative; `stroke="var(--color-tree-connector)"` native; theme/dark-mode free | **Low** — sharp at all zooms; no texture-memory blowout | **Low-Med** — renderer swap only (seam exists) | 🔄 **FALLBACK** — activate only if the canvas texture cliff or interactive-connector needs emerge |
| **C: Third-party library** (d3-shape / leader-line / jsPlumb / dagre / ELK / vue-flow) | **High** — dual coordinate-system sync against `useTreeViewport`'s custom pinch engine | **Low-Med** — DOM/SVG libs add 150–250 nodes on 100-member trees | **Low** — upgrade churn, lifecycle glue, hacks for gia-phả T-bus junctions | **High** — gesture/DOM-budget violations; leader-line injects SVG into `<body>` w/ rAF jitter | **High** — 35 KB–1.2 MB bundle for what <200 LOC of pure TS does | ❌ **REJECT** — only wins for cyclic general graphs with obstacle-avoidance routing (not our case) |

### Evidence highlights
- Pan/zoom never redraws canvas per frame: `TreeVisualizer.vue:24-27` transforms the world layer via `translate3d+scale` with `will-change`; `drawEdges()` fires only on `watch(layout)`, mount, and (wastefully) `watch(culled)` (`:205-214`). Both canvas and SVG worlds share this identical GPU path.
- **The plan's 4B rejection rationale is factually shaky but its conclusion survives**: the `<300` budget actually caps visible **cards** (`MAX_VISIBLE_NODES = 300`, `useTreeLayout.ts:23`); each card is 7–9 DOM elements. Compound SVG paths would add only ~95 nodes @100 members — browsers handle that. Canvas still wins on: 0 edge DOM nodes, zero culling logic for edges, and phase isolation.
- Nothing in the spec needs pointer events on connectors (midpoint dots/rails are passive visuals) → canvas hit-testing cost is moot; SVG's free per-node events are unused value.
- Colors today are hardcoded hex (`TreeVisualizer.vue:173,182`); plan's `:root --tree-connector` variables work if read once per layout pass and cached (avoid `getComputedStyle` in any loop).

### Verdict
**Canvas with the pure `useTreeConnectors` seam — confirmed.** The seam is the real architectural asset: `OrthogonalEdge[]` as data makes the SVG fallback a presentation-component swap. Record the SVG fallback recipe (compound `<path>` per edge type ≈ 2 SVG nodes total, `pointer-events-none`, same world-transform container) in `decisions.md` so R-01 is actionable.

---

## 2. Layout Engine Architecture

**Verdict: CONDITIONAL APPROVAL.** The composable split (`useTreeLayout` / `useTreeConnectors` / `useTreeViewport` + new normalizer) is the right seam — with an upgrade: introduce an **intermediate normalized graph model** (`FamilyUnit { partnerA, partnerB?, children[] }`) between the normalizer and coordinate math. Marriage is peer-to-peer, not hierarchical; forcing it through `TreeNode.children` nesting is the root cause of the current in-law bugs.

### Key findings
1. **In-laws ARE in the payload — as roots.** `tree_handler.go:149-157` defines roots as *any member without parents in `parent_child`*; in-laws married into the family have no recorded parents → they are emitted as top-level roots with `children: []`. The phantom gap = `useTreeLayout.ts:200-216` reserves width for the spouse but never positions the card, then `:260-264` places the in-law *again* as a disjoint root. **Fix: splice in-laws into their spouse's unit AND prune them from the root list** (single placement). No extra `GET /members` fetch needed — a local `Map<id, TreeNode>` from the tree payload suffices.
2. **T-junction rail collision (spec defect).** Cards are 72 px tall; spouse midpoint sits at `parent.y + 36`. The planned `V_DROP = 24px` puts the rail at `parent.y + 60` — **inside the parent card** (bottom at `+72`). Correct rail: `parent.y + CARD_HEIGHT + 24 = parent.y + 96` (i.e., 24 px *below card bottom*, not below midpoint). With `Y_GAP = 96`, child top is `parent.y + 168` → healthy 72 px drop from rail to children.
3. **Sibling-block overlap bug** at `useTreeLayout.ts:237-240` when left-side subtrees expand — needs a 2-pass bounding-box shift (Reingold-Tilford-style); this is R-01's real content.
4. **Filter interplay**: normalizer must run *before* filtering; when a filter hides parents, parent-child connectors must be suppressed (both-endpoints-visible rule) — otherwise `useTreeConnectors` anchors stems at missing/`(0,0)` coordinates (crash/garbage mode). Matches the historical `collectFilteredNodes` flat-forest bug.
5. **No paternal/maternal signal exists in the API** — root ordering `GenerationIndex ASC, FullName ASC` (`tree_handler.go:163-168`) cannot place "paternal left". Needs a heuristic (see Decisions Pending D1).
6. **Extensibility traps**: remarriage (member in 2+ spouse sets) unhandled → `FamilyUnit` model + documented limitation; consanguinity (blood↔blood marriage) turns the tree into a DAG → visited-set guard in traversal; spouse ordering should be *blood-left / in-law-right* (not gender-based — same-sex-safe).

| Axis | Rating | Justification |
|---|---|---|
| Complexity | Med | Deterministic math, but couple/multi-spouse edge cases need the unit model |
| Scalability | High | ≤300-node preprocessing <3 ms; layout is not the bottleneck |
| Maintainability | Med→High | FamilyUnit graph model prevents `useTreeLayout` spaghetti |
| Risk | Med | Two concrete geometry defects + double-placement bug found (all fixable pre-implementation) |
| Cost | Low | Pure frontend; zero backend changes (Decision 5 client-side normalization confirmed) |

---

## 3. Backend Delta — kinship-labels + POST /me/member

### Endpoint vs client-side flip

| Option | Complexity | Scalability | Maintainability | Risk | Cost | Recommendation |
|---|---|---|---|---|---|---|
| **Batched endpoint (Decision 2C)** | Low — additive handler reusing cached engine | Med-High — N×Calculate ≈ 5–15 ms @N≤150 in-memory; encapsulate as `Engine.CalculateAllFrom` for future single-pass | High — Go engine stays single source of truth (660 LOC of BFS/LCA/Dijkstra/patrilineal rules, 3 dialects) | Low (after MUST-FIXes) — response ~10 KB raw / 1.8 KB gzip | Low — ~40 LOC | ✅ **RECOMMENDED** |
| **Client-side TS port (flip)** | High — port 660 LOC graph + rules | High — offline compute | **Low** — dual-stack drift across 3 dialect lexicons; every Go fix replicated in TS | Med-High — engine-parity bugs; E2E vs card-badge disagreement | High | ❌ **REJECT** — lexicons are tiny (3.1 KB) but the *engine* is the cost; offline gain is marginal (SW can cache the labels response); client-side only wins for interactive re-rooting, which is not a requirement |

### Endpoint design findings
- **Public placement is acceptable**: `GET /families/:id/tree` and `/feed` are already public and expose the full roster (names, dates, living status, edges). The label map adds only *inferred* relationship structure — no new raw facts. (Register MR-01 for CPU/rate-limit, see §5.)
- **Pre-existing latent defect (MUST-FIX M3)**: `kinship.Service.Calculate` calls `engine.GetGraph(ctx, familyID, 0)` — version `0` — and **no mutation handler ever calls `engine.Invalidate(familyID)`** (`BumpVersion` updates only the DB). The kinship graph cache serves **stale data until process restart** — this affects the *existing* `/kinship` endpoint today; the labels endpoint would amplify it.
- **`POST /me/member` contention (MUST-FIX M1)**: `users.member_id` has **no UNIQUE constraint** (`001_users.sql`, `002_family_tree.sql`); `LinkMember` is a blind `UPDATE users SET member_id=$2 WHERE id=$1` (`user_repo.go:134-139`). Two accounts can claim the same member → double "Tôi" rings, wrong kinship roots. Phase-1 Task 1.2 #5's rebind rule ("verify permissions") references a permission model that does not exist.
- Handler must validate: family exists (404), `from` ∈ family (400/404 — prevents cross-family traversal), and pass the family's **current DB version** to the engine.

---

## 4. Avatar Strategy

| Option | Complexity | Scalability | Maintainability | Risk | Cost | Recommendation |
|---|---|---|---|---|---|---|
| **Static `web/public/static/avatars/` (Decision 1C)** | Low | Med (seed/stock only — by design this milestone) | High | Low | Low (~80–120 KB precache) | ✅ **CONFIRM for this milestone** |
| Go-served upload pipeline (1B) | Med-High (storage pkg, volumes, multipart, resize) | High | Med | Med | High | Correctly deferred to v2 |
| Initials-only (1A) | Lowest | — | — | Lowest | Lowest | ❌ Fails reference-design fidelity |

### Findings
- **Topology verified single-origin**: `deploy/nginx.conf` proxies `/api/` → `api:8080`, SPA fallback otherwise; web on `3456`. `/static/avatars/x.png` resolves same-origin in dev (Vite proxy) and prod. No Go static route exists today (`router.go` registers `/api/v1/*` only) → no collision.
- **Precache is automatic**: vite-plugin-pwa default `globPatterns` (`**/*.{js,css,html,ico,png,svg,webmanifest}`) includes `public/` build output; no `runtimeCaching` needed for static seeds. 8–10 assets @10–15 KB ≈ 100 KB — negligible vs the 2 MB precache warning ceiling.
- **INV-01 enforcement gap (MUST-FIX M4)**: `MemberInput.AvatarURL` has **zero validation** (`tree_handler.go:267-274, 404-458`). External `https://` URLs are storable. Prod nginx CSP (`img-src 'self' data: blob:`) blocks loading (→ clean `@error` → initials), but dev/non-CSP environments leak viewer IPs and break offline. Cheap fix: reject anything not matching `^/static/avatars/[A-Za-z0-9_-]+\.(png|svg|webp|jpg)$`.
- **Error-flag latch bug (MUST-FIX M12)**: phase-3's `hasAvatarError = ref(false)` never resets when culled cards recycle or `avatar_url` changes → permanent initials for a fixed URL. Add `watch(() => props.node.avatar_url, reset)`.
- **Seed filename mismatch**: `fixture.go` references 7 member-slug files (`nguyen-van-an.png`, …); phase-1 plans generic names (`avatar-m1.png`). They MUST match — decide convention (D2).
- `@error` fires reliably for 404 / 5xx / abort / CSP / SW-miss; aria identity preserved via the card button's `aria-label`.

---

## 5. Phase Dependency & Risk Scan

### Phasing verdict: **SOUND, with re-sequencing**
1→2→3→4 (contracts → geometry → presentation → verification) is correctly ordered. Adjustments:
- Move `useKinshipBadge.ts` (pure mapping) into **Phase 1** — label contract 100% unit-verified before UI exists.
- The E2E "Tôi" scenarios require an in-test `POST /me/member` binding step: **demo/mock users are provisioned with `member_id = nil`** (`auth/demo.go:27-31`, `mock_oauth.go`), and no seed fixture links a user. Without this, phase-4 acceptance criteria are untestable.

### Hidden couplings found (not in plan §5)
- **Stale-badge coupling**: member CRUD → `treeStore.invalidate()` clears `kinshipLabels` but nothing re-fetches → all badges vanish after any edit until reload. Fix: after `fetchTree()` resolves, if `user.member_id` → `fetchKinshipLabels()` (also solves the async-auth race where `user` resolves after tree load).
- **`reset()` gap**: `tree.ts reset()` (logout/family switch) does not clear `kinshipLabels` → cross-family stale labels.
- **Normalizer must not mutate `treeStore.roots`** (`shallowRef`, shared with KinshipView) — clone, always (elevate to tested invariant).
- **Click hijack**: card root is a `<button @click.stop>` navigating to `/members/:id`; the "Đây là tôi" child button needs `@click.stop.prevent` or every link attempt navigates away.
- **Excel is SAFE**: `export.go` defines exactly 9 columns — `avatar_url` is not exported/imported; no avatar-path leakage into spreadsheets (and re-imports leave it untouched).
- **Zoom <0.6 dot-collapse hides badges/Tôi ring by design** (they live in the full-card branch); collapsed `aria-label` carries name+generation but not kinship — acceptable, note as NICE-TO-HAVE extension.
- **Date-format contract split (guaranteed CI friction)**: `plan-overview.md:20,141` says `s.1942` (no space); `decisions.md:253`, `phase3/phase4` pin `"s. " + year` (space). Unify on **`s. 1942`** (with space) and fix plan-overview §1/§7.
- **DOM-budget acceptance criterion is wrong as written**: "total DOM node count < 300" is unachievable at the cap (300 cards × 7–9 elements ≈ 2,400). Reword: "≤300 visible card components; connectors consume exactly 1 DOM node (canvas)."

### Risk register audit
| Risk | Verdict | Note |
|---|---|---|
| R-01 subtree spacing | ADEQUATE | Real content = sibling-overlap bug §2.3; multi-root fixtures required |
| R-02 avatar 404 | ADEQUATE | Add the latch-reset fix (M12) |
| R-03 canvas HiDPR | **OVERSTATED** | DPR scaling already implemented (`TreeVisualizer.vue:161-166`) |
| R-04 pinned date tests | **UNDERSTATED** | Format split guarantees friction across unit + E2E; unify now (M13) |
| R-05 unlinked UX | ADEQUATE | — |
| R-06 DOM budget | ADEQUATE | But reword the acceptance criterion (M13) |

**Register as new risks**: MR-01 public labels-route CPU/rate-limit; MR-02 `users.member_id` double-linking (→ M1); MR-03 filter-state connector crash (→ M9); MR-04 diacritic clipping on badges — `py-0.2`/`text-[10px]` chips clip `Nội`/`Ngoại` unless line-height ≥1.45 enforced (INV-02); MR-05 E2E lacks a linked-user fixture (→ M13).

---

## Consolidated Plan Amendments

### MUST-FIX (by phase)
**Phase 1**
- **M1** — Migration: `CREATE UNIQUE INDEX idx_users_member_id_unique ON users(member_id) WHERE member_id IS NOT NULL;` + `LinkMember` rules: same-link → 200 idempotent; claimed-by-other → **409**; member missing → 404; rebind allowed when own `member_id` IS NULL. Document cross-family binding semantics (D3).
- **M2** — Labels handler: family 404 / `from`∈family 400-404 / pass **current** family version; encapsulate traversal as `Engine.CalculateAllFrom(g, from, dialect)`.
- **M3** — Fix pre-existing kinship cache staleness (version-0 lookup + missing `Invalidate()` hooks on member CRUD/Excel import). Benefits the existing `/kinship` endpoint too.
- **M4** — Backend `AvatarURL` validation (relative `^/static/avatars/…` only) in Create+Update; seed filenames ↔ `fixture.go` consistency.
- **M5** — Store contracts: `reset()` clears `kinshipLabels`; refetch labels after `fetchTree()` when `member_id` present; `TreeView` watches `user.member_id` (late-auth race); move `useKinshipBadge.ts` into Phase 1.

**Phase 2**
- **M6** — Y-rail fix: rail at `parent.y + CARD_HEIGHT + 24` (24 px below **card bottom**, not below midpoint). Update `decisions.md` Decision 4 spec.
- **M7** — Normalizer: splice in-laws into spouse units **and prune them from roots** (single placement).
- **M8** — Introduce `FamilyUnit` intermediate graph model (normalizer → units → layout → connectors).
- **M9** — Filter rule: parent-child edges drawn only when both endpoints visible; suppress otherwise (no dangling stems / null anchors).
- **M10** — Immutability invariant (never mutate `treeStore.roots`) + 2-pass bbox sibling-overlap fix (`useTreeLayout.ts:237-240`) + multi-root/multi-couple Vitest fixtures.
- **M11** — Canvas guard: `dpr = min(devicePixelRatio, 2)`; if `width × dpr` exceeds a safe backing-store budget (≈16.7 M px), degrade to dpr 1 (log warning) — prevents iOS Safari texture crashes on wide trees.

**Phase 3**
- **M12** — `hasAvatarError` reset watcher on `avatar_url` change; `@click.stop.prevent` on all card child actions ("Đây là tôi").

**Phase 4**
- **M13** — Unify date format to **`s. 1942`** (fix `plan-overview.md` §1/§7); reword DOM-budget criterion (≤300 visible cards, connectors = 1 node); E2E binds member via `POST /me/member` after mock login; badge INV-02 audit (line-height ≥1.45, no diacritic clipping).

### NICE-TO-HAVE
- Remove `watch(culled) → drawEdges()` (wasteful redraw); cache token colors once per layout pass.
- Document the SVG fallback recipe (compound paths ≈ 2 nodes/edge-type) under R-01.
- Spouse ordering convention: blood-left / in-law-right; grandparent-couple ordering heuristic (D1); visited-set cycle guard; multi-spouse layout policy as documented limitation.
- Extend collapsed-dot `aria-label` with kinship term; basic rate limit on the public labels route; Workbox `runtimeCaching` for `/static/**` when uploads arrive; SVG avatars (<20 KB total).

### Decisions Pending (leader)
- **D1** — Grandparent couple ordering: ancestry-trace from "Tôi" (paternal branch left) with `FullName ASC` fallback, vs pure alphabetical. *Recommend ancestry-trace.*
- **D2** — Avatar naming: generic archetypes (`avatar-m1.png`) + update `fixture.go` URLs, vs exact member-slug files matching today's fixtures. *Recommend generic archetypes (reusable, no data coupling); either is fine — they must merely MATCH.*
- **D3** — Cross-family `LinkMember`: allow global binding (document it) vs restrict to a family context. *Recommend allow + document for this milestone.*
- **D4** — Unlink capability (`DELETE /me/member` or null body). *Recommend defer to follow-up; design body as nullable now.*

### Open Questions
- Multi-spouse (remarriage) visual policy beyond the documented limitation.
- Multi-family user membership would require a `user_family_members` join table (currently 1:1 by assumption).
- Dark-mode/theme switching would need a canvas token-refresh hook (MutationObserver) — not currently a requirement.
- Real-device validation of the widest seed tree against iOS canvas texture limits (post-M11, low priority).

---

## Gaps

- **⚠️ DEGRADED — skill bank partial miss**: `skill_list` errored (DB type bug) and `skill_search` returned empty pre-dispatch; 5 of 7 workers reported `NO SKILL LOADED` (all four `structural-design` dispatches + `data-flow-design`); `resilience-design` loaded successfully for the avatar worker (the risk-scan worker on the same skill reported no injection). Per the escape valve a single re-dispatch per node is prescribed, but the miss was verified **systemic pre-dispatch** (deterministic, not stochastic), and every skill-less report arrived evidence-complete (file+line citations, concrete arithmetic) — so no re-dispatch was spent; instead each report was adjudicated individually on evidence above. Mitigation applied: every load-bearing finding is **cross-validated across ≥2 independent workers** where possible — UNIQUE-constraint gap (backend + risk-scan), filter crash (layout + risk-scan), DPR/texture limits (canvas + SVG), in-laws-are-roots (layout + backend via `tree_handler.go`), filename mismatch (avatar + backend fixture refs).
- No worker performed on-device performance measurement (all perf figures are analytical estimates from code paths); treat M11's thresholds as provisional.
