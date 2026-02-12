import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LocationPreviewMap } from './LocationPreviewMap';

// Mock the googleMaps utility
vi.mock('../../utils/googleMaps', () => ({
  isGoogleMapsConfigured: vi.fn(() => true),
  loadGoogleMapsScript: vi.fn(() => Promise.resolve()),
}));

import { isGoogleMapsConfigured, loadGoogleMapsScript } from '../../utils/googleMaps';

const mockIsGoogleMapsConfigured = vi.mocked(isGoogleMapsConfigured);
const mockLoadGoogleMapsScript = vi.mocked(loadGoogleMapsScript);

describe('LocationPreviewMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsGoogleMapsConfigured.mockReturnValue(true);
    mockLoadGoogleMapsScript.mockResolvedValue(undefined);
  });

  describe('placeholder state', () => {
    it('should show placeholder when no coordinates provided', () => {
      render(<LocationPreviewMap />);

      expect(screen.getByText('Select a location above to see it on the map')).toBeInTheDocument();
    });

    it('should show placeholder with undefined coordinates', () => {
      render(<LocationPreviewMap coordinates={undefined} />);

      expect(screen.getByText('Select a location above to see it on the map')).toBeInTheDocument();
    });

    it('should render MapPin icon in placeholder', () => {
      const { container } = render(<LocationPreviewMap />);

      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should apply custom height to placeholder', () => {
      const { container } = render(<LocationPreviewMap height="300px" />);

      const placeholder = container.firstChild as HTMLElement;
      expect(placeholder.style.height).toBe('300px');
    });

    it('should apply default height of 200px to placeholder', () => {
      const { container } = render(<LocationPreviewMap />);

      const placeholder = container.firstChild as HTMLElement;
      expect(placeholder.style.height).toBe('200px');
    });
  });

  describe('error state', () => {
    it('should show error when Google Maps API is not configured', async () => {
      mockIsGoogleMapsConfigured.mockReturnValue(false);

      render(<LocationPreviewMap coordinates={{ latitude: 1.35, longitude: 103.82 }} />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load map preview')).toBeInTheDocument();
      });
    });

    it('should show error when script loading fails', async () => {
      mockIsGoogleMapsConfigured.mockReturnValue(true);
      mockLoadGoogleMapsScript.mockRejectedValue(new Error('Failed to load'));

      render(<LocationPreviewMap coordinates={{ latitude: 1.35, longitude: 103.82 }} />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load map preview')).toBeInTheDocument();
      });
    });
  });

  describe('loading behavior', () => {
    it('should load Google Maps script on mount', () => {
      render(<LocationPreviewMap />);

      // Script should be attempted to load
      expect(mockLoadGoogleMapsScript).toHaveBeenCalled();
    });

    it('should not load script when not configured', () => {
      mockIsGoogleMapsConfigured.mockReturnValue(false);

      render(<LocationPreviewMap coordinates={{ latitude: 1.35, longitude: 103.82 }} />);

      expect(mockLoadGoogleMapsScript).not.toHaveBeenCalled();
    });

    it('should attempt to load script when configured', () => {
      mockIsGoogleMapsConfigured.mockReturnValue(true);

      render(<LocationPreviewMap coordinates={{ latitude: 1.35, longitude: 103.82 }} />);

      expect(mockLoadGoogleMapsScript).toHaveBeenCalled();
    });
  });
});
