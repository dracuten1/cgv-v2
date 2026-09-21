import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatApiError, ApiError, apiClient } from '@/api/client';

describe('formatApiError & ApiError', () => {
  it('formats 401 to Vietnamese login prompt', () => {
    const err = new ApiError(401, 'UNAUTHORIZED', '');
    expect(formatApiError(err)).toBe('Bạn cần đăng nhập để thực hiện thao tác này.');
  });

  it('formats 403 to Vietnamese forbidden prompt', () => {
    const err = new ApiError(403, 'FORBIDDEN', '');
    expect(formatApiError(err)).toBe('Bạn không có quyền thực hiện thao tác này.');
  });

  it('formats 404 to Vietnamese not found prompt', () => {
    const err = new ApiError(404, 'NOT_FOUND', '');
    expect(formatApiError(err)).toBe('Không tìm thấy dữ liệu.');
  });

  it('formats 409 LAST_IDENTITY_CANNOT_BE_REMOVED correctly', () => {
    const err = new ApiError(409, 'LAST_IDENTITY_CANNOT_BE_REMOVED', '');
    expect(formatApiError(err)).toBe('Không thể hủy liên kết phương thức đăng nhập duy nhất của tài khoản.');
  });

  it('prefers custom server message when available', () => {
    const msg = 'Không thể hủy liên kết định danh cuối cùng của tài khoản.';
    const err = new ApiError(409, 'LAST_IDENTITY_CANNOT_BE_REMOVED', msg);
    expect(formatApiError(err)).toBe(msg);
  });

  it('formats 422 to Vietnamese validation error', () => {
    const err = new ApiError(422, 'VALIDATION_ERROR', '');
    expect(formatApiError(err)).toBe('Dữ liệu gửi lên không hợp lệ.');
  });

  it('formats 500+ to server error', () => {
    const err = new ApiError(500, 'INTERNAL_SERVER_ERROR', '');
    expect(formatApiError(err)).toBe('Máy chủ gặp sự cố. Vui lòng thử lại sau.');
  });

  it('formats network fetch errors', () => {
    const netErr = new TypeError('Failed to fetch');
    expect(formatApiError(netErr)).toBe('Không thể kết nối đến máy chủ. Kiểm tra kết nối mạng.');
  });
});

describe('apiClient fetch wrapper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses error envelope from server response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        code: 'LAST_IDENTITY_CANNOT_BE_REMOVED',
        message: 'Không thể hủy liên kết phương thức đăng nhập duy nhất.',
      }),
    });

    try {
      await apiClient.delete('/me/identities/123');
      expect.fail('Should have thrown ApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(409);
      expect(err.code).toBe('LAST_IDENTITY_CANNOT_BE_REMOVED');
      expect(err.message).toBe('Không thể hủy liên kết phương thức đăng nhập duy nhất.');
      expect(formatApiError(err)).toBe('Không thể hủy liên kết phương thức đăng nhập duy nhất.');
    }
  });

  it('handles 204 No Content gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
      headers: new Headers(),
    });

    const res = await apiClient.delete('/me/identities/123');
    expect(res).toBeUndefined();
  });
});
