import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useFeedStore } from '@/stores/feed';
import { feedApi } from '@/api/feed';
import type { FeedListResponse, FeedPostItem } from '@/types/api';

// Mock the feed API module — the store must never touch the network
vi.mock('@/api/feed', () => ({
  feedApi: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

const mockedFeedApi = vi.mocked(feedApi);

function makePost(overrides: Partial<FeedPostItem> = {}): FeedPostItem {
  return {
    id: 'post-1',
    family_id: 'f1',
    author_member_id: null,
    content: 'Nội dung bài viết',
    images: [],
    created_at: '2026-09-21T08:00:00Z',
    author_display_name: 'Nguyễn Văn An',
    ...overrides,
  };
}

describe('feed store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('fetchFeed loads the first page and preserves API order (newest first)', async () => {
    const page: FeedListResponse = {
      posts: [
        makePost({ id: 'p-newest', content: 'Mới nhất', created_at: '2026-09-21T10:00:00Z' }),
        makePost({ id: 'p-older', content: 'Cũ hơn', created_at: '2026-09-21T09:00:00Z' }),
      ],
      next_cursor: { created_at: '2026-09-21T09:00:00Z', id: 'p-older' },
    };
    mockedFeedApi.list.mockResolvedValue(page);

    const store = useFeedStore();
    await store.fetchFeed('f1');

    expect(mockedFeedApi.list).toHaveBeenCalledWith(
      'f1',
      expect.objectContaining({ limit: 20 })
    );
    // API returns newest first — store must NOT reorder
    expect(store.posts.map((p) => p.id)).toEqual(['p-newest', 'p-older']);
    expect(store.nextCursor).toEqual({ created_at: '2026-09-21T09:00:00Z', id: 'p-older' });
    expect(store.currentFamilyId).toBe('f1');
    expect(store.error).toBeNull();
  });

  it('fetchFeed with a cursor APPENDS the next page instead of replacing', async () => {
    mockedFeedApi.list.mockResolvedValue({
      posts: [makePost({ id: 'p1', created_at: '2026-09-21T10:00:00Z' })],
      next_cursor: { created_at: '2026-09-21T10:00:00Z', id: 'p1' },
    });

    const store = useFeedStore();
    await store.fetchFeed('f1');

    mockedFeedApi.list.mockResolvedValue({
      posts: [makePost({ id: 'p2', created_at: '2026-09-21T08:00:00Z' })],
      next_cursor: null,
    });

    await store.fetchFeed('f1', { created_at: '2026-09-21T10:00:00Z', id: 'p1' });

    expect(mockedFeedApi.list).toHaveBeenLastCalledWith(
      'f1',
      expect.objectContaining({
        cursor_created_at: '2026-09-21T10:00:00Z',
        cursor_id: 'p1',
      })
    );
    expect(store.posts.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(store.nextCursor).toBeNull();
  });

  it('createPost calls the API then refreshes the timeline (new post appears first)', async () => {
    mockedFeedApi.list.mockResolvedValue({
      posts: [makePost({ id: 'p-old', created_at: '2026-09-21T08:00:00Z' })],
      next_cursor: null,
    });

    const store = useFeedStore();
    await store.fetchFeed('f1');

    mockedFeedApi.create.mockResolvedValue(makePost({ id: 'p-new', content: 'Bài mới' }));
    mockedFeedApi.list.mockResolvedValue({
      posts: [
        makePost({ id: 'p-new', content: 'Bài mới', created_at: '2026-09-21T11:00:00Z' }),
        makePost({ id: 'p-old', created_at: '2026-09-21T08:00:00Z' }),
      ],
      next_cursor: null,
    });

    await store.createPost({ content: 'Bài mới', images: ['https://example.com/a.jpg'] });

    expect(mockedFeedApi.create).toHaveBeenCalledWith('f1', {
      content: 'Bài mới',
      images: ['https://example.com/a.jpg'],
    });
    // Refresh happened: newest post first
    expect(store.posts.map((p) => p.id)).toEqual(['p-new', 'p-old']);
  });

  it('createPost without a selected family throws and keeps error', async () => {
    const store = useFeedStore();
    await expect(store.createPost({ content: 'xin chào' })).rejects.toThrow(
      'Chưa chọn dòng họ để đăng bài'
    );
    expect(mockedFeedApi.create).not.toHaveBeenCalled();
  });

  it('stores the formatted Vietnamese error when listing fails', async () => {
    const err = Object.assign(new Error('Máy chủ gặp sự cố. Vui lòng thử lại sau.'), {
      status: 500,
      code: 'HTTP_500',
    });
    mockedFeedApi.list.mockRejectedValue(err);

    const store = useFeedStore();
    await store.fetchFeed('f1');

    expect(store.error).toBe('Máy chủ gặp sự cố. Vui lòng thử lại sau.');
  });

  it('persists the selected family in localStorage under cgp.familyId', async () => {
    mockedFeedApi.list.mockResolvedValue({ posts: [], next_cursor: null });

    const store = useFeedStore();
    await store.fetchFeed('f42');

    expect(window.localStorage.getItem('cgp.familyId')).toBe('f42');
    expect(store.loadPersistedFamily()).toBe('f42');
  });

  it('reset clears posts, cursor and error', async () => {
    mockedFeedApi.list.mockResolvedValue({
      posts: [makePost()],
      next_cursor: { created_at: 'x', id: 'y' },
    });

    const store = useFeedStore();
    await store.fetchFeed('f1');
    store.reset();

    expect(store.posts).toEqual([]);
    expect(store.nextCursor).toBeNull();
    expect(store.currentFamilyId).toBeNull();
  });
});
