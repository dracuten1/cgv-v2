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
      return 'bg-terracotta-soft text-terracotta-dark border border-terracotta-border';
    case 'success':
      return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
    case 'warning':
      return 'bg-amber-50 text-amber-800 border border-amber-200';
    case 'info':
      return 'bg-sky-50 text-sky-800 border border-sky-200';
    case 'gen1':
      return 'bg-gen-1-soft text-terracotta-hover border border-terracotta-border';
    case 'gen2':
      return 'bg-gen-2-soft text-emerald-800 border border-emerald-200';
    case 'gen3':
      return 'bg-gen-3-soft text-teal-800 border border-teal-200';
    case 'gen4':
      return 'bg-gen-4-soft text-amber-800 border border-amber-200';
    case 'default':
    default:
      return 'bg-slate-100 text-slate-700 border border-slate-200';
  }
});
</script>
