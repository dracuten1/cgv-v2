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

    <!-- Composer (authenticated) — mockup 06 / spec §6.6 -->
    <form
      v-if="authStore.isAuthenticated"
      class="bg-white rounded-xl shadow-xs border border-slate-200 p-4 mb-6"
      data-testid="composer-form"
      @submit.prevent="submitPost"
    >
      <!-- Avatar + borderless textarea row -->
      <div class="flex items-start gap-3">
        <AppAvatar :name="authStore.displayName" size="w-10" />
        <AppTextarea
          v-model="content"
          variant="borderless"
          :rows="3"
          placeholder="Chia sẻ câu chuyện với gia đình…"
        />
      </div>

      <!-- Image URL adder (no upload endpoint — images are JSONB URL arrays) -->
      <div class="mt-3 flex items-center gap-2">
        <div
          class="flex-1 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-cream-muted/60 px-3 py-1.5 hover:border-slate-400 transition-colors"
        >
          <IconLink class="w-4 h-4 text-slate-400 shrink-0" />
          <input
            v-model="imageUrl"
            type="url"
            placeholder="Dán URL ảnh (https://…)"
            class="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
            @keydown.enter.prevent="addImage"
          />
        </div>
        <AppButton variant="outline" size="sm" type="button" @click="addImage">
          <span class="flex items-center gap-1.5">
            <IconPhoto class="w-4 h-4" />
            <span>Thêm ảnh</span>
          </span>
        </AppButton>
      </div>

      <!-- Queued image chips -->
      <div v-if="images.length" class="flex flex-wrap gap-2 mt-3">
        <span
          v-for="(img, index) in images"
          :key="`${img}-${index}`"
          class="inline-flex items-center gap-2 pl-1 pr-2.5 py-1 text-xs rounded-full bg-cream-muted text-slate-700 border border-slate-200 max-w-full"
        >
          <span
            class="w-6 h-6 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-gen-2-soft text-gen-2 flex items-center justify-center"
            aria-hidden="true"
          >
            <IconPhoto class="w-3.5 h-3.5" />
          </span>
          <span class="truncate max-w-[180px]" :title="img">{{ img }}</span>
          <button
            type="button"
            class="w-4 h-4 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
            :aria-label="`Xóa ảnh ${index + 1}`"
            @click="removeImage(index)"
          >
            <IconXMark class="w-3 h-3" />
          </button>
        </span>
      </div>

      <!-- Footer: helper + submit -->
      <div class="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
        <p class="text-xs text-slate-400">Bài viết hiển thị cho cả gia đình</p>
        <AppButton type="submit" :loading="posting" :disabled="!canSubmit">
          <span class="flex items-center gap-2">
            <IconPaperAirplane class="w-4 h-4" />
            <span>Đăng bài</span>
          </span>
        </AppButton>
      </div>
    </form>

    <!-- Anonymous hint (reads are public, posting requires auth) — warm banner per §4.10 -->
    <div
      v-else
      class="bg-terracotta-soft rounded-xl border border-terracotta-border p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      data-testid="anonymous-hint"
    >
      <p class="text-sm text-terracotta-dark">Đăng nhập để đăng bài viết.</p>
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
          <div class="w-10 h-10 rounded-full bg-cream-muted"></div>
          <div class="flex-1 space-y-2">
            <div class="h-3 bg-cream-muted rounded w-1/3"></div>
            <div class="h-2 bg-cream-muted rounded w-1/4"></div>
          </div>
        </div>
        <div class="mt-4 space-y-2">
          <div class="h-3 bg-cream-muted rounded w-full"></div>
          <div class="h-3 bg-cream-muted rounded w-2/3"></div>
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
import AppAvatar from '@/components/ui/AppAvatar.vue';
import AppTextarea from '@/components/ui/AppTextarea.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import { IconLink, IconPhoto, IconPaperAirplane, IconXMark } from '@/components/icons';
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
