/**
 * Generates initials for avatar fallbacks.
 * First + last word initials (e.g. "Nguyễn Văn An" -> "NA", "An" -> "AN").
 * If card-visual.ts uses last two words for tree cards ("VA"),
 * this general helper uses first + last word per §4.9 ("NA").
 */
export function getNameInitials(fullName: string): string {
  const parts = (fullName || '').trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  const first = parts[0];
  const last = parts[parts.length - 1];
  return (first[0] + last[0]).toUpperCase();
}
