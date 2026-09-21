import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/api/families', () => ({
  familiesApi: {
    listFamilies: vi.fn(),
    getTree: vi.fn().mockResolvedValue({ family_id: 'f1', version: 1, generations: [], roots: [] }),
    exportExcel: vi.fn(),
    importExcel: vi.fn(),
  },
}));

vi.mock('@/api/me', () => ({
  meApi: { getMe: vi.fn().mockRejectedValue(new Error('anonymous')) },
}));

import { familiesApi } from '@/api/families';
import { useTreeStore } from '@/stores/tree';
import ExcelPanel from '@/components/excel/ExcelPanel.vue';

const mockedExport = vi.mocked(familiesApi.exportExcel);
const mockedImport = vi.mocked(familiesApi.importExcel);
const mockedGetTree = vi.mocked(familiesApi.getTree);

const mountPanel = () =>
  mount(ExcelPanel, {
    props: { familyId: 'f1', familyName: 'Họ Nguyễn' },
    global: {
      stubs: {
        AppDialog: {
          name: 'AppDialog',
          props: { open: Boolean },
          template: '<div v-if="open" class="dialog-stub"><slot /><slot name="footer" /></div>',
        },
      },
    },
  });

/** jsdom has no URL.createObjectURL / anchor click for downloads */
function stubDownload() {
  const revoke = vi.fn();
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = revoke;
  const click = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const original = HTMLAnchorElement.prototype as any;
  original.click = click;
  return { revoke, click };
}

beforeEach(() => {
  vi.clearAllMocks();
  setActivePinia(createPinia());
  mockedExport.mockResolvedValue(new Blob(['excel'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  mockedGetTree.mockResolvedValue({ family_id: 'f1', version: 1, generations: [], roots: [] });
});

describe('ExcelPanel', () => {
  it('downloads a family-name.xlsx blob on export', async () => {
    const { click, revoke } = stubDownload();
    const wrapper = mountPanel();
    await flushPromises();

    await wrapper.find('[data-testid="excel-export"]').trigger('click');
    await flushPromises();

    expect(mockedExport).toHaveBeenCalledWith('f1');
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:fake');
  });

  it('gates import behind auth with Vietnamese hint when anonymous', async () => {
    const wrapper = mountPanel();
    await flushPromises();

    expect(wrapper.find('[data-testid="excel-import-open"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="excel-import-auth-hint"]').text()).toContain(
      'Đăng nhập để nhập Excel'
    );
  });

  it('rejects non-.xlsx files with a Vietnamese error', async () => {
    const { useAuthStore } = await import('@/stores/auth');
    const auth = useAuthStore();
    auth.status = 'authenticated';
    auth.user = { id: 'u1', display_name: 'T', is_demo: true, member_id: null, created_at: '2026-01-01T00:00:00Z' };

    const wrapper = mountPanel();
    await flushPromises();

    await wrapper.find('[data-testid="excel-import-open"]').trigger('click');
    const input = wrapper.find('[data-testid="excel-file-input"]').element as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'not-excel.pdf', { type: 'application/pdf' })],
      configurable: true,
    });
    await wrapper.find('[data-testid="excel-file-input"]').trigger('change');

    expect(wrapper.find('[data-testid="excel-file-error"]').text()).toContain(
      'Vui lòng chọn tệp Excel (.xlsx).'
    );
  });

  it('imports a valid .xlsx, shows Vietnamese summary, refetches tree', async () => {
    const { useAuthStore } = await import('@/stores/auth');
    const auth = useAuthStore();
    auth.status = 'authenticated';
    auth.user = { id: 'u1', display_name: 'T', is_demo: true, member_id: null, created_at: '2026-01-01T00:00:00Z' };

    const treeStore = useTreeStore();
    await treeStore.fetchTree('f1');
    mockedGetTree.mockClear();

    mockedImport.mockResolvedValue({
      created: 5,
      skipped_duplicates: 2,
      errors: ['Dòng 7: Họ tên không được để trống'],
    });

    const wrapper = mountPanel();
    await flushPromises();

    await wrapper.find('[data-testid="excel-import-open"]').trigger('click');
    const input = wrapper.find('[data-testid="excel-file-input"]').element as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'thanh-vien.xlsx')],
      configurable: true,
    });
    await wrapper.find('[data-testid="excel-file-input"]').trigger('change');

    await wrapper.find('[data-testid="excel-import-submit"]').trigger('click');
    await flushPromises();

    expect(mockedImport).toHaveBeenCalledWith('f1', expect.any(File));
    const summary = wrapper.find('[data-testid="excel-import-summary"]');
    expect(summary.text()).toContain('Đã nhập: 5 thành viên.');
    expect(summary.text()).toContain('Bỏ qua trùng lặp: 2.');
    expect(summary.text()).toContain('Dòng 7: Họ tên không được để trống');
    // created > 0 → tree refetched even with row errors
    expect(mockedGetTree).toHaveBeenCalledTimes(1);
  });
});
