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

  verifyMagicLink(token: string): Promise<AuthSessionResponse> {
    return apiClient.get<AuthSessionResponse>('/auth/email/verify', {
      params: { token },
    });
  },

  startDemo(): Promise<AuthSessionResponse> {
    return apiClient.post<AuthSessionResponse>('/auth/demo');
  },

  logout(): Promise<MessageResponse> {
    return apiClient.post<MessageResponse>('/auth/logout');
  },
};
