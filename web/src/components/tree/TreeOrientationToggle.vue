<template>
  <span
    class="tr-seg inline-flex p-0.5 gap-0.5 rounded-full border border-hairline bg-surface-well"
    role="group"
    aria-label="Hướng trình bày"
    data-testid="orientation-toggle"
  >
    <button
      type="button"
      :class="[
        'px-2.5 py-0.5 text-xs font-semibold rounded-full transition-colors cursor-pointer leading-tight',
        modelValue === 'vertical'
          ? 'bg-card text-ink-1 shadow-xs font-bold'
          : 'text-ink-3 hover:text-ink-1'
      ]"
      :aria-pressed="modelValue === 'vertical'"
      title="Cây mọc từ trên xuống — mặc định (owner phê duyệt 2026-09-28)"
      data-testid="orientation-vertical"
      @click="$emit('update:modelValue', 'vertical')"
    >
      Dọc
    </button>
    <button
      type="button"
      :class="[
        'px-2.5 py-0.5 text-xs font-semibold rounded-full transition-colors cursor-pointer leading-tight',
        modelValue === 'horizontal'
          ? 'bg-card text-ink-1 shadow-xs font-bold'
          : 'text-ink-3 hover:text-ink-1'
      ]"
      :aria-pressed="modelValue === 'horizontal'"
      title="Cây mọc từ trái sang — họ rộng thành cuộn dọc dễ đọc"
      data-testid="orientation-horizontal"
      @click="$emit('update:modelValue', 'horizontal')"
    >
      Ngang
    </button>
  </span>
</template>

<script setup lang="ts">
import type { TreeOrientation } from '@/composables/useTreeLayout';

defineProps<{
  modelValue: TreeOrientation;
}>();

defineEmits<{
  (e: 'update:modelValue', value: TreeOrientation): void;
}>();
</script>
