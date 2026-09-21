import { apiClient } from './client';
import type { PushSubscribeInput, MessageResponse } from '@/types/api';

export const pushApi = {
  subscribe(input: PushSubscribeInput): Promise<MessageResponse> {
    return apiClient.post<MessageResponse>('/push/subscribe', input);
  },

  unsubscribe(endpoint: string): Promise<MessageResponse> {
    return apiClient.delete<MessageResponse>('/push/subscribe', {
      params: { endpoint },
    });
  },
};
