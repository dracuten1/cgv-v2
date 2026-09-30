<template>
  <button
    v-if="hiddenCount > 0"
    type="button"
    class="tr-reveal"
    :class="{ 'is-open': isOpen }"
    :style="positionStyle"
    aria-haspopup="dialog"
    :aria-expanded="isOpen"
    aria-controls="sibling-roster"
    :title="titleText"
    data-testid="reveal-siblings-btn"
    @click.stop="onClick"
  >
    <span v-if="compact">
      +<span class="tr-reveal__n">{{ hiddenCount }}</span> khác
    </span>
    <span v-else>
      +<span class="tr-reveal__n">{{ hiddenCount }}</span> thành viên khác
    </span>
    <span class="tr-reveal__chev" aria-hidden="true">⌄</span>
  </button>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';

interface Props {
  hiddenCount: number;
  isOpen: boolean;
  compact?: boolean;
  anchorName?: string;
  position?: { x: number; y: number } | null;
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
  anchorName: '',
  position: null,
});

const emit = defineEmits<{
  (e: 'toggle'): void;
}>();

const titleText = computed(() => {
  if (props.anchorName) {
    return `${props.anchorName} còn ${props.hiddenCount} anh chị em khác bị ẩn khỏi khung — bấm để xem danh sách`;
  }
  return `Còn ${props.hiddenCount} anh chị em khác bị ẩn khỏi khung — bấm để xem danh sách`;
});

const positionStyle = computed<CSSProperties>(() => {
  if (!props.position) {
    return {};
  }
  return {
    left: `${props.position.x}px`,
    top: `${props.position.y}px`,
  };
});

function onClick(): void {
  emit('toggle');
}
</script>

<style scoped>
.tr-reveal {
  position: absolute;
  z-index: 30;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 13px 0 12px;
  border: 1px solid var(--accent-border, #CBD5E1);
  border-radius: 999px;
  background: var(--accent-tint, #EFF6FF);
  color: var(--accent-fg, #1D4ED8);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.45;
  white-space: nowrap;
  box-shadow: var(--shadow-2, 0 1px 3px rgba(0, 0, 0, 0.1));
  cursor: pointer;
  transition: background 150ms ease-out, border-color 150ms ease-out;
}

.tr-reveal:hover {
  background: color-mix(in srgb, var(--accent-tint, #EFF6FF) 65%, var(--surface-card, #FFFFFF) 35%);
  border-color: var(--accent, #3B82F6);
}

.tr-reveal .tr-reveal__n {
  font-family: var(--font-mono, monospace);
  font-weight: 700;
}

.tr-reveal .tr-reveal__chev {
  font-size: 12px;
  line-height: 1;
}

.tr-reveal.is-open {
  background: var(--surface-card, #FFFFFF);
  color: var(--ink-1, #0F172A);
  border-color: var(--hairline-strong, #94A3B8);
}

.tr-reveal.is-open:hover {
  background: var(--surface-well, #F1F5F9);
  border-color: var(--hairline-strong, #94A3B8);
}

@media (pointer: coarse) {
  .tr-reveal {
    min-height: 40px;
  }
}
</style>
