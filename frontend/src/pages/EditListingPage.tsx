import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { marketplaceService } from "../services/marketplace";
import { uploadService } from "../services/upload";
import { useToast } from "../contexts/ToastContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import { MARKETPLACE_CATEGORIES } from "../types/marketplace";
import { PRODUCT_UNITS } from "../constants/units";
import { LocationAutocomplete } from "../components/common/LocationAutocomplete";
import { ImagePicker } from "../components/common/ImagePicker";

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    quantity: "1",
    unit: "",
    price: "",
    originalPrice: "",
    expiryDate: "",
    pickupLocation: "",
  });

  const [coordinates, setCoordinates] = useState<
    { latitude: number; longitude: number } | undefined
  >();

  const [imageUrls, setImageUrls] = useState<string[]>([]);

  useEffect(() => {
    loadListing();
  }, [id]);

  const loadListing = async () => {
    try {
      const listing = await marketplaceService.getListing(Number(id));

      // Parse expiry date
      let expiryDateStr = "";
      if (listing.expiryDate) {
        const date = new Date(listing.expiryDate);
        expiryDateStr = date.toISOString().split("T")[0];
      }

      // Parse coordinates from pickupLocation if exists (format: "address|lat,lng")
      let pickupLocationValue = listing.pickupLocation || "";
      if (listing.pickupLocation && listing.pickupLocation.includes("|")) {
        const [address, coords] = listing.pickupLocation.split("|");
        pickupLocationValue = address;
        const [lat, lng] = coords.split(",").map(parseFloat);
        if (!isNaN(lat) && !isNaN(lng)) {
          setCoordinates({ latitude: lat, longitude: lng });
        }
      }

      setFormData({
        title: listing.title,
        description: listing.description || "",
        category: listing.category || "",
        quantity: String(listing.quantity),
        unit: listing.unit || "",
        price: listing.price !== null ? String(listing.price) : "",
        originalPrice: listing.originalPrice
          ? String(listing.originalPrice)
          : "",
        expiryDate: expiryDateStr,
        pickupLocation: pickupLocationValue,
      });

      // Load existing images
      const existingImages = uploadService.parseImages(listing.images);
      setImageUrls(existingImages);
    } catch (error: any) {
      addToast(error.message || "Failed to load listing", "error");
      navigate("/marketplace");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Validate required fields
      if (!formData.title.trim()) {
        addToast("Please enter a title", "error");
        setSaving(false);
        return;
      }

      if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
        addToast("Please enter a valid quantity", "error");
        setSaving(false);
        return;
      }

      // Prepare data
      const data = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        category: formData.category || undefined,
        quantity: parseFloat(formData.quantity),
        unit: formData.unit || undefined,
        price: formData.price && formData.price.trim() !== "" ? parseFloat(formData.price) : null,
        originalPrice: formData.originalPrice && formData.originalPrice.trim() !== ""
          ? parseFloat(formData.originalPrice)
          : undefined,
        expiryDate: formData.expiryDate && formData.expiryDate.trim() !== "" ? formData.expiryDate : undefined,
        pickupLocation: formData.pickupLocation.trim() || undefined,
        coordinates: coordinates,
        images: imageUrls.length > 0 ? imageUrls : undefined,
      };

      await marketplaceService.updateListing(Number(id), data);
      addToast("Listing updated successfully!", "success");
      navigate(`/marketplace/${id}`);
    } catch (error: any) {
      console.error("Failed to update listing:", error);
      addToast(error.message || "Failed to update listing", "error");
    } finally {
      setSaving(false);
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
    <div className="max-w-2xl mx-auto">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate(`/marketplace/${id}`)}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Listing
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Edit Listing</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Fresh Organic Apples"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe your item..."
                rows={4}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Category and Expiry Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full h-10 px-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select a category</option>
                  {MARKETPLACE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  name="expiryDate"
                  type="date"
                  value={formData.expiryDate}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Quantity and Unit */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">
                  Quantity <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.quantity}
                  onChange={handleChange}
                  placeholder="e.g., 2.5"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <select
                  id="unit"
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  className="w-full h-10 px-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select unit (optional)</option>
                  {PRODUCT_UNITS.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-sm text-gray-500 -mt-3">
              Specify the unit of measurement (e.g., kg, bottles, pcs)
            </p>

            {/* Prices */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="originalPrice">Original Price ($)</Label>
                <Input
                  id="originalPrice"
                  name="originalPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.originalPrice}
                  onChange={handleChange}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Selling Price ($)</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="0 for free"
                />
                <p className="text-sm text-gray-500">Leave as 0 for free</p>
              </div>
            </div>

            {/* Pickup Location */}
            <LocationAutocomplete
              value={formData.pickupLocation}
              onChange={(value, coords) => {
                setFormData((prev) => ({ ...prev, pickupLocation: value }));
                setCoordinates(coords);
              }}
              label="Pickup Location"
              placeholder="Search for address, postal code, or landmark in Singapore"
            />

            {/* Product Images */}
            <div className="space-y-2">
              <Label>Product Images</Label>
              <ImagePicker
                maxImages={5}
                onImagesChange={setImageUrls}
                initialImages={imageUrls}
              />
              <p className="text-sm text-gray-500">
                Add up to 5 images. You can take photos or choose from your gallery.
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/marketplace/${id}`)}
                className="flex-1"
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
