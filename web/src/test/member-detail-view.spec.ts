import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';

vi.mock('@/api/members', () => ({
  membersApi: {
    listMembers: vi.fn(),
    getMember: vi.fn(),
    createMember: vi.fn(),
    updateMember: vi.fn(),
    deleteMember: vi.fn(),
  },
}));

vi.mock('@/api/families', () => ({
  familiesApi: {
    listFamilies: vi.fn().mockResolvedValue({ families: [] }),
    getTree: vi
      .fn()
      .mockResolvedValue({ family_id: 'f1', version: 1, generations: [], roots: [] }),
    exportExcel: vi.fn(),
    importExcel: vi.fn(),
  },
}));

import { membersApi } from '@/api/members';
import { familiesApi } from '@/api/families';
import { useTreeStore } from '@/stores/tree';
import MemberDetailView from '@/views/MemberDetailView.vue';
import type { MemberDetailResponse } from '@/types/api';

const mockedGetMember = vi.mocked(membersApi.getMember);
const mockedDelete = vi.mocked(membersApi.deleteMember);
const mockedGetTree = vi.mocked(familiesApi.getTree);

// Passthrough dialog stubs keep dialogs in wrapper DOM
const AppDialogStub = {
  name: 'AppDialog',
  props: { open: { type: Boolean, default: false }, title: { type: String, default: '' } },
  emits: ['close'],
  template: `<div v-if="open" class="dialog-stub"><slot /><slot name="footer" /></div>`,
};

const memberPayload = (): MemberDetailResponse => ({
  id: 'member-9',
  family_id: 'f1',
  full_name: 'Nguyễn Văn An',
  gender: 'male',
  generation_index: 1,
  birth_date: '1930-04-12',
  death_date: '2001-08-30',
  is_living: false,
  notes: 'Thủy tổ dòng họ',
  created_at: '2026-01-01T00:00:00Z',
  family_name: 'Họ Nguyễn',
  relations: {
    parents: [],
    spouses: [
      {
        id: 'spouse-1',
        family_id: 'f1',
        full_name: 'Trần Thị Bích',
        gender: 'female',
        generation_index: 1,
        is_living: false,
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    siblings: [],
    children: [
      {
        id: 'child-1',
        family_id: 'f1',
        full_name: 'Nguyễn Văn Bình',
        gender: 'male',
        generation_index: 2,
        is_living: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
  },
  posts: [
    {
      id: 'post-1',
      family_id: 'f1',
      author_member_id: 'member-9',
      content: 'Lễ giỗ tổ năm nay tổ chức trang trọng.',
      images: [],
      created_at: '2026-03-10T08:00:00Z',
    },
  ],
});

const mountDetail = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/tree', component: { template: '<div />' } },
      { path: '/members/:id', component: MemberDetailView },
    ],
  });
  router.push('/members/member-9');
  await router.isReady();

  return mount(MemberDetailView, {
    global: {
      plugins: [router],
      stubs: { AppDialog: AppDialogStub },
    },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  
  setActivePinia(createPinia());
  mockedGetMember.mockResolvedValue(memberPayload());
  mockedDelete.mockResolvedValue({ message: 'Xóa thành viên thành công' });
  mockedGetTree.mockResolvedValue({ family_id: 'f1', version: 1, generations: [], roots: [] });
});

describe('MemberDetailView', () => {
  it('fetches the member on mount and renders header with generation badge', async () => {
    const wrapper = await mountDetail();
    await flushPromises();

    expect(mockedGetMember).toHaveBeenCalledWith('member-9');
    // Hero card uses the shared AppAvatar (w-14, gen-tinted initials fallback)
    const heroAvatar = wrapper.find('[data-testid="member-hero-avatar"]');
    expect(heroAvatar.exists()).toBe(true);
    const avatarComponent = wrapper.findComponent({ name: 'AppAvatar' });
    expect(avatarComponent.exists()).toBe(true);
    expect(avatarComponent.props('size')).toBe('w-14');
    expect(avatarComponent.props('generation')).toBe(1);

    expect(wrapper.find('[data-testid="member-name"]').text()).toBe('Nguyễn Văn An');
    expect(wrapper.find('[data-testid="member-generation-badge"]').text()).toBe('Đời thứ 1');
    expect(wrapper.find('[data-testid="member-living-status"]').text()).toBe('Đã mất');
  });

  it('renders the three Vietnamese tabs', async () => {
    const wrapper = await mountDetail();
    await flushPromises();

    const tabs = wrapper.find('[data-testid="member-tabs"]');
    expect(tabs.text()).toContain('Tổng quan');
    expect(tabs.text()).toContain('Quan hệ');
    expect(tabs.text()).toContain('Bảng tin');
  });

  it('tab buttons carry focus-visible terracotta rings (INV-06)', async () => {
    const wrapper = await mountDetail();
    await flushPromises();

    const tabButtons = wrapper.findAll('[data-testid="member-tabs"] button[role="tab"]');
    expect(tabButtons.length).toBe(3);
    for (const tab of tabButtons) {
      expect(tab.classes()).toContain('focus-visible:ring-2');
      expect(tab.classes()).toContain('focus-visible:ring-terracotta');
      expect(tab.classes()).toContain('focus-visible:ring-inset');
    }
  });

  it('Tổng quan tab shows vital dates, living status, notes, family name', async () => {
    const wrapper = await mountDetail();
    await flushPromises();

    const panel = wrapper.find('[data-testid="tab-panel-overview"]');
    expect(panel.exists()).toBe(true);
    expect(panel.text()).toContain('12/04/1930');
    expect(panel.text()).toContain('30/08/2001');
    expect(panel.text()).toContain('Thủy tổ dòng họ');
    expect(panel.text()).toContain('Họ Nguyễn');
  });

  it('Quan hệ tab lists spouses + children with links to their profiles', async () => {
    const wrapper = await mountDetail();
    await flushPromises();
    await wrapper.find('[data-testid="tab-relations"]').trigger('click');

    const panel = wrapper.find('[data-testid="tab-panel-relations"]');
    expect(panel.exists()).toBe(true);
    expect(panel.text()).toContain('Trần Thị Bích');
    expect(panel.text()).toContain('Nguyễn Văn Bình');
    expect(wrapper.find('[data-testid="relation-child-1"]').attributes('href')).toBe(
      '/members/child-1'
    );
  });

  it('relation cards are gen-stripe cards with AppAvatar, gen label and gender micro-badge', async () => {
    const wrapper = await mountDetail();
    await flushPromises();
    await wrapper.find('[data-testid="tab-relations"]').trigger('click');

    const childCard = wrapper.find('[data-testid="relation-child-1"]');
    // 4px gen-stripe left border driven by generation_index=2
    expect(childCard.attributes('style')).toContain('border-left-width: 4px');
    expect(childCard.attributes('style')).toContain('border-left-color: var(--gen-2)');
    // Avatar inside the card
    expect(childCard.findComponent({ name: 'AppAvatar' }).exists()).toBe(true);
    // Gen label + gender micro-badge
    expect(childCard.text()).toContain('Đời thứ 2');
    expect(childCard.text()).toContain('Nam');
  });

  it('Bảng tin tab shows the member posts timeline', async () => {
    const wrapper = await mountDetail();
    await flushPromises();
    await wrapper.find('[data-testid="tab-posts"]').trigger('click');

    const panel = wrapper.find('[data-testid="tab-panel-posts"]');
    expect(panel.text()).toContain('Lễ giỗ tổ năm nay tổ chức trang trọng.');
  });

  it('posts tab reuses the PostCard idiom (author attribution + timestamp)', async () => {
    const wrapper = await mountDetail();
    await flushPromises();
    await wrapper.find('[data-testid="tab-posts"]').trigger('click');

    const panel = wrapper.find('[data-testid="tab-panel-posts"]');
    const articles = panel.findAll('article');
    expect(articles.length).toBe(1);
    // PostCard contract: author line + datetime element
    expect(articles[0].find('[data-testid="post-author"]').text()).toBe('Nguyễn Văn An');
    expect(articles[0].find('time').exists()).toBe(true);
  });

  it('anonymous users see "Đăng nhập để chỉnh sửa" instead of edit/delete', async () => {
    const wrapper = await mountDetail();
    await flushPromises();

    expect(wrapper.find('[data-testid="member-edit"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="member-delete"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="member-auth-hint"]').text()).toContain(
      'Đăng nhập để chỉnh sửa'
    );
  });

  it('delete flow: confirm dialog → store delete → toast + back to /tree', async () => {
    // Prime tree so invalidate refetches (mirrors real app sequence)
    const treeStore = useTreeStore();
    await treeStore.fetchTree('f1');
    mockedGetTree.mockClear();

    // Authenticate via the real auth store by simulating a session
    const { useAuthStore } = await import('@/stores/auth');
    const auth = useAuthStore();
    auth.user = {
      id: 'user-1',
      display_name: 'Tester',
      is_demo: true,
      member_id: null,
      created_at: '2026-01-01T00:00:00Z',
    };
    auth.status = 'authenticated';

    const wrapper = await mountDetail();
    await flushPromises();

    // Open confirm dialog
    await wrapper.find('[data-testid="member-delete"]').trigger('click');
    expect(wrapper.find('[data-testid="delete-confirm-text"]').text()).toContain(
      'Xóa thành viên này?'
    );

    // Confirm
    mockedDelete.mockClear();
    await wrapper.find('[data-testid="delete-confirm-button"]').trigger('click');
    await flushPromises();

    expect(mockedDelete).toHaveBeenCalledWith('member-9');
    expect(mockedGetTree).toHaveBeenCalledTimes(1); // tree invalidated
  });
});
