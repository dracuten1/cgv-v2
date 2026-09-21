<template>
  <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
    <!-- Main Result Header -->
    <div class="text-center py-4 border-b border-slate-100">
      <div class="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2">
        Xưng hô gia tộc
      </div>
      <div class="text-3xl sm:text-4xl font-bold font-display text-[#C85A32]">
        <span data-testid="kinship-term" class="kinship-term-quoted">{{ result.term }}</span>
      </div>
    </div>

    <!-- Metadata Badges -->
    <div class="flex flex-wrap items-center justify-center gap-2">
      <AppChip v-if="result.line" variant="primary">
        {{ result.line }}
      </AppChip>
      <AppChip v-if="result.distance_label" variant="default">
        {{ result.distance_label }}
      </AppChip>
      <AppChip :variant="result.is_blood ? 'success' : 'warning'">
        {{ result.is_blood ? 'Huyết thống' : 'Hôn phối' }}
      </AppChip>
      <AppChip v-if="result.dialect" variant="default">
        {{ dialectLabel }}
      </AppChip>
    </div>

    <!-- Path vertical step list with numbered generation headings (INV-05 / F4) -->
    <div v-if="stepItems.length > 0" class="pt-4 border-t border-slate-100">
      <h3 class="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <svg class="w-4 h-4 text-[#C85A32]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <span>Đường dẫn quan hệ qua các đời</span>
      </h3>

      <div class="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        <div
          v-for="(step, idx) in stepItems"
          :key="step.id || idx"
          class="relative group"
          :data-testid="`kinship-step-${idx}`"
        >
          <!-- Timeline dot -->
          <div
            :class="[
              'absolute -left-6 top-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-colors',
              idx === 0
                ? 'bg-[#F9EAE1] border-[#C85A32] text-[#C85A32]'
                : idx === stepItems.length - 1
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                : 'bg-white border-slate-300 text-slate-500',
            ]"
          >
            {{ idx + 1 }}
          </div>

          <!-- Step Content -->
          <div class="bg-slate-50 rounded-lg p-3 border border-slate-200/80 group-hover:border-slate-300 transition-colors">
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="text-xs font-semibold text-[#B24E2A] uppercase tracking-wide">
                {{ step.heading }}
              </span>
              <span v-if="step.genderLabel" class="text-xs text-slate-500">
                {{ step.genderLabel }}
              </span>
            </div>
            <div class="text-sm font-medium text-slate-800">
              {{ step.name }}
            </div>
            <div v-if="step.subtitle" class="text-xs text-slate-500 mt-0.5">
              {{ step.subtitle }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { KinshipResult, Member } from '@/types/api';
import AppChip from '@/components/ui/AppChip.vue';
import { toUiGender } from '@/api/gender';

interface Props {
  result: KinshipResult;
  memberMap?: Record<string, Member>;
}

const props = withDefaults(defineProps<Props>(), {
  memberMap: () => ({}),
});

const dialectLabel = computed(() => {
  switch (props.result.dialect) {
    case 'trung':
      return 'Phương ngữ: Miền Trung';
    case 'nam':
      return 'Phương ngữ: Miền Nam';
    case 'bac':
    default:
      return 'Phương ngữ: Miền Bắc';
  }
});

interface StepItem {
  id: string;
  name: string;
  heading: string;
  genderLabel?: string;
  subtitle?: string;
}

const stepItems = computed<StepItem[]>(() => {
  const path = props.result.path || [];
  if (path.length === 0) return [];

  return path.map((memberId, idx) => {
    const member = props.memberMap?.[memberId];
    const name = member?.full_name || `Thành viên (${memberId.substring(0, 8)})`;
    const heading = member?.generation_index
      ? `Đời thứ ${member.generation_index}`
      : `Đời thứ ${idx + 1}`;

    const genderLabel = member?.gender ? toUiGender(member.gender) : undefined;

    let subtitle: string | undefined;
    if (idx === 0) {
      subtitle = 'Điểm bắt đầu';
    } else if (idx === path.length - 1) {
      subtitle = 'Đối tượng xưng hô';
    }

    return {
      id: memberId,
      name,
      heading,
      genderLabel,
      subtitle,
    };
  });
});
</script>