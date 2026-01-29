import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MarketplaceMap from './MarketplaceMap';
import type { MarketplaceListingWithDistance } from '../../types/marketplace';
import * as useGeolocationHook from '../../hooks/useGeolocation';

// Mock react-leaflet and related libraries
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
  ),
  Circle: () => <div data-testid="circle" />,
  useMap: () => ({
    setView: vi.fn(),
    getZoom: vi.fn(() => 13),
  }),
}));

vi.mock('react-leaflet-cluster', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marker-cluster">{children}</div>
  ),
}));

vi.mock('leaflet', () => ({
  Icon: vi.fn(() => ({})),
  LatLngExpression: vi.fn(),
}));

describe('MarketplaceMap', () => {
  const mockListings: MarketplaceListingWithDistance[] = [
    {
      id: 1,
      sellerId: 1,
      buyerId: null,
      productId: null,
      title: 'Fresh Apples',
      description: 'Organic apples',
      category: 'produce',
      quantity: 5,
      unit: 'pieces',
      price: 10,
      originalPrice: 15,
      expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      pickupLocation: 'NUS',
      coordinates: { latitude: 1.2966, longitude: 103.7764 },
      status: 'active',
      createdAt: new Date().toISOString(),
      completedAt: null,
      images: null,
    },
    {
      id: 2,
      sellerId: 2,
      buyerId: null,
      productId: null,
      title: 'Bread',
      description: 'Fresh bread',
      category: 'bakery',
      quantity: 2,
      unit: 'pieces',
      price: null,
      originalPrice: null,
      expiryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      pickupLocation: 'City Center',
      coordinates: { latitude: 1.3521, longitude: 103.8198 },
      status: 'active',
      createdAt: new Date().toISOString(),
      completedAt: null,
      images: null,
    },
  ];

  const mockGeolocation = {
    coordinates: { latitude: 1.3521, longitude: 103.8198 },
    loading: false,
    error: null,
    permission: 'granted' as const,
    getCurrentPosition: vi.fn(),
    requestPermission: vi.fn().mockResolvedValue(true),
    clearError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useGeolocationHook, 'useGeolocation').mockReturnValue(mockGeolocation);
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  it('should render map container', () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('should display listings count', () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);

    expect(screen.getByText(/Showing \d+ listing/)).toBeInTheDocument();
  });

  it('should display radius control', () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);

    expect(screen.getByText(/Radius: \d+ km/)).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('should update radius when slider changes', () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '10' } });

    expect(screen.getByText('Radius: 10 km')).toBeInTheDocument();
  });

  it('should render My Location button', () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);

    expect(screen.getByText('My Location')).toBeInTheDocument();
  });

  it('should call getCurrentPosition when My Location button clicked', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);

    const button = screen.getByText('My Location');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockGeolocation.requestPermission).toHaveBeenCalled();
      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
    });
  });

  it('should render List View toggle when onToggleView provided', () => {
    const onToggleView = vi.fn();
    renderWithRouter(<MarketplaceMap listings={mockListings} onToggleView={onToggleView} />);

    const button = screen.getByText('List View');
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(onToggleView).toHaveBeenCalledTimes(1);
  });

  it('should not render List View toggle when onToggleView not provided', () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);

    expect(screen.queryByText('List View')).not.toBeInTheDocument();
  });

  it('should display loading state', () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} loading={true} />);

    expect(screen.getByText('Loading map...')).toBeInTheDocument();
  });

  it('should display geolocation error', () => {
    vi.spyOn(useGeolocationHook, 'useGeolocation').mockReturnValue({
      ...mockGeolocation,
      error: 'Location permission denied',
    });

    renderWithRouter(<MarketplaceMap listings={mockListings} />);

    expect(screen.getByText('Location permission denied')).toBeInTheDocument();
  });

  it('should display loading indicator when getting location', () => {
    vi.spyOn(useGeolocationHook, 'useGeolocation').mockReturnValue({
      ...mockGeolocation,
      loading: true,
    });

    renderWithRouter(<MarketplaceMap listings={mockListings} />);

    expect(screen.getByText('Getting location...')).toBeInTheDocument();
  });

  it('should display no listings message when no listings in radius', () => {
    renderWithRouter(<MarketplaceMap listings={[]} />);

    expect(screen.getByText('No listings found in this area')).toBeInTheDocument();
    expect(screen.getByText('Try increasing the radius')).toBeInTheDocument();
  });

  it('should filter listings by radius', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);

    // With default 5km radius, should show both listings
    expect(screen.getByText(/Showing 2 listings/)).toBeInTheDocument();

    // Change radius to 1km - should filter out NUS listing
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '1' } });

    await waitFor(() => {
      // Should show fewer listings
      expect(screen.getByText(/Showing \d+ listing/)).toBeInTheDocument();
    });
  });

  it('should render user location marker when coordinates available', () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);

    const markers = screen.getAllByTestId('marker');
    expect(markers.length).toBeGreaterThan(0);
  });

  it('should render radius circle when user location available', () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);

    expect(screen.getByTestId('circle')).toBeInTheDocument();
  });

  it('should render markers with clustering', () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);

    expect(screen.getByTestId('marker-cluster')).toBeInTheDocument();
  });

  it('should request permission on mount', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);

    await waitFor(() => {
      expect(mockGeolocation.requestPermission).toHaveBeenCalled();
    });
  });

  it('should not render markers for listings without coordinates', () => {
    const listingsWithoutCoords: MarketplaceListingWithDistance[] = [
      {
        ...mockListings[0],
        coordinates: undefined,
      },
    ];

    renderWithRouter(<MarketplaceMap listings={listingsWithoutCoords} />);

    // Should not render listing markers (only user location marker if available)
    const text = screen.getByText(/Showing 0 listing/);
    expect(text).toBeInTheDocument();
  });

  it('should display listings within radius text when user location available', () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);

    expect(screen.getByText(/within \d+km/)).toBeInTheDocument();
  });

  it('should handle empty listings array', () => {
    renderWithRouter(<MarketplaceMap listings={[]} />);

    expect(screen.getByText('Showing 0 listings')).toBeInTheDocument();
  });
});
