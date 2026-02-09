import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import type { MarketplaceListingWithDistance } from '../../types/marketplace';
import * as useGeolocationHook from '../../hooks/useGeolocation';

describe('MarketplaceMap', () => {
  let MarketplaceMap: typeof import('./MarketplaceMap').default;

  beforeAll(async () => {
    // Mock Google Maps API key
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY = 'test-api-key';

    // Pre-set window.google so loadGoogleMapsScript resolves immediately
    (window as any).google = { maps: {} };

    const module = await import('./MarketplaceMap');
    MarketplaceMap = module.default;
  });

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
      co2Saved: 2.25,
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
      co2Saved: 1.2,
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

  // Recreate Google Maps mocks fresh before each test (regular functions, not arrows)
  beforeEach(() => {
    vi.clearAllMocks();

    (window as any).google = {
      maps: {
        Map: vi.fn(function () {
          return {
            panTo: vi.fn(),
            setZoom: vi.fn(),
            getZoom: vi.fn().mockReturnValue(13),
            fitBounds: vi.fn(),
            setCenter: vi.fn(),
          };
        }),
        Marker: vi.fn(function () {
          return {
            setPosition: vi.fn(),
            setMap: vi.fn(),
            addListener: vi.fn(),
          };
        }),
        Circle: vi.fn(function () {
          return {
            setCenter: vi.fn(),
            setRadius: vi.fn(),
            setMap: vi.fn(),
          };
        }),
        InfoWindow: vi.fn(function () {
          return {
            setContent: vi.fn(),
            open: vi.fn(),
            close: vi.fn(),
          };
        }),
        LatLngBounds: vi.fn(function () {
          return {
            extend: vi.fn(),
          };
        }),
        event: {
          addListener: vi.fn(function (_obj: any, _event: string, callback: () => void) {
            callback();
            return {};
          }),
          removeListener: vi.fn(),
        },
      },
    };

    vi.spyOn(useGeolocationHook, 'useGeolocation').mockReturnValue(mockGeolocation);
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  it('should render map area', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      const mapDiv = document.querySelector('[style*="min-height"]');
      expect(mapDiv).toBeInTheDocument();
    });
  });

  it('should display listings count', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect(screen.getByText(/Showing \d+ listing/)).toBeInTheDocument();
    });
  });

  it('should display radius control when location available', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect(screen.getByText('Search Radius')).toBeInTheDocument();
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });
  });

  it('should update radius when slider changes', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '10' } });
    expect(screen.getByText('10 km')).toBeInTheDocument();
  });

  it('should render location button', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect(screen.getByText('Update Location')).toBeInTheDocument();
    });
  });

  it('should call handlers when location button clicked', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect(screen.getByText('Update Location')).toBeInTheDocument();
    });

    const button = screen.getByText('Update Location').closest('button')!;
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockGeolocation.clearError).toHaveBeenCalled();
      expect(mockGeolocation.requestPermission).toHaveBeenCalled();
    });
  });

  it('should render List View toggle when onToggleView provided', async () => {
    const onToggleView = vi.fn();
    renderWithRouter(<MarketplaceMap listings={mockListings} onToggleView={onToggleView} />);

    await waitFor(() => {
      expect(screen.getByText('List View')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('List View'));
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

  it('should display geolocation error message', async () => {
    vi.spyOn(useGeolocationHook, 'useGeolocation').mockReturnValue({
      ...mockGeolocation,
      error: 'Location permission denied',
    });
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect(screen.getByText('Location unavailable - showing all listings')).toBeInTheDocument();
    });
  });

  it('should display loading indicator when getting location', async () => {
    vi.spyOn(useGeolocationHook, 'useGeolocation').mockReturnValue({
      ...mockGeolocation,
      loading: true,
    });
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect(screen.getByText('Getting location...')).toBeInTheDocument();
    });
  });

  it('should display no listings message when empty', async () => {
    renderWithRouter(<MarketplaceMap listings={[]} />);
    await waitFor(() => {
      expect(screen.getByText('No listings found')).toBeInTheDocument();
    });
  });

  it('should create Google Maps markers for listings', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect((window as any).google.maps.Marker).toHaveBeenCalled();
    });
  });

  it('should create radius circle when user location available', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect((window as any).google.maps.Circle).toHaveBeenCalled();
    });
  });

  it('should request permission on mount', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect(mockGeolocation.requestPermission).toHaveBeenCalled();
    });
  });

  it('should handle listings without coordinates', async () => {
    const listingsWithoutCoords: MarketplaceListingWithDistance[] = [
      { ...mockListings[0], coordinates: undefined },
    ];
    renderWithRouter(<MarketplaceMap listings={listingsWithoutCoords} />);
    await waitFor(() => {
      expect(screen.getByText(/Showing 0 listing/)).toBeInTheDocument();
    });
  });

  it('should display within radius text when user location available', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect(screen.getByText(/within \d+km/)).toBeInTheDocument();
    });
  });

  it('should handle empty listings array', async () => {
    renderWithRouter(<MarketplaceMap listings={[]} />);
    await waitFor(() => {
      expect(screen.getByText(/Showing/)).toBeInTheDocument();
    });
  });
});
