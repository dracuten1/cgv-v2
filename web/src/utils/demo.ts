import type { Member } from '@/types/api';

/**
 * Quick-demo pair for the kinship calculator (mockup 04 / spec §6.4):
 * "Ông → Cháu nội" — Nguyễn Văn An → Nguyễn Văn Bình. Mirrors the backend's
 * auto-seeded demo family, so on a live deployment these ids resolve to real
 * members and the synthetic records below are never used.
 *
 * Isolation contract: synthetic records must NEVER be pushed into the shared
 * API-fetched member list (that leaked mock rows into live member search for
 * the whole session — fixed in tidier pass 1). They exist only in the view's
 * isolated demo ref and are derived, never accumulated.
 */

export const DEMO_ROOT_ID = 'aaaaaaa1-0000-4000-8000-000000000001'; // Nguyễn Văn An
export const DEMO_GRANDSON_ID = 'bbbbbbb2-0000-4000-8000-000000000002'; // Nguyễn Văn Bình

const DEMO_FAMILY_ID = '11111111-1111-4111-8111-000000000001';

function demoRecord(
  id: string,
  fullName: string,
  generationIndex: number,
  isLiving: boolean
): Member {
  return {
    id,
    family_id: DEMO_FAMILY_ID,
    full_name: fullName,
    gender: 'male',
    generation_index: generationIndex,
    is_living: isLiving,
    created_at: new Date().toISOString(),
  };
}

export function buildDemoPairRecords(): Member[] {
  return [
    demoRecord(DEMO_ROOT_ID, 'Nguyễn Văn An', 1, false),
    demoRecord(DEMO_GRANDSON_ID, 'Nguyễn Văn Bình', 3, true),
  ];
}

/** Demo pair records the given list does not already contain. */
export function getMissingDemoRecords(members: Member[]): Member[] {
  const present = new Set(members.map((m) => m.id));
  return buildDemoPairRecords().filter((record) => !present.has(record.id));
}
