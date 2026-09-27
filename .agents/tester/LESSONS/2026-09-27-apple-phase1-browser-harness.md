# LESSONS — Apple Phase 1 live-Vue browser harness (5 repair iterations, 2026-09-27)

Pack: `.agents/tester/packs/apple_phase1_shell_e2e_test.sh` + spec `e2e/specs/apple-phase1-shell.spec.cjs` (final `aef6aca`).

1. **Playwright `locator.evaluate` argument order is `(element, arg)`.** Writing `(evaluatorSrc, el)` made `eval()` return the DOM node and three contrast tests silently produced `TypeError: ev.measure is not a function` — caught only because classification demanded per-test output.
2. **Never parse computed colors in Node.** `oklab()/oklch()/color()` came back as strings; naive triplet parsing scored gray-on-white as 2.84:1. Fix: ship an evaluator into the page (`elementHandle.evaluate`), resolve exotic notations via a 1×1 canvas fallback, walk ancestors to the first alpha>0 background, composite over white, re-composite sub-1-alpha foregrounds.
3. **`test.describe.configure({mode:'serial'})` converts one bad expectation into zero coverage** — 1 failed / 14 did-not-run. Independent (`default`) mode + incremental per-check `summary-${runId}.json` + `safeClose()` means a timeout or abort still leaves usable measurements.
4. **One mega-test cannot fit Playwright's 60s per-test budget.** Split into 15 focused tests (≈45s total); budget ≈2m45s was overestimated — actual 28–57s.
5. **Backend demo endpoint enforces an Origin allowlist.** `POST /api/v1/auth/demo` → 403 when the preview proxy forwarded `Origin: http://127.0.0.1:<port>`; rewriting Origin to `http://localhost:3456` in the pack's proxy fixed login e2e. The earlier "12s delayed login" was actually 403-polling, not product latency.
6. **Dual navigation at wide viewports double-counts `aria-current`.** AppLayout renders desktop nav + mobile bottom nav; scope assertions to `nav[aria-label="Điều hướng chính"]`. On `/login` the correct aria-current count is 0 (login is a CTA, not a nav destination).
7. **Multi-page fixtures are not in the default vite build.** `web/gen-chip-contrast.html` never reached `dist`; serve it via a pack-owned `vite dev --host 127.0.0.1 --port <10000–19999> --strictPort` and export `APPLE_PHASE1_FIXTURE_BASE` — no production vite-config edits.
8. **Fresh-dist proof is a precondition, not an assumption**: compare `dist/index.html` mtime to source mtimes and grep compiled CSS for the expected utilities (`.text-gen-N-fg`) before trusting any run.
