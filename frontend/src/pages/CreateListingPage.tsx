import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api, API_BASE } from "../services/api";
import { marketplaceService } from "../services/marketplace";
import { useToast } from "../contexts/ToastContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ArrowLeft, ImagePlus, X, Leaf, Sparkles, TrendingDown } from "lucide-react";
import { LocationAutocomplete } from "../components/common/LocationAutocomplete";
import { calculateCo2Preview } from "../components/common/Co2Badge";
import { PRODUCT_UNITS } from "../constants/units";

interface PriceRecommendation {
  recommended_price: number;
  min_price: number;
  max_price: number;
  original_price: number;
  discount_percentage: number;
  days_until_expiry: number;
  category: string;
  urgency_label: string;
  reasoning: string;
}

interface Product {
  id: number;
  productName: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number | null;
  purchaseDate: string | null;
  description: string | null;
  co2Emission: number | null;
}

export default function CreateListingPage() {
  const location = useLocation();
  const product = (location.state as { product?: Product })?.product;

  const [title, setTitle] = useState(product?.productName || "");
  const [description, setDescription] = useState(product?.description || "");
  const [category, setCategory] = useState(product?.category || "");
  const [quantity, setQuantity] = useState(product?.quantity || 1);
  const [unit, setUnit] = useState(product?.unit || "pcs");
  const [price, setPrice] = useState<string>("");
  const [originalPrice, setOriginalPrice] = useState<string>(
    product?.unitPrice ? product.unitPrice.toString() : ""
  );
  const [expiryDate, setExpiryDate] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | undefined>();
  const [pickupInstructions, setPickupInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [priceRecommendation, setPriceRecommendation] = useState<PriceRecommendation | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { addToast } = useToast();

  // Fetch price recommendation when relevant fields change
  const fetchPriceRecommendation = useCallback(async () => {
    const origPrice = parseFloat(originalPrice);
    if (!origPrice || origPrice <= 0) {
      setPriceRecommendation(null);
      return;
    }

    setLoadingRecommendation(true);
    try {
      const recommendation = await marketplaceService.getPriceRecommendation({
        originalPrice: origPrice,
        expiryDate: expiryDate || undefined,
        category: category || undefined,
      });
      setPriceRecommendation(recommendation);
    } catch (error) {
      console.error("Failed to get price recommendation:", error);
      setPriceRecommendation(null);
    } finally {
      setLoadingRecommendation(false);
    }
  }, [originalPrice, expiryDate, category]);

  // Debounce the recommendation fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPriceRecommendation();
    }, 500);
    return () => clearTimeout(timer);
  }, [fetchPriceRecommendation]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedImages.length > 5) {
      addToast("Maximum 5 images allowed", "error");
      return;
    }

    const validFiles = files.filter(file => {
      if (!file.type.startsWith("image/")) {
        addToast(`${file.name} is not an image`, "error");
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        addToast(`${file.name} is too large (max 5MB)`, "error");
        return false;
      }
      return true;
    });

    setSelectedImages(prev => [...prev, ...validFiles]);

    // Create previews
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    if (selectedImages.length === 0) return [];

    setUploadingImages(true);
    try {
      const formData = new FormData();
      selectedImages.forEach(file => formData.append("images", file));

      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/marketplace/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload images");
      }

      const data = await response.json();
      return data.urls;
    } finally {
      setUploadingImages(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Upload images first
      const imageUrls = await uploadImages();

      const listing = await api.post<{ id: number }>("/marketplace/listings", {
        title,
        description: description || undefined,
        category: category || undefined,
        quantity,
        unit,
        price: price === "" ? null : parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
        expiryDate: expiryDate || undefined,
        pickupLocation: pickupLocation || undefined,
        coordinates: coordinates,
        pickupInstructions: pickupInstructions || undefined,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        productId: product?.id, // Link to MyFridge product for quantity sync
      });

      addToast("Listing created successfully!", "success");
      navigate(`/marketplace/${listing.id}`);
    } catch (error) {
      addToast("Failed to create listing", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate("/marketplace")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Marketplace
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create Listing</CardTitle>
        </CardHeader>
        <CardContent>
          {product && (
            <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl">
              <p className="text-sm text-primary">
                <strong>Pre-filled from MyFridge:</strong> {product.productName}
              </p>
              <p className="text-xs text-primary/80 mt-1">
                Review and update the details below, then add photos and pricing information.
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Fresh Organic Apples"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your item..."
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Product Images (Max 5)</Label>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-square">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover rounded-md border"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {selectedImages.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center hover:border-primary hover:bg-muted transition-colors"
                  >
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground mt-1">Add</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Add up to 5 images. First image will be the cover photo.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3"
                >
                  <option value="">Select...</option>
                  <option value="produce">Produce</option>
                  <option value="dairy">Dairy</option>
                  <option value="meat">Meat</option>
                  <option value="bakery">Bakery</option>
                  <option value="frozen">Frozen</option>
                  <option value="beverages">Beverages</option>
                  <option value="pantry">Pantry</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry Date</Label>
                <Input
                  id="expiry"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <select
                  id="unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3"
                >
                  {PRODUCT_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* CO2 Preview */}
            <Co2PreviewSection category={category} quantity={quantity} unit={unit} title={title} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="originalPrice">Original Price ($)</Label>
                <Input
                  id="originalPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Selling Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Leave empty for free"
                />
                <p className="text-xs text-muted-foreground">Leave empty to list as free</p>
              </div>
            </div>

            {/* Price Recommendation */}
            {loadingRecommendation && (
              <div className="p-4 rounded-xl bg-muted/50 border animate-pulse">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Getting price recommendation...</span>
                </div>
              </div>
            )}

            {priceRecommendation && !loadingRecommendation && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-foreground">Suggested Price</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {priceRecommendation.urgency_label}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3 mb-2">
                      <span className="text-2xl font-bold text-primary">
                        ${priceRecommendation.recommended_price.toFixed(2)}
                      </span>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" />
                        {priceRecommendation.discount_percentage}% off
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      {priceRecommendation.reasoning}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setPrice(priceRecommendation.recommended_price.toFixed(2))}
                        className="text-xs"
                      >
                        Use ${priceRecommendation.recommended_price.toFixed(2)}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Range: ${priceRecommendation.min_price.toFixed(2)} - ${priceRecommendation.max_price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <LocationAutocomplete
              value={pickupLocation}
              onChange={(value, coords) => {
                setPickupLocation(value);
                setCoordinates(coords);
              }}
              label="Pickup Location"
              placeholder="Search for address, postal code, or landmark in Singapore"
            />

            <div className="space-y-2">
              <Label htmlFor="pickupInstructions">Pickup Instructions</Label>
              <textarea
                id="pickupInstructions"
                value={pickupInstructions}
                onChange={(e) => setPickupInstructions(e.target.value)}
                placeholder="e.g., Available evenings after 6pm, call before pickup"
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/marketplace")}
                className="flex-1"
                disabled={loading || uploadingImages}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || uploadingImages} className="flex-1">
                {uploadingImages ? "Uploading images..." : loading ? "Creating..." : "Create Listing"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * CO2 Preview section component for create listing form
 */
function Co2PreviewSection({
  category,
  quantity,
  unit,
  title,
}: {
  category: string;
  quantity: number;
  unit: string;
  title: string;
}) {
  const co2Estimate = useMemo(() => {
    if (!category || !quantity || quantity <= 0) {
      return null;
    }
    return calculateCo2Preview(quantity, unit, category, title);
  }, [category, quantity, unit, title]);

  if (!co2Estimate) {
    return null;
  }

  const formattedValue = co2Estimate >= 1 ? co2Estimate.toFixed(1) : co2Estimate.toFixed(2);

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-success/10 border border-success/20">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
        <Leaf className="h-5 w-5 text-success" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">
          Estimated CO₂ Reduced: <span className="text-success">{formattedValue} kg</span>
        </p>
        <p className="text-xs text-muted-foreground">
          By sharing this food, you're helping reduce emissions from food waste
        </p>
      </div>
    </div>
  );
}
