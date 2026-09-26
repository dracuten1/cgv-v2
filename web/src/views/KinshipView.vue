<template>
  <div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
    <!-- Header -->
    <div class="text-center sm:text-left pb-4 border-b border-slate-200">
      <h1 class="text-2xl sm:text-3xl font-bold font-display text-slate-800">
        Tính quan hệ họ hàng
      </h1>
      <p class="text-slate-500 text-sm mt-1">
        Xác định danh xưng gia tộc chính xác theo chuẩn văn hóa Việt Nam
      </p>
    </div>

    <!-- Quick-demo Chip (demo entry point → amber per INV-04) -->
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-xs text-slate-500 font-medium">Lối tắt thử nghiệm:</span>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500 transition-colors cursor-pointer"
        data-testid="quick-demo-chip"
        @click="fillQuickDemo"
      >
        <IconSparkles class="w-3.5 h-3.5 shrink-0" />
        <span>Thử nhanh: Ông → Cháu nội (Nguyễn Văn An → Nguyễn Văn Bình)</span>
      </button>
    </div>

    <!-- Member list failure: pickers stay empty, say why (never silent) -->
    <div
      v-if="membersError"
      class="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
      data-testid="members-error"
    >
      {{ membersError }}
    </div>

    <!-- Main Calculator Form Card -->
    <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
      <div class="relative grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Swap direction button (desktop: centered between the two pickers) -->
        <button
          type="button"
          class="hidden md:flex absolute left-1/2 top-9 -translate-x-1/2 z-20 w-8 h-8 items-center justify-center rounded-full bg-white border border-slate-300 text-slate-500 shadow-sm hover:text-terracotta hover:border-terracotta focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-terracotta transition-colors cursor-pointer"
          aria-label="Đổi vị trí hai người"
          data-testid="swap-pickers-desktop"
          @click="swapSelections"
        >
          <IconChevronLeft class="w-3.5 h-3.5" />
          <IconChevronRight class="w-3.5 h-3.5 -ml-1.5" />
        </button>

        <!-- Person 1 Picker -->
        <div class="space-y-2">
          <label class="block text-sm font-medium text-slate-700">
            Người thứ nhất (Người gọi / Bắt đầu) <span class="text-red-500">*</span>
          </label>
          <AppCombobox
            v-model="kinshipStore.fromMemberId"
            :options="pickerOptions"
            placeholder="Tìm và chọn người thứ nhất…"
            empty-text="Không tìm thấy thành viên phù hợp"
            :disabled="loadingMembers"
            data-testid="picker-input-1"
          />
        </div>

        <!-- Person 2 Picker -->
        <div class="space-y-2">
          <label class="block text-sm font-medium text-slate-700">
            Người thứ hai (Người được gọi / Cần tính) <span class="text-red-500">*</span>
          </label>
          <AppCombobox
            v-model="kinshipStore.toMemberId"
            :options="pickerOptions"
            placeholder="Tìm và chọn người thứ hai…"
            empty-text="Không tìm thấy thành viên phù hợp"
            :disabled="loadingMembers"
            data-testid="picker-input-2"
          />
        </div>
      </div>

      <!-- Mobile swap button (pickers stack; control sits between them) -->
      <div class="flex md:hidden justify-center -mt-2">
        <button
          type="button"
          class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-300 text-xs font-medium text-slate-500 shadow-sm hover:text-terracotta hover:border-terracotta focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-terracotta transition-colors cursor-pointer"
          aria-label="Đổi vị trí hai người"
          data-testid="swap-pickers-mobile"
          @click="swapSelections"
        >
          <IconChevronLeft class="w-3.5 h-3.5" />
          <span>Đổi chiều</span>
          <IconChevronRight class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Dialect AppSelect -->
      <div class="pt-2 max-w-xs">
        <AppSelect
          v-model="kinshipStore.dialect"
          label="Phương ngữ xưng hô"
          :options="[
            { value: 'bac', label: 'Miền Bắc (Chuẩn)' },
            { value: 'trung', label: 'Miền Trung' },
            { value: 'nam', label: 'Miền Nam' },
          ]"
        />
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-3 pt-4 border-t border-slate-100">
        <AppButton
          variant="primary"
          size="md"
          :loading="kinshipStore.loading"
          :disabled="!kinshipStore.fromMemberId || !kinshipStore.toMemberId"
          data-testid="calculate-btn"
          @click="handleCalculate"
        >
          Tính quan hệ
        </AppButton>

        <AppButton
          variant="outline"
          size="md"
          data-testid="reset-btn"
          @click="handleReset"
        >
          Chọn lại
        </AppButton>
      </div>

      <!-- Error notification -->
      <div
        v-if="kinshipStore.error"
        class="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
        data-testid="kinship-error"
      >
        {{ kinshipStore.error }}
      </div>
    </div>

    <!-- Initial prompt: guidance before both people are chosen -->
    <div
      v-if="!bothSelected && !kinshipStore.result"
      class="bg-cream-muted/60 rounded-xl border border-dashed border-slate-300 p-6 flex items-start gap-4"
      data-testid="kinship-initial-prompt"
    >
      <div class="w-10 h-10 rounded-full bg-terracotta-soft text-terracotta flex items-center justify-center shrink-0">
        <IconSparkles class="w-5 h-5" />
      </div>
      <div class="text-left">
        <h2 class="text-base font-semibold font-display text-slate-800" style="line-height: 1.45">
          Chọn hai người để tính quan hệ
        </h2>
        <p class="text-sm text-slate-500 mt-1 leading-relaxed">
          Chọn người gọi và người được gọi ở hai ô phía trên, rồi bấm “Tính quan hệ” để xem danh xưng
          chuẩn theo từng chi họ.
        </p>
      </div>
    </div>

    <!-- Unrelated result: engine returns the fallback term when no relation is in the graph -->
    <div
      v-else-if="kinshipStore.result && isUnrelated"
      class="bg-terracotta-soft rounded-xl border border-terracotta-border p-6 flex items-start gap-4"
      data-testid="kinship-unrelated"
    >
      <div class="w-10 h-10 rounded-full bg-white text-terracotta flex items-center justify-center shrink-0 shadow-xs">
        <IconExclamationCircle class="w-5 h-5" />
      </div>
      <div class="text-left">
        <h2 class="text-base font-semibold font-display text-slate-800" style="line-height: 1.45">
          Không tìm thấy quan hệ họ hàng
        </h2>
        <p class="text-sm text-slate-600 mt-1 leading-relaxed">
          Hai người này không có quan hệ trong phạm vi tra cứu hoặc thuộc hai nhánh khác nhau của gia
          tộc. Hãy thử đổi chiều hoặc chọn lại hai người.
        </p>
      </div>
    </div>

    <!-- Result Display Panel -->
    <div v-else-if="kinshipStore.result" data-testid="kinship-result-container">
      <KinshipResult
        :result="kinshipStore.result"
        :member-map="memberMap"
        :from-name="fromMemberName"
        :to-name="toMemberName"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useKinshipStore } from '@/stores/kinship';
import { membersApi } from '@/api/members';
import { formatApiError } from '@/api/client';
import { useToast } from '@/composables/useToast';
import AppCombobox from '@/components/ui/AppCombobox.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import AppButton from '@/components/ui/AppButton.vue';
import KinshipResult from '@/components/kinship/KinshipResult.vue';
import { IconChevronLeft, IconChevronRight, IconSparkles, IconExclamationCircle } from '@/components/icons';
import { DEMO_ROOT_ID, DEMO_GRANDSON_ID, getMissingDemoRecords } from '@/utils/demo';
import type { Member } from '@/types/api';

const kinshipStore = useKinshipStore();
const toast = useToast();

/** Single page size for the picker member list (combobox search source). */
const MEMBER_PAGE_LIMIT = 100;

const bothSelected = computed(
  () => Boolean(kinshipStore.fromMemberId) && Boolean(kinshipStore.toMemberId)
);

const isUnrelated = computed(() => {
  const result = kinshipStore.result;
  return Boolean(result && !result.line && (!result.path || result.path.length === 0));
});

const members = ref<Member[]>([]);
const loadingMembers = ref(false);
const membersError = ref<string | null>(null);

// Demo-only synthetic pair: derived from the fetched list (never pushed into
// it), so the shared member search stays uncontaminated. The records surface
// only while the API list does not already contain the demo ids (offline /
// unseeded backend), keeping the selected chips resolvable in that case.
const demoMembers = computed<Member[]>(() => getMissingDemoRecords(members.value));

const pickerOptions = computed<Member[]>(() => [...demoMembers.value, ...members.value]);

const memberMap = computed<Record<string, Member>>(() => {
  const map: Record<string, Member> = {};
  for (const m of pickerOptions.value) {
    map[m.id] = m;
  }
  return map;
});

const fromMemberName = computed(() => {
  return kinshipStore.fromMemberId ? memberMap.value[kinshipStore.fromMemberId]?.full_name || '' : '';
});

const toMemberName = computed(() => {
  return kinshipStore.toMemberId ? memberMap.value[kinshipStore.toMemberId]?.full_name || '' : '';
});

async function loadAllMembers() {
  loadingMembers.value = true;
  membersError.value = null;
  try {
    const page = await membersApi.listMembers({ limit: MEMBER_PAGE_LIMIT });
    members.value = page.items || [];
  } catch (err: unknown) {
    // If backend isn't populated or running during unit tests, graceful empty
    console.warn('[KinshipView] Không tải được danh sách thành viên:', err);
    members.value = [];
    membersError.value = formatApiError(err);
  } finally {
    loadingMembers.value = false;
  }
}

function swapSelections() {
  const from = kinshipStore.fromMemberId;
  kinshipStore.fromMemberId = kinshipStore.toMemberId;
  kinshipStore.toMemberId = from;
}

function fillQuickDemo() {
  // Names/records for the chips resolve through the derived `demoMembers`
  // computed (utils/demo.ts) — this action only selects the pair and never
  // synthesizes or mutates the shared member list.
  kinshipStore.fromMemberId = DEMO_ROOT_ID;
  kinshipStore.toMemberId = DEMO_GRANDSON_ID;
}

async function handleCalculate() {
  if (!kinshipStore.fromMemberId || !kinshipStore.toMemberId) {
    toast.error('Vui lòng chọn đầy đủ hai người cần tính quan hệ.');
    return;
  }

  const res = await kinshipStore.calculateKinship();
  if (res && !isUnrelated.value) {
    toast.success('Đã tính toán quan hệ thành công!');
  }
}

function handleReset() {
  kinshipStore.reset();
}

onMounted(() => {
  loadAllMembers();
});
</script>
