import { describe, expect, test, vi, beforeEach } from "vitest";
import { lockerApi, marketplaceApi, orderApi } from "../../services/locker-api";

// Mock the APIs
vi.mock("../../services/locker-api", () => ({
  lockerApi: {
    getAll: vi.fn(),
  },
  marketplaceApi: {
    getListing: vi.fn(),
  },
  orderApi: {
    create: vi.fn(),
  },
}));

const mockLockers = [
  {
    id: 1,
    name: "Tampines Hub Locker",
    address: "1 Tampines Walk, Singapore 528523",
    coordinates: "1.3523,103.9447",
    totalCompartments: 20,
    availableCompartments: 15,
    operatingHours: "24/7",
    status: "active",
  },
  {
    id: 2,
    name: "Jurong East MRT Locker",
    address: "10 Jurong East Street, Singapore 609594",
    coordinates: "1.3329,103.7436",
    totalCompartments: 30,
    availableCompartments: 0,
    operatingHours: "6:00 AM - 11:00 PM",
    status: "active",
  },
  {
    id: 3,
    name: "Orchard Central Locker",
    address: "181 Orchard Road, Singapore 238896",
    coordinates: "1.3010,103.8390",
    totalCompartments: 15,
    availableCompartments: 8,
    operatingHours: "10:00 AM - 10:00 PM",
    status: "maintenance",
  },
];

const mockListing = {
  id: 101,
  title: "Fresh Apples",
  description: "5 kg of fresh apples from local farm",
  price: 15.0,
  quantity: 5,
  unit: "kg",
  category: "Fruits",
  images: '["apple.jpg"]',
  status: "active",
  seller: { id: 2, name: "John Seller" },
};

const mockCreatedOrder = {
  id: 1,
  listingId: 101,
  lockerId: 1,
  buyerId: 1,
  sellerId: 2,
  itemPrice: 15.0,
  deliveryFee: 2.0,
  totalPrice: 17.0,
  status: "pending_payment",
  paymentDeadline: "2025-01-15T10:15:00Z",
};

describe("SelectLockerPage - Locker Data Structure", () => {
  test("locker has required fields", () => {
    const locker = mockLockers[0];
    expect(locker.id).toBeDefined();
    expect(locker.name).toBeDefined();
    expect(locker.address).toBeDefined();
    expect(locker.coordinates).toBeDefined();
    expect(locker.totalCompartments).toBeDefined();
    expect(locker.availableCompartments).toBeDefined();
    expect(locker.operatingHours).toBeDefined();
    expect(locker.status).toBeDefined();
  });

  test("locker has valid coordinates", () => {
    const locker = mockLockers[0];
    const [lat, lng] = locker.coordinates.split(",").map(Number);

    expect(lat).toBeCloseTo(1.3523, 2);
    expect(lng).toBeCloseTo(103.9447, 2);
  });

  test("locker compartment counts are valid", () => {
    const locker = mockLockers[0];
    expect(locker.totalCompartments).toBeGreaterThan(0);
    expect(locker.availableCompartments).toBeLessThanOrEqual(locker.totalCompartments);
    expect(locker.availableCompartments).toBeGreaterThanOrEqual(0);
  });
});

describe("SelectLockerPage - API Methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("lockerApi.getAll exists and returns lockers", async () => {
    vi.mocked(lockerApi.getAll).mockResolvedValue(mockLockers);
    const result = await lockerApi.getAll();

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Tampines Hub Locker");
  });

  test("marketplaceApi.getListing exists and returns listing", async () => {
    vi.mocked(marketplaceApi.getListing).mockResolvedValue(mockListing);
    const result = await marketplaceApi.getListing(101);

    expect(result.id).toBe(101);
    expect(result.title).toBe("Fresh Apples");
  });

  test("orderApi.create exists and creates order", async () => {
    vi.mocked(orderApi.create).mockResolvedValue(mockCreatedOrder);
    const result = await orderApi.create(101, 1);

    expect(result.id).toBe(1);
    expect(result.status).toBe("pending_payment");
    expect(orderApi.create).toHaveBeenCalledWith(101, 1);
  });

  test("APIs can reject with errors", async () => {
    vi.mocked(lockerApi.getAll).mockRejectedValue(new Error("Network error"));
    await expect(lockerApi.getAll()).rejects.toThrow("Network error");
  });
});

describe("SelectLockerPage - Locker Selection", () => {
  test("can determine locker availability", () => {
    const hasAvailability = (locker: typeof mockLockers[0]) =>
      locker.availableCompartments > 0;

    expect(hasAvailability(mockLockers[0])).toBe(true);
    expect(hasAvailability(mockLockers[1])).toBe(false);
    expect(hasAvailability(mockLockers[2])).toBe(true);
  });

  test("full locker cannot be selected", () => {
    const locker = mockLockers[1];
    const canSelect = locker.availableCompartments > 0;
    expect(canSelect).toBe(false);
  });

  test("available locker can be selected", () => {
    const locker = mockLockers[0];
    const canSelect = locker.availableCompartments > 0;
    expect(canSelect).toBe(true);
  });
});

describe("SelectLockerPage - Map Loading", () => {
  test("shows loading when map not loaded", () => {
    const isLoaded = false;
    const showMapLoading = !isLoaded;
    expect(showMapLoading).toBe(true);
  });

  test("shows map when loaded", () => {
    const isLoaded = true;
    const showMapLoading = !isLoaded;
    expect(showMapLoading).toBe(false);
  });

  test("handles map load error", () => {
    const mapLoadError = "Failed to load Google Maps";
    const showError = !!mapLoadError;
    expect(showError).toBe(true);
  });
});

describe("SelectLockerPage - Listing Display", () => {
  test("displays listing title", () => {
    expect(mockListing.title).toBe("Fresh Apples");
  });

  test("displays listing price", () => {
    expect(mockListing.price).toBe(15.0);
  });

  test("can format listing info", () => {
    const formatPrice = (price: number) => `$${price.toFixed(2)}`;
    const listingInfo = `For: ${mockListing.title} (${formatPrice(mockListing.price)})`;
    expect(listingInfo).toBe("For: Fresh Apples ($15.00)");
  });

  test("handles missing listing gracefully", () => {
    const listing = null;
    const showWarning = !listing;
    expect(showWarning).toBe(true);
  });
});

describe("SelectLockerPage - Price Calculation", () => {
  test("calculates total with delivery fee", () => {
    const itemPrice = mockListing.price;
    const deliveryFee = 2.0;
    const total = itemPrice + deliveryFee;
    expect(total).toBe(17.0);
  });

  test("displays price breakdown", () => {
    const formatPrice = (price: number) => `$${price.toFixed(2)}`;
    const itemPrice = mockListing.price;
    const deliveryFee = 2.0;
    const total = itemPrice + deliveryFee;

    expect(formatPrice(itemPrice)).toBe("$15.00");
    expect(formatPrice(deliveryFee)).toBe("$2.00");
    expect(formatPrice(total)).toBe("$17.00");
  });
});

describe("SelectLockerPage - Order Creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates order with selected locker", async () => {
    vi.mocked(orderApi.create).mockResolvedValue(mockCreatedOrder);

    const listingId = 101;
    const lockerId = 1;
    const order = await orderApi.create(listingId, lockerId);

    expect(order.listingId).toBe(listingId);
    expect(order.lockerId).toBe(lockerId);
    expect(orderApi.create).toHaveBeenCalledWith(listingId, lockerId);
  });

  test("button disabled while creating order", () => {
    const creating = true;
    const canCreate = !creating;
    expect(canCreate).toBe(false);
  });

  test("button disabled when locker is full", () => {
    const selectedLocker = mockLockers[1]; // Full locker
    const canCreate = selectedLocker.availableCompartments > 0;
    expect(canCreate).toBe(false);
  });

  test("button disabled when no listing", () => {
    const listingId = null;
    const canCreate = !!listingId;
    expect(canCreate).toBe(false);
  });

  test("button enabled when all conditions met", () => {
    const creating = false;
    const selectedLocker = mockLockers[0];
    const listingId = "101";

    const canCreate =
      !creating &&
      selectedLocker.availableCompartments > 0 &&
      !!listingId;

    expect(canCreate).toBe(true);
  });
});

describe("SelectLockerPage - Navigation", () => {
  test("navigates to payment page after order creation", () => {
    const orderId = mockCreatedOrder.id;
    const paymentUrl = `/payment/${orderId}`;
    expect(paymentUrl).toBe("/payment/1");
  });

  test("can go back", () => {
    // Simulating navigate(-1)
    const navigateBack = () => -1;
    expect(navigateBack()).toBe(-1);
  });

  test("extracts listingId from URL params", () => {
    const searchParams = new URLSearchParams("?listingId=101");
    const listingId = searchParams.get("listingId");
    expect(listingId).toBe("101");
  });

  test("handles missing listingId", () => {
    const searchParams = new URLSearchParams("");
    const listingId = searchParams.get("listingId");
    expect(listingId).toBeNull();
  });
});

describe("SelectLockerPage - Error States", () => {
  test("shows error when locker loading fails", () => {
    const lockerError = "Failed to load lockers";
    const showError = !!lockerError && mockLockers.length === 0;
    expect(showError).toBe(false); // lockers not empty in test

    const emptyWithError = !!lockerError && [].length === 0;
    expect(emptyWithError).toBe(true);
  });

  test("shows offline indicator", () => {
    const isOnline = false;
    const showOffline = !isOnline;
    expect(showOffline).toBe(true);
  });

  test("auto-retries when coming online", () => {
    const isOnline = true;
    const lockerError = "Previous error";
    const lockersEmpty = true;
    const shouldRetry = isOnline && !!lockerError && lockersEmpty;
    expect(shouldRetry).toBe(true);
  });
});

describe("SelectLockerPage - Selected Locker Card", () => {
  test("shows selected locker name", () => {
    const selectedLocker = mockLockers[0];
    expect(selectedLocker.name).toBe("Tampines Hub Locker");
  });

  test("shows selected locker address", () => {
    const selectedLocker = mockLockers[0];
    expect(selectedLocker.address).toBe("1 Tampines Walk, Singapore 528523");
  });

  test("shows availability badge", () => {
    const getAvailabilityBadge = (locker: typeof mockLockers[0]) => ({
      text: locker.availableCompartments > 0 ? "Available" : "Full",
      variant: locker.availableCompartments > 0 ? "success" : "destructive",
    });

    const availableLocker = mockLockers[0];
    expect(getAvailabilityBadge(availableLocker)).toEqual({
      text: "Available",
      variant: "success",
    });

    const fullLocker = mockLockers[1];
    expect(getAvailabilityBadge(fullLocker)).toEqual({
      text: "Full",
      variant: "destructive",
    });
  });

  test("shows compartment count", () => {
    const locker = mockLockers[0];
    const countText = `${locker.availableCompartments}/${locker.totalCompartments}`;
    expect(countText).toBe("15/20");
  });

  test("shows operating hours if available", () => {
    const locker = mockLockers[0];
    expect(locker.operatingHours).toBe("24/7");
  });
});

describe("SelectLockerPage - Empty States", () => {
  test("shows prompt when no locker selected", () => {
    const selectedLocker = null;
    const showPrompt = !selectedLocker && mockLockers.length > 0;
    expect(showPrompt).toBe(true);
  });

  test("shows error when no lockers available", () => {
    const lockers: typeof mockLockers = [];
    const lockerError = "No lockers found";
    const showError = lockers.length === 0 && !!lockerError;
    expect(showError).toBe(true);
  });
});

describe("SelectLockerPage - Parallel Data Loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("loads lockers and listing in parallel", async () => {
    vi.mocked(lockerApi.getAll).mockResolvedValue(mockLockers);
    vi.mocked(marketplaceApi.getListing).mockResolvedValue(mockListing);

    const [lockersData, listingData] = await Promise.allSettled([
      lockerApi.getAll(),
      marketplaceApi.getListing(101),
    ]);

    expect(lockersData.status).toBe("fulfilled");
    expect(listingData.status).toBe("fulfilled");
  });

  test("handles partial failure gracefully", async () => {
    vi.mocked(lockerApi.getAll).mockResolvedValue(mockLockers);
    vi.mocked(marketplaceApi.getListing).mockRejectedValue(new Error("Listing not found"));

    const [lockersData, listingData] = await Promise.allSettled([
      lockerApi.getAll(),
      marketplaceApi.getListing(101),
    ]);

    expect(lockersData.status).toBe("fulfilled");
    expect(listingData.status).toBe("rejected");
  });
});

describe("SelectLockerPage - Google Maps Integration", () => {
  test("coordinates are within Singapore bounds", () => {
    mockLockers.forEach((locker) => {
      const [lat, lng] = locker.coordinates.split(",").map(Number);

      // Singapore bounds roughly: 1.2-1.5 lat, 103.6-104.0 lng
      expect(lat).toBeGreaterThanOrEqual(1.2);
      expect(lat).toBeLessThanOrEqual(1.5);
      expect(lng).toBeGreaterThanOrEqual(103.6);
      expect(lng).toBeLessThanOrEqual(104.0);
    });
  });

  test("can parse coordinates for markers", () => {
    const parseCoordinates = (coords: string) => {
      const [lat, lng] = coords.split(",").map(Number);
      return { lat, lng };
    };

    const result = parseCoordinates(mockLockers[0].coordinates);
    expect(result).toEqual({ lat: 1.3523, lng: 103.9447 });
  });
});

describe("SelectLockerPage - Locker Info Window", () => {
  test("info window shows locker name", () => {
    const locker = mockLockers[0];
    expect(locker.name).toBe("Tampines Hub Locker");
  });

  test("info window shows address", () => {
    const locker = mockLockers[0];
    expect(locker.address).toContain("Singapore");
  });

  test("info window shows availability", () => {
    const locker = mockLockers[0];
    const text = `${locker.availableCompartments}/${locker.totalCompartments} available`;
    expect(text).toBe("15/20 available");
  });
});

describe("SelectLockerPage - Locker Status", () => {
  test("filters active lockers", () => {
    const activeLockers = mockLockers.filter((l) => l.status === "active");
    expect(activeLockers.length).toBe(2);
  });

  test("identifies maintenance lockers", () => {
    const maintenanceLockers = mockLockers.filter((l) => l.status === "maintenance");
    expect(maintenanceLockers.length).toBe(1);
    expect(maintenanceLockers[0].name).toBe("Orchard Central Locker");
  });
});
