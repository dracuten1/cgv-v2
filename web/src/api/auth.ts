import { apiClient } from './client';
import type { ProvidersResponse, AuthSessionResponse, MessageResponse } from '@/types/api';

export const authApi = {
  getProviders(): Promise<ProvidersResponse> {
    return apiClient.get<ProvidersResponse>('/auth/providers');
  },

  getLoginUrl(provider: string): string {
    return `/api/v1/auth/${encodeURIComponent(provider)}/login`;
  },

  handleCallback(provider: string, code: string, state: string): Promise<AuthSessionResponse> {
    return apiClient.get<AuthSessionResponse>(`/auth/${encodeURIComponent(provider)}/callback`, {
      params: { code, state },
    });
  },

  sendMagicLink(email: string): Promise<MessageResponse> {
    return apiClient.post<MessageResponse>('/auth/email/magic-link', { email });
  },

  // W4 & C5: Magic link verify uses POST to prevent state-changing GETs.
  // The backend AuthHandler /api/v1/auth/email/verify endpoint matches this POST request.
  verifyMagicLink(token: string): Promise<AuthSessionResponse> {
    return apiClient.post<AuthSessionResponse>('/auth/email/verify', { token });
  },

  startDemo(): Promise<AuthSessionResponse> {
    return apiClient.post<AuthSessionResponse>('/auth/demo');
  },

  logout(): Promise<MessageResponse> {
    return apiClient.post<MessageResponse>('/auth/logout');
  },
};
