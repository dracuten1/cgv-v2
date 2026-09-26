# CGP v2 — UI Redesign (concept + mockups)

Extends the approved `/tree` "Warm Heritage" design language to the whole app.
**No application source was modified** — this folder is design deliverables only.

## Contents

| Path | What |
|---|---|
| `design-system.md` | The spec: consolidated tokens (terracotta ramp, gen pastels, semantic hues), typography (Fraunces / Be Vietnam Pro), component formulas, icon inventory, per-screen recipes |
| `mockups/index.html` | Gallery — links to all 6 screen mockups + token strip |
| `mockups/01-login.html` | Login reskin (desktop + mobile, incl. notice states) |
| `mockups/02-auth-interstitials.html` | Shared auth interstitial: working / success / error |
| `mockups/03-notfound.html` | Themed 404 "nhánh lìa cây" |
| `mockups/04-kinship.html` | Kinship: avatar comboboxes + result timeline |
| `mockups/05-member-detail.html` | Member detail: photo avatars, relations, posts tab |
| `mockups/06-feed-composer.html` | Feed composer + anonymous state + PostCard |
| `mockups/mockup-fonts.css` | Fraunces + Be Vietnam Pro embedded as base64 woff2 (latin + vietnamese subsets) — mockups render the real fonts, no CDN fonts |

## Previewing

The mockups are fully static. Either open `mockups/index.html` directly in a browser
(`file://` works), or serve the folder:

```bash
cd .agents/shared/planning/ui-redesign
python3 -m http.server 8799 --bind 127.0.0.1
# → http://127.0.0.1:8799/mockups/
```

(Tailwind CDN is loaded by the mockups and needs internet; fonts do not — they're embedded.)

## Constraints honored

- Vietnamese diacritics: line-height floors 1.45 (display) / 1.6 (body) everywhere, incl. `text-[10px]` badges (inline `style="line-height:1.45"`).
- Demo affordances are always **amber**, never terracotta (INV-04).
- PWA identity unchanged: `#C85A32` on `#FDFBF7`.
- Implementation stays Tailwind 4.1 utility-first with the `@theme` tokens in `web/src/assets/main.css`; only new token proposed: `--color-terracotta-border: #F4D0C2`.

## Suggested implementation order

tokens/cleanup → shared `AuthInterstitial` + 404 → Login → Kinship picker → Member detail → Feed composer (see design-system.md §7).
