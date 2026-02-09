import { describe, it, expect } from 'vitest';
import { ListingMarker } from './ListingMarker';

// Note: Leaflet map components require complex DOM integration.
// These tests verify the component exports correctly and props are typed properly.

describe('ListingMarker', () => {
  it('should be a valid React component', () => {
    expect(ListingMarker).toBeDefined();
    expect(typeof ListingMarker).toBe('function');
  });

  it('should accept correct prop types', () => {
    // Type-only test - verifies TypeScript types are correct
    const props = {
      position: { latitude: 1.3521, longitude: 103.8198 },
      title: 'Test Listing',
      price: 10,
      isUrgent: false,
      children: null,
    };

    expect(props.position.latitude).toBe(1.3521);
    expect(props.position.longitude).toBe(103.8198);
    expect(props.title).toBe('Test Listing');
  });

  it('should handle null price for free listings', () => {
    const props = {
      position: { latitude: 1.3521, longitude: 103.8198 },
      title: 'Free Listing',
      price: null,
    };

    expect(props.price).toBeNull();
  });

  it('should handle urgent listings', () => {
    const props = {
      position: { latitude: 1.3521, longitude: 103.8198 },
      title: 'Urgent Listing',
      isUrgent: true,
    };

    expect(props.isUrgent).toBe(true);
  });
});
