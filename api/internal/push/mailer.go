package push

import (
	"context"
	"fmt"
	"net/smtp"
	"strings"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/config"
)

// Email tuning constants (magic-link delivery, ADR-010 topic magic_link.send).
const (
	// SMTPSendTimeout bounds one SMTP transaction.
	SMTPSendTimeout = 5 * time.Second
	// MagicLinkSubject is the Vietnamese subject line of the magic-link email.
	MagicLinkSubject = "Liên kết đăng nhập Cây Gia Phả"
)

// SMTPMailer sends email through a plain SMTP server (stdlib net/smtp).
// Uses STARTTLS when the server advertises it; plain auth is attached only
// when credentials are configured.
type SMTPMailer struct {
	host string
	port int
	user string
	pass string
	from string
}

// NewSMTPMailer builds an SMTPMailer from configuration.
func NewSMTPMailer(cfg *config.Config) *SMTPMailer {
	return &SMTPMailer{
		host: cfg.SMTPHost,
		port: cfg.SMTPPort,
		user: cfg.SMTPUser,
		pass: cfg.SMTPPass,
		from: cfg.SMTPFrom,
	}
}

// Configured reports whether an SMTP host is present. When false, SendMail
// short-circuits with ErrSMTPNotConfigured (dev/demo mode without email).
func (m *SMTPMailer) Configured() bool { return m.host != "" }

// SendMail delivers one email. to is a single address; subject and body are
// UTF-8 (Vietnamese). The magic-link body is expected to contain the clickable
// link — callers pass the link inside body (see Worker.handleMagicLink).
func (m *SMTPMailer) SendMail(ctx context.Context, to, subject, body string) error {
	if !m.Configured() {
		return ErrSMTPNotConfigured
	}
	from := m.from
	if from == "" {
		from = m.user
	}

	sendCtx, cancel := context.WithTimeout(ctx, SMTPSendTimeout)
	defer cancel()

	addr := fmt.Sprintf("%s:%d", m.host, m.port)

	var auth smtp.Auth
	if m.user != "" {
		auth = smtp.PlainAuth("", m.user, m.pass, m.host)
	}

	headers := map[string]string{
		"From":         from,
		"To":           to,
		"Subject":      subject,
		"MIME-Version": "1.0",
		"Content-Type": `text/plain; charset="UTF-8"`,
	}
	var msg strings.Builder
	for k, v := range headers {
		fmt.Fprintf(&msg, "%s: %s\r\n", k, v)
	}
	msg.WriteString("\r\n")
	msg.WriteString(body)

	// Run the blocking SMTP exchange under the context deadline via a
	// goroutine + channel (net/smtp has no context-aware API). smtp.SendMail
	// negotiates STARTTLS automatically when the server advertises it.
	errCh := make(chan error, 1)
	go func() {
		errCh <- smtp.SendMail(addr, auth, from, []string{to}, []byte(msg.String()))
	}()

	select {
	case <-sendCtx.Done():
		return fmt.Errorf("hết thời gian gửi thư đến %s: %w", to, sendCtx.Err())
	case err := <-errCh:
		if err != nil {
			return fmt.Errorf("không thể gửi thư đến %s: %w", to, err)
		}
		return nil
	}
}
