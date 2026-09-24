import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import TreeCompassControl from '@/components/tree/TreeCompassControl.vue';

describe('TreeCompassControl.vue', () => {
  it('renders all compass buttons', () => {
    const wrapper = mount(TreeCompassControl);
    expect(wrapper.find('[data-testid="tree-compass"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="compass-north"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="compass-south"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="compass-east"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="compass-west"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="compass-center"]').exists()).toBe(true);
  });

  it('emits pan event with (0, 80) for North', async () => {
    const wrapper = mount(TreeCompassControl);
    await wrapper.find('[data-testid="compass-north"]').trigger('click');
    expect(wrapper.emitted('pan')).toBeTruthy();
    expect(wrapper.emitted('pan')![0]).toEqual([0, 80]);
  });

  it('emits pan event with (0, -80) for South', async () => {
    const wrapper = mount(TreeCompassControl);
    await wrapper.find('[data-testid="compass-south"]').trigger('click');
    expect(wrapper.emitted('pan')).toBeTruthy();
    expect(wrapper.emitted('pan')![0]).toEqual([0, -80]);
  });

  it('emits pan event with (80, 0) for West', async () => {
    const wrapper = mount(TreeCompassControl);
    await wrapper.find('[data-testid="compass-west"]').trigger('click');
    expect(wrapper.emitted('pan')).toBeTruthy();
    expect(wrapper.emitted('pan')![0]).toEqual([80, 0]);
  });

  it('emits pan event with (-80, 0) for East', async () => {
    const wrapper = mount(TreeCompassControl);
    await wrapper.find('[data-testid="compass-east"]').trigger('click');
    expect(wrapper.emitted('pan')).toBeTruthy();
    expect(wrapper.emitted('pan')![0]).toEqual([-80, 0]);
  });

  it('emits center event for center button', async () => {
    const wrapper = mount(TreeCompassControl);
    await wrapper.find('[data-testid="compass-center"]').trigger('click');
    expect(wrapper.emitted('center')).toBeTruthy();
  });
});
