<template>
  <AppDialog
    :open="open"
    :title="isEdit ? 'Cập nhật thành viên' : 'Thêm thành viên'"
    @close="onClose"
  >
    <form class="space-y-4" @submit.prevent="onSubmit">
      <!-- LIVE PREVIEW -->
      <MemberCardPreview
        :full-name="form.fullName"
        :gender="form.gender"
        :generation-index="generationIndex"
        :birth-date="form.birthDate"
        :death-date="form.isLiving ? '' : form.deathDate"
        :is-living="form.isLiving"
      />

      <AppInput
        v-model="form.fullName"
        label="Họ và tên"
        placeholder="Nguyễn Văn An"
        required
        :error="errors.fullName"
        id="member-full-name"
      />

      <AppSelect
        v-model="form.gender"
        label="Giới tính"
        placeholder="Chọn giới tính"
        :options="genderOptions"
        required
        :error="errors.gender"
        id="member-gender"
      />

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AppInput
          v-model="form.birthDate"
          label="Ngày sinh"
          type="date"
          id="member-birth-date"
        />
        <AppInput
          v-model="form.deathDate"
          label="Ngày mất"
          type="date"
          :disabled="form.isLiving"
          id="member-death-date"
        />
      </div>

      <label class="inline-flex items-center space-x-2 cursor-pointer select-none">
        <input
          v-model="form.isLiving"
          type="checkbox"
          class="w-4 h-4 rounded border-slate-300 text-[#C85A32] focus:ring-[#C85A32] cursor-pointer"
          data-testid="member-is-living"
        />
        <span class="text-sm text-slate-700 font-medium">Đang sống</span>
      </label>

      <div class="flex flex-col">
        <label for="member-notes" class="text-sm font-medium text-slate-700 mb-1">
          Ghi chú
        </label>
        <textarea
          id="member-notes"
          v-model="form.notes"
          rows="3"
          placeholder="Ghi chú về thành viên…"
          class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-[#C85A32] focus:border-transparent hover:border-slate-400 resize-y"
        />
      </div>

      <!-- Form-level error (from API) -->
      <p v-if="submitError" class="text-sm text-red-600" data-testid="member-form-error">
        {{ submitError }}
      </p>
    </form>

    <template #footer>
      <AppButton variant="outline" @click="onClose" :disabled="memberStore.loading">
        Hủy
      </AppButton>
      <AppButton
        variant="primary"
        :loading="memberStore.loading"
        data-testid="member-save"
        @click="onSubmit"
      >
        {{ isEdit ? 'Lưu thay đổi' : 'Thêm thành viên' }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import AppDialog from '@/components/ui/AppDialog.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import type { SelectOption } from '@/components/ui/AppSelect.vue';
import MemberCardPreview from './MemberCardPreview.vue';
import { useToast } from '@/composables/useToast';
import { useMemberStore } from '@/stores/member';
import { toApiGender, toUiGender } from '@/api/gender';
import type { MemberInput } from '@/types/api';

/** Minimal editable shape — accepts MemberDetailResponse or Member. */
export interface EditableMember {
  id: string;
  family_id: string;
  full_name: string;
  gender: string;
  generation_index: number;
  birth_date?: string | null;
  death_date?: string | null;
  is_living: boolean;
  notes?: string | null;
}

interface Props {
  open: boolean;
  familyId: string;
  /** present → edit mode; null → create mode */
  member?: EditableMember | null;
}

const props = withDefaults(defineProps<Props>(), {
  member: null,
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved', memberId: string): void;
}>();

const toast = useToast();
const memberStore = useMemberStore();

const isEdit = computed(() => !!props.member);
const generationIndex = computed(() => props.member?.generation_index ?? 1);

// INV-03: the select offers VIETNAMESE options ONLY
const genderOptions: SelectOption[] = [
  { value: 'Nam', label: 'Nam' },
  { value: 'Nữ', label: 'Nữ' },
];

const emptyForm = () => ({
  fullName: '',
  gender: '',
  birthDate: '',
  deathDate: '',
  isLiving: true,
  notes: '',
});

const form = reactive(emptyForm());
const errors = reactive({ fullName: '', gender: '' });
const submitError = ref('');

// Hydrate on open (INV-03: 'male' → 'Nam' at the UI boundary)
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    submitError.value = '';
    errors.fullName = '';
    errors.gender = '';

    if (props.member) {
      form.fullName = props.member.full_name || '';
      form.gender = toUiGender(props.member.gender);
      form.birthDate = props.member.birth_date || '';
      form.deathDate = props.member.death_date || '';
      form.isLiving = props.member.is_living;
      form.notes = props.member.notes || '';
    } else {
      Object.assign(form, emptyForm());
    }
  },
  { immediate: true }
);

function validate(): boolean {
  errors.fullName = '';
  errors.gender = '';

  if (!form.fullName.trim()) {
    errors.fullName = 'Vui lòng nhập họ tên.';
    return false;
  }
  if (!form.gender) {
    errors.gender = 'Vui lòng chọn giới tính.';
    return false;
  }
  return true;
}

async function onSubmit(): Promise<void> {
  submitError.value = '';
  if (!validate()) return;

  // INV-03: form 'Nam'/'Nữ' → payload 'male'/'female' at the API boundary
  let apiGender: 'male' | 'female';
  try {
    apiGender = toApiGender(form.gender);
  } catch {
    errors.gender = 'Vui lòng chọn giới tính.';
    return;
  }

  const input: MemberInput = {
    family_id: props.member?.family_id || props.familyId,
    full_name: form.fullName.trim(),
    gender: apiGender,
    generation_index: generationIndex.value,
    birth_date: form.birthDate || null,
    death_date: form.isLiving ? null : form.deathDate || null,
    is_living: form.isLiving,
    notes: form.notes.trim() || null,
  };

  try {
    if (isEdit.value && props.member) {
      await memberStore.updateMember(props.member.id, input);
      toast.success('Đã cập nhật thành viên.');
      emit('saved', props.member.id);
    } else {
      const created = await memberStore.createMember(input);
      toast.success('Đã thêm thành viên mới.');
      emit('saved', created.id);
    }
    emit('close');
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : 'Đã có lỗi xảy ra.';
  }
}

function onClose(): void {
  if (!memberStore.loading) {
    emit('close');
  }
}
</script>
