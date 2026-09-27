# OpenDesign Publication & Store Synchronization Verification

**Project:** `cgp-v2-apple-redesign` (OpenDesign project ID)  
**Ensemble Project ID:** `37333555-94fb-4af4-a9da-54d183f827aa` (`cgp-v2`)  
**Timestamp:** 2026-09-27T11:24:00Z  
**Verification Method:** Exact byte-for-byte SHA-256 comparison between local canonical files (`.agents/shared/planning/apple-redesign/mockups/`) and OpenDesign raw GET endpoints (`http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/{path}`).

---

## 1. Complete Artifact Reconciled Ledger & SHA-256 Hashes

| Relative Path | Role / Description | Bytes | Local SHA-256 | OpenDesign Raw SHA-256 | Store Status |
|---|---|---|---|---|---|
| `login.html` | Canonical `/login` (Default / Auth entry) | 13,514 | `89b353eaa2d475d3041ab1225c28c43b62155b00ae91662a9fcc4650b56bf29f` | `89b353eaa2d475d3041ab1225c28c43b62155b00ae91662a9fcc4650b56bf29f` | **current** |
| `tree.html` | Canonical `/tree` (Gia phả canvas & surrounding chrome) | 16,752 | `6b1a5aebd0908a44e413c2c2f8800deaa39adef866539dafa732f724a1dd000d` | `6b1a5aebd0908a44e413c2c2f8800deaa39adef866539dafa732f724a1dd000d` | **current** |
| `person-detail.html` | Canonical `/members/:id` (Hồ sơ thành viên cá nhân) | 10,056 | `7f2d466070c7191899f9b0da6e425c7cabb7b7dce4629c8602129936677a429c` | `7f2d466070c7191899f9b0da6e425c7cabb7b7dce4629c8602129936677a429c` | **current** |
| `kinship.html` | Canonical `/kinship` (Tìm quan hệ thân tộc) | 9,990 | `f4eb10534c88c390e60fcee2bbf5b4d54fc043840c694af24a2d4a750db86b47` | `f4eb10534c88c390e60fcee2bbf5b4d54fc043840c694af24a2d4a750db86b47` | **current** |
| `feed.html` | Canonical `/feed` (Bảng tin dòng họ & tin tức) | 8,633 | `2a4daa578a0d95c4fbd73b7d8bb4a952bab0307e32fa0cee45e11f97fa54e59a` | `2a4daa578a0d95c4fbd73b7d8bb4a952bab0307e32fa0cee45e11f97fa54e59a` | **current** |
| `account.html` | Canonical `/account` (Cài đặt tài khoản & liên kết định danh) | 9,192 | `997d39b66c38a8e02eb4482fb231cf96abec0a6761c56db7256e01de20cde766` | `997d39b66c38a8e02eb4482fb231cf96abec0a6761c56db7256e01de20cde766` | **current** |
| `email-verify.html` | Canonical `/auth/email/verify` (Xác thực email magic link) | 3,622 | `3ae3e8b4964ae7a178c7e30dec2375e70317afeebf31e17a24ce8b10591c9d51` | `3ae3e8b4964ae7a178c7e30dec2375e70317afeebf31e17a24ce8b10591c9d51` | **current** |
| `oauth-callback.html` | Canonical `/auth/oauth/callback` (Chuyển tiếp OAuth đa nền tảng) | 3,389 | `0b2c575b44e8d26181478e3712d61aeb87a97f4a4518d6f77f789fa477de8137` | `0b2c575b44e8d26181478e3712d61aeb87a97f4a4518d6f77f789fa477de8137` | **current** |
| `not-found.html` | Canonical `/:pathMatch(.*)*` (Trang 404 không tìm thấy) | 2,167 | `480bce703cec8937b2887e472e04add00d11ab5dce06311c85df49eb1bbb6b74` | `480bce703cec8937b2887e472e04add00d11ab5dce06311c85df49eb1bbb6b74` | **current** |
| `tree-states.html` | State Sheet: `/tree` runtime states (Canvas, loading, error, empty, guest, demo) | 7,809 | `00863aa1aca86f4f78e49f0d5135f7870012bc3b677bd0f69c8eecb2e9e04470` | `00863aa1aca86f4f78e49f0d5135f7870012bc3b677bd0f69c8eecb2e9e04470` | **current** |
| `person-detail-states.html` | State Sheet: `/members/:id` states (Tabs 1-3, edit, delete, skeleton, not-found) | 11,340 | `5ca8bad90dd4bfa36efe90be34406f40a4443b0077a1b323c206a93318c9aa08` | `5ca8bad90dd4bfa36efe90be34406f40a4443b0077a1b323c206a93318c9aa08` | **current** |
| `account-states.html` | State Sheet: `/account` states (Real, demo, contacts, unlink confirm modal) | 11,395 | `b5949d1496d5a7283a0e388664d269dfdd3ba4fb3f15e4feb5e84ab8e0e74cae` | `b5949d1496d5a7283a0e388664d269dfdd3ba4fb3f15e4feb5e84ab8e0e74cae` | **current** |
| `dashboard.html` | Archived concept: Dashboard / tổng quan dòng họ | 15,199 | `f4451be0460a75291f9a1bb15599aedc2b5f0d5561cfca73e430a91d7ebb9b53` | `f4451be0460a75291f9a1bb15599aedc2b5f0d5561cfca73e430a91d7ebb9b53` | **current** |
| `persons.html` | Archived concept: Persons / danh sách thành viên | 11,439 | `05776e141ae98285e032857935f6b76b16439a48f6ef765d4f060af395d4e1d6` | `05776e141ae98285e032857935f6b76b16439a48f6ef765d4f060af395d4e1d6` | **current** |
| `settings.html` | Archived concept: Settings / cài đặt giao diện & bảo mật | 9,996 | `70fa39119423003b2e6bb6a5837a1ced8054d0b1b9b50be55b94b61fe954b99b` | `70fa39119423003b2e6bb6a5837a1ced8054d0b1b9b50be55b94b61fe954b99b` | **current** |
| `assets/tokens.css` | Design tokens: Quiet Clarity Warm Heritage palette & typography | 29,230 | `64c94cf180172c47db73f9a73e7cd8b020658374e2267f356df60116677f4163` | `64c94cf180172c47db73f9a73e7cd8b020658374e2267f356df60116677f4163` | **current** |
| `assets/state-contracts.css` | CSS contracts: Interactive tabs, modals, dialogs for state sheets | 4,881 | `044969c31e124b3afb28b8cf8f3991ef17b25e6d700d3820194603f6448aee31` | `044969c31e124b3afb28b8cf8f3991ef17b25e6d700d3820194603f6448aee31` | **current** |
| `assets/state-contracts.js` | JS harness: Lightweight hash-router specimen switcher | 696 | `27c2e61fc7f953c18d3074870bdf613c304fa8ad82620a4fcea81850efb8ccd6` | `27c2e61fc7f953c18d3074870bdf613c304fa8ad82620a4fcea81850efb8ccd6` | **current** |

---

## 2. Bundled Be Vietnam Pro Self-Hosted Font Assets (12/12 Verified Matching)

| Font File | Bytes | SHA-256 | Status |
|---|---|---|---|
| `fonts/bvp-400.woff2` | 11,532 | `dc085e2fba3414e5c5bf1e6172f921a9f81c5859946a4ed3d63c1e470d96a9e2` | **current** |
| `fonts/bvp-500.woff2` | 12,172 | `86341610cbe907eecf461c9159c168d5efb52bb1a33963813a08f520555d8e66` | **current** |
| `fonts/bvp-600.woff2` | 12,176 | `97658c6f9a384f29a3005c3d96e2a0d1c810192cf68979071c290f5a377a9f99` | **current** |
| `fonts/bvp-700.woff2` | 12,468 | `4f58af2d1c3e28a9ba14c51c82db2751d78344b75bdcb34de24a1031ebe59da6` | **current** |
| `fonts/bvp-latin-400.woff2` | 21,168 | `03d1b589cff172e1a670b3573e731d3380bc326f80cf83b0d3504e3188e2e074` | **current** |
| `fonts/bvp-latin-500.woff2` | 21,892 | `b621f77d35f777023aa11ca524462d511b4b28a813adbc0e9d15a10fc61dfe4e` | **current** |
| `fonts/bvp-latin-600.woff2` | 22,032 | `9503dec2a7c532c8331e9600bcafea287a4fd208573b8668d85ab8d8de1863c7` | **current** |
| `fonts/bvp-latin-700.woff2` | 22,152 | `a193dd87699bd2e18ddf72dc271493ea82a23dad9f5c334d9f2a257b1e05fc30` | **current** |
| `fonts/bvp-latin-ext-400.woff2` | 13,056 | `f7a2811e471c2973a1179ce39da3ad6bb8082381aa8d1535ccfcbc3d6d78a052` | **current** |
| `fonts/bvp-latin-ext-500.woff2` | 13,548 | `947d592eb7676914507ff68fc11fcf2cfdecd6ebaf0fa2af6047f66a63ea7d0f` | **current** |
| `fonts/bvp-latin-ext-600.woff2` | 13,608 | `20cc75daeaaaa0fa8af2b616b2de2b2900f0ce14ae8e9faa47d272cedd93827f` | **current** |
| `fonts/bvp-latin-ext-700.woff2` | 13,852 | `33d57e5bd840b03921568e08d2be1082d453e55f1ba55f421e41a1aa54e12601` | **current** |

---

## 3. Working OpenDesign Preview URLs

Base URL: `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/`

### A. Complete 9 Shipped Routes
1. **`/login`** — `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/login.html`
2. **`/tree`** — `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/tree.html`
3. **`/members/:id`** — `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/person-detail.html`
4. **`/kinship`** — `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/kinship.html`
5. **`/feed`** — `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/feed.html`
6. **`/account`** — `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/account.html`
7. **`/auth/email/verify`** — `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/email-verify.html`
8. **`/auth/oauth/callback`** — `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/oauth-callback.html`
9. **`/:pathMatch(.*)*`** — `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/not-found.html`

### B. State Sheet Family (Comprehensive Runtime Branches)
1. **`/tree` State Sheet** — `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/tree-states.html`
   - Preserved Canvas & cards (`#canvas`), low-zoom dot mode (`#lowzoom`), store loading (`#loading`), store error + retry (`#error`), empty tree (`#empty`), unlinked user banner (`#unlinked`), anonymous guest (`#guest`), demo 403-first notice (`#demo`).
2. **`/members/:id` State Sheet** — `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/person-detail-states.html`
   - Tab 1 Overview (`#overview`), Tab 2 Generation-striped Relations (`#relations`), Tab 3 Member Posts (`#posts`), MemberEditDialog live preview (`#edit`), AppDialog Delete Confirm (`#delete`), Loading Skeleton (`#skeleton`), Not Found EmptyState (`#notfound`), Guest View (`#guest`).
3. **`/account` State Sheet** — `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/account-states.html`
   - Real multi-identity account (`#real`), amber Demo account restriction (`#demo`), contact points email/phone (`#contacts`), disabled sole identity unlink (`#empty`), AppDialog unlink confirmation (`#unlink`).

### C. Archived Concept Screens (Maintained for Historical Reference)
1. **Dashboard Concept** — `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/dashboard.html`
2. **Persons Directory Concept** — `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/persons.html`
3. **Settings Concept** — `http://127.0.0.1:7456/api/projects/cgp-v2-apple-redesign/raw/settings.html`

---

## 4. Visual QA Multimodal Evidence & Rendering Verification

Fresh headless Google Chrome captures were taken directly from the live OpenDesign raw preview endpoints into `od-publish-evidence/`:
- `login-desktop.png` (99,967 bytes) — Audited via ImageReader: Verified 2-column layout, Be Vietnam Pro typography, terracotta badges/CTA, amber Demo panel, and OAuth provider stack.
- `tree-desktop.png` (106,153 bytes) — Audited via ImageReader: Verified top navigation ("Gia phả", "Quan hệ", "Bảng tin", "Tài khoản"), family tree canvas chrome, floating pan/zoom cluster, search sidebar, and Nguyễn Văn Cường inspector panel.
- `person-detail-desktop.png` (103,028 bytes) — Hero summary, breadcrumbs, and profile metadata.
- `kinship-desktop.png` (110,738 bytes) — Two-person picker, dialect selector, terracotta kinship badge, and path timeline.
- `feed-desktop.png` (89,838 bytes) — Authenticated composer, post cards, image attachments, and family selector.
- `account-desktop.png` (95,503 bytes) — Identity tiles, unlink actions, contact point list, and notification settings.
- `email-verify-desktop.png` (30,879 bytes) — Shell-free AuthInterstitial card, verification status disc, and auto-redirect indicator.
- `oauth-callback-desktop.png` (32,510 bytes) — Shell-free OAuth completion handler and outcome specimens.
- `not-found-desktop.png` (41,957 bytes) — Audited via ImageReader: Centered 404 display numeral, terracotta primary button ("Về cây gia phả"), secondary action ("Tìm quan hệ").
- `tree-states-desktop.png` (123,038 bytes) — Tabbed specimen panels for canvas states.
- `person-detail-states-desktop.png` (88,799 bytes) — Tabbed specimen panels for tabs and modal dialogs.
- `account-states-desktop.png` (116,299 bytes) — Tabbed specimen panels for real and demo account variations.
