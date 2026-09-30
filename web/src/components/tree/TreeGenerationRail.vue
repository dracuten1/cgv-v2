<template>
  <nav
    v-if="bands.length > 0"
    class="tr-rail absolute z-20 flex bg-card/85 backdrop-blur-md border border-hairline shadow-e2 rounded-xl p-1 select-none"
    :class="[
      // Desktop: fixed left edge vertical column
      // Mobile: bottom edge horizontal row with overflow
      'left-3 top-1/2 -translate-y-1/2 flex-col gap-1 max-h-[80%]',
      'max-md:left-3 max-md:top-auto max-md:bottom-3 max-md:translate-y-0 max-md:flex-row max-md:max-w-[calc(100%-84px)] max-md:overflow-x-auto'
    ]"
    aria-label="Nhảy đến thế hệ"
    data-testid="generation-rail"
  >
    <button
      v-for="band in bands"
      :key="`rail-gen-${band.index}`"
      type="button"
      :class="[
        'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap leading-snug',
        activeGen === band.index
          ? 'bg-accent-tint text-accent-fg font-bold'
          : 'text-ink-2 hover:bg-well hover:text-ink-1'
      ]"
      :aria-current="activeGen === band.index ? 'true' : undefined"
      :data-testid="`rail-btn-${band.index}`"
      @click="$emit('jump', band.index)"
    >
      <span
        class="badge-dot w-2 h-2 rounded-full shrink-0"
        :style="{ backgroundColor: `var(${band.colorVar}, currentColor)` }"
      />
      <span>Đời {{ band.index }}</span>
      <span
        v-if="band.count > 0"
        class="tr-rail__count ml-auto font-normal font-mono text-ink-3 max-md:hidden pl-1"
      >
        {{ band.count }}
      </span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import type { GenerationBand } from '@/composables/useTreeLayout';

defineProps<{
  bands: GenerationBand[];
  activeGen?: number | null;
}>();

defineEmits<{
  (e: 'jump', genIndex: number): void;
}>();
</script>

<style scoped>
.tr-rail {
  scrollbar-width: thin;
}
</style>
