import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListingMapCard } from './ListingMapCard';
import type { MarketplaceListingWithDistance } from '../../types/marketplace';

describe('ListingMapCard', () => {
  const mockListing: MarketplaceListingWithDistance = {
    id: 1,
    sellerId: 1,
    buyerId: null,
    productId: null,
    title: 'Fresh Apples',
    description: 'Organic apples from local farm',
    category: 'produce',
    quantity: 5,
    unit: 'pieces',
    price: 10,
    originalPrice: 15,
    expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
    pickupLocation: 'NUS',
    coordinates: { latitude: 1.2966, longitude: 103.7764 },
    status: 'active',
    createdAt: new Date().toISOString(),
    completedAt: null,
    images: null,
    distance: 2.5,
  };

  const mockOnViewDetails = vi.fn();

  it('should render listing details correctly', () => {
    render(<ListingMapCard listing={mockListing} onViewDetails={mockOnViewDetails} />);

    expect(screen.getByText('Fresh Apples')).toBeInTheDocument();
    expect(screen.getByText('produce')).toBeInTheDocument();
    expect(screen.getByText('$10.00')).toBeInTheDocument();
    expect(screen.getByText('$15.00')).toBeInTheDocument(); // Original price
    expect(screen.getByText('Quantity: 5')).toBeInTheDocument();
  });

  it('should display FREE badge when price is null', () => {
    const freeListing = { ...mockListing, price: null, originalPrice: null };
    render(<ListingMapCard listing={freeListing} onViewDetails={mockOnViewDetails} />);

    expect(screen.getByText('FREE')).toBeInTheDocument();
  });

  it('should show discount when original price is higher', () => {
    render(<ListingMapCard listing={mockListing} onViewDetails={mockOnViewDetails} />);

    expect(screen.getByText('$10.00')).toBeInTheDocument();
    expect(screen.getByText('$15.00')).toBeInTheDocument();
  });

  it('should display distance', () => {
    render(<ListingMapCard listing={mockListing} onViewDetails={mockOnViewDetails} />);

    expect(screen.getByText('2.5km away')).toBeInTheDocument();
  });

  it('should handle urgent expiry (< 2 days)', () => {
    const urgentListing = {
      ...mockListing,
      expiryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day
    };

    render(<ListingMapCard listing={urgentListing} onViewDetails={mockOnViewDetails} />);

    expect(screen.getByText('Expires tomorrow')).toBeInTheDocument();
  });

  it('should handle expired listing', () => {
    const expiredListing = {
      ...mockListing,
      expiryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    };

    render(<ListingMapCard listing={expiredListing} onViewDetails={mockOnViewDetails} />);

    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('should call onViewDetails when button clicked', () => {
    render(<ListingMapCard listing={mockListing} onViewDetails={mockOnViewDetails} />);

    const button = screen.getByText('View Details');
    fireEvent.click(button);

    expect(mockOnViewDetails).toHaveBeenCalledTimes(1);
  });

  it('should not display category badge if category is null', () => {
    const listingWithoutCategory = { ...mockListing, category: null };
    render(
      <ListingMapCard listing={listingWithoutCategory} onViewDetails={mockOnViewDetails} />
    );

    expect(screen.queryByText('produce')).not.toBeInTheDocument();
  });

  it('should format expiry date correctly for today', () => {
    const todayListing = {
      ...mockListing,
      expiryDate: new Date().toISOString(),
    };

    render(<ListingMapCard listing={todayListing} onViewDetails={mockOnViewDetails} />);

    expect(screen.getByText('Expires today')).toBeInTheDocument();
  });

  it('should format expiry date for dates beyond 7 days', () => {
    const farFutureListing = {
      ...mockListing,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    };

    render(<ListingMapCard listing={farFutureListing} onViewDetails={mockOnViewDetails} />);

    // Should show month and day
    const expiryText = screen.getByText(/\w+ \d+/);
    expect(expiryText).toBeInTheDocument();
  });
});
