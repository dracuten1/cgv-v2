<template>
  <div class="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
    <!-- Loading -->
    <div
      v-if="memberStore.loading && !memberStore.currentMember"
      class="bg-white rounded-xl border border-slate-200 py-16 flex flex-col items-center gap-3"
      data-testid="member-loading"
    >
      <svg class="animate-spin h-8 w-8 text-[#C85A32]" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <p class="text-sm text-slate-500">Đang tải hồ sơ…</p>
    </div>

    <!-- Not found / error -->
    <EmptyState
      v-else-if="!memberStore.currentMember"
      title="Không tìm thấy thành viên"
      :description="memberStore.error || 'Thành viên này không tồn tại hoặc đã bị xóa.'"
    >
      <template #action>
        <AppButton variant="outline" @click="router.push('/tree')">Về cây gia phả</AppButton>
      </template>
    </EmptyState>

    <template v-else>
      <!-- Header -->
      <div class="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div class="flex items-center gap-4 min-w-0">
            <div
              class="w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center font-display font-bold text-lg uppercase"
              :style="{
                backgroundColor: `var(${genSoftVar(member.generation_index)}, #F9EAE1)`,
                color: `var(${genAccentVar(member.generation_index)}, #983F1E)`,
              }"
            >
              {{ initials }}
            </div>
            <div class="min-w-0">
              <h1 class="text-2xl font-bold font-display text-slate-800 truncate" data-testid="member-name">
                {{ member.full_name }}
              </h1>
              <div class="mt-1 flex items-center gap-2 flex-wrap">
                <AppChip :variant="chipVariant" size="sm" data-testid="member-generation-badge">
                  {{ generationLabel }}
                </AppChip>
                <AppChip :variant="member.is_living ? 'success' : 'default'" size="sm" data-testid="member-living-status">
                  {{ member.is_living ? 'Đang sống' : 'Đã mất' }}
                </AppChip>
                <span v-if="yearsText" class="text-sm text-slate-500 font-mono">{{ yearsText }}</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <template v-if="auth.isAuthenticated">
              <AppButton variant="outline" size="sm" data-testid="member-edit" @click="editOpen = true">
                <span class="flex items-center gap-1.5">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Sửa
                </span>
              </AppButton>
              <AppButton variant="danger" size="sm" data-testid="member-delete" @click="deleteConfirmOpen = true">
                <span class="flex items-center gap-1.5">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Xóa
                </span>
              </AppButton>
            </template>
            <span v-else class="text-xs text-slate-500 italic" data-testid="member-auth-hint">
              Đăng nhập để chỉnh sửa
            </span>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="bg-white rounded-xl shadow-xs border border-slate-200">
        <div class="border-b border-slate-200 flex" role="tablist" data-testid="member-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.key"
            :class="[
              'px-4 py-3 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-px',
              activeTab === tab.key
                ? 'border-[#C85A32] text-[#983F1E]'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            ]"
            :data-testid="`tab-${tab.key}`"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="p-5">
          <!-- Tab: Tổng quan -->
          <div v-if="activeTab === 'overview'" data-testid="tab-panel-overview">
            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Dòng họ</dt>
                <dd class="mt-1 text-sm text-slate-800">{{ member.family_name || '—' }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Giới tính</dt>
                <dd class="mt-1 text-sm text-slate-800" data-testid="member-gender">{{ uiGender || '—' }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Ngày sinh</dt>
                <dd class="mt-1 text-sm text-slate-800">{{ formatDate(member.birth_date) || '—' }}</dd>
              </div>
              <div>
                <dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Ngày mất</dt>
                <dd class="mt-1 text-sm text-slate-800">
                  {{ member.is_living ? '—' : (formatDate(member.death_date) || '—') }}
                </dd>
              </div>
              <div class="sm:col-span-2">
                <dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Ghi chú</dt>
                <dd class="mt-1 text-sm text-slate-700 whitespace-pre-line" data-testid="member-notes">
                  {{ member.notes || 'Chưa có ghi chú.' }}
                </dd>
              </div>
            </dl>
          </div>

          <!-- Tab: Quan hệ -->
          <div v-else-if="activeTab === 'relations'" class="space-y-6" data-testid="tab-panel-relations">
            <div v-for="group in relationGroups" :key="group.title">
              <h3 class="text-sm font-semibold text-slate-700 mb-2">{{ group.title }}</h3>
              <div v-if="group.members.length === 0" class="text-sm text-slate-400 italic">
                {{ group.emptyText }}
              </div>
              <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <router-link
                  v-for="rel in group.members"
                  :key="rel.id"
                  :to="`/members/${encodeURIComponent(rel.id)}`"
                  class="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-2.5 hover:border-[#C85A32] hover:shadow-xs transition-all"
                  :data-testid="`relation-${rel.id}`"
                >
                  <span
                    class="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold uppercase font-display"
                    :style="{
                      backgroundColor: `var(${genSoftVar(rel.generation_index)}, #F9EAE1)`,
                      color: `var(${genAccentVar(rel.generation_index)}, #983F1E)`,
                    }"
                  >
                    {{ initialsOf(rel.full_name) }}
                  </span>
                  <span class="min-w-0">
                    <span class="block text-sm font-medium text-slate-800 truncate">{{ rel.full_name }}</span>
                    <span class="block text-xs text-slate-400">{{ generationLabelOf(rel.generation_index) }}</span>
                  </span>
                </router-link>
              </div>
            </div>
          </div>

          <!-- Tab: Bảng tin -->
          <div v-else data-testid="tab-panel-posts">
            <div v-if="posts.length === 0" class="text-sm text-slate-400 italic">
              Chưa có bài viết nào.
            </div>
            <ol v-else class="space-y-4">
              <li
                v-for="post in posts"
                :key="post.id"
                class="rounded-lg border border-slate-200 p-4"
              >
                <p class="text-sm text-slate-800 whitespace-pre-line">{{ post.content }}</p>
                <p class="mt-2 text-xs text-slate-400">{{ formatDateTime(post.created_at) }}</p>
              </li>
            </ol>
          </div>
        </div>
      </div>

      <!-- Edit dialog (edit mode) -->
      <MemberEditDialog
        :open="editOpen"
        :family-id="member.family_id"
        :member="member"
        @close="editOpen = false"
      />

      <!-- Delete confirm -->
      <AppDialog :open="deleteConfirmOpen" title="Xóa thành viên" @close="deleteConfirmOpen = false">
        <p class="text-sm text-slate-700" data-testid="delete-confirm-text">
          Xóa thành viên này?
        </p>
        <p class="mt-2 text-sm text-slate-500">
          Con của thành viên này sẽ được gán lại cho vợ/chồng còn sống (nếu có), nếu không
          chúng sẽ trở thành gốc riêng. Chỉ số đời của các thành viên liên quan được giữ nguyên.
        </p>
        <template #footer>
          <AppButton variant="outline" :disabled="memberStore.loading" @click="deleteConfirmOpen = false">
            Hủy
          </AppButton>
          <AppButton
            variant="danger"
            :loading="memberStore.loading"
            data-testid="delete-confirm-button"
            @click="onDelete"
          >
            Xóa
          </AppButton>
        </template>
      </AppDialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import AppChip from '@/components/ui/AppChip.vue';
import AppDialog from '@/components/ui/AppDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import MemberEditDialog from '@/components/member/MemberEditDialog.vue';
import { useMemberStore } from '@/stores/member';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { toUiGender } from '@/api/gender';
import { getInitials, getYearsText, genAccentVar, genSoftVar } from '@/components/tree/card-visual';
import type { Member } from '@/types/api';

const route = useRoute();
const router = useRouter();
const memberStore = useMemberStore();
const auth = useAuthStore();
const toast = useToast();

const activeTab = ref<'overview' | 'relations' | 'posts'>('overview');
const editOpen = ref(false);
const deleteConfirmOpen = ref(false);

const tabs = [
  { key: 'overview' as const, label: 'Tổng quan' },
  { key: 'relations' as const, label: 'Quan hệ' },
  { key: 'posts' as const, label: 'Bảng tin' },
];

const memberId = computed(() => String(route.params.id || ''));
const member = computed(() => memberStore.currentMember!);

const initials = computed(() => getInitials(member.value?.full_name || ''));
const uiGender = computed(() => (member.value ? toUiGender(member.value.gender) : ''));
const yearsText = computed(() =>
  member.value ? getYearsText(member.value.birth_date, member.value.death_date) : ''
);
const generationLabel = computed(() =>
  member.value ? `Đời thứ ${member.value.generation_index}` : ''
);
const chipVariant = computed(() => {
  const idx = member.value?.generation_index ?? 1;
  const variants = ['gen1', 'gen2', 'gen3', 'gen4'] as const;
  return variants[(idx - 1) % 4];
});

const posts = computed(() => member.value?.posts || []);

interface RelationGroup {
  title: string;
  emptyText: string;
  members: Member[];
}

const relationGroups = computed<RelationGroup[]>(() => {
  const rel = member.value?.relations;
  return [
    { title: 'Cha mẹ', emptyText: 'Chưa có thông tin cha mẹ.', members: rel?.parents || [] },
    { title: 'Vợ chồng', emptyText: 'Chưa có thông tin vợ/chồng.', members: rel?.spouses || [] },
    { title: 'Anh chị em', emptyText: 'Không có anh chị em.', members: rel?.siblings || [] },
    { title: 'Con cái', emptyText: 'Chưa có thông tin con cái.', members: rel?.children || [] },
  ];
});

function initialsOf(name: string): string {
  return getInitials(name);
}

function generationLabelOf(genIndex: number): string {
  return `Đời thứ ${genIndex}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN');
}

async function onDelete(): Promise<void> {
  try {
    await memberStore.deleteMember(member.value.id);
    toast.success('Đã xóa thành viên.');
    deleteConfirmOpen.value = false;
    router.push('/tree');
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Đã có lỗi xảy ra.');
  }
}

async function load(): Promise<void> {
  if (!memberId.value) return;
  await memberStore.fetchMember(memberId.value);
}

onMounted(load);
watch(memberId, () => {
  activeTab.value = 'overview';
  load();
});
</script>
