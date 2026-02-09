import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cn, getDaysUntilExpiry, getExpiryStatus, formatDate } from './utils';

describe('cn (className utility)', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('should merge tailwind classes properly', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('should handle arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('should handle objects', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });

  it('should handle empty inputs', () => {
    expect(cn()).toBe('');
    expect(cn('')).toBe('');
    expect(cn(null, undefined)).toBe('');
  });
});

describe('getDaysUntilExpiry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return 999 for null expiry date', () => {
    expect(getDaysUntilExpiry(null)).toBe(999);
  });

  it('should return positive days for future dates', () => {
    expect(getDaysUntilExpiry('2024-01-20')).toBe(5);
  });

  it('should return 0 for today', () => {
    expect(getDaysUntilExpiry('2024-01-15')).toBe(0);
  });

  it('should return negative days for past dates', () => {
    expect(getDaysUntilExpiry('2024-01-10')).toBe(-5);
  });

  it('should handle Date objects', () => {
    expect(getDaysUntilExpiry(new Date('2024-01-20'))).toBe(5);
  });
});

describe('getExpiryStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return fresh for null expiry date', () => {
    expect(getExpiryStatus(null)).toBe('fresh');
  });

  it('should return expired for past dates', () => {
    expect(getExpiryStatus('2024-01-10')).toBe('expired');
  });

  it('should return expiring-soon for dates within 3 days', () => {
    expect(getExpiryStatus('2024-01-15')).toBe('expiring-soon'); // today
    expect(getExpiryStatus('2024-01-16')).toBe('expiring-soon'); // 1 day
    expect(getExpiryStatus('2024-01-17')).toBe('expiring-soon'); // 2 days
    expect(getExpiryStatus('2024-01-18')).toBe('expiring-soon'); // 3 days
  });

  it('should return fresh for dates more than 3 days away', () => {
    expect(getExpiryStatus('2024-01-19')).toBe('fresh'); // 4 days
    expect(getExpiryStatus('2024-01-25')).toBe('fresh'); // 10 days
  });
});

describe('formatDate', () => {
  it('should format string dates correctly', () => {
    const result = formatDate('2024-01-15');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });

  it('should format Date objects correctly', () => {
    const result = formatDate(new Date('2024-06-20'));
    expect(result).toContain('Jun');
    expect(result).toContain('20');
    expect(result).toContain('2024');
  });
});
