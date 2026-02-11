import { describe, it, expect } from 'vitest';
import { getCO2ColorClass, formatCO2, calculateTotalCO2, convertToKg, calculateProductCO2 } from './co2Utils';

describe('getCO2ColorClass', () => {
  it('should return success color for low CO2 values (< 1)', () => {
    expect(getCO2ColorClass(0)).toBe('text-success');
    expect(getCO2ColorClass(0.5)).toBe('text-success');
    expect(getCO2ColorClass(0.99)).toBe('text-success');
  });

  it('should return warning color for medium CO2 values (1-3)', () => {
    expect(getCO2ColorClass(1)).toBe('text-warning');
    expect(getCO2ColorClass(2)).toBe('text-warning');
    expect(getCO2ColorClass(2.99)).toBe('text-warning');
  });

  it('should return destructive color for high CO2 values (> 3)', () => {
    expect(getCO2ColorClass(3)).toBe('text-destructive');
    expect(getCO2ColorClass(5)).toBe('text-destructive');
    expect(getCO2ColorClass(27)).toBe('text-destructive');
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

describe('convertToKg', () => {
  it('should return quantity as-is for kg', () => {
    expect(convertToKg(2, 'kg')).toBe(2);
  });

  it('should convert grams to kg', () => {
    expect(convertToKg(500, 'g')).toBe(0.5);
  });

  it('should convert ml to kg', () => {
    expect(convertToKg(250, 'ml')).toBe(0.25);
  });

  it('should treat liters as kg', () => {
    expect(convertToKg(2, 'l')).toBe(2);
  });

  it('should convert pcs/items using 0.3 kg default', () => {
    expect(convertToKg(2, 'pcs')).toBe(0.6);
    expect(convertToKg(3, 'item')).toBeCloseTo(0.9);
    expect(convertToKg(1, 'pack')).toBe(0.3);
    expect(convertToKg(1, 'bottle')).toBe(0.3);
  });

  it('should convert dozen', () => {
    expect(convertToKg(1, 'dozen')).toBeCloseTo(3.6);
  });

  it('should default to 0.3 kg for null/undefined unit', () => {
    expect(convertToKg(2, null)).toBe(0.6);
    expect(convertToKg(2, undefined)).toBe(0.6);
  });
});

describe('calculateProductCO2', () => {
  it('should calculate CO2 for kg unit', () => {
    expect(calculateProductCO2(6.9, 2, 'kg')).toBeCloseTo(13.8);
  });

  it('should calculate CO2 for gram unit', () => {
    // 500g rice, co2=2.7 per kg -> 2.7 * 0.5 = 1.35
    expect(calculateProductCO2(2.7, 500, 'g')).toBeCloseTo(1.35);
  });

  it('should calculate CO2 for pcs unit', () => {
    // 2 pcs chicken, co2=6.9 per kg -> 6.9 * 0.6 = 4.14
    expect(calculateProductCO2(6.9, 2, 'pcs')).toBeCloseTo(4.14);
  });
});

describe('calculateTotalCO2', () => {
  it('should return 0 for empty array', () => {
    expect(calculateTotalCO2([])).toBe(0);
  });

  it('should calculate total CO2 with unit conversion', () => {
    const products = [
      { co2Emission: 2.7, quantity: 1, unit: 'kg' },   // 2.7
      { co2Emission: 6.9, quantity: 500, unit: 'g' },   // 6.9 * 0.5 = 3.45
    ];
    expect(calculateTotalCO2(products)).toBeCloseTo(6.15);
  });

  it('should skip products with null CO2 values', () => {
    const products = [
      { co2Emission: 1.0, quantity: 2, unit: 'kg' },
      { co2Emission: null, quantity: 3, unit: 'kg' },
      { co2Emission: 2.0, quantity: 1, unit: 'kg' },
    ];
    expect(calculateTotalCO2(products)).toBe(4.0);
  });

  it('should handle pcs unit correctly', () => {
    const products = [
      { co2Emission: 5.0, quantity: 3, unit: 'pcs' },  // 5.0 * 0.9 = 4.5
    ];
    expect(calculateTotalCO2(products)).toBeCloseTo(4.5);
  });
});
