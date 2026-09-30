<template>
  <div
    v-if="open"
    id="sibling-roster"
    ref="rosterEl"
    class="tr-roster"
    role="dialog"
    :aria-label="ariaLabel"
    data-testid="sibling-roster"
    tabindex="-1"
    @keydown="onKeyDown"
  >
    <div class="tr-roster__head">
      <span class="tr-roster__title">
        {{ hiddenCount }} anh chị em khác — {{ anchorName }}
      </span>
      <button
        ref="closeBtnEl"
        type="button"
        class="tr-roster__close"
        aria-label="Đóng danh sách"
        @click="onClose"
      >
        ×
      </button>
    </div>

    <div class="tr-roster__list" role="list">
      <button
        v-for="member in members"
        :key="member.id"
        type="button"
        class="tr-roster__row"
        role="listitem"
        :title="`Neo khung quanh ${member.full_name}`"
        data-testid="roster-member-row"
        @click="onSelectMember(member.id)"
      >
        <AppAvatar
          :name="member.full_name"
          :src="member.avatar_url"
          size="sm"
          :generation="member.generation_index"
          class="shrink-0"
        />
        <div class="tr-roster__body">
          <div class="tr-roster__name">
            {{ member.full_name }}
          </div>
          <div class="tr-roster__meta">
            <span class="tr-chip">{{ member.gender === 'female' ? 'Nữ' : 'Nam' }}</span>
            <span v-if="yearsText(member)">{{ yearsText(member) }}</span>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { PositionedNode } from '@/composables/useTreeLayout';
import AppAvatar from '@/components/ui/AppAvatar.vue';

interface Props {
  open: boolean;
  anchorName?: string;
  members: PositionedNode[];
  triggerEl?: HTMLElement | null;
}

const props = withDefaults(defineProps<Props>(), {
  anchorName: '',
  triggerEl: null,
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', memberId: string): void;
}>();

const rosterEl = ref<HTMLElement | null>(null);
const closeBtnEl = ref<HTMLButtonElement | null>(null);

const hiddenCount = computed(() => props.members.length);

const ariaLabel = computed(() => {
  return `Danh sách anh chị em bị ẩn của ${props.anchorName || 'thành viên'}`;
});

function yearsText(member: PositionedNode): string {
  const birth = member.birth_date ? member.birth_date.slice(0, 4) : '';
  const death = member.death_date ? member.death_date.slice(0, 4) : '';
  if (!birth && !death) return '';
  if (birth && !death) return `${birth}–`;
  return `${birth}–${death}`;
}

function onClose(): void {
  emit('close');
}

function onSelectMember(memberId: string): void {
  emit('select', memberId);
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    onClose();
  } else if (event.key === 'Tab') {
    // Focus trapping inside dialog
    if (!rosterEl.value) return;
    const focusable = rosterEl.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
}

function handleOutsideClick(event: MouseEvent): void {
  if (!props.open) return;
  const target = event.target as Node | null;
  if (!target) return;

  // If clicked inside roster or on trigger, ignore
  if (rosterEl.value && rosterEl.value.contains(target)) return;
  if (props.triggerEl && props.triggerEl.contains(target)) return;

  onClose();
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await nextTick();
      // Move focus inside dialog (close button or first row)
      const firstRow = rosterEl.value?.querySelector<HTMLButtonElement>('[data-testid="roster-member-row"]');
      if (firstRow) {
        firstRow.focus();
      } else if (closeBtnEl.value) {
        closeBtnEl.value.focus();
      }
    } else {
      // Restore focus to trigger element if provided
      if (props.triggerEl && typeof props.triggerEl.focus === 'function') {
        props.triggerEl.focus();
      }
    }
  }
);

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsideClick, true);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleOutsideClick, true);
});
</script>

<style scoped>
.tr-roster {
  position: absolute;
  z-index: 40;
  margin-top: 10px;
  width: 100%;
  max-width: 320px;
  border: 1px solid var(--hairline, #E2E8F0);
  border-radius: var(--r-lg, 12px);
  background: var(--surface-card, #FFFFFF);
  box-shadow: var(--shadow-2, 0 4px 12px rgba(0, 0, 0, 0.15));
  overflow: hidden;
  outline: none;
}

.tr-roster__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--hairline, #E2E8F0);
  background: var(--surface-quiet, #F8FAFC);
}

.tr-roster__title {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3, #64748B);
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tr-roster__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: var(--r-sm, 6px);
  background: transparent;
  color: var(--ink-3, #64748B);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: background 150ms ease-out, color 150ms ease-out;
}

.tr-roster__close:hover {
  background: var(--surface-well, #F1F5F9);
  color: var(--ink-1, #0F172A);
}

.tr-roster__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 5px;
  max-height: 220px;
  overflow-y: auto;
}

.tr-roster__row {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 6px 9px;
  border: none;
  border-radius: var(--r-md, 8px);
  background: transparent;
  text-align: left;
  line-height: 1.45;
  cursor: pointer;
  transition: background 120ms ease-out;
}

.tr-roster__row:hover,
.tr-roster__row:focus-visible {
  background: var(--surface-well, #F1F5F9);
  outline: none;
}

.tr-roster__body {
  min-width: 0;
  flex: 1;
}

.tr-roster__name {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-1, #0F172A);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tr-roster__meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 1px;
  font-size: 10px;
  color: var(--ink-3, #64748B);
  font-family: var(--font-mono, monospace);
}

.tr-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--surface-well, #F1F5F9);
  font-size: 9px;
  font-weight: 500;
}
</style>
