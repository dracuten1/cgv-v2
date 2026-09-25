import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import NotFoundView from '@/views/NotFoundView.vue';

const routerBack = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({
    back: routerBack,
  }),
  RouterLink: {
    props: ['to'],
    template: '<a :href="to"><slot /></a>',
  },
}));

const stubRouterLink = { props: ['to'], template: '<a :href="to"><slot /></a>' };

describe('NotFoundView.vue (mockup 03 / spec §6.3)', () => {
  it('renders the 404 hero: terracotta disc, Fraunces 404 numeral and Vietnamese copy', () => {
    const wrapper = mount(NotFoundView, {
      global: { stubs: { RouterLink: stubRouterLink } },
    });

    expect(wrapper.find('[data-testid="not-found"]').exists()).toBe(true);
    // Icon disc in terracotta-soft
    const disc = wrapper.find('.bg-terracotta-soft.rounded-full');
    expect(disc.exists()).toBe(true);
    // Display numeral in Fraunces terracotta (aria-hidden decorative)
    const numeral = wrapper.find('p[aria-hidden="true"]');
    expect(numeral.text()).toBe('404');
    expect(numeral.classes()).toContain('font-display');
    expect(numeral.classes()).toContain('text-terracotta');
    expect(wrapper.text()).toContain('Không tìm thấy trang');
  });

  it('offers primary path back to the tree and finder path to kinship search', () => {
    const wrapper = mount(NotFoundView, {
      global: { stubs: { RouterLink: stubRouterLink } },
    });

    const home = wrapper.find('[data-testid="not-found-home"]');
    const kinship = wrapper.find('[data-testid="not-found-kinship"]');
    expect(home.exists()).toBe(true);
    expect(home.attributes('href')).toBe('/tree');
    expect(home.text()).toContain('Về cây gia phả');
    // Second CTA targets the kinship people-finder (route verified in router/index.ts)
    expect(kinship.exists()).toBe(true);
    expect(kinship.attributes('href')).toBe('/kinship');
    expect(kinship.text()).toContain('Tìm người trong họ');
    // The gen-pastel dot cluster is decorative only — no links/buttons inside
    const dots = wrapper.find('div[aria-hidden="true"].bg-gen-1, span.bg-gen-1');
    expect(dots.exists()).toBe(true);
  });

  it('renders heritage ghost decorations and a back-link affordance', () => {
    const wrapper = mount(NotFoundView, {
      global: { stubs: { RouterLink: stubRouterLink } },
    });

    const ghosts = wrapper.findAll('div[aria-hidden="true"]');
    const glyph = ghosts.find((d) => d.text() === 'Phả');
    expect(glyph).toBeDefined();
    expect(glyph!.classes()).toContain('opacity-[0.04]');

    const back = wrapper.find('button');
    expect(back.text()).toContain('quay lại trang trước');
  });
});
