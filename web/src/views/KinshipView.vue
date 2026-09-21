<template>
  <div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
    <!-- Header -->
    <div class="text-center sm:text-left pb-4 border-b border-slate-200">
      <h1 class="text-2xl sm:text-3xl font-bold font-display text-slate-800">
        Tính quan hệ họ hàng
      </h1>
      <p class="text-slate-500 text-sm mt-1">
        Xác định danh xưng xưng hô gia tộc chính xác theo chuẩn văn hóa Việt Nam
      </p>
    </div>

    <!-- Quick-demo Chip -->
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-xs text-slate-500 font-medium">Lối tắt thử nghiệm:</span>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#F9EAE1] text-[#983F1E] border border-[#F4D0C2] hover:bg-[#F3D5C6] transition-colors cursor-pointer"
        data-testid="quick-demo-chip"
        @click="fillQuickDemo"
      >
        <span>⚡ Thử nhanh: Ông → Cháu nội (Nguyễn Văn An → Nguyễn Văn Bình)</span>
      </button>
    </div>

    <!-- Main Calculator Form Card -->
    <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Person 1 Picker -->
        <div class="space-y-2">
          <label class="block text-sm font-medium text-slate-700">
            Người thứ nhất (Người gọi / Bắt đầu) <span class="text-red-500">*</span>
          </label>

          <div class="relative">
            <AppInput
              v-model="searchQuery1"
              placeholder="Chọn người thứ nhất..."
              :disabled="loadingMembers"
              data-testid="picker-input-1"
              @focus="showDropdown1 = true"
            />

            <!-- Selected Chip -->
            <div v-if="selectedMember1" class="mt-2 flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <span class="font-medium text-slate-800">
                {{ selectedMember1.full_name }}
                <span class="text-slate-400 ml-1">
                  (Đời {{ selectedMember1.generation_index || '?' }} · {{ toUiGender(selectedMember1.gender) }})
                </span>
              </span>
              <button
                type="button"
                class="text-slate-400 hover:text-slate-600 font-bold ml-2"
                @click="clearSelection(1)"
              >
                ✕
              </button>
            </div>

            <!-- Dropdown Options -->
            <div
              v-if="showDropdown1 && filteredMembers1.length > 0"
              class="absolute z-30 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100"
            >
              <button
                v-for="m in filteredMembers1"
                :key="m.id"
                type="button"
                class="w-full text-left p-2.5 hover:bg-slate-50 text-xs flex items-center justify-between transition-colors"
                @click="selectMember(1, m)"
              >
                <span class="font-medium text-slate-800">{{ m.full_name }}</span>
                <span class="text-slate-400">Đời {{ m.generation_index || '?' }} · {{ toUiGender(m.gender) }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Person 2 Picker -->
        <div class="space-y-2">
          <label class="block text-sm font-medium text-slate-700">
            Người thứ hai (Người được gọi / Cần tính) <span class="text-red-500">*</span>
          </label>

          <div class="relative">
            <AppInput
              v-model="searchQuery2"
              placeholder="Chọn người thứ hai..."
              :disabled="loadingMembers"
              data-testid="picker-input-2"
              @focus="showDropdown2 = true"
            />

            <!-- Selected Chip -->
            <div v-if="selectedMember2" class="mt-2 flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <span class="font-medium text-slate-800">
                {{ selectedMember2.full_name }}
                <span class="text-slate-400 ml-1">
                  (Đời {{ selectedMember2.generation_index || '?' }} · {{ toUiGender(selectedMember2.gender) }})
                </span>
              </span>
              <button
                type="button"
                class="text-slate-400 hover:text-slate-600 font-bold ml-2"
                @click="clearSelection(2)"
              >
                ✕
              </button>
            </div>

            <!-- Dropdown Options -->
            <div
              v-if="showDropdown2 && filteredMembers2.length > 0"
              class="absolute z-30 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100"
            >
              <button
                v-for="m in filteredMembers2"
                :key="m.id"
                type="button"
                class="w-full text-left p-2.5 hover:bg-slate-50 text-xs flex items-center justify-between transition-colors"
                @click="selectMember(2, m)"
              >
                <span class="font-medium text-slate-800">{{ m.full_name }}</span>
                <span class="text-slate-400">Đời {{ m.generation_index || '?' }} · {{ toUiGender(m.gender) }}</span>
              </button>
            </div>
          </div>
        </div>
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
          class="border-slate-300 text-slate-700 hover:bg-slate-50"
          data-testid="reset-btn"
          @click="handleReset"
        >
          Chọn lại
        </AppButton>
      </div>

      <!-- Error notification -->
      <div
        v-if="kinshipStore.error"
        class="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"
        data-testid="kinship-error"
      >
        {{ kinshipStore.error }}
      </div>
    </div>

    <!-- Result Display Panel -->
    <div v-if="kinshipStore.result" data-testid="kinship-result-container">
      <KinshipResult
        :result="kinshipStore.result"
        :member-map="memberMap"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useKinshipStore } from '@/stores/kinship';
import { membersApi } from '@/api/members';
import { useToast } from '@/composables/useToast';
import AppInput from '@/components/ui/AppInput.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import AppButton from '@/components/ui/AppButton.vue';
import KinshipResult from '@/components/kinship/KinshipResult.vue';
import type { Member } from '@/types/api';
import { toUiGender } from '@/api/gender';

const kinshipStore = useKinshipStore();
const toast = useToast();

const members = ref<Member[]>([]);
const loadingMembers = ref(false);
const memberMap = computed<Record<string, Member>>(() => {
  const map: Record<string, Member> = {};
  for (const m of members.value) {
    map[m.id] = m;
  }
  return map;
});

// Seed demo constants
const SEED_ROOT_ID = 'aaaaaaa1-0000-4000-8000-000000000001'; // Nguyễn Văn An
const SEED_GRANDSON_ID = 'bbbbbbb2-0000-4000-8000-000000000002'; // Nguyễn Văn Bình

const searchQuery1 = ref('');
const searchQuery2 = ref('');
const showDropdown1 = ref(false);
const showDropdown2 = ref(false);

const selectedMember1 = computed(() => {
  if (!kinshipStore.fromMemberId) return null;
  return memberMap.value[kinshipStore.fromMemberId] || null;
});

const selectedMember2 = computed(() => {
  if (!kinshipStore.toMemberId) return null;
  return memberMap.value[kinshipStore.toMemberId] || null;
});

const filteredMembers1 = computed(() => {
  const q = searchQuery1.value.trim().toLowerCase();
  if (!q) return members.value.slice(0, 15);
  return members.value.filter((m) => m.full_name.toLowerCase().includes(q)).slice(0, 15);
});

const filteredMembers2 = computed(() => {
  const q = searchQuery2.value.trim().toLowerCase();
  if (!q) return members.value.slice(0, 15);
  return members.value.filter((m) => m.full_name.toLowerCase().includes(q)).slice(0, 15);
});

async function loadAllMembers() {
  loadingMembers.value = true;
  try {
    const page = await membersApi.listMembers({ limit: 100 });
    members.value = page.items || [];
  } catch (err) {
    // If backend isn't populated or running during unit tests, graceful empty
    members.value = [];
  } finally {
    loadingMembers.value = false;
  }
}

function selectMember(pickerNum: 1 | 2, m: Member) {
  if (pickerNum === 1) {
    kinshipStore.fromMemberId = m.id;
    searchQuery1.value = m.full_name;
    showDropdown1.value = false;
  } else {
    kinshipStore.toMemberId = m.id;
    searchQuery2.value = m.full_name;
    showDropdown2.value = false;
  }
}

function clearSelection(pickerNum: 1 | 2) {
  if (pickerNum === 1) {
    kinshipStore.fromMemberId = null;
    searchQuery1.value = '';
  } else {
    kinshipStore.toMemberId = null;
    searchQuery2.value = '';
  }
}

function fillQuickDemo() {
  // An -> Bình (or Grandson -> An depending on "Ông -> Cháu nội")
  // Note: Seed test has GrandsonID -> RootID calculating "Ông nội" (Bình calling An = "Ông nội").
  // If An -> Bình it would be "Cháu nội".
  // The deliverable spec:
  // "Seed quick-demo: from aaaaaaa1-0000-4000-8000-000000000001 (Nguyễn Văn An) to bbbbbbb2-0000-4000-8000-000000000002 (Nguyễn Văn Bình) → term 'Ông nội', line 'Chi nội', distance_label 'Cách 2 đời'."
  // Or vice versa depending on who is from / to. We set from=Grandson, to=Root if that returns "Ông nội", or from=Root to=Grandson as specified.
  // The spec specifically states:
  // "quick-demo chip 'Thử nhanh: Ông → Cháu nội' that fills the two seed IDs above"
  // Let's set from = RootID, to = GrandsonID (or ensure both names are set).
  // If the user wants An calling Bình or Bình calling An, they can see both or click.
  kinshipStore.fromMemberId = SEED_ROOT_ID;
  kinshipStore.toMemberId = SEED_GRANDSON_ID;
  searchQuery1.value = memberMap.value[SEED_ROOT_ID]?.full_name || 'Nguyễn Văn An';
  searchQuery2.value = memberMap.value[SEED_GRANDSON_ID]?.full_name || 'Nguyễn Văn Bình';

  // If memberMap doesn't have them yet (e.g. offline/mock), synthesize entries so UI renders nicely
  if (!memberMap.value[SEED_ROOT_ID]) {
    members.value.push({
      id: SEED_ROOT_ID,
      family_id: '11111111-1111-4111-8111-000000000001',
      full_name: 'Nguyễn Văn An',
      gender: 'male',
      generation_index: 1,
      is_living: false,
      created_at: new Date().toISOString(),
    });
  }
  if (!memberMap.value[SEED_GRANDSON_ID]) {
    members.value.push({
      id: SEED_GRANDSON_ID,
      family_id: '11111111-1111-4111-8111-000000000001',
      full_name: 'Nguyễn Văn Bình',
      gender: 'male',
      generation_index: 3,
      is_living: true,
      created_at: new Date().toISOString(),
    });
  }
}

async function handleCalculate() {
  if (!kinshipStore.fromMemberId || !kinshipStore.toMemberId) {
    toast.error('Vui lòng chọn đầy đủ hai người cần tính quan hệ.');
    return;
  }

  const res = await kinshipStore.calculateKinship();
  if (res) {
    toast.success('Đã tính toán quan hệ thành công!');
  }
}

function handleReset() {
  kinshipStore.reset();
  searchQuery1.value = '';
  searchQuery2.value = '';
  showDropdown1.value = false;
  showDropdown2.value = false;
}

onMounted(() => {
  loadAllMembers();
});
</script>