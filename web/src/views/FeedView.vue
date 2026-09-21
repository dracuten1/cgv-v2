<template>
  <div class="p-6 max-w-3xl mx-auto">
    <!-- PWA install banner (top) -->
    <InstallPrompt />

    <!-- Header: title + family selector + push toggle -->
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-bold font-display text-slate-800">Bảng tin dòng họ</h1>
        <p class="text-sm text-slate-500 mt-1">Những câu chuyện mới nhất của gia đình.</p>
      </div>
      <div class="flex items-center gap-3">
        <div v-if="families.length > 1" class="w-48">
          <AppSelect
            v-model="selectedFamilyId"
            :options="familyOptions"
            aria-label="Chọn dòng họ"
            :disabled="loadingFamilies"
            @update:model-value="onFamilyChange"
          />
        </div>
        <NotificationToggle />
      </div>
    </div>

    <!-- Composer (authenticated) -->
    <form
      v-if="authStore.isAuthenticated"
      class="bg-white rounded-xl shadow-xs border border-slate-200 p-4 mb-6"
      data-testid="composer-form"
      @submit.prevent="submitPost"
    >
      <textarea
        v-model="content"
        rows="3"
        placeholder="Chia sẻ câu chuyện với gia đình…"
        class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C85A32] focus:border-transparent resize-y"
      ></textarea>

      <!-- Image URL adder (no upload endpoint — images are JSONB URL arrays) -->
      <div class="flex items-center gap-2 mt-3">
        <input
          v-model="imageUrl"
          type="url"
          placeholder="Dán URL ảnh…"
          class="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C85A32] focus:border-transparent"
          @keydown.enter.prevent="addImage"
        />
        <AppButton variant="outline" size="sm" type="button" @click="addImage">Thêm ảnh</AppButton>
      </div>

      <div v-if="images.length" class="flex flex-wrap gap-2 mt-3">
        <span
          v-for="(img, index) in images"
          :key="`${img}-${index}`"
          class="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-slate-100 text-slate-700 border border-slate-200 max-w-full"
        >
          <span class="truncate max-w-[220px]" :title="img">{{ img }}</span>
          <button
            type="button"
            class="text-slate-400 hover:text-red-500 transition-colors"
            :aria-label="`Xóa ảnh ${index + 1}`"
            @click="removeImage(index)"
          >
            ×
          </button>
        </span>
      </div>

      <div class="flex justify-end mt-3">
        <AppButton type="submit" :loading="posting" :disabled="!canSubmit">Đăng bài</AppButton>
      </div>
    </form>

    <!-- Anonymous hint (reads are public, posting requires auth) -->
    <div
      v-else
      class="bg-[#F9EAE1] rounded-xl border border-[#F4D0C2] p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      data-testid="anonymous-hint"
    >
      <p class="text-sm text-[#983F1E]">Đăng nhập để đăng bài viết.</p>
      <RouterLink to="/login" data-testid="login-cta">
        <AppButton size="sm">Đăng nhập</AppButton>
      </RouterLink>
    </div>

    <!-- Families loading / error -->
    <p v-if="familyError" class="text-sm text-red-600 mb-4" data-testid="family-error">
      {{ familyError }}
    </p>

    <!-- Feed loading state -->
    <div v-if="feedStore.loading && !feedStore.posts.length" class="space-y-3" data-testid="feed-loading">
      <div v-for="n in 3" :key="n" class="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-full bg-slate-200"></div>
          <div class="flex-1 space-y-2">
            <div class="h-3 bg-slate-200 rounded w-1/3"></div>
            <div class="h-2 bg-slate-100 rounded w-1/4"></div>
          </div>
        </div>
        <div class="mt-4 space-y-2">
          <div class="h-3 bg-slate-100 rounded w-full"></div>
          <div class="h-3 bg-slate-100 rounded w-2/3"></div>
        </div>
      </div>
      <p class="text-center text-sm text-slate-500">Đang tải bài viết…</p>
    </div>

    <!-- Feed error state -->
    <div
      v-else-if="feedStore.error && !feedStore.posts.length"
      class="bg-red-50 border border-red-200 rounded-xl p-5 text-center mb-4"
      data-testid="feed-error"
    >
      <p class="text-sm text-red-700">{{ feedStore.error }}</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="retryFetch">Thử lại</AppButton>
    </div>

    <!-- Empty state -->
    <EmptyState
      v-else-if="!feedStore.posts.length"
      title="Chưa có bài viết nào. Hãy chia sẻ bài viết đầu tiên!"
      description="Bài viết sẽ hiển thị tại đây cho cả gia đình cùng xem."
      data-testid="feed-empty"
    />

    <!-- Timeline (newest first — order comes from the API) -->
    <div v-else class="space-y-4" data-testid="feed-list">
      <PostCard v-for="post in feedStore.posts" :key="post.id" :post="post" />

      <!-- Feed-level error while paging -->
      <p v-if="feedStore.error" class="text-sm text-red-600 text-center" data-testid="feed-page-error">
        {{ feedStore.error }}
      </p>

      <div v-if="feedStore.nextCursor" class="flex justify-center pt-2">
        <AppButton variant="outline" :loading="feedStore.loading" data-testid="load-more" @click="feedStore.loadMore()">
          {{ feedStore.loading ? 'Đang tải…' : 'Tải thêm' }}
        </AppButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import PostCard from '@/components/feed/PostCard.vue';
import InstallPrompt from '@/components/notifications/InstallPrompt.vue';
import NotificationToggle from '@/components/notifications/NotificationToggle.vue';
import { useFeedStore } from '@/stores/feed';
import { useAuthStore } from '@/stores/auth';
import { familiesApi } from '@/api/families';
import { formatApiError } from '@/api/client';
import { useToast } from '@/composables/useToast';
import type { Family } from '@/types/api';
import type { SelectOption } from '@/components/ui/AppSelect.vue';

const feedStore = useFeedStore();
const authStore = useAuthStore();
const toast = useToast();

const families = ref<Family[]>([]);
const selectedFamilyId = ref<string>('');
const loadingFamilies = ref(false);
const familyError = ref<string | null>(null);

const content = ref('');
const imageUrl = ref('');
const images = ref<string[]>([]);
const posting = ref(false);

const familyOptions = computed<SelectOption[]>(() =>
  families.value.map((f) => ({ value: f.id, label: f.name }))
);

const canSubmit = computed(() => content.value.trim().length > 0);

onMounted(async () => {
  // Resolve auth state silently (cached when the router guard already did it)
  await authStore.fetchMe();
  await loadFamilies();
});

async function loadFamilies(): Promise<void> {
  loadingFamilies.value = true;
  familyError.value = null;

  try {
    const res = await familiesApi.listFamilies();
    families.value = res.families || [];

    if (!families.value.length) {
      familyError.value = 'Chưa có dòng họ nào trong hệ thống.';
      return;
    }

    // Restore the persisted choice, otherwise default to the first family
    const persisted = feedStore.loadPersistedFamily();
    const initial =
      (persisted && families.value.find((f) => f.id === persisted)?.id) || families.value[0].id;

    selectedFamilyId.value = initial;
    await feedStore.fetchFeed(initial);
  } catch (err) {
    familyError.value = formatApiError(err);
  } finally {
    loadingFamilies.value = false;
  }
}

async function onFamilyChange(): Promise<void> {
  if (!selectedFamilyId.value) return;
  feedStore.reset();
  await feedStore.fetchFeed(selectedFamilyId.value);
}

function retryFetch(): void {
  if (selectedFamilyId.value) {
    feedStore.fetchFeed(selectedFamilyId.value);
  } else {
    loadFamilies();
  }
}

function addImage(): void {
  const url = imageUrl.value.trim();
  if (!url) return;
  if (images.value.length >= 9) return;
  if (!images.value.includes(url)) {
    images.value.push(url);
  }
  imageUrl.value = '';
}

function removeImage(index: number): void {
  images.value.splice(index, 1);
}

async function submitPost(): Promise<void> {
  if (!canSubmit.value || posting.value) return;

  posting.value = true;
  try {
    await feedStore.createPost({
      content: content.value.trim(),
      images: images.value.length ? [...images.value] : [],
    });
    toast.success('Đã đăng bài viết.');
    content.value = '';
    images.value = [];
    imageUrl.value = '';
  } catch {
    toast.error(feedStore.error || 'Không thể đăng bài viết. Vui lòng thử lại.');
  } finally {
    posting.value = false;
  }
}
</script>
