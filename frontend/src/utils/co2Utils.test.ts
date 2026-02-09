import { describe, it, expect } from 'vitest';
import { getCO2ColorClass, formatCO2, calculateTotalCO2 } from './co2Utils';

describe('getCO2ColorClass', () => {
  it('should return green for low CO2 values (< 1)', () => {
    expect(getCO2ColorClass(0)).toBe('text-green-600');
    expect(getCO2ColorClass(0.5)).toBe('text-green-600');
    expect(getCO2ColorClass(0.99)).toBe('text-green-600');
  });

  it('should return yellow for medium CO2 values (1-3)', () => {
    expect(getCO2ColorClass(1)).toBe('text-yellow-600');
    expect(getCO2ColorClass(2)).toBe('text-yellow-600');
    expect(getCO2ColorClass(2.99)).toBe('text-yellow-600');
  });

  it('should return red for high CO2 values (> 3)', () => {
    expect(getCO2ColorClass(3)).toBe('text-red-600');
    expect(getCO2ColorClass(5)).toBe('text-red-600');
    expect(getCO2ColorClass(27)).toBe('text-red-600');
  });
});

describe('formatCO2', () => {
  it('should return null for null input', () => {
    expect(formatCO2(null)).toBeNull();
  });

  it('should format CO2 value with one decimal place', () => {
    expect(formatCO2(1)).toBe('1.0 kg CO2');
    expect(formatCO2(2.5)).toBe('2.5 kg CO2');
    expect(formatCO2(10.123)).toBe('10.1 kg CO2');
  });

  it('should handle zero', () => {
    expect(formatCO2(0)).toBe('0.0 kg CO2');
  });
});

describe('calculateTotalCO2', () => {
  it('should return 0 for empty array', () => {
    expect(calculateTotalCO2([])).toBe(0);
  });

  it('should calculate total CO2 correctly', () => {
    const products = [
      { co2Emission: 1.0, quantity: 2 },
      { co2Emission: 2.5, quantity: 1 },
    ];
    expect(calculateTotalCO2(products)).toBe(4.5);
  });

  it('should skip products with null CO2 values', () => {
    const products = [
      { co2Emission: 1.0, quantity: 2 },
      { co2Emission: null, quantity: 3 },
      { co2Emission: 2.0, quantity: 1 },
    ];
    expect(calculateTotalCO2(products)).toBe(4.0);
  });

  it('should handle products with quantity > 1', () => {
    const products = [
      { co2Emission: 5.0, quantity: 3 },
    ];
    expect(calculateTotalCO2(products)).toBe(15.0);
  });
});
