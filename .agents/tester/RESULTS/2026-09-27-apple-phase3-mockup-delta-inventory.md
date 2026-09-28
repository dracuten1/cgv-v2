# Phase 3 mockup structural-delta inventory (independent)

Scope: comparison of canonical HTML specimens against the current Vue view/components, by static reading only. Mockup-only state galleries are specimen variants, not simultaneously rendered screen content. Classification: (a) user-visible structural delta; (b) structure/data variation justified by D12 or runtime data; (c) token/layout treatment; (d) wording. Recommendations are adjudication inputs, not test findings.

## Summary counts

| Route | (a) Structural-user-visible | (b) Structural-justifiable | (c) Cosmetic/token | (d) Copy-only |
|---|---:|---:|---:|---:|
| `/members/:id` | 3 | 2 | 1 | 1 |
| `/feed` | 4 | 2 | 1 | 2 |

Counts are distinct inventory entries, not severity scores. The Phase 3 plan's 2000-character composer contract versus implementation's 5000-rune cap is documented separately below and excluded from mockup-delta counts.

## `/members/:id`

Canonical anchors are `mockups/person-detail.html` and `person-detail-states.html`.

| # | Mockup anchor | Implementation anchor | Class | User-visible impact | Recommendation |
|---|---|---|---|---|---|
| M1 | `person-detail.html` lines 31–39: page-head back link + title + “Xem trên cây”; hero lines 42–58 has share and edit actions. | `MemberDetailView.vue:24–72`: hero is first region; no page-head/back or tree CTA, share omitted; authenticated edit/delete instead. | a | The page opens on a more compact hero and lacks the mockup's explicit tree-return/tree-view/share actions; delete is added. | FIX-BEFORE-PHASE4 (adjudicate intended action set; likely retain necessary delete, restore navigation affordance). |
| M2 | `person-detail.html:61–78`: personal-info section followed by “Cuộc đời” timeline; `:81–94`: family and notes sidebar, in two-column split. | `MemberDetailView.vue:74–185`: tab panel replaces split; overview is fields+notes; no life timeline or family/notes sidebar. | a | Major screen composition and content order differ; no dedicated events timeline, family card, or separate notes card. | FIX-BEFORE-PHASE4 if timeline/family summary remains an approved requirement; confirm with D12/design disposition. |
| M3 | `person-detail.html:57–59` offers disabled edit only; states specimen `person-detail-states.html:3–5` shows tabs and edit/delete dialogs. | `MemberDetailView.vue:51–69,74–94,187–217`: authenticated edit/delete actions; three interactive tabs. | a | This is intentionally closer to states specimen than original static page, but navigation/actions are not present in original mockup and the overall default information layout changes. | KEEP tabs/dialogs under D12; adjudicate M1/M2 separately. |
| M4 | `person-detail-states.html:3` explicitly says tabs/dialogs are mutually exclusive specimen variants; relations at `:4`, posts at `:5`, edit/delete at `:6–7`. | `MemberDetailView.vue:97–183,187–217`; relation empty headings and own-post empty text; `MemberEditDialog.vue:7–95`. | b | Real tabs/dialogs are separate states, not all stacked. Empty relation groups retain headings; posts empty state is local. This is the disposition requested by D12 rather than a simultaneous-layout defect. | KEEP (D12 variation). |
| M5 | `person-detail.html:81–94` shows four named family relations; states `person-detail-states.html:4` specifies grouped parents/spouses/siblings/children and real per-ID links. | `MemberDetailView.vue:127–171,286–294`: four relation groups, data-driven cards and `/members/{id}` links. | b | Number and identity/layout of cards vary with API data; empty groups have explanatory copy. | KEEP (data-driven / D12). |
| M6 | `person-detail.html:42–45` one avatar/name/status/meta row; `:61–78` simple KV rows. | `MemberDetailView.vue:25–48,98–124`: generation/status chips and responsive definition grid; generation accent. | c | Same basic identity and fields, different card/grid/chip treatment within token-based system. | KEEP unless visual review identifies a concrete token violation. |
| M7 | `person-detail.html:42–45` sample status “Đã mất”; `:47–50` sample metadata includes Chi họ Nội; `:61–78` field labels and sample values. | `MemberDetailView.vue:39–47,99–123`: status switches living/deceased; family, gender, dates, notes from API. | d | Labels/values differ according to actual data; hero omits branch metadata while overview includes family name. Not a general structural omission beyond M1/M2. | KEEP (data-driven wording); confirm family-branch field parity if required. |

State coverage note: loading and not-found are implemented (`MemberDetailView.vue:3–21`) and correspond to mockup state gallery (`person-detail.html:97–100`, states specimen `:8`). No separate error screen is implied beyond EmptyState/error description. No structural delta counted for these.

## `/feed`

Canonical anchor: `mockups/feed.html`.

| # | Mockup anchor | Implementation anchor | Class | User-visible impact | Recommendation |
|---|---|---|---|---|---|
| F1 | `feed.html:30–38` header then directly composer/list; no install banner. | `FeedView.vue:3–5`, `InstallPrompt.vue:3–43`: conditional PWA install banner precedes feed header. | a | Eligible browsers can see an additional, potentially prominent top banner absent from canonical route design; shifts all content down. | FIX-BEFORE-PHASE4 (verify intended route-level placement/approved design disposition). |
| F2 | `feed.html:41–44`: composer has textarea and “Thêm URL ảnh” button, then footer at `:45–47`. | `FeedView.vue:56–101`: always-visible URL input/add button row; queued image chips appear before footer. | a | Composer affordance and footprint differ: explicit URL field plus “Thêm ảnh” instead of button-triggered URL entry; queued chip row adds a region. | FIX-BEFORE-PHASE4 (align interaction/layout or document approved enhancement). |
| F3 | `feed.html:49–55,57–59`: sample post metadata includes family + date and one illustrative attachment block. | `PostCard.vue:1–24`, `ImageGrid.vue:1–19`: author/date only; real image URL grid, no family-name metadata. | a | Posts omit family identity shown in the specimen and replace illustrative single attachment panel with actual image grid; especially noticeable in multi-family context. | FIX-BEFORE-PHASE4 (assess whether family identity is needed/available; real image grid is justified behavior but visual delta remains). |
| F4 | `feed.html:31–38` family selector shown with one option and text-button “Thông báo bật”; mobile tabbar exists. | `FeedView.vue:21–33`: family selector only when `families.length > 1`; `NotificationToggle.vue:1–39` binary switch/alternate unsupported/unconfigured text. | a | Single-family users do not see the specimen's family selector; notification control is a switch rather than the labeled button and may show configuration/unsupported state. | KEEP family selector conditional (single-family redundancy); FIX-BEFORE-PHASE4 only if visible notification affordance is judged material mismatch. |
| F5 | `feed.html:60–69`: guest prompt card, empty/error/loading cards in state gallery. | `FeedView.vue:127–142,154–198`: anonymous terracotta banner; loading skeleton, error/retry, EmptyState. | b | State structures are conditional and broadly cover specimen state intent; guest prompt is a banner rather than centered state card. | KEEP (state/role variation); ensure designer accepts banner placement/treatment. |
| F6 | `feed.html:45–47` static `0/2000`; `:70–72` load-more button. | `FeedView.vue:103–123,214–223`: live counter, submit pending label, paginated button only with cursor. | b | Runtime dynamic counter/loading/pagination visibility reflects state/data rather than a missing fixed specimen element. | KEEP. |
| F7 | `feed.html:39–47`: composer’s 44px avatar, bordered textarea, wrapped footer/actions; `:49–59` post card/attachment well. | `FeedView.vue:36–125`; `PostCard.vue:2–24`: borderless textarea within card, responsive padding and token surfaces. | c | Spacing, control treatment, and image presentation differ, while core composer/card regions remain. | KEEP unless visual review finds a design-system violation. |
| F8 | `feed.html:32–33` subtitle “Những câu chuyện mới nhất của gia đình.”; `:41–47` helper and button labels; guest copy `:61–64`. | `FeedView.vue:17–19,52,73,105,134–137,195–196`. | d | Minor punctuation/CTA and empty-state wording variation (“bài viết” vs “câu chuyện”); no structural impact. | KEEP or harmonize copy in editorial pass. |
| F9 | `feed.html:49–59` illustrative post author/date/content; family label shown in header metadata. | `PostCard.vue:6–15,19–23`: live author/date/content, no family label; date formatting includes time. | d | Sample content/date format differs; family-label omission is separately captured in F3. | KEEP sample-data differences; consider date-format consistency. |

State coverage note: initial loading, error/retry, empty, and paging are present (`FeedView.vue:154–224`) and correspond to `feed.html:60–73` specimens. Error while paging has its own inline alert. No structural delta counted for state existence.

## Plan cross-check / documentation drift

`apple-design-all-pages/phase3-content.md` §1 specifies D12 disposition for relations/posts/dialog variants and §3 contracts explicitly state “2000-character counter” (`phase3-content.md:17–20,23–26`). Implementation sets `MAX_CONTENT_RUNES = 5000` and uses it for textarea maxlength/counter (`FeedView.vue:262–268,51,115`), with an inline comment asserting backend `MaxContentRunes = 5000` parity. This is a **plan-versus-implementation documentation/contract drift**, not a mockup structural delta (mockup `feed.html:41–42` also says maxlength 2000). Do not silently resolve during visual adjudication: owner should reconcile plan/mockup and backend constraint or explicitly approve 5000. User-visible consequence: counter and permitted post length differ from the mockup and plan.

## Ranked candidates to adjudicate before Phase 4

1. **M2 — Restore/resolve the mockup’s life timeline + distinct family/notes composition:** largest content/region change on member detail; Vue replaces the two-column page with tabs and omits timeline entirely.
2. **M1 — Resolve member hero navigation/action mismatch:** missing back/tree-view/share affordances and newly added delete change the most prominent initial-screen controls.
3. **F2 — Align composer image-entry interaction:** canonical button-only “Thêm URL ảnh” versus always-visible URL field, “Thêm ảnh” action, and queued chips changes both interaction and composer height.
4. **F1 — Decide whether the PWA install banner belongs above canonical feed:** conditionally introduces a large first-screen region not in mockup.
5. **F3 — Decide post identity/image composition:** omitted family name and actual image grid instead of specimen attachment panel affect scanability and multi-family context.

These are candidates, not an assertion that every delta should be fixed; F4's single-family selector omission and F5's guest banner are likely defensible implementation choices. No tests were run.
