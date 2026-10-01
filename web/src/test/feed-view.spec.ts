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

  it('exposes the exact accessible load-more label "Tải thêm bài viết" (feed.html mockup contract)', async () => {
    const auth = useAuthStore();
    auth.user = testUser;
    auth.status = 'authenticated';

    mockedFeedApi.list.mockResolvedValue({
      posts: [makePost()],
      next_cursor: { created_at: '2026-09-21T10:00:00Z', id: 'p1' },
    });

    const wrapper = mount(FeedView, { global: { plugins: [pinia], stubs: { RouterLink: true } } });
    await flushPromises();
    await flushPromises();

    const loadMore = wrapper.find('[data-testid="load-more"]');
    expect(loadMore.exists()).toBe(true);
    // Accessible name = the button's full text content (no aria-label override)
    expect(loadMore.attributes('aria-label')).toBeUndefined();
    expect(loadMore.text()).toBe('Tải thêm bài viết');
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
    expect(counter.classes()).not.toContain('text-danger-fg');

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
    expect(counter.classes()).toContain('text-danger-fg');

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
    expect(counter.classes()).not.toContain('text-danger-fg');
    expect(submit.attributes('disabled')).toBeUndefined();

    // 5000 runes: exactly at limit, still valid and enabled
    textareaComp.vm.$emit('update:modelValue', 'x'.repeat(5000));
    await flushPromises();
    expect(counter.text()).toBe('5000/5000');
    expect(counter.classes()).not.toContain('text-danger-fg');
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

  // ---- Phase 3 Quiet Clarity restyle (feed.html) — additive contract cases ----

  it('renders the Quiet Clarity header: accent eyebrow, ink title, visible family selector', async () => {
    const auth = useAuthStore();
    auth.user = testUser;
    auth.status = 'authenticated';

    mockedFeedApi.list.mockResolvedValue({ posts: [], next_cursor: null });

    const wrapper = mount(FeedView, { global: { plugins: [pinia], stubs: { RouterLink: true } } });
    await flushPromises();
    await flushPromises();

    // Eyebrow from the mockup feed-head
    expect(wrapper.text()).toContain('Chuyện nhà');

    const h1 = wrapper.find('h1');
    expect(h1.text()).toBe('Bảng tin dòng họ');
    expect(h1.classes()).toContain('text-ink-1');
    expect(h1.classes()).toContain('leading-[1.45]');

    // Family selector keeps its aria contract and gains the mockup's visible note label
    const select = wrapper.find('select');
    expect(select.exists()).toBe(true);
    // aria-label falls through AppSelect onto its root wrapper
    expect(wrapper.find('[aria-label="Chọn dòng họ"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Dòng họ');
  });

  it('styles the composer on the semantic card surface and manages image URL chips', async () => {
    const auth = useAuthStore();
    auth.user = testUser;
    auth.status = 'authenticated';

    mockedFeedApi.list.mockResolvedValue({ posts: [], next_cursor: null });

    const wrapper = mount(FeedView, { global: { plugins: [pinia], stubs: { RouterLink: true } } });
    await flushPromises();
    await flushPromises();

    const form = wrapper.find('[data-testid="composer-form"]');
    // Card recipe from the design system (surface-card + hairline + r-xl + shadow-1)
    expect(form.classes()).toContain('bg-card');
    expect(form.classes()).toContain('border-hairline');
    expect(form.classes()).toContain('rounded-app-xl');
    expect(form.classes()).toContain('shadow-e1');

    // Image URL chip: add via the URL input, remove via the chip's X button
    const urlInput = form.find('input[type="url"]');
    expect(urlInput.exists()).toBe(true);
    await urlInput.setValue('https://example.com/anh.jpg');
    await urlInput.trigger('keydown.enter');

    // The chip's outer pill is the first rounded-full span (DFS order)
    const chip = form.get('span.rounded-full');
    expect(chip.classes()).toContain('bg-well');
    expect(chip.classes()).toContain('text-ink-2');
    expect(form.find('span[title="https://example.com/anh.jpg"]').exists()).toBe(true);

    // Dedupe: adding the same URL twice keeps one chip
    await urlInput.setValue('https://example.com/anh.jpg');
    await urlInput.trigger('keydown.enter');
    expect(form.findAll('span[title="https://example.com/anh.jpg"]')).toHaveLength(1);

    // Remove the chip via its labeled button
    const removeButton = chip.find('button');
    expect(removeButton.attributes('aria-label')).toBe('Xóa ảnh 1');
    await removeButton.trigger('click');
    expect(form.findAll('span[title="https://example.com/anh.jpg"]')).toHaveLength(0);
  });

  it('keeps the anonymous banner on the warm tint surface with the login affordance', async () => {
    const auth = useAuthStore();
    auth.user = null;
    auth.status = 'anonymous';

    mockedFeedApi.list.mockResolvedValue({ posts: [], next_cursor: null });

    const wrapper = mount(FeedView, { global: { plugins: [pinia], stubs: { RouterLink: true } } });
    await flushPromises();
    await flushPromises();

    const hint = wrapper.find('[data-testid="anonymous-hint"]');
    expect(hint.classes()).toContain('bg-terracotta-soft');
    expect(hint.classes()).toContain('border-accent-border');
    expect(hint.classes()).toContain('rounded-app-xl');
    // Banner copy carries the accent foreground (AA on the tint), not slate
    expect(hint.find('p').classes()).toContain('text-accent-fg');
    // Composer must not render for anonymous users
    expect(wrapper.find('[data-testid="composer-form"]').exists()).toBe(false);
  });

  it('renders loading and error states on semantic surfaces with announced alerts', async () => {
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

    const errorBanner = wrapper.find('[data-testid="feed-error"]');
    expect(errorBanner.exists()).toBe(true);
    // state-card--error treatment: card surface + danger-fg border/heading
    expect(errorBanner.classes()).toContain('bg-card');
    expect(errorBanner.classes()).toContain('border-danger-fg');
    expect(errorBanner.find('p').classes()).toContain('text-danger-fg');
    // Errors are announced
    expect(errorBanner.attributes('role')).toBe('alert');
  });

  it('styles the loading skeleton with warm well placeholders and a status role', async () => {
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
    expect(skeleton.attributes('role')).toBe('status');
    const card = skeleton.find('.animate-pulse');
    expect(card.exists()).toBe(true);
    expect(card.classes()).toContain('bg-card');
    expect(card.classes()).toContain('rounded-app-xl');
    // Skeleton bars sit on the recessed well, never stock slate
    expect(card.find('.rounded.bg-well').exists()).toBe(true);

    resolveList({ posts: [], next_cursor: null });
    await flushPromises();
    await flushPromises();
    expect(wrapper.find('[data-testid="feed-loading"]').exists()).toBe(false);
  });
});

// Feeds-as-main additive contracts.
describe('FeedView guest, family, and demo states', () => {
  let pinia: ReturnType<typeof createPinia>;
  beforeEach(() => {
    pinia = createPinia(); setActivePinia(pinia); vi.clearAllMocks(); window.localStorage.clear();
    mockedFamiliesApi.listFamilies.mockResolvedValue({ families: [
      { id:'f1', name:'Gia tộc Nguyễn', version:1, created_at:'2026-09-21T00:00:00Z' },
      { id:'f2', name:'Gia tộc Trần', version:1, created_at:'2026-09-21T00:00:00Z' },
    ] });
  });
  it('keeps guest composer absent while load-more remains functional', async () => {
    const auth = useAuthStore(); auth.user = null; auth.status = 'anonymous';
    mockedFeedApi.list.mockResolvedValue({ posts:[makePost()], next_cursor:{created_at:'2026-09-21T10:00:00Z',id:'p1'} });
    const wrapper = mount(FeedView, { global:{ plugins:[pinia], stubs:{ RouterLink:true } } });
    await flushPromises();
    expect(wrapper.find('[data-testid="composer-form"]').exists()).toBe(false);
    const more = wrapper.find('[data-testid="load-more"]'); expect(more.exists()).toBe(true);
    await more.trigger('click'); await flushPromises();
    expect(mockedFeedApi.list).toHaveBeenCalledTimes(2);
  });
  it('renders a labeled family selector populated from store families without redirecting to Tree', async () => {
    const auth = useAuthStore(); auth.user = testUser; auth.status = 'authenticated';
    mockedFeedApi.list.mockResolvedValue({posts:[], next_cursor:null});
    const wrapper = mount(FeedView, { global:{ plugins:[pinia], stubs:{ RouterLink:true } } });
    await flushPromises();
    expect(wrapper.find('[data-testid="family-selector"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Chọn dòng họ"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="no-family"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Gia tộc Nguyễn'); expect(wrapper.text()).toContain('Gia tộc Trần');
    expect(mockedFamiliesApi.listFamilies).toHaveBeenCalled();
  });
  it('uses amber demo treatment only for demo accounts', async () => {
    const auth = useAuthStore(); auth.user = {...testUser, is_demo:true}; auth.status = 'authenticated';
    mockedFeedApi.list.mockResolvedValue({posts:[], next_cursor:null});
    const demo = mount(FeedView, { global:{ plugins:[pinia], stubs:{ RouterLink:true } } }); await flushPromises();
    const notice = demo.find('[data-testid="demo-notice"]');
    expect(notice.exists()).toBe(true); expect(notice.classes()).toContain('bg-demo-soft');
    expect(notice.classes().join(' ')).not.toContain('terracotta'); demo.unmount();
    auth.user = testUser;
    const regular = mount(FeedView, { global:{ plugins:[pinia], stubs:{ RouterLink:true } } }); await flushPromises();
    expect(regular.find('[data-testid="demo-notice"]').exists()).toBe(false);
  });
});

// Final-iteration fixes (MAJ-2 composer image-URL gate, MAJ-3 empty-state gating).
describe('FeedView composer image-URL validation and empty-state exclusivity', () => {
  let pinia: ReturnType<typeof createPinia>;
  beforeEach(() => {
    pinia = createPinia(); setActivePinia(pinia); vi.clearAllMocks(); window.localStorage.clear();
    mockedFamiliesApi.listFamilies.mockResolvedValue({ families: [
      { id:'f1', name:'Gia tộc Nguyễn', version:1, created_at:'2026-09-21T00:00:00Z' },
      { id:'f2', name:'Gia tộc Trần', version:1, created_at:'2026-09-21T00:00:00Z' },
    ] });
  });

  async function mountComposer() {
    const auth = useAuthStore(); auth.user = testUser; auth.status = 'authenticated';
    mockedFeedApi.list.mockResolvedValue({ posts: [], next_cursor: null });
    const wrapper = mount(FeedView, { global:{ plugins:[pinia], stubs:{ RouterLink:true } } });
    await flushPromises(); await flushPromises();
    return wrapper;
  }

  it('rejects non-http(s) image URLs with a role=alert message and adds no chip', async () => {
    const wrapper = await mountComposer();
    const form = wrapper.find('[data-testid="composer-form"]');
    const urlInput = form.find('input[type="url"]');

    // javascript: scheme must never enter the queue
    await urlInput.setValue('javascript:alert(1)');
    await urlInput.trigger('keydown.enter');

    const alertMsg = wrapper.find('[data-testid="image-url-error"]');
    expect(alertMsg.exists()).toBe(true);
    expect(alertMsg.attributes('role')).toBe('alert');
    expect(alertMsg.text()).toContain('URL ảnh không hợp lệ');
    expect(form.findAll('span[title="javascript:alert(1)"]')).toHaveLength(0);
    // Rejected input is flagged and kept for correction
    expect(urlInput.attributes('aria-invalid')).toBe('true');
    expect((urlInput.element as HTMLInputElement).value).toBe('javascript:alert(1)');

    // Other non-http(s) schemes rejected too (type="url" alone would accept them)
    await urlInput.setValue('ftp://example.com/anh.jpg');
    await urlInput.trigger('keydown.enter');
    expect(wrapper.findAll('[data-testid="image-url-error"]')).toHaveLength(1);
    expect(form.findAll('span[title="ftp://example.com/anh.jpg"]')).toHaveLength(0);
    expect(form.text()).not.toContain('Đã đăng bài viết');
  });

  it('accepts http:// and https:// URLs and clears the error once corrected', async () => {
    const wrapper = await mountComposer();
    const form = wrapper.find('[data-testid="composer-form"]');
    const urlInput = form.find('input[type="url"]');

    // Schemeless garbage rejected first
    await urlInput.setValue('example.com/anh.jpg');
    await urlInput.trigger('keydown.enter');
    expect(wrapper.find('[data-testid="image-url-error"]').exists()).toBe(true);

    // Corrected https URL: watch clears the stale rejection, chip is added
    await urlInput.setValue('https://example.com/anh.jpg');
    await flushPromises();
    expect(wrapper.find('[data-testid="image-url-error"]').exists()).toBe(false);
    await urlInput.trigger('keydown.enter');
    expect(form.findAll('span[title="https://example.com/anh.jpg"]')).toHaveLength(1);

    // Plain http:// is equally valid
    await urlInput.setValue('http://example.com/anh2.jpg');
    await urlInput.trigger('keydown.enter');
    expect(form.findAll('span[title="http://example.com/anh2.jpg"]')).toHaveLength(1);
  });

  it('keeps the 10-image cap while invalid entries never consume slots', async () => {
    const wrapper = await mountComposer();
    const form = wrapper.find('[data-testid="composer-form"]');
    const urlInput = form.find('input[type="url"]');

    await urlInput.setValue('notaurl');
    await urlInput.trigger('keydown.enter');
    for (let i = 0; i < 12; i++) {
      await urlInput.setValue(`https://example.com/${i}.jpg`);
      await urlInput.trigger('keydown.enter');
    }
    expect(form.findAll('span[title^="https://example.com/"]')).toHaveLength(10);
  });

  it('renders the labeled no-family state exclusively — first-post empty state is gated on a selected family', async () => {
    mockedFamiliesApi.listFamilies.mockResolvedValue({ families: [] });
    const auth = useAuthStore(); auth.user = testUser; auth.status = 'authenticated';
    mockedFeedApi.list.mockResolvedValue({ posts: [], next_cursor: null });

    const wrapper = mount(FeedView, { global:{ plugins:[pinia], stubs:{ RouterLink:true } } });
    await flushPromises(); await flushPromises();

    expect(wrapper.find('[data-testid="no-family"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Chưa chọn dòng họ');
    // MAJ-3 exclusivity: generic first-post prompt must NOT co-render
    expect(wrapper.find('[data-testid="feed-empty"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="composer-form"]').exists()).toBe(false);
  });
});
