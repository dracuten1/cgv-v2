import { apiClient } from './client';
import type { FeedListResponse, FeedPost, CreatePostInput } from '@/types/api';

export interface FeedListParams {
  limit?: number;
  cursor_created_at?: string;
  cursor_id?: string;
}

export const feedApi = {
  list(familyId: string, params: FeedListParams = {}): Promise<FeedListResponse> {
    return apiClient.get<FeedListResponse>(`/families/${encodeURIComponent(familyId)}/feed`, {
      params: params as any,
    });
  },

  create(familyId: string, input: CreatePostInput): Promise<FeedPost> {
    return apiClient.post<FeedPost>(`/families/${encodeURIComponent(familyId)}/feed`, input);
  },
};
