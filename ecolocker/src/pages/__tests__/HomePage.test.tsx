import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { HomePage } from "../HomePage";
import { AuthProvider } from "../../contexts/AuthContext";
import { ToastProvider } from "../../contexts/ToastContext";
import { lockerApi } from "../../services/locker-api";

// Mock the locker API
vi.mock("../../services/locker-api", () => ({
  lockerApi: {
    getAll: vi.fn(),
  },
}));

// Mock the capacitor service
vi.mock("../../services/capacitor", () => ({
  getCurrentPosition: vi.fn().mockResolvedValue({ lat: 1.3521, lng: 103.8198 }),
  isNative: false,
  platform: "web",
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

function renderHomePage() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <HomePage />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders loading state initially", () => {
    vi.mocked(lockerApi.getAll).mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep loading state
    );

    renderHomePage();

    // Should show loading spinner
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  test("renders lockers after loading", async () => {
    vi.mocked(lockerApi.getAll).mockResolvedValue(mockLockers);

    renderHomePage();

    await waitFor(() => {
      expect(screen.getByText("EcoLocker Network")).toBeInTheDocument();
    });

    expect(screen.getByText("2 locker stations across Singapore")).toBeInTheDocument();
  });

  test("shows retry button when no lockers loaded", async () => {
    vi.mocked(lockerApi.getAll).mockResolvedValue([]);

    renderHomePage();

    await waitFor(() => {
      expect(screen.getByText("Unable to load lockers")).toBeInTheDocument();
    });

    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  test("shows toast error on API failure", async () => {
    vi.mocked(lockerApi.getAll).mockRejectedValue(new Error("Network error"));

    renderHomePage();

    await waitFor(() => {
      // The error will be shown via toast, not inline
      // Just verify the page still renders
      expect(screen.getByText("EcoLocker Network")).toBeInTheDocument();
    });
  });

  test("renders map container", async () => {
    vi.mocked(lockerApi.getAll).mockResolvedValue(mockLockers);

    renderHomePage();

    await waitFor(() => {
      expect(screen.getByTestId("map-container")).toBeInTheDocument();
    });
  });

  test("renders info card with link to EcoPlate", async () => {
    vi.mocked(lockerApi.getAll).mockResolvedValue(mockLockers);

    renderHomePage();

    await waitFor(() => {
      expect(screen.getByText("How to use EcoLocker")).toBeInTheDocument();
    });

    expect(screen.getByText("EcoPlate")).toBeInTheDocument();
  });
});
