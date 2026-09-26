import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import * as icons from '@/components/icons';

describe('Icons smoke render', () => {
  it('exports all 32 icons as valid Vue components', () => {
    const iconNames = Object.keys(icons) as (keyof typeof icons)[];
    expect(iconNames.length).toBeGreaterThanOrEqual(28);

    for (const name of iconNames) {
      const Component = icons[name];
      const wrapper = mount(Component, {
        props: {
          class: 'w-5 h-5 text-terracotta',
        },
      });

      const svg = wrapper.find('svg');
      expect(svg.exists()).toBe(true);
      expect(svg.classes()).toContain('w-5');
      expect(svg.classes()).toContain('h-5');
      expect(svg.attributes('aria-hidden')).toBe('true');
    }
  });

  it('supports aria-label override for actionable icons', () => {
    const wrapper = mount(icons.IconTrash, {
      props: {
        ariaLabel: 'Xóa mục này',
      },
    });

    const svg = wrapper.find('svg');
    expect(svg.attributes('aria-label')).toBe('Xóa mục này');
    expect(svg.attributes('aria-hidden')).toBeUndefined();
    expect(svg.attributes('role')).toBe('img');
  });
});
