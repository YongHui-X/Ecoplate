import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock react-leaflet before importing the component
vi.mock('react-leaflet', () => ({
  Marker: ({ children, position, title }: { children?: React.ReactNode; position: [number, number]; title: string }) =>
    React.createElement('div', { 'data-testid': 'marker', 'data-position': position.join(','), 'data-title': title }, children),
  Popup: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'popup' }, children),
}));

// Mock leaflet
vi.mock('leaflet', () => ({
  Icon: class MockIcon {
    constructor() {
      return {};
    }
  },
}));

import { ListingMarker } from './ListingMarker';

describe('ListingMarker', () => {
  const defaultProps = {
    position: { latitude: 1.3521, longitude: 103.8198 },
    title: 'Test Listing',
  };

  it('should render marker with position', () => {
    render(<ListingMarker {...defaultProps} />);
    
    const marker = screen.getByTestId('marker');
    expect(marker).toBeInTheDocument();
    expect(marker).toHaveAttribute('data-position', '1.3521,103.8198');
    expect(marker).toHaveAttribute('data-title', 'Test Listing');
  });

  it('should render with price', () => {
    render(<ListingMarker {...defaultProps} price={10.50} />);
    
    const marker = screen.getByTestId('marker');
    expect(marker).toBeInTheDocument();
  });

  it('should render as urgent', () => {
    render(<ListingMarker {...defaultProps} isUrgent={true} />);
    
    const marker = screen.getByTestId('marker');
    expect(marker).toBeInTheDocument();
  });

  it('should render with free price (null)', () => {
    render(<ListingMarker {...defaultProps} price={null} />);
    
    const marker = screen.getByTestId('marker');
    expect(marker).toBeInTheDocument();
  });

  it('should render with free price (0)', () => {
    render(<ListingMarker {...defaultProps} price={0} />);
    
    const marker = screen.getByTestId('marker');
    expect(marker).toBeInTheDocument();
  });

  it('should render popup with children', () => {
    render(
      <ListingMarker {...defaultProps}>
        <span>Popup content</span>
      </ListingMarker>
    );
    
    expect(screen.getByTestId('popup')).toBeInTheDocument();
    expect(screen.getByText('Popup content')).toBeInTheDocument();
  });

  it('should not render popup without children', () => {
    render(<ListingMarker {...defaultProps} />);
    
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
  });
});
