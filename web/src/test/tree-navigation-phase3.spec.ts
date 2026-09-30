import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import {
  layoutTree,
  anchorFrameTransform,
  BAND_HEIGHT,
  CARD_WIDTH,
  CARD_HEIGHT,
} from '@/composables/useTreeLayout';
import {
  useTreeOrientation,
  loadFamilyOrientation,
  saveFamilyOrientation,
  getOrientationStorageKey,
} from '@/composables/useTreeOrientation';
import TreeOrientationToggle from '@/components/tree/TreeOrientationToggle.vue';
import TreeGenerationRail from '@/components/tree/TreeGenerationRail.vue';
import TreeMinimap from '@/components/tree/TreeMinimap.vue';
import {
  TV_ORIENTATION_PORTRAIT_PREFERRED,
  TV_ORIENTATION_LANDSCAPE_PREFERRED,
} from './fixtures/tree-view-fixtures';

describe('Phase 3: Orientation, Rail, and Minimap', () => {
  const sampleGenerations = [
    { index: 1, label: 'Đời thứ 1', count: 2 },
    { index: 2, label: 'Đời thứ 2', count: 4 },
    { index: 3, label: 'Đời thứ 3', count: 6 },
  ];

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Orientation Layout Transposition', () => {
    it('defaults to vertical (Dọc) orientation with standard top-down generation y coords', () => {
      const layout = layoutTree(TV_ORIENTATION_PORTRAIT_PREFERRED, sampleGenerations);
      expect(layout.orientation).toBe('vertical');

      const gen1Nodes = layout.nodes.filter((n) => n.generation_index === 1);
      const gen2Nodes = layout.nodes.filter((n) => n.generation_index === 2);

      expect(gen1Nodes.length).toBeGreaterThan(0);
      expect(gen2Nodes.length).toBeGreaterThan(0);

      // In vertical mode: y increases with generation index
      expect(gen1Nodes[0].y).toBeLessThan(gen2Nodes[0].y);
      // Nodes keep standard card dimensions
      expect(gen1Nodes[0].width).toBe(CARD_WIDTH);
      expect(gen1Nodes[0].height).toBe(CARD_HEIGHT);
    });

    it('transposes coordinates cleanly when orientation is horizontal (Ngang)', () => {
      const vLayout = layoutTree(TV_ORIENTATION_LANDSCAPE_PREFERRED, sampleGenerations, null, null, 'vertical');
      const hLayout = layoutTree(TV_ORIENTATION_LANDSCAPE_PREFERRED, sampleGenerations, null, null, 'horizontal');

      expect(hLayout.orientation).toBe('horizontal');

      // For every node in horizontal layout, its (x, y) should equal (origY, origX)
      for (const hNode of hLayout.nodes) {
        const vNode = vLayout.nodeById.get(hNode.id);
        expect(vNode).toBeDefined();
        expect(hNode.x).toBe(vNode!.y);
        expect(hNode.y).toBe(vNode!.x);
        // Dimensions remain standard
        expect(hNode.width).toBe(CARD_WIDTH);
        expect(hNode.height).toBe(CARD_HEIGHT);
      }

      // Check edge transposition
      expect(hLayout.edges.length).toBe(vLayout.edges.length);
      for (let i = 0; i < hLayout.edges.length; i++) {
        const vEdge = vLayout.edges[i];
        const hEdge = hLayout.edges[i];
        expect(hEdge.fromX).toBe(vEdge.fromY);
        expect(hEdge.fromY).toBe(vEdge.fromX);
        expect(hEdge.toX).toBe(vEdge.toY);
        expect(hEdge.toY).toBe(vEdge.toX);
      }

      // Check orthogonal edges transposition
      expect(hLayout.orthogonalEdges.length).toBe(vLayout.orthogonalEdges.length);
      for (let i = 0; i < hLayout.orthogonalEdges.length; i++) {
        const vOrtho = vLayout.orthogonalEdges[i];
        const hOrtho = hLayout.orthogonalEdges[i];
        expect(hOrtho.segments.length).toBe(vOrtho.segments.length);
        for (let j = 0; j < hOrtho.segments.length; j++) {
          expect(hOrtho.segments[j].x1).toBe(vOrtho.segments[j].y1);
          expect(hOrtho.segments[j].y1).toBe(vOrtho.segments[j].x1);
          expect(hOrtho.segments[j].x2).toBe(vOrtho.segments[j].y2);
          expect(hOrtho.segments[j].y2).toBe(vOrtho.segments[j].x2);
        }
        if (vOrtho.midpoint && hOrtho.midpoint) {
          expect(hOrtho.midpoint.x).toBe(vOrtho.midpoint.y);
          expect(hOrtho.midpoint.y).toBe(vOrtho.midpoint.x);
        }
      }
    });

    it('anchorFrameTransform adapts to horizontal orientation cleanly', () => {
      const hLayout = layoutTree(TV_ORIENTATION_PORTRAIT_PREFERRED, sampleGenerations, null, null, 'horizontal');
      const rootId = hLayout.nodes[0].id;
      const frame = anchorFrameTransform(hLayout, rootId, { width: 800, height: 600 });
      expect(frame).not.toBeNull();
      expect(frame!.zoom).toBeGreaterThanOrEqual(0.65);
      expect(frame!.zoom).toBeLessThanOrEqual(1.0);
    });
  });

  describe('2. Per-Family Orientation Persistence', () => {
    it('returns "vertical" as fallback when no saved orientation exists', () => {
      expect(loadFamilyOrientation('family-123')).toBe('vertical');
      expect(loadFamilyOrientation(null)).toBe('vertical');
    });

    it('persists orientation under cgp_tree_orientation_${familyId} key and retrieves it', () => {
      const familyId = 'fam-abc-456';
      saveFamilyOrientation(familyId, 'horizontal');
      expect(localStorage.getItem(getOrientationStorageKey(familyId))).toBe('horizontal');
      expect(loadFamilyOrientation(familyId)).toBe('horizontal');

      saveFamilyOrientation(familyId, 'vertical');
      expect(localStorage.getItem(getOrientationStorageKey(familyId))).toBe('vertical');
      expect(loadFamilyOrientation(familyId)).toBe('vertical');
    });

    it('useTreeOrientation updates and switches correctly per family', () => {
      localStorage.setItem(getOrientationStorageKey('fam-1'), 'horizontal');
      localStorage.setItem(getOrientationStorageKey('fam-2'), 'vertical');

      const familyIdRef = ref('fam-1');
      const { orientation, setOrientation, toggleOrientation } = useTreeOrientation(familyIdRef);

      expect(orientation.value).toBe('horizontal');

      // Switch family to fam-2
      familyIdRef.value = 'fam-2';
      // Watcher reacts
      expect(orientation.value).toBe('vertical');

      // Toggle changes value and persists under fam-2
      toggleOrientation();
      expect(orientation.value).toBe('horizontal');
      expect(localStorage.getItem(getOrientationStorageKey('fam-2'))).toBe('horizontal');

      // Set directly
      setOrientation('vertical');
      expect(orientation.value).toBe('vertical');
      expect(localStorage.getItem(getOrientationStorageKey('fam-2'))).toBe('vertical');
    });

    it('TreeOrientationToggle renders buttons with aria-pressed and emits update:modelValue', async () => {
      const wrapper = mount(TreeOrientationToggle, {
        props: {
          modelValue: 'vertical',
        },
      });

      expect(wrapper.find('[data-testid="orientation-toggle"]').exists()).toBe(true);

      const verticalBtn = wrapper.find('[data-testid="orientation-vertical"]');
      const horizontalBtn = wrapper.find('[data-testid="orientation-horizontal"]');

      expect(verticalBtn.attributes('aria-pressed')).toBe('true');
      expect(horizontalBtn.attributes('aria-pressed')).toBe('false');

      await horizontalBtn.trigger('click');
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['horizontal']);
    });
  });

  describe('3. TreeGenerationRail', () => {
    it('renders generation buttons with Đời N label, badge dot, and member counts', () => {
      const bands = [
        { index: 1, label: 'Đời thứ 1', count: 2, coord: 0, size: BAND_HEIGHT, y: 0, height: BAND_HEIGHT, colorVar: '--gen-1', colorSoftVar: '--gen-1-soft' },
        { index: 2, label: 'Đời thứ 2', count: 8, coord: BAND_HEIGHT, size: BAND_HEIGHT, y: BAND_HEIGHT, height: BAND_HEIGHT, colorVar: '--gen-2', colorSoftVar: '--gen-2-soft' },
      ];

      const wrapper = mount(TreeGenerationRail, {
        props: {
          bands,
          activeGen: 2,
        },
      });

      expect(wrapper.find('[data-testid="generation-rail"]').exists()).toBe(true);

      const btn1 = wrapper.find('[data-testid="rail-btn-1"]');
      const btn2 = wrapper.find('[data-testid="rail-btn-2"]');

      expect(btn1.text()).toContain('Đời 1');
      expect(btn1.text()).toContain('2');
      expect(btn1.attributes('aria-current')).toBeUndefined();

      expect(btn2.text()).toContain('Đời 2');
      expect(btn2.text()).toContain('8');
      expect(btn2.attributes('aria-current')).toBe('true');
    });

    it('emits jump with generation index when button is clicked', async () => {
      const bands = [
        { index: 1, label: 'Đời thứ 1', count: 2, coord: 0, size: BAND_HEIGHT, y: 0, height: BAND_HEIGHT, colorVar: '--gen-1', colorSoftVar: '--gen-1-soft' },
        { index: 2, label: 'Đời thứ 2', count: 8, coord: BAND_HEIGHT, size: BAND_HEIGHT, y: BAND_HEIGHT, height: BAND_HEIGHT, colorVar: '--gen-2', colorSoftVar: '--gen-2-soft' },
      ];

      const wrapper = mount(TreeGenerationRail, {
        props: {
          bands,
          activeGen: 1,
        },
      });

      await wrapper.find('[data-testid="rail-btn-2"]').trigger('click');
      expect(wrapper.emitted('jump')?.[0]).toEqual([2]);
    });
  });

  describe('4. TreeMinimap', () => {
    it('renders minimap header with total node count and preview elements', () => {
      const layout = layoutTree(TV_ORIENTATION_PORTRAIT_PREFERRED, sampleGenerations);
      const wrapper = mount(TreeMinimap, {
        props: {
          layout,
          transform: { zoom: 0.8, tx: -100, ty: -50 },
          viewportWidth: 800,
          viewportHeight: 600,
        },
      });

      expect(wrapper.find('[data-testid="tree-minimap"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Sơ đồ nhỏ');
      expect(wrapper.text()).toContain(String(layout.nodes.length));
      expect(wrapper.find('[data-testid="minimap-viewport-rect"]').exists()).toBe(true);
    });

    it('calculates viewport rectangle position and emits panTo on pointer interaction', async () => {
      const layout = layoutTree(TV_ORIENTATION_PORTRAIT_PREFERRED, sampleGenerations);
      const wrapper = mount(TreeMinimap, {
        props: {
          layout,
          transform: { zoom: 0.8, tx: -200, ty: -100 },
          viewportWidth: 800,
          viewportHeight: 600,
        },
      });

      const map = wrapper.find('[data-testid="minimap-map"]');
      expect(map.exists()).toBe(true);

      // Mock getBoundingClientRect on map element
      vi.spyOn(map.element, 'getBoundingClientRect').mockReturnValue({
        left: 100,
        top: 200,
        width: 160,
        height: 64,
        right: 260,
        bottom: 264,
        x: 100,
        y: 200,
        toJSON: () => {},
      });

      // Simulate pointer click at center of minimap
      await map.trigger('pointerdown', {
        clientX: 180, // center X (100 + 80 = 50%)
        clientY: 232, // center Y (200 + 32 = 50%)
        pointerId: 1,
      });

      expect(wrapper.emitted('panTo')).toBeDefined();
      const [panX, panY] = wrapper.emitted('panTo')![0] as [number, number];
      expect(panX).toBeCloseTo(layout.width * 0.5, 0);
      expect(panY).toBeCloseTo(layout.height * 0.5, 0);
    });
  });
});
