<template>
  <!-- Collapsed dot marker (< 0.6x zoom) -->
  <button
    v-if="collapsed"
    type="button"
    :aria-label="ariaLabel"
    :class="[
      'absolute -translate-x-1/2 -translate-y-1/2 rounded-full cursor-pointer transition-transform duration-100 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#C85A32]',
      selected ? 'ring-2 ring-[#C85A32] scale-125' : 'hover:scale-125',
    ]"
    :style="{
      left: `${node.x + node.width / 2}px`,
      top: `${node.y + node.height / 2}px`,
      width: '14px',
      height: '14px',
      backgroundColor: `var(${accentVar}, #C85A32)`,
    }"
    @click.stop="onClick"
  />

  <!-- Full node card (>= 0.6x zoom) -->
  <button
    v-else
    type="button"
    :aria-label="ariaLabel"
    :class="[
      'absolute text-left rounded-lg bg-white border transition-shadow cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#C85A32]',
      selected
        ? 'ring-2 ring-[#C85A32] shadow-md border-transparent'
        : 'border-slate-200 shadow-xs hover:shadow-md hover:border-slate-300',
      !node.is_living ? 'opacity-85' : '',
    ]"
    :style="{
      left: `${node.x}px`,
      top: `${node.y}px`,
      width: `${node.width}px`,
      height: `${node.height}px`,
      borderLeftWidth: '4px',
      borderLeftColor: `var(${accentVar}, #C85A32)`,
    }"
    @click.stop="onClick"
  >
    <div class="h-full px-2.5 py-1.5 flex items-center space-x-2 overflow-hidden">
      <!-- Initials circle -->
      <div
        class="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-display font-bold text-xs uppercase"
        :style="{
          backgroundColor: `var(${softAccentVar}, #F9EAE1)`,
          color: `var(${accentVar}, #983F1E)`,
        }"
      >
        <img
          v-if="node.avatar_url"
          :src="node.avatar_url"
          :alt="node.full_name"
          class="w-full h-full rounded-full object-cover"
        />
        <span v-else>{{ initials }}</span>
      </div>

      <!-- Text details -->
      <div class="min-w-0 flex-1 flex flex-col justify-center">
        <!-- Full name -->
        <p class="text-xs font-semibold text-slate-800 truncate font-display" style="line-height: 1.45;">
          {{ node.full_name }}
        </p>

        <!-- Years + gender chip row -->
        <div class="mt-0.5 flex items-center space-x-1.5 text-[11px] text-slate-500">
          <span
            :class="[
              'inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium leading-none',
              uiGender === 'Nam'
                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200',
            ]"
            data-testid="gender-chip"
          >
            {{ uiGender }}
          </span>

          <span v-if="yearsText" class="truncate text-slate-500 font-mono text-[10px]" data-testid="years-text">
            {{ yearsText }}
          </span>
        </div>
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { toUiGender } from '@/api/gender';
import type { PositionedNode } from '@/composables/useTreeLayout';
import { getInitials, getYearsText, genAccentVar, genSoftVar } from './card-visual';

interface Props {
  node: PositionedNode;
  selected?: boolean;
  collapsed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  collapsed: false,
});

const emit = defineEmits<{
  (e: 'select', id: string): void;
}>();

const router = useRouter();

const uiGender = computed(() => toUiGender(props.node.gender));

const accentVar = computed(() => genAccentVar(props.node.generation_index));
const softAccentVar = computed(() => genSoftVar(props.node.generation_index));

const ariaLabel = computed(() => `${props.node.full_name}, Đời thứ ${props.node.generation_index}`);

const initials = computed(() => getInitials(props.node.full_name));

const yearsText = computed(() => getYearsText(props.node.birth_date, props.node.death_date));

const onClick = () => {
  emit('select', props.node.id);
  if (router) {
    router.push(`/members/${encodeURIComponent(props.node.id)}`);
  }
};
</script>
