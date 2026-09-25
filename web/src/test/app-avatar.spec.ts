import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppAvatar from '@/components/ui/AppAvatar.vue';

describe('AppAvatar.vue', () => {
  it('renders image when src is provided', () => {
    const wrapper = mount(AppAvatar, {
      props: {
        src: 'https://example.com/avatar.jpg',
        name: 'Nguyễn Văn An',
      },
    });

    const img = wrapper.find('img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe('https://example.com/avatar.jpg');
    expect(img.attributes('alt')).toBe('Nguyễn Văn An');
  });

  it('falls back to initials when no src is provided', () => {
    const wrapper = mount(AppAvatar, {
      props: {
        name: 'Nguyễn Văn An',
      },
    });

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toBe('NA');
  });

  it('falls back to initials when img triggers error event', async () => {
    const wrapper = mount(AppAvatar, {
      props: {
        src: 'https://broken.example.com/avatar.jpg',
        name: 'Trần Thị Dung',
      },
    });

    const img = wrapper.find('img');
    expect(img.exists()).toBe(true);

    await img.trigger('error');

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toBe('TD');
  });

  it('tints initials by generation CSS variables', () => {
    const wrapper = mount(AppAvatar, {
      props: {
        name: 'Nguyễn Văn An',
        generation: 2,
      },
    });

    const disc = wrapper.find('div.font-display');
    expect(disc.attributes('style')).toContain('background-color: var(--gen-2-soft)');
    expect(disc.attributes('style')).toContain('color: var(--gen-2)');
  });

  it('uses terracotta soft fallback when generation is omitted or unknown', () => {
    const wrapper = mount(AppAvatar, {
      props: {
        name: 'Lê Văn C',
      },
    });

    const disc = wrapper.find('div.font-display');
    expect(disc.classes()).toContain('bg-terracotta-soft');
    expect(disc.classes()).toContain('text-terracotta-dark');
  });

  it('applies identity rings correctly for self and selected', () => {
    const selfWrapper = mount(AppAvatar, {
      props: {
        name: 'Nguyễn Tôi',
        self: true,
      },
    });
    expect(selfWrapper.classes()).toContain('ring-tree-self-ring');

    const selectedWrapper = mount(AppAvatar, {
      props: {
        name: 'Nguyễn Tôi',
        selected: true,
      },
    });
    expect(selectedWrapper.classes()).toContain('ring-terracotta');
  });

  it('applies correct size classes', () => {
    const wrapperW6 = mount(AppAvatar, { props: { name: 'A', size: 'w-6' } });
    expect(wrapperW6.classes()).toContain('w-6');

    const wrapperW14 = mount(AppAvatar, { props: { name: 'A', size: 'w-14' } });
    expect(wrapperW14.classes()).toContain('w-14');
  });
});
