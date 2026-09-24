import { apiClient } from './client';
import type { KinshipResult, KinshipLabelsResponse } from '@/types/api';

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

  // Decision 2C: one batched dictionary of kinship terms for the whole
  // family, relative to `fromMemberId`.
  getFamilyKinshipLabels(
    familyId: string,
    fromMemberId: string,
    dialect?: 'bac' | 'trung' | 'nam' | string
  ): Promise<KinshipLabelsResponse> {
    return apiClient.get<KinshipLabelsResponse>(
      `/families/${encodeURIComponent(familyId)}/kinship-labels`,
      {
        params: {
          from: fromMemberId,
          dialect: dialect || 'bac',
        },
      }
    );
  },
};
