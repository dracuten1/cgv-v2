# Contrast collectors: port the proven implementation — never patch a broken one

**Date:** 2026-09-27 (Phase 2 login spec, final remediation cycles)
**Root cause:** The login spec shipped its own contrast helper that treated `rgba(0, 0, 0, 0)`
(transparent) as an opaque parsed black background and stopped its ancestor walk. Result: the
assertion path measured the Zalo "Z" correctly (3.17:1) while the RECORDING path reported
garbage (16.83:1 vs black, floor "21:1" everywhere) — an invalid PASS that a careless run would
have blessed. Meanwhile `apple-phase2-email-verify.spec.cjs`'s sweep, written against the same
dist+proxy harness, produced correct, adjudicated values (5.53/6.06) from the start.

**Fix:** ported the email-verify sweep wholesale (proper alpha compositing: walk ancestors until
background alpha > 0, composite, WCAG ratio) — one implementation shared by the assertion and
recording paths. Commit `48ae169`.

**Rules going forward:**
1. One contrast implementation per spec suite, shared by assertions and evidence recording —
   divergent collectors produce adjudication-proof evidence.
2. New specs PORT the proven sweep; never hand-roll a second one.
3. Evidence-first ordering is mandatory: record all measurements to per-case JSON BEFORE any
   assertion can throw, including on the failure path — otherwise the failing element destroys
   the rest of the sweep's evidence (this cost one extra remediation cycle on /login).
4. Cross-check a known-value element by hand (e.g. #0068FF on #fff = 3.17) before trusting a
   sweep's numbers.
5. Capture surface evidence at the viewport where the surface EXISTS (the login intro panel
   lives at ≥960 — sweeping only 390/320 yields empty arrays, which is correct behavior, not a
   bug to "fix").
