/**
 * Pure visual helpers shared by TreeNodeCard (tree renderer) and
 * MemberCardPreview (edit dialog live preview). Pure functions → jsdom-testable.
 */

/** "Nguyễn Văn An" → "VA"; single-word names → first 2 letters. */
export function getInitials(fullName: string): string {
  const parts = (fullName || '').trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  const last = parts[parts.length - 1];
  const prev = parts[parts.length - 2];
  return (prev[0] + last[0]).toUpperCase();
}

/** ("1930-04-12", "2001-08-30") → "1930 – 2001"; ("1930-…", null) → "1930". */
export function getYearsText(
  birthDate?: string | null,
  deathDate?: string | null
): string {
  const bYear = birthDate ? birthDate.substring(0, 4) : '';
  const dYear = deathDate ? deathDate.substring(0, 4) : '';

  if (bYear && dYear) return `${bYear} – ${dYear}`;
  if (bYear) return bYear;
  if (dYear) return `– ${dYear}`;
  return '';
}

/** Generation accent CSS var, cycles --gen-1..--gen-4 via modulo. */
export function genAccentVar(generationIndex: number): string {
  return `--gen-${((generationIndex - 1) % 4) + 1}`;
}

/** Generation soft/background CSS var, cycles via modulo. */
export function genSoftVar(generationIndex: number): string {
  return `--gen-${((generationIndex - 1) % 4) + 1}-soft`;
}
