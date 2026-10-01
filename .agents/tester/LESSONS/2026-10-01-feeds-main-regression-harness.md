# Feeds-main regression gate — harness lessons (2026-10-01)

Run: full vitest + build gate + focused browser E2E on `feature/feeds-main-redesign`
(uncommitted diff, 15 files + new `web/src/stores/feed/constants.ts`).

## 1. Host npm/npx broken → direct `node_modules/.bin` binaries

`npm test` / `npm run build` cannot be trusted on this host (task-context note, confirmed
by substitution being required). Both gate packs now exec direct binaries:

- `web_vitest_p0.sh` → `cd web && ./node_modules/.bin/vitest run`
- `web_build_p0.sh` → `bash web_build_p0.sh.worker` (worker file runs
  `./node_modules/.bin/vue-tsc -b` then `./node_modules/.bin/vite build`, reporting
  separate per-stage exit codes)

Full suite: 397/397 in 45 files, 20.0s — the `.bin` runbook costs nothing.
Build: vue-tsc 0 + vite 208 modules / 35 precache, 8s.

## 2. Recurrence of the exec-quoting 127 trap (PACKS.md L53 lesson)

The perl watchdog's `exec(@ARGV)` runs with NO shell. Passing a multi-word command
string (`./node_modules/.bin/vue-tsc -b && ...`) as one arg → ENOENT → **exit 127 at
launch (~0s, "command not found")**. This is the SAME trap the 2026-09-27
harness-repair note documented; it recurred on 2026-10-01 and cost one pack re-run.

**Rule (now enforced twice):** any multi-word command under a perl `exec(@ARGV)`
watchdog MUST live in an executable `.worker` file invoked as a single simple arg
(`bash <path>.worker`). Symptom signature: exit 127 + ~0s runtime + incomplete log.

## 3. Stale environment claims must be re-probed with correct request context

Task context claimed "demo endpoint refuses sessions (403/501)". The truth, established
2026-10-01 with three probes:

- Playwright `request`-fixture POST (no page Origin) → 403 `csrf_origin_mismatch`
  ("thiếu thông tin Origin hoặc Referer"). NOT evidence of refusal — the fixture
  carries no Origin/Referer.
- In-page `fetch` POST from `http://localhost:10001` → 403 `csrf_origin_mismatch`
  ("nguồn gốc yêu cầu (Origin/Referer) không hợp lệ"). The API's CSRF allowlist
  accepts `127.0.0.1:*` origins but REJECTS `localhost:<high-port>`.
- In-page `fetch` POST from `http://127.0.0.1:<port>` (credentials include,
  Content-Type application/json, body `{}`) → **200** `is_demo:true` user.
  Session cookie `cgp_session`: host-only (no Domain attr → binds to 127.0.0.1),
  `Path=/; Max-Age=86400; HttpOnly; SameSite=Lax`. `GET /api/v1/me` → 200.

**Rules:** (1) before marking auth-dependent E2E BLOCKED-by-environment, probe from a
real browser origin — and use the `127.0.0.1` HOSTNAME for isolated origins on this
stack (`localhost:<port>` is CSRF-rejected). (2) playwright `request` fixture posts
never carry page Origin — use `page.evaluate(fetch…)`. (3) host-only cookies mean the
isolated origin must stay on ONE hostname for the whole flow (serve, fetch, reload).

## 4. E2E runbook that worked (fresh-frontend against live stack)

Serve `web/dist` on a free 10000–19999 port with `/api/*` reverse-proxied to
`http://localhost:3456` (never bind/kill 8088/5432/3456). Guest feed read works
unauthenticated; guest `/api/v1/me` → 401 ×N is expected console noise. Default seed
family `11111111-1111-4111-8111-000000000001` has 11 posts → Load More correctly
absent (page size 20); paging-error E2E must be interception-staged. Demo session
obtained via in-page fetch; composer validation runnable without submitting posts.

## 5. Never copy the working server — reuse it (2026-10-01 auth-leg post-mortem)

The authenticated E2E leg burned 5 failed rounds, EVERY one a defect in freshly
written/copied ad-hoc server code (missing SPA history fallback → browser ran a
"Not found" static page, not the SPA; copied proxy crashed `res is not defined`;
etc.), while the ORIGINAL pack server worked flawlessly every time it was used.
Rules going forward:
- **Reuse the proven server artifact as-is.** Ad-hoc re-implementations of
  "just a tiny static server + proxy" reintroduce fallback/MIME/proxy bugs the
  original already solved. If a new scenario is needed, add a new SPEC against
  the existing server, not a new server.
- **Pre-flight gate every isolated server:** (a) `curl /some-spa-route` must
  return the app HTML (not "Not found") AND (b) `curl /api/v1/families` must
  return 200 through the proxy — before any Playwright assertion.
- **Route facts:** the app's login route is `/login` (router has no `/signin`);
  `/signin` serving "Not found" was the ad-hoc-server fallback defect, not routing.
- **Playwright actionability:** clicking a correctly-DISABLED button (e.g. image
  add with a URL failing the validator) times out by design — assert disabled
  state instead of clicking. A "stalled click" is often correct product behavior.
- **Persist assertions incrementally:** write each result row to disk as it is
  measured; a trailing timeout must not erase earlier boundary evidence.
- **A session cookie proof chain:** POST 200 → `context.cookies()` snapshot →
  reload → `/me` 200 → only THEN conclude the SPA "adopted" the session; and
  confirm the page is actually the SPA (title/app div) before reading any
  component-count evidence from it.
