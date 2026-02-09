import { describe, it, expect } from 'vitest';
import { calculateCO2Emission } from './co2Calculator';

describe('calculateCO2Emission', () => {
  describe('Meat & Poultry', () => {
    it('should return 27.0 for beef', () => {
      expect(calculateCO2Emission('Beef Steak', 'meat')).toBe(27.0);
      expect(calculateCO2Emission('Ground Beef', 'meat')).toBe(27.0);
    });

    it('should return 39.2 for lamb', () => {
      expect(calculateCO2Emission('Lamb Chops', 'meat')).toBe(39.2);
    });

    it('should return 12.1 for pork', () => {
      expect(calculateCO2Emission('Pork Belly', 'meat')).toBe(12.1);
    });

    it('should return 6.9 for chicken', () => {
      expect(calculateCO2Emission('Chicken Breast', 'meat')).toBe(6.9);
    });

    it('should return 10.9 for turkey', () => {
      expect(calculateCO2Emission('Turkey Breast', 'meat')).toBe(10.9);
    });
  });

  describe('Seafood', () => {
    it('should return 6.0 for salmon', () => {
      expect(calculateCO2Emission('Fresh Salmon', 'seafood')).toBe(6.0);
    });

    it('should return 6.1 for tuna', () => {
      expect(calculateCO2Emission('Canned Tuna', 'seafood')).toBe(6.1);
    });

    it('should return 18.0 for shrimp', () => {
      expect(calculateCO2Emission('Fresh Shrimp', 'seafood')).toBe(18.0);
      expect(calculateCO2Emission('Tiger Prawns', 'seafood')).toBe(18.0);
    });

    it('should return 5.5 for generic fish', () => {
      expect(calculateCO2Emission('White Fish Fillet', 'seafood')).toBe(5.5);
    });
  });

  describe('Dairy & Eggs', () => {
    it('should return 13.5 for cheese', () => {
      expect(calculateCO2Emission('Cheddar Cheese', 'dairy')).toBe(13.5);
    });

    it('should return 3.2 for milk', () => {
      expect(calculateCO2Emission('Fresh Milk', 'dairy')).toBe(3.2);
    });

    it('should return 12.0 for butter', () => {
      expect(calculateCO2Emission('Unsalted Butter', 'dairy')).toBe(12.0);
    });

    it('should return 2.2 for yogurt', () => {
      expect(calculateCO2Emission('Greek Yogurt', 'dairy')).toBe(2.2);
      expect(calculateCO2Emission('Natural Yoghurt', 'dairy')).toBe(2.2);
    });

    it('should return 4.8 for eggs', () => {
      expect(calculateCO2Emission('Free Range Eggs', 'dairy')).toBe(4.8);
    });
  });

  describe('Grains & Bread', () => {
    it('should return 2.7 for rice', () => {
      expect(calculateCO2Emission('Jasmine Rice', 'grains')).toBe(2.7);
    });

    it('should return 0.9 for bread', () => {
      expect(calculateCO2Emission('Whole Wheat Bread', 'bakery')).toBe(0.9);
    });

    it('should return 1.1 for pasta', () => {
      expect(calculateCO2Emission('Spaghetti Pasta', 'grains')).toBe(1.1);
      expect(calculateCO2Emission('Instant Noodles', 'grains')).toBe(1.1);
    });
  });

  describe('Fruits', () => {
    it('should return 0.7 for banana', () => {
      expect(calculateCO2Emission('Fresh Bananas', 'produce')).toBe(0.7);
    });

    it('should return 0.3 for apple', () => {
      expect(calculateCO2Emission('Red Apples', 'produce')).toBe(0.3);
    });

    it('should return 1.1 for berries', () => {
      expect(calculateCO2Emission('Strawberries', 'produce')).toBe(1.1);
      expect(calculateCO2Emission('Blueberries', 'produce')).toBe(1.1);
    });
  });

  describe('Vegetables', () => {
    it('should return 1.4 for tomato', () => {
      expect(calculateCO2Emission('Fresh Tomatoes', 'produce')).toBe(1.4);
    });

    it('should return 0.3 for potato', () => {
      expect(calculateCO2Emission('Russet Potatoes', 'produce')).toBe(0.3);
    });

    it('should return 0.4 for broccoli', () => {
      expect(calculateCO2Emission('Fresh Broccoli', 'produce')).toBe(0.4);
    });
  });

  describe('Beverages', () => {
    it('should return 4.0 for coffee', () => {
      expect(calculateCO2Emission('Ground Coffee', 'beverages')).toBe(4.0);
    });

    it('should return 1.0 for tea', () => {
      expect(calculateCO2Emission('Green Tea', 'beverages')).toBe(1.0);
    });
  });

  describe('Category-based fallbacks', () => {
    it('should return 15.0 for unknown meat items', () => {
      expect(calculateCO2Emission('Mystery Protein', 'meat')).toBe(15.0);
    });

    it('should return 5.0 for unknown dairy items', () => {
      expect(calculateCO2Emission('Unknown Dairy', 'dairy')).toBe(5.0);
    });

    it('should return 0.5 for unknown produce items', () => {
      expect(calculateCO2Emission('Exotic Vegetable', 'produce')).toBe(0.5);
    });
  });

  describe('Default fallback', () => {
    it('should return 3.0 for completely unknown items', () => {
      expect(calculateCO2Emission('Random Item', 'unknown')).toBe(3.0);
    });
  });
});
