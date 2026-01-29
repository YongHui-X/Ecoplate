import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { marketplaceService } from "../../services/marketplace";
import { uploadService } from "../../services/upload";
import type { MarketplaceListing } from "../../types/marketplace";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { getDaysUntilExpiry } from "../../lib/utils";

interface SimilarProductsProps {
  listingId: number;
}

export function SimilarProducts({ listingId }: SimilarProductsProps) {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSimilar = async () => {
      try {
        setLoading(true);
        const result = await marketplaceService.getSimilarListings(listingId);
        setListings(result.listings || []);
      } catch (error) {
        console.error("Failed to fetch similar products:", error);
        setListings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSimilar();
  }, [listingId]);

  if (!loading && listings.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-xl font-semibold">Similar Products</h2>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {listings.map((listing) => (
            <SimilarProductCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}

function SimilarProductCard({ listing }: { listing: MarketplaceListing }) {
  const imageUrls = uploadService.getListingImageUrls(listing.images);
  const thumbnailUrl = imageUrls[0];
  const daysUntilExpiry = listing.expiryDate
    ? getDaysUntilExpiry(listing.expiryDate)
    : null;
  const discount =
    listing.originalPrice && listing.price
      ? Math.round((1 - listing.price / listing.originalPrice) * 100)
      : null;

  return (
    <Link to={`/marketplace/${listing.id}`}>
      <Card className="overflow-hidden card-hover press-effect h-full rounded-xl">
        <div className="relative aspect-[4/3]">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-sm">No image</span>
            </div>
          )}
          {discount && discount > 0 && (
            <Badge className="absolute top-2 right-2 bg-primary">
              {discount}% off
            </Badge>
          )}
        </div>
        <CardContent className="p-3">
          <h3 className="font-medium line-clamp-1">{listing.title}</h3>
          <div className="flex items-center justify-between mt-1">
            <span className="text-primary font-semibold">
              {listing.price !== null && listing.price > 0
                ? `$${listing.price.toFixed(2)}`
                : "FREE"}
            </span>
            {daysUntilExpiry !== null && (
              <span
                className={`text-xs ${
                  daysUntilExpiry <= 0
                    ? "text-destructive"
                    : daysUntilExpiry <= 2
                    ? "text-warning"
                    : "text-muted-foreground"
                }`}
              >
                {daysUntilExpiry <= 0 ? "Expired" : `${daysUntilExpiry}d left`}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
