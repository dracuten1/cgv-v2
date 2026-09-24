# Phase 1 Plan: Backend Delta & Data Contracts

> **Phase**: 1 of 4
> **Objective**: Implement the backend batched kinship labels endpoint, the user-member binding endpoint, store actions, frontend TypeScript types, and bundled static seed avatars to establish all data contracts required by the family tree redesign.
> **Status**: Ready for implementation
> **Binding Decisions**: Decision 1C (Avatar hybrid), Decision 2C (Batched kinship labels), Decision 3B (POST /me/member binding).

---

## 1. Scope & Touched Files

### Backend (`api/`)
- **NEW** `api/migrations/005_unique_users_member_id.sql`: Partial unique index `idx_users_member_id_unique` on `users(member_id) WHERE member_id IS NOT NULL` (M1).
- `api/internal/handler/adapters.go`: Extend `KinshipService` interface with `GetLabels(ctx context.Context, familyID, fromID, dialect string) (map[string]string, error)`.
- `api/internal/kinship/service.go`: Implement `GetLabels` on `Service`, exposing `Service.Engine()` and delegating to `engine.CalculateAllFrom(g, from, dialect)`.
- `api/internal/handler/kinship_handler.go`: Add `GetFamilyKinshipLabels` method consuming `KinshipService.GetLabels`.
- `api/internal/handler/router.go`: Wire updated dependencies; register `GET /api/v1/families/:id/kinship-labels` and `POST /api/v1/me/member`.
- `api/internal/kinship/engine.go`: Add `CalculateAllFrom(g, from, dialect)` and call `engine.Invalidate(familyID)` in all member-mutation paths: tree_handler Create/Update/Delete (`tree_handler.go:350,498,572`) and Excel import (`excel/service.go:112`) (M3/K1).
- `api/internal/handler/auth_handler.go`: Add `LinkMember` handler method enforcing strict 5 M1 rules (demo-guard 403, 200 unlinked, 200 idempotent, 409 conflict, 404 missing).
- `api/internal/handler/tree_handler.go`: Add avatar URL format validation regex (`^/static/avatars/[A-Za-z0-9_-]+\.(png|svg|webp|jpg)$`) on `MemberInput.AvatarURL` (M4).
- `api/internal/handler/handler_test.go`: Add tests for endpoints (`TestGetFamilyKinshipLabels_*`, `TestLinkMember_*` incl. 403 demo-isolation, 409 conflict & idempotency, and mutate$\to$labels staleness).
- `api/internal/seed/fixture.go`: Ensure seed avatar URLs conform to `^/static/avatars/...` regex.

### Frontend (`web/`)
- `web/src/types/api.ts`: Add `KinshipLabelsResponse` DTO and update `UserProfile` or member link types.
- **NEW** `web/src/composables/useKinshipBadge.ts`: Pure abbreviation composable moved to Phase 1 (M5) mapping canonical terms ("Bản thân" $\to$ "Tôi", "Con trai" $\to$ "Con", etc.).
- `web/src/stores/tree.ts`: Add state `kinshipLabels: Record<string, string>`, action `fetchKinshipLabels(familyId: string, fromMemberId: string)`, ensure `reset()` clears `kinshipLabels` (M5), and trigger refetch after `fetchTree()` if user is linked.
- `web/src/stores/auth.ts`: Add action `linkMember(memberId: string)` calling `POST /api/v1/me/member`.
- `web/src/api/auth.ts`: Add `linkMemberApi(memberId: string): Promise<UserProfile>`.
- `web/src/api/kinship.ts`: Add `getFamilyKinshipLabelsApi(familyId: string, fromMemberId: string, dialect?: string)` (re-anchored to real file `kinship.ts`).
- **NEW** `web/public/static/avatars/`: Populate with placeholder seed avatar PNGs/SVGs matching generic archetypes (`avatar-m1.png` … `avatar-f4.png`) compliant with **INV-01** and D2.

---

## 2. Detailed Task Breakdown

### Task 1.1: Implement Batched Kinship Labels Endpoint (Backend)
- **Anchor**: `api/internal/handler/kinship_handler.go`, `api/internal/handler/adapters.go:74-77`, and `api/internal/kinship/service.go`.
- **Requirements**:
  1. Method: `GetFamilyKinshipLabels(c *gin.Context)`
  2. URL parameters: `id` (family UUID), query parameters: `from` (member UUID), `dialect` (optional, default `bac`).
  3. Validate `family_id` and `from` UUID formatting; return 400 if invalid.
  4. Fetch family current `version` from `families` repository (M3/K1).
  5. In `adapters.go`, extend `KinshipService` with `GetLabels(ctx context.Context, familyID, fromID, dialect string) (map[string]string, error)`.
  6. In `service.go`, implement `GetLabels`: obtain the family graph using `s.engine.GetGraph(ctx, familyID, version)` (corrected engine signature).
  7. If `from` member does not exist in graph, return 404 with standard error envelope (`api/internal/model/api.go`).
  8. Compute labels using `s.engine.CalculateAllFrom(g, from, dialect)` (new batched calculation method added to `engine.go`).
  9. Construct response:
     ```json
     {
       "family_id": "uuid",
       "from": "uuid",
       "dialect": "bac",
       "labels": {
         "target-uuid-1": "Bố",
         "target-uuid-2": "Mẹ",
         "target-uuid-3": "Bản thân"
       }
     }
     ```
  10. Return HTTP 200 with JSON payload.
  11. **Cache Invalidation (M3/K1)**: The kinship engine cache is keyed by `(familyID, version)`. M3 cache invalidation must reach EVERY member-mutation path: ensure `h.engine.Invalidate(familyID)` is called upon all member mutations including tree_handler Create/Update/Delete (`tree_handler.go:350, 498, 572`) and the Excel import mutation path (`excel/service.go:112`) so label responses reload fresh graphs on mutation without requiring server restarts.

### Task 1.2: Implement `POST /api/v1/me/member` Binding Endpoint & Migration (Backend)
- **Anchor**: `api/internal/handler/auth_handler.go:222-236`, `api/internal/auth/service.go`, `api/internal/auth/ports.go:20-22, 74`, `api/internal/repository/auth/user_repo.go:133-137`, and `api/migrations/005_unique_users_member_id.sql`.
- **Requirements**:
  1. **Database Migration (M1)**: Create `api/migrations/005_unique_users_member_id.sql`:
     ```sql
     CREATE UNIQUE INDEX idx_users_member_id_unique ON users(member_id) WHERE member_id IS NOT NULL;
     ```
  2. Method: `LinkMember(c *gin.Context)`. Protected by JWT auth middleware.
  3. Request body DTO (D4: omit `binding:"required"` for nil-safe future unlink semantics):
     ```go
     type LinkMemberInput struct {
         MemberID *uuid.UUID `json:"member_id"`
     }
     ```
  4. Validate user authentication from context using standard helper `userID := GetUserID(c)`.
  5. If `input.MemberID == nil`: reserve for future unlink (return 400 or no-op).
  6. **Strict M1 Linking Rules (5 Explicit Enumerated Rules)**:
     - Route linking through a service method on `auth.Service` (e.g. `LinkMember(ctx, userID, memberID)`), wrapping repo calls and business rules rather than direct repository calls from `AuthHandler`.
     - **Rule 1 (Demo Isolation Guard)**: Verify user model. If `user.IsDemo == true` $\to$ abort immediately with HTTP 403 Forbidden using `model.NewErrorEnvelope(model.CodeDemoIsolationViolation, auth.ErrDemoIsolation.Error())`. Demo accounts are strictly isolated and NEVER linkable to members.
     - **Rule 2 (Missing Member)**: Verify that `*input.MemberID` exists in `members` table. If not found $\to$ return HTTP 404 Not Found.
     - **Rule 3 (Idempotent Link)**: If `user.MemberID != nil && *user.MemberID == *input.MemberID` $\to$ return HTTP 200 OK with `auth.UserProfile` (idempotent no-op).
     - **Rule 4 (Conflict Pre-check)**: If another user already has `member_id == *input.MemberID` $\to$ reject with HTTP 409 Conflict (`CodeConflict`).
     - **Rule 5 (Unlinked Link)**: If `user.MemberID == nil` $\to$ execute linking via `auth.Service` delegating to `userRepo.LinkMember(ctx, userID, *input.MemberID)`.
  7. **Concurrent Conflict Handling (SQLSTATE 23505)**:
     - Wrap `userRepo.LinkMember` call: if a concurrent link race occurs, intercept PostgreSQL unique violation error code `23505` (from `idx_users_member_id_unique`) and map cleanly to HTTP 409 Conflict.
  8. Retrieve updated user profile via `auth.Service.CurrentUser` and return HTTP 200 with standard `auth.UserProfile` (uniform with `GetMe`, no new DTO).
  9. Document D3: Linking is globally 1:1 across users and members.

### Task 1.3: Router Registration & Go Handler Tests (Backend)
- **Anchor**: `api/internal/handler/router.go:94-118` and `api/internal/handler/handler_test.go`.
- **Requirements**:
  1. In `router.go`, register:
     - `public.GET("/families/:id/kinship-labels", kinshipHandler.GetFamilyKinshipLabels)`
     - `protected.POST("/me/member", authHandler.LinkMember)`
  2. In `handler_test.go`:
     - Test `TestGetFamilyKinshipLabels_Success`: Seed a multi-generational mock graph, call endpoint with `from=grandparent`, verify map contains `"Bố"`, `"Con"`, etc.
     - Test `TestGetFamilyKinshipLabels_MissingFrom`: Expect HTTP 400.
     - Test `TestGetFamilyKinshipLabels_MemberNotFound`: Expect HTTP 404.
     - Test `TestGetFamilyKinshipLabels_StalenessAfterMutate`: Member CRUD mutation followed by `GetFamilyKinshipLabels` must reflect newly added member relationship without server restart.
     - Test `TestLinkMember_Success`: Authenticated user links to valid member; verify `users.member_id` updated.
     - Test `TestLinkMember_Idempotent`: Second request with same `member_id` returns HTTP 200.
     - Test `TestLinkMember_Conflict_409`: Second user attempting to link to already-claimed member receives HTTP 409 (including SQLSTATE 23505 race condition).
     - Test `TestLinkMember_DemoIsolation_403`: Demo user calling `POST /me/member` receives HTTP 403 `CodeDemoIsolationViolation`.
     - Test `TestLinkMember_Unauthenticated`: Expect HTTP 401.
     - Test `TestLinkMember_InvalidMember`: Expect HTTP 404.

### Task 1.4: Seed Fixture Assets & Avatar Validation (Backend & Frontend)
- **Anchor**: `api/internal/seed/fixture.go:180-220`, `api/internal/handler/tree_handler.go:267-274, 404-458`, and `web/public/static/avatars/`.
- **Requirements**:
  1. **Avatar URL Validation (M4)**: In `tree_handler.go`, validate `MemberInput.AvatarURL` on Create and Update against regex `^/static/avatars/[A-Za-z0-9_-]+\.(png|svg|webp|jpg)$`. Return HTTP 400 on external URLs or non-conforming paths, preventing SSRF and honoring **INV-01**.
  2. Create directory `web/public/static/avatars/`.
  3. Add lightweight SVG/PNG generic archetype avatars (`avatar-m1.png` … `avatar-f4.png` or SVG silhouettes per D2) compliant with **INV-01**.
  4. Ensure seed data generator in `fixture.go` assigns valid relative paths matching these exact filenames.

### Task 1.5: Frontend Types, API Clients & Pinia Stores (Frontend)
- **Anchor**: `web/src/types/api.ts`, `web/src/stores/tree.ts`, `web/src/stores/auth.ts`, and `web/src/composables/useKinshipBadge.ts`.
- **Requirements**:
  1. Move `useKinshipBadge.ts` into Phase 1 (M5) with pure abbreviation logic ("Bản thân" $\to$ "Tôi", "Ông nội"/"Bà nội" $\to$ "Nội", etc.) and unit tests in `web/src/test/kinship-badge.spec.ts`.
  2. Define `KinshipLabelsResponse` in `web/src/types/api.ts`:
     ```ts
     export interface KinshipLabelsResponse {
       family_id: string;
       from: string;
       dialect: string;
       labels: Record<string, string>;
     }
     ```
  3. Add `linkMemberApi(memberId: string)` in `web/src/api/auth.ts`.
  4. Add `getFamilyKinshipLabelsApi(familyId: string, fromMemberId: string, dialect?: string)` in `web/src/api/kinship.ts` (re-anchored to real file `kinship.ts`).
  5. In `web/src/stores/tree.ts`:
     - Add reactive state: `kinshipLabels = ref<Record<string, string>>({})`.
     - Add action `async fetchKinshipLabels(familyId: string, fromMemberId: string, dialect?: string)`: populates `kinshipLabels.value`.
     - Ensure `reset()` clears `kinshipLabels.value = {}` (M5).
     - Invalidate `kinshipLabels.value = {}` inside existing `invalidate()` action.
     - Auto-refetch: In `fetchTree()`, if `authStore.user?.member_id` is present, immediately invoke `fetchKinshipLabels()`.
  6. In `web/src/stores/auth.ts`:
     - Add action `async linkSelfToMember(memberId: string)`: invokes `linkMemberApi`, updates `user.value.member_id`, and triggers `treeStore.fetchKinshipLabels(currentFamilyId, memberId)`.

---

## 3. Test Expectations & Verification

- **Backend Unit Tests**:
  - Run `go test -v ./internal/handler -run "TestGetFamilyKinshipLabels|TestLinkMember"` $\to$ Green.
  - Run full suite: `go test ./...` $\to$ All existing tests pass.
- **Frontend Unit Tests**:
  - Add test in `web/src/test/stores-tree-member.spec.ts` asserting:
    1. Calling `fetchKinshipLabels` saves labels to `treeStore.kinshipLabels`.
    2. Calling `treeStore.invalidate()` clears cached `kinshipLabels`.
    3. `authStore.linkSelfToMember` sets `user.member_id`.

---

## 4. Acceptance Criteria

- [ ] `005_unique_users_member_id.sql` applies cleanly on database boot, creating `idx_users_member_id_unique`.
- [ ] `GET /api/v1/families/:id/kinship-labels?from=:memberId` returns HTTP 200 with a complete dictionary of relative kinship terms, using current family version.
- [ ] Member CRUD mutations invalidate the kinship engine cache; subsequent calls return updated relations without stale results.
- [ ] `POST /api/v1/me/member` successfully binds authenticated user to member and returns updated user profile (200 OK); re-binding same member returns 200 idempotent.
- [ ] Attempting to bind a member already linked to another user returns HTTP 409 Conflict (including SQLSTATE 23505 race handling).
- [ ] Demo accounts attempting to bind via `POST /me/member` receive HTTP 403 Forbidden with `CodeDemoIsolationViolation`.
- [ ] Unauthenticated requests to `POST /me/member` return HTTP 401; invalid member IDs return HTTP 404.
- [ ] `MemberInput.AvatarURL` rejects external URLs with HTTP 400 and accepts only valid `/static/avatars/...` paths.
- [ ] Static seed avatars exist in `web/public/static/avatars/` and load over standard HTTP without 404s.
- [ ] Pinia `treeStore` clears `kinshipLabels` on `reset()`, invalidates on tree mutation, and auto-refetches when a linked user is loaded.
- [ ] `useKinshipBadge.ts` passes all term abbreviation tests in `kinship-badge.spec.ts`.
- [ ] All Go tests and Vitest unit tests pass.
