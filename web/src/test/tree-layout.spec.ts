import { describe, it, expect } from 'vitest';
import {
  layoutTree,
  filterRootsByGeneration,
  BAND_HEIGHT,
  CARD_WIDTH,
  CARD_HEIGHT,
  X_GAP,
} from '@/composables/useTreeLayout';
import { normalizeTreeRoots } from '@/composables/useTreeLayoutNormalizer';
import type { TreeNode, GenerationMeta } from '@/types/api';

describe('useTreeLayout — pure layout math', () => {
  const sampleGenerations: GenerationMeta[] = [
    { index: 1, label: 'Đời thứ 1', count: 1 },
    { index: 2, label: 'Đời thứ 2', count: 2 },
    { index: 3, label: 'Đời thứ 3', count: 2 },
  ];

  const sampleRoots: TreeNode[] = [
    {
      id: 'root-1',
      full_name: 'Nguyễn Văn An',
      gender: 'male',
      generation_index: 1,
      birth_date: '1930-01-01',
      death_date: '2001-05-15',
      is_living: false,
      spouse_ids: ['spouse-1'],
      children: [
        {
          id: 'child-1',
          full_name: 'Nguyễn Văn Bình',
          gender: 'male',
          generation_index: 2,
          birth_date: '1955-03-10',
          is_living: true,
          spouse_ids: [],
          children: [
            {
              id: 'grandchild-1',
              full_name: 'Nguyễn Văn Cường',
              gender: 'male',
              generation_index: 3,
              birth_date: '1982-08-20',
              is_living: true,
              spouse_ids: [],
              children: [],
            },
          ],
        },
        {
          id: 'child-2',
          full_name: 'Nguyễn Thị Dung',
          gender: 'female',
          generation_index: 2,
          birth_date: '1958-07-22',
          is_living: true,
          spouse_ids: [],
          children: [],
        },
      ],
    },
  ];

  it('assigns positions with generation ordering top-down', () => {
    const layout = layoutTree(sampleRoots, sampleGenerations);

    expect(layout.nodes.length).toBe(4); // root-1, child-1, child-2, grandchild-1
    const rootPos = layout.nodeById.get('root-1')!;
    const child1Pos = layout.nodeById.get('child-1')!;
    const child2Pos = layout.nodeById.get('child-2')!;
    const grandchildPos = layout.nodeById.get('grandchild-1')!;

    expect(rootPos).toBeDefined();
    expect(child1Pos).toBeDefined();
    expect(child2Pos).toBeDefined();
    expect(grandchildPos).toBeDefined();

    // Top-down: Gen 1 Y < Gen 2 Y < Gen 3 Y
    expect(rootPos.y).toBeLessThan(child1Pos.y);
    expect(child1Pos.y).toBeLessThan(grandchildPos.y);

    // Generation row spacing matches BAND_HEIGHT
    expect(child1Pos.y - rootPos.y).toBe(BAND_HEIGHT);
    expect(grandchildPos.y - child1Pos.y).toBe(BAND_HEIGHT);

    // Siblings (child-1, child-2) share the same generation row
    expect(child2Pos.y).toBe(child1Pos.y);
    // Siblings ordered horizontally without overlap
    expect(child2Pos.x).toBeGreaterThan(child1Pos.x + CARD_WIDTH);

    // Node dimensions assigned
    expect(rootPos.width).toBe(CARD_WIDTH);
    expect(rootPos.height).toBe(CARD_HEIGHT);
  });

  it('generates generation bands from metadata with labels and cycling CSS vars', () => {
    const layout = layoutTree(sampleRoots, sampleGenerations);
    expect(layout.bands.length).toBe(3);

    expect(layout.bands[0].label).toBe('Đời thứ 1');
    expect(layout.bands[0].colorVar).toBe('--gen-1');
    expect(layout.bands[0].colorSoftVar).toBe('--gen-1-soft');

    expect(layout.bands[1].label).toBe('Đời thứ 2');
    expect(layout.bands[1].colorVar).toBe('--gen-2');

    expect(layout.bands[2].label).toBe('Đời thứ 3');
    expect(layout.bands[2].colorVar).toBe('--gen-3');
  });

  it('generates parent-child edges connecting centers of parents to children', () => {
    const layout = layoutTree(sampleRoots, sampleGenerations);
    const pcEdges = layout.edges.filter((e) => e.type === 'parent-child');
    expect(pcEdges.length).toBeGreaterThanOrEqual(2);

    const rootToChild1 = pcEdges.find((e) => e.id === 'pc-root-1-child-1')!;
    expect(rootToChild1).toBeDefined();
    const rootPos = layout.nodeById.get('root-1')!;
    const child1Pos = layout.nodeById.get('child-1')!;

    expect(rootToChild1.fromX).toBe(rootPos.x + CARD_WIDTH / 2);
    expect(rootToChild1.fromY).toBe(rootPos.y + CARD_HEIGHT);
    expect(rootToChild1.toX).toBe(child1Pos.x + CARD_WIDTH / 2);
    expect(rootToChild1.toY).toBe(child1Pos.y);
  });

  it('filters roots by generation, hiding non-selected generation nodes', () => {
    const gen2Roots = filterRootsByGeneration(sampleRoots, 2);
    // When filtering for Gen 2, Gen 1 root is excluded
    expect(gen2Roots.find((n) => n.id === 'root-1')).toBeUndefined();

    // When generationFilter is null, all roots remain
    const allRoots = filterRootsByGeneration(sampleRoots, null);
    expect(allRoots.length).toBe(1);
    expect(allRoots[0].id).toBe('root-1');
  });

  it('layoutTree with generationFilter hides non-selected generation cards', () => {
    // Unfiltered: every member placed
    const full = layoutTree(sampleRoots, sampleGenerations, null);
    expect(full.nodes.length).toBe(4);
    expect(full.edges.some((e) => e.type === 'parent-child')).toBe(true);

    // Gen 2 filter: only child-1 + child-2 placed, no parent-child edges
    const gen2 = layoutTree(sampleRoots, sampleGenerations, 2);
    expect(gen2.nodes.map((n) => n.id).sort()).toEqual(['child-1', 'child-2']);
    expect(gen2.nodes.every((n) => n.generation_index === 2)).toBe(true);
    expect(gen2.edges.some((e) => e.type === 'parent-child')).toBe(false);
    // Gen 2 cards sit on the gen 2 row
    for (const n of gen2.nodes) {
      expect(n.y).toBe((2 - 1) * BAND_HEIGHT + 56);
    }

    // Gen 1 filter: only the root placed
    const gen1 = layoutTree(sampleRoots, sampleGenerations, 1);
    expect(gen1.nodes.map((n) => n.id)).toEqual(['root-1']);
  });

  // ---------- Phase 2 Test Expectations (§3) ----------

  it('root-couple pairing: Two root spouses are placed at y = 0 with adjacent x coordinates', () => {
    const rootCoupleRoots: TreeNode[] = [
      {
        id: 'gp-1',
        full_name: 'Nguyễn Văn An',
        gender: 'male',
        generation_index: 1,
        is_living: true,
        spouse_ids: ['gp-2'],
        children: [],
      },
      {
        id: 'gp-2',
        full_name: 'Trần Thị Mai',
        gender: 'female',
        generation_index: 1,
        is_living: true,
        spouse_ids: ['gp-1'],
        children: [],
      },
    ];

    const layout = layoutTree(rootCoupleRoots, [{ index: 1, label: 'Đời thứ 1', count: 2 }]);
    expect(layout.nodes.length).toBe(2);

    const p1 = layout.nodeById.get('gp-1')!;
    const p2 = layout.nodeById.get('gp-2')!;

    expect(p1).toBeDefined();
    expect(p2).toBeDefined();

    // Placed on Generation 1 row (y is identical)
    expect(p1.y).toBe(p2.y);
    expect(p1.y).toBe(56); // (1 - 1) * BAND_HEIGHT + BAND_TOP_MARGIN (56)

    // Adjacent with tight spouse gap (X_GAP / 2)
    const [left, right] = p1.x < p2.x ? [p1, p2] : [p2, p1];
    expect(right.x).toBe(left.x + CARD_WIDTH + X_GAP / 2);

    // Orthogonal spouse edge generated
    const spouseEdge = layout.orthogonalEdges.find((e) => e.type === 'spouse');
    expect(spouseEdge).toBeDefined();
    expect(spouseEdge?.segments).toHaveLength(1);
    expect(spouseEdge?.midpoint?.radius).toBe(3);
  });

  it('in-law placement & deduplication (M7/K5): In-law arriving as top-level root is rendered EXACTLY ONCE', () => {
    // In-law spouse arrives as a top-level root (children: []) as per tree_handler.go:~150-160
    const inLawRoots: TreeNode[] = [
      {
        id: 'm1',
        full_name: 'Nguyễn Văn An',
        gender: 'male',
        generation_index: 1,
        is_living: true,
        spouse_ids: ['s1'],
        children: [
          {
            id: 'c1',
            full_name: 'Nguyễn Văn Bình',
            gender: 'male',
            generation_index: 2,
            is_living: true,
            spouse_ids: ['inlaw-c1'],
            children: [],
          },
        ],
      },
      // In-law roots arrive at top level
      {
        id: 's1',
        full_name: 'Trần Thị Mai',
        gender: 'female',
        generation_index: 1,
        is_living: true,
        spouse_ids: ['m1'],
        children: [],
      },
      {
        id: 'inlaw-c1',
        full_name: 'Lê Thị Cúc',
        gender: 'female',
        generation_index: 2,
        is_living: true,
        spouse_ids: ['c1'],
        children: [],
      },
    ];

    const layout = layoutTree(inLawRoots, [
      { index: 1, label: 'Đời thứ 1', count: 2 },
      { index: 2, label: 'Đời thứ 2', count: 2 },
    ]);

    // Exactly 4 nodes rendered: m1, s1, c1, inlaw-c1 (no duplicates, no phantom roots)
    expect(layout.nodes.length).toBe(4);
    const ids = layout.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(4);

    const m1Pos = layout.nodeById.get('m1')!;
    const s1Pos = layout.nodeById.get('s1')!;
    const c1Pos = layout.nodeById.get('c1')!;
    const inlawPos = layout.nodeById.get('inlaw-c1')!;

    expect(m1Pos).toBeDefined();
    expect(s1Pos).toBeDefined();
    expect(c1Pos).toBeDefined();
    expect(inlawPos).toBeDefined();

    // In-law at Gen 2 is adjacent to c1
    expect(inlawPos.y).toBe(c1Pos.y);
    expect(inlawPos.x).toBe(c1Pos.x + CARD_WIDTH + X_GAP / 2);
  });

  it('Tier-1 couple ordering (D1): Paternal couple placed left of maternal couple when ancestry trace is present; fallback to FullName ASC when trace unavailable', () => {
    // 2 grandparent couples in Gen 1
    const buildGrandparents = (): TreeNode[] => [
      {
        id: 'mgp-f',
        full_name: 'Lê Văn Ngoại', // Maternal grandfather
        gender: 'male',
        generation_index: 1,
        is_living: true,
        spouse_ids: ['mgp-m'],
        children: [
          {
            id: 'mother',
            full_name: 'Lê Thị Mẹ',
            gender: 'female',
            generation_index: 2,
            is_living: true,
            spouse_ids: ['father'],
            children: [
              {
                id: 'self-user',
                full_name: 'Nguyễn Văn Tôi',
                gender: 'male',
                generation_index: 3,
                is_living: true,
                spouse_ids: [],
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: 'mgp-m',
        full_name: 'Phạm Thị Ngoại',
        gender: 'female',
        generation_index: 1,
        is_living: true,
        spouse_ids: ['mgp-f'],
        children: [],
      },
      {
        id: 'pgp-f',
        full_name: 'Vũ Văn Nội', // Paternal grandfather (V alphabetically comes after L)
        gender: 'male',
        generation_index: 1,
        is_living: true,
        spouse_ids: ['pgp-m'],
        children: [
          {
            id: 'father',
            full_name: 'Vũ Văn Bố',
            gender: 'male',
            generation_index: 2,
            is_living: true,
            spouse_ids: ['mother'],
            children: [
              {
                id: 'self-user',
                full_name: 'Nguyễn Văn Tôi',
                gender: 'male',
                generation_index: 3,
                is_living: true,
                spouse_ids: [],
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: 'pgp-m',
        full_name: 'Hoàng Thị Nội',
        gender: 'female',
        generation_index: 1,
        is_living: true,
        spouse_ids: ['pgp-f'],
        children: [],
      },
    ];

    // Case 1: Trace with anchor "self-user" -> Paternal (Vũ Văn Nội) must be on the LEFT of Maternal (Lê Văn Ngoại)
    const traceLayout = layoutTree(
      buildGrandparents(),
      [
        { index: 1, label: 'Đời thứ 1', count: 4 },
        { index: 2, label: 'Đời thứ 2', count: 2 },
        { index: 3, label: 'Đời thứ 3', count: 1 },
      ],
      null,
      'self-user'
    );

    const pgpPos = traceLayout.nodeById.get('pgp-f')!;
    const mgpPos = traceLayout.nodeById.get('mgp-f')!;
    expect(pgpPos).toBeDefined();
    expect(mgpPos).toBeDefined();
    expect(pgpPos.x).toBeLessThan(mgpPos.x);

    // Case 2: No anchor member id (trace unavailable) -> fallback to FullName ASC:
    // 'Lê Văn Ngoại' < 'Vũ Văn Nội', so Lê Văn Ngoại should be on the left
    const fallbackLayout = layoutTree(
      buildGrandparents(),
      [
        { index: 1, label: 'Đời thứ 1', count: 4 },
        { index: 2, label: 'Đời thứ 2', count: 2 },
        { index: 3, label: 'Đời thứ 3', count: 1 },
      ],
      null,
      null
    );

    const fallbackMgpPos = fallbackLayout.nodeById.get('mgp-f')!;
    const fallbackPgpPos = fallbackLayout.nodeById.get('pgp-f')!;
    expect(fallbackMgpPos.x).toBeLessThan(fallbackPgpPos.x);
  });

  it('2-pass bounding box sibling overlap (M10): Adjacent sibling subtrees do not overlap; cursorX respects bounding box width', () => {
    // Parent with 2 children:
    // Child 1 has 3 children (wide subtree)
    // Child 2 has 1 child
    const wideSubtreeRoots: TreeNode[] = [
      {
        id: 'parent',
        full_name: 'Nguyễn Văn Cha',
        gender: 'male',
        generation_index: 1,
        is_living: true,
        spouse_ids: [],
        children: [
          {
            id: 'child-1',
            full_name: 'Nguyễn Văn Anh',
            gender: 'male',
            generation_index: 2,
            is_living: true,
            spouse_ids: [],
            children: [
              { id: 'gc-1', full_name: 'GC 1', gender: 'male', generation_index: 3, is_living: true, spouse_ids: [], children: [] },
              { id: 'gc-2', full_name: 'GC 2', gender: 'male', generation_index: 3, is_living: true, spouse_ids: [], children: [] },
              { id: 'gc-3', full_name: 'GC 3', gender: 'male', generation_index: 3, is_living: true, spouse_ids: [], children: [] },
            ],
          },
          {
            id: 'child-2',
            full_name: 'Nguyễn Văn Em',
            gender: 'male',
            generation_index: 2,
            is_living: true,
            spouse_ids: [],
            children: [
              { id: 'gc-4', full_name: 'GC 4', gender: 'male', generation_index: 3, is_living: true, spouse_ids: [], children: [] },
            ],
          },
        ],
      },
    ];

    const layout = layoutTree(wideSubtreeRoots, [
      { index: 1, label: 'Đời thứ 1', count: 1 },
      { index: 2, label: 'Đời thứ 2', count: 2 },
      { index: 3, label: 'Đời thứ 3', count: 4 },
    ]);

    const gc3 = layout.nodeById.get('gc-3')!;
    const gc4 = layout.nodeById.get('gc-4')!;
    const child1 = layout.nodeById.get('child-1')!;
    const child2 = layout.nodeById.get('child-2')!;

    // Child 1's rightmost grandchild (gc-3) must be strictly to the left of Child 2's subtree (gc-4)
    expect(gc3.x + gc3.width).toBeLessThan(gc4.x);

    // Child 2's position must not overlap Child 1's subtree
    expect(child2.x).toBeGreaterThanOrEqual(gc3.x + gc3.width - CARD_WIDTH / 2);
    expect(child2.x).toBeGreaterThan(child1.x + CARD_WIDTH);
  });

  it('deterministic sorting: Older sibling (1960) placed to the left of younger sibling (1965)', () => {
    // Sibling order in raw input is younger first, older second
    const rawRoots: TreeNode[] = [
      {
        id: 'parent',
        full_name: 'Nguyễn Văn Cha',
        gender: 'male',
        generation_index: 1,
        is_living: true,
        spouse_ids: [],
        children: [
          {
            id: 'younger',
            full_name: 'Nguyễn Văn Em',
            gender: 'male',
            generation_index: 2,
            birth_date: '1965-06-15',
            is_living: true,
            spouse_ids: [],
            children: [],
          },
          {
            id: 'older',
            full_name: 'Nguyễn Văn Anh',
            gender: 'male',
            generation_index: 2,
            birth_date: '1960-01-10',
            is_living: true,
            spouse_ids: [],
            children: [],
          },
        ],
      },
    ];

    const layout = layoutTree(rawRoots, [
      { index: 1, label: 'Đời thứ 1', count: 1 },
      { index: 2, label: 'Đời thứ 2', count: 2 },
    ]);

    const olderPos = layout.nodeById.get('older')!;
    const youngerPos = layout.nodeById.get('younger')!;

    expect(olderPos).toBeDefined();
    expect(youngerPos).toBeDefined();

    // 1960 placed to the left of 1965 (older.x < younger.x)
    expect(olderPos.x).toBeLessThan(youngerPos.x);
  });

  it('M-G: handles cyclic payloads (A→B→A) without stack overflow in normalization and layout', () => {
    // Construct cycle A -> B -> A
    const nodeA: TreeNode = {
      id: 'cyclic-a',
      full_name: 'Nguyễn Văn A',
      gender: 'male',
      generation_index: 1,
      is_living: true,
      spouse_ids: [],
      children: [],
    };

    const nodeB: TreeNode = {
      id: 'cyclic-b',
      full_name: 'Nguyễn Văn B',
      gender: 'male',
      generation_index: 2,
      is_living: true,
      spouse_ids: [],
      children: [nodeA], // cycle pointing back to A
    };

    nodeA.children = [nodeB];

    // normalizeTreeRoots should not throw RangeError: Maximum call stack size exceeded
    const normalized = normalizeTreeRoots([nodeA]);
    expect(normalized.roots.length).toBe(1);
    // Layout-level assertions replace familyUnits.length === 2 — prove each node renders exactly once
    // and the layout math handles the cycle without stack overflow.
    expect(normalized.roots[0].id).toBe('cyclic-a');

    // layoutTree should also safely layout the cyclic tree
    const layout = layoutTree([nodeA], [
      { index: 1, label: 'Đời thứ 1', count: 1 },
      { index: 2, label: 'Đời thứ 2', count: 1 },
    ]);
    expect(layout.nodes.length).toBe(2);
    const ids = layout.nodes.map((n) => n.id);
    expect(ids).toContain('cyclic-a');
    expect(ids).toContain('cyclic-b');
    // Each node is positioned exactly once (no duplicates from the cycle)
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
