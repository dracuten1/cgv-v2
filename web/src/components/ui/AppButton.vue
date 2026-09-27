<template>
  <component
    :is="to ? 'router-link' : 'button'"
    :to="to"
    :type="to ? undefined : type"
    :disabled="to ? undefined : (disabled || loading)"
    :aria-disabled="to && (disabled || loading) ? 'true' : undefined"
    :class="[
      'inline-flex items-center justify-center font-medium rounded-app-lg transition duration-[140ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card',
      sizeClasses,
      variantClasses,
      fullWidth ? 'w-full' : '',
      disabled || loading ? 'opacity-60 cursor-not-allowed pointer-events-none' : 'cursor-pointer active:scale-[0.98]',
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
      return 'bg-well text-ink-1 hover:bg-canvas-deep focus-visible:ring-accent';
    case 'outline':
      return 'border border-hairline-strong bg-card text-ink-1 hover:bg-well hover:border-hairline-strong focus-visible:ring-accent';
    case 'ghost':
      return 'bg-transparent text-ink-2 hover:bg-canvas-deep hover:text-ink-1 focus-visible:ring-accent';
    case 'danger':
      return 'bg-danger-button text-white hover:bg-danger-hover focus-visible:ring-accent shadow-e1';
    case 'demo':
      // INV-04: semantic demo tokens retain a distinct amber-family CTA.
      return 'bg-demo-button text-white hover:bg-demo-hover focus-visible:ring-demo border border-demo-border shadow-e1';
    case 'primary':
    default:
      // Pinned test contract: bg-terracotta / text-white (compat alias → --accent-button).
      return 'bg-terracotta text-white hover:bg-terracotta-hover active:bg-accent-press focus-visible:ring-accent shadow-e1';
  }
});
</script>
