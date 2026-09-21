import { describe, it, expect } from 'vitest';
import {
  layoutTree,
  filterRootsByGeneration,
  BAND_HEIGHT,
  CARD_WIDTH,
  CARD_HEIGHT,
} from '@/composables/useTreeLayout';
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
});
