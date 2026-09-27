import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AppChip from '@/components/ui/AppChip.vue';

describe('AppChip generation foreground roles', () => {
  it.each([1, 2, 3, 4])('uses generation %i text foreground separately from its decorative accent', (generation) => {
    const chip = mount(AppChip, { props: { variant: `gen${generation}` as 'gen1' | 'gen2' | 'gen3' | 'gen4' } });
    expect(chip.classes()).toContain(`bg-gen-${generation}-soft`);
    expect(chip.classes()).toContain(`text-gen-${generation}-fg`);
    expect(chip.classes()).not.toContain(`text-gen-${generation}`);
  });
});
