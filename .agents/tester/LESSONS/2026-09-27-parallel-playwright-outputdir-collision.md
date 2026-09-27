# Parallel Playwright packs must isolate `--output` — shared default `e2e/test-results` gets clobbered

**Date:** 2026-09-27 (Phase 2 auth verification, 3 concurrent browser packs)
**Root cause:** Three pack scripts ran `npx playwright test` concurrently from the same `e2e/` cwd.
Playwright deletes its default outputDir (`e2e/test-results`) at the START of every run. Sibling
runs therefore deleted each other's in-flight artifacts mid-run, producing two ghost failures that
were never product defects:

1. login pack: artifact/trace copy failed with `ENOENT` mid-run (its error contexts vanished
   under it);
2. email-verify pack: post-mortem `error-context.md` missing entirely, making the 401-noise
   adjudication impossible from artifacts.

**Fix (now the project convention):**
- Every browser pack script invokes playwright with an isolated output dir:
  `npx playwright test specs/<spec> --config=playwright.config.ts --output "$ARTIFACTS/test-results" --reporter=list`
  where `$ARTIFACTS` is the pack's own dir under `.agents/tester/RESULTS/<pack>/`.
- Specs write per-case summary JSON in `afterEach`/per-check — never only at suite end — so a
  FAIL still leaves evidence behind.
- Console-error collectors must record `{message, url, status}` and whitelist by URL+status
  (e.g. anonymous `/api/v1/me` 401), listing both whitelisted and rejected entries in the
  summary. A console assertion without URL evidence is unadjudicable.

**Lesson for dispatching:** parallel browser packs are fine — but only after output isolation.
Verify the `--output` flag exists in a pack script before fanning out multiple packs from `e2e/`.
