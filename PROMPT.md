================================================================================
MASTER BUILD PROMPT — "CÂY GIA PHẢ" (CGP) v2
Go backend + Vue 3 frontend + Multi-provider Account Linking + Docker Compose
100% free — zero fees, zero subscriptions, fully self-hostable
================================================================================

ROLE
You are a principal full-stack engineer. Build CGP v2: a complete rewrite of
"Cây Gia Phả" (Vietnamese for "Family Tree") as a production-ready SPLIT-STACK
system — Go REST API backend, Vue 3 SPA frontend — deployed with a single
command via Docker Compose. Achieve 100% feature parity with v1 while upgrading
to an extensible multi-provider auth architecture with account linking.

================================================================================
1. HARD CONSTRAINTS (NON-NEGOTIABLE)
================================================================================
1. ZERO COST & ZERO SUBSCRIPTIONS:
   - Permissive open-source dependencies only (MIT, Apache 2.0, BSD, ISC).
   - NO paid third-party SaaS: no Auth0, Okta, Firebase, Stripe, paid SMS/email,
     or managed cloud DBs.
   - NO paid developer programs: Apple Sign-In is explicitly excluded ($99/yr).
   - Zero cost for end users: no paywalls, subscription tiers, locked features,
     or advertising (ads are strictly prohibited in code and acceptance slices).
   - Fully self-hosted & operable offline on a single machine via Docker Compose.
2. VIETNAMESE-FIRST LOCALIZATION:
   - All user-facing UI text, labels, alerts, validation messages, and errors
     MUST be in proper Vietnamese with correct diacritics (e.g., "Đời thứ 1",
     "Ông nội", "Chi nội"). English is acceptable only as secondary glosses.
   - Responsive design: mobile-first navigation (BottomNav), desktop-friendly.
3. PROTECTED v2 MIGRATION INVARIANTS:
   - Gender mapping invariant: Vietnamese values 'nam'/'nữ' MUST map bi-directionally
     to English DB/API values 'male'/'female' in the database, Excel import/export,
     API payloads, and Vue forms. Tested at every layer.
   - Mode A Demo Isolation: the demo deployment must be physically isolated —
     its own DB, role/credentials, session secret, cookie names, and JWT
     issuer/audience. Invalid configuration must crash before listening.
     Demo users NEVER merge or link with real-provider accounts.

================================================================================
2. REPOSITORY & ARCHITECTURE LAYOUT (Monorepo)
================================================================================
  api/                    → Go REST backend
    cmd/server/           → Main application entrypoint
    internal/
      auth/               → Multi-provider OAuth, JWT, identity resolution & linking
      members/            → Member CRUD, relationship graph
      kinship/            → Vietnamese kinship engine (blood & marital paths)
      feed/               → Family feed posts & media
      excel/              → Excelize import/export with gender mapping
      push/               → Web Push (VAPID) service
      store/              → PostgreSQL migrations (SQL) & repository layer
  web/                    → Vue 3 SPA
    src/
      components/         → FamilyTree (SVG/HTML), KinshipResult, MemberCardPreview
      views/              → TreeView, MemberDetailView, KinshipView, FeedView, AccountView
      stores/             → Pinia stores (auth, tree, member, feed)
      router/             → Vue Router route definitions & navigation guards
  deploy/
    docker-compose.yml    → Orchestration: postgres, api, web (nginx)
    Dockerfile.api        → Multi-stage Go build (golang:alpine → distroless/alpine)
    Dockerfile.web        → Multi-stage Vue build (node:lts-alpine → nginx:alpine)
    nginx.conf            → Serves Vue SPA + reverse-proxies /api/ to Go container
    .env.example          → Self-documenting environment variables
  docs/                   → OpenAPI 3.0 spec, Architecture Decision Records (ADRs)

Port binding: Nginx web container exposed on port 3456 (reverse proxies /api/* to Go).

================================================================================
3. TECH STACK (Exact — All Free & Open Source)
================================================================================
BACKEND (api/):
- Language & Framework: Go (current stable) with Gin Web Framework.
- Database Driver: PostgreSQL 16 via pgx/v5 (connection pool).
- Auth & Security: golang-jwt/jwt/v5, httpOnly SameSite=Lax Secure cookies,
  crypto/rand token generators.
- Excel Processing: qax-os/excelize/v2.
- Notifications: SherClockHolmes/webpush-go (VAPID, self-hosted free keys).
- Logging: standard library log/slog structured JSON logging.

FRONTEND (web/):
- Framework: Vue 3 (Composition API, <script setup>) + TypeScript + Vite.
- State & Routing: Pinia + Vue Router 4.
- Styling: Tailwind CSS v4 (CSS-based configuration).
- Tree Visualization: Custom reactive SVG/HTML tree renderer (d3-hierarchy allowed).
- PWA: vite-plugin-pwa (service worker, web app manifest, push listener).
- Typography: "Be Vietnam Pro" (body), "Fraunces" (display headings), Inter fallback.

================================================================================
4. DATA MODEL (PostgreSQL 16)
================================================================================
-- Multi-provider Auth & Account Linking
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL,
    is_demo BOOLEAN NOT NULL DEFAULT false,
    member_id UUID, -- Optional 1:1 link to a family tree member
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('zalo', 'google', 'facebook', 'email', 'demo')),
    provider_subject TEXT NOT NULL,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, provider_subject)
);

CREATE TABLE contact_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('email', 'phone')),
    value TEXT NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT false,
    verified_via TEXT, -- e.g. 'zalo', 'google', 'magic_link'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(kind, value)
);

-- Core Genealogy Models
CREATE TABLE families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
    generation_index INT NOT NULL DEFAULT 1,
    birth_date DATE,
    death_date DATE,
    is_living BOOLEAN NOT NULL DEFAULT true,
    avatar_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE parent_child (
    parent_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    PRIMARY KEY (parent_id, child_id)
);

CREATE TABLE spouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_a UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    member_b UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    marriage_date DATE,
    CHECK (member_a <> member_b),
    UNIQUE (member_a, member_b)
);

CREATE TABLE feed_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    author_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    images JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

================================================================================
5. API SPECIFICATION (Versioned REST /api/v1)
================================================================================
Auth & Identity:
  GET    /api/v1/auth/providers            → Enabled provider list
  GET    /api/v1/auth/:provider/login      → 302 OAuth redirect (zalo, google, facebook)
  GET    /api/v1/auth/:provider/callback   → Callback, link resolution, set JWT cookie
  POST   /api/v1/auth/email/magic-link     → Send free email magic-link (SMTP)
  GET    /api/v1/auth/email/verify         → Verify token, link email, set JWT cookie
  POST   /api/v1/auth/demo                 → Instant isolated demo session
  POST   /api/v1/auth/logout               → Clear session cookie
  GET    /api/v1/me                        → Current user, contact points, linked identities
  GET    /api/v1/me/link/:provider/start   → Initiate OAuth to link another provider
  DELETE /api/v1/me/identities/:id         → Unlink provider (fails with 409 if last identity)
  POST   /api/v1/me/contacts               → Add unverified contact point
  POST   /api/v1/me/contacts/:id/verify    → Trigger contact verification

Genealogy & Community:
  GET    /api/v1/families                  → List families
  GET    /api/v1/families/:id/tree         → Hierarchical tree graph with generation metadata
  GET    /api/v1/members                   → List/search members
  POST   /api/v1/members                   → Create member (Auth required)
  GET    /api/v1/members/:id               → Member details, relations, tab data
  PUT    /api/v1/members/:id               → Update member (Auth required)
  DELETE /api/v1/members/:id               → Delete member with orphan-safe relinking (Auth)
  GET    /api/v1/kinship?from=:id&to=:id   → Kinship term & path calculation
  GET    /api/v1/families/:id/export.xlsx  → Download Excel representation
  POST   /api/v1/families/:id/import.xlsx  → Upload Excel (multipart, Auth required)
  GET    /api/v1/families/:id/feed         → List feed posts (newest first)
  POST   /api/v1/families/:id/feed         → Create feed post (Auth required)
  POST   /api/v1/push/subscribe            → Register Web Push endpoint
  DELETE /api/v1/push/subscribe            → Unregister Web Push endpoint
  GET    /api/v1/health                    → System health & DB connectivity check

Public vs. Protected: Read-only access to tree, members, and kinship is public.
All mutations, Excel import, feed post creation, and account settings require JWT.

================================================================================
6. DETAILED FEATURE REQUIREMENTS
================================================================================

F1. MULTI-PROVIDER AUTH & ACCOUNT LINKING
- Supported Providers:
  1. Zalo Login (Custom OAuth 2.0 PKCE / token exchange; extracts verified phone & name).
  2. Google (OAuth 2.0 / OIDC; extracts verified email & name).
  3. Facebook (OAuth 2.0; extracts verified email if available).
  4. Email Magic Link (Tokenized URL sent via standard SMTP; no passwords needed).
  5. Demo Session (One-click access with pre-seeded demo user).
- Identity Resolution Algorithm (Executed on every OAuth/Email callback):
  1. Lookup user_identities by (provider, provider_subject).
     - If MATCH found: refresh last_login_at, issue JWT for user_id. Done.
  2. Else (new provider subject):
     - Check if provider returned a VERIFIED contact point (email or phone).
     - If verified contact point matches an existing row in contact_points:
       → AUTO-LINK: insert new user_identities record under the matching user_id.
       → Mark or confirm verified contact point. Issue JWT. Done.
     - If verified email matches User A, but verified phone matches User B:
       → CONFLICT: Do NOT auto-link. Create new user account and flag conflict
         in response to prompt manual user-initiated merge.
     - Else: Create new users row, insert contact_points, insert user_identities.
  3. Security & Safety Rules:
     - Unverified claims NEVER trigger auto-link.
     - Minimum 1 identity: A user cannot unlink their sole remaining login provider (409 Conflict).
     - Demo isolation invariant: Demo identities can NEVER be merged or auto-linked with real accounts.
- Vue UI:
  - Login view: Buttons for Zalo, Google, Facebook, Magic-link input, and "Dùng thử ngay" (Demo).
  - Profile view ("Tài khoản & Liên kết"): Displays all linked identity cards, an "Add Provider"
    linking button, unlink buttons, and verified contact badges ("Đã xác thực").

F2. FAMILY TREE VISUALIZATION (Route: "/tree")
- Render a full multi-generation family tree.
- TreeFilter: Filter by generation; generation color tokens for Gen 1..4 (via CSS variables).
- Member nodes: Display avatar, full name, birth/death dates, gender chips ("Nam" / "Nữ").
- Deterministic seed fixture: Root ancestor "Nguyễn Văn An" MUST appear on /tree immediately
  after running database seeds.
- Responsive Navigation: Mobile BottomNav (Tree, Kinship, Feed, Profile); desktop top header.

F3. MEMBER CRUD & PROFILE (Route: "/members/:id")
- Profile tabs:
  1. Tổng quan (Overview): vital dates, living status, biographical notes.
  2. Quan hệ (Relationships): parents, spouses, siblings, children with direct links.
  3. Bảng tin (Feed Activity): timeline of posts authored by this member.
- Add / Edit Dialog: Forms with a LIVE PREVIEW card updating reactively as the user types.
- Delete flow: Confirmation dialog; handles orphan nodes safely by preserving generational index.

F4. VIETNAMESE KINSHIP CALCULATOR (Route: "/kinship")
- Core Calculation Engine (Go):
  - Traverses the relationship graph across bloodlines and marital connections.
  - Computes exact Vietnamese kinship term (e.g., from root to paternal grandfather returns "Ông nội").
  - Result payload contains:
    * term: e.g., "Ông nội"
    * line: Family line (e.g., "Chi nội", "Chi ngoại")
    * generation_distance: Generational gap (e.g., "Cách 2 đời")
    * english_gloss: Secondary translation (e.g., "Paternal grandfather")
    * southern_variant: Regional dialect variation if applicable (e.g., "Miền Nam: Nội")
- Numbered Generation Headings:
  - Results MUST render numbered generation headings: "Đời thứ 1", "Đời thứ 2", etc.
- CRITICAL RENDERING REGRESSION RULE:
  - In KinshipResult.vue, the calculated term must render as BARE text in the DOM
    (textContent === "Ông nội").
  - Any decorative quotation marks MUST be rendered via CSS ::before and ::after
    pseudo-elements (content: '\201C' and '\201D').
  - NEVER insert literal curly quotes “” or HTML entities &ldquo;/&rdquo; directly
    into DOM text.

F5. EXCEL IMPORT & EXPORT
- Export: Generates .xlsx using Excelize with columns: Full Name, Gender (Nam/Nữ),
  Generation, Birth Date, Death Date, Parent Names, Spouse Names, Notes.
- Import: Validates format, deduplicates members by (full_name, birth_date).
- Gender Mapping Invariant:
  - Input Excel accepts "Nam" / "Nữ" (case-insensitive) → mapped to 'male' / 'female' in DB.
  - Export generates "Nam" / "Nữ" from 'male' / 'female' in DB.

F6. FAMILY FEED
- Feed posts stream chronologically (newest first) for the family.
- Author attribution linked to tree members.
- Supports text content and multiple image attachments (stored as JSONB URL arrays).

F7. PWA & PUSH NOTIFICATIONS
- Web app manifest and service worker configured via vite-plugin-pwa.
- Free Web Push (VAPID): users can toggle push notifications to receive alerts when
  new feed posts or tree updates are published.

F8. DEMO FIXTURE & SEED DATA
- Single CLI command: go run cmd/seed/main.go seeds:
  - 3 distinct families.
  - 53 members spanning 5 complete generations.
  - Realistic Vietnamese names, accurate dates, sample feed posts.
  - Root ancestor "Nguyễn Văn An" seeded in Family 1.
- Deterministic output: The same seed produces identical tree structures and kinship results.

F9. VIETNAMESE DESIGN SYSTEM
- Fonts: "Be Vietnam Pro" for body text, "Fraunces" for display headings, Inter fallback.
- Color Palette: Warm cream background (#FDFBF7), terracotta primary accents (#C85A32),
  soft slate neutrals, distinct pastel tokens for generations 1 through 4.
- Stacked diacritics: Correct line-height adjustments in CSS so Vietnamese tone marks
  are never clipped.

================================================================================
7. QUALITY GATES & VERIFICATION (Definition of Done)
================================================================================
1. Unit & Integration Tests:
   - Go: go test -v ./... passes. Includes table-driven tests for:
     * Multi-provider resolution matrix (existing identity, auto-link email,
       auto-link phone, unverified claim rejection, conflict handling, unlink guard).
     * Kinship traversal algorithms across 5 generations.
     * Gender mapping conversions ('nam'/'nữ' ↔ 'male'/'female').
   - Vue: npm run test (Vitest) passes. Includes unit test verifying that
     KinshipResult.vue renders bare text without quote characters in textContent.
2. Playwright End-to-End Acceptance (Ran against Docker containers):
   - Journey 1: Demo login → navigate to /tree → verify "Nguyễn Văn An" is visible.
   - Journey 2: Open kinship calculator → pick "Nguyễn Văn An" and grandson → assert
     exact match textContent === "Ông nội" and presence of "Đời thứ 1..N" headings.
   - Journey 3: Test account linking flow (mock provider identity link → verify persistent data).
   - Journey 4: Export family to Excel → verify header structure and "Nam"/"Nữ" values.
   - Journey 5: Create feed post → verify post appears in feed timeline.
3. Clean Docker Build:
   - docker compose up --build brings up postgres, api, and web containers cleanly.
   - Nginx serves on http://localhost:3456.
   - Seed script runs automatically on initialization if DB is empty.
   - Multi-stage Dockerfiles produce minimal, secure production images.

================================================================================
8. KNOWN GOTCHAS & SAFEGUARDS (From Engineering Experience)
================================================================================
- Client Build Encoding: Minified Vue client chunks escape Vietnamese characters
  as \uXXXX. Never assert UI presence by grepping built files; assert against the live DOM.
- Acceptance Test Contracts: Once Playwright tests are established, treat them as
  immutable contracts. Fix application code to satisfy specs, not the specs.
- Mode A Hard Fail: In production or demo mode, missing security keys or database
  credentials must cause the Go binary to terminate immediately with a non-zero exit code.

================================================================================
9. DELIVERABLES
================================================================================
1. Complete monorepo source code:
   - api/ (Go source, Go modules, migrations, seed tool, unit tests)
   - web/ (Vue 3 source, TypeScript, Pinia, Tailwind, Vitest specs)
   - deploy/ (docker-compose.yml, Dockerfile.api, Dockerfile.web, nginx.conf)
2. docs/openapi.yaml (Complete API contract)
3. README.md with:
   - Single-command quickstart instructions (docker compose up --build).
   - Guide for configuring free OAuth keys (Zalo, Google, Facebook) or running 100% offline.
================================================================================