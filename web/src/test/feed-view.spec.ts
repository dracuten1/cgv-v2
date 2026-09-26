import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import FeedView from '@/views/FeedView.vue';
import { useAuthStore } from '@/stores/auth';
import { feedApi } from '@/api/feed';
import { familiesApi } from '@/api/families';
import type { FeedListResponse, FeedPost, FeedPostItem, User } from '@/types/api';

vi.mock('@/api/feed', () => ({
  feedApi: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/api/families', () => ({
  familiesApi: {
    listFamilies: vi.fn(),
    getTree: vi.fn(),
    exportExcel: vi.fn(),
    importExcel: vi.fn(),
  },
}));

const mockedFeedApi = vi.mocked(feedApi);
const mockedFamiliesApi = vi.mocked(familiesApi);

function makePost(overrides: Partial<FeedPostItem> = {}): FeedPostItem {
  return {
    id: 'p1',
    family_id: 'f1',
    author_member_id: null,
    content: 'Nội dung bài viết',
    images: [],
    created_at: '2026-09-21T10:00:00Z',
    author_display_name: 'Nguyễn Văn An',
    ...overrides,
  };
}

const testUser: User = {
  id: 'u1',
  display_name: 'Nguyễn Văn An',
  is_demo: false,
  member_id: null,
  created_at: '2026-09-21T00:00:00Z',
};

const viDate = (iso: string): string =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso)
  );

describe('FeedView', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
    window.localStorage.clear();

    mockedFamiliesApi.listFamilies.mockResolvedValue({
      families: [
        { id: 'f1', name: 'Gia tộc Nguyễn', version: 1, created_at: '2026-09-21T00:00:00Z' },
        { id: 'f2', name: 'Gia tộc Trần', version: 1, created_at: '2026-09-21T00:00:00Z' },
      ],
    });
  });

  it('shows the anonymous hint card with login CTA and NO composer when logged out', async () => {
    const auth = useAuthStore();
    auth.user = null;
    auth.status = 'anonymous';

    mockedFeedApi.list.mockResolvedValue({ posts: [], next_cursor: null } as FeedListResponse);

    const wrapper = mount(FeedView, { global: { plugins: [pinia], stubs: { RouterLink: true } } });
    await flushPromises();
    await flushPromises();

    expect(wrapper.find('[data-testid="anonymous-hint"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Đăng nhập để đăng bài viết.');
    expect(wrapper.find('[data-testid="login-cta"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="composer-form"]').exists()).toBe(false);
    // Warm banner per §4.10 (terracotta-soft, never cold slate)
    expect(wrapper.find('[data-testid="anonymous-hint"]').classes()).toContain('bg-terracotta-soft');
  });

  it('renders the composer for authenticated users', async () => {
    const auth = useAuthStore();
    auth.user = testUser;
    auth.status = 'authenticated';

    mockedFeedApi.list.mockResolvedValue({ posts: [], next_cursor: null });

    const wrapper = mount(FeedView, { global: { plugins: [pinia], stubs: { RouterLink: true } } });
    await flushPromises();
    await flushPromises();

    const form = wrapper.find('[data-testid="composer-form"]');
    expect(form.exists()).toBe(true);
    // Uses AppAvatar w-10 for composer author
    const avatar = form.findComponent({ name: 'AppAvatar' });
    expect(avatar.exists()).toBe(true);
    expect(avatar.props('size')).toBe('w-10');

    // Uses AppTextarea borderless
    const textarea = form.findComponent({ name: 'AppTextarea' });
    expect(textarea.exists()).toBe(true);
    expect(textarea.props('variant')).toBe('borderless');
    expect(form.find('textarea').attributes('placeholder')).toBe(
      'Chia sẻ câu chuyện với gia đình…'
    );
    expect(form.text()).toContain('Thêm ảnh');
    expect(form.text()).toContain('Đăng bài');
    expect(form.text()).toContain('Bài viết hiển thị cho cả gia đình');
  });

  it('renders PostCards with author, vi-VN date and image grids (1 vs 3 images)', async () => {
    const auth = useAuthStore();
    auth.user = testUser;
    auth.status = 'authenticated';

    mockedFeedApi.list.mockResolvedValue({
      posts: [
        makePost({ id: 'p-one', content: 'Một ảnh', images: ['https://a/1.jpg'] }),
        makePost({
          id: 'p-three',
          content: 'Ba ảnh',
          author_display_name: 'Trần Thị Bính',
          images: ['https://a/1.jpg', 'https://a/2.jpg', 'https://a/3.jpg'],
        }),
      ],
      next_cursor: null,
    });

    const wrapper = mount(FeedView, { global: { plugins: [pinia], stubs: { RouterLink: true } } });
    await flushPromises();
    await flushPromises();

    const list = wrapper.find('[data-testid="feed-list"]');
    expect(list.exists()).toBe(true);

    const cards = list.findAll('article');
    expect(cards).toHaveLength(2);

    // Author attribution
    expect(cards[0].text()).toContain('Nguyễn Văn An');
    expect(cards[0].text()).toContain('Một ảnh');

    // vi-VN formatted date (medium date + short time)
    expect(cards[0].find('[data-testid="post-date"]').text()).toBe(
      viDate('2026-09-21T10:00:00Z')
    );

    // Image grid layout classes: 1 image → grid-cols-1, 3 images → grid-cols-3
    const grids = list.findAll('[data-testid="image-grid"]');
    expect(grids).toHaveLength(2);
    expect(grids[0].classes()).toContain('grid-cols-1');
    expect(grids[1].classes()).toContain('grid-cols-3');
  });

  it('shows the Vietnamese empty state when the family has no posts', async () => {
    const auth = useAuthStore();
    auth.user = testUser;
    auth.status = 'authenticated';

    mockedFeedApi.list.mockResolvedValue({ posts: [], next_cursor: null });

    const wrapper = mount(FeedView, { global: { plugins: [pinia], stubs: { RouterLink: true } } });
    await flushPromises();
    await flushPromises();

    expect(wrapper.find('[data-testid="feed-empty"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Chưa có bài viết nào. Hãy chia sẻ bài viết đầu tiên!');
  });

  it('restores the persisted family choice and shows "Tải thêm" when a cursor exists', async () => {
    const auth = useAuthStore();
    auth.user = testUser;
    auth.status = 'authenticated';

    window.localStorage.setItem('cgp.familyId', 'f2');

    mockedFeedApi.list.mockResolvedValue({
      posts: [makePost()],
      next_cursor: { created_at: '2026-09-21T10:00:00Z', id: 'p1' },
    });

    const wrapper = mount(FeedView, { global: { plugins: [pinia], stubs: { RouterLink: true } } });
    await flushPromises();
    await flushPromises();

    // Persisted family (f2) preferred over the first family (f1)
    expect(mockedFeedApi.list).toHaveBeenCalledWith(
      'f2',
      expect.objectContaining({ limit: 20 })
    );

    const loadMore = wrapper.find('[data-testid="load-more"]');
    expect(loadMore.exists()).toBe(true);
    expect(loadMore.text()).toContain('Tải thêm');
  });

  it('shows a Vietnamese error state when the feed request fails', async () => {
    const auth = useAuthStore();
    auth.user = testUser;
    auth.status = 'authenticated';

    mockedFeedApi.list.mockRejectedValue(
      Object.assign(new Error('Máy chủ gặp sự cố. Vui lòng thử lại sau.'), {
        status: 500,
        code: 'HTTP_500',
      })
    );

    const wrapper = mount(FeedView, { global: { plugins: [pinia], stubs: { RouterLink: true } } });
    await flushPromises();
    await flushPromises();

    expect(wrapper.find('[data-testid="feed-error"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Máy chủ gặp sự cố. Vui lòng thử lại sau.');
  });

  it('shows the loading skeleton while the feed fetches, then the list', async () => {
    const auth = useAuthStore();
    auth.user = testUser;
    auth.status = 'authenticated';

    let resolveList!: (v: FeedListResponse) => void;
    mockedFeedApi.list.mockImplementation(
      () => new Promise<FeedListResponse>((res) => (resolveList = res))
    );

    const wrapper = mount(FeedView, { global: { plugins: [pinia], stubs: { RouterLink: true } } });
    await flushPromises();

    const skeleton = wrapper.find('[data-testid="feed-loading"]');
    expect(skeleton.exists()).toBe(true);
    // Warm pulse placeholders, not a cold spinner
    expect(skeleton.find('.animate-pulse').exists()).toBe(true);
    expect(skeleton.text()).toContain('Đang tải bài viết…');

    resolveList({ posts: [makePost()], next_cursor: null });
    await flushPromises();
    await flushPromises();

    expect(wrapper.find('[data-testid="feed-loading"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="feed-list"]').exists()).toBe(true);
  });

  it('enforces the backend 5000-rune budget: maxlength attr + live counter', async () => {
    const auth = useAuthStore();
    auth.user = testUser;
    auth.status = 'authenticated';

    mockedFeedApi.list.mockResolvedValue({ posts: [], next_cursor: null });

    const wrapper = mount(FeedView, { global: { plugins: [pinia], stubs: { RouterLink: true } } });
    await flushPromises();
    await flushPromises();

    const form = wrapper.find('[data-testid="composer-form"]');
    const textarea = form.find('textarea');
    const counter = form.find('[data-testid="composer-char-counter"]');

    // Backend parity: api/internal/feed/service.go MaxContentRunes = 5000
    expect(textarea.attributes('maxlength')).toBe('5000');
    expect(counter.text()).toBe('0/5000');

    await textarea.setValue('Xin chào cả nhà');
    expect(counter.text()).toBe('15/5000');
    expect(counter.classes()).not.toContain('text-red-600');

    // Publish stays enabled within budget
    const submit = form.find('button[type="submit"]');
    expect(submit.attributes('disabled')).toBeUndefined();
  });

  it('disables publish and flags the counter red beyond the rune budget', async () => {
    const auth = useAuthStore();
    auth.user = testUser;
    auth.status = 'authenticated';

    mockedFeedApi.list.mockResolvedValue({ posts: [], next_cursor: null });

    const wrapper = mount(FeedView, { global: { plugins: [pinia], stubs: { RouterLink: true } } });
    await flushPromises();
    await flushPromises();

    const form = wrapper.find('[data-testid="composer-form"]');
    // maxlength clamps real typing; drive the model past the budget directly
    // (mirrors an IME / programmatic overflow) to exercise the guard rail.
    const textareaComp = form.findComponent({ name: 'AppTextarea' });
    textareaComp.vm.$emit('update:modelValue', 'a'.repeat(5001));
    await flushPromises();

    const counter = form.find('[data-testid="composer-char-counter"]');
    expect(counter.text()).toBe('5001/5000');
    expect(counter.classes()).toContain('text-red-600');

    const submit = form.find('button[type="submit"]');
    expect(submit.attributes('disabled')).toBeDefined();
  });

  it('handles boundary rune counts (4999, 5000) and multibyte/emoji correctly', async () => {
    const auth = useAuthStore();
    auth.user = testUser;
    auth.status = 'authenticated';

    mockedFeedApi.list.mockResolvedValue({ posts: [], next_cursor: null });

    const wrapper = mount(FeedView, { global: { plugins: [pinia], stubs: { RouterLink: true } } });
    await flushPromises();
    await flushPromises();

    const form = wrapper.find('[data-testid="composer-form"]');
    const textareaComp = form.findComponent({ name: 'AppTextarea' });
    const counter = form.find('[data-testid="composer-char-counter"]');
    const submit = form.find('button[type="submit"]');

    // 4999 runes: valid and enabled
    textareaComp.vm.$emit('update:modelValue', 'x'.repeat(4999));
    await flushPromises();
    expect(counter.text()).toBe('4999/5000');
    expect(counter.classes()).not.toContain('text-red-600');
    expect(submit.attributes('disabled')).toBeUndefined();

    // 5000 runes: exactly at limit, still valid and enabled
    textareaComp.vm.$emit('update:modelValue', 'x'.repeat(5000));
    await flushPromises();
    expect(counter.text()).toBe('5000/5000');
    expect(counter.classes()).not.toContain('text-red-600');
    expect(submit.attributes('disabled')).toBeUndefined();

    // Multibyte Vietnamese and emojis: code points vs UTF-16 code units
    // E.g. '🌳' (surrogate pair in JS string length=2, but 1 rune in [...str])
    // 'Cây phả hệ 🌳' = 11 characters + 1 emoji = 12 runes
    const complexText = 'Cây phả hệ 🌳';
    textareaComp.vm.$emit('update:modelValue', complexText);
    await flushPromises();
    expect(counter.text()).toBe('12/5000');
    expect(submit.attributes('disabled')).toBeUndefined();
  });

  it('composer submitting state: CTA disabled with spinner label while createPost is in flight', async () => {
    const auth = useAuthStore();
    auth.user = testUser;
    auth.status = 'authenticated';

    mockedFeedApi.list.mockResolvedValue({ posts: [], next_cursor: null });
    let resolveCreate!: (v: FeedPost) => void;
    mockedFeedApi.create.mockImplementation(
      () => new Promise<FeedPost>((res) => (resolveCreate = res))
    );

    const wrapper = mount(FeedView, { global: { plugins: [pinia], stubs: { RouterLink: true } } });
    await flushPromises();
    await flushPromises();

    const form = wrapper.find('[data-testid="composer-form"]');
    await form.find('textarea').setValue('Bài viết đầu tiên');

    const submit = form.find('button[type="submit"]');
    expect(submit.text()).toContain('Đăng bài');

    await form.trigger('submit');
    await flushPromises();

    // In flight: aria-busy on the form, spinner label, CTA disabled
    expect(form.attributes('aria-busy')).toBe('true');
    expect(submit.text()).toContain('Đang đăng…');
    expect(submit.attributes('disabled')).toBeDefined();

    resolveCreate({
      id: 'p-new',
      family_id: 'f1',
      author_member_id: null,
      content: 'Bài viết đầu tiên',
      images: [],
      created_at: '2026-09-25T00:00:00Z',
    });
    await flushPromises();
    await flushPromises();

    expect(form.attributes('aria-busy')).toBeUndefined();
    expect(form.find('button[type="submit"]').text()).toContain('Đăng bài');
    // Composer resets after a successful post
    expect((form.find('textarea').element as HTMLTextAreaElement).value).toBe('');
  });
});
