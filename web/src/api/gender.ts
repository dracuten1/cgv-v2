import type { Gender } from '@/types/api';

/**
 * INV-03: Gender boundary conversions
 * English canonical values in API/DB: 'male' | 'female'
 * Vietnamese UI values: 'Nam' | 'Nữ'
 * Accepts case-insensitive 'nam'/'nữ'/'Nam'/'Nữ'/'male'/'female'.
 */

export function toUiGender(gender: Gender | string | null | undefined): string {
  if (!gender) return '';
  const normalized = gender.toString().trim().toLowerCase();
  if (normalized === 'male' || normalized === 'nam') {
    return 'Nam';
  }
  if (normalized === 'female' || normalized === 'nữ' || normalized === 'nu') {
    return 'Nữ';
  }
  return gender;
}

export function toApiGender(input: string | null | undefined): Gender {
  if (!input) {
    throw new Error('Giá trị giới tính không được để trống');
  }
  const normalized = input.toString().trim().toLowerCase();
  if (normalized === 'nam' || normalized === 'male') {
    return 'male';
  }
  if (normalized === 'nữ' || normalized === 'nu' || normalized === 'female') {
    return 'female';
  }
  throw new Error(`Giá trị giới tính không hợp lệ: "${input}" (chấp nhận 'nam'/'nữ' hoặc 'male'/'female')`);
}
