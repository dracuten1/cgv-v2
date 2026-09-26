<template>
  <div v-if="hasResult" class="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
    <!-- Main Result Header -->
    <div class="text-center py-4 border-b border-slate-100">
      <div class="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2" style="line-height: 1.45">
        Xưng hô gia tộc
      </div>
      <div class="text-4xl sm:text-[2.75rem] font-bold font-display text-terracotta" style="line-height: 1.45">
        <span data-testid="kinship-term" class="kinship-term-quoted">{{ result.term }}</span>
      </div>
      <p v-if="grammarContext" class="mt-2 text-sm text-slate-500">
        {{ fromLabel }} <span class="text-slate-400">gọi</span> {{ toLabel }}
      </p>
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
        {{ !result.line && (!result.path || result.path.length === 0) ? 'Không rõ' : (result.is_blood ? 'Huyết thống' : 'Hôn phối') }}
      </AppChip>
      <AppChip v-if="result.dialect" variant="default">
        {{ dialectLabel }}
      </AppChip>
    </div>

    <!-- Path timeline with rich avatars and generation coding (spec §6.4 / mockup 04) -->
    <div v-if="stepItems.length > 0" class="pt-4 border-t border-slate-100">
      <h3 class="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <IconArrowRight class="w-4 h-4 text-terracotta" />
        <span>Đường dẫn quan hệ qua các đời</span>
      </h3>

      <div
        class="relative pl-8 space-y-5 before:absolute before:left-[19px] before:top-6 before:bottom-6 before:w-0.5 before:bg-slate-200"
      >
        <div
          v-for="(step, idx) in stepItems"
          :key="step.id || idx"
          class="relative group"
          :data-testid="`kinship-step-${idx}`"
        >
          <!-- Timeline avatar node with sequence index badge -->
          <div
            class="absolute -left-8 top-0 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-xs"
            :class="step.isEndpoint ? 'border-2 border-emerald-500' : 'border-2'"
            :style="step.isEndpoint ? {} : { borderColor: `var(${genAccentVar(step.generation)})` }"
          >
            <AppAvatar
              :src="step.avatarUrl"
              :name="step.name"
              :generation="step.generation"
              size="w-9"
            />
            <span
              :class="[
                'absolute -top-1 -left-1 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center border border-white',
                step.isEndpoint ? 'bg-emerald-500' : '',
              ]"
              :style="step.isEndpoint ? { lineHeight: '1.45' } : { backgroundColor: `var(${genAccentVar(step.generation)})`, lineHeight: '1.45' }"
            >
              {{ idx + 1 }}
            </span>
          </div>

          <!-- Step Content Card -->
          <div
            :class="[
              'rounded-lg p-3 border transition-colors',
              step.isEndpoint
                ? 'bg-white border-emerald-300 shadow-xs'
                : 'bg-cream-muted border-slate-200/80 hover:border-slate-300',
            ]"
          >
            <div class="flex items-center justify-between gap-2 mb-1">
              <span
                :class="[
                  'text-xs font-semibold uppercase tracking-wide',
                  step.isEndpoint ? 'text-emerald-700' : 'text-terracotta-dark',
                ]"
                style="line-height: 1.45"
              >
                {{ step.heading }}
              </span>
              <span
                v-if="step.genderLabel"
                :class="[
                  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                  step.genderBadgeClass,
                ]"
                style="line-height: 1.45"
              >
                {{ step.genderLabel }}
              </span>
            </div>

            <div class="text-sm font-medium font-display text-slate-800" style="line-height: 1.45">
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
import AppAvatar from '@/components/ui/AppAvatar.vue';
import { IconArrowRight } from '@/components/icons';
import { toUiGender, getGenderBadgeClass } from '@/api/gender';
import { genAccentVar } from '@/components/tree/card-visual';

interface Props {
  result: KinshipResult;
  memberMap?: Record<string, Member>;
  fromName?: string;
  toName?: string;
}

const props = withDefaults(defineProps<Props>(), {
  memberMap: () => ({}),
  fromName: '',
  toName: '',
});

// Defensive guard: an empty/malformed result object must not crash the
// term header or badge renders (root simply renders nothing).
const hasResult = computed(
  () => Boolean(props.result && typeof props.result === 'object')
);

const dialectLabel = computed(() => {
  switch (props.result.dialect) {
    case 'trung':
      return 'Phương ngữ: Miền Trung';
    case 'nam':
      return 'Phương ngữ: Miền Nam';
    case 'bac':
    default:
      return 'Phương ngữ: Miền Bắc (Chuẩn)';
  }
});

const fromLabel = computed(() => {
  if (props.fromName) return props.fromName;
  const path = props.result.path || [];
  if (path.length > 0 && props.memberMap[path[0]]) {
    return props.memberMap[path[0]].full_name;
  }
  return '';
});

const toLabel = computed(() => {
  if (props.toName) return props.toName;
  const path = props.result.path || [];
  if (path.length > 0 && props.memberMap[path[path.length - 1]]) {
    return props.memberMap[path[path.length - 1]].full_name;
  }
  return '';
});

const grammarContext = computed(() => {
  return Boolean(fromLabel.value && toLabel.value);
});

interface StepItem {
  id: string;
  name: string;
  heading: string;
  generation: number;
  genderLabel?: string;
  genderBadgeClass?: string;
  subtitle?: string;
  avatarUrl?: string | null;
  isEndpoint: boolean;
}

const stepItems = computed<StepItem[]>(() => {
  const path = props.result.path || [];
  if (path.length === 0) return [];

  return path.map((memberId, idx) => {
    const member = props.memberMap?.[memberId];
    const name = member?.full_name || `Thành viên (${memberId.substring(0, 8)})`;
    const gen = member?.generation_index || idx + 1;
    const heading = `Đời thứ ${gen}`;

    const genderLabel = member?.gender ? toUiGender(member.gender) : undefined;
    const genderBadgeClass = member?.gender ? getGenderBadgeClass(member.gender) : undefined;

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
      generation: gen,
      genderLabel,
      genderBadgeClass,
      subtitle,
      avatarUrl: member?.avatar_url,
      isEndpoint: idx === path.length - 1 && path.length > 1,
    };
  });
});
</script>
