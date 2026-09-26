<template>
  <div :class="gridClasses" data-testid="image-grid">
    <a
      v-for="(image, index) in limitedImages"
      :key="`${image}-${index}`"
      :href="image"
      target="_blank"
      rel="noopener noreferrer"
      class="block overflow-hidden rounded-lg bg-cream-muted aspect-square"
      @click.stop
    >
      <img
        :src="image"
        alt="Ảnh bài viết"
        loading="lazy"
        class="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
      />
    </a>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  images: string[];
}

const props = defineProps<Props>();

/**
 * Image layout rules (F6):
 * - 1 image  → full width
 * - 2 images → 2-column grid
 * - 3+ images → 3-column grid (extra images beyond 9 are dropped)
 */
const gridClasses = computed(() => {
  const count = props.images.length;
  if (count === 1) return 'grid grid-cols-1 gap-2 mt-3';
  if (count === 2) return 'grid grid-cols-2 gap-2 mt-3';
  return 'grid grid-cols-3 gap-2 mt-3';
});

const limitedImages = computed(() => props.images.slice(0, 9));
</script>
