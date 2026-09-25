<template>
  <div
    :class="[
      'relative inline-flex items-center justify-center rounded-full shrink-0 select-none overflow-hidden',
      sizeConfig.box,
      ringClass,
    ]"
  >
    <img
      v-if="src && !hasError"
      :src="src"
      :alt="alt || name || 'Avatar'"
      class="w-full h-full object-cover rounded-full border border-slate-200 bg-slate-100"
      @error="hasError = true"
    />
    <div
      v-else
      :class="[
        'w-full h-full rounded-full flex items-center justify-center font-display font-semibold uppercase',
        sizeConfig.text,
        colorClass,
      ]"
      :style="customStyle"
      :aria-label="name"
    >
      {{ initials }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { getNameInitials } from '@/utils/initials';
import { genAccentVar, genSoftVar } from '@/components/tree/card-visual';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'w-6' | 'w-9' | 'w-10' | 'w-12' | 'w-14';

interface Props {
  src?: string | null;
  name?: string;
  alt?: string;
  size?: AvatarSize;
  generation?: number;
  self?: boolean;
  selected?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  src: null,
  name: '',
  alt: '',
  size: 'md',
  generation: undefined,
  self: false,
  selected: false,
});

const hasError = ref(false);

watch(() => props.src, () => {
  hasError.value = false;
});

const initials = computed(() => {
  return getNameInitials(props.name);
});

const sizeConfig = computed(() => {
  switch (props.size) {
    case 'w-6':
    case 'sm':
      return { box: 'w-6 h-6', text: 'text-[10px]' };
    case 'w-9':
    case 'md':
      return { box: 'w-9 h-9', text: 'text-xs' };
    case 'w-10':
    case 'lg':
      return { box: 'w-10 h-10', text: 'text-sm' };
    case 'w-12':
    case 'xl':
      return { box: 'w-12 h-12', text: 'text-base' };
    case 'w-14':
    case '2xl':
      return { box: 'w-14 h-14', text: 'text-lg' };
    default:
      return { box: 'w-9 h-9', text: 'text-xs' };
  }
});

const ringClass = computed(() => {
  if (props.self) {
    return 'ring-2 ring-offset-1 ring-tree-self-ring';
  }
  if (props.selected) {
    return 'ring-2 ring-offset-1 ring-terracotta';
  }
  return '';
});

const customStyle = computed(() => {
  if (props.generation && props.generation > 0) {
    return {
      backgroundColor: `var(${genSoftVar(props.generation)})`,
      color: `var(${genAccentVar(props.generation)})`,
    };
  }
  return {};
});

const colorClass = computed(() => {
  if (!props.generation || props.generation <= 0) {
    return 'bg-terracotta-soft text-terracotta-dark';
  }
  return '';
});
</script>
