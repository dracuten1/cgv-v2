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
    <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
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
