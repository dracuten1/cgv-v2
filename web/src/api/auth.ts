import { apiClient } from './client';
import type { UserProfile, ProvidersResponse, AuthSessionResponse, MessageResponse } from '@/types/api';

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

  // Decision 3B (M1): bind the authenticated user to a family-tree member.
  // Responds with the SAME auth.UserProfile payload as GET /me.
  linkMember(memberId: string): Promise<UserProfile> {
    return apiClient.post<UserProfile>('/me/member', { member_id: memberId });
  },
};
