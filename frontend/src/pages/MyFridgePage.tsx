import { useEffect, useState, useRef } from "react";
import { api } from "../services/api";
import { useToast } from "../contexts/ToastContext";
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
  Check,
  Share,
  DollarSign,
  X,
} from "lucide-react";
import { cn, getDaysUntilExpiry, getExpiryStatus } from "../lib/utils";

interface Product {
  id: number;
  name: string;
  category: string | null;
  quantity: number;
  unit: string;
  purchaseDate: string | null;
  expiryDate: string | null;
  storageLocation: string;
  notes: string | null;
}

type ConsumeAction = "consumed" | "wasted" | "shared" | "sold";

export default function MyFridgePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const { addToast } = useToast();

  useEffect(() => {
    loadProducts();
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

  const handleConsume = async (product: Product, action: ConsumeAction) => {
    try {
      await api.post(`/myfridge/products/${product.id}/consume`, {
        action,
        quantity: product.quantity,
      });
      addToast(
        action === "consumed"
          ? "Product consumed! +5 points"
          : action === "shared"
          ? "Product shared! +10 points"
          : action === "sold"
          ? "Product sold! +8 points"
          : "Product logged as wasted. -3 points",
        action === "wasted" ? "error" : "success"
      );
      loadProducts();
    } catch (error) {
      addToast("Failed to update product", "error");
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
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLocation = filterLocation === "all" || p.storageLocation === filterLocation;
    return matchesSearch && matchesLocation;
  });

  // Sort by expiry date (soonest first)
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
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
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          {["all", "fridge", "freezer", "pantry"].map((loc) => (
            <Button
              key={loc}
              variant={filterLocation === loc ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterLocation(loc)}
            >
              {loc.charAt(0).toUpperCase() + loc.slice(1)}
            </Button>
          ))}
        </div>
      </div>

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
              onConsume={handleConsume}
              onDelete={handleDelete}
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
    </div>
  );
}

function ProductCard({
  product,
  onConsume,
  onDelete,
}: {
  product: Product;
  onConsume: (product: Product, action: ConsumeAction) => void;
  onDelete: (id: number) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const status = getExpiryStatus(product.expiryDate);
  const daysUntil = getDaysUntilExpiry(product.expiryDate);

  return (
    <Card
      className={cn(
        "transition-all",
        status === "expired" && "border-red-300 bg-red-50",
        status === "expiring-soon" && "border-yellow-300 bg-yellow-50"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{product.name}</h3>
              {product.category && (
                <Badge variant="secondary">{product.category}</Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
              <span>
                {product.quantity} {product.unit}
              </span>
              <span className="capitalize">{product.storageLocation}</span>
              {product.expiryDate && (
                <span
                  className={cn(
                    status === "expired" && "text-red-600 font-medium",
                    status === "expiring-soon" && "text-yellow-600 font-medium"
                  )}
                >
                  {daysUntil !== null && daysUntil < 0
                    ? `Expired ${Math.abs(daysUntil)} days ago`
                    : daysUntil === 0
                    ? "Expires today"
                    : `Expires in ${daysUntil} days`}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!showActions ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowActions(true)}
                >
                  Actions
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(product.id)}
                >
                  <Trash2 className="h-4 w-4 text-gray-400" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onConsume(product, "consumed")}
                  className="text-green-600"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Consumed
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onConsume(product, "shared")}
                >
                  <Share className="h-4 w-4 mr-1" />
                  Shared
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onConsume(product, "sold")}
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  Sold
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onConsume(product, "wasted")}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Wasted
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowActions(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
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
  const [unit, setUnit] = useState("item");
  const [expiryDate, setExpiryDate] = useState("");
  const [storageLocation, setStorageLocation] = useState("fridge");
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post("/myfridge/products", {
        name,
        category: category || undefined,
        quantity,
        unit,
        expiryDate: expiryDate || undefined,
        storageLocation,
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
      <Card className="w-full max-w-md">
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
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="location">Storage</Label>
                <select
                  id="location"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3"
                >
                  <option value="fridge">Fridge</option>
                  <option value="freezer">Freezer</option>
                  <option value="pantry">Pantry</option>
                </select>
              </div>
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
                </select>
              </div>
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

function ScanReceiptModal({
  onClose,
  onScanned,
}: {
  onClose: () => void;
  onScanned: () => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<
    Array<{ name: string; quantity: number; category: string }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);

    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const response = await api.post<{
        items: Array<{ name: string; quantity: number; category: string }>;
      }>("/myfridge/receipt/scan", { imageBase64: base64 });

      setScannedItems(response.items);
      if (response.items.length === 0) {
        addToast("No food items found in receipt", "info");
      }
    } catch (error) {
      addToast("Failed to scan receipt", "error");
    } finally {
      setScanning(false);
    }
  };

  const handleAddAll = async () => {
    setScanning(true);
    try {
      for (const item of scannedItems) {
        await api.post("/myfridge/products", {
          name: item.name,
          quantity: item.quantity,
          category: item.category,
          storageLocation: "fridge",
        });
      }
      addToast(`Added ${scannedItems.length} items!`, "success");
      onScanned();
    } catch (error) {
      addToast("Failed to add items", "error");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[80vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Scan Receipt
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scannedItems.length === 0 ? (
            <div className="text-center py-8">
              <Camera className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">
                Upload a photo of your grocery receipt
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
              >
                {scanning ? "Scanning..." : "Upload Receipt"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Found {scannedItems.length} items:
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {scannedItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <span>{item.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{item.category}</Badge>
                      <span className="text-sm text-gray-500">x{item.quantity}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setScannedItems([])}
                  className="flex-1"
                >
                  Scan Again
                </Button>
                <Button onClick={handleAddAll} disabled={scanning} className="flex-1">
                  {scanning ? "Adding..." : "Add All Items"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
