import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { marketplaceService } from "../services/marketplace";
import { messageService } from "../services/messages";
import { uploadService } from "../services/upload";
import { formatQuantityWithUnit } from "../constants/units";
import { useToast } from "../contexts/ToastContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { SkeletonProductCard } from "../components/ui/skeleton";
import { Plus, Search, MapPin, Clock, List, Map, Package, MessageCircle, ShoppingBag } from "lucide-react";
import { getDaysUntilExpiry } from "../lib/utils";
import MarketplaceMap from "./Marketplace/MarketplaceMap";
import { Co2Badge } from "../components/common/Co2Badge";
import { parsePickupLocation } from "../utils/coordinates";
import { calculateDiscountPercentage } from "../utils/pricing";
import type { MarketplaceListing, MarketplaceListingWithDistance } from "../types/marketplace";
import { MARKETPLACE_CATEGORIES } from "../types/marketplace";

const categories = ["All", ...MARKETPLACE_CATEGORIES];

export default function MarketplacePage() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  useEffect(() => {
    loadListings();
  }, []);

  const loadListings = async () => {
    try {
      const data = await marketplaceService.getListings();

      // Parse coordinates from pickupLocation using utility function
      const parsedListings = data.map((listing) => {
        const parsed = parsePickupLocation(listing.pickupLocation);

        if (parsed.coordinates) {
          return {
            ...listing,
            pickupLocation: parsed.address,
            coordinates: {
              latitude: parsed.coordinates.lat,
              longitude: parsed.coordinates.lng,
            },
          };
        }
        return listing;
      });

      setListings(parsedListings);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load listings";
      console.error("Failed to load listings:", message);
    } finally {
      setLoading(false);
    }
  };

  const filteredListings = listings.filter((l) => {
    const matchesSearch =
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || l.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-40 skeleton rounded-lg" />
            <div className="h-4 w-56 skeleton rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonProductCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Marketplace</h1>
          <p className="text-muted-foreground mt-1">Find great deals on near-expiry food</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Toggle */}
          <div className="flex items-center bg-muted rounded-xl p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === "list"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === "map"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Map className="h-4 w-4" />
              <span className="hidden sm:inline">Map</span>
            </button>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/marketplace/my-listings">
              <Package className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">My Listings</span>
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/marketplace/my-purchases">
              <ShoppingBag className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">My Purchases</span>
            </Link>
          </Button>
          <Button asChild>
            <Link to="/marketplace/create">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Create</span>
              <span className="sm:hidden">New</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Map View */}
      {viewMode === "map" ? (
        <div className="flex-1">
          <MarketplaceMap
            listings={filteredListings as MarketplaceListingWithDistance[]}
            loading={loading}
          />
        </div>
      ) : (
        <>
          {/* Search and filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search listings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-1 sm:px-1 touch-pan-x scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {cat === "All" ? cat : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Listings grid */}
          {filteredListings.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">No listings found</p>
                <Button asChild>
                  <Link to="/marketplace/create">Create the first listing</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
              {filteredListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ListingCard({ listing }: { listing: MarketplaceListing }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [messagingLoading, setMessagingLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const daysUntil = getDaysUntilExpiry(listing.expiryDate);
  const discount = calculateDiscountPercentage(listing.originalPrice, listing.price);

  // Get first image as thumbnail
  const imageUrls = uploadService.getListingImageUrls(listing.images);
  const thumbnailUrl = imageUrls[0];

  const handleMessageClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMessagingLoading(true);
    try {
      const conversation = await messageService.getOrCreateConversationForListing(listing.id);
      navigate(`/messages/${conversation.id}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to start conversation";
      addToast(message, "error");
    } finally {
      setMessagingLoading(false);
    }
  };

  return (
    <Link to={`/marketplace/${listing.id}`}>
      <Card className="card-hover press-effect overflow-hidden h-full">
        {/* Image */}
        <div className="aspect-square sm:aspect-[4/3] bg-muted relative flex items-center justify-center overflow-hidden">
          {thumbnailUrl && !imageError ? (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 skeleton" />
              )}
              <img
                src={thumbnailUrl}
                alt={listing.title}
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                className={`w-full h-full object-cover transition-all duration-300 hover:scale-105 ${
                  imageLoaded ? "opacity-100" : "opacity-0"
                }`}
              />
            </>
          ) : (
            <div className="text-muted-foreground text-3xl sm:text-5xl">📦</div>
          )}
          {/* Badges overlay */}
          <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 right-1.5 sm:right-2 flex justify-between items-start">
            <div className="flex flex-col gap-1">
              {listing.category && (
                <Badge variant="secondary" className="text-[10px] sm:text-xs bg-card/90 backdrop-blur-sm px-1.5 sm:px-2">
                  {listing.category}
                </Badge>
              )}
              {listing.co2Saved && (
                <Co2Badge co2Saved={listing.co2Saved} variant="compact" className="bg-card/90 backdrop-blur-sm text-[10px] sm:text-xs" />
              )}
            </div>
            {discount && (
              <Badge className="bg-destructive text-destructive-foreground text-[10px] sm:text-xs px-1.5 sm:px-2">
                -{discount}%
              </Badge>
            )}
          </div>
          {/* Expiry indicator */}
          {listing.expiryDate && daysUntil !== null && (
            <div className={`absolute bottom-1.5 sm:bottom-2 left-1.5 sm:left-2 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-medium backdrop-blur-sm ${
              daysUntil < 0
                ? "bg-destructive/90 text-destructive-foreground"
                : daysUntil <= 2
                ? "bg-warning/90 text-warning-foreground"
                : "bg-card/90 text-foreground"
            }`}>
              <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 inline mr-0.5 sm:mr-1" />
              {daysUntil < 0 ? "Expired" : daysUntil === 0 ? "Today" : `${daysUntil}d`}
            </div>
          )}
        </div>

        <CardContent className="p-2.5 sm:p-4">
          {/* Title */}
          <h3 className="font-semibold line-clamp-1 text-foreground text-sm sm:text-base">{listing.title}</h3>

          {/* Location - hidden on very small screens */}
          {listing.pickupLocation && (
            <div className="hidden sm:flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="line-clamp-1">{listing.pickupLocation}</span>
            </div>
          )}

          {/* Price and Quantity */}
          <div className="mt-2 sm:mt-3 flex items-end justify-between gap-1">
            <div className="min-w-0">
              {listing.price === null || listing.price === 0 ? (
                <span className="text-sm sm:text-lg font-bold text-success">Free</span>
              ) : (
                <div className="flex items-baseline gap-1 sm:gap-2 flex-wrap">
                  <span className="text-base sm:text-xl font-bold text-foreground">${listing.price.toFixed(2)}</span>
                  {listing.originalPrice && (
                    <span className="text-[10px] sm:text-sm text-muted-foreground line-through">
                      ${listing.originalPrice.toFixed(2)}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground bg-muted px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg flex-shrink-0">
              {formatQuantityWithUnit(listing.quantity, listing.unit)}
            </div>
          </div>

          {/* Seller - hidden on mobile for compact view */}
          {listing.seller && (
            <div className="hidden sm:flex mt-3 pt-3 border-t items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                  {listing.seller.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-muted-foreground truncate">{listing.seller.name}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleMessageClick}
                disabled={messagingLoading}
                className="h-8 w-8 rounded-full flex-shrink-0"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
