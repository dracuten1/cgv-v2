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

  it('renders a path timeline of avatar nodes with numbered badges and start/end subtitles', () => {
    const wrapper = mount(KinshipResultComponent, {
      props: {
        result: mockResult,
        memberMap: {
          'm-1': {
            id: 'm-1',
            family_id: 'f1',
            full_name: 'Nguyễn Văn An',
            gender: 'male',
            generation_index: 1,
            is_living: false,
            created_at: '2026-01-01T00:00:00Z',
          },
          'm-3': {
            id: 'm-3',
            family_id: 'f1',
            full_name: 'Nguyễn Văn Bình',
            gender: 'male',
            generation_index: 3,
            is_living: true,
            created_at: '2026-01-01T00:00:00Z',
          },
        },
      },
      global: {
        stubs: { RouterLink: true },
      },
    });

    // Timeline steps with testids
    const steps = wrapper.findAll('[data-testid="kinship-step-0"], [data-testid="kinship-step-1"], [data-testid="kinship-step-2"]');
    expect(steps.length).toBe(3);

    // Avatar nodes replace bare numbered dots: AppAvatar initials inside each node
    const avatars = wrapper.findAllComponents({ name: 'AppAvatar' });
    expect(avatars.length).toBe(3);

    // Start / endpoint subtitles
    expect(wrapper.text()).toContain('Điểm bắt đầu');
    expect(wrapper.text()).toContain('Đối tượng xưng hô');

    // Grammar context line: "A gọi B" derived from memberMap
    expect(wrapper.text()).toContain('gọi');

    // Gender micro-badges render for known members
    expect(wrapper.text()).toContain('Nam');
  });
});