package push_test

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/feed"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/dracuten1/cgv-v2/api/internal/push"
)

// NOTE: stdlib-only tests — go.mod/go.sum are frozen and testify's transitive
// module hashes are absent from go.sum (same convention as the foundation
// layer's tests).

// ---- fakes ---------------------------------------------------------------

// fakeOutbox is an in-memory outbox_events table.
type fakeOutbox struct {
	pending []model.OutboxEvent
	marked  [][]string
}

func (f *fakeOutbox) FetchPending(ctx context.Context, limit int) ([]model.OutboxEvent, error) {
	if len(f.pending) <= limit {
		return append([]model.OutboxEvent(nil), f.pending...), nil
	}
	return append([]model.OutboxEvent(nil), f.pending[:limit]...), nil
}

func (f *fakeOutbox) MarkProcessed(ctx context.Context, ids []string) error {
	f.marked = append(f.marked, append([]string(nil), ids...))
	kept := f.pending[:0]
	for _, ev := range f.pending {
		drop := false
		for _, id := range ids {
			if ev.ID == id {
				drop = true
				break
			}
		}
		if !drop {
			kept = append(kept, ev)
		}
	}
	f.pending = kept
	return nil
}

func (f *fakeOutbox) add(id, topic string, payload any) {
	raw, _ := json.Marshal(payload)
	f.pending = append(f.pending, model.OutboxEvent{ID: id, Topic: topic, Payload: raw})
}

func (f *fakeOutbox) isPending(id string) bool {
	for _, ev := range f.pending {
		if ev.ID == id {
			return true
		}
	}
	return false
}

// fakePushRepo is an in-memory push_subscriptions table keyed by family.
type fakePushRepo struct {
	byFamily map[string][]model.PushSubscription
	deleted  []string
}

func (f *fakePushRepo) Upsert(ctx context.Context, sub model.PushSubscription) error { return nil }

func (f *fakePushRepo) DeleteByEndpoint(ctx context.Context, endpoint string) error {
	f.deleted = append(f.deleted, endpoint)
	for fam, subs := range f.byFamily {
		kept := subs[:0]
		for _, s := range subs {
			if s.Endpoint != endpoint {
				kept = append(kept, s)
			}
		}
		f.byFamily[fam] = kept
	}
	return nil
}

func (f *fakePushRepo) ListForFamily(ctx context.Context, familyID string) ([]model.PushSubscription, error) {
	return append([]model.PushSubscription(nil), f.byFamily[familyID]...), nil
}

// fakeSender records Send calls; failures can be programmed per endpoint.
type fakeSender struct {
	calls    []model.PushSubscription
	payloads [][]byte
	failPerm map[string]error // endpoint → permanent error
	failAllN int              // fail the first N Send calls overall (generic error)
}

func (f *fakeSender) Send(ctx context.Context, sub model.PushSubscription, payload []byte) error {
	f.calls = append(f.calls, sub)
	f.payloads = append(f.payloads, payload)
	if f.failAllN > 0 {
		f.failAllN--
		return errors.New("mạng chập chờn")
	}
	if err, ok := f.failPerm[sub.Endpoint]; ok {
		return err
	}
	return nil
}

// fakeMailer records SendMail calls.
type fakeMailer struct {
	mails []recordedMail
	err   error
}

type recordedMail struct{ to, subject, body string }

func (f *fakeMailer) SendMail(ctx context.Context, to, subject, body string) error {
	if f.err != nil {
		return f.err
	}
	f.mails = append(f.mails, recordedMail{to, subject, body})
	return nil
}

// helpers --------------------------------------------------------------------

func newWorker(outbox *fakeOutbox, repo *fakePushRepo, sender push.Sender, mailer push.Mailer) *push.Worker {
	return push.NewWorker(nil, outbox, repo, sender, mailer,
		slog.New(slog.NewTextHandler(&strings.Builder{}, nil)),
		push.WithBackoff(0), // retry backoff short-circuited: no sleeping in tests
		push.WithSleeper(func(ctx context.Context, d time.Duration) {}),
	)
}

func sub(endpoint string) model.PushSubscription {
	return model.PushSubscription{
		ID:       "sub-" + endpoint,
		UserID:   "user-1",
		Endpoint: endpoint,
		P256DH:   "BNo5MrN8AqX2vQvDmLjmJLwqQWkCEV2ciXGU1W6y2bV0ZJMDUOVJYvLfb9aOZf+D6xSanBmH8LUsFTjWmrXuNk",
		Auth:     "aBcDeFgHiJkLmNoP",
	}
}

// ---- drainer dispatch matrix ------------------------------------------------

// feed.created with N family subscribers → exactly N sends, event processed.
// The payload is marshaled from feed.FeedCreatedPayload to prove the
// producer/consumer JSON contract between the two packages.
func TestWorker_FeedCreated_FansOutToAllSubscribers(t *testing.T) {
	outbox := &fakeOutbox{}
	repo := &fakePushRepo{byFamily: map[string][]model.PushSubscription{
		"family-1": {sub("https://push.example/a"), sub("https://push.example/b"), sub("https://push.example/c")},
	}}
	sender := &fakeSender{}
	mailer := &fakeMailer{}
	w := newWorker(outbox, repo, sender, mailer)

	outbox.add("ev-1", model.TopicFeedCreated, feed.FeedCreatedPayload{
		FamilyID: "family-1",
		PostID:   "post-9",
		Author:   "Trần Thị B",
		Preview:  "Chúc cả nhà buổi tối an lành",
	})

	w.DrainOnce(context.Background())

	if len(sender.calls) != 3 {
		t.Fatalf("expected 3 push sends, got %d", len(sender.calls))
	}
	if len(mailer.mails) != 0 {
		t.Fatalf("feed event must not send mail, got %d", len(mailer.mails))
	}
	if outbox.isPending("ev-1") {
		t.Fatal("feed event must be marked processed after successful fanout")
	}

	// Browser notification payload carries the family/post ids and preview.
	var notif push.PushPayload
	if err := json.Unmarshal(sender.payloads[0], &notif); err != nil {
		t.Fatalf("notification payload invalid JSON: %v", err)
	}
	if notif.FamilyID != "family-1" || notif.PostID != "post-9" {
		t.Fatalf("notification payload ids wrong: %+v", notif)
	}
	if !strings.Contains(notif.Body, "Trần Thị B") || !strings.Contains(notif.Body, "Chúc cả nhà buổi tối an lành") {
		t.Fatalf("notification body missing author/preview: %q", notif.Body)
	}
}

// magic_link.send → exactly one email whose body contains the link from the
// payload (cross-coder contract with the auth sibling).
func TestWorker_MagicLink_SendsMailWithLink(t *testing.T) {
	outbox := &fakeOutbox{}
	repo := &fakePushRepo{byFamily: map[string][]model.PushSubscription{}}
	sender := &fakeSender{}
	mailer := &fakeMailer{}
	w := newWorker(outbox, repo, sender, mailer)

	link := "https://cgp.example/api/v1/auth/email/verify?token=abc123"
	outbox.add("ev-2", model.TopicMagicLink, push.MagicLinkPayload{Email: "ba@example.com", Link: link})

	w.DrainOnce(context.Background())

	if len(mailer.mails) != 1 {
		t.Fatalf("expected exactly 1 mail, got %d", len(mailer.mails))
	}
	m := mailer.mails[0]
	if m.to != "ba@example.com" {
		t.Fatalf("mail to = %q", m.to)
	}
	if m.subject != push.MagicLinkSubject {
		t.Fatalf("mail subject = %q, want %q", m.subject, push.MagicLinkSubject)
	}
	if !strings.Contains(m.body, link) {
		t.Fatalf("mail body must contain the magic link, got:\n%s", m.body)
	}
	if !strings.Contains(m.body, "Cây Gia Phả") {
		t.Fatalf("mail body must contain Vietnamese instructions, got:\n%s", m.body)
	}
	if len(sender.calls) != 0 {
		t.Fatalf("magic-link event must not push, got %d sends", len(sender.calls))
	}
	if outbox.isPending("ev-2") {
		t.Fatal("magic-link event must be marked processed")
	}
}

// 410 on one subscriber → endpoint pruned, remaining subscribers still get
// the notification, and the event completes.
func TestWorker_FeedCreated_Gone410_PrunesAndContinues(t *testing.T) {
	dead := sub("https://push.example/dead")
	live := sub("https://push.example/live")
	outbox := &fakeOutbox{}
	repo := &fakePushRepo{byFamily: map[string][]model.PushSubscription{
		"family-1": {dead, live},
	}}
	sender := &fakeSender{failPerm: map[string]error{
		"https://push.example/dead": push.ErrSubscriptionGone,
	}}
	mailer := &fakeMailer{}
	w := newWorker(outbox, repo, sender, mailer)

	outbox.add("ev-3", model.TopicFeedCreated, feed.FeedCreatedPayload{FamilyID: "family-1", PostID: "p", Author: "A", Preview: "x"})

	w.DrainOnce(context.Background())

	if len(repo.deleted) != 1 || repo.deleted[0] != "https://push.example/dead" {
		t.Fatalf("dead endpoint must be deleted, got %v", repo.deleted)
	}
	if len(sender.calls) != 2 {
		t.Fatalf("both subscribers must be attempted, got %d sends", len(sender.calls))
	}
	if outbox.isPending("ev-3") {
		t.Fatal("event must complete after pruning dead endpoints")
	}
	if remaining := repo.byFamily["family-1"]; len(remaining) != 1 || remaining[0].Endpoint != "https://push.example/live" {
		t.Fatalf("live subscription must remain: %+v", remaining)
	}
}

// Sender fails for every subscriber on every attempt → event stays
// unprocessed (retried next tick), and the other event in the same batch
// still proceeds.
func TestWorker_FeedCreated_AllFail_StaysPending_OthersProceed(t *testing.T) {
	outbox := &fakeOutbox{}
	repo := &fakePushRepo{byFamily: map[string][]model.PushSubscription{
		"family-1": {sub("https://push.example/a")},
	}}
	sender := &fakeSender{failAllN: 3} // fails all 3 attempts of event ev-4
	mailer := &fakeMailer{}
	w := newWorker(outbox, repo, sender, mailer)

	outbox.add("ev-4", model.TopicFeedCreated, feed.FeedCreatedPayload{FamilyID: "family-1", PostID: "p", Author: "A", Preview: "x"})
	outbox.add("ev-5", model.TopicMagicLink, push.MagicLinkPayload{Email: "x@example.com", Link: "https://cgp.example/verify?token=z"})

	w.DrainOnce(context.Background())

	// ev-4 exhausted its 3 attempts (1 initial + 2 retries).
	if len(sender.calls) != 3 {
		t.Fatalf("expected 3 attempts against the failing subscriber, got %d", len(sender.calls))
	}
	if !outbox.isPending("ev-4") {
		t.Fatal("fully failing event must stay unprocessed for redelivery")
	}
	// ev-5 proceeded within the same batch.
	if len(mailer.mails) != 1 {
		t.Fatalf("one event failing must not kill the batch: mails = %d", len(mailer.mails))
	}
	if outbox.isPending("ev-5") {
		t.Fatal("the healthy event must be marked processed")
	}

	// Next tick: sender recovered → the pending event redelivers & completes.
	w.DrainOnce(context.Background())
	if outbox.isPending("ev-4") {
		t.Fatal("recovered redelivery must complete the pending event")
	}
}

// Unknown topic → logged, marked processed (poison-pill guard), batch lives.
func TestWorker_UnknownTopic_PoisonPillMarkedProcessed(t *testing.T) {
	outbox := &fakeOutbox{}
	repo := &fakePushRepo{byFamily: map[string][]model.PushSubscription{}}
	sender := &fakeSender{}
	mailer := &fakeMailer{}
	w := newWorker(outbox, repo, sender, mailer)

	outbox.add("ev-6", "aliens.landed", map[string]string{"x": "y"})
	outbox.add("ev-7", model.TopicMagicLink, push.MagicLinkPayload{Email: "x@example.com", Link: "https://cgp.example/v?t=1"})

	w.DrainOnce(context.Background())

	if outbox.isPending("ev-6") {
		t.Fatal("unknown-topic event must be marked processed (poison-pill guard)")
	}
	// The unknown topic dispatched nothing itself…
	if len(sender.calls) != 0 {
		t.Fatalf("unknown topic must not push, got %d sends", len(sender.calls))
	}
	// …while its healthy sibling completed normally (1 mail, no longer pending).
	if len(mailer.mails) != 1 {
		t.Fatalf("sibling event must still proceed: mails = %d", len(mailer.mails))
	}
	if outbox.isPending("ev-7") {
		t.Fatal("sibling event must be marked processed")
	}
}

// Malformed payload of a KNOWN topic retries then stays pending — never a
// silent success, but also never a crash.
func TestWorker_MalformedKnownPayload_StaysPending(t *testing.T) {
	outbox := &fakeOutbox{}
	repo := &fakePushRepo{byFamily: map[string][]model.PushSubscription{}}
	sender := &fakeSender{}
	mailer := &fakeMailer{}
	w := newWorker(outbox, repo, sender, mailer)

	outbox.pending = append(outbox.pending, model.OutboxEvent{
		ID:      "ev-8",
		Topic:   model.TopicMagicLink,
		Payload: json.RawMessage(`{broken`),
	})

	w.DrainOnce(context.Background())

	if !outbox.isPending("ev-8") {
		t.Fatal("malformed known-topic payload must stay pending for ops inspection")
	}
}

// Run stops gracefully on ctx cancellation and returns the context error.
func TestWorker_Run_GracefulStop(t *testing.T) {
	outbox := &fakeOutbox{}
	repo := &fakePushRepo{byFamily: map[string][]model.PushSubscription{}}
	w := newWorker(outbox, repo, &fakeSender{}, &fakeMailer{})

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- w.Run(ctx) }()
	cancel()

	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("Run err = %v, want context.Canceled", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not stop after cancellation")
	}
}
