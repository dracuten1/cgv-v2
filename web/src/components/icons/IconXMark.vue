<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    :aria-hidden="!ariaLabel ? 'true' : undefined"
    :aria-label="ariaLabel"
    :role="ariaLabel ? 'img' : undefined"
  >
    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  strokeWidth?: number | string;
  ariaLabel?: string;
}>(), {
  strokeWidth: 2,
  ariaLabel: undefined,
});
</script>
