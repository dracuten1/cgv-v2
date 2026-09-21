import { apiClient } from './client';
import type { KinshipResult } from '@/types/api';

export interface KinshipQueryParams {
  from: string;
  to: string;
  dialect?: 'bac' | 'trung' | 'nam' | string;
}

export const kinshipApi = {
  calculate(params: KinshipQueryParams): Promise<KinshipResult> {
    return apiClient.get<KinshipResult>('/kinship', {
      params: {
        from: params.from,
        to: params.to,
        dialect: params.dialect || 'bac',
      },
    });
  },
};
