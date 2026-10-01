<template>
  <div :class="gridClasses" data-testid="image-grid">
    <a
      v-for="(image, index) in limitedImages"
      :key="`${image}-${index}`"
      :href="image"
      target="_blank"
      rel="noopener noreferrer"
      class="block aspect-square overflow-hidden rounded-app-md border border-hairline bg-well focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      @click.stop
    >
      <img
        :src="image"
        alt="Ảnh bài viết"
        loading="lazy"
        class="h-full w-full object-cover transition-transform duration-[140ms] hover:scale-105"
      />
    </a>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { MAX_ATTACHMENT_IMAGES } from '@/stores/feed/constants';

interface Props {
  images: string[];
}

const props = defineProps<Props>();

/**
 * Image layout rules (F6):
 * - 1 image  → full width
 * - 2 images → 2-column grid
 * - 3+ images → 3-column grid (extra images beyond MAX_ATTACHMENT_IMAGES are dropped)
 */
const gridClasses = computed(() => {
  const count = props.images.length;
  if (count === 1) return 'grid grid-cols-1 gap-2 mt-3';
  if (count === 2) return 'grid grid-cols-2 gap-2 mt-3';
  return 'grid grid-cols-3 gap-2 mt-3';
});

const limitedImages = computed(() => props.images.slice(0, MAX_ATTACHMENT_IMAGES));
</script>
