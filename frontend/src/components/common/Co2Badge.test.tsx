import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Co2Badge, calculateCo2Preview } from './Co2Badge';

describe('Co2Badge', () => {
  describe('compact variant', () => {
    it('should render with valid co2Saved value', () => {
      render(<Co2Badge co2Saved={2.5} variant="compact" />);

      expect(screen.getByText('2.5kg CO2')).toBeInTheDocument();
    });

    it('should format values less than 1 to 2 decimal places', () => {
      render(<Co2Badge co2Saved={0.15} variant="compact" />);

      expect(screen.getByText('0.15kg CO2')).toBeInTheDocument();
    });

    it('should format values >= 1 to 1 decimal place', () => {
      render(<Co2Badge co2Saved={1.234} variant="compact" />);

      expect(screen.getByText('1.2kg CO2')).toBeInTheDocument();
    });

    it('should return null for null co2Saved', () => {
      const { container } = render(<Co2Badge co2Saved={null} variant="compact" />);

      expect(container.firstChild).toBeNull();
    });

    it('should return null for zero co2Saved', () => {
      const { container } = render(<Co2Badge co2Saved={0} variant="compact" />);

      expect(container.firstChild).toBeNull();
    });

    it('should return null for negative co2Saved', () => {
      const { container } = render(<Co2Badge co2Saved={-1} variant="compact" />);

      expect(container.firstChild).toBeNull();
    });

    it('should apply custom className', () => {
      render(<Co2Badge co2Saved={2.5} variant="compact" className="custom-class" />);

      const badge = screen.getByText('2.5kg CO2').parentElement;
      expect(badge).toHaveClass('custom-class');
    });

    it('should render leaf icon', () => {
      const { container } = render(<Co2Badge co2Saved={2.5} variant="compact" />);

      // Lucide icons render as SVG
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('full variant', () => {
    it('should render with valid co2Saved value', () => {
      render(<Co2Badge co2Saved={5.0} variant="full" />);

      expect(screen.getByText('Total CO₂ Reduced')).toBeInTheDocument();
      expect(screen.getByText('5.0 kg')).toBeInTheDocument();
    });

    it('should format small values to 2 decimal places', () => {
      render(<Co2Badge co2Saved={0.25} variant="full" />);

      expect(screen.getByText('0.25 kg')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<Co2Badge co2Saved={5.0} variant="full" className="custom-full" />);

      const container = screen.getByText('Total CO₂ Reduced').closest('div');
      expect(container?.parentElement).toHaveClass('custom-full');
    });
  });

  describe('default variant', () => {
    it('should use compact variant by default', () => {
      render(<Co2Badge co2Saved={2.5} />);

      // Compact variant shows "kg CO2" format
      expect(screen.getByText('2.5kg CO2')).toBeInTheDocument();
    });
  });
});

describe('calculateCo2Preview', () => {
  describe('unit conversions', () => {
    it('should calculate correctly for kg', () => {
      // 1kg produce: 1 * (1.0 + 0.5) = 1.5
      const result = calculateCo2Preview(1, 'kg', 'produce');
      expect(result).toBe(1.5);
    });

    it('should calculate correctly for g', () => {
      // 500g produce: 0.5kg * (1.0 + 0.5) = 0.75
      const result = calculateCo2Preview(500, 'g', 'produce');
      expect(result).toBe(0.75);
    });

    it('should calculate correctly for L', () => {
      // 1L beverages: 1 * (1.0 + 0.5) = 1.5
      const result = calculateCo2Preview(1, 'l', 'beverages');
      expect(result).toBe(1.5);
    });

    it('should calculate correctly for ml', () => {
      // 500ml beverages: 0.5 * (1.0 + 0.5) = 0.75
      const result = calculateCo2Preview(500, 'ml', 'beverages');
      expect(result).toBe(0.75);
    });

    it('should calculate correctly for items', () => {
      // 2 items produce: 0.6kg * (1.0 + 0.5) = 0.9
      const result = calculateCo2Preview(2, 'item', 'produce');
      expect(result).toBe(0.9);
    });

    it('should calculate correctly for pcs', () => {
      // 3 pcs produce: 0.9kg * (1.0 + 0.5) = 1.35
      const result = calculateCo2Preview(3, 'pcs', 'produce');
      expect(result).toBe(1.35);
    });

    it('should calculate correctly for pack', () => {
      // 1 pack produce: 0.3kg * (1.0 + 0.5) = 0.45
      const result = calculateCo2Preview(1, 'pack', 'produce');
      expect(result).toBe(0.45);
    });
  });

  describe('category factors', () => {
    it('should use correct factor for produce (1.0)', () => {
      // 1kg produce: 1 * (1.0 + 0.5) = 1.5
      const result = calculateCo2Preview(1, 'kg', 'produce');
      expect(result).toBe(1.5);
    });

    it('should use correct factor for dairy (7.0)', () => {
      // 1kg dairy: 1 * (7.0 + 0.5) = 7.5
      const result = calculateCo2Preview(1, 'kg', 'dairy');
      expect(result).toBe(7.5);
    });

    it('should use correct factor for meat (20.0)', () => {
      // 1kg meat: 1 * (20.0 + 0.5) = 20.5
      const result = calculateCo2Preview(1, 'kg', 'meat');
      expect(result).toBe(20.5);
    });

    it('should use correct factor for bakery (1.5)', () => {
      // 1kg bakery: 1 * (1.5 + 0.5) = 2.0
      const result = calculateCo2Preview(1, 'kg', 'bakery');
      expect(result).toBe(2);
    });

    it('should use correct factor for frozen (4.0)', () => {
      // 1kg frozen: 1 * (4.0 + 0.5) = 4.5
      const result = calculateCo2Preview(1, 'kg', 'frozen');
      expect(result).toBe(4.5);
    });

    it('should use correct factor for beverages (1.0)', () => {
      // 1kg beverages: 1 * (1.0 + 0.5) = 1.5
      const result = calculateCo2Preview(1, 'kg', 'beverages');
      expect(result).toBe(1.5);
    });

    it('should use correct factor for pantry (2.0)', () => {
      // 1kg pantry: 1 * (2.0 + 0.5) = 2.5
      const result = calculateCo2Preview(1, 'kg', 'pantry');
      expect(result).toBe(2.5);
    });

    it('should use "other" factor (2.5) for unknown categories', () => {
      // 1kg unknown: 1 * (2.5 + 0.5) = 3.0
      const result = calculateCo2Preview(1, 'kg', 'unknown');
      expect(result).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should handle case-insensitive categories', () => {
      const result = calculateCo2Preview(1, 'kg', 'MEAT');
      expect(result).toBe(20.5);
    });

    it('should handle case-insensitive units', () => {
      const result = calculateCo2Preview(1000, 'G', 'produce');
      expect(result).toBe(1.5);
    });

    it('should round to 2 decimal places', () => {
      // Test rounding: 0.333 * (1.0 + 0.5) = 0.4995 -> 0.5
      const result = calculateCo2Preview(333, 'g', 'produce');
      expect(result).toBe(0.5);
    });

    it('should handle unknown units as items', () => {
      // Unknown unit treated as item: 1 * 0.3 * (2.5 + 0.5) = 0.9
      const result = calculateCo2Preview(1, 'pieces', 'other');
      expect(result).toBe(0.9);
    });
  });

  describe('product-specific emission factors', () => {
    it('should use product-specific factor for grapes (1.4)', () => {
      // 1kg grapes: 1 * (1.4 + 0.5) = 1.9
      const result = calculateCo2Preview(1, 'kg', 'produce', 'Fresh Grapes');
      expect(result).toBe(1.9);
    });

    it('should use product-specific factor for beef (27.0)', () => {
      // 1kg beef: 1 * (27.0 + 0.5) = 27.5
      const result = calculateCo2Preview(1, 'kg', 'meat', 'Ground Beef');
      expect(result).toBe(27.5);
    });

    it('should use product-specific factor for chicken (6.9)', () => {
      // 1kg chicken: 1 * (6.9 + 0.5) = 7.4
      const result = calculateCo2Preview(1, 'kg', 'meat', 'Chicken Breast');
      expect(result).toBe(7.4);
    });

    it('should use product-specific factor for cheese (13.5)', () => {
      // 1kg cheese: 1 * (13.5 + 0.5) = 14.0
      const result = calculateCo2Preview(1, 'kg', 'dairy', 'Cheddar Cheese');
      expect(result).toBe(14);
    });

    it('should use product-specific factor for chocolate (19.0)', () => {
      // 1kg chocolate: 1 * (19.0 + 0.5) = 19.5
      const result = calculateCo2Preview(1, 'kg', 'snacks', 'Dark Chocolate');
      expect(result).toBe(19.5);
    });

    it('should use product-specific factor for salmon (6.0)', () => {
      // 1kg salmon: 1 * (6.0 + 0.5) = 6.5
      const result = calculateCo2Preview(1, 'kg', 'seafood', 'Fresh Salmon');
      expect(result).toBe(6.5);
    });

    it('should use product-specific factor for lamb (39.2)', () => {
      // 1kg lamb: 1 * (39.2 + 0.5) = 39.7
      const result = calculateCo2Preview(1, 'kg', 'meat', 'Lamb Chops');
      expect(result).toBe(39.7);
    });

    it('should use product-specific factor for shrimp (18.0)', () => {
      // 1kg shrimp: 1 * (18.0 + 0.5) = 18.5
      const result = calculateCo2Preview(1, 'kg', 'seafood', 'Frozen Shrimp');
      expect(result).toBe(18.5);
    });

    it('should fall back to category when product name has no match', () => {
      // 1kg unknown produce: 1 * (1.0 + 0.5) = 1.5
      const result = calculateCo2Preview(1, 'kg', 'produce', 'Exotic Fruit XYZ');
      expect(result).toBe(1.5);
    });

    it('should fall back to category when productName is not provided', () => {
      // 1kg produce without name: 1 * (1.0 + 0.5) = 1.5
      const result = calculateCo2Preview(1, 'kg', 'produce');
      expect(result).toBe(1.5);
    });
  });
});
