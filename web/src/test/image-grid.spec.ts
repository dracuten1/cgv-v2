import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ImageGrid from '@/components/feed/ImageGrid.vue';

describe('ImageGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses a single full-width column for 1 image', () => {
    const wrapper = mount(ImageGrid, { props: { images: ['https://a/1.jpg'] } });
    const grid = wrapper.find('[data-testid="image-grid"]');
    expect(grid.classes()).toContain('grid-cols-1');
    expect(grid.findAll('img')).toHaveLength(1);
  });

  it('uses 2 columns for 2 images', () => {
    const wrapper = mount(ImageGrid, {
      props: { images: ['https://a/1.jpg', 'https://a/2.jpg'] },
    });
    expect(wrapper.find('[data-testid="image-grid"]').classes()).toContain('grid-cols-2');
  });

  it('uses 3 columns for 3+ images and caps at 9 images', () => {
    const many = Array.from({ length: 12 }, (_, i) => `https://a/${i}.jpg`);
    const wrapper = mount(ImageGrid, { props: { images: many } });
    const grid = wrapper.find('[data-testid="image-grid"]');
    expect(grid.classes()).toContain('grid-cols-3');
    expect(grid.findAll('img')).toHaveLength(9);
  });

  it('renders Vietnamese alt text on every image', () => {
    const wrapper = mount(ImageGrid, {
      props: { images: ['https://a/1.jpg', 'https://a/2.jpg'] },
    });
    for (const img of wrapper.findAll('img')) {
      expect(img.attributes('alt')).toBe('Ảnh bài viết');
    }
  });

  it('updates classes when images change reactively', async () => {
    const wrapper = mount(ImageGrid, { props: { images: ['https://a/1.jpg'] } });
    expect(wrapper.find('[data-testid="image-grid"]').classes()).toContain('grid-cols-1');
    await wrapper.setProps({ images: ['https://a/1.jpg', 'https://a/2.jpg', 'https://a/3.jpg'] });
    await nextTick();
    expect(wrapper.find('[data-testid="image-grid"]').classes()).toContain('grid-cols-3');
  });

  // ---- Phase 3 Quiet Clarity restyle — additive contract cases ----

  it('places each tile on the semantic well surface with hairline + md radius', () => {
    const wrapper = mount(ImageGrid, { props: { images: ['https://a/1.jpg'] } });
    const tile = wrapper.find('a');
    expect(tile.classes()).toContain('bg-well');
    expect(tile.classes()).toContain('border-hairline');
    expect(tile.classes()).toContain('rounded-app-md');
    expect(tile.classes()).toContain('aspect-square');
    // Focus stays visible (terracotta halo, design-system §3.5)
    expect(tile.classes()).toContain('focus-visible:ring-accent');
  });

  it('keeps the external-link security contract on every tile anchor', () => {
    const wrapper = mount(ImageGrid, {
      props: { images: ['https://a/1.jpg', 'https://a/2.jpg'] },
    });
    for (const anchor of wrapper.findAll('a')) {
      expect(anchor.attributes('target')).toBe('_blank');
      const rel = anchor.attributes('rel') ?? '';
      expect(rel).toContain('noopener');
      expect(rel).toContain('noreferrer');
    }
  });

  it('keeps the hover motion inside the 140ms fast transition budget', () => {
    const wrapper = mount(ImageGrid, { props: { images: ['https://a/1.jpg'] } });
    const img = wrapper.find('img');
    expect(img.classes()).toContain('hover:scale-105');
    expect(img.classes()).toContain('duration-[140ms]');
  });
});
