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

  // --- Apple Phase 3 restyle (additive) ---

  it('Phase 3: kinship term renders in the accent text token on the card surface', () => {
    const wrapper = mount(KinshipResultComponent, {
      props: { result: mockResult, fromName: 'Nguyễn Văn An', toName: 'Nguyễn Văn Bình' },
    });

    // Root pane is the semantic card surface
    const root = wrapper.find('.bg-card.rounded-app-xl.shadow-e1');
    expect(root.exists()).toBe(true);
    expect(root.classes()).toContain('border-hairline');

    // Term block: accent text token + INV-02 heading line-height floor
    const termBlock = wrapper.get('[data-testid="kinship-term"]').element.parentElement as HTMLElement;
    expect(termBlock.classList.contains('text-accent-fg')).toBe(true);
    expect(termBlock.classList.contains('leading-[1.45]')).toBe(true);

    // Grammar line on secondary ink, connective on tertiary ink
    const grammar = wrapper.get('p.mt-2');
    expect(grammar.classes()).toContain('text-ink-2');
    expect(grammar.get('span').classes()).toContain('text-ink-3');
  });

  it('Phase 3: timeline steps use semantic card/well surfaces with AA step headings and card badges', () => {
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
        },
      },
      global: {
        stubs: { RouterLink: true },
      },
    });

    const stepCards = wrapper.findAll('[data-testid^="kinship-step-"]');
    expect(stepCards.length).toBe(3);

    // Intermediate steps: well surface, neutral hairline border, accent heading
    const middleCard = stepCards[1].find('.rounded-app-lg');
    expect(middleCard.classes()).toContain('bg-well');
    expect(middleCard.classes()).toContain('border-hairline');
    expect(stepCards[0].find('.text-accent-fg').exists()).toBe(true);

    // Endpoint step: card surface + success border/heading
    const endpointCard = stepCards[2].find('.rounded-app-lg');
    expect(endpointCard.classes()).toContain('bg-card');
    expect(endpointCard.classes()).toContain('border-success/40');
    expect(endpointCard.classes()).toContain('shadow-e1');
    expect(stepCards[2].find('.text-success-fg').exists()).toBe(true);

    // Sequence badges are card-surfaced with primary ink (AA), not white-on-color
    const badge = stepCards[0].find('span.rounded-full.bg-card');
    expect(badge.exists()).toBe(true);
    expect(badge.text().trim()).toBe('1');
    expect(badge.classes()).toContain('text-ink-1');
    expect(stepCards[2].find('span.rounded-full.bg-card').classes()).toContain('border-success');
  });
});