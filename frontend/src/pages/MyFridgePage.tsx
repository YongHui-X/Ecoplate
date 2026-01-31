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
} from "lucide-react";
import { cn } from "../lib/utils";
import { formatCO2, getCO2ColorClass, calculateTotalCO2 } from "../utils/co2Utils";

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
  category: string;
  unitPrice: number;
  co2Emission: number;
  confidence: "high" | "medium" | "low";
  interactionId?: number; // Added after confirm-ingredients
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">MyFridge</h1>
          <p className="text-gray-600">Manage your food inventory</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowScanModal(true)}>
            <Camera className="h-4 w-4 mr-2" />
            Scan Receipt
          </Button>
          <Button variant="outline" onClick={() => setShowTrackConsumption(true)}>
            <UtensilsCrossed className="h-4 w-4 mr-2" />
            Track Consumption
          </Button>
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Pending Consumptions Banner */}
      {pendingConsumptions.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="font-medium text-yellow-800">
                  {pendingConsumptions.length} pending consumption{pendingConsumptions.length > 1 ? "s" : ""}
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  You have meals waiting for waste photo. Add them to complete tracking.
                </p>
                <div className="mt-3 space-y-2">
                  {pendingConsumptions.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between bg-white rounded-lg p-2 border border-yellow-200"
                    >
                      <div className="flex items-center gap-3">
                        {record.rawPhoto && (
                          <img
                            src={record.rawPhoto}
                            alt="Meal"
                            className="w-10 h-10 object-cover rounded"
                          />
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            {record.ingredients.length} ingredient{record.ingredients.length !== 1 ? "s" : ""}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(record.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeletePendingConsumption(record.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleResumePendingConsumption(record)}
                        >
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Total CO2 Footprint Summary */}
      {sortedProducts.length > 0 && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <Leaf className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-900">
                    Total Carbon Footprint
                  </p>
                  <p className="text-xs text-green-700">
                    All items in your fridge
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">
                  {calculateTotalCO2(sortedProducts).toFixed(1)} kg
                </p>
                <p className="text-xs text-green-700">CO2 emissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products list */}
      {sortedProducts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500 mb-4">No items in your fridge yet</p>
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
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{product.productName}</h3>
              {product.category && (
                <Badge variant="secondary">{product.category}</Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 flex-wrap">
              <span>Qty: {product.quantity}{product.unit ? ` ${product.unit}` : ''}</span>
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
              <p className="mt-1 text-sm text-gray-500">{product.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSell}
              className="text-green-600 hover:text-green-700"
            >
              <DollarSign className="h-4 w-4 mr-1" />
              Sell
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(product.id)}
            >
              <Trash2 className="h-4 w-4 text-gray-400" />
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
  const [unitPrice, setUnitPrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post("/myfridge/products", {
        productName: name,
        category: category || undefined,
        quantity,
        unitPrice: unitPrice ? parseFloat(unitPrice) : undefined,
        purchaseDate: purchaseDate || undefined,
        description: description || undefined,
      });
      addToast("Product added! +2 points", "success");
      onAdded();
    } catch (error) {
      addToast("Failed to add product", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md">
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
                required
              />
            </div>

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

            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="unitPrice">Unit Price ($)</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Purchase Date</Label>
              <Input
                id="purchaseDate"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
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

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  const camera = useCamera();

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const processBase64 = useCallback(
    async (base64: string) => {
      setScanning(true);
      setShowCamera(false);

      try {
        const response = await api.post<{
          items: Array<{ name: string; quantity: number; category: string; unit: string; unitPrice: number; co2Emission: number }>;
        }>("/myfridge/receipt/scan", { imageBase64: base64 });

        setScannedItems(
          response.items.map((item) => ({
            ...item,
            id: Math.random().toString(36).slice(2),
          }))
        );

        if (response.items.length === 0) {
          addToast("No food items found in receipt", "info");
        }
      } catch {
        addToast("Failed to scan receipt", "error");
      } finally {
        setScanning(false);
      }
    },
    [addToast]
  );

  const SUPPORTED_FORMATS = ["image/png", "image/jpeg", "image/gif", "image/webp"];

  const processFile = async (file: File) => {
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

    processBase64(base64);
  };

  // When user confirms captured photo, process it
  const handleConfirmPhoto = () => {
    if (camera.capturedImage) {
      processBase64(camera.capturedImage);
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

  const removeItem = (id: string) => {
    setScannedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddAll = async () => {
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
        });
        addedCount++;
      }
      const points = addedCount * 2;
      addToast(`Added ${addedCount} items to your fridge! +${points} points`, "success");
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
                <Camera className="h-8 w-8 text-gray-500" />
                <span className="font-medium">Take Photo</span>
                <span className="text-xs text-gray-400">
                  Use your camera to capture a receipt
                </span>
              </Button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              {/* Upload File */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer text-center",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-gray-300 hover:border-gray-400"
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
                <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-600 font-medium text-sm">
                  {isDragging ? "Drop your receipt here" : "Upload from files"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
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
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Scanning receipt...</p>
              <p className="text-sm text-gray-400 mt-1">This may take a few moments</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Found {scannedItems.length} items. Review and edit before adding:
              </p>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {scannedItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-gray-50 rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(item.id, "name", e.target.value)}
                        className="h-8 text-sm font-medium"
                        placeholder="Product name"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">Qty</label>
                        <Input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.id, "quantity", parseFloat(e.target.value) || 1)
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Unit</label>
                        <select
                          value={item.unit}
                          onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
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
                      <div>
                        <label className="text-xs text-gray-500">Price ($)</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)
                          }
                          className="h-8 text-sm"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">Category</label>
                        <select
                          value={item.category}
                          onChange={(e) => updateItem(item.id, "category", e.target.value)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
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
                        <label className="text-xs text-gray-500">CO2 (kg)</label>
                        <Input
                          type="number"
                          value={item.co2Emission}
                          readOnly
                          disabled
                          className="h-8 text-sm bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {scannedItems.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-4">
                  All items removed. Scan another receipt or close.
                </p>
              )}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setScannedItems([])}
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
    category: string;
    co2Emission: number;
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
          id: Math.random().toString(36).slice(2),
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
            }>;
            overallObservation: string;
          };
        }>("/consumption/analyze-waste", {
          imageBase64: base64,
          ingredients: ingredients.map((ing) => ({
            productId: ing.productId,
            productName: ing.name,
            quantityUsed: ing.estimatedQuantity,
            category: ing.category,
            unitPrice: ing.unitPrice,
            co2Emission: ing.co2Emission,
          })),
        });

        console.log("[TrackConsumption] Waste analysis response:", response);

        // Convert waste items to editable format with productId
        const wasteItemsWithIds = response.wasteAnalysis.wasteItems.map((item) => ({
          id: Math.random().toString(36).slice(2),
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantityWasted,
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

  const addIngredient = () => {
    setIngredients((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        productId: 0,
        name: "",
        matchedProductName: "",
        estimatedQuantity: 1,
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
        id: Math.random().toString(36).slice(2),
        productName: "",
        quantity: 1,
        category: "other",
        co2Emission: 0,
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
            stepNumber >= s ? "bg-primary" : "bg-gray-200"
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
          <p className="text-sm text-gray-500">{subtitle}</p>
          <StepIndicator />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full h-auto py-4 flex flex-col items-center gap-2"
              onClick={handleOpenCamera}
            >
              <Camera className="h-8 w-8 text-gray-500" />
              <span className="font-medium">Take Photo</span>
              <span className="text-xs text-gray-400">{cameraLabel}</span>
            </Button>

            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-gray-200" />
              <span className="text-xs text-gray-400">or</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer text-center",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-gray-300 hover:border-gray-400"
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
              <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="text-gray-600 font-medium text-sm">
                {isDragging ? "Drop your photo here" : "Upload from files"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
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
            <CardContent className="p-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Identifying ingredients...</p>
              <p className="text-sm text-gray-400 mt-1">Using AI to analyze your photo</p>
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
            <p className="text-sm text-gray-500">Step 2 of 5 — Confirm your ingredients</p>
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
                <p className="text-sm text-gray-600">
                  {ingredients.length} ingredient{ingredients.length !== 1 ? "s" : ""} added
                </p>
                <Button variant="outline" size="sm" onClick={addIngredient}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {ingredients.map((ing) => (
                  <div key={ing.id} className="p-3 bg-gray-50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={ing.name}
                        onChange={(e) => updateIngredient(ing.id, "name", e.target.value)}
                        className="h-8 text-sm font-medium"
                        placeholder="Ingredient name"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => removeIngredient(ing.id)}
                      >
                        <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">Qty</label>
                        <Input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={ing.estimatedQuantity}
                          onChange={(e) =>
                            updateIngredient(ing.id, "estimatedQuantity", parseFloat(e.target.value) || 0)
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Category</label>
                        <select
                          value={ing.category}
                          onChange={(e) => updateIngredient(ing.id, "category", e.target.value)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
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
                        <label className="text-xs text-gray-500">CO₂ (kg)</label>
                        <Input
                          type="number"
                          value={ing.co2Emission}
                          readOnly
                          disabled
                          className="h-8 text-sm bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRawPhoto(null);
                    setIngredients([]);
                    setStep("raw-input");
                  }}
                  className="flex-1"
                  disabled={confirmingIngredients}
                >
                  Scan Again
                </Button>
                <Button
                  onClick={handleConfirmIngredients}
                  disabled={ingredients.length === 0 || confirmingIngredients}
                  className="flex-1"
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
            <CardContent className="p-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Analyzing waste...</p>
              <p className="text-sm text-gray-400 mt-1">Calculating your sustainability metrics</p>
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
              <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
              <p className="text-gray-600 mb-4">No raw photo found. Please start from the beginning.</p>
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
            <p className="text-sm text-gray-500">Step 3 of 5 — Photo your plate after eating</p>
            <StepIndicator />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Info message about optional waste photo */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  You can add the waste photo later after you finish eating.
                  Tap "Do Later" to save your progress and return anytime.
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full h-auto py-4 flex flex-col items-center gap-2"
                onClick={handleOpenCamera}
              >
                <Camera className="h-8 w-8 text-gray-500" />
                <span className="font-medium">Take Photo</span>
                <span className="text-xs text-gray-400">Capture your plate after eating</span>
              </Button>

              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer text-center",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-gray-300 hover:border-gray-400"
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
                <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-600 font-medium text-sm">
                  {isDragging ? "Drop your photo here" : "Upload from files"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
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
          interactionId: ing.interactionId,
          category: ing.category,
          unitPrice: ing.unitPrice,
          co2Emission: ing.co2Emission,
        })),
        wasteItems: editableWasteItems.map(item => ({
          productId: item.productId || 0,
          productName: item.productName,
          quantityWasted: item.quantity,
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
            <p className="text-sm text-gray-500">Step 4 of 5 — Review and confirm waste</p>
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
                <p className="text-sm text-gray-600">
                  {editableWasteItems.length} waste item{editableWasteItems.length !== 1 ? "s" : ""} detected
                </p>
                <Button variant="outline" size="sm" onClick={addWasteItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {editableWasteItems.map((item) => (
                  <div key={item.id} className="p-3 bg-gray-50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={item.productName}
                        onChange={(e) => updateWasteItem(item.id, "productName", e.target.value)}
                        className="h-8 text-sm font-medium"
                        placeholder="Product name"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => removeWasteItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">Qty Wasted</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateWasteItem(item.id, "quantity", parseFloat(e.target.value) || 0)
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Category</label>
                        <select
                          value={item.category}
                          onChange={(e) => updateWasteItem(item.id, "category", e.target.value)}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
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
                        <label className="text-xs text-gray-500">CO₂ (kg)</label>
                        <Input
                          type="number"
                          value={item.co2Emission}
                          readOnly
                          disabled
                          className="h-8 text-sm bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {editableWasteItems.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-green-600 font-medium">No waste detected - great job!</p>
                  <p className="text-xs text-gray-400 mt-1">You can still add waste items if needed.</p>
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
            <p className="text-sm text-gray-500">Step 5 of 5 — Your sustainability results</p>
            <StepIndicator />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Success Message */}
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Great job tracking your meal!</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Your consumption and waste have been recorded.
                </p>
              </div>

              {/* Waste Metrics Summary Card */}
              {wasteMetrics && (
                <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-800">Sustainability Metrics</h3>
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
                          <p className="text-gray-500">CO2 Saved</p>
                          <p className="font-medium text-green-600">{wasteMetrics.totalCO2Saved.toFixed(2)} kg</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-red-500" />
                        <div>
                          <p className="text-gray-500">CO2 Wasted</p>
                          <p className="font-medium text-red-500">{wasteMetrics.totalCO2Wasted.toFixed(2)} kg</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-orange-500" />
                        <div>
                          <p className="text-gray-500">Economic Waste</p>
                          <p className="font-medium text-orange-500">${wasteMetrics.totalEconomicWaste.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-gray-500">Waste %</p>
                          <p className="font-medium text-blue-500">{wasteMetrics.wastePercentage.toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-green-200 flex justify-between items-center">
                      <span className="text-gray-600">Sustainability Score</span>
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
