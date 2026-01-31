import { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ArrowLeft, ImagePlus, X } from "lucide-react";
import { LocationAutocomplete } from "../components/common/LocationAutocomplete";

interface Product {
  id: number;
  productName: string;
  category: string | null;
  quantity: number;
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
  const [unit, setUnit] = useState("item");
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { addToast } = useToast();

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
      const response = await fetch("/api/v1/marketplace/upload", {
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
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Pre-filled from MyFridge:</strong> {product.productName}
              </p>
              <p className="text-xs text-blue-600 mt-1">
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
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {selectedImages.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center hover:border-primary hover:bg-gray-50 transition-colors"
                  >
                    <ImagePlus className="h-6 w-6 text-gray-400" />
                    <span className="text-xs text-gray-500 mt-1">Add</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500">
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
                  <option value="item">Item</option>
                  <option value="kg">Kg</option>
                  <option value="g">G</option>
                  <option value="l">L</option>
                  <option value="ml">mL</option>
                  <option value="pack">Pack</option>
                </select>
              </div>
            </div>

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
                <p className="text-xs text-gray-500">Leave empty to list as free</p>
              </div>
            </div>

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
