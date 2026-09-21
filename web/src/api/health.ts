import { apiClient } from './client';
import type { HealthResponse } from '@/types/api';

export const healthApi = {
  check(): Promise<HealthResponse> {
    return apiClient.get<HealthResponse>('/health');
  },

  checkRoot(): Promise<HealthResponse> {
    // /healthz is mounted at root
    return apiClient.get<HealthResponse>('/healthz');
  },
};
