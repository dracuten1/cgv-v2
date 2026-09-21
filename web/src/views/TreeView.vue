<template>
  <div class="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
    <!-- Toolbar: family selector + generation filter + actions -->
    <div class="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-3">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <h1 class="text-xl font-bold font-display text-slate-800 truncate" data-testid="tree-family-name">
            {{ selectedFamily?.name || 'Cây Gia Phả' }}
          </h1>
          <AppSelect
            v-model="selectedFamilyId"
            :options="familyOptions"
            placeholder="Chọn dòng họ"
            class="md:w-56"
            @update:model-value="onFamilyChange"
          />
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- Add member (auth-gated) -->
          <AppButton
            v-if="auth.isAuthenticated"
            variant="primary"
            size="sm"
            data-testid="tree-add-member"
            @click="addOpen = true"
          >
            <span class="flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Thêm thành viên
            </span>
          </AppButton>
          <span v-else class="text-xs text-slate-500 italic" data-testid="tree-add-auth-hint">
            Đăng nhập để chỉnh sửa
          </span>

          <!-- Excel UI (owned by tree/family context) -->
          <ExcelPanel
            v-if="selectedFamilyId"
            :family-id="selectedFamilyId"
            :family-name="selectedFamily?.name"
          />
        </div>
      </div>

      <!-- Generation filter chips (TreeFilter) -->
      <div
        v-if="store.generations.length > 0"
        class="flex items-center gap-2 flex-wrap"
        data-testid="tree-generation-filter"
      >
        <button
          type="button"
          :class="chipClass(null)"
          data-testid="filter-all"
          @click="store.setGenerationFilter(null)"
        >
          Tất cả
        </button>
        <button
          v-for="gen in store.generations"
          :key="gen.index"
          type="button"
          :class="chipClass(gen.index)"
          :data-testid="`filter-gen-${gen.index}`"
          @click="store.setGenerationFilter(gen.index)"
        >
          {{ gen.label }}
          <span class="opacity-60">({{ gen.count }})</span>
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div
      v-if="store.loading"
      class="bg-white rounded-xl border border-slate-200 py-16 flex flex-col items-center justify-center gap-3"
      data-testid="tree-loading"
    >
      <svg class="animate-spin h-8 w-8 text-[#C85A32]" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <p class="text-sm text-slate-500">Đang tải cây gia phả…</p>
    </div>

    <!-- Error state -->
    <EmptyState
      v-else-if="store.error"
      title="Không thể tải cây gia phả"
      :description="store.error"
    >
      <template #action>
        <AppButton variant="outline" data-testid="tree-retry" @click="loadSelectedFamily">
          Thử lại
        </AppButton>
      </template>
    </EmptyState>

    <!-- Empty tree -->
    <EmptyState
      v-else-if="hasLoaded && store.roots.length === 0"
      title="Chưa có dữ liệu gia phả."
      description="Hãy thêm thành viên đầu tiên hoặc nhập từ file Excel."
    >
      <template #action>
        <AppButton
          v-if="auth.isAuthenticated"
          variant="primary"
          @click="addOpen = true"
        >
          Thêm thành viên
        </AppButton>
      </template>
    </EmptyState>

    <!-- Visualizer -->
    <TreeVisualizer v-else />

    <!-- Add member dialog (create mode) -->
    <MemberEditDialog
      :open="addOpen"
      :family-id="selectedFamilyId || ''"
      :member="null"
      @close="addOpen = false"
      @saved="onMemberSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import TreeVisualizer from '@/components/tree/TreeVisualizer.vue';
import ExcelPanel from '@/components/excel/ExcelPanel.vue';
import MemberEditDialog from '@/components/member/MemberEditDialog.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import type { SelectOption } from '@/components/ui/AppSelect.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import { familiesApi } from '@/api/families';
import { formatApiError } from '@/api/client';
import { useTreeStore } from '@/stores/tree';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import type { Family } from '@/types/api';

const store = useTreeStore();
const auth = useAuthStore();
const toast = useToast();

const families = ref<Family[]>([]);
const selectedFamilyId = ref<string>('');
const addOpen = ref(false);
/** true once the first fetch attempt resolved (distinguishes empty from initial). */
const hasLoaded = ref(false);

const familyOptions = computed<SelectOption[]>(() =>
  families.value.map((f) => ({ value: f.id, label: f.name }))
);

const selectedFamily = computed<Family | null>(
  () => families.value.find((f) => f.id === selectedFamilyId.value) || null
);

const activeFilter = computed(() => store.generationFilter);

function chipClass(genIndex: number | null): string[] {
  const active = activeFilter.value === genIndex;
  return [
    'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer',
    active
      ? 'bg-[#C85A32] text-white border-[#C85A32]'
      : 'bg-white text-slate-600 border-slate-200 hover:border-[#C85A32] hover:text-[#983F1E]',
  ];
}

async function loadFamilies(): Promise<void> {
  try {
    const res = await familiesApi.listFamilies();
    families.value = res.families || [];
  } catch (err) {
    toast.error(formatApiError(err));
  }
}

async function loadSelectedFamily(): Promise<void> {
  if (!selectedFamilyId.value) return;
  const res = await store.fetchTree(selectedFamilyId.value);
  hasLoaded.value = true;
  if (!res && store.error) {
    toast.error(store.error);
  }
}

async function onFamilyChange(): Promise<void> {
  hasLoaded.value = false;
  store.setGenerationFilter(null);
  store.selectMember(null);
  await loadSelectedFamily();
}

function onMemberSaved(): void {
  // member store already invalidated the tree; keep selector state as-is
}

onMounted(async () => {
  await loadFamilies();
  // Auto-select first family on mount
  if (families.value.length > 0 && !selectedFamilyId.value) {
    selectedFamilyId.value = families.value[0].id;
    await loadSelectedFamily();
  }
});
</script>
