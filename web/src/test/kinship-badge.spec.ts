import { describe, it, expect } from 'vitest';
import { kinshipBadge, formatKinshipBadge, useKinshipBadge } from '@/composables/useKinshipBadge';

describe('useKinshipBadge — canonical term abbreviation (Phase 1 & Phase 3)', () => {
  it('maps "Bản thân" to "Tôi"', () => {
    expect(kinshipBadge('Bản thân')).toBe('Tôi');
  });

  it('maps paternal grandparents ("Ông nội"/"Bà nội") to "Nội"', () => {
    expect(kinshipBadge('Ông nội')).toBe('Nội');
    expect(kinshipBadge('Bà nội')).toBe('Nội');
  });

  it('maps maternal grandparents ("Ông ngoại"/"Bà ngoại") to "Ngoại"', () => {
    expect(kinshipBadge('Ông ngoại')).toBe('Ngoại');
    expect(kinshipBadge('Bà ngoại')).toBe('Ngoại');
  });

  it('collapses children terms to "Con"', () => {
    expect(kinshipBadge('Con trai')).toBe('Con');
    expect(kinshipBadge('Con gái')).toBe('Con');
    expect(kinshipBadge('Con rể')).toBe('Con');
    expect(kinshipBadge('Con dâu')).toBe('Con');
  });

  it('collapses grandchild terms to "Cháu"', () => {
    expect(kinshipBadge('Cháu nội')).toBe('Cháu');
    expect(kinshipBadge('Cháu ngoại')).toBe('Cháu');
  });

  it('passes through full terms that have no badge (tooltips keep canonical text)', () => {
    expect(kinshipBadge('Bố')).toBe('Bố');
    expect(kinshipBadge('Mẹ')).toBe('Mẹ');
    expect(kinshipBadge('Anh')).toBe('Anh');
    expect(kinshipBadge('Chị')).toBe('Chị');
    expect(kinshipBadge('Em')).toBe('Em');
    expect(kinshipBadge('Vợ')).toBe('Vợ');
    expect(kinshipBadge('Chồng')).toBe('Chồng');
    expect(kinshipBadge('Chú')).toBe('Chú');
    expect(kinshipBadge('Bác')).toBe('Bác');
  });

  it('never renders an empty badge for a real term; tolerates empty input', () => {
    expect(kinshipBadge('')).toBe('');
    expect(kinshipBadge(null)).toBe('');
    expect(kinshipBadge(undefined)).toBe('');
    expect(kinshipBadge('Không xác định được quan hệ')).toBe('Không xác định được quan hệ');
  });

  it('formats { badge, full } for tooltips via formatKinshipBadge', () => {
    expect(formatKinshipBadge('Bản thân')).toEqual({ badge: 'Tôi', full: 'Bản thân' });
    expect(formatKinshipBadge('Ông nội')).toEqual({ badge: 'Nội', full: 'Ông nội' });
    expect(formatKinshipBadge('Con gái')).toEqual({ badge: 'Con', full: 'Con gái' });
    expect(formatKinshipBadge('Bố')).toEqual({ badge: 'Bố', full: 'Bố' });
    expect(formatKinshipBadge('')).toEqual({ badge: '', full: '' });
    expect(formatKinshipBadge(null)).toEqual({ badge: '', full: '' });
  });

  it('exposes the same pure mapper via the composable seam', () => {
    const { badge, format } = useKinshipBadge();
    expect(badge('Bản thân')).toBe('Tôi');
    expect(badge('Ông nội')).toBe('Nội');
    expect(badge('Con trai')).toBe('Con');
    expect(format('Ông ngoại')).toEqual({ badge: 'Ngoại', full: 'Ông ngoại' });
  });
});
