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
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m0-16a4 4 0 0 0-4 4v2m4-6a4 4 0 0 1 4 4v2m-8 6h8m-8 0a3 3 0 1 0 0 6h8a3 3 0 1 0 0-6" />
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
