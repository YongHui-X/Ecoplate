import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import { useCamera } from "../hooks/useCamera";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Progress } from "../components/ui/progress";
import {
  Plus,
  Camera,
  Search,
  Trash2,
  X,
  Upload,
  RotateCcw,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  UtensilsCrossed,
  Leaf,
  Check,
  DollarSign,
  TrendingUp,
  Calendar,
  Receipt,
} from "lucide-react";
import { cn } from "../lib/utils";
import { formatCO2, getCO2ColorClass, calculateTotalCO2 } from "../utils/co2Utils";
import { calculateCO2Emission } from "../utils/co2Calculator";
import { PRODUCT_UNITS } from "../constants/units";
import Compressor from "compressorjs";

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

interface IdentifiedIngredient {
  id: string;
  productId: number;
  name: string;
  matchedProductName: string;
  estimatedQuantity: number;
  unit: string | null;
  category: string;
  unitPrice: number;
  co2Emission: number;
  confidence: "high" | "medium" | "low";
  interactionId?: number; // Added after confirm-ingredients
  quantityError?: string;
}


interface PendingConsumptionRecord {
  id: number;
  rawPhoto: string;
  ingredients: IdentifiedIngredient[];
  status: "PENDING_WASTE_PHOTO" | "COMPLETED";
  createdAt: string;
}

export default function MyFridgePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showTrackConsumption, setShowTrackConsumption] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingConsumptions, setPendingConsumptions] = useState<PendingConsumptionRecord[]>([]);
  const [selectedPendingRecord, setSelectedPendingRecord] = useState<PendingConsumptionRecord | null>(null);
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadProducts();
    loadPendingConsumptions();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await api.get<Product[]>("/myfridge/products");
      setProducts(data);
    } catch (error) {
      addToast("Failed to load products", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadPendingConsumptions = async () => {
    try {
      const data = await api.get<PendingConsumptionRecord[]>("/myfridge/consumption/pending");
      setPendingConsumptions(data);
    } catch {
      // Silently fail - pending consumptions are optional
    }
  };

  const handleResumePendingConsumption = (record: PendingConsumptionRecord) => {
    setSelectedPendingRecord(record);
    setShowTrackConsumption(true);
  };

  const handleDeletePendingConsumption = async (id: number) => {
    try {
      await api.delete(`/myfridge/consumption/pending/${id}`);
      setPendingConsumptions((prev) => prev.filter((p) => p.id !== id));
      addToast("Pending record deleted", "success");
    } catch {
      addToast("Failed to delete pending record", "error");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/myfridge/products/${id}`);
      addToast("Product deleted", "success");
      loadProducts();
    } catch (error) {
      addToast("Failed to delete product", "error");
    }
  };

  const filteredProducts = products.filter((p) => {
    return p.productName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Sort by purchase date (most recent first)
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!a.purchaseDate) return 1;
    if (!b.purchaseDate) return -1;
    return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-4 mb-6">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Skeleton className="h-10 w-full sm:w-auto" />
            <Skeleton className="h-10 w-full sm:w-auto" />
            <Skeleton className="h-10 w-full sm:w-auto" />
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-xl border p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-60" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-9 w-9" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">MyFridge</h1>
          <p className="text-sm text-muted-foreground">Manage your food inventory</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setShowScanModal(true)}
          >
            <Camera className="h-4 w-4 mr-2" />
            Scan Receipt
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setShowTrackConsumption(true)}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Track Consumption
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Pending Consumptions Banner */}
      {pendingConsumptions.length > 0 && (
        <Card className="border-warning/20 bg-warning/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="font-medium text-warning">
                  {pendingConsumptions.length} pending consumption{pendingConsumptions.length > 1 ? "s" : ""}
                </h3>
                <p className="text-sm text-warning mt-1">
                  You have meals waiting for waste photo. Add them to complete tracking.
                </p>
                <div className="mt-3 space-y-2">
                  {pendingConsumptions.map((record) => (
                    <div
                      key={record.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card rounded-lg p-3 border border-warning/20"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {record.rawPhoto && (
                          <img
                            src={record.rawPhoto}
                            alt="Meal"
                            className="w-10 h-10 object-cover rounded"
                          />
                        )}
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {record.ingredients.length} ingredient{record.ingredients.length !== 1 ? "s" : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(record.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeletePendingConsumption(record.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 sm:flex-none"
                          onClick={() => handleResumePendingConsumption(record)}
                        >
                          <Camera className="mr-1 h-3 w-3" />
                          Add Photo
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <Input
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Total CO2 Footprint Summary */}
      {sortedProducts.length > 0 && (
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-full">
                  <Leaf className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Total Carbon Footprint
                  </p>
                  <p className="text-xs text-muted-foreground">
                    All items in your fridge
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-2xl font-bold text-primary">
                  {calculateTotalCO2(sortedProducts).toFixed(1)} kg
                </p>
                <p className="text-xs text-muted-foreground">CO2 emissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products list */}
      {sortedProducts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">No items in your fridge yet</p>
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add your first item
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sortedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onDelete={handleDelete}
              onSell={() => navigate("/marketplace/create", { state: { product } })}
            />
          ))}
        </div>
      )}

      {/* Add Product Modal */}
      {showAddForm && (
        <AddProductModal
          onClose={() => setShowAddForm(false)}
          onAdded={() => {
            setShowAddForm(false);
            loadProducts();
          }}
        />
      )}

      {/* Scan Receipt Modal */}
      {showScanModal && (
        <ScanReceiptModal
          onClose={() => setShowScanModal(false)}
          onScanned={() => {
            setShowScanModal(false);
            loadProducts();
          }}
        />
      )}

      {/* Track Consumption Modal */}
      {showTrackConsumption && (
        <TrackConsumptionModal
          onClose={() => {
            setShowTrackConsumption(false);
            setSelectedPendingRecord(null);
          }}
          onComplete={() => {
            setShowTrackConsumption(false);
            setSelectedPendingRecord(null);
            loadProducts();
            loadPendingConsumptions();
          }}
          pendingRecord={selectedPendingRecord}
        />
      )}
    </div>
  );
}

function ProductCard({
  product,
  onDelete,
  onSell,
}: {
  product: Product;
  onDelete: (id: number) => void;
  onSell: () => void;
}) {
  return (
    <Card className="transition-all">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground">{product.productName}</h3>
              {product.category && (
                <Badge variant="secondary">{product.category}</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
              <span>Qty: {parseFloat(product.quantity.toFixed(2))}{product.unit ? ` ${product.unit}` : ''}</span>
              {product.unitPrice != null && (
                <span>${product.unitPrice.toFixed(2)}</span>
              )}
              {product.co2Emission != null && (
                <span className={cn("flex items-center gap-1", getCO2ColorClass(product.co2Emission))}>
                  <Leaf className="h-3 w-3" />
                  {formatCO2(product.co2Emission)}
                </span>
              )}
              {product.purchaseDate && (
                <span>
                  Purchased: {new Date(product.purchaseDate).toLocaleDateString()}
                </span>
              )}
            </div>
            {product.description && (
              <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
            )}
          </div>

          <div className="flex gap-2 sm:self-start">
            <Button
              variant="outline"
              size="sm"
              onClick={onSell}
              className="flex-1 sm:flex-none text-primary hover:text-primary/90"
            >
              <DollarSign className="h-4 w-4 mr-1" />
              Sell
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(product.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AddProductModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [quantityError, setQuantityError] = useState<string>("");
  const { addToast } = useToast();

  const validateQuantity = (value: number): boolean => {
    const MAX_QUANTITY = 99999; // Reasonable maximum

    if (isNaN(value) || value <= 0) {
      setQuantityError("Quantity must be greater than 0");
      return false;
    }

    if (value > MAX_QUANTITY) {
      setQuantityError(`Quantity cannot exceed ${MAX_QUANTITY.toLocaleString()}`);
      return false;
    }

    setQuantityError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate quantity before submission
    if (!validateQuantity(quantity)) {
      return;
    }

    setLoading(true);

    try {
      // Calculate CO2 before submitting
      const calculatedCO2 = calculateCO2Emission(name, category || "other");
      console.log(`[AddProduct] Calculated CO2 for "${name}" (${category || "other"}): ${calculatedCO2} kg`);

      await api.post("/myfridge/products", {
        productName: name,
        category: category || undefined,
        quantity,
        unit: unit || undefined,
        unitPrice: unitPrice ? parseFloat(unitPrice) : undefined,
        purchaseDate: purchaseDate || undefined,
        description: description || undefined,
        co2Emission: calculatedCO2,
      });
      addToast("Product added!", "success");
      onAdded();
    } catch (error) {
      addToast("Failed to add product", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Add Product
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chicken Breast"
                className="h-11"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-11 rounded-md border border-input bg-background px-3"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0.1"
                  max="99999"
                  step="0.1"
                  value={quantity}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setQuantity(value);
                    validateQuantity(value);
                  }}
                  className={`h-11 ${quantityError ? 'border-red-500' : ''}`}
                  required
                />
                {quantityError && (
                  <p className="text-sm text-red-500 mt-1">{quantityError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit *</Label>
                <select
                  id="unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full h-11 rounded-md border border-input bg-background px-3"
                  required
                >
                  <option value="">Select...</option>
                  {PRODUCT_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitPrice">Unit Price ($)</Label>
              <Input
                id="unitPrice"
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Purchase Date</Label>
              <Input
                id="purchaseDate"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes about this product"
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="w-full sm:flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="w-full sm:flex-1">
                {loading ? "Adding..." : "Add Product"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

interface ScannedItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  category: string;
  co2Emission: number;
  quantityError?: string;
}

function ScanReceiptModal({
  onClose,
  onScanned,
}: {
  onClose: () => void;
  onScanned: () => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().split("T")[0] // Today in YYYY-MM-DD format
  );
  const [scanError, setScanError] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualItem, setManualItem] = useState({
    name: "",
    quantity: 1,
    unit: "pcs",
    category: "other",
    unitPrice: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  const camera = useCamera();

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const processBase64 = useCallback(
    async (base64: string) => {
      console.log("[ProcessReceipt] processBase64 called with base64 length:", base64?.length || 0);

      // Validate input
      if (!base64 || base64.trim() === "") {
        console.error("[ProcessReceipt] Invalid base64 input");
        addToast("Invalid image data. Please try again.", "error");
        setScanError("Invalid image data");
        return;
      }

      // Check if base64 is a valid data URI
      if (!base64.startsWith("data:image/")) {
        console.error("[ProcessReceipt] base64 is not a valid data URI:", base64.substring(0, 50));
        addToast("Invalid image format. Please try again.", "error");
        setScanError("Invalid image format");
        return;
      }

      setScanning(true);
      setShowCamera(false);
      const startTime = Date.now();
      console.log("[ProcessReceipt] Starting API call to /myfridge/receipt/scan");

      try {
        const response = await api.post<{
          items: Array<{ name: string; quantity: number; category: string; unit: string; unitPrice: number; co2Emission: number }>;
        }>("/myfridge/receipt/scan", { imageBase64: base64 });

        console.log("[ProcessReceipt] API response received, items count:", response.items?.length || 0);

        setScannedItems(
          response.items.map((item) => ({
            ...item,
            id: crypto.randomUUID(),
          }))
        );

        // Don't show toast - let the empty state UI handle it
        if (response.items.length === 0) {
          console.log("[ScanReceipt] No items found in receipt");
        } else {
          console.log("[ProcessReceipt] Successfully processed items:", response.items.length);
        }
      } catch (error) {
        console.error("[ProcessReceipt] Error during scan:", error);
        const message = error instanceof Error
          ? error.message
          : "Failed to analyze receipt. Please check image clarity.";
        addToast(message, "error");
        setScanError(message);
        // Keep preview visible - don't clear capturedPreview
      } finally {
        // Ensure loading screen shows for at least 800ms
        const elapsedTime = Date.now() - startTime;
        const minLoadingTime = 800;
        const remainingTime = Math.max(0, minLoadingTime - elapsedTime);

        if (remainingTime > 0) {
          console.log(`[ProcessReceipt] Waiting ${remainingTime}ms to show loading feedback`);
          await new Promise(resolve => setTimeout(resolve, remainingTime));
        }

        setScanning(false);
        console.log("[ProcessReceipt] Scan completed, scanning state set to false");
      }
    },
    [addToast]
  );

  const SUPPORTED_FORMATS = ["image/png", "image/jpeg", "image/gif", "image/webp"];

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      new Compressor(file, {
        quality: 0.7,           // 70% quality
        maxWidth: 1920,         // Max width in pixels
        maxHeight: 1920,        // Max height in pixels
        mimeType: "image/jpeg", // Convert to JPEG for better compression
        success: (result) => {
          const compressedFile = new File(
            [result],
            file.name.replace(/\.\w+$/, ".jpg"),
            { type: "image/jpeg" }
          );

          // Show compression stats
          const originalSize = (file.size / 1024 / 1024).toFixed(2);
          const compressedSize = (compressedFile.size / 1024 / 1024).toFixed(2);
          console.log(`[Compression] ${originalSize}MB → ${compressedSize}MB`);

          resolve(compressedFile);
        },
        error: (err) => {
          console.error("[Compression] Failed:", err);
          // If compression fails, use original
          resolve(file);
        },
      });
    });
  };

  const processFile = async (file: File) => {
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      addToast("Unsupported format. Please use PNG, JPEG, GIF, or WebP.", "error");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      addToast("Image is too large. Maximum size is 10MB.", "error");
      return;
    }

    // Compress image before converting to base64
    const compressedFile = await compressImage(file);

    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(compressedFile); // Use compressed file
    });

    // Show preview instead of processing immediately
    setCapturedPreview(base64);
    setShowPreview(true);
  };

  // When user confirms captured photo, show preview
  const handleConfirmPhoto = () => {
    if (camera.capturedImage) {
      setCapturedPreview(camera.capturedImage);
      setShowPreview(true);
      camera.stopCamera();
    }
  };

  const handleOpenCamera = () => {
    setShowCamera(true);
    camera.startCamera();
  };

  const handleCloseCamera = () => {
    camera.stopCamera();
    setShowCamera(false);
  };

  const updateItem = (id: string, field: keyof ScannedItem, value: string | number) => {
    setScannedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addManualItem = () => {
    if (!manualItem.name.trim()) {
      addToast("Please enter item name", "error");
      return;
    }

    const calculatedCO2 = calculateCO2Emission(manualItem.name, manualItem.category);
    console.log(`[ManualItem] Calculated CO2 for "${manualItem.name}" (${manualItem.category}): ${calculatedCO2} kg`);

    const newItem: ScannedItem = {
      id: Math.random().toString(36).slice(2),
      name: manualItem.name,
      quantity: manualItem.quantity,
      unit: manualItem.unit,
      category: manualItem.category,
      unitPrice: manualItem.unitPrice,
      co2Emission: calculatedCO2,
    };

    setScannedItems((prev) => [...prev, newItem]);

    // Reset form
    setManualItem({
      name: "",
      quantity: 1,
      unit: "pcs",
      category: "other",
      unitPrice: 0,
    });
    setShowManualEntry(false);

    addToast("Item added manually", "success");
  };

  const removeItem = (id: string) => {
    setScannedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const validateItemQuantity = (id: string, value: number): boolean => {
    const MAX_QUANTITY = 99999;
    let error = "";

    if (isNaN(value) || value <= 0) {
      error = "Must be > 0";
    } else if (value > MAX_QUANTITY) {
      error = `Max ${MAX_QUANTITY.toLocaleString()}`;
    }

    setScannedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantityError: error } : item))
    );

    return error === "";
  };

  const handleAddAll = async () => {
    // Validate all items first
    let hasErrors = false;
    scannedItems.forEach(item => {
      if (!validateItemQuantity(item.id, item.quantity)) {
        hasErrors = true;
      }
    });

    if (hasErrors) {
      addToast("Please fix quantity errors before adding items", "error");
      return;
    }

    setScanning(true);
    let addedCount = 0;
    try {
      for (const item of scannedItems) {
        await api.post("/myfridge/products", {
          productName: item.name,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          unitPrice: item.unitPrice || undefined,
          co2Emission: item.co2Emission,
          purchaseDate: purchaseDate,
        });
        addedCount++;
      }
      addToast(`Added ${addedCount} items to your fridge!`, "success");
      onScanned();
    } catch {
      if (addedCount > 0) {
        addToast(
          `Added ${addedCount} of ${scannedItems.length} items. Some failed.`,
          "error"
        );
      } else {
        addToast("Failed to add items", "error");
      }
    } finally {
      setScanning(false);
    }
  };

  // --- Camera View ---
  if (showCamera) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col z-50">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-black/80">
          <h2 className="text-white font-semibold">Take Photo</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCloseCamera}
            className="text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Camera error */}
        {camera.error && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-red-400 mb-4" />
              <p className="text-white mb-4">{camera.error}</p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={handleCloseCamera}
                  className="border-white/30 text-white hover:bg-white/10"
                >
                  Go Back
                </Button>
                <Button
                  onClick={() => {
                    camera.clearError();
                    camera.startCamera();
                  }}
                  className="bg-white text-black hover:bg-gray-200"
                >
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Web: Live webcam preview (video always mounted so ref is available) */}
        {!camera.capturedImage && !camera.error && (
          <>
            <div className="flex-1 flex items-center justify-center bg-black overflow-hidden relative">
              <video
                ref={camera.videoRef}
                autoPlay
                playsInline
                muted
                className="max-w-full max-h-full object-contain"
              />
              {/* Loading overlay */}
              {camera.isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4" />
                    <p className="text-white">Opening camera...</p>
                  </div>
                </div>
              )}
            </div>
            {camera.isStreaming && (
              <div className="p-6 bg-black/80 flex justify-center">
                <button
                  onClick={camera.capture}
                  className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 transition-colors"
                  aria-label="Take photo"
                />
              </div>
            )}
          </>
        )}

        {/* Preview: Captured image (both native and web) */}
        {camera.capturedImage && (
          <>
            <div className="flex-1 flex items-center justify-center bg-black overflow-hidden p-4">
              <img
                src={camera.capturedImage}
                alt="Captured receipt"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
            <div className="p-4 bg-black/80 flex gap-3 justify-center">
              <Button
                onClick={camera.retake}
                className="flex-1 max-w-[160px] bg-white text-black hover:bg-gray-200"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Retake
              </Button>
              <Button
                onClick={handleConfirmPhoto}
                className="flex-1 max-w-[160px] bg-white text-black hover:bg-gray-200"
              >
                <Check className="h-4 w-4 mr-2" />
                Confirm
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  // --- Preview Screen ---
  if (showPreview && capturedPreview) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[85vh] flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              Review Photo
              <Button variant="ghost" size="icon" onClick={() => {
                setShowPreview(false);
                setCapturedPreview(null);
                setScanError(null);
              }}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-hidden">
            {/* Image Preview */}
            <div className="flex-1 overflow-auto bg-muted rounded-lg mb-4 flex items-center justify-center">
              <img
                src={capturedPreview}
                alt="Receipt preview"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>

            {/* Quality Hints */}
            <div className="space-y-2 mb-4">
              <p className="text-sm font-medium">Photo Quality Tips:</p>
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-start gap-2">
                  <Check className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                  <span>Receipt is clear and readable</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                  <span>All items are visible</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                  <span>Good lighting, no shadows</span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {scanError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-700">
                    <p className="font-medium">Scan Failed</p>
                    <p className="text-xs mt-0.5">{scanError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  console.log("[ProcessReceipt] Retake button clicked");
                  setShowPreview(false);
                  setCapturedPreview(null);
                  setScanError(null);
                  setShowCamera(true);
                  camera.startCamera();
                }}
                className="flex-1"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {scanError ? "Retake Photo" : "Retake"}
              </Button>
              <Button
                onClick={() => {
                  console.log("[ProcessReceipt] Button clicked, capturedPreview:", capturedPreview ? "valid" : "null");

                  if (!capturedPreview) {
                    console.error("[ProcessReceipt] capturedPreview is null, cannot process");
                    addToast("No image to process. Please retake photo.", "error");
                    return;
                  }

                  setScanError(null);
                  setShowPreview(false); // Close preview immediately to show loading screen
                  processBase64(capturedPreview);
                }}
                disabled={scanning}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                {scanError ? "Retry" : "Process Receipt"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Main Modal ---
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[80vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Scan Receipt
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scannedItems.length === 0 && !scanning ? (
            <div className="space-y-4">
              {/* Take Photo */}
              <Button
                variant="outline"
                className="w-full h-auto py-4 flex flex-col items-center gap-2"
                onClick={handleOpenCamera}
              >
                <Camera className="h-8 w-8 text-primary" />
                <span className="font-medium text-foreground">Take Photo</span>
                <span className="text-xs text-muted-foreground">
                  Use your camera to capture a receipt
                </span>
              </Button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 border-t border-border" />
              </div>

              {/* Upload File */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer text-center",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/30 hover:border-primary/50"
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) processFile(file);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="text-foreground font-medium text-sm">
                  {isDragging ? "Drop your receipt here" : "Upload from files"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Drag and drop, or click to browse
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processFile(file);
                }}
                className="hidden"
              />
            </div>
          ) : scanning && scannedItems.length === 0 ? (
            <div className="py-12 space-y-6">
              {/* Icon and message */}
              <div className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className="relative">
                    <Receipt className="h-16 w-16 text-primary/30" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-lg">Analyzing Receipt...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Using AI to extract items and prices
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <Progress value={45} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">
                  This usually takes 5-10 seconds
                </p>
              </div>

              {/* Quality reminder */}
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground text-center">
                  💡 For best results, ensure the receipt is clear and well-lit
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Purchase Date Field */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <label className="text-sm font-medium">Purchase Date</label>
                </div>
                <Input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="h-11"
                />
              </div>

              {/* Manual Entry Toggle Button */}
              <div>
                <Button
                  variant="outline"
                  onClick={() => setShowManualEntry(!showManualEntry)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {showManualEntry ? "Cancel Add Item" : "Add Item Manually"}
                </Button>
              </div>

              {/* Manual Entry Form */}
              {showManualEntry && (
                <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Plus className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-medium text-blue-900">Add Item Manually</p>
                  </div>

                  {/* Item Name */}
                  <div>
                    <label className="text-xs text-muted-foreground">Item Name</label>
                    <Input
                      value={manualItem.name}
                      onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
                      placeholder="e.g., Tomatoes, Milk, Bread"
                      className="h-11"
                    />
                  </div>

                  {/* Qty + Unit */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Quantity</label>
                      <Input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={manualItem.quantity}
                        onChange={(e) => setManualItem({ ...manualItem, quantity: parseFloat(e.target.value) || 1 })}
                        className="h-11"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Unit</label>
                      <select
                        value={manualItem.unit}
                        onChange={(e) => setManualItem({ ...manualItem, unit: e.target.value })}
                        className="w-full h-11 rounded-md border border-input bg-background px-3"
                      >
                        <option value="pcs">pcs</option>
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="L">L</option>
                        <option value="ml">ml</option>
                        <option value="pack">pack</option>
                        <option value="bottle">bottle</option>
                        <option value="can">can</option>
                        <option value="loaf">loaf</option>
                        <option value="dozen">dozen</option>
                      </select>
                    </div>
                  </div>

                  {/* Category + Price */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Category</label>
                      <select
                        value={manualItem.category}
                        onChange={(e) => setManualItem({ ...manualItem, category: e.target.value })}
                        className="w-full h-11 rounded-md border border-input bg-background px-3"
                      >
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
                    <div>
                      <label className="text-xs text-muted-foreground">Price ($)</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={manualItem.unitPrice}
                        onChange={(e) => setManualItem({ ...manualItem, unitPrice: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        className="h-11"
                      />
                    </div>
                  </div>

                  {/* Add Button */}
                  <Button onClick={addManualItem} className="w-full">
                    <Check className="h-4 w-4 mr-2" />
                    Add This Item
                  </Button>
                </div>
              )}

              {/* Item Count */}
              <p className="text-sm text-muted-foreground">
                Found {scannedItems.length} items. Review and edit before adding:
              </p>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {scannedItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-muted/50 rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(item.id, "name", e.target.value)}
                        className="h-11 font-medium"
                        placeholder="Product name"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Row 1: Qty + Unit (always 2 columns) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Qty</label>
                        <Input
                          type="number"
                          min="0.1"
                          max="99999"
                          step="0.1"
                          value={item.quantity}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 1;
                            updateItem(item.id, "quantity", value);
                            validateItemQuantity(item.id, value);
                          }}
                          className={`h-11 ${item.quantityError ? 'border-red-500' : ''}`}
                        />
                        {item.quantityError && (
                          <p className="text-xs text-red-500 mt-0.5">{item.quantityError}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Unit</label>
                        <select
                          value={item.unit}
                          onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                          className="w-full h-11 rounded-md border border-input bg-background px-3"
                        >
                          <option value="pcs">pcs</option>
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="L">L</option>
                          <option value="ml">ml</option>
                          <option value="pack">pack</option>
                          <option value="bottle">bottle</option>
                          <option value="can">can</option>
                          <option value="loaf">loaf</option>
                          <option value="dozen">dozen</option>
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Category + CO2 (always 2 columns) */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Category</label>
                        <select
                          value={item.category}
                          onChange={(e) => updateItem(item.id, "category", e.target.value)}
                          className="w-full h-11 rounded-md border border-input bg-background px-3"
                        >
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
                      <div>
                        <label className="text-xs text-muted-foreground">CO2 (kg)</label>
                        <Input
                          type="number"
                          value={item.co2Emission}
                          readOnly
                          disabled
                          className="h-11 bg-muted"
                        />
                      </div>
                    </div>

                    {/* Row 3: Price (full width, optional styling) */}
                    <div>
                      <label className="text-xs text-muted-foreground">Price (optional)</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)
                        }
                        className="h-11"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {scannedItems.length === 0 && !scanning && (
                <div className="text-center py-8 space-y-4">
                  <div className="flex justify-center">
                    <div className="bg-muted rounded-full p-4">
                      <Receipt className="h-12 w-12 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium">No Items Found</p>
                    <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
                      The receipt might be unclear or contain no food items
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 max-w-[200px] mx-auto">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setScannedItems([]);
                        setPurchaseDate(new Date().toISOString().split("T")[0]);
                      }}
                      className="w-full"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        onClose();
                      }}
                      className="w-full"
                    >
                      Add Manually
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setScannedItems([]);
                    setPurchaseDate(new Date().toISOString().split("T")[0]);
                  }}
                  className="flex-1"
                >
                  Scan Again
                </Button>
                <Button
                  onClick={handleAddAll}
                  disabled={scanning || scannedItems.length === 0}
                  className="flex-1"
                >
                  {scanning ? "Adding..." : `Add ${scannedItems.length} Items`}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type TrackConsumptionStep = "raw-input" | "raw-review" | "waste-input" | "waste-review" | "metrics";

function TrackConsumptionModal({
  onClose,
  onComplete,
  pendingRecord,
}: {
  onClose: () => void;
  onComplete: () => void;
  pendingRecord?: PendingConsumptionRecord | null;
}) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const camera = useCamera();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // If resuming a pending record, start at waste-input step
  const [step, setStep] = useState<TrackConsumptionStep>(
    pendingRecord ? "waste-input" : "raw-input"
  );
  const [rawPhoto, setRawPhoto] = useState<string | null>(pendingRecord?.rawPhoto || null);
  const [wastePhoto, setWastePhoto] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<IdentifiedIngredient[]>(
    pendingRecord?.ingredients || []
  );
  const [showCamera, setShowCamera] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [identifyingIngredients, setIdentifyingIngredients] = useState(false);
  const [pendingRecordId, setPendingRecordId] = useState<number | undefined>(pendingRecord?.id);
  const [editableWasteItems, setEditableWasteItems] = useState<Array<{
    id: string;
    productId?: number;
    productName: string;
    quantity: number;
    unit: string | null;
    category: string;
    co2Emission: number;
    quantityError?: string;
  }>>([]);

  const SUPPORTED_FORMATS = ["image/png", "image/jpeg", "image/gif", "image/webp"];
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const [confirmingIngredients, setConfirmingIngredients] = useState(false);
  const [confirmingWaste, setConfirmingWaste] = useState(false);

  const stepNumber = step === "raw-input" ? 1 : step === "raw-review" ? 2 : step === "waste-input" ? 3 : step === "waste-review" ? 4 : 5;

  // Guard: waste steps require rawPhoto
  useEffect(() => {
    if ((step === "waste-input" || step === "waste-review") && !rawPhoto) {
      setStep("raw-input");
    }
  }, [step, rawPhoto]);

  const handleClose = () => {
    if (rawPhoto) {
      if (!confirm("Are you sure you want to close? Your progress will be lost.")) return;
    }
    camera.stopCamera();
    onClose();
  };

  const processFile = async (file: File, handler: (base64: string) => void) => {
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      addToast("Unsupported format. Please use PNG, JPEG, GIF, or WebP.", "error");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      addToast("Image is too large. Maximum size is 10MB.", "error");
      return;
    }
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    handler(base64);
  };

  // --- Raw Photo Processing - calls backend API to identify ingredients ---
  const processRawPhoto = useCallback(
    async (base64: string) => {
      setRawPhoto(base64);
      setShowCamera(false);
      setIdentifyingIngredients(true);

      try {
        console.log("[TrackConsumption] Calling /consumption/identify...");
        const response = await api.post<{
          ingredients: Array<{
            productId: number;
            name: string;
            matchedProductName: string;
            estimatedQuantity: number;
            unit: string | null;
            category: string;
            unitPrice: number;
            co2Emission: number;
            confidence: "high" | "medium" | "low";
          }>;
        }>("/consumption/identify", { imageBase64: base64 });

        console.log("[TrackConsumption] Response received:", response);

        // Add unique IDs to each ingredient for React keys
        const ingredientsWithIds = response.ingredients.map((ing) => ({
          ...ing,
          id: crypto.randomUUID(),
        }));

        setIngredients(ingredientsWithIds);
        console.log("[TrackConsumption] Ingredients set:", ingredientsWithIds.length);

        if (response.ingredients.length === 0) {
          addToast("No ingredients identified in the image. You can add them manually.", "info");
        }
      } catch (err) {
        console.error("[TrackConsumption] Error identifying ingredients:", err);
        addToast("Failed to identify ingredients. You can add them manually.", "error");
      } finally {
        setIdentifyingIngredients(false);
        setStep("raw-review");
      }
    },
    [addToast]
  );

  // --- Waste Photo Processing - calls backend API to analyze waste ---
  const [analyzingWaste, setAnalyzingWaste] = useState(false);
  const [wasteMetrics, setWasteMetrics] = useState<{
    totalCO2Wasted: number;
    totalCO2Saved: number;
    totalEconomicWaste: number;
    wastePercentage: number;
    sustainabilityScore: number;
    sustainabilityRating: string;
  } | null>(null);

  const processWastePhoto = useCallback(
    async (base64: string) => {
      setWastePhoto(base64);
      setShowCamera(false);
      setAnalyzingWaste(true);

      try {
        console.log("[TrackConsumption] Calling /consumption/analyze-waste...");
        const response = await api.post<{
          wasteAnalysis: {
            wasteItems: Array<{
              productName: string;
              quantityWasted: number;
              productId: number;
              unit?: string | null;
            }>;
            overallObservation: string;
          };
        }>("/consumption/analyze-waste", {
          imageBase64: base64,
          ingredients: ingredients.map((ing) => ({
            productId: ing.productId,
            productName: ing.name,
            quantityUsed: ing.estimatedQuantity,
            unit: ing.unit,
            category: ing.category,
            unitPrice: ing.unitPrice,
            co2Emission: ing.co2Emission,
          })),
        });

        console.log("[TrackConsumption] Waste analysis response:", response);

        // Convert waste items to editable format with productId
        const wasteItemsWithIds = response.wasteAnalysis.wasteItems.map((item) => ({
          id: crypto.randomUUID(),
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantityWasted,
          unit: item.unit || ingredients.find((i) => i.productId === item.productId)?.unit || null,
          category: ingredients.find((i) => i.productId === item.productId)?.category || "other",
          co2Emission: ingredients.find((i) => i.productId === item.productId)?.co2Emission || 0,
        }));

        setEditableWasteItems(wasteItemsWithIds);

        if (response.wasteAnalysis.wasteItems.length === 0) {
          addToast("No waste detected - great job!", "success");
        }
      } catch (err) {
        console.error("[TrackConsumption] Error analyzing waste:", err);
        addToast("Failed to analyze waste. You can add items manually.", "error");
      } finally {
        setAnalyzingWaste(false);
        setStep("waste-review");
      }
    },
    [ingredients, addToast]
  );

  const handleConfirmPhoto = () => {
    if (!camera.capturedImage) return;
    const handler = step === "raw-input" ? processRawPhoto : processWastePhoto;
    handler(camera.capturedImage);
    camera.stopCamera();
  };

  const handleOpenCamera = () => {
    setShowCamera(true);
    camera.startCamera();
  };

  const handleCloseCamera = () => {
    camera.stopCamera();
    setShowCamera(false);
  };

  const updateIngredient = (id: string, field: keyof IdentifiedIngredient, value: string | number) => {
    setIngredients((prev) =>
      prev.map((ing) => (ing.id === id ? { ...ing, [field]: value } : ing))
    );
  };

  const removeIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((ing) => ing.id !== id));
  };

  const validateIngredientQuantity = (id: string, value: number): boolean => {
    const MAX_QUANTITY = 99999;
    let error = "";

    if (isNaN(value) || value <= 0) {
      error = "Must be > 0";
    } else if (value > MAX_QUANTITY) {
      error = `Max ${MAX_QUANTITY.toLocaleString()}`;
    }

    setIngredients((prev) =>
      prev.map((ing) => (ing.id === id ? { ...ing, quantityError: error } : ing))
    );

    return error === "";
  };

  const validateWasteQuantity = (id: string, value: number): boolean => {
    const MAX_QUANTITY = 99999;
    let error = "";

    if (isNaN(value) || value <= 0) {
      error = "Must be > 0";
    } else if (value > MAX_QUANTITY) {
      error = `Max ${MAX_QUANTITY.toLocaleString()}`;
    }

    setEditableWasteItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantityError: error } : item))
    );

    return error === "";
  };

  const addIngredient = () => {
    setIngredients((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productId: 0,
        name: "",
        matchedProductName: "",
        estimatedQuantity: 1,
        unit: null,
        category: "other",
        unitPrice: 0,
        co2Emission: 0,
        confidence: "low" as const,
      },
    ]);
  };

  const updateWasteItem = (id: string, field: string, value: string | number) => {
    setEditableWasteItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeWasteItem = (id: string) => {
    setEditableWasteItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addWasteItem = () => {
    setEditableWasteItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productName: "",
        quantity: 1,
        unit: null,
        category: "other",
        co2Emission: 0,
        quantityError: undefined,
      },
    ]);
  };

  const handleDoLater = async () => {
    if (!rawPhoto) {
      addToast("No raw photo to save", "error");
      return;
    }

    setSavingDraft(true);
    try {
      // Save draft consumption record with PENDING_WASTE_PHOTO status
      const draftData = {
        rawPhoto,
        ingredients,
        status: "PENDING_WASTE_PHOTO",
      };

      if (pendingRecordId) {
        // Update existing pending record
        await api.put(`/myfridge/consumption/pending/${pendingRecordId}`, draftData);
      } else {
        // Create new pending record
        const response = await api.post<{ id: number }>("/myfridge/consumption/pending", draftData);
        setPendingRecordId(response.id);
      }

      addToast("Saved! You can add waste photo later.", "success");
      onComplete();
      navigate("/");
    } catch (error) {
      addToast("Failed to save draft", "error");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleDone = async () => {
    // Pending record is already deleted in confirm-waste endpoint
    addToast("Consumption tracked successfully!", "success");
    onComplete();
  };

  // --- Camera View (shared for raw + waste) ---
  if (showCamera) {
    const cameraTitle = step === "raw-input" ? "Photo of Ingredients" : "Photo of Leftovers";
    return (
      <div className="fixed inset-0 bg-black flex flex-col z-50">
        <div className="flex items-center justify-between p-4 bg-black/80">
          <h2 className="text-white font-semibold">{cameraTitle}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCloseCamera}
            className="text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {camera.error && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-red-400 mb-4" />
              <p className="text-white mb-4">{camera.error}</p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={handleCloseCamera}
                  className="border-white/30 text-white hover:bg-white/10"
                >
                  Go Back
                </Button>
                <Button
                  onClick={() => {
                    camera.clearError();
                    camera.startCamera();
                  }}
                  className="bg-white text-black hover:bg-gray-200"
                >
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        )}

        {!camera.capturedImage && !camera.error && (
          <>
            <div className="flex-1 flex items-center justify-center bg-black overflow-hidden relative">
              <video
                ref={camera.videoRef}
                autoPlay
                playsInline
                muted
                className="max-w-full max-h-full object-contain"
              />
              {camera.isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4" />
                    <p className="text-white">Opening camera...</p>
                  </div>
                </div>
              )}
            </div>
            {camera.isStreaming && (
              <div className="p-6 bg-black/80 flex justify-center">
                <button
                  onClick={camera.capture}
                  className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 transition-colors"
                  aria-label="Take photo"
                />
              </div>
            )}
          </>
        )}

        {camera.capturedImage && (
          <>
            <div className="flex-1 flex items-center justify-center bg-black overflow-hidden p-4">
              <img
                src={camera.capturedImage}
                alt="Captured photo"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
            <div className="p-4 bg-black/80 flex gap-3 justify-center">
              <Button
                onClick={camera.retake}
                className="flex-1 max-w-[160px] bg-white text-black hover:bg-gray-200"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Retake
              </Button>
              <Button
                onClick={handleConfirmPhoto}
                className="flex-1 max-w-[160px] bg-white text-black hover:bg-gray-200"
              >
                <Check className="h-4 w-4 mr-2" />
                Confirm
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  // --- Step Progress Bar ---
  const StepIndicator = () => (
    <div className="flex items-center gap-2 mt-2">
      {[1, 2, 3, 4, 5].map((s) => (
        <div
          key={s}
          className={cn(
            "h-2 flex-1 rounded-full",
            stepNumber >= s ? "bg-primary" : "bg-border"
          )}
        />
      ))}
    </div>
  );

  // --- Photo Input UI (shared for raw + waste) ---
  const PhotoInputView = ({
    title,
    subtitle,
    cameraLabel,
    onFileProcess,
    backButton,
  }: {
    title: string;
    subtitle: string;
    cameraLabel: string;
    onFileProcess: (base64: string) => void;
    backButton?: React.ReactNode;
  }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[80vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {title}
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
          <StepIndicator />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full h-auto py-4 flex flex-col items-center gap-2"
              onClick={handleOpenCamera}
            >
              <Camera className="h-8 w-8 text-primary" />
              <span className="font-medium text-foreground">Take Photo</span>
              <span className="text-xs text-muted-foreground">{cameraLabel}</span>
            </Button>

            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 border-t border-border" />
            </div>

            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer text-center",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/30 hover:border-primary/50"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) processFile(file, onFileProcess);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="text-foreground font-medium text-sm">
                {isDragging ? "Drop your photo here" : "Upload from files"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Drag and drop, or click to browse
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processFile(file, onFileProcess);
              }}
              className="hidden"
            />

            {backButton}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // --- PAGE 1: Raw Photo Input ---
  if (step === "raw-input") {
    // Show loading while identifying ingredients
    if (identifyingIngredients) {
      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md">
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-20 w-full rounded-lg" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-6 w-32" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Skeleton className="h-11 w-full" />
                    <Skeleton className="h-11 w-full" />
                    <Skeleton className="h-11 w-full" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <PhotoInputView
        title="Track Consumption"
        subtitle="Step 1 of 5 — Capture raw ingredients"
        cameraLabel="Capture your raw ingredients"
        onFileProcess={processRawPhoto}
      />
    );
  }

  // Handle confirming ingredients (step 2 -> step 3)
  const handleConfirmIngredients = async () => {
    // Validate all ingredients first
    let hasErrors = false;
    ingredients.forEach(ing => {
      if (!validateIngredientQuantity(ing.id, ing.estimatedQuantity)) {
        hasErrors = true;
      }
    });

    if (hasErrors) {
      addToast("Please fix quantity errors", "error");
      return;
    }

    setConfirmingIngredients(true);
    try {
      // Create pending record first (if not exists)
      let recordId = pendingRecordId;
      if (!recordId && rawPhoto) {
        const record = await api.post<{ id: number }>("/myfridge/consumption/pending", {
          rawPhoto,
          ingredients,
          status: "PENDING_WASTE_PHOTO",
        });
        recordId = record.id;
        setPendingRecordId(recordId);
      }

      // Confirm ingredients - records Consume interactions and deducts from products
      const response = await api.post<{ interactionIds: number[] }>("/consumption/confirm-ingredients", {
        ingredients: ingredients.map(ing => ({
          productId: ing.productId,
          productName: ing.name,
          quantityUsed: ing.estimatedQuantity,
          unit: ing.unit,
          category: ing.category,
          unitPrice: ing.unitPrice,
          co2Emission: ing.co2Emission,
        })),
        pendingRecordId: recordId,
      });

      // Store interaction IDs in ingredients for later use
      setIngredients(prev => prev.map((ing, i) => ({
        ...ing,
        interactionId: response.interactionIds[i]
      })));

      if (fileInputRef.current) fileInputRef.current.value = "";
      setStep("waste-input");
    } catch (error) {
      console.error("Failed to confirm ingredients:", error);
      addToast("Failed to confirm ingredients", "error");
    } finally {
      setConfirmingIngredients(false);
    }
  };

  // --- PAGE 2: Review Raw Details ---
  if (step === "raw-review") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[80vh] overflow-y-auto">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Review Ingredients
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
            <p className="text-sm text-muted-foreground">Step 2 of 5 — Confirm your ingredients</p>
            <StepIndicator />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rawPhoto && (
                <img
                  src={rawPhoto}
                  alt="Raw ingredients"
                  className="w-20 h-20 object-cover rounded-lg"
                />
              )}

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {ingredients.length} ingredient{ingredients.length !== 1 ? "s" : ""} added
                </p>
                <Button variant="outline" size="sm" onClick={addIngredient}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {ingredients.map((ing) => (
                  <div key={ing.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={ing.name}
                        onChange={(e) => updateIngredient(ing.id, "name", e.target.value)}
                        className="h-11 font-medium"
                        placeholder="Ingredient name"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeIngredient(ing.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Qty</label>
                        <Input
                          type="number"
                          min="0.1"
                          max="99999"
                          step="0.1"
                          value={ing.estimatedQuantity}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            updateIngredient(ing.id, "estimatedQuantity", value);
                            validateIngredientQuantity(ing.id, value);
                          }}
                          className={`h-11 ${ing.quantityError ? 'border-red-500' : ''}`}
                        />
                        {ing.quantityError && (
                          <p className="text-xs text-red-500 mt-0.5">{ing.quantityError}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Unit</label>
                        <select
                          value={ing.unit || ""}
                          onChange={(e) => updateIngredient(ing.id, "unit", e.target.value || "")}
                          className="w-full h-11 rounded-md border border-input bg-background px-3"
                        >
                          <option value="">Select...</option>
                          <option value="pcs">pcs</option>
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="L">L</option>
                          <option value="ml">ml</option>
                          <option value="pack">pack</option>
                          <option value="bottle">bottle</option>
                          <option value="can">can</option>
                          <option value="loaf">loaf</option>
                          <option value="dozen">dozen</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Category</label>
                        <select
                          value={ing.category}
                          onChange={(e) => updateIngredient(ing.id, "category", e.target.value)}
                          className="w-full h-11 rounded-md border border-input bg-background px-3"
                        >
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
                      <div>
                        <label className="text-xs text-muted-foreground">CO₂ (kg)</label>
                        <Input
                          type="number"
                          value={ing.co2Emission}
                          readOnly
                          disabled
                          className="h-11 bg-muted"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRawPhoto(null);
                    setIngredients([]);
                    setStep("raw-input");
                  }}
                  className="w-full sm:flex-1"
                  disabled={confirmingIngredients}
                >
                  Scan Again
                </Button>
                <Button
                  onClick={handleConfirmIngredients}
                  disabled={ingredients.length === 0 || confirmingIngredients}
                  className="w-full sm:flex-1"
                >
                  {confirmingIngredients ? "Confirming..." : "Next"}
                  {!confirmingIngredients && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- PAGE 3: Waste Photo Input (OPTIONAL) ---
  if (step === "waste-input") {
    // Show loading while analyzing waste
    if (analyzingWaste) {
      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md">
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-20 w-full rounded-lg" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-6 w-32" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Skeleton className="h-11 w-full" />
                    <Skeleton className="h-11 w-full" />
                    <Skeleton className="h-11 w-full" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      );
    }

    // Guard: If no rawPhoto exists, redirect to Page 1
    if (!rawPhoto) {
      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-warning mb-4" />
              <p className="text-muted-foreground mb-4">No raw photo found. Please start from the beginning.</p>
              <Button onClick={() => setStep("raw-input")} className="w-full">
                Start Over
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[80vh] overflow-y-auto">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Capture Leftovers
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
            <p className="text-sm text-muted-foreground">Step 3 of 5 — Photo your plate after eating</p>
            <StepIndicator />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Info message about optional waste photo */}
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                <p className="text-sm text-primary">
                  You can add the waste photo later after you finish eating.
                  Tap "Do Later" to save your progress and return anytime.
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full h-auto py-4 flex flex-col items-center gap-2"
                onClick={handleOpenCamera}
              >
                <Camera className="h-8 w-8 text-primary" />
                <span className="font-medium text-foreground">Take Photo</span>
                <span className="text-xs text-muted-foreground">Capture your plate after eating</span>
              </Button>

              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 border-t border-border" />
              </div>

              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer text-center",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/30 hover:border-primary/50"
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) processFile(file, processWastePhoto);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="text-foreground font-medium text-sm">
                  {isDragging ? "Drop your photo here" : "Upload from files"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Drag and drop, or click to browse
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processFile(file, processWastePhoto);
                }}
                className="hidden"
              />

              {/* Do Later button */}
              <Button
                variant="secondary"
                onClick={handleDoLater}
                disabled={savingDraft}
                className="w-full"
              >
                {savingDraft ? "Saving..." : "Do Later"}
              </Button>

              {/* Back button - only show if not resuming a pending record */}
              {!pendingRecordId && (
                <Button
                  variant="ghost"
                  onClick={() => setStep("raw-review")}
                  className="w-full"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back to ingredients
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle confirming waste (step 4 -> step 5)
  const handleConfirmWaste = async () => {
    // Validate all waste quantities
    let hasErrors = false;
    editableWasteItems.forEach(item => {
      if (!validateWasteQuantity(item.id, item.quantity)) {
        hasErrors = true;
      }
    });

    if (hasErrors) {
      addToast("Please fix quantity errors before confirming", "error");
      return;
    }

    setConfirmingWaste(true);
    try {
      const response = await api.post<{
        metrics: {
          totalCO2Wasted: number;
          totalCO2Saved: number;
          totalEconomicWaste: number;
          wastePercentage: number;
          sustainabilityScore: number;
          sustainabilityRating: string;
        };
        success: boolean;
      }>("/consumption/confirm-waste", {
        ingredients: ingredients.map(ing => ({
          productId: ing.productId,
          productName: ing.name,
          quantityUsed: ing.estimatedQuantity,
          unit: ing.unit,
          interactionId: ing.interactionId,
          category: ing.category,
          unitPrice: ing.unitPrice,
          co2Emission: ing.co2Emission,
        })),
        wasteItems: editableWasteItems.map(item => ({
          productId: item.productId || 0,
          productName: item.productName,
          quantityWasted: item.quantity,
          unit: item.unit,
        })),
        pendingRecordId,
      });

      setWasteMetrics(response.metrics);
      setStep("metrics");
    } catch (error) {
      console.error("Failed to confirm waste:", error);
      addToast("Failed to confirm waste", "error");
    } finally {
      setConfirmingWaste(false);
    }
  };

  // --- PAGE 4: Review Waste Details ---
  if (step === "waste-review") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[80vh] overflow-y-auto">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Review Waste Details
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
            <p className="text-sm text-muted-foreground">Step 4 of 5 — Review and confirm waste</p>
            <StepIndicator />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {wastePhoto && (
                <img
                  src={wastePhoto}
                  alt="Waste photo"
                  className="w-20 h-20 object-cover rounded-lg"
                />
              )}

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {editableWasteItems.length} waste item{editableWasteItems.length !== 1 ? "s" : ""} detected
                </p>
                <Button variant="outline" size="sm" onClick={addWasteItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {editableWasteItems.map((item) => (
                  <div key={item.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={item.productName}
                        onChange={(e) => updateWasteItem(item.id, "productName", e.target.value)}
                        className="h-11 font-medium"
                        placeholder="Product name"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => removeWasteItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted hover:text-red-500" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Qty Wasted</label>
                        <Input
                          type="number"
                          min="0.1"
                          max="99999"
                          step="0.1"
                          value={item.quantity}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            updateWasteItem(item.id, "quantity", value);
                            validateWasteQuantity(item.id, value);
                          }}
                          className={`h-11 ${item.quantityError ? 'border-red-500' : ''}`}
                        />
                        {item.quantityError && (
                          <p className="text-xs text-red-500 mt-0.5">{item.quantityError}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Unit</label>
                        <select
                          value={item.unit || ""}
                          onChange={(e) => updateWasteItem(item.id, "unit", e.target.value || "")}
                          className="w-full h-11 rounded-md border border-input bg-background px-3"
                        >
                          <option value="">Select...</option>
                          <option value="pcs">pcs</option>
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="L">L</option>
                          <option value="ml">ml</option>
                          <option value="pack">pack</option>
                          <option value="bottle">bottle</option>
                          <option value="can">can</option>
                          <option value="loaf">loaf</option>
                          <option value="dozen">dozen</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Category</label>
                        <select
                          value={item.category}
                          onChange={(e) => updateWasteItem(item.id, "category", e.target.value)}
                          className="w-full h-11 rounded-md border border-input bg-background px-3"
                        >
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
                      <div>
                        <label className="text-xs text-muted-foreground">CO₂ (kg)</label>
                        <Input
                          type="number"
                          value={item.co2Emission}
                          readOnly
                          disabled
                          className="h-11 bg-muted"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {editableWasteItems.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-primary font-medium">No waste detected - great job!</p>
                  <p className="text-xs text-muted mt-1">You can still add waste items if needed.</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setWastePhoto(null);
                    setEditableWasteItems([]);
                    setStep("waste-input");
                  }}
                  className="flex-1"
                  disabled={confirmingWaste}
                >
                  Retake
                </Button>
                <Button
                  onClick={handleConfirmWaste}
                  disabled={confirmingWaste}
                  className="flex-1"
                >
                  {confirmingWaste ? "Confirming..." : "Confirm"}
                  {!confirmingWaste && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- PAGE 5: Sustainability Metrics ---
  if (step === "metrics") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[80vh] overflow-y-auto">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Consumption Tracked!
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
            <p className="text-sm text-muted-foreground">Step 5 of 5 — Your sustainability results</p>
            <StepIndicator />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Success Message */}
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Great job tracking your meal!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your consumption and waste have been recorded.
                </p>
              </div>

              {/* Waste Metrics Summary Card */}
              {wasteMetrics && (
                <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-foreground">Sustainability Metrics</h3>
                      <Badge className={cn(
                        "text-white",
                        wasteMetrics.sustainabilityRating === "Excellent" && "bg-green-500",
                        wasteMetrics.sustainabilityRating === "Good" && "bg-blue-500",
                        wasteMetrics.sustainabilityRating === "Moderate" && "bg-yellow-500",
                        wasteMetrics.sustainabilityRating === "Poor" && "bg-orange-500",
                        wasteMetrics.sustainabilityRating === "Critical" && "bg-red-500"
                      )}>
                        {wasteMetrics.sustainabilityRating}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-muted-foreground">CO2 Saved</p>
                          <p className="font-medium text-green-600">{wasteMetrics.totalCO2Saved.toFixed(2)} kg</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-red-500" />
                        <div>
                          <p className="text-muted-foreground">CO2 Wasted</p>
                          <p className="font-medium text-red-500">{wasteMetrics.totalCO2Wasted.toFixed(2)} kg</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-orange-500" />
                        <div>
                          <p className="text-muted-foreground">Economic Waste</p>
                          <p className="font-medium text-orange-500">${wasteMetrics.totalEconomicWaste.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-muted-foreground">Waste %</p>
                          <p className="font-medium text-blue-500">{wasteMetrics.wastePercentage.toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-primary/20 flex justify-between items-center">
                      <span className="text-muted-foreground">Sustainability Score</span>
                      <span className="text-lg font-bold text-green-700">{wasteMetrics.sustainabilityScore}/100</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button onClick={handleDone} className="w-full">
                <Check className="h-4 w-4 mr-2" />
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
