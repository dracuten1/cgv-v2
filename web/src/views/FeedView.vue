<template>
  <div class="mx-auto w-full max-w-[1120px] px-4 pb-10 pt-6 md:px-6 md:pt-[38px]">
    <InstallPrompt />
    <section class="mb-6" data-testid="feed-heading">
      <p class="mb-1 text-xs font-semibold leading-[1.45] tracking-[0.04em] text-ink-3">
        Chuyện nhà
      </p>
      <h1 class="text-2xl font-bold leading-[1.45] text-ink-1 md:text-[28px]">
        Bảng tin dòng họ
      </h1>
      <p class="mt-1.5 text-sm leading-[1.6] text-ink-2">
        Những câu chuyện mới nhất của gia đình.
      </p>
    </section>
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,700px)_minmax(230px,300px)]">
      <section class="min-w-0 space-y-4" aria-labelledby="feed-stream-heading">
        <div class="mb-2 flex flex-wrap items-end justify-between gap-3">
          <h2 id="feed-stream-heading" class="text-lg font-semibold leading-[1.45] text-ink-1">
            Bảng tin gia đình
          </h2>
          <div class="w-52" data-testid="family-selector">
            <AppSelect
              v-model="selectedFamilyId"
              :options="familyOptions"
              label="Dòng họ đang xem"
              placeholder="Chọn dòng họ"
              aria-label="Chọn dòng họ"
              :disabled="loadingFamilies || !families.length"
              @update:model-value="onFamilyChange"
            />
          </div>
          <NotificationToggle />
        </div>
        <p
          v-if="!selectedFamilyId && !loadingFamilies"
          class="rounded-app-lg border border-hairline bg-well p-4 text-sm leading-[1.6] text-ink-2"
          data-testid="no-family"
        >
          Chưa chọn dòng họ. Hãy chọn một dòng họ để xem bảng tin.
        </p>
        <div
          v-if="authStore.isDemo && selectedFamilyId"
          class="rounded-app-lg border border-demo-border bg-demo-soft px-4 py-3 text-sm leading-[1.6] text-demo-deep"
          data-testid="demo-notice"
        >
          <span class="rounded-full border border-demo-border bg-card px-2 py-1 text-xs font-semibold text-demo-deep">
            Bản dùng thử
          </span>
          <p class="mt-2">Bạn đang trải nghiệm tài khoản mẫu.</p>
        </div>
        <form
          v-if="authStore.isAuthenticated && selectedFamilyId"
          class="rounded-app-xl border border-hairline bg-card p-5 shadow-e1"
          data-testid="composer-form"
          :aria-busy="posting ? 'true' : undefined"
          @submit.prevent="submitPost"
        >
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
          <div class="mt-3 flex items-center gap-2">
            <input
              v-model="imageUrl"
              type="url"
              placeholder="Dán URL ảnh (https://…)"
              aria-label="URL ảnh"
              :aria-invalid="imageUrlError ? 'true' : undefined"
              :aria-describedby="imageUrlError ? 'image-url-error' : undefined"
              class="min-w-0 flex-1 rounded-app-md border border-hairline-strong bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta"
              @keydown.enter.prevent="addImage"
            />
            <AppButton variant="outline" size="sm" type="button" @click="addImage">
              Thêm ảnh
            </AppButton>
          </div>
          <p
            v-if="imageUrlError"
            id="image-url-error"
            role="alert"
            class="mt-2 text-sm leading-[1.6] text-danger-fg"
            data-testid="image-url-error"
          >
            {{ imageUrlError }}
          </p>
          <div v-if="images.length" class="mt-3 flex flex-wrap gap-2">
            <span
              v-for="(img,index) in images"
              :key="img"
              class="rounded-full bg-well px-2 py-1 text-xs leading-[1.45] text-ink-2"
            >
              <span class="max-w-[180px] truncate" :title="img">{{img}}</span>
              <button
                type="button"
                class="cursor-pointer rounded-full text-ink-3 transition-colors hover:text-danger-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-1"
                :aria-label="`Xóa ảnh ${index+1}`"
                @click="removeImage(index)"
              >
                ×
              </button>
            </span>
          </div>
          <p class="text-xs leading-[1.45] text-ink-3">Bài viết hiển thị cho cả gia đình</p>
          <span
            data-testid="composer-char-counter"
            aria-live="polite"
            :class="['text-xs leading-[1.45]', overLimit ? 'text-danger-fg font-medium' : 'text-ink-3']"
          >
            {{ runeCount }}/{{ MAX_CONTENT_RUNES }}
          </span>
          <AppButton type="submit" :disabled="!canSubmit || posting" :loading="posting">
            {{ posting ? 'Đang đăng…' : 'Đăng bài' }}
          </AppButton>
        </form>
        <div
          v-else-if="!authStore.isAuthenticated"
          class="rounded-app-xl border border-accent-border bg-terracotta-soft p-5"
          data-testid="anonymous-hint"
        >
          <p class="text-sm leading-[1.6] text-accent-fg">Đăng nhập để đăng bài viết.</p>
          <RouterLink
            to="/login"
            data-testid="login-cta"
            class="mt-3 inline-block rounded-app-md bg-terracotta px-4 py-2 text-white focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2"
          >
            Đăng nhập
          </RouterLink>
        </div>
        <p
          v-if="familyError"
          class="text-sm leading-[1.6] text-danger-fg"
          role="alert"
          data-testid="family-error"
        >
          {{ familyError }}
        </p>
        <div
          v-if="feedStore.loading && !feedStore.posts.length"
          class="space-y-4"
          data-testid="feed-loading"
          role="status"
          aria-live="polite"
        >
          <div
            v-for="n in 3"
            :key="n"
            class="animate-pulse rounded-app-xl border border-hairline bg-card p-5 shadow-e1"
          >
            <div class="h-10 w-10 rounded-full bg-well"></div>
            <div class="mt-4 h-3 rounded bg-well"></div>
          </div>
          <p class="text-center text-sm leading-[1.6] text-ink-3">Đang tải bài viết…</p>
        </div>
        <div
          v-else-if="feedStore.error && !feedStore.posts.length"
          class="rounded-app-xl border border-danger-fg bg-card p-5"
          data-testid="feed-error"
          role="alert"
        >
          <p class="text-sm leading-[1.6] text-danger-fg">{{feedStore.error}}</p>
          <AppButton variant="outline" size="sm" class="mt-3" @click="retryFetch">
            Thử lại
          </AppButton>
        </div>
        <EmptyState
          v-else-if="selectedFamilyId && !feedStore.posts.length && !feedStore.loading"
          title="Chưa có bài viết nào. Hãy chia sẻ bài viết đầu tiên!"
          description="Bài viết sẽ hiển thị tại đây cho cả gia đình cùng xem."
          data-testid="feed-empty"
        />
        <div v-else-if="feedStore.posts.length" class="space-y-4" data-testid="feed-list">
          <PostCard v-for="post in feedStore.posts" :key="post.id" :post="post" />
          <div
            v-if="feedStore.error"
            class="flex items-center justify-between gap-3 rounded-app-lg border border-danger-fg bg-card px-4 py-3 text-sm leading-[1.6] text-danger-fg"
            data-testid="feed-page-error"
            role="alert"
          >
            <span>{{feedStore.error}}</span>
            <AppButton variant="outline" size="sm" @click="feedStore.loadMore()">
              Thử lại
            </AppButton>
          </div>
          <div v-if="feedStore.nextCursor" class="flex justify-center pt-2">
            <AppButton
              variant="outline"
              :loading="feedStore.loading"
              data-testid="load-more"
              @click="feedStore.loadMore()"
            >
              {{feedStore.loading ? 'Đang tải…' : 'Tải thêm bài viết'}}
            </AppButton>
          </div>
        </div>
      </section>
      <aside
        class="h-fit rounded-app-xl border border-hairline bg-card p-5 shadow-e1"
        data-testid="shortcut-rail"
      >
        <h2 class="text-base font-semibold leading-[1.45] text-ink-1">Lối tắt</h2>
        <p class="mt-1 text-sm leading-[1.6] text-ink-2">Khám phá gia đình bạn.</p>
        <nav class="mt-4 grid gap-2" aria-label="Lối tắt">
          <RouterLink
            v-for="item in shortcuts"
            :key="item.to"
            :to="item.to"
            class="rounded-app-lg border border-hairline bg-well p-3 text-sm font-medium leading-[1.6] text-ink-1 hover:text-accent-fg focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2"
          >
            {{item.label}}
          </RouterLink>
        </nav>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import AppTextarea from '@/components/ui/AppTextarea.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import AppAvatar from '@/components/ui/AppAvatar.vue';
import PostCard from '@/components/feed/PostCard.vue';
import InstallPrompt from '@/components/notifications/InstallPrompt.vue';
import NotificationToggle from '@/components/notifications/NotificationToggle.vue';
import { useFeedStore } from '@/stores/feed';
import { MAX_ATTACHMENT_IMAGES } from '@/stores/feed/constants';
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
const imageUrlError = ref<string | null>(null);
const images = ref<string[]>([]);
const posting = ref(false);

// Client mirror of the backend rune budget: api/internal/feed/service.go
// MaxContentRunes = 5000 (rune-counted, so Vietnamese diacritics count as
// one character each — same as JS code-point iteration).
const MAX_CONTENT_RUNES = 5000;

const runeCount = computed(() => [...content.value].length);
const overLimit = computed(() => runeCount.value > MAX_CONTENT_RUNES);

const shortcuts = [
  { to: '/tree', label: 'Cây gia phả' },
  { to: '/kinship', label: 'Quan hệ trong họ' },
  { to: '/account', label: 'Tài khoản' },
] as const;

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
      selectedFamilyId.value = '';
      feedStore.reset();
      return;
    }

    // Restore Feed-scoped family selection only; do not synchronize tree state.
    const persisted = feedStore.loadPersistedFamily();
    const initial = persisted && families.value.some((f) => f.id === persisted)
      ? persisted
      : families.value[0].id;
    selectedFamilyId.value = initial;
    if (initial) await feedStore.fetchFeed(initial);
    else feedStore.reset();
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

/**
 * Client-side image-URL gate (MAJ-2): only absolute http(s) URLs may enter
 * the composer's attachment list. `type="url"` alone does not validate on
 * programmatic add/submit, so the scheme is checked here after trimming.
 */
function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const IMAGE_URL_ERROR = 'URL ảnh không hợp lệ. Vui lòng dùng liên kết bắt đầu bằng http:// hoặc https://.';

function addImage(): void {
  const url = imageUrl.value.trim();
  if (!url) return;
  if (!isValidImageUrl(url)) {
    imageUrlError.value = IMAGE_URL_ERROR;
    return;
  }
  imageUrlError.value = null;
  if (images.value.length >= MAX_ATTACHMENT_IMAGES) return;
  if (!images.value.includes(url)) {
    images.value.push(url);
  }
  imageUrl.value = '';
}

// A corrected input clears the previous rejection message.
watch(imageUrl, () => {
  if (imageUrlError.value) imageUrlError.value = null;
});

function removeImage(index: number): void {
  images.value.splice(index, 1);
}

async function submitPost(): Promise<void> {
  if (!canSubmit.value || posting.value) return;
  // Defensive: the queue must never reach the API with a non-http(s) URL.
  if (images.value.some((img) => !isValidImageUrl(img))) {
    imageUrlError.value = IMAGE_URL_ERROR;
    return;
  }

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
    imageUrlError.value = null;
  } catch {
    toast.error(feedStore.error || 'Không thể đăng bài viết. Vui lòng thử lại.');
  } finally {
    posting.value = false;
  }
}
</script>
