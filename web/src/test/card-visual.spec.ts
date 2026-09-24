import { describe, it, expect } from 'vitest';
import { getYearsText, getInitials, genAccentVar, genSoftVar } from '@/components/tree/card-visual';

describe('card-visual pure helpers', () => {
  describe('getYearsText', () => {
    it('returns "s. YYYY" for living member with birth year', () => {
      expect(getYearsText('1930-04-12', null, true)).toBe('s. 1930');
      expect(getYearsText('1942', undefined, true)).toBe('s. 1942');
    });

    it('returns "" for living member without birth year', () => {
      expect(getYearsText(null, null, true)).toBe('');
      expect(getYearsText('', '', true)).toBe('');
    });

    it('returns "YYYY – YYYY" for deceased member with both dates', () => {
      expect(getYearsText('1930-04-12', '2001-08-30', false)).toBe('1930 – 2001');
    });

    it('returns "YYYY – ?" for deceased member with known birth but unknown death', () => {
      expect(getYearsText('1930-04-12', null, false)).toBe('1930 – ?');
      expect(getYearsText('1930', '', false)).toBe('1930 – ?');
      expect(getYearsText('1930', undefined, false)).toBe('1930 – ?');
    });

    it('returns "? – YYYY" for deceased member with unknown birth but known death', () => {
      expect(getYearsText(null, '2001-08-30', false)).toBe('? – 2001');
      expect(getYearsText('', '2001', false)).toBe('? – 2001');
    });

    it('returns "" for deceased member with neither birth nor death date', () => {
      expect(getYearsText(null, null, false)).toBe('');
      expect(getYearsText('', '', false)).toBe('');
    });
  });

  describe('getInitials', () => {
    it('returns uppercase initials from last two parts of name', () => {
      expect(getInitials('Nguyễn Văn An')).toBe('VA');
      expect(getInitials('Trần Thị Dung')).toBe('TD');
    });

    it('handles single word names', () => {
      expect(getInitials('An')).toBe('AN');
    });

    it('handles empty names', () => {
      expect(getInitials('')).toBe('');
    });
  });

  describe('genAccentVar and genSoftVar', () => {
    it('cycles generation indices 1-4 through modulo', () => {
      expect(genAccentVar(1)).toBe('--gen-1');
      expect(genAccentVar(2)).toBe('--gen-2');
      expect(genAccentVar(3)).toBe('--gen-3');
      expect(genAccentVar(4)).toBe('--gen-4');
      expect(genAccentVar(5)).toBe('--gen-1');

      expect(genSoftVar(1)).toBe('--gen-1-soft');
      expect(genSoftVar(4)).toBe('--gen-4-soft');
      expect(genSoftVar(5)).toBe('--gen-1-soft');
    });
  });
});
