<template>
  <div
    class="member-card-preview rounded-xl border bg-white p-4 flex items-center space-x-3 shadow-sm"
    :style="{ borderLeftWidth: '5px', borderLeftColor: `var(${accentVar}, #C85A32)` }"
    data-testid="member-card-preview"
  >
    <!-- Initials circle (enlarged) -->
    <div
      class="w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center font-display font-bold text-lg uppercase"
      :style="{
        backgroundColor: `var(${softAccentVar}, #F9EAE1)`,
        color: `var(${accentVar}, #983F1E)`,
      }"
      data-testid="preview-initials"
    >
      {{ initials }}
    </div>

    <div class="min-w-0 flex-1">
      <p class="text-base font-bold text-slate-800 font-display truncate" style="line-height: 1.45;" data-testid="preview-name">
        {{ fullName || 'Họ và tên' }}
      </p>
      <div class="mt-1.5 flex items-center flex-wrap gap-2">
        <span
          v-if="uiGender"
          :class="[
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
            uiGender === 'Nam'
              ? 'bg-sky-50 text-sky-700 border border-sky-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200',
          ]"
          data-testid="preview-gender"
        >
          {{ uiGender }}
        </span>
        <span
          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200"
          data-testid="preview-generation"
        >
          {{ generationLabel }}
        </span>
        <span
          :class="[
            'text-xs font-medium',
            isLiving ? 'text-emerald-700' : 'text-slate-500',
          ]"
          data-testid="preview-living"
        >
          {{ isLiving ? 'Đang sống' : 'Đã mất' }}
        </span>
      </div>
      <p v-if="yearsText" class="mt-1 text-xs text-slate-500 font-mono" data-testid="preview-years">
        {{ yearsText }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { toUiGender } from '@/api/gender';
import { getInitials, getYearsText, genAccentVar, genSoftVar } from '@/components/tree/card-visual';

interface Props {
  fullName: string;
  /** Vietnamese 'Nam'/'Nữ' (INV-03: UI boundary shows Vietnamese only) */
  gender: string;
  generationIndex: number;
  birthDate?: string;
  deathDate?: string;
  isLiving: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  fullName: '',
  gender: '',
  generationIndex: 1,
  birthDate: '',
  deathDate: '',
  isLiving: true,
});

const uiGender = computed(() => toUiGender(props.gender));
const accentVar = computed(() => genAccentVar(props.generationIndex));
const softAccentVar = computed(() => genSoftVar(props.generationIndex));
const initials = computed(() => getInitials(props.fullName));
const yearsText = computed(() => getYearsText(props.birthDate, props.deathDate));
const generationLabel = computed(() => `Đời thứ ${props.generationIndex}`);
</script>
