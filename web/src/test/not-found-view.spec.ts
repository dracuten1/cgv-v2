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

  it('offers primary path back to the tree and ghost path to the feed', () => {
    const wrapper = mount(NotFoundView, {
      global: { stubs: { RouterLink: stubRouterLink } },
    });

    const home = wrapper.find('[data-testid="not-found-home"]');
    const feed = wrapper.find('[data-testid="not-found-feed"]');
    expect(home.exists()).toBe(true);
    expect(home.attributes('href')).toBe('/tree');
    expect(home.text()).toContain('Về cây gia phả');
    expect(feed.exists()).toBe(true);
    expect(feed.attributes('href')).toBe('/feed');
    expect(feed.text()).toContain('Xem bảng tin');
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
