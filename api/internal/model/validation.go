package model

import (
	"fmt"
	"regexp"
)

// AvatarURLPattern enforces INV-01 (self-hosted assets only, MUST-FIX M4):
// avatar_url must be a bundled /static/avatars/ path — external URLs
// are rejected (SSRF / IP-leak guard) with 400.
const AvatarURLPattern = `^/static/avatars/[A-Za-z0-9_-]+\.(png|svg|webp|jpg)$`

// AvatarURLRegex is the compiled regular expression matching AvatarURLPattern.
var AvatarURLRegex = regexp.MustCompile(AvatarURLPattern)

// ValidateAvatarURL rejects non-conforming avatar_url values.
// An absent (nil) or empty value is legal (clears or leaves avatar unset).
func ValidateAvatarURL(avatarURL *string) error {
	if avatarURL == nil || *avatarURL == "" {
		return nil
	}
	if !AvatarURLRegex.MatchString(*avatarURL) {
		return fmt.Errorf("đường dẫn ảnh đại diện không hợp lệ: chỉ chấp nhận /static/avatars/<tên>.(png|svg|webp|jpg)")
	}
	return nil
}
