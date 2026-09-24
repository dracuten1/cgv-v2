package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/model"
)

func TestLinkMember_Success(t *testing.T) {
	r, userStore, svc := setupLinkMemberRouter(t)
	user, err := userStore.Create(context.Background(), "Nguyễn Văn Thật", false)
	if err != nil {
		t.Fatalf("tạo user thất bại: %v", err)
	}

	w := postMeMember(r, linkTestCookie(t, svc, user), `{"member_id":"`+linkTestMemberA+`"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("kỳ vọng 200 liên kết thành viên, nhận %d. Body: %s", w.Code, w.Body.String())
	}

	var profile auth.UserProfile
	if err := json.Unmarshal(w.Body.Bytes(), &profile); err != nil {
		t.Fatalf("parse profile json thất bại: %v", err)
	}
	if profile.User.ID != user.ID {
		t.Errorf("kỳ vọng profile của user %s, nhận %s", user.ID, profile.User.ID)
	}
	if profile.User.MemberID == nil || *profile.User.MemberID != linkTestMemberA {
		t.Errorf("kỳ vọng users.member_id = %s, nhận %v", linkTestMemberA, profile.User.MemberID)
	}

	// The persisted user row must carry the link too.
	stored, err := userStore.GetByID(context.Background(), user.ID)
	if err != nil || stored.MemberID == nil || *stored.MemberID != linkTestMemberA {
		t.Errorf("kỳ vọng users.member_id được lưu, nhận %v (err=%v)", stored.MemberID, err)
	}
}

// Task 1.2/1.3 — Rule 3: re-linking the SAME member is an idempotent 200.
func TestLinkMember_Idempotent(t *testing.T) {
	r, userStore, svc := setupLinkMemberRouter(t)
	user, _ := userStore.Create(context.Background(), "Nguyễn Văn Thật", false)
	cookie := linkTestCookie(t, svc, user)

	if w := postMeMember(r, cookie, `{"member_id":"`+linkTestMemberA+`"}`); w.Code != http.StatusOK {
		t.Fatalf("(1) kỳ vọng 200 lần đầu, nhận %d", w.Code)
	}
	w := postMeMember(r, cookie, `{"member_id":"`+linkTestMemberA+`"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("(2) kỳ vọng 200 idempotent, nhận %d. Body: %s", w.Code, w.Body.String())
	}
	var profile auth.UserProfile
	if err := json.Unmarshal(w.Body.Bytes(), &profile); err != nil {
		t.Fatalf("parse profile json thất bại: %v", err)
	}
	if profile.User.MemberID == nil || *profile.User.MemberID != linkTestMemberA {
		t.Errorf("kỳ vọng member_id giữ nguyên, nhận %v", profile.User.MemberID)
	}
}

// Rule 5 / M-D — re-bind to a different unclaimed member releases the old binding.
// Authenticated user already linked to member M1 requests POST /me/member with a
// different unclaimed member M2:
// - HTTP 200
// - user.MemberID == M2
// - M1 is released (unclaimed: GetByMemberID returns nil, another user can now claim M1)
// - M2 is claimed (GetByMemberID returns user, another user claiming M2 gets 409)
func TestLinkMember_Rebind_ReleasesOldMember(t *testing.T) {
	r, userStore, svc := setupLinkMemberRouter(t)
	u1, err := userStore.Create(context.Background(), "Người Dùng 1", false)
	if err != nil {
		t.Fatalf("tạo user 1 thất bại: %v", err)
	}
	u2, err := userStore.Create(context.Background(), "Người Dùng 2", false)
	if err != nil {
		t.Fatalf("tạo user 2 thất bại: %v", err)
	}

	cookie1 := linkTestCookie(t, svc, u1)
	cookie2 := linkTestCookie(t, svc, u2)

	// Step 1: User 1 links to Member A (linkTestMemberA)
	w1 := postMeMember(r, cookie1, `{"member_id":"`+linkTestMemberA+`"}`)
	if w1.Code != http.StatusOK {
		t.Fatalf("kỳ vọng 200 cho user 1 liên kết member A, nhận %d. Body: %s", w1.Code, w1.Body.String())
	}

	// Verify User 1 holds Member A
	holderA, err := userStore.GetByMemberID(context.Background(), linkTestMemberA)
	if err != nil || holderA == nil || holderA.ID != u1.ID {
		t.Fatalf("kỳ vọng user 1 là chủ sở hữu member A, nhận holder=%v err=%v", holderA, err)
	}

	// Step 2: User 1 re-binds to Member B (linkTestMemberB)
	w2 := postMeMember(r, cookie1, `{"member_id":"`+linkTestMemberB+`"}`)
	if w2.Code != http.StatusOK {
		t.Fatalf("kỳ vọng 200 khi user 1 re-bind sang member B, nhận %d. Body: %s", w2.Code, w2.Body.String())
	}

	var profile1 auth.UserProfile
	if err := json.Unmarshal(w2.Body.Bytes(), &profile1); err != nil {
		t.Fatalf("parse profile json thất bại: %v", err)
	}
	if profile1.User.MemberID == nil || *profile1.User.MemberID != linkTestMemberB {
		t.Fatalf("kỳ vọng profile user 1 có member_id = B (%s), nhận %v", linkTestMemberB, profile1.User.MemberID)
	}

	// Verify persisted state: user 1 has Member B
	storedU1, err := userStore.GetByID(context.Background(), u1.ID)
	if err != nil || storedU1.MemberID == nil || *storedU1.MemberID != linkTestMemberB {
		t.Fatalf("kỳ vọng db user 1 có member_id = B, nhận %v (err=%v)", storedU1.MemberID, err)
	}

	// Step 3: Assert Member A is RELEASED (unclaimed)
	holderAAfter, err := userStore.GetByMemberID(context.Background(), linkTestMemberA)
	if err != nil {
		t.Fatalf("lỗi khi tra cứu member A sau re-bind: %v", err)
	}
	if holderAAfter != nil {
		t.Fatalf("kỳ vọng member A được giải phóng (unclaimed), nhưng vẫn bị sở hữu bởi user %s", holderAAfter.ID)
	}

	// Step 4: User 2 can now claim the released Member A without conflict
	w3 := postMeMember(r, cookie2, `{"member_id":"`+linkTestMemberA+`"}`)
	if w3.Code != http.StatusOK {
		t.Fatalf("kỳ vọng user 2 liên kết thành công với member A đã giải phóng, nhận %d. Body: %s", w3.Code, w3.Body.String())
	}
	holderANew, _ := userStore.GetByMemberID(context.Background(), linkTestMemberA)
	if holderANew == nil || holderANew.ID != u2.ID {
		t.Fatalf("kỳ vọng user 2 là chủ mới của member A, nhận %v", holderANew)
	}

	// Step 5: User 2 trying to claim Member B (held by User 1) gets 409 Conflict
	w4 := postMeMember(r, cookie2, `{"member_id":"`+linkTestMemberB+`"}`)
	if w4.Code != http.StatusConflict {
		t.Fatalf("kỳ vọng 409 khi user 2 cố liên kết member B (đã thuộc user 1), nhận %d", w4.Code)
	}
}

// Task 1.2/1.3 — Rule 4 + 23505: a member claimed by another user → 409.
// The pre-check path is exercised here; the idx_users_member_id_unique race
// (pgx SQLSTATE 23505) is proven at the repository seam in
// repository/auth/repos_test.go (TestUserRepo_LinkMember_Maps23505).
func TestLinkMember_Conflict_409(t *testing.T) {
	r, userStore, svc := setupLinkMemberRouter(t)
	u1, _ := userStore.Create(context.Background(), "Người Một", false)
	u2, _ := userStore.Create(context.Background(), "Người Hai", false)

	if w := postMeMember(r, linkTestCookie(t, svc, u1), `{"member_id":"`+linkTestMemberA+`"}`); w.Code != http.StatusOK {
		t.Fatalf("kỳ vọng 200 cho người liên kết đầu tiên, nhận %d", w.Code)
	}

	w := postMeMember(r, linkTestCookie(t, svc, u2), `{"member_id":"`+linkTestMemberA+`"}`)
	if w.Code != http.StatusConflict {
		t.Fatalf("kỳ vọng 409 xung đột thành viên đã có người liên kết, nhận %d. Body: %s", w.Code, w.Body.String())
	}
	var env model.ErrorEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("parse error envelope thất bại: %v", err)
	}
	if env.Success || env.Code != model.CodeConflict {
		t.Errorf("kỳ vọng envelope success=false code=CONFLICT, nhận %+v", env)
	}
	// The losing claim must NOT overwrite the winner's link.
	stored, _ := userStore.GetByID(context.Background(), u2.ID)
	if stored.MemberID != nil {
		t.Errorf("kỳ vọng người thua cuộc không bị ghi liên kết, nhận %v", *stored.MemberID)
	}
}

// Task 1.2/1.3 / M-C — Rule 1: demo accounts are NEVER linkable (403 + code).
// The test uses a NONEXISTENT member_id to assert Rule-1-first ordering:
// demo check must fire BEFORE Rule 2 member existence lookup (returning 403, NOT 404).
func TestLinkMember_DemoIsolation_403(t *testing.T) {
	r, userStore, svc := setupLinkMemberRouter(t)
	demo, _ := userStore.Create(context.Background(), "Tài khoản dùng thử", true)

	w := postMeMember(r, linkTestCookie(t, svc, demo), `{"member_id":"`+linkTestStranger+`"}`)
	if w.Code != http.StatusForbidden {
		t.Fatalf("kỳ vọng 403 cho tài khoản demo, nhận %d. Body: %s", w.Code, w.Body.String())
	}
	var env model.ErrorEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("parse error envelope thất bại: %v", err)
	}
	if env.Code != model.CodeDemoIsolationViolation {
		t.Errorf("kỳ vọng code DEMO_ISOLATION_VIOLATION, nhận %s", env.Code)
	}
	// Rule 1 fires before anything else — no link may be written.
	stored, _ := userStore.GetByID(context.Background(), demo.ID)
	if stored.MemberID != nil {
		t.Errorf("kỳ vọng demo không được ghi liên kết, nhận %v", *stored.MemberID)
	}
}

// Task 1.3 — no JWT cookie → 401 (middleware seam).
func TestLinkMember_Unauthenticated(t *testing.T) {
	r, _, _ := setupLinkMemberRouter(t)

	w := postMeMember(r, nil, `{"member_id":"`+linkTestMemberA+`"}`)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("kỳ vọng 401 khi chưa đăng nhập, nhận %d", w.Code)
	}
	var env model.ErrorEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("parse error envelope thất bại: %v", err)
	}
	if env.Code != model.CodeUnauthorized {
		t.Errorf("kỳ vọng code UNAUTHORIZED, nhận %s", env.Code)
	}
}

// Task 1.2/1.3 — Rule 2: unknown member_id → 404.
func TestLinkMember_InvalidMember(t *testing.T) {
	r, userStore, svc := setupLinkMemberRouter(t)
	user, _ := userStore.Create(context.Background(), "Nguyễn Văn Thật", false)

	w := postMeMember(r, linkTestCookie(t, svc, user), `{"member_id":"`+linkTestStranger+`"}`)
	if w.Code != http.StatusNotFound {
		t.Fatalf("kỳ vọng 404 khi thành viên không tồn tại, nhận %d. Body: %s", w.Code, w.Body.String())
	}
	var env model.ErrorEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &env); err != nil {
		t.Fatalf("parse error envelope thất bại: %v", err)
	}
	if env.Code != model.CodeNotFound {
		t.Errorf("kỳ vọng code NOT_FOUND, nhận %s", env.Code)
	}

	// Malformed body (nil member_id reserved for future unlink) → 400.
	w2 := postMeMember(r, linkTestCookie(t, svc, user), `{}`)
	if w2.Code != http.StatusBadRequest {
		t.Errorf("kỳ vọng 400 khi thiếu member_id, nhận %d", w2.Code)
	}
}

// M4 / INV-01 — MemberInput.AvatarURL accepts ONLY bundled /static/avatars/
// paths on Create AND Update; external URLs are rejected with 400.
func TestMemberAvatarURLValidation(t *testing.T) {
	r, _, _, _ := setupTestRouter()

	post := func(body string) *httptest.ResponseRecorder {
		req, _ := http.NewRequest("POST", "/api/v1/members", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "http://localhost:3456")
		req.AddCookie(&http.Cookie{Name: "cgp_session", Value: "valid-token-123"})
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}

	// External https:// URL → 400 (SSRF / IP-leak guard).
	w := post(`{"family_id":"fam-1","full_name":"Nguyễn Văn Xấu","gender":"nam","avatar_url":"https://evil.example.com/a.png"}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("kỳ vọng 400 cho avatar_url ngoài, nhận %d. Body: %s", w.Code, w.Body.String())
	}

	// Non-avatar path → 400.
	w2 := post(`{"family_id":"fam-1","full_name":"Nguyễn Văn Xấu","gender":"nam","avatar_url":"/uploads/a.png"}`)
	if w2.Code != http.StatusBadRequest {
		t.Fatalf("kỳ vọng 400 cho đường dẫn không phải /static/avatars/, nhận %d", w2.Code)
	}

	// Conforming bundled path → 201.
	w3 := post(`{"family_id":"fam-1","full_name":"Nguyễn Văn Đẹp","gender":"nam","avatar_url":"/static/avatars/avatar-m1.svg"}`)
	if w3.Code != http.StatusCreated {
		t.Fatalf("kỳ vọng 201 cho avatar_url hợp lệ, nhận %d. Body: %s", w3.Code, w3.Body.String())
	}
	var created model.Member
	if err := json.Unmarshal(w3.Body.Bytes(), &created); err != nil {
		t.Fatalf("parse member json thất bại: %v", err)
	}

	// Update with a bad avatar → 400.
	reqUpd, _ := http.NewRequest("PUT", "/api/v1/members/"+created.ID, bytes.NewBufferString(`{"full_name":"Nguyễn Văn Đẹp","gender":"nam","avatar_url":"http://tracker.vn/x.webp"}`))
	reqUpd.Header.Set("Content-Type", "application/json")
	reqUpd.Header.Set("Origin", "http://localhost:3456")
	reqUpd.AddCookie(&http.Cookie{Name: "cgp_session", Value: "valid-token-123"})
	wUpd := httptest.NewRecorder()
	r.ServeHTTP(wUpd, reqUpd)
	if wUpd.Code != http.StatusBadRequest {
		t.Fatalf("kỳ vọng 400 cho update avatar_url ngoài, nhận %d", wUpd.Code)
	}
}
