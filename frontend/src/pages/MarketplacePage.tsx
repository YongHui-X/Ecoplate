import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { marketplaceService } from "../services/marketplace";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Plus, Search, MapPin, Clock, List, Map, Package } from "lucide-react";
import { getDaysUntilExpiry } from "../lib/utils";
import MarketplaceMap from "./Marketplace/MarketplaceMap";
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
      console.log("Raw listings from API:", data);

      // Parse coordinates from pickupLocation if stored as "address|lat,lng"
      const parsedListings = data.map((listing) => {
        if (listing.pickupLocation && listing.pickupLocation.includes("|")) {
          const [address, coords] = listing.pickupLocation.split("|");
          const coordParts = coords.split(",");
          const lat = parseFloat(coordParts[0]);
          const lng = parseFloat(coordParts[1]);

          console.log(`Listing ${listing.id}: parsed coords lat=${lat}, lng=${lng} from "${listing.pickupLocation}"`);

          // Only set coordinates if both are valid numbers
          if (!isNaN(lat) && !isNaN(lng)) {
            return {
              ...listing,
              pickupLocation: address,
              coordinates: { latitude: lat, longitude: lng },
            };
          }
        }
        console.log(`Listing ${listing.id}: no coordinates found in "${listing.pickupLocation}"`);
        return listing;
      });

      console.log("Parsed listings with coordinates:", parsedListings);
      setListings(parsedListings);
    } catch (error) {
      console.error("Failed to load listings:", error);
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Marketplace</h1>
          <p className="text-gray-600">Find great deals on near-expiry food</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-none"
            >
              <List className="h-4 w-4 mr-2" />
              List View
            </Button>
            <Button
              variant={viewMode === "map" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("map")}
              className="rounded-none"
            >
              <Map className="h-4 w-4 mr-2" />
              Map View
            </Button>
          </div>
          <Button variant="outline" asChild>
            <Link to="/marketplace/my-listings">
              <Package className="h-4 w-4 mr-2" />
              My Listings
            </Link>
          </Button>
          <Button asChild>
            <Link to="/marketplace/create">
              <Plus className="h-4 w-4 mr-2" />
              Create Listing
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
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search listings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="whitespace-nowrap"
                >
                  {cat === "All" ? cat : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Listings grid */}
          {filteredListings.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-gray-500 mb-4">No listings found</p>
                <Button asChild>
                  <Link to="/marketplace/create">Create the first listing</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
  const daysUntil = getDaysUntilExpiry(listing.expiryDate);
  const discount =
    listing.originalPrice && listing.price
      ? Math.round((1 - listing.price / listing.originalPrice) * 100)
      : null;

  return (
    <Link to={`/marketplace/${listing.id}`}>
      <Card className="hover:shadow-md transition-shadow overflow-hidden">
        <div className="aspect-video bg-gray-100 relative flex items-center justify-center border-b">
          <div className="text-gray-400 text-4xl">📦</div>
          {discount && (
            <Badge className="absolute top-2 right-2 bg-red-500">
              -{discount}%
            </Badge>
          )}
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold line-clamp-1">{listing.title}</h3>
            {listing.category && (
              <Badge variant="secondary" className="shrink-0">
                {listing.category}
              </Badge>
            )}
          </div>

          <div className="mt-2 space-y-1 text-sm text-gray-600">
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
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div>
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
            </div>
            <div className="text-sm text-gray-500">
              Qty: {listing.quantity}
            </div>
          </div>

          {listing.seller && (
            <div className="mt-3 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary font-medium">
                {listing.seller.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-gray-600">{listing.seller.name}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
