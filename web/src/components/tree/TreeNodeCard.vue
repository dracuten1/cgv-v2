<template>
  <!-- Collapsed dot marker (< 0.6x zoom) -->
  <button
    v-if="collapsed"
    type="button"
    :aria-label="ariaLabel"
    :class="[
      'absolute -translate-x-1/2 -translate-y-1/2 rounded-full cursor-pointer transition-transform duration-100 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-terracotta',
      selected ? 'ring-2 ring-terracotta scale-125' : 'hover:scale-125',
    ]"
    :style="{
      left: `${node.x + node.width / 2}px`,
      top: `${node.y + node.height / 2}px`,
      width: '14px',
      height: '14px',
      backgroundColor: `var(${accentVar}, var(--color-terracotta))`,
    }"
    @click.stop="onClick"
  />

  <!-- Full node card (>= 0.6x zoom) -->
  <button
    v-else
    type="button"
    :aria-label="ariaLabel"
    :class="[
      'absolute text-left rounded-lg transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-terracotta',
      'border border-tree-card-border bg-tree-card-bg hover:border-tree-card-border-hover',
      isSelf ? 'ring-2 ring-tree-self-ring shadow-sm' : (selected ? 'ring-2 ring-terracotta shadow-md' : 'shadow-xs hover:shadow-md'),
      !node.is_living ? 'opacity-85' : '',
    ]"
    :style="{
      left: `${node.x}px`,
      top: `${node.y}px`,
      width: `${node.width}px`,
      height: `${node.height}px`,
      borderLeftWidth: '4px',
      borderLeftColor: `var(${accentVar}, var(--color-terracotta))`,
    }"
    @click.stop="onClick"
  >
    <div class="h-full px-2.5 py-1.5 flex items-center space-x-2 overflow-hidden">
      <!-- Circular Avatar Image & Robust Error Fallback (M12) -->
      <div
        class="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-slate-200 bg-slate-100 font-medium text-xs text-slate-600"
      >
        <img
          v-if="node.avatar_url && !hasAvatarError"
          :src="node.avatar_url"
          :alt="node.full_name"
          class="w-full h-full object-cover"
          @error="hasAvatarError = true"
        />
        <span v-else>{{ initials }}</span>
      </div>

      <!-- Text details -->
      <div class="min-w-0 flex-1 flex flex-col justify-center">
        <!-- Full name & "Đây là tôi" button header -->
        <div class="flex items-center justify-between gap-1">
          <p class="text-xs font-semibold text-slate-800 truncate font-display" style="line-height: 1.45;">
            {{ node.full_name }}
          </p>

          <!-- "Đây là tôi" link self button for logged-in unlinked non-demo users -->
          <button
            v-if="canLinkSelf"
            type="button"
            class="shrink-0 px-1.5 py-0.5 text-[9px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors cursor-pointer"
            style="line-height: 1.45;"
            title="Liên kết tài khoản của bạn với thành viên này"
            data-testid="link-self"
            @click.stop.prevent="handleLinkSelf"
          >
            Đây là tôi
          </button>
        </div>

        <!-- Years + gender chip + kinship badge row -->
        <div class="mt-0.5 flex items-center space-x-1.5 text-[11px] text-slate-500">
          <span
            :class="[
              'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-normal',
              uiGender === 'Nam'
                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200',
            ]"
            data-testid="gender-chip"
          >
            {{ uiGender }}
          </span>

          <!-- "Tôi" badge (if self) -->
          <span
            v-if="isSelf"
            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-tree-self-badge text-tree-self-text border border-blue-200"
            style="line-height: 1.45;"
            title="Bản thân"
            data-testid="self-badge"
          >
            Tôi
          </span>

          <!-- Kinship badge (if relative and not self) -->
          <span
            v-else-if="kinshipInfo.badge"
            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200"
            style="line-height: 1.45;"
            :title="kinshipInfo.full"
            data-testid="kinship-badge"
          >
            {{ kinshipInfo.badge }}
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
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { toUiGender } from '@/api/gender';
import type { PositionedNode } from '@/composables/useTreeLayout';
import { getInitials, getYearsText, genAccentVar } from './card-visual';
import { useAuthStore } from '@/stores/auth';
import { useTreeStore } from '@/stores/tree';
import { useKinshipBadge } from '@/composables/useKinshipBadge';
import { useToast } from '@/composables/useToast';

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
const authStore = useAuthStore();
const treeStore = useTreeStore();
const { format } = useKinshipBadge();
const toast = useToast();

const hasAvatarError = ref(false);

// Latch Reset Watcher (M12): resets error state when avatar_url changes or node recycles
watch(
  () => props.node.avatar_url,
  () => {
    hasAvatarError.value = false;
  }
);

const uiGender = computed(() => toUiGender(props.node.gender));

const accentVar = computed(() => genAccentVar(props.node.generation_index));

const ariaLabel = computed(() => `${props.node.full_name}, Đời thứ ${props.node.generation_index}`);

const initials = computed(() => getInitials(props.node.full_name));

const yearsText = computed(() =>
  getYearsText(props.node.birth_date, props.node.death_date, props.node.is_living)
);

// "Tôi" Identity Highlighting
const isSelf = computed(() => authStore.user?.member_id === props.node.id);

// Kinship Badge Display
const rawKinship = computed(() => treeStore.kinshipLabels[props.node.id]);
const kinshipInfo = computed(() => format(rawKinship.value));

// "Đây là tôi" (Link Self) Quick Action
// Eligible when: authenticated, user.member_id is null, not demo
const canLinkSelf = computed(() => {
  return (
    authStore.isAuthenticated &&
    !authStore.user?.member_id &&
    !authStore.isDemo
  );
});

async function handleLinkSelf(): Promise<void> {
  try {
    await authStore.linkSelfToMember(props.node.id);
    toast.success(`Đã liên kết tài khoản với ${props.node.full_name}`);
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Không thể liên kết tài khoản.');
  }
}

const onClick = () => {
  emit('select', props.node.id);
  if (router) {
    router.push(`/members/${encodeURIComponent(props.node.id)}`);
  }
};
</script>
