import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { marketplaceService } from "../services/marketplace";
import { uploadService } from "../services/upload";
import { formatQuantityWithUnit } from "../constants/units";
import { useToast } from "../contexts/ToastContext";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Plus, Clock, MapPin, Edit, Trash2 } from "lucide-react";
import { getDaysUntilExpiry, formatDate } from "../lib/utils";
import type { MarketplaceListing } from "../types/marketplace";

export default function MyListingsPage() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    loadListings();
  }, []);

  const loadListings = async () => {
    try {
      const data = await marketplaceService.getMyListings();
      setListings(data);
    } catch (error: any) {
      console.error("Failed to load listings:", error);
      addToast(error.message || "Failed to load listings", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this listing?")) {
      return;
    }

    try {
      await marketplaceService.deleteListing(id);
      addToast("Listing deleted successfully!", "success");
      loadListings();
    } catch (error: any) {
      addToast(error.message || "Failed to delete listing", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Listings</h1>
          <p className="text-gray-600">Manage your marketplace listings</p>
        </div>
        <Button asChild>
          <Link to="/marketplace/create">
            <Plus className="h-4 w-4 mr-2" />
            Create Listing
          </Link>
        </Button>
      </div>

      {listings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500 mb-4">You haven't created any listings yet</p>
            <Button asChild>
              <Link to="/marketplace/create">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Listing
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ListingCardProps {
  listing: MarketplaceListing;
  onDelete: (id: number) => void;
}

function ListingCard({ listing, onDelete }: ListingCardProps) {
  const daysUntil = getDaysUntilExpiry(listing.expiryDate);
  const discount =
    listing.originalPrice && listing.price
      ? Math.round((1 - listing.price / listing.originalPrice) * 100)
      : null;

  // Get first image as thumbnail
  const imageUrls = uploadService.getListingImageUrls(listing.images);
  const thumbnailUrl = imageUrls[0];

  const handleActionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link to={`/marketplace/${listing.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
        {/* Product Image */}
        <div className="aspect-video bg-gray-100 relative flex items-center justify-center border-b overflow-hidden">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-gray-400 text-4xl">📦</div>
          )}
          {discount && (
            <Badge className="absolute top-2 right-2 bg-red-500">
              -{discount}%
            </Badge>
          )}
          <Badge
            className="absolute top-2 left-2"
            variant={
              listing.status === "active"
                ? "default"
                : listing.status === "completed"
                ? "secondary"
                : "outline"
            }
          >
            {listing.status}
          </Badge>
        </div>

        <CardContent className="p-4">
          {/* Title and Category */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="font-semibold line-clamp-1">{listing.title}</h3>
            {listing.category && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                {listing.category}
              </Badge>
            )}
          </div>

        {/* Info */}
        <div className="space-y-1 text-sm text-gray-600 mb-3">
          {listing.expiryDate && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {daysUntil !== null ? (
                daysUntil < 0 ? (
                  <span className="text-red-600">Expired</span>
                ) : daysUntil === 0 ? (
                  <span className="text-yellow-600">Expires today</span>
                ) : (
                  <span>{daysUntil} days left</span>
                )
              ) : (
                <span>No expiry set</span>
              )}
            </div>
          )}
          {listing.pickupLocation && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="line-clamp-1">{listing.pickupLocation}</span>
            </div>
          )}
          <div className="text-xs text-gray-500">
            Posted {formatDate(listing.createdAt)}
          </div>
        </div>

        {/* Price */}
        <div className="mb-3">
          {listing.price === null || listing.price === 0 ? (
            <span className="text-lg font-bold text-green-600">Free</span>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold">${listing.price.toFixed(2)}</span>
              {listing.originalPrice && (
                <span className="text-sm text-gray-400 line-through">
                  ${listing.originalPrice.toFixed(2)}
                </span>
              )}
            </div>
          )}
          <div className="text-sm text-gray-500 mt-1">
            Quantity: {formatQuantityWithUnit(listing.quantity, listing.unit)}
          </div>
        </div>

        {/* Actions */}
        {listing.status === "active" && (
          <div className="flex gap-2" onClick={handleActionClick}>
            <Button variant="outline" size="sm" asChild className="flex-1">
              <Link to={`/marketplace/${listing.id}/edit`}>
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(listing.id)}
              className="flex-1 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          </div>
        )}

        {listing.status === "completed" && listing.completedAt && (
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            Completed on {formatDate(listing.completedAt)}
          </div>
        )}
      </CardContent>
    </Card>
    </Link>
  );
}
