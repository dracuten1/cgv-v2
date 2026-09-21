import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import MemberEditDialog from '@/components/member/MemberEditDialog.vue';

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
      .mockResolvedValue({ family_id: 'f1', version: 2, generations: [], roots: [] }),
    exportExcel: vi.fn(),
    importExcel: vi.fn(),
  },
}));

import { membersApi } from '@/api/members';
import { familiesApi } from '@/api/families';

const mockedCreate = vi.mocked(membersApi.createMember);
const mockedUpdate = vi.mocked(membersApi.updateMember);
const mockedGetTree = vi.mocked(familiesApi.getTree);

// Passthrough dialog stub keeps the form in the wrapper DOM (real AppDialog teleports)
const AppDialogStub = {
  name: 'AppDialog',
  props: { open: { type: Boolean, default: false }, title: { type: String, default: '' } },
  emits: ['close'],
  template: `<div v-if="open" class="dialog-stub"><slot /><slot name="footer" /></div>`,
};

function mountDialog(props: Record<string, unknown> = {}) {
  return mount(MemberEditDialog, {
    props: { open: true, familyId: 'family-1', ...props },
    global: {
      stubs: { AppDialog: AppDialogStub, Teleport: true },
    },
  });
}

const editMember = {
  id: 'member-9',
  family_id: 'family-1',
  full_name: 'Nguyễn Văn An',
  gender: 'male',
  generation_index: 1,
  birth_date: '1930-04-12',
  death_date: '2001-08-30',
  is_living: false,
  notes: 'Thủy tổ',
};

beforeEach(() => {
  vi.clearAllMocks();
  setActivePinia(createPinia());
  mockedCreate.mockResolvedValue({
    id: 'new-1',
    family_id: 'family-1',
    full_name: 'Nguyễn Thị Mai',
    gender: 'female',
    generation_index: 1,
    is_living: true,
    created_at: '2026-01-01T00:00:00Z',
  });
  mockedUpdate.mockResolvedValue({ message: 'OK' });
  mockedGetTree.mockResolvedValue({ family_id: 'f1', version: 2, generations: [], roots: [] });
});

describe('MemberEditDialog — INV-03 gender boundary', () => {
  it('hydrates API gender "male" → Vietnamese form value "Nam"', async () => {
    const wrapper = mountDialog({ member: editMember });
    await flushPromises();

    const select = wrapper.find('select');
    expect((select.element as HTMLSelectElement).value).toBe('Nam');
    // Live preview shows Vietnamese chip
    expect(wrapper.find('[data-testid="preview-gender"]').text()).toBe('Nam');
  });

  it('hydrates API gender "female" → Vietnamese form value "Nữ"', async () => {
    const wrapper = mountDialog({
      member: { ...editMember, gender: 'female', full_name: 'Nguyễn Thị Dung' },
    });
    await flushPromises();

    const select = wrapper.find('select');
    expect((select.element as HTMLSelectElement).value).toBe('Nữ');
    expect(wrapper.find('[data-testid="preview-gender"]').text()).toBe('Nữ');
  });

  it('submits form "Nữ" → payload gender "female" (create mode)', async () => {
    const wrapper = mountDialog(); // create mode
    await flushPromises();

    await wrapper.find('#member-full-name').setValue('Nguyễn Thị Mai');
    await wrapper.find('select').setValue('Nữ');
    await wrapper.find('[data-testid="member-save"]').trigger('click');
    await flushPromises();

    expect(mockedCreate).toHaveBeenCalledTimes(1);
    const payload = mockedCreate.mock.calls[0][0];
    expect(payload.full_name).toBe('Nguyễn Thị Mai');
    expect(payload.gender).toBe('female');
    expect(payload.family_id).toBe('family-1');
  });

  it('submits form "Nam" → payload gender "male" (edit mode)', async () => {
    const wrapper = mountDialog({ member: editMember });
    await flushPromises();

    // User re-picks 'Nam' explicitly
    await wrapper.find('select').setValue('Nam');
    await wrapper.find('[data-testid="member-save"]').trigger('click');
    await flushPromises();

    expect(mockedUpdate).toHaveBeenCalledTimes(1);
    const [id, payload] = mockedUpdate.mock.calls[0];
    expect(id).toBe('member-9');
    expect(payload.gender).toBe('male');
  });

  it('invalidates the tree store after successful save', async () => {
    // Prime the tree store so invalidate() has a family to refetch
    const { useTreeStore } = await import('@/stores/tree');
    const treeStore = useTreeStore();
    await treeStore.fetchTree('f1');
    expect(treeStore.version).toBe(2);

    const wrapper = mountDialog();
    await flushPromises();

    await wrapper.find('#member-full-name').setValue('Nguyễn Thị Mai');
    await wrapper.find('select').setValue('Nữ');
    await wrapper.find('[data-testid="member-save"]').trigger('click');
    await flushPromises();

    // tree store invalidate() → familiesApi.getTree refetch
    expect(mockedGetTree).toHaveBeenCalledTimes(2); // initial + invalidate
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('shows Vietnamese validation error and skips API on empty name', async () => {
    const wrapper = mountDialog();
    await flushPromises();

    await wrapper.find('[data-testid="member-save"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Vui lòng nhập họ tên.');
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('live preview updates reactively as the user types', async () => {
    const wrapper = mountDialog();
    await flushPromises();

    expect(wrapper.find('[data-testid="preview-name"]').text()).toBe('Họ và tên'); // placeholder state

    await wrapper.find('#member-full-name').setValue('Trần Văn Bình');
    expect(wrapper.find('[data-testid="preview-name"]').text()).toBe('Trần Văn Bình');
    expect(wrapper.find('[data-testid="preview-initials"]').text()).toBe('VB');
  });

  it('clears death date when "Đang sống" is checked', async () => {
    const wrapper = mountDialog({ member: editMember }); // is_living: false, has death date
    await flushPromises();

    await wrapper.find('[data-testid="member-is-living"]').setValue(true);
    await wrapper.find('[data-testid="member-save"]').trigger('click');
    await flushPromises();

    const payload = mockedUpdate.mock.calls[0][1];
    expect(payload.is_living).toBe(true);
    expect(payload.death_date).toBeNull();
  });
});
