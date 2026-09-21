<template>
  <div class="excel-panel flex items-center gap-2">
    <!-- Export (public endpoint, no auth gate needed) -->
    <AppButton
      variant="outline"
      size="sm"
      :loading="exporting"
      data-testid="excel-export"
      @click="onExport"
    >
      <span class="flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Xuất Excel
      </span>
    </AppButton>

    <!-- Import (auth-gated) -->
    <template v-if="auth.isAuthenticated">
      <AppButton
        variant="outline"
        size="sm"
        data-testid="excel-import-open"
        @click="importOpen = true"
      >
        <span class="flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Nhập Excel
        </span>
      </AppButton>
    </template>
    <span
      v-else
      class="text-xs text-slate-500 italic"
      data-testid="excel-import-auth-hint"
    >
      Đăng nhập để nhập Excel
    </span>

    <!-- Import dialog -->
    <AppDialog :open="importOpen" title="Nhập Excel" @close="closeImport">
      <div class="space-y-4">
        <p class="text-sm text-slate-600">
          Chọn tệp Excel (.xlsx) chứa danh sách thành viên để nhập vào dòng họ
          <span class="font-semibold">{{ familyName || 'này' }}</span>.
        </p>

        <div class="flex flex-col">
          <label class="text-sm font-medium text-slate-700 mb-1">Tệp Excel</label>
          <input
            ref="fileInputEl"
            type="file"
            accept=".xlsx"
            class="block w-full text-sm text-slate-600 border border-slate-300 rounded-lg cursor-pointer bg-white focus:outline-none focus:ring-2 focus:ring-[#C85A32] file:mr-3 file:py-2 file:px-3 file:rounded-l-lg file:border-0 file:bg-[#F9EAE1] file:text-[#983F1E] file:text-sm file:font-medium"
            data-testid="excel-file-input"
            @change="onFileChange"
          />
          <p v-if="fileError" class="mt-1 text-xs text-red-600" data-testid="excel-file-error">
            {{ fileError }}
          </p>
        </div>

        <!-- Import summary -->
        <div
          v-if="summary"
          class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm space-y-1"
          data-testid="excel-import-summary"
        >
          <p class="font-semibold text-slate-800">Kết quả nhập Excel:</p>
          <p class="text-emerald-700">Đã nhập: {{ summary.created }} thành viên.</p>
          <p class="text-amber-700">Bỏ qua trùng lặp: {{ summary.skipped_duplicates }}.</p>
          <div v-if="summary.errors && summary.errors.length > 0">
            <p class="text-red-700 font-medium">Lỗi từng dòng:</p>
            <ul class="list-disc list-inside text-red-700 space-y-0.5 max-h-40 overflow-y-auto">
              <li v-for="(err, i) in summary.errors" :key="i">{{ err }}</li>
            </ul>
          </div>
        </div>

        <p v-if="importError" class="text-sm text-red-600" data-testid="excel-import-error">
          {{ importError }}
        </p>
      </div>

      <template #footer>
        <AppButton variant="outline" @click="closeImport" :disabled="importing">
          Đóng
        </AppButton>
        <AppButton
          variant="primary"
          :loading="importing"
          :disabled="!selectedFile"
          data-testid="excel-import-submit"
          @click="onImport"
        >
          Nhập file
        </AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppDialog from '@/components/ui/AppDialog.vue';
import { familiesApi } from '@/api/families';
import { formatApiError } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { useTreeStore } from '@/stores/tree';
import type { ImportSummary } from '@/types/api';

interface Props {
  familyId: string;
  familyName?: string;
}

const props = defineProps<Props>();

const auth = useAuthStore();
const toast = useToast();
const treeStore = useTreeStore();

const exporting = ref(false);
const importOpen = ref(false);
const importing = ref(false);
const selectedFile = ref<File | null>(null);
const fileError = ref('');
const importError = ref('');
const summary = ref<ImportSummary | null>(null);
const fileInputEl = ref<HTMLInputElement | null>(null);

function sanitizeFileName(name: string): string {
  return (name || 'gia pha').trim().replace(/\s+/g, '-');
}

async function onExport(): Promise<void> {
  exporting.value = true;
  try {
    const blob = await familiesApi.exportExcel(props.familyId);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFileName(props.familyName || 'gia pha')}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Đã xuất file Excel.');
  } catch (err) {
    toast.error(formatApiError(err));
  } finally {
    exporting.value = false;
  }
}

function onFileChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0] || null;
  fileError.value = '';

  if (file && !file.name.toLowerCase().endsWith('.xlsx')) {
    fileError.value = 'Vui lòng chọn tệp Excel (.xlsx).';
    selectedFile.value = null;
    return;
  }
  selectedFile.value = file;
}

async function onImport(): Promise<void> {
  if (!selectedFile.value) {
    fileError.value = 'Vui lòng chọn tệp Excel (.xlsx).';
    return;
  }

  importing.value = true;
  importError.value = '';
  try {
    const res = await familiesApi.importExcel(props.familyId, selectedFile.value);
    summary.value = res;

    if (res.created > 0 && (!res.errors || res.errors.length === 0)) {
      toast.success(`Đã nhập ${res.created} thành viên.`);
      await treeStore.invalidate();
    } else if (res.created > 0) {
      toast.warning(`Nhập được ${res.created} thành viên, có dòng lỗi.`);
      await treeStore.invalidate();
    } else {
      toast.warning('Không nhập được thành viên nào. Kiểm tra các dòng lỗi.');
    }
  } catch (err) {
    importError.value = formatApiError(err);
    toast.error(importError.value);
  } finally {
    importing.value = false;
  }
}

function closeImport(): void {
  if (importing.value) return;
  importOpen.value = false;
  selectedFile.value = null;
  summary.value = null;
  importError.value = '';
  fileError.value = '';
  if (fileInputEl.value) {
    fileInputEl.value.value = '';
  }
}
</script>
