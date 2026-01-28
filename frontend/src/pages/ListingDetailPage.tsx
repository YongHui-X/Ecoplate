import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { marketplaceService } from "../services/marketplace";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { ArrowLeft, MapPin, Clock, Edit, Trash2, CheckCircle } from "lucide-react";
import { formatDate, getDaysUntilExpiry } from "../lib/utils";
import type { MarketplaceListing } from "../types/marketplace";

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadListing();
  }, [id]);

  const loadListing = async () => {
    try {
      const data = await marketplaceService.getListing(Number(id));
      setListing(data);
    } catch (error: any) {
      addToast(error.message || "Failed to load listing", "error");
      navigate("/marketplace");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this listing?")) {
      return;
    }

    setActionLoading(true);
    try {
      await marketplaceService.deleteListing(Number(id));
      addToast("Listing deleted successfully!", "success");
      navigate("/marketplace");
    } catch (error: any) {
      addToast(error.message || "Failed to delete listing", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (
      !window.confirm(
        "Mark this listing as completed? This will remove it from the marketplace."
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      await marketplaceService.completeListing(Number(id));
      addToast("Listing marked as completed!", "success");
      loadListing();
    } catch (error: any) {
      addToast(error.message || "Failed to complete listing", "error");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!listing) {
    return null;
  }

  const isOwner = user?.id === listing.sellerId;
  const daysUntil = getDaysUntilExpiry(listing.expiryDate);
  const discount =
    listing.originalPrice && listing.price
      ? Math.round((1 - listing.price / listing.originalPrice) * 100)
      : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate("/marketplace")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Marketplace
      </Button>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Placeholder Image */}
        <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center border">
          <div className="text-center text-gray-400">
            <p className="text-4xl mb-2">📦</p>
            <p className="text-sm">No image</p>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-6">
          {/* Title and Status */}
          <div>
            <div className="flex items-start justify-between gap-2 mb-2">
              <h1 className="text-2xl font-bold">{listing.title}</h1>
              <Badge
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

            {listing.category && (
              <Badge variant="secondary">
                {listing.category.charAt(0).toUpperCase() +
                  listing.category.slice(1)}
              </Badge>
            )}
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            {listing.price === null || listing.price === 0 ? (
              <span className="text-3xl font-bold text-green-600">Free</span>
            ) : (
              <>
                <span className="text-3xl font-bold">${listing.price.toFixed(2)}</span>
                {listing.originalPrice && (
                  <>
                    <span className="text-lg text-gray-400 line-through">
                      ${listing.originalPrice.toFixed(2)}
                    </span>
                    {discount && (
                      <Badge className="bg-red-500">-{discount}%</Badge>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* Info */}
          <div className="space-y-3 text-gray-600">
            {listing.expiryDate && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {daysUntil !== null ? (
                  daysUntil < 0 ? (
                    <span className="text-red-600">
                      Expired {Math.abs(daysUntil)} days ago
                    </span>
                  ) : daysUntil === 0 ? (
                    <span className="text-yellow-600">Expires today</span>
                  ) : (
                    <span>Expires in {daysUntil} days</span>
                  )
                ) : (
                  <span>No expiry date set</span>
                )}
              </div>
            )}

            {listing.pickupLocation && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{listing.pickupLocation}</span>
              </div>
            )}

            <div>
              <strong>Quantity:</strong> {listing.quantity}
            </div>

            <div className="text-sm text-gray-500">
              Posted {formatDate(listing.createdAt)}
            </div>
          </div>

          {/* Description */}
          {listing.description && (
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-gray-600 whitespace-pre-wrap">
                {listing.description}
              </p>
            </div>
          )}

          {/* Seller */}
          {listing.seller && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                {listing.seller.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{listing.seller.name}</p>
                <p className="text-sm text-gray-500">Seller</p>
              </div>
            </div>
          )}

          {/* Actions */}
          {isOwner ? (
            <div className="space-y-3">
              {listing.status === "active" && (
                <>
                  <Button
                    onClick={handleMarkCompleted}
                    disabled={actionLoading}
                    className="w-full"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Completed
                  </Button>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      asChild
                      disabled={actionLoading}
                      className="flex-1"
                    >
                      <Link to={`/marketplace/${listing.id}/edit`}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDelete}
                      disabled={actionLoading}
                      className="flex-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </>
              )}
              {listing.status === "completed" && listing.completedAt && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <p className="text-sm text-green-800">
                      Completed on {formatDate(listing.completedAt)}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div>
              {listing.status === "active" ? (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <p className="text-sm text-blue-800">
                      Contact the seller at their pickup location to arrange collection.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-gray-50">
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-600">
                      This listing is no longer available.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
