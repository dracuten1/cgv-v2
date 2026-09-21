import { apiClient } from './client';
import type {
  FamiliesResponse,
  TreeResponse,
  ImportSummary,
} from '@/types/api';

export const familiesApi = {
  listFamilies(): Promise<FamiliesResponse> {
    return apiClient.get<FamiliesResponse>('/families');
  },

  getTree(familyId: string): Promise<TreeResponse> {
    return apiClient.get<TreeResponse>(`/families/${encodeURIComponent(familyId)}/tree`);
  },

  exportExcel(familyId: string): Promise<Blob> {
    return apiClient.blob(`/families/${encodeURIComponent(familyId)}/export.xlsx`);
  },

  importExcel(familyId: string, file: File): Promise<ImportSummary> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<ImportSummary>(`/families/${encodeURIComponent(familyId)}/import.xlsx`, formData);
  },
};
