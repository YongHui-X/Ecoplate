import { formatDistance } from "../../utils/distance";
import { uploadService } from "../../services/upload";
import { formatQuantityWithUnit } from "../../constants/units";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Calendar, MapPin, DollarSign, Package } from "lucide-react";
import type { MarketplaceListingWithDistance } from "../../types/marketplace";

interface ListingMapCardProps {
  listing: MarketplaceListingWithDistance;
  onViewDetails: () => void;
}

/**
 * Compact listing card displayed in map popup
 */
export function ListingMapCard({
  listing,
  onViewDetails,
}: ListingMapCardProps) {
  const hasDiscount =
    listing.originalPrice &&
    listing.price &&
    listing.originalPrice > listing.price;

  const getExpiryUrgency = (
    expiryDate: string | null
  ): "urgent" | "soon" | "normal" => {
    if (!expiryDate) return "normal";

    const days = Math.ceil(
      (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (days < 0) return "urgent";
    if (days <= 2) return "urgent";
    if (days <= 5) return "soon";
    return "normal";
  };

  const formatExpiryDate = (dateString: string | null): string => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const days = Math.ceil(
      (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (days < 0) return "Expired";
    if (days === 0) return "Expires today";
    if (days === 1) return "Expires tomorrow";
    if (days <= 7) return `${days} days left`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const urgency = getExpiryUrgency(listing.expiryDate);

  // Get first image as thumbnail
  const imageUrls = uploadService.getListingImageUrls(listing.images);
  const thumbnailUrl = imageUrls[0];

  return (
    <div className="w-64 p-0 space-y-3">
      {/* Product Image */}
      <div className="w-full h-32 bg-gray-100 flex items-center justify-center rounded-t border-b overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <Package className="h-12 w-12 text-gray-400" />
        )}
      </div>

      <div className="px-3 pb-3 space-y-2">
        {/* Title and Category */}
        <div>
          <h3 className="font-semibold text-sm line-clamp-2">
            {listing.title}
          </h3>
          {listing.category && (
            <Badge variant="secondary" className="mt-1 text-xs">
              {listing.category}
            </Badge>
          )}
        </div>

        {/* Price */}
        <div className="flex items-center gap-2">
          {listing.price !== null && listing.price > 0 ? (
            <>
              <div className="flex items-center text-green-600 font-semibold">
                <DollarSign className="h-4 w-4" />
                <span>${listing.price.toFixed(2)}</span>
              </div>
              {hasDiscount && (
                <span className="text-xs text-gray-500 line-through">
                  ${listing.originalPrice!.toFixed(2)}
                </span>
              )}
            </>
          ) : (
            <Badge variant="outline" className="text-green-600 border-green-600">
              FREE
            </Badge>
          )}
        </div>

        {/* Expiry Date */}
        {listing.expiryDate && (
          <div
            className={`flex items-center gap-1 text-xs ${
              urgency === "urgent"
                ? "text-red-600"
                : urgency === "soon"
                ? "text-orange-600"
                : "text-gray-600"
            }`}
          >
            <Calendar className="h-3 w-3" />
            <span>{formatExpiryDate(listing.expiryDate)}</span>
          </div>
        )}

        {/* Distance */}
        {listing.distance !== undefined && (
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <MapPin className="h-3 w-3" />
            <span>{formatDistance(listing.distance)}</span>
          </div>
        )}

        {/* Quantity */}
        <div className="text-xs text-gray-600">
          Quantity: {formatQuantityWithUnit(listing.quantity, listing.unit)}
        </div>

        {/* Action Button */}
        <Button onClick={onViewDetails} size="sm" className="w-full">
          View Details
        </Button>
      </div>
    </div>
  );
}
