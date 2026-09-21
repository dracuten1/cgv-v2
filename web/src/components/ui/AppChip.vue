<template>
  <span
    :class="[
      'inline-flex items-center font-medium rounded-full',
      sizeClasses,
      variantClasses,
    ]"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'info' | 'gen1' | 'gen2' | 'gen3' | 'gen4';
  size?: 'sm' | 'md';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'md',
});

const sizeClasses = computed(() => {
  return props.size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
});

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'bg-[#F9EAE1] text-[#983F1E] border border-[#F4D0C2]';
    case 'success':
      return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
    case 'warning':
      return 'bg-amber-50 text-amber-800 border border-amber-200';
    case 'info':
      return 'bg-sky-50 text-sky-800 border border-sky-200';
    case 'gen1':
      return 'bg-[#FBECE8] text-[#B24E2A] border border-[#F4D0C2]';
    case 'gen2':
      return 'bg-[#EDF5F1] text-[#2C6E49] border border-[#C5DFD3]';
    case 'gen3':
      return 'bg-[#EAF0EE] text-[#3D5A50] border border-[#BFD5CE]';
    case 'gen4':
      return 'bg-[#FAF3EB] text-[#8C5D30] border border-[#E9D5BF]';
    case 'default':
    default:
      return 'bg-slate-100 text-slate-700 border border-slate-200';
  }
});
</script>
