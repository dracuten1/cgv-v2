<template>
  <div class="mx-auto w-full max-w-[760px] px-4 pb-10 pt-6 md:px-6 md:pt-[38px]">
    <!-- PWA install banner (top) -->
    <InstallPrompt />

    <!-- Header: eyebrow + title + family selector + push toggle (feed.html feed-head) -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        <p class="mb-1 text-xs font-semibold leading-[1.45] tracking-[0.04em] text-accent-fg">
          Chuyện nhà
        </p>
        <h1
          class="text-2xl font-bold leading-[1.45] tracking-[-0.019em] text-ink-1 md:text-[28px]"
        >
          Bảng tin dòng họ
        </h1>
        <p class="mt-1.5 text-sm leading-[1.6] text-ink-2">
          Những câu chuyện mới nhất của gia đình.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <div v-if="families.length > 1" class="w-44">
          <AppSelect
            v-model="selectedFamilyId"
            :options="familyOptions"
            label="Dòng họ"
            aria-label="Chọn dòng họ"
            :disabled="loadingFamilies"
            @update:model-value="onFamilyChange"
          />
        </div>
        <NotificationToggle />
      </div>
    </div>

    <!-- Composer (authenticated) — mockup feed.html .composer -->
    <form
      v-if="authStore.isAuthenticated"
      class="mb-6 rounded-app-xl border border-hairline bg-card p-[18px] shadow-e1 md:p-[22px]"
      data-testid="composer-form"
      :aria-busy="posting ? 'true' : undefined"
      @submit.prevent="submitPost"
    >
      <!-- Avatar + borderless textarea row -->
      <div class="flex items-start gap-3">
        <AppAvatar :name="authStore.displayName" size="w-10" />
        <AppTextarea
          v-model="content"
          variant="borderless"
          :rows="3"
          :maxlength="MAX_CONTENT_RUNES"
          placeholder="Chia sẻ câu chuyện với gia đình…"
        />
      </div>

      <!-- Image URL adder (no upload endpoint — images are JSONB URL arrays) -->
      <div class="mt-3 flex items-center gap-2">
        <div
          class="flex-1 flex items-center gap-2 rounded-app-md border border-dashed border-hairline-strong bg-well/60 px-3 py-1.5 transition-colors hover:border-ink-3 focus-within:border-transparent focus-within:ring-2 focus-within:ring-accent"
        >
          <IconLink class="w-4 h-4 shrink-0 text-ink-3" />
          <input
            v-model="imageUrl"
            type="url"
            placeholder="Dán URL ảnh (https://…)"
            class="w-full bg-transparent text-sm text-ink-1 placeholder:text-ink-3 focus:outline-none"
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
      <div v-if="images.length" class="mt-3 flex flex-wrap gap-2">
        <span
          v-for="(img, index) in images"
          :key="`${img}-${index}`"
          class="inline-flex max-w-full items-center gap-2 rounded-full border border-hairline bg-well py-1 pl-1 pr-2.5 text-xs leading-[1.45] text-ink-2"
        >
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-hairline bg-well text-ink-3"
            aria-hidden="true"
          >
            <IconPhoto class="h-3.5 w-3.5" />
          </span>
          <span class="max-w-[180px] truncate" :title="img">{{ img }}</span>
          <button
            type="button"
            class="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-ink-3 transition-colors hover:text-danger-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            :aria-label="`Xóa ảnh ${index + 1}`"
            @click="removeImage(index)"
          >
            <IconXMark class="h-3 w-3" />
          </button>
        </span>
      </div>

      <!-- Footer: helper + char budget + submit (composer__footer) -->
      <div class="mt-3.5 flex items-center justify-between gap-3 border-t border-hairline pt-3.5">
        <p class="text-xs leading-[1.45] text-ink-3">Bài viết hiển thị cho cả gia đình</p>
        <div class="flex items-center gap-3">
          <span
            data-testid="composer-char-counter"
            :class="[
              'text-xs leading-[1.45] tabular-nums',
              overLimit ? 'text-red-600 font-medium' : 'text-ink-3',
            ]"
            aria-live="polite"
          >
            {{ runeCount }}/{{ MAX_CONTENT_RUNES }}
          </span>
          <AppButton type="submit" :loading="posting" :disabled="!canSubmit || posting">
            <span class="flex items-center gap-2">
              <IconPaperAirplane class="w-4 h-4" />
              <span>{{ posting ? 'Đang đăng…' : 'Đăng bài' }}</span>
            </span>
          </AppButton>
        </div>
      </div>
    </form>

    <!-- Anonymous hint (reads are public, posting requires auth) — terracotta banner per §8.1 -->
    <div
      v-else
      class="mb-6 flex flex-col justify-between gap-3 rounded-app-xl border border-accent-border bg-terracotta-soft p-4 sm:flex-row sm:items-center md:p-5"
      data-testid="anonymous-hint"
    >
      <div>
        <p class="text-sm leading-[1.6] text-accent-fg">Đăng nhập để đăng bài viết.</p>
        <p class="mt-0.5 text-xs leading-[1.45] text-ink-2">
          Bạn có thể đọc bảng tin — đăng nhập để kể chuyện cùng gia đình.
        </p>
      </div>
      <RouterLink to="/login" data-testid="login-cta" class="shrink-0">
        <AppButton size="sm">Đăng nhập</AppButton>
      </RouterLink>
    </div>

    <!-- Families loading / error -->
    <p
      v-if="familyError"
      class="mb-4 text-sm leading-[1.6] text-danger-fg"
      data-testid="family-error"
      role="alert"
    >
      {{ familyError }}
    </p>

    <!-- Feed loading state — 3-card pulsing skeleton (feed.html state-card--loading) -->
    <div
      v-if="feedStore.loading && !feedStore.posts.length"
      class="space-y-4"
      data-testid="feed-loading"
      role="status"
    >
      <div
        v-for="n in 3"
        :key="n"
        class="animate-pulse rounded-app-xl border border-hairline bg-card p-5 shadow-e1"
      >
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-full bg-well"></div>
          <div class="flex-1 space-y-2">
            <div class="h-3 w-1/3 rounded bg-well"></div>
            <div class="h-2 w-1/4 rounded bg-well"></div>
          </div>
        </div>
        <div class="mt-4 space-y-2">
          <div class="h-3 w-full rounded bg-well"></div>
          <div class="h-3 w-2/3 rounded bg-well"></div>
        </div>
      </div>
      <p class="text-center text-sm leading-[1.6] text-ink-3">Đang tải bài viết…</p>
    </div>

    <!-- Feed error state — card + danger-fg border/heading (feed.html state-card--error) -->
    <div
      v-else-if="feedStore.error && !feedStore.posts.length"
      class="mb-4 rounded-app-xl border border-danger-fg bg-card p-5 text-center shadow-e1"
      data-testid="feed-error"
      role="alert"
    >
      <p class="text-sm font-medium leading-[1.6] text-danger-fg">{{ feedStore.error }}</p>
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
      <p
        v-if="feedStore.error"
        class="text-center text-sm leading-[1.6] text-danger-fg"
        data-testid="feed-page-error"
        role="alert"
      >
        {{ feedStore.error }}
      </p>

      <div v-if="feedStore.nextCursor" class="flex justify-center pt-2">
        <AppButton
          variant="outline"
          :loading="feedStore.loading"
          data-testid="load-more"
          @click="feedStore.loadMore()"
        >
          {{ feedStore.loading ? 'Đang tải…' : 'Tải thêm bài viết' }}
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

// Client mirror of the backend rune budget: api/internal/feed/service.go
// MaxContentRunes = 5000 (rune-counted, so Vietnamese diacritics count as
// one character each — same as JS code-point iteration).
const MAX_CONTENT_RUNES = 5000;

const runeCount = computed(() => [...content.value].length);
const overLimit = computed(() => runeCount.value > MAX_CONTENT_RUNES);

const familyOptions = computed<SelectOption[]>(() =>
  families.value.map((f) => ({ value: f.id, label: f.name }))
);

const canSubmit = computed(
  () => content.value.trim().length > 0 && !overLimit.value && !posting.value
);

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

<style scoped>
/*
  Compatibility remap (Phase-1 retained-class pattern): the over-budget
  counter's legacy class string `text-red-600` is pinned by feed-view.spec.ts
  and must stay in the DOM. Its stock value #DC2626 is 4.83:1 on the light
  card but only ~3.1:1 on the dark card, so remap the pinned class to the
  semantic AA danger token (light #B82C34 / dark #FF817B) — both ≥4.5:1.
*/
.text-red-600 {
  color: var(--danger-fg);
}
</style>
