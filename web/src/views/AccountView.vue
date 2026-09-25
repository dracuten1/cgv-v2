<template>
  <div class="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold font-display text-slate-800">
          Tài khoản & Liên kết
        </h1>
        <p class="text-slate-500 text-sm mt-1">
          Quản lý phương thức đăng nhập và thông tin xác thực tài khoản
        </p>
      </div>

      <AppButton
        variant="outline"
        size="sm"
        class="self-start sm:self-auto text-slate-600 border-slate-300 hover:bg-slate-50"
        data-testid="logout-btn"
        @click="handleLogout"
      >
        <span class="flex items-center gap-2">
          <svg class="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Đăng xuất</span>
        </span>
      </AppButton>
    </div>

    <!-- User Profile Card -->
    <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <AppAvatar :name="authStore.displayName" size="w-14" data-testid="user-avatar" />
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-lg font-bold text-slate-800" data-testid="user-display-name">
              {{ authStore.displayName }}
            </h2>
            <AppChip v-if="authStore.isDemo" variant="warning" size="sm" data-testid="demo-badge">
              Phiên demo
            </AppChip>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">
            Mã định danh: {{ authStore.user?.id || '—' }}
          </p>
        </div>
      </div>

      <!-- Demo Account Notice -->
      <div
        v-if="authStore.isDemo"
        class="w-full sm:w-auto bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 sm:max-w-xs"
      >
        <p class="font-medium mb-0.5">Tài khoản trải nghiệm</p>
        <p class="text-amber-700">
          Tài khoản demo độc lập và không thể liên kết với các phương thức mạng xã hội thực tế.
        </p>
      </div>
    </div>

    <!-- Linked Identities Section -->
    <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
      <div>
        <h3 class="text-base font-bold text-slate-800 font-display">
          Phương thức đăng nhập đã liên kết
        </h3>
        <p class="text-xs text-slate-500 mt-0.5">
          Danh sách các tài khoản dùng để đăng nhập vào hệ thống
        </p>
      </div>

      <!-- Identity Cards List -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="identity in authStore.identities"
          :key="identity.id"
          class="border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-slate-300 transition-colors bg-cream-muted/50"
          :data-testid="`identity-card-${identity.id}`"
        >
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex items-center gap-2.5">
              <span class="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-sm font-bold shadow-2xs">
                <component
                  :is="providerIcon(identity.provider)"
                  v-if="providerIcon(identity.provider)"
                  class="w-4 h-4"
                />
                <template v-else>{{ getProviderLetter(identity.provider) }}</template>
              </span>
              <div>
                <span class="text-sm font-semibold text-slate-800">
                  {{ getProviderLabel(identity.provider) }}
                </span>
                <div class="text-[11px] text-slate-400 font-mono truncate max-w-[180px]">
                  {{ identity.provider_subject }}
                </div>
              </div>
            </div>

            <!-- Unlink Button -->
            <div>
              <AppButton
                variant="ghost"
                size="sm"
                :disabled="isSoleIdentity"
                :title="isSoleIdentity ? 'Không thể hủy liên kết phương thức đăng nhập duy nhất' : 'Hủy liên kết'"
                class="text-xs text-red-600 hover:bg-red-50"
                :data-testid="`unlink-btn-${identity.id}`"
                @click="openUnlinkDialog(identity)"
              >
                Hủy liên kết
              </AppButton>
            </div>
          </div>

          <!-- Identity Details -->
          <div class="text-[11px] text-slate-500 space-y-1 pt-2 border-t border-slate-200/60">
            <div class="flex justify-between">
              <span>Thời gian liên kết:</span>
              <span class="font-medium text-slate-700">{{ formatViDate(identity.linked_at) }}</span>
            </div>
            <div class="flex justify-between">
              <span>Đăng nhập gần nhất:</span>
              <span class="font-medium text-slate-700">{{ formatViDate(identity.last_login_at) }}</span>
            </div>
          </div>

          <!-- Sole Identity Hint -->
          <p v-if="isSoleIdentity" class="text-[11px] text-amber-600 mt-2 italic">
            Phương thức đăng nhập duy nhất
          </p>
        </div>
      </div>

      <!-- Add Provider Section (Hidden for Demo accounts) -->
      <div v-if="!authStore.isDemo" class="pt-6 border-t border-slate-100">
        <h4 class="text-sm font-semibold text-slate-700 mb-3">
          Thêm phương thức đăng nhập
        </h4>
        <div class="flex flex-wrap gap-3">
          <AppButton
            v-for="prov in linkableProviders"
            :key="prov.id"
            variant="outline"
            size="sm"
            class="border-slate-300 text-slate-700 hover:bg-slate-50"
            @click="startLinking(prov.id)"
          >
            <span class="flex items-center gap-2">
              <span>{{ getProviderLetter(prov.id) }}</span>
              <span>Liên kết với {{ prov.name }}</span>
            </span>
          </AppButton>
        </div>
      </div>
    </div>

    <!-- Contact Points Section -->
    <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
      <div>
        <h3 class="text-base font-bold text-slate-800 font-display">
          Điểm liên hệ (Email & Số điện thoại)
        </h3>
        <p class="text-xs text-slate-500 mt-0.5">
          Dùng để nhận thông báo dòng họ và tự động liên kết tài khoản an toàn
        </p>
      </div>

      <!-- Contacts List -->
      <div v-if="authStore.contacts.length > 0" class="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
        <div
          v-for="contact in authStore.contacts"
          :key="contact.id"
          class="p-3.5 flex items-center justify-between gap-3 bg-white hover:bg-slate-50/60 transition-colors"
          :data-testid="`contact-row-${contact.id}`"
        >
          <div class="flex items-center gap-3">
            <span class="w-7 h-7 rounded-full bg-cream-muted text-slate-600 flex items-center justify-center">
              <IconEnvelope v-if="contact.kind === 'email'" class="w-3.5 h-3.5" />
              <IconPhone v-else class="w-3.5 h-3.5" />
            </span>
            <div>
              <div class="text-sm font-medium text-slate-800">
                {{ contact.value }}
              </div>
              <div class="text-[11px] text-slate-400">
                {{ contact.kind === 'email' ? 'Email' : 'Số điện thoại' }}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <AppChip
              v-if="contact.verified"
              variant="success"
              size="sm"
              data-testid="contact-verified-badge"
            >
              Đã xác thực
            </AppChip>
            <div v-else class="flex items-center gap-2">
              <AppChip variant="warning" size="sm">
                Chưa xác thực
              </AppChip>
              <AppButton
                variant="outline"
                size="sm"
                :loading="verifyingContactId === contact.id"
                class="text-xs py-1 px-2 border-slate-300"
                @click="triggerVerifyContact(contact.id)"
              >
                Xác thực
              </AppButton>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="text-xs text-slate-500 italic p-3 bg-cream-muted/60 rounded-lg border border-slate-200">
        Chưa có điểm liên hệ nào được lưu.
      </div>

      <!-- Add Contact Point Form -->
      <div class="pt-4 border-t border-slate-100">
        <h4 class="text-sm font-semibold text-slate-700 mb-3">
          Thêm điểm liên hệ mới
        </h4>
        <form class="flex flex-col sm:flex-row items-end gap-3" @submit.prevent="submitAddContact">
          <div class="w-full sm:w-40">
            <AppSelect
              v-model="newContactKind"
              label="Loại"
              :options="[
                { value: 'email', label: 'Email' },
                { value: 'phone', label: 'Số điện thoại' },
              ]"
            />
          </div>
          <div class="w-full sm:flex-1">
            <AppInput
              v-model="newContactValue"
              :label="newContactKind === 'email' ? 'Địa chỉ email' : 'Số điện thoại'"
              :placeholder="newContactKind === 'email' ? 'vidu@domain.com' : '0912345678'"
              required
            />
          </div>
          <AppButton
            type="submit"
            variant="primary"
            size="md"
            :loading="addingContact"
            class="w-full sm:w-auto flex-shrink-0"
          >
            Thêm liên hệ
          </AppButton>
        </form>
      </div>
    </div>

    <!-- Confirm Unlink Dialog -->
    <AppDialog
      :open="isUnlinkDialogOpen"
      title="Xác nhận hủy liên kết"
      @close="isUnlinkDialogOpen = false"
    >
      <div class="space-y-3">
        <p class="text-sm text-slate-700">
          Bạn có chắc chắn muốn hủy liên kết phương thức đăng nhập
          <span class="font-bold text-slate-900">
            {{ selectedIdentity ? getProviderLabel(selectedIdentity.provider) : '' }}
          </span>
          không?
        </p>
        <p class="text-xs text-slate-500">
          Sau khi hủy, bạn sẽ không thể sử dụng tài khoản này để đăng nhập trực tiếp trừ khi liên kết lại.
        </p>
      </div>

      <template #footer>
        <AppButton
          variant="outline"
          size="sm"
          @click="isUnlinkDialogOpen = false"
        >
          Hủy bỏ
        </AppButton>
        <AppButton
          variant="danger"
          size="sm"
          :loading="unlinking"
          data-testid="confirm-unlink-btn"
          @click="confirmUnlink"
        >
          Xác nhận hủy
        </AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, type Component } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import AppButton from '@/components/ui/AppButton.vue';
import AppChip from '@/components/ui/AppChip.vue';
import AppAvatar from '@/components/ui/AppAvatar.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import AppDialog from '@/components/ui/AppDialog.vue';
import { IconEnvelope, IconPhone, IconSparkles, IconUserCircle } from '@/components/icons';
import type { UserIdentity } from '@/types/api';

const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const isSoleIdentity = computed(() => authStore.identities.length <= 1);

const linkableProviders = [
  { id: 'google', name: 'Google' },
  { id: 'facebook', name: 'Facebook' },
  { id: 'zalo', name: 'Zalo' },
];

function getProviderLabel(provider: string): string {
  switch (provider) {
    case 'google':
      return 'Google';
    case 'facebook':
      return 'Facebook';
    case 'zalo':
      return 'Zalo';
    case 'email':
      return 'Email Magic Link';
    case 'demo':
      return 'Dùng thử (Demo)';
    case 'mock':
      return 'Mock Provider';
    default:
      return provider.toUpperCase();
  }
}

function getProviderLetter(provider: string): string {
  switch (provider) {
    case 'google':
      return 'G';
    case 'facebook':
      return 'f';
    case 'zalo':
      return 'Z';
    default:
      return provider.charAt(0).toUpperCase();
  }
}

// Emoji glyphs replaced by the shared icon set (spec §5): envelope for email
// magic link, sparkles for demo, user-circle for unknown providers. Brand
// letters (G/f/Z) stay text marks.
function providerIcon(provider: string): Component | null {
  switch (provider) {
    case 'email':
      return IconEnvelope;
    case 'demo':
      return IconSparkles;
    case 'mock':
      return IconUserCircle;
    default:
      return null;
  }
}

function formatViDate(isoString?: string): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
}

function startLinking(provider: string) {
  authStore.linkProviderStart(provider);
}

// Unlink flow
const isUnlinkDialogOpen = ref(false);
const selectedIdentity = ref<UserIdentity | null>(null);
const unlinking = ref(false);

function openUnlinkDialog(identity: UserIdentity) {
  if (isSoleIdentity.value) {
    toast.warning('Không thể hủy liên kết phương thức đăng nhập duy nhất của tài khoản.');
    return;
  }
  selectedIdentity.value = identity;
  isUnlinkDialogOpen.value = true;
}

async function confirmUnlink() {
  if (!selectedIdentity.value) return;

  unlinking.value = true;
  try {
    await authStore.unlinkIdentity(selectedIdentity.value.id);
    toast.success('Hủy liên kết thành công.');
    isUnlinkDialogOpen.value = false;
  } catch (err: any) {
    toast.warning(err?.message || 'Không thể hủy liên kết phương thức đăng nhập duy nhất của tài khoản.');
  } finally {
    unlinking.value = false;
  }
}

// Contact points flow
const newContactKind = ref<'email' | 'phone'>('email');
const newContactValue = ref('');
const addingContact = ref(false);
const verifyingContactId = ref<string | null>(null);

async function submitAddContact() {
  if (!newContactValue.value.trim()) {
    toast.error('Vui lòng nhập giá trị liên hệ.');
    return;
  }

  addingContact.value = true;
  try {
    await authStore.addContact(newContactKind.value, newContactValue.value.trim());
    toast.success('Đã thêm điểm liên hệ thành công.');
    newContactValue.value = '';
  } catch (err: any) {
    toast.error(err?.message || 'Thêm điểm liên hệ thất bại.');
  } finally {
    addingContact.value = false;
  }
}

async function triggerVerifyContact(contactId: string) {
  verifyingContactId.value = contactId;
  try {
    await authStore.verifyContact(contactId);
    toast.success('Đã gửi yêu cầu xác thực đến điểm liên hệ của bạn.');
  } catch (err: any) {
    toast.error(err?.message || 'Gửi yêu cầu xác thực thất bại.');
  } finally {
    verifyingContactId.value = null;
  }
}

async function handleLogout() {
  try {
    await authStore.logout();
    toast.info('Đã đăng xuất thành công.');
    await router.push('/login');
  } catch (err: any) {
    toast.error(err?.message || 'Đăng xuất thất bại.');
  }
}

onMounted(async () => {
  // Always refresh profile on Account view
  await authStore.fetchMe(true);
});
</script>