import { describe, it, expect } from 'vitest';
import { toUiGender, toApiGender } from '@/api/gender';

describe('INV-03 Gender Boundary Mapping', () => {
  it('converts API/DB "male" to UI "Nam"', () => {
    expect(toUiGender('male')).toBe('Nam');
    expect(toUiGender('nam')).toBe('Nam');
  });

  it('converts API/DB "female" to UI "Nữ"', () => {
    expect(toUiGender('female')).toBe('Nữ');
    expect(toUiGender('nữ')).toBe('Nữ');
    expect(toUiGender('nu')).toBe('Nữ');
  });

  it('converts Vietnamese "nam" / "Nam" to API "male"', () => {
    expect(toApiGender('nam')).toBe('male');
    expect(toApiGender('Nam')).toBe('male');
    expect(toApiGender('NAM')).toBe('male');
    expect(toApiGender('male')).toBe('male');
    expect(toApiGender('Male')).toBe('male');
  });

  it('converts Vietnamese "nữ" / "Nữ" to API "female"', () => {
    expect(toApiGender('nữ')).toBe('female');
    expect(toApiGender('Nữ')).toBe('female');
    expect(toApiGender('NỮ')).toBe('female');
    expect(toApiGender('female')).toBe('female');
    expect(toApiGender('Female')).toBe('female');
  });

  it('throws on invalid gender inputs', () => {
    expect(() => toApiGender('')).toThrow('Giá trị giới tính không được để trống');
    expect(() => toApiGender('other')).toThrow('Giá trị giới tính không hợp lệ');
  });
});
