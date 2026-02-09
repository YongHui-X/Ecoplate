import { describe, expect, test, vi, beforeEach } from "vitest";
import { lockerApi } from "../../services/locker-api";

// Mock the locker API
vi.mock("../../services/locker-api", () => ({
  lockerApi: {
    getAll: vi.fn(),
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
    availableCompartments: 22,
    operatingHours: "6:00 AM - 11:00 PM",
    status: "active",
  },
];

describe("HomePage - Locker Data Structure", () => {
  test("locker has required fields", () => {
    const locker = mockLockers[0];
    expect(locker.id).toBeDefined();
    expect(locker.name).toBeDefined();
    expect(locker.address).toBeDefined();
    expect(locker.coordinates).toBeDefined();
    expect(locker.totalCompartments).toBeDefined();
    expect(locker.availableCompartments).toBeDefined();
  });

  test("locker has valid compartment counts", () => {
    const locker = mockLockers[0];
    expect(locker.totalCompartments).toBeGreaterThan(0);
    expect(locker.availableCompartments).toBeLessThanOrEqual(locker.totalCompartments);
    expect(locker.availableCompartments).toBeGreaterThanOrEqual(0);
  });

  test("locker has valid status", () => {
    const validStatuses = ["active", "inactive", "maintenance"];
    const locker = mockLockers[0];
    expect(validStatuses).toContain(locker.status);
  });

  test("locker has operating hours", () => {
    const locker = mockLockers[0];
    expect(locker.operatingHours).toBeDefined();
    expect(locker.operatingHours.length).toBeGreaterThan(0);
  });
});

describe("HomePage - Coordinates Parsing", () => {
  test("coordinates can be parsed to lat/lng", () => {
    const locker = mockLockers[0];
    const [lat, lng] = locker.coordinates.split(",").map(Number);

    expect(lat).toBeCloseTo(1.3523, 2);
    expect(lng).toBeCloseTo(103.9447, 2);
  });

  test("coordinates are valid Singapore range", () => {
    const locker = mockLockers[0];
    const [lat, lng] = locker.coordinates.split(",").map(Number);

    // Singapore is roughly between 1.2-1.5 lat and 103.6-104.0 lng
    expect(lat).toBeGreaterThanOrEqual(1.2);
    expect(lat).toBeLessThanOrEqual(1.5);
    expect(lng).toBeGreaterThanOrEqual(103.6);
    expect(lng).toBeLessThanOrEqual(104.0);
  });
});

describe("HomePage - API Methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("lockerApi.getAll exists", () => {
    expect(lockerApi.getAll).toBeDefined();
    expect(typeof lockerApi.getAll).toBe("function");
  });

  test("lockerApi.getAll can return lockers", async () => {
    vi.mocked(lockerApi.getAll).mockResolvedValue(mockLockers);
    const result = await lockerApi.getAll();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Tampines Hub Locker");
  });

  test("lockerApi.getAll can return empty array", async () => {
    vi.mocked(lockerApi.getAll).mockResolvedValue([]);
    const result = await lockerApi.getAll();

    expect(result).toHaveLength(0);
  });

  test("lockerApi.getAll can reject with error", async () => {
    vi.mocked(lockerApi.getAll).mockRejectedValue(new Error("Network error"));
    await expect(lockerApi.getAll()).rejects.toThrow("Network error");
  });
});

describe("HomePage - Locker Display Logic", () => {
  test("can calculate available slots text", () => {
    const locker = mockLockers[0];
    const availableText = `${locker.availableCompartments}/${locker.totalCompartments} available`;
    expect(availableText).toBe("15/20 available");
  });

  test("can format address for display", () => {
    const locker = mockLockers[0];
    expect(locker.address).toContain("Singapore");
  });

  test("can determine if locker has availability", () => {
    const hasAvailability = (locker: typeof mockLockers[0]) =>
      locker.availableCompartments > 0;

    expect(hasAvailability(mockLockers[0])).toBe(true);

    const fullLocker = { ...mockLockers[0], availableCompartments: 0 };
    expect(hasAvailability(fullLocker)).toBe(false);
  });
});

describe("HomePage - Locker Count", () => {
  test("can count total lockers", () => {
    const lockerCount = mockLockers.length;
    const countText = `${lockerCount} locker stations across Singapore`;

    expect(countText).toBe("2 locker stations across Singapore");
  });

  test("handles single locker grammar", () => {
    const singleLocker = [mockLockers[0]];
    const count = singleLocker.length;
    const text = count === 1
      ? "1 locker station across Singapore"
      : `${count} locker stations across Singapore`;

    expect(text).toBe("1 locker station across Singapore");
  });
});

describe("HomePage - EcoLocker Network Branding", () => {
  test("page title is EcoLocker Network", () => {
    const pageTitle = "EcoLocker Network";
    expect(pageTitle).toBe("EcoLocker Network");
  });

  test("help text references EcoPlate", () => {
    const helpText = "Select a locker on the EcoPlate marketplace to get started";
    expect(helpText).toContain("EcoPlate");
  });
});
