/**
 * TV-* static tree fixtures — Phase 1 baseline (branch feature/tree-view-redesign@a1226ff).
 *
 * PURE TEST DATA ONLY. No production code is imported beyond shared types.
 * These fixtures back the P1 clause-test map (phase1-clause-test-map.md) and the
 * P2–P5 phase plans (phase2-plan.md … phase5-plan.md, fixture IDs TV-ROOT,
 * TV-CHILDLESS, TV-WIDE8, TV-DEEP6, TV-DENSE300, TV-CULLED-FOCUS, TV-REFLOW,
 * TV-LOD-BOUNDARY, TV-ORIENTATION).
 *
 * Rationale (per phase1-plan.md §Activities 5): narrow/deep covers >4 generations,
 * wide covers sibling-overflow and reveal chip, dense300 stresses budget bounds,
 * and the boundary cases cover edge/empty/lonely states without DB mutation.
 */
import type { GenerationMeta, Gender, TreeNode } from '@/types/api';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Recursively count every node (including roots) in a fixture forest. */
export function countTreeNodes(roots: TreeNode[]): number {
  return roots.reduce(
    (sum, r) => sum + 1 + countTreeNodes(r.children ?? []),
    0
  );
}

function member(
  id: string,
  fullName: string,
  gender: Gender,
  gen: number,
  birth: string,
  opts: Partial<Pick<TreeNode, 'is_living' | 'death_date' | 'avatar_url' | 'spouse_ids' | 'children'>> = {}
): TreeNode {
  return {
    id,
    full_name: fullName,
    gender,
    generation_index: gen,
    birth_date: birth,
    is_living: opts.is_living ?? true,
    death_date: opts.death_date ?? null,
    avatar_url: opts.avatar_url,
    spouse_ids: opts.spouse_ids ?? [],
    children: opts.children ?? [],
  };
}

// ─── TV-ROOT : single root, no children, no spouse ─────────────────────────

/** Minimal non-empty tree: one lonely root, 0 children, 0 spouses. */
export const TV_ROOT: TreeNode = member('tv-root-1', 'Nguyễn Văn Tổ', 'male', 1, '1920-01-01', {
  is_living: false,
  death_date: '2001-12-31',
});
export const TV_ROOT_ROOTS: TreeNode[] = [TV_ROOT];
export const TV_ROOT_GENERATIONS: GenerationMeta[] = [
  { index: 1, label: 'Đời thứ 1', count: 1 },
];

// ─── TV-CHILDLESS : root couple with no children ────────────────────────────

/** Root couple (married) with zero children — childless-anchor case. */
export const TV_CHILDLESS_HUSBAND = member('tv-cl-hus', 'Trần Văn Childless', 'male', 1, '1935-03-10', {
  spouse_ids: ['tv-cl-wife'],
});
export const TV_CHILDLESS_WIFE = member('tv-cl-wife', 'Lê Thị Childless', 'female', 1, '1938-07-22');
export const TV_CHILDLESS_ROOTS: TreeNode[] = [TV_CHILDLESS_HUSBAND, TV_CHILDLESS_WIFE];
export const TV_CHILDLESS_GENERATIONS: GenerationMeta[] = [
  { index: 1, label: 'Đời thứ 1', count: 2 },
];

// ─── TV-WIDE8 : 1 anchor couple + 8 single childless children ──────────────

/**
 * Wide-sibling fixture mirroring the anchor-frame worst case from the design
 * spec §B: 8 single childless children squeeze the horizontal budget. Used to
 * verify the `+N thành viên khác` reveal chip and roster.
 */
function makeWide8Children(): TreeNode[] {
  return Array.from({ length: 8 }, (_, i) =>
    member(`tv-w8-c${i + 1}`, `Nguyễn Văn Con ${i + 1}`, i % 2 === 0 ? 'male' : 'female', 2, `19${60 + i}-06-15`)
  );
}
export const TV_WIDE8_ROOT = member('tv-w8-r', 'Nguyễn Văn Cha', 'male', 1, '1935-01-01', {
  spouse_ids: ['tv-w8-m'],
  children: makeWide8Children(),
});
export const TV_WIDE8_MOTHER = member('tv-w8-m', 'Trần Thị Mẹ', 'female', 1, '1937-02-02');
export const TV_WIDE8_ROOTS: TreeNode[] = [TV_WIDE8_ROOT, TV_WIDE8_MOTHER];
export const TV_WIDE8_GENERATIONS: GenerationMeta[] = [
  { index: 1, label: 'Đời thứ 1', count: 2 },
  { index: 2, label: 'Đời thứ 2', count: 8 },
];
/** Exactly 8 wide siblings (≥ 8 required by spec). */
export const TV_WIDE8_SIBLING_COUNT = 8;

// ─── TV-DEEP6 : 6 generations, single-line narrow/deep chain ────────────────

/** Narrow + deep (>4 generations) fixture — 6-generation single-line lineage. */
function makeDeep6Chain(): TreeNode {
  const givenNames = ['Cố', 'Phú', 'Trung', 'Hạ', 'Đẩu', 'Trẻ'] as const;
  let child: TreeNode | undefined;
  for (let gen = 6; gen >= 1; gen--) {
    child = member(
      `tv-d6-g${gen}`,
      `Nguyễn Văn ${givenNames[gen - 1]}`,
      gen % 2 === 1 ? 'male' : 'female',
      gen,
      `${1890 + gen * 22}-05-05`,
      { is_living: gen === 6, children: child ? [child] : [] }
    );
  }
  return child as TreeNode;
}
export const TV_DEEP6_ROOT: TreeNode = makeDeep6Chain();
export const TV_DEEP6_ROOTS: TreeNode[] = [TV_DEEP6_ROOT];
export const TV_DEEP6_GENERATIONS: GenerationMeta[] = Array.from({ length: 6 }, (_, i) => ({
  index: i + 1,
  label: `Đời thứ ${i + 1}`,
  count: 1,
}));
export const TV_DEEP6_GENERATION_COUNT = 6;

// ─── TV-DENSE300 : exactly 300 nodes across 5 generations ───────────────────

/**
 * Dense fixture hitting exactly 300 nodes (MAX_VISIBLE_NODES budget ceiling).
 * Shape: 2 roots → 8 children → 40 grandchildren → 240 great-grandchildren →
 * 10 fourth-gen leaves (first 10 of gen-4 each get 1 child).
 */
function makeDense300(): TreeNode {
  const gen4: TreeNode[] = [];
  for (let g3 = 0; g3 < 40; g3++) {
    for (let g4 = 0; g4 < 6; g4++) {
      gen4.push(
        member(`tv-d300-g4-${g3}-${g4}`, `Nguyễn Văn Chắt ${g3}-${g4}`, g4 % 2 === 0 ? 'male' : 'female', 4, '1980-08-08')
      );
    }
  }
  // First 10 of gen-4 get one gen-5 child each → exactly 300 nodes total.
  gen4.slice(0, 10).forEach((n, i) => {
    n.children = [member(`tv-d300-g5-${i}`, `Nguyễn Văn Chít ${i}`, 'male', 5, '2010-11-11')];
  });
  // gen-3: 40 nodes; gen3[j] links gen4 slice [j*6, j*6+6) → 40×6 = 240 reachable.
  const gen3: TreeNode[] = [];
  for (let j = 0; j < 40; j++) {
    gen3.push(
      member(`tv-d300-g3-${j}`, `Nguyễn Văn Nội ${j}`, j % 2 === 0 ? 'male' : 'female', 3, '1955-09-09', {
        children: gen4.slice(j * 6, j * 6 + 6),
      })
    );
  }
  // gen-2: 8 nodes; gen2[i] links gen3 slice [i*5, i*5+5) → 8×5 = 40 reachable.
  const gen2: TreeNode[] = [];
  for (let i = 0; i < 8; i++) {
    gen2.push(
      member(`tv-d300-g2-${i}`, `Nguyễn Văn Con ${i}`, i % 2 === 0 ? 'male' : 'female', 2, '1930-04-04', {
        children: gen3.slice(i * 5, i * 5 + 5),
      })
    );
  }
  return member('tv-d300-root', 'Nguyễn Văn CỤ', 'male', 1, '1900-01-01', {
    is_living: false,
    death_date: '1985-03-03',
    spouse_ids: ['tv-d300-spouse'],
    children: gen2,
  });
}
export const TV_DENSE300_SPOUSE = member('tv-d300-spouse', 'Lê Thị CỤ', 'female', 1, '1902-02-02');
export const TV_DENSE300_ROOT: TreeNode = makeDense300();
export const TV_DENSE300_ROOTS: TreeNode[] = [TV_DENSE300_ROOT, TV_DENSE300_SPOUSE];
export const TV_DENSE300_TOTAL = 300; // 2 + 8 + 40 + 240 + 10
export const TV_DENSE300_GENERATIONS: GenerationMeta[] = [
  { index: 1, label: 'Đời thứ 1', count: 2 },
  { index: 2, label: 'Đời thứ 2', count: 8 },
  { index: 3, label: 'Đời thứ 3', count: 40 },
  { index: 4, label: 'Đời thứ 4', count: 240 },
  { index: 5, label: 'Đời thứ 5', count: 10 },
];

// ─── TV-CULLED-FOCUS : focus target outside default 1.5× viewport buffer ───

/**
 * Fixture for focus-resolution-on-culled-node: the focus target
 * `tv-cf-far-right` is a distant leaf that falls outside the default
 * `viewport + 1.5×` culling buffer. Focus/anchor selection must still resolve
 * (search the complete model, not the culled DOM).
 */
export const TV_CULLED_FOCUS_ROOT = member('tv-cf-root', 'Nguyễn Văn Culled-Root', 'male', 1, '1930-01-01', {
  children: [
    member('tv-cf-left', 'Nguyễn Văn Culled-Left', 'male', 2, '1960-01-01'),
    member('tv-cf-mid', 'Nguyễn Văn Culled-Mid', 'female', 2, '1962-01-01'),
    member('tv-cf-far-right', 'Nguyễn Văn Culled-Far-Right', 'male', 2, '1964-01-01'),
  ],
});
export const TV_CULLED_FOCUS_ROOTS: TreeNode[] = [TV_CULLED_FOCUS_ROOT];
export const TV_CULLED_FOCUS_TARGET_ID = 'tv-cf-far-right';
export const TV_CULLED_FOCUS_GENERATIONS: GenerationMeta[] = [
  { index: 1, label: 'Đời thứ 1', count: 1 },
  { index: 2, label: 'Đời thứ 2', count: 3 },
];

// ─── TV-LOD-BOUNDARY : nodes probed at tier-boundary zooms ──────────────────

/**
 * Fixture for zoom-tier boundary probes: a small deterministic tree probed at
 * exact boundary zooms. Node ids are stable so tier-selection can be asserted
 * per-node at .4199, .42, .4201, .6499, .65, .6501, .8499, .85, .8501.
 */
export const TV_LOD_BOUNDARY_ROOT = member('tv-lod-root', 'Nguyễn Văn LOD', 'male', 1, '1940-01-01', {
  children: [
    member('tv-lod-child-1', 'Nguyễn Văn LOD-Con 1', 'male', 2, '1965-01-01'),
    member('tv-lod-child-2', 'Nguyễn Văn LOD-Con 2', 'female', 2, '1967-01-01'),
  ],
});
export const TV_LOD_BOUNDARY_ROOTS: TreeNode[] = [TV_LOD_BOUNDARY_ROOT];
export const TV_LOD_BOUNDARY_GENERATIONS: GenerationMeta[] = [
  { index: 1, label: 'Đời thứ 1', count: 1 },
  { index: 2, label: 'Đời thứ 2', count: 2 },
];
/** Exact zoom-probe matrix (phase1-plan.md §5 + §B worst-case probe values). */
export const TV_LOD_ZOOM_PROBES = [0.4199, 0.42, 0.4201, 0.6499, 0.65, 0.6501, 0.8499, 0.85, 0.8501] as const;
export type LodZoomProbe = (typeof TV_LOD_ZOOM_PROBES)[number];
/** Ratified tier bands (§13.2): full-card ≥.85, name-only [.65,.85), chip [.42,.65), dot <.42. */
export type LodTier = 'dot' | 'chip' | 'name-only' | 'full-card';
export function expectedTierAtZoom(zoom: number): LodTier {
  if (zoom >= 0.85) return 'full-card';
  if (zoom >= 0.65) return 'name-only';
  if (zoom >= 0.42) return 'chip';
  return 'dot';
}
/** Fixture matrix: probe × expected tier, per the ratified §13.2 bands. */
export const TV_LOD_EXPECTED: ReadonlyArray<{ zoom: LodZoomProbe; tier: LodTier }> = TV_LOD_ZOOM_PROBES.map(
  (zoom) => ({ zoom, tier: expectedTierAtZoom(zoom) })
);

// ─── TV-REFLOW : baseline vs. mutated layout for transform-continuity test ──

/**
 * Fixture pair for the reflow/transform-continuity regression (P2 `REFLOW-SAME-ANCHOR`).
 * Same anchor; the mutated tree adds one child to the mid-generation node —
 * the transform must remain unchanged (no whole-world auto-refit).
 */
export const TV_REFLOW_BASE_ROOT = member('tv-rf-root', 'Nguyễn Văn Reflow', 'male', 1, '1950-01-01', {
  children: [member('tv-rf-c1', 'Nguyễn Văn Reflow-Con', 'female', 2, '1975-01-01')],
});
export const TV_REFLOW_BASE_ROOTS: TreeNode[] = [TV_REFLOW_BASE_ROOT];
export const TV_REFLOW_MUTATED_ROOT: TreeNode = {
  ...TV_REFLOW_BASE_ROOT,
  children: [
    member('tv-rf-c1', 'Nguyễn Văn Reflow-Con', 'female', 2, '1975-01-01'),
    member('tv-rf-c2', 'Nguyễn Văn Reflow-Con-Mới', 'male', 2, '1978-01-01'),
  ],
};
export const TV_REFLOW_MUTATED_ROOTS: TreeNode[] = [TV_REFLOW_MUTATED_ROOT];
export const TV_REFLOW_ANCHOR_ID = 'tv-rf-root';

// ─── TV-ORIENTATION : Dọc-preferred (deep) vs Ngang-preferred (wide) ────────

/**
 * Fixture for the Dọc/Ngang orientation toggle (§13.3): deep6 favors Dọc
 * (vertical lineage), wide8 favors Ngang (horizontal sibling-spread). Both
 * alias existing fixtures — orientation is a renderer transform, not new data.
 */
export const TV_ORIENTATION_PORTRAIT_PREFERRED = TV_DEEP6_ROOTS; // Dọc (vertical)
export const TV_ORIENTATION_LANDSCAPE_PREFERRED = TV_WIDE8_ROOTS; // Ngang (horizontal)

// ─── TV-DEMO : demo-user session context fixture ────────────────────────────

/**
 * Demo-account fixture context: demo users are NEVER linkable (403-first
 * binding) and "Đây là tôi" is hidden. This is a static context descriptor
 * (auth semantics, not tree shape) — consumed alongside any tree fixture.
 */
export const TV_DEMO_USER_CONTEXT = {
  isDemo: true,
  isAuthenticated: true,
  user: { id: 'tv-demo-user', member_id: null },
  expect: {
    linkSelfButtonVisible: false,
    demoNoticeVisible: true,
    demoNoticeText:
      'Phiên Demo · chức năng “Đây là tôi” không khả dụng; phiên Demo không thể liên kết hồ sơ.',
    linkSelfApiStatus: 403,
  },
} as const;
export const TV_DEMO_FAMILY_ID = 'tv-demo-family';

// ─── TV-AVATAR-MISSING : nodes with missing / broken / valid avatars ────────

/**
 * Avatar fixture: missing, broken, and valid avatar_url variants to exercise
 * the M4 avatar-validator + M12 `hasAvatarError` latch fallback to initials.
 * Avatar policy: bundled `/static/avatars/*` only.
 */
export const TV_AVATAR_MISSING_NODES: TreeNode[] = [
  member('tv-av-none', 'Trần Không Avatar', 'male', 1, '1940-01-01'), // avatar_url absent
  member('tv-av-broken', 'Trần Hỏng Avatar', 'female', 1, '1942-01-01', {
    avatar_url: '/static/avatars/broken-does-not-exist.png',
  }),
  member('tv-av-valid', 'Trần Đủ Avatar', 'male', 1, '1944-01-01', {
    avatar_url: '/static/avatars/seed/avatar-01.webp',
  }),
];
export const TV_AVATAR_MISSING_ROOTS: TreeNode[] = TV_AVATAR_MISSING_NODES;
export const TV_AVATAR_VALID_URL = '/static/avatars/seed/avatar-01.webp';
export const TV_AVATAR_BROKEN_URL = '/static/avatars/broken-does-not-exist.png';

// ─── TV-MISSING-ANCHOR : focus id not present in the tree ──────────────────

/**
 * Missing focus/anchor fixture: the anchor id does not exist anywhere in the
 * model. Anchor resolution must fall back deterministically (family/root) per
 * the anchor-frame fallback rule; no crash, no null-deref.
 */
export const TV_MISSING_ANCHOR_ID = 'tv-nonexistent-anchor-id';
export const TV_MISSING_ANCHOR_ROOTS: TreeNode[] = TV_ROOT_ROOTS; // reuse minimal tree

// ─── fixture registry (for P5 matrix enumeration) ───────────────────────────

/** Stable registry so the P5 release matrix can enumerate fixtures by id. */
export const TV_FIXTURE_REGISTRY = {
  'TV-ROOT': { roots: TV_ROOT_ROOTS, generations: TV_ROOT_GENERATIONS },
  'TV-CHILDLESS': { roots: TV_CHILDLESS_ROOTS, generations: TV_CHILDLESS_GENERATIONS },
  'TV-WIDE8': { roots: TV_WIDE8_ROOTS, generations: TV_WIDE8_GENERATIONS },
  'TV-DEEP6': { roots: TV_DEEP6_ROOTS, generations: TV_DEEP6_GENERATIONS },
  'TV-DENSE300': { roots: TV_DENSE300_ROOTS, generations: TV_DENSE300_GENERATIONS },
  'TV-CULLED-FOCUS': { roots: TV_CULLED_FOCUS_ROOTS, generations: TV_CULLED_FOCUS_GENERATIONS },
  'TV-LOD-BOUNDARY': { roots: TV_LOD_BOUNDARY_ROOTS, generations: TV_LOD_BOUNDARY_GENERATIONS },
  'TV-REFLOW': {
    roots: TV_REFLOW_BASE_ROOTS,
    generations: [
      { index: 1, label: 'Đời thứ 1', count: 1 },
      { index: 2, label: 'Đời thứ 2', count: 1 },
    ],
    mutatedRoots: TV_REFLOW_MUTATED_ROOTS,
    anchorId: TV_REFLOW_ANCHOR_ID,
  },
  'TV-ORIENTATION': {
    portrait: TV_ORIENTATION_PORTRAIT_PREFERRED,
    landscape: TV_ORIENTATION_LANDSCAPE_PREFERRED,
  },
  'TV-DEMO': { roots: TV_ROOT_ROOTS, generations: TV_ROOT_GENERATIONS, context: TV_DEMO_USER_CONTEXT },
  'TV-AVATAR-MISSING': { roots: TV_AVATAR_MISSING_ROOTS },
  'TV-MISSING-ANCHOR': { roots: TV_MISSING_ANCHOR_ROOTS },
} as const;
