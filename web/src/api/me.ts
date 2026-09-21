import { apiClient } from './client';
import type { UserProfile, ContactPoint, MessageResponse } from '@/types/api';

export const meApi = {
  getMe(): Promise<UserProfile> {
    return apiClient.get<UserProfile>('/me');
  },

  getLinkProviderUrl(provider: string): string {
    return `/api/v1/me/link/${encodeURIComponent(provider)}/start`;
  },

  unlinkIdentity(identityId: string): Promise<MessageResponse> {
    return apiClient.delete<MessageResponse>(`/me/identities/${encodeURIComponent(identityId)}`);
  },

  addContact(kind: 'email' | 'phone', value: string): Promise<ContactPoint> {
    return apiClient.post<ContactPoint>('/me/contacts', { kind, value });
  },

  verifyContact(contactId: string): Promise<MessageResponse> {
    return apiClient.post<MessageResponse>(`/me/contacts/${encodeURIComponent(contactId)}/verify`);
  },
};
