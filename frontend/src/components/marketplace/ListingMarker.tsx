import { Marker as LeafletMarker, Popup } from 'react-leaflet';
import { Icon } from 'leaflet';
import type { Coordinates } from '../../utils/distance';

interface ListingMarkerProps {
  position: Coordinates;
  title: string;
  price?: number | null;
  isUrgent?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

/**
 * Custom marker component for marketplace listings
 * Can be customized with different colors based on urgency
 */
export function ListingMarker({
  position,
  title,
  price,
  isUrgent = false,
  onClick,
  children,
}: ListingMarkerProps) {
  // Create custom marker icon based on urgency
  const markerColor = isUrgent ? '#ef4444' : price === null || price === 0 ? '#10b981' : '#3b82f6';

  const customIcon = new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <path
          fill="${markerColor}"
          stroke="white"
          stroke-width="2"
          d="M16 2C10.486 2 6 6.486 6 12c0 5.25 10 18 10 18s10-12.75 10-18c0-5.514-4.486-10-10-10z"
        />
        <circle cx="16" cy="12" r="4" fill="white"/>
      </svg>
    `)}`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  return (
    <LeafletMarker
      position={[position.latitude, position.longitude]}
      icon={customIcon}
      title={title}
      eventHandlers={{
        click: onClick,
      }}
    >
      {children && <Popup>{children}</Popup>}
    </LeafletMarker>
  );
}
