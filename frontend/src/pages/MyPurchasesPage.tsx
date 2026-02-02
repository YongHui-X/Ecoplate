import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { marketplaceService } from "../services/marketplace";
import { uploadService } from "../services/upload";
import { formatQuantityWithUnit } from "../constants/units";
import { useToast } from "../contexts/ToastContext";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Clock, MapPin, User, ShoppingBag } from "lucide-react";
import { formatDate } from "../lib/utils";
import type { MarketplaceListing } from "../types/marketplace";

export default function MyPurchasesPage() {
  const [purchases, setPurchases] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    try {
      const data = await marketplaceService.getMyPurchases();
      setPurchases(data);
    } catch (error: any) {
      console.error("Failed to load purchases:", error);
      addToast(error.message || "Failed to load purchase history", "error");
    } finally {
      setLoading(false);
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
      <div>
        <h1 className="text-2xl font-bold">My Purchases</h1>
        <p className="text-muted-foreground">Your purchase history from the marketplace</p>
      </div>

      {purchases.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No purchases yet</p>
            <p className="text-sm text-muted-foreground">
              Items you reserve and purchase will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {purchases.map((purchase) => (
            <PurchaseCard key={purchase.id} purchase={purchase} />
          ))}
        </div>
      )}
    </div>
  );
}

interface PurchaseCardProps {
  purchase: MarketplaceListing;
}

function PurchaseCard({ purchase }: PurchaseCardProps) {
  const imageUrls = uploadService.getListingImageUrls(purchase.images);
  const thumbnailUrl = imageUrls[0];

  return (
    <Link to={`/marketplace/${purchase.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
        {/* Product Image */}
        <div className="aspect-video bg-muted relative flex items-center justify-center border-b overflow-hidden">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={purchase.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-muted-foreground text-4xl">📦</div>
          )}
          <Badge
            className="absolute top-2 left-2 bg-primary"
          >
            {purchase.status === "sold" ? "Purchased" : purchase.status}
          </Badge>
        </div>

        <CardContent className="p-4">
          {/* Title and Category */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="font-semibold line-clamp-1">{purchase.title}</h3>
            {purchase.category && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                {purchase.category}
              </Badge>
            )}
          </div>

          {/* Info */}
          <div className="space-y-1 text-sm text-muted-foreground mb-3">
            {purchase.seller && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>Seller: {purchase.seller.name}</span>
              </div>
            )}
            {purchase.pickupLocation && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span className="line-clamp-1">
                  {purchase.pickupLocation.split("|")[0]}
                </span>
              </div>
            )}
            {purchase.completedAt && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Purchased {formatDate(purchase.completedAt)}</span>
              </div>
            )}
          </div>

          {/* Price */}
          <div className="mb-3">
            {purchase.price === null || purchase.price === 0 ? (
              <span className="text-lg font-bold text-primary">Free</span>
            ) : (
              <span className="text-lg font-bold">${purchase.price.toFixed(2)}</span>
            )}
            <div className="text-sm text-muted-foreground mt-1">
              Quantity: {formatQuantityWithUnit(purchase.quantity, purchase.unit)}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
