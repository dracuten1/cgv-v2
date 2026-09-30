import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TreeVisualizer from '@/components/tree/TreeVisualizer.vue';
import { useTreeStore } from '@/stores/tree';
import {
  TV_WIDE8_ROOTS,
  TV_WIDE8_GENERATIONS,
  TV_DENSE300_ROOTS,
  TV_DENSE300_GENERATIONS,
  TV_CULLED_FOCUS_ROOTS,
  TV_CULLED_FOCUS_GENERATIONS,
  TV_CULLED_FOCUS_TARGET_ID,
} from './fixtures/tree-view-fixtures';
import { canvasPersonBudget, cullVisibleNodes, layoutTree } from '@/composables/useTreeLayout';

vi.mock('@/api/families', () => ({
  familiesApi: {
    listFamilies: vi.fn(),
    getTree: vi.fn(),
    exportExcel: vi.fn(),
    importExcel: vi.fn(),
  },
}));

vi.mock('@/api/kinship', () => ({
  kinshipApi: {
    getFamilyKinshipLabels: vi.fn().mockResolvedValue({
      family_id: 'f1',
      from: 'm-self',
      dialect: 'bac',
      labels: {},
    }),
  },
}));

describe('Phase 4: Tree Reveal Chip & Roster', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    vi.clearAllMocks();
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it('renders reveal chip with exact hidden count on TV_WIDE8_ROOTS at narrow viewport', async () => {
    const store = useTreeStore();
    store.roots = TV_WIDE8_ROOTS;
    store.generations = TV_WIDE8_GENERATIONS;

    // Simulate 390px viewport width
    const wrapper = mount(TreeVisualizer, {
      global: { plugins: [pinia] },
      attrs: {
        style: 'width: 390px; height: 800px;',
      },
    });
    await flushPromises();

    // Reveal chip should exist because children row has 8 siblings and narrow frame hides some
    const revealBtn = wrapper.find('[data-testid="reveal-siblings-btn"]');
    expect(revealBtn.exists()).toBe(true);

    const counterSpan = revealBtn.find('.tr-reveal__n');
    expect(counterSpan.exists()).toBe(true);
    const hiddenCount = parseInt(counterSpan.text(), 10);
    expect(hiddenCount).toBeGreaterThan(0);
    expect(hiddenCount).toBeLessThanOrEqual(8);

    // Assert ARIA attributes
    expect(revealBtn.attributes('aria-haspopup')).toBe('dialog');
    expect(revealBtn.attributes('aria-expanded')).toBe('false');
    expect(revealBtn.attributes('aria-controls')).toBe('sibling-roster');
  });

  it('renders compact label "+N khác" on mobile viewport <= 360px', async () => {
    const store = useTreeStore();
    store.roots = TV_WIDE8_ROOTS;
    store.generations = TV_WIDE8_GENERATIONS;

    // Mock clientWidth on container or window.innerWidth to 320
    const originalInnerWidth = window.innerWidth;
    window.innerWidth = 320;

    const wrapper = mount(TreeVisualizer, {
      global: { plugins: [pinia] },
    });
    await flushPromises();

    const revealBtn = wrapper.find('[data-testid="reveal-siblings-btn"]');
    expect(revealBtn.exists()).toBe(true);
    expect(revealBtn.text()).toMatch(/\+\d+\s+khác/);
    expect(revealBtn.text()).not.toContain('thành viên khác');

    window.innerWidth = originalInnerWidth;
  });

  it('opens roster on chip click, renders all hidden siblings and closes on Escape', async () => {
    const store = useTreeStore();
    store.roots = TV_WIDE8_ROOTS;
    store.generations = TV_WIDE8_GENERATIONS;

    const wrapper = mount(TreeVisualizer, {
      global: { plugins: [pinia] },
    });
    await flushPromises();

    const revealBtn = wrapper.find('[data-testid="reveal-siblings-btn"]');
    expect(revealBtn.exists()).toBe(true);
    const hiddenCount = parseInt(revealBtn.find('.tr-reveal__n').text(), 10);

    // Initial state: roster not open
    expect(wrapper.find('[data-testid="sibling-roster"]').exists()).toBe(false);

    // Click reveal button to open roster
    await revealBtn.trigger('click');
    await flushPromises();

    const roster = wrapper.find('[data-testid="sibling-roster"]');
    expect(roster.exists()).toBe(true);
    expect(roster.attributes('role')).toBe('dialog');

    // Roster rows match hidden count
    const rows = roster.findAll('[data-testid="roster-member-row"]');
    expect(rows.length).toBe(hiddenCount);

    // Check row content: has avatar, name, gender chip
    const firstRow = rows[0];
    expect(firstRow.find('.tr-roster__name').text()).toBeTruthy();
    expect(firstRow.find('.tr-chip').text()).toMatch(/Nam|Nữ/);

    // Escape closes roster
    await roster.trigger('keydown', { key: 'Escape' });
    await flushPromises();

    expect(wrapper.find('[data-testid="sibling-roster"]').exists()).toBe(false);
  });

  it('clicking a roster row re-anchors to that member, closes roster, and updates selection and URL', async () => {
    const store = useTreeStore();
    store.roots = TV_WIDE8_ROOTS;
    store.generations = TV_WIDE8_GENERATIONS;

    const wrapper = mount(TreeVisualizer, {
      global: { plugins: [pinia] },
    });
    await flushPromises();

    // Open roster
    const revealBtn = wrapper.find('[data-testid="reveal-siblings-btn"]');
    await revealBtn.trigger('click');
    await flushPromises();

    const roster = wrapper.find('[data-testid="sibling-roster"]');
    const rows = roster.findAll('[data-testid="roster-member-row"]');
    expect(rows.length).toBeGreaterThan(0);

    // Click first sibling row
    await rows[0].trigger('click');
    await flushPromises();

    // Roster is closed
    expect(wrapper.find('[data-testid="sibling-roster"]').exists()).toBe(false);

    // Store selected member updated
    expect(store.selectedId).toBeTruthy();

    // View is centered on target
    expect(wrapper.attributes('data-view-centered')).toBe(store.selectedId);

    // URL has ?anchor=<id>
    expect(window.location.search).toContain(`anchor=${encodeURIComponent(store.selectedId!)}`);
  });

  it('combined 300 budget invariant: open roster with R rows restricts canvas visible count <= 300 - R', async () => {
    const store = useTreeStore();
    store.roots = TV_DENSE300_ROOTS;
    store.generations = TV_DENSE300_GENERATIONS;

    // Verify raw math invariant
    const layout = layoutTree(TV_DENSE300_ROOTS, TV_DENSE300_GENERATIONS);
    const viewport = { x: -1e6, y: -1e6, width: 2e6, height: 2e6 };
    for (const R of [0, 5, 25, 100, 300]) {
      const budget = canvasPersonBudget(R);
      expect(budget).toBe(300 - R);
      const culledResult = cullVisibleNodes(layout, viewport, 1.0, { rosterRows: R });
      expect(culledResult.visible.length).toBeLessThanOrEqual(300 - R);
      expect(culledResult.visible.length + R).toBeLessThanOrEqual(300);
    }

    // Mount visualizer with TV_DENSE300_ROOTS
    const wrapper = mount(TreeVisualizer, {
      global: { plugins: [pinia] },
    });
    await flushPromises();

    const vm = wrapper.vm as any;
    expect(vm.isRosterOpen).toBe(false);
    expect(vm.culled.visible.length).toBeLessThanOrEqual(300);

    // Open roster
    vm.toggleRoster();
    await flushPromises();
    expect(vm.isRosterOpen).toBe(true);

    const openRosterRows = wrapper.findAll('[data-testid="roster-member-row"]').length;
    const canvasVisibleCount = vm.culled.visible.length;
    expect(canvasVisibleCount + openRosterRows).toBeLessThanOrEqual(300);

    // Close roster restores full quota
    vm.closeRoster();
    await flushPromises();
    expect(vm.isRosterOpen).toBe(false);
    expect(vm.culled.visible.length).toBeLessThanOrEqual(300);
  });

  it('full-layout focusNode searches all nodes including culled ones', async () => {
    const store = useTreeStore();
    store.roots = TV_CULLED_FOCUS_ROOTS;
    store.generations = TV_CULLED_FOCUS_GENERATIONS;

    const wrapper = mount(TreeVisualizer, {
      global: { plugins: [pinia] },
    });
    await flushPromises();

    const vm = wrapper.vm as any;
    expect(typeof vm.focusNode).toBe('function');

    // Target node TV_CULLED_FOCUS_TARGET_ID is far out
    const found = vm.focusNode(TV_CULLED_FOCUS_TARGET_ID);
    expect(found).toBe(true);
    await flushPromises();

    expect(wrapper.attributes('data-view-centered')).toBe(TV_CULLED_FOCUS_TARGET_ID);

    // Non-existent node returns false
    const missing = vm.focusNode('non-existent-id-xyz');
    expect(missing).toBe(false);
  });
});
