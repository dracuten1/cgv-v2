# Phase-4 verification — harness lessons (2026-09-28)

Independent verification of feature/apple-design-all-pages Phase 4 (tree chrome + M1 + PD-P3-2) surfaced four harness defect classes in newly written browser packs. All were diagnosed from evidence, fixed, and validated; recording root causes so future packs start green.

## 1. Empty Content-Type on static dist server → silent blank SPA
- Symptom: every page assertion times out; screenshot = uniform blank page; playwright trace console: `Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of ""`.
- Network trace: `200 GET .../assets/index-*.js content-type=[]` — node http sends NO Content-Type unless you setHeader.
- Root cause: server block rewritten during a bash-3.2 compat fix dropped the MIME map.
- Fix: single `send()` helper sets `Content-Type` from an ext map (`.html/.js/.mjs/.css/.woff2/.svg/.png/.json/.webmanifest`) with `application/octet-stream` fallback on ALL paths (static hit, SPA fallback, 404, proxy default).
- Detection: playwright `trace.network` shows content-type per resource — check this FIRST when a browser pack fails en masse with blank pages.

## 2. macOS /bin/bash 3.2 vs bash-4 syntax
- `${PREFIX,,}` (lowercase expansion) → `bad substitution` at line 5, instant pack death.
- Fix: `$(printf '%s' "$PREFIX" | tr 'A-Z' 'a-z')` style, or hardcode log names.
- Validation must use `/bin/bash -n` specifically — PATH bash may be v5 and masks the failure.

## 3. Daemon child shells lack `node` on PATH
- Symptom: port-scan probe (`node -e` bind test) fails for every candidate → `RESULT: FAIL (no free port)` in <1s (a real 10000-port scan can't exhaust that fast).
- Fix: `export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"` at script top (all proven packs do this).

## 4. Spec-contract mismatches vs product auth/state model
- Member-detail action CTAs are auth-gated: anon contexts → element absent → 15s timeouts. Demo-auth via `ctx.request.post(BASE + '/api/v1/auth/demo', {headers:{Origin}})` (cookie lands in context jar; feed-spec precedent).
- `tree-loading` only renders during the TREE fetch (after families resolve) — stage loading by holding ONLY the tree route.
- Retry re-fetches the currently selected family — unroute ALL interceptions (incl. families) before clicking retry, else the app retries a staged fake id forever.
- Anon navigation always 401s `/api/v1/me` — either run auth'd (preferred) or whitelist per project convention (feed pack).
- Elements scoped to one view don't exist on navigation targets (click a member-detail breadcrumb from the tree page = timeout).

## 5. Measurement methodology for layered chrome surfaces (canonical, 2026-09-28)
- Computed-style walking (text color vs nearest opaque ancestor bg) MISATTRIBUTES backgrounds on translucent layered chrome (e.g., `bg-card/90` 0.9-alpha compass surface): it stops at the translucent layer or pairs near-equal-luminance clusters → phantom sub-4.5 readings (observed 1.079/1.16 vs true 10.77).
- CANONICAL: `serviceWorkers:'block'` on every measuring context (PWA offline-ready toast otherwise overlays chrome) → element clip screenshot @2× dsf → in-page `<img>`→2D canvas decode → 4-bit/channel quantized histogram → modal bg = top cluster; glyph = extreme-luminance distinct cluster (sparse glyphs never reach a 10% share clause — do NOT use literal top-2 clusters, that reproduces the trap: 1.16/1.18).
- Programmatic `el.focus()` does NOT match Chromium's `:focus-visible` heuristic — use a bounded keyboard Tab walk to verify focus rings.

## Product findings carried to the report (not harness)
- M1 duplicate CTA <768px (AppButton base `inline-flex` beats unprefixed `hidden`).
- `tree-retry` missing focus-visible ring.
- Dark-theme compass glyph 1.702 (light 7.394).
- PRE-EXISTING (base e73b2e6 identical, renderer-owned, D13-excluded): /tree success state populates 0 cards — world layer 0×0, transform scale 0.337, specks only; blocks the renderer-owned card-text contrast measurement (designer adjudication deferred).

## Ops notes
- LLM backend outage (`antigravity/gemini-3.8-flash-low`) killed 2 workers mid-run; recovery: 1 revive (worked), 1 revive-budget-exhausted → replacement spawn. Stalled-instance signature: status=running with last_activity frozen — terminate + replace rather than wait.
- Worktree A/B for regression attribution: `git worktree add` + node_modules symlink (verify package.json/lock identical first) + MIME-correct serve of the built base dist + same-session tip control — cheap and decisive.
