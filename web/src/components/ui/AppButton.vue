<template>
  <component
    :is="to ? 'router-link' : 'button'"
    :to="to"
    :type="to ? undefined : type"
    :disabled="to ? undefined : (disabled || loading)"
    :aria-disabled="to && (disabled || loading) ? 'true' : undefined"
    :class="[
      'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      sizeClasses,
      variantClasses,
      fullWidth ? 'w-full' : '',
      disabled || loading ? 'opacity-60 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
    ]"
    @click="handleClick"
  >
    <svg
      v-if="loading"
      class="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

interface Props {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'demo';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  to?: RouteLocationRaw;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  loading: false,
  fullWidth: false,
  to: undefined,
});

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();

const handleClick = (event: MouseEvent) => {
  if (props.disabled || props.loading) {
    event.preventDefault();
    return;
  }
  emit('click', event);
};

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'px-3 py-1.5 text-xs';
    case 'lg':
      return 'px-5 py-3 text-base';
    case 'md':
    default:
      return 'px-4 py-2 text-sm';
  }
});

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'secondary':
      return 'bg-cream-muted text-slate-700 hover:bg-slate-200 focus-visible:ring-slate-400';
    case 'outline':
      return 'border border-slate-300 bg-white text-slate-700 hover:bg-cream-muted hover:border-slate-400 focus-visible:ring-terracotta';
    case 'ghost':
      return 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-300';
    case 'danger':
      return 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500';
    case 'demo':
      return 'bg-amber-400 text-amber-950 hover:bg-amber-300 focus-visible:ring-amber-500 border border-amber-500/40 shadow-sm';
    case 'primary':
    default:
      return 'bg-terracotta text-white hover:bg-terracotta-hover focus-visible:ring-terracotta shadow-sm';
  }
});
</script>
