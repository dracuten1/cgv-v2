import { apiClient } from './client';
import type { Page, Member, MemberDetailResponse, MemberInput, MessageResponse } from '@/types/api';

export interface ListMembersParams {
  q?: string;
  page?: number;
  limit?: number;
}

export const membersApi = {
  listMembers(params: ListMembersParams = {}): Promise<Page<Member>> {
    return apiClient.get<Page<Member>>('/members', { params: params as any });
  },

  getMember(id: string): Promise<MemberDetailResponse> {
    return apiClient.get<MemberDetailResponse>(`/members/${encodeURIComponent(id)}`);
  },

  createMember(input: MemberInput): Promise<Member> {
    return apiClient.post<Member>('/members', input);
  },

  updateMember(id: string, input: MemberInput): Promise<MessageResponse> {
    return apiClient.put<MessageResponse>(`/members/${encodeURIComponent(id)}`, input);
  },

  deleteMember(id: string): Promise<MessageResponse> {
    return apiClient.delete<MessageResponse>(`/members/${encodeURIComponent(id)}`);
  },
};
