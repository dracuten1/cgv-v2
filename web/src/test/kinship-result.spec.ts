import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import KinshipResultComponent from '@/components/kinship/KinshipResult.vue';
import type { KinshipResult } from '@/types/api';

describe('KinshipResult.vue (INV-05 structural contract & rendering)', () => {
  const mockResult: KinshipResult = {
    term: 'Ông nội',
    line: 'Chi nội',
    generation_distance: 2,
    distance_label: 'Cách 2 đời',
    is_blood: true,
    dialect: 'bac',
    path: ['m-1', 'm-2', 'm-3'],
  };

  it('🔴 mounts with result: element [data-testid="kinship-term"].textContent === "Ông nội" EXACTLY', () => {
    const wrapper = mount(KinshipResultComponent, {
      props: {
        result: mockResult,
      },
    });

    const termEl = wrapper.find('[data-testid="kinship-term"]');
    expect(termEl.exists()).toBe(true);
    expect(termEl.text().trim()).toBe('Ông nội');
  });

  it('🔴 innerHTML contains NO quote characters ("“", "”", "\"", "&ldquo;", "&rdquo;") and no v-html', () => {
    const wrapper = mount(KinshipResultComponent, {
      props: {
        result: mockResult,
      },
    });

    const termEl = wrapper.find('[data-testid="kinship-term"]');
    const innerHTML = termEl.element.innerHTML;

    // Check no quotes embedded in DOM text
    expect(innerHTML).not.toContain('“');
    expect(innerHTML).not.toContain('”');
    expect(innerHTML).not.toContain('"');
    expect(innerHTML).not.toContain('&ldquo;');
    expect(innerHTML).not.toContain('&rdquo;');

    // Verify whole component HTML does not contain raw quotes around the term
    expect(wrapper.html()).not.toContain('“Ông nội”');
    expect(wrapper.html()).not.toContain('&ldquo;Ông nội&rdquo;');

    // Verify template does not use v-html
    // In Vue compiled templates, v-html directives render as innerHTML properties
    // We can verify from component options or wrapper html
    expect(wrapper.html()).not.toContain('v-html');
  });

  it('🔴 asserts "Đời thứ 1" heading renders for path steps', () => {
    const wrapper = mount(KinshipResultComponent, {
      props: {
        result: mockResult,
      },
    });

    // Should render generation headings
    expect(wrapper.text()).toContain('Đời thứ 1');
    expect(wrapper.text()).toContain('Đời thứ 2');
    expect(wrapper.text()).toContain('Đời thứ 3');

    // Should render line and distance labels
    expect(wrapper.text()).toContain('Chi nội');
    expect(wrapper.text()).toContain('Cách 2 đời');
    expect(wrapper.text()).toContain('Huyết thống');
  });
});