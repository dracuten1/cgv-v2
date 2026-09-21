import { defineStore } from 'pinia';
import { ref } from 'vue';
import { feedApi, type FeedListParams } from '@/api/feed';
import { formatApiError } from '@/api/client';
import type { FeedPostItem, FeedCursor, CreatePostInput } from '@/types/api';

const FEED_PAGE_SIZE = 20;
const FAMILY_STORAGE_KEY = 'cgp.familyId';

/**
 * Feed store (Cycle 2C): paginated family timeline, newest first.
 * Errors are kept on the store (`error`); user-facing toasts live at view level.
 */
export const useFeedStore = defineStore('feed', () => {
  const currentFamilyId = ref<string | null>(null);
  const posts = ref<FeedPostItem[]>([]);
  const nextCursor = ref<FeedCursor | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function persistFamily(familyId: string): void {
    try {
      window.localStorage.setItem(FAMILY_STORAGE_KEY, familyId);
    } catch {
      // Storage unavailable (private mode / jsdom without storage) — non fatal
    }
  }

  function loadPersistedFamily(): string | null {
    try {
      return window.localStorage.getItem(FAMILY_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Fetches a page of posts. `cursor` omitted/undefined = first page (refresh);
   * a cursor loads the next page and APPENDS.
   */
  async function fetchFeed(familyId: string, cursor?: FeedCursor | null): Promise<void> {
    currentFamilyId.value = familyId;
    persistFamily(familyId);
    loading.value = true;
    error.value = null;

    try {
      const params: FeedListParams = { limit: FEED_PAGE_SIZE };
      if (cursor) {
        params.cursor_created_at = cursor.created_at;
        params.cursor_id = cursor.id;
      }

      const res = await feedApi.list(familyId, params);

      if (cursor) {
        posts.value = [...posts.value, ...res.posts];
      } else {
        posts.value = res.posts;
      }
      nextCursor.value = res.next_cursor || null;
    } catch (err) {
      error.value = formatApiError(err);
    } finally {
      loading.value = false;
    }
  }

  /** Loads the next page using the cursor from the last response. */
  async function loadMore(): Promise<void> {
    if (!currentFamilyId.value || !nextCursor.value || loading.value) return;
    await fetchFeed(currentFamilyId.value, nextCursor.value);
  }

  async function createPost(input: CreatePostInput): Promise<void> {
    if (!currentFamilyId.value) {
      throw new Error('Chưa chọn dòng họ để đăng bài');
    }

    error.value = null;
    try {
      await feedApi.create(currentFamilyId.value, input);
      // Refresh timeline after posting (new post appears at the top)
      await fetchFeed(currentFamilyId.value);
    } catch (err) {
      const msg = formatApiError(err);
      error.value = msg;
      throw new Error(msg);
    }
  }

  function reset(): void {
    currentFamilyId.value = null;
    posts.value = [];
    nextCursor.value = null;
    error.value = null;
  }

  return {
    currentFamilyId,
    posts,
    nextCursor,
    loading,
    error,
    loadPersistedFamily,
    fetchFeed,
    loadMore,
    createPost,
    reset,
  };
});
