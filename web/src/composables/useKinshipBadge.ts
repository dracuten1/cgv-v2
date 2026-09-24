/**
 * useKinshipBadge (Phase 1, M5 — Decision 2C "Lexicon Gaps & Term Mapping").
 *
 * The backend kinship engine returns CANONICAL Vietnamese terms
 * ("Bản thân", "Ông nội", "Con trai", …). The tree UI renders compact
 * badges ("Tôi", "Nội", "Con", …) while card tooltips keep the full term.
 *
 * Pure mapping — no reactivity, no API, no state: trivially unit-testable.
 */

/** Canonical term → compact display badge (exact-match lookup). */
const KINSHIP_BADGE_MAP: Record<string, string> = {
  'Bản thân': 'Tôi',

  'Ông nội': 'Nội',
  'Bà nội': 'Nội',
  'Ông ngoại': 'Ngoại',
  'Bà ngoại': 'Ngoại',

  'Con trai': 'Con',
  'Con gái': 'Con',
  'Con rể': 'Con',
  'Con dâu': 'Con',

  'Cháu nội': 'Cháu',
  'Cháu ngoại': 'Cháu',
};

/**
 * Abbreviate a canonical kinship term to its display badge.
 * Unknown terms pass through unchanged so the UI never renders empty.
 */
export function kinshipBadge(term: string | null | undefined): string {
  if (!term) return '';
  return KINSHIP_BADGE_MAP[term] ?? term;
}

/**
 * Format a canonical kinship term into { badge, full }.
 * Maps canonical terms to short badges ("Bản thân" → "Tôi", "Ông nội" → "Nội", etc.)
 * while preserving the full term for tooltips and accessibility.
 */
export function formatKinshipBadge(canonicalTerm?: string | null): { badge: string; full: string } {
  if (!canonicalTerm) {
    return { badge: '', full: '' };
  }
  return {
    badge: kinshipBadge(canonicalTerm),
    full: canonicalTerm,
  };
}

/**
 * Composable seam for components (keeps the import surface stable if the
 * mapping later grows per-dialect variants).
 */
export function useKinshipBadge() {
  return {
    badge: kinshipBadge,
    format: formatKinshipBadge,
  };
}
