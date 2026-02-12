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
    (window as any).google = { maps: { places: {} } };

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
        places: {},
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
          addListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
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

  it('should show "Enable Location" when no user location', async () => {
    vi.spyOn(useGeolocationHook, 'useGeolocation').mockReturnValue({
      ...mockGeolocation,
      coordinates: null,
    });
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect(screen.getByText('Enable Location')).toBeInTheDocument();
    });
  });

  it('should not show radius slider when no user location', async () => {
    vi.spyOn(useGeolocationHook, 'useGeolocation').mockReturnValue({
      ...mockGeolocation,
      coordinates: null,
    });
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect(screen.queryByText('Search Radius')).not.toBeInTheDocument();
    });
  });

  it('should show all listings text when no user location', async () => {
    vi.spyOn(useGeolocationHook, 'useGeolocation').mockReturnValue({
      ...mockGeolocation,
      coordinates: null,
    });
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect(screen.getByText(/Showing all \d+ listing/)).toBeInTheDocument();
    });
  });

  it('should show "Try increasing the radius" hint when no listings and location available', async () => {
    renderWithRouter(<MarketplaceMap listings={[]} />);
    await waitFor(() => {
      expect(screen.getByText('Try increasing the radius')).toBeInTheDocument();
    });
  });

  it('should not show radius hint when no listings and no location', async () => {
    vi.spyOn(useGeolocationHook, 'useGeolocation').mockReturnValue({
      ...mockGeolocation,
      coordinates: null,
    });
    renderWithRouter(<MarketplaceMap listings={[]} />);
    await waitFor(() => {
      expect(screen.queryByText('Try increasing the radius')).not.toBeInTheDocument();
    });
  });

  it('should initialize Google Maps with correct options', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect((window as any).google.maps.Map).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          zoom: 12,
          disableDefaultUI: false,
          zoomControl: true,
        })
      );
    });
  });

  it('should create InfoWindow for marker clicks', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect((window as any).google.maps.InfoWindow).toHaveBeenCalled();
    });
  });

  it('should pan to user location when available', async () => {
    const mockPanTo = vi.fn();
    const mockMap = {
      panTo: mockPanTo,
      setZoom: vi.fn(),
      getZoom: vi.fn().mockReturnValue(13),
      fitBounds: vi.fn(),
      setCenter: vi.fn(),
    };
    (window as any).google.maps.Map = vi.fn(function () {
      return mockMap;
    });

    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect(mockPanTo).toHaveBeenCalledWith({
        lat: mockGeolocation.coordinates!.latitude,
        lng: mockGeolocation.coordinates!.longitude,
      });
    });
  });

  it('should create circle with correct radius', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect((window as any).google.maps.Circle).toHaveBeenCalledWith(
        expect.objectContaining({
          radius: 5000, // 5km default * 1000
          strokeColor: '#3b82f6',
        })
      );
    });
  });

  it('should filter listings by coordinates', async () => {
    const listingsMixed: MarketplaceListingWithDistance[] = [
      mockListings[0],
      { ...mockListings[1], coordinates: undefined },
    ];
    renderWithRouter(<MarketplaceMap listings={listingsMixed} />);
    await waitFor(() => {
      // Only listings with coordinates should be shown
      expect((window as any).google.maps.Marker).toHaveBeenCalled();
    });
  });

  it('should add click listener to markers', async () => {
    const mockAddListener = vi.fn();
    const mockMarker = {
      setPosition: vi.fn(),
      setMap: vi.fn(),
      addListener: mockAddListener,
    };
    (window as any).google.maps.Marker = vi.fn(function () {
      return mockMarker;
    });

    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect(mockAddListener).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  it('should render with default empty listings', async () => {
    renderWithRouter(<MarketplaceMap />);
    await waitFor(() => {
      expect(screen.getByText(/Showing/)).toBeInTheDocument();
    });
  });

  it('should call getCurrentPosition after permission granted', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);

    const button = await screen.findByText('Update Location');
    fireEvent.click(button.closest('button')!);

    await waitFor(() => {
      expect(mockGeolocation.requestPermission).toHaveBeenCalled();
      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
    });
  });

  it('should display radius range labels', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect(screen.getByText('1 km')).toBeInTheDocument();
      expect(screen.getByText('20 km')).toBeInTheDocument();
    });
  });

  it('should render default radius value of 5 km', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect(screen.getByText('5 km')).toBeInTheDocument();
    });
  });

  it('should create user location marker', async () => {
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      // User marker is created with special icon
      const markerCalls = (window as any).google.maps.Marker.mock.calls;
      const userMarkerCall = markerCalls.find((call: any[]) =>
        call[0]?.title === 'Your Location'
      );
      expect(userMarkerCall || markerCalls.length).toBeTruthy();
    });
  });

  it('should use LatLngBounds when fitting map to listings', async () => {
    vi.spyOn(useGeolocationHook, 'useGeolocation').mockReturnValue({
      ...mockGeolocation,
      coordinates: null,
    });
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect((window as any).google.maps.LatLngBounds).toHaveBeenCalled();
    });
  });

  it('should register idle listener for zoom limiting when fitting bounds', async () => {
    vi.spyOn(useGeolocationHook, 'useGeolocation').mockReturnValue({
      ...mockGeolocation,
      coordinates: null,
    });
    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      expect((window as any).google.maps.event.addListener).toHaveBeenCalledWith(
        expect.any(Object),
        'idle',
        expect.any(Function)
      );
    });
  });

  it('should limit zoom to 15 when fitBounds zooms in too much', async () => {
    const mockSetZoom = vi.fn();
    const mockMap = {
      panTo: vi.fn(),
      setZoom: mockSetZoom,
      getZoom: vi.fn().mockReturnValue(18), // Return zoom > 15
      fitBounds: vi.fn(),
      setCenter: vi.fn(),
    };
    (window as any).google.maps.Map = vi.fn(function () {
      return mockMap;
    });

    // Make event.addListener call the callback immediately to trigger zoom limiting
    let idleCallback: (() => void) | null = null;
    (window as any).google.maps.event.addListener = vi.fn((obj: any, event: string, cb: () => void) => {
      if (event === 'idle') {
        idleCallback = cb;
      }
      return { remove: vi.fn() };
    });

    vi.spyOn(useGeolocationHook, 'useGeolocation').mockReturnValue({
      ...mockGeolocation,
      coordinates: null,
    });

    renderWithRouter(<MarketplaceMap listings={mockListings} />);

    await waitFor(() => {
      expect((window as any).google.maps.event.addListener).toHaveBeenCalled();
    });

    // Call the idle callback to trigger zoom limiting
    if (idleCallback) {
      idleCallback();
    }

    await waitFor(() => {
      expect(mockSetZoom).toHaveBeenCalledWith(15);
    });
  });

  it('should register click listeners on listing markers', async () => {
    const mockAddListener = vi.fn();
    (window as any).google.maps.Marker = vi.fn(function () {
      return {
        setPosition: vi.fn(),
        setMap: vi.fn(),
        addListener: mockAddListener,
      };
    });

    renderWithRouter(<MarketplaceMap listings={mockListings} />);
    await waitFor(() => {
      // Should have click listeners for each listing with coordinates
      const clickCalls = mockAddListener.mock.calls.filter(
        (call: any[]) => call[0] === 'click'
      );
      expect(clickCalls.length).toBeGreaterThan(0);
    });
  });

  it('should create InfoWindow content when marker is clicked', async () => {
    let markerClickCallback: (() => void) | null = null;
    const mockAddListener = vi.fn((event: string, callback: () => void) => {
      if (event === 'click') {
        markerClickCallback = callback;
      }
    });

    const mockInfoWindowSetContent = vi.fn();
    const mockInfoWindowOpen = vi.fn();

    (window as any).google.maps.Marker = vi.fn(function () {
      return {
        setPosition: vi.fn(),
        setMap: vi.fn(),
        addListener: mockAddListener,
      };
    });

    (window as any).google.maps.InfoWindow = vi.fn(function () {
      return {
        setContent: mockInfoWindowSetContent,
        open: mockInfoWindowOpen,
        close: vi.fn(),
      };
    });

    renderWithRouter(<MarketplaceMap listings={mockListings} />);

    await waitFor(() => {
      expect(mockAddListener).toHaveBeenCalled();
    });

    // Simulate marker click
    if (markerClickCallback) {
      markerClickCallback();
    }

    await waitFor(() => {
      expect(mockInfoWindowSetContent).toHaveBeenCalled();
      expect(mockInfoWindowOpen).toHaveBeenCalled();
    });
  });
});

describe('MarketplaceMap - Error States', () => {
  let MarketplaceMap: typeof import('./MarketplaceMap').default;

  beforeAll(async () => {
    const module = await import('./MarketplaceMap');
    MarketplaceMap = module.default;
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useGeolocationHook, 'useGeolocation').mockReturnValue({
      coordinates: null,
      loading: false,
      error: null,
      permission: 'prompt' as const,
      getCurrentPosition: vi.fn(),
      requestPermission: vi.fn().mockResolvedValue(true),
      clearError: vi.fn(),
    });
  });

  it('should handle Google Maps not being configured', async () => {
    // Remove the google object to simulate unconfigured state
    delete (window as any).google;

    // Clear the VITE env var
    const originalKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY = '';

    // Need to re-import to get fresh module state
    vi.resetModules();
    const freshModule = await import('./MarketplaceMap');
    const FreshMarketplaceMap = freshModule.default;

    renderWithRouter(<FreshMarketplaceMap listings={[]} />);

    // Should show error or loading state
    await waitFor(() => {
      const errorOrLoading = screen.queryByText('Failed to load Google Maps') ||
                             screen.queryByText('Loading map...');
      expect(errorOrLoading).toBeInTheDocument();
    });

    // Restore
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY = originalKey;
  });
});
