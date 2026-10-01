# Tidier Notes — cgp-v2

## family-tree-view polish sweep — iteration 001 (2026-09-24, a8dffff..a7c0a2c)
- 3 parallel workers (readable-code / static-hygiene / robustness), fan-in complete, 0 gaps.
- Merged after dedupe: 1 High / 10 Medium / 14 Low.
- Approved-fix mapping: #1 M4 regex ✅ confirmed (3 identical sites); #2 hex→tokens ✅ confirmed (+adjacent canvas fallback hexes TreeVisualizer.vue:247-252); #3 005 RAISE row details ✅ confirmed (005:22); #4 excel_test failImport NOT independently re-flagged by workers — approved fix stands on leader spec, no conflicting evidence; #5 card-visual.ts pin — robustness found the branch structure at :20 (default isLiving=true) and :27/:33 (early return makes ' – ?' branch unreachable) is load-bearing for implementing the 'YYYY – ?' pin correctly; #6 doc-only.
- New headline: familyUnits computed-but-unused pass (useTreeLayoutNormalizer.ts:269-305, useTreeLayout.ts:223) — High; adjudicate against decisions.md (FamilyUnit single-spouse limit is documented there) before removing.
- handler_test.go crossed 3,250 lines (>3000 flag → split by domain). kinship not-found error identity drift engine.go:180. fetchTree keeps prior family's labels on refetch failure (tree.ts:44-48, 88-93).
- Skill-bank outage: robustness worker could not load tidier-robustness skill nor land skill_feedback ("No usage record"); proceeded on inline rubric from dispatch prompt; report conforms.
- Riders for Developer pass: .gitignore .DS_Store (3 untracked), catch(err:unknown) TreeNodeCard.vue:199, shared canvas color constants (optional).
- Verdict: Needs Work (craftsmanship) — 1 high / 10 medium / 14 low; fixes + suites + commits are Developer's lane.


## Warm Heritage UI redesign craftsmanship sweep — iteration 001 (2026-09-26, 210ddc4..HEAD, feature/ui-redesign-implementation)
- 3 parallel workers (readable-code / static-hygiene / robustness), fan-in complete, 0 gaps.
- Merged after dedupe: 3 High / 5 Medium / 7 Low.
- Reviewer-flagged follow-up #1 (kinship.ts in-flight race) — confirmed High by robustness worker, concrete sequence-counter fix provided at kinship.ts:19-47.
- Reviewer-flagged follow-up #3 (KinshipView.vue:9 typo "xưng xưng") — confirmed High by readable worker, two rewrite options given.
- Reviewer-flagged follow-up #2 (AppCombobox activeIndex regression test) and #4 (mockups/04-kinship.html stray hex) are Developer-lane test/mockup edits, not craftsmanship findings — carried forward as reminders, not independently re-derived by workers (out of worker file scope).
- New headline: KinshipView.vue SRP violation — view mixes page orchestration + raw membersApi fetch + hardcoded demo-seed synthesis via members.value.push(...) (228-278); flagged High for both code-smell reasons and because push() can leak mock entries into live picker search — noted as Deferred-to-Reviewer watch item, not a Tidier verdict on correctness.
- Cross-cutting Medium: catch(err:any) type-looseness (hygiene) and inconsistent formatApiError() usage (robustness) land on the SAME lines (AccountView.vue:416/440/452/464, LoginView.vue:281, EmailVerifyView.vue:83) — kept as two distinct findings (different categories: Type Cleanliness vs Error Handling) per dedup rule (same file:line, different category = not a duplicate).
- Duplicate gender-badge styling/label logic across 3 files (KinshipResult/MemberDetailView/AppCombobox) — Medium, consolidate into api/gender.ts helper.
- Icon-component boilerplate (33 files) — deduped into ONE Low finding per dispatch instruction, not 34 repeats. All file sizes confirmed within thresholds (highest: AccountView.vue 472 lines, all ≤500 ideal).
- Type-check + vitest (266 tests) confirmed green by hygiene worker as part of File Hygiene pass.
- Verdict: Needs Work (craftsmanship) — 3 high / 5 medium / 7 low; fixes are Developer's lane. Iteration 1 of 3-cap consumed.


## feeds-main-redesign craftsmanship sweep — iteration 001 (2026-10-01, uncommitted diff on feature/feeds-main-redesign, +482/−268)
- 2 parallel workers (readable-code / static-hygiene; robustness deliberately skipped — error handling outside caller focus, correctness already approved). Fan-in complete, 0 gaps.
- Merged after dedupe: 1 High / 2 Medium / 2 Low. Hygiene worker CLEAN (vue-tsc --noEmit green, no unused imports/dead exports, all 8 files <500 lines).
- High: FeedView.vue:20 compressed single-line template blocks (composer/states/feed list/shortcut rail) — leader's brief pre-authorized a trivial mechanical fix for High; dispatcher stayed read-only (cardinal #5) and routed application to Developer.
- Medium: attachment cap `10` hardcoded at FeedView.vue:173 + ImageGrid.vue:35/:44 (3-site constant); FeedView.vue:45 SRP mix (layout + family selection + feed states + composer + attachments).
- Low: FeedView.vue:124 long single-line expression; NotFoundView.vue:39 compacted feed CTA vs multiline neighbors.
- Do-not-reflag list respected by both workers (no OAuth redirect / families-reset / UTF-16 / aria items re-raised).
- Readable worker's skill_feedback soft-failed ("no usage record") — known soft-fail mode (seen 2026-09-24 with robustness skill); report remains valid.
- Verdict: Needs Work (craftsmanship) — 1 high / 2 medium / 2 low. Iteration 1 of 3-cap consumed.
