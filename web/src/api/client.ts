import type { ApiErrorPayload } from '@/types/api';

/**
 * Standardized API Error class
 */
export class ApiError extends Error {
  public status: number;
  public code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Maps error to friendly Vietnamese string
 */
export function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    // If the server explicitly returned a Vietnamese message and it's meaningful, prefer it
    if (err.message && err.message.trim().length > 0) {
      return err.message;
    }

    if (err.status === 401) {
      return 'Bạn cần đăng nhập để thực hiện thao tác này.';
    }
    if (err.status === 403) {
      return 'Bạn không có quyền thực hiện thao tác này.';
    }
    if (err.status === 404) {
      return 'Không tìm thấy dữ liệu.';
    }
    if (err.status === 409) {
      if (err.code === 'LAST_IDENTITY_CANNOT_BE_REMOVED') {
        return 'Không thể hủy liên kết phương thức đăng nhập duy nhất của tài khoản.';
      }
      return 'Dữ liệu bị xung đột hoặc đã tồn tại.';
    }
    if (err.status === 422) {
      return 'Dữ liệu gửi lên không hợp lệ.';
    }
    if (err.status >= 500) {
      return 'Máy chủ gặp sự cố. Vui lòng thử lại sau.';
    }
    return err.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.';
  }

  if (err instanceof TypeError && err.message.includes('fetch')) {
    return 'Không thể kết nối đến máy chủ. Kiểm tra kết nối mạng.';
  }

  if (err instanceof Error) {
    if (err.message.includes('network') || err.message.includes('Failed to fetch')) {
      return 'Không thể kết nối đến máy chủ. Kiểm tra kết nối mạng.';
    }
    return err.message;
  }

  return 'Đã có lỗi không xác định xảy ra.';
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: any;
}

const BASE_URL = '/api/v1';

/**
 * Core typed fetch wrapper
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, body, headers = {}, ...customConfig } = options;

  let url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const reqHeaders = new Headers(headers);
  let reqBody: any = body;

  // If body is plain object (not FormData, Blob, string), encode as JSON
  if (body !== undefined && body !== null) {
    if (!(body instanceof FormData) && !(body instanceof Blob) && typeof body !== 'string') {
      reqHeaders.set('Content-Type', 'application/json');
      reqBody = JSON.stringify(body);
    }
  }

  const config: RequestInit = {
    method: 'GET',
    credentials: 'include', // JWT in httpOnly cookie
    headers: reqHeaders,
    body: reqBody,
    ...customConfig,
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (error: any) {
    throw new ApiError(0, 'NETWORK_ERROR', 'Không thể kết nối đến máy chủ. Kiểm tra kết nối mạng.');
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  // Handle errors
  if (!response.ok) {
    let errorCode = `HTTP_${response.status}`;
    let errorMessage = '';

    try {
      const errorJson: ApiErrorPayload = await response.json();
      if (errorJson) {
        if (errorJson.code) errorCode = errorJson.code;
        if (errorJson.message) errorMessage = errorJson.message;
        else if (errorJson.error) errorMessage = errorJson.error;
      }
    } catch {
      // Body was not JSON
    }

    if (!errorMessage) {
      if (response.status === 401) errorMessage = 'Bạn cần đăng nhập để thực hiện thao tác này.';
      else if (response.status === 403) errorMessage = 'Bạn không có quyền thực hiện thao tác này.';
      else if (response.status === 404) errorMessage = 'Không tìm thấy dữ liệu.';
      else if (response.status === 422) errorMessage = 'Dữ liệu gửi lên không hợp lệ.';
      else if (response.status >= 500) errorMessage = 'Máy chủ gặp sự cố. Vui lòng thử lại sau.';
      else errorMessage = response.statusText || 'Yêu cầu không thành công';
    }

    throw new ApiError(response.status, errorCode, errorMessage);
  }

  // Return blob if response is spreadsheet/stream
  const contentType = response.headers.get('content-type') || '';
  if (
    contentType.includes('application/vnd.openxmlformats-officedocument') ||
    contentType.includes('application/octet-stream')
  ) {
    return (await response.blob()) as unknown as T;
  }

  // Parse JSON response
  try {
    const data = await response.json();
    return data as T;
  } catch {
    return undefined as unknown as T;
  }
}

export const apiClient = {
  get: <T = any>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),
  post: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),
  put: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),
  delete: <T = any>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
  blob: (endpoint: string, options?: RequestOptions) =>
    apiRequest<Blob>(endpoint, { ...options, method: 'GET' }),
};
