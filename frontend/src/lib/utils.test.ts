import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cn, getDaysUntilExpiry, getExpiryStatus, formatDate, formatDateTime, formatPrice, formatCountdown } from './utils';

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

describe('formatDateTime', () => {
  it('should format string dates with time correctly', () => {
    const result = formatDateTime('2024-01-15T14:30:00');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });

  it('should format Date objects with time correctly', () => {
    const result = formatDateTime(new Date('2024-06-20T09:45:00'));
    expect(result).toContain('Jun');
    expect(result).toContain('20');
    expect(result).toContain('2024');
  });

  it('should include time in the output', () => {
    const date = new Date('2024-03-10T15:30:00');
    const result = formatDateTime(date);
    // Should contain time portion (format varies by locale)
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('formatPrice', () => {
  it('should format whole numbers with two decimal places', () => {
    expect(formatPrice(10)).toBe('$10.00');
    expect(formatPrice(100)).toBe('$100.00');
  });

  it('should format decimal prices correctly', () => {
    expect(formatPrice(10.5)).toBe('$10.50');
    expect(formatPrice(99.99)).toBe('$99.99');
  });

  it('should format zero correctly', () => {
    expect(formatPrice(0)).toBe('$0.00');
  });

  it('should round to two decimal places', () => {
    expect(formatPrice(10.999)).toBe('$11.00');
    expect(formatPrice(10.001)).toBe('$10.00');
    expect(formatPrice(10.556)).toBe('$10.56');
  });

  it('should handle small prices', () => {
    expect(formatPrice(0.01)).toBe('$0.01');
    expect(formatPrice(0.99)).toBe('$0.99');
  });

  it('should handle large prices', () => {
    expect(formatPrice(1000)).toBe('$1000.00');
    expect(formatPrice(99999.99)).toBe('$99999.99');
  });
});

describe('formatCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "Expired" for past deadlines', () => {
    const pastDeadline = new Date('2024-01-15T11:59:00');
    expect(formatCountdown(pastDeadline)).toBe('Expired');
  });

  it('should return "Expired" when deadline equals now', () => {
    const now = new Date('2024-01-15T12:00:00');
    expect(formatCountdown(now)).toBe('Expired');
  });

  it('should format minutes and seconds for short countdowns', () => {
    const deadline = new Date('2024-01-15T12:05:30'); // 5m 30s from now
    expect(formatCountdown(deadline)).toBe('5m 30s');
  });

  it('should format hours and minutes for longer countdowns', () => {
    const deadline = new Date('2024-01-15T14:30:00'); // 2h 30m from now
    expect(formatCountdown(deadline)).toBe('2h 30m');
  });

  it('should handle exactly one hour', () => {
    const deadline = new Date('2024-01-15T13:00:00'); // 1h from now
    expect(formatCountdown(deadline)).toBe('1h 0m');
  });

  it('should format just under an hour correctly', () => {
    const deadline = new Date('2024-01-15T12:59:45'); // 59m 45s from now
    expect(formatCountdown(deadline)).toBe('59m 45s');
  });

  it('should handle multi-hour countdowns', () => {
    const deadline = new Date('2024-01-15T18:15:00'); // 6h 15m from now
    expect(formatCountdown(deadline)).toBe('6h 15m');
  });

  it('should handle very short countdowns', () => {
    const deadline = new Date('2024-01-15T12:00:30'); // 30s from now
    expect(formatCountdown(deadline)).toBe('0m 30s');
  });
});
