# Lesson: oklch computed colors demand canvas-roundtrip contrast parsing (Phase 3, 2026-09-27)

**Context:** Independent Phase 3 browser verification on CGP v2 (Apple redesign). Three sibling specs
hand-ported the "proven" phase2 email-verify contrast sweep, which string-parses color functions.

**Root cause:** Chromium's `getComputedStyle` PRESERVES `oklch()` (and `color-mix()`) functional
notation. The design system's tokens are oklch-based, so Phase 3 surfaces compute to oklch strings.
A numeric-regex parser reads oklch channels as RGB channels and produces confident garbage —
e.g. backgrounds like `rgb(1, 0, 95)` and ratios of 1.03:1 on text that is plainly visible.
The phase2 spec never met oklch on ITS screens, so "proven" was context-dependent.

**Fix (now the canonical pattern):** canvas-roundtrip normalization — 1×1 canvas, sentinel
`fillStyle='#123456'`, assign the color string, detect rejected assignments, `fillRect` +
`getImageData` → sRGB bytes; alpha-composite ancestors in rgb space. Field-proven by the
developer's `apple-phase3-content.spec.cjs` (51 valid rows) and adopted across
`apple-phase3-{kinship,memberdetail,feed}.spec.cjs`. Reference implementations live in those specs.

**Secondary lessons from the same run:**
1. **Escape discipline in template literals:** a parser fix committed with single-backslash regexes
   inside a template literal degraded `\d`→`d` silently (commit 53e4ab6, superseded by 467ce54).
   Validate template-embedded code by eval'ing the extracted template before running the pack.
2. **One route, one owner:** duplicate `page.route` handlers on the same API glob shadow each other
   (first-installed wins). Helper-installed fixtures silently starve test-owned fixtures.
   Every test installs its OWN fixture; helpers never register API routes.
3. **Staging fidelity:** measure against the fixture you actually installed (a posts-only body is
   not a member-detail). The developer's summary.json + PNGs are legitimate triangulation inputs
   when two sweeps disagree — visual evidence beats a lone number.
4. **Known-defect pattern:** convert adjudicated product-defect assertions into evidence-capturing
   rows (`KNOWN-DEFECT PD-x` in summary.json, `defectDetected` flips when fixed) so packs stay
   green on resolved-adjudication signal instead of blocking forever.
5. **Live-backend ground truth:** demo login requires `Origin: http://localhost:3456` (CSRF
   allowlist, middleware.go:125-170) — pack proxies must rewrite Origin. Container env
   `ensemble`/`ensemble_dev` creds on cgp-v2-postgres are STALE; authoritative are `cgp_user`/
   `cgp_db` from the api container's DATABASE_URL.
