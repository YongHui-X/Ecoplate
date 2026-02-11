import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MarketplacePage from "./MarketplacePage";
import { ToastProvider } from "../contexts/ToastContext";
import { axe } from "../test/accessibility.setup";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(() => "mock-token"),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: mockLocalStorage });

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockListings = [
  {
    id: 1,
    title: "Fresh Organic Apples",
    description: "Delicious apples from local farm",
    category: "produce",
    quantity: 5,
    unit: "kg",
    price: 8.0,
    originalPrice: 12.0,
    expiryDate: new Date(Date.now() + 86400000 * 3).toISOString(), // 3 days from now
    pickupLocation: "123 Main St|1.3521,103.8198",
    images: "image1.jpg",
    co2Saved: 2.5,
    status: "active",
    seller: { id: 1, name: "John Doe" },
  },
  {
    id: 2,
    title: "Milk 1L",
    description: "Fresh milk",
    category: "dairy",
    quantity: 2,
    unit: "L",
    price: 3.5,
    originalPrice: 5.0,
    expiryDate: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
    pickupLocation: "456 Oak Ave",
    images: null,
    co2Saved: 1.2,
    status: "active",
    seller: { id: 2, name: "Jane Smith" },
  },
];

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>
  );
}

describe("MarketplacePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/marketplace/listings")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockListings),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("should show loading state initially", () => {
    renderWithProviders(<MarketplacePage />);
    expect(document.querySelector(".skeleton")).toBeInTheDocument();
  });

  it("should render page title", async () => {
    renderWithProviders(<MarketplacePage />);
    await waitFor(() => {
      expect(screen.getByText("Marketplace")).toBeInTheDocument();
    });
  });

  it("should display page subtitle", async () => {
    renderWithProviders(<MarketplacePage />);
    await waitFor(() => {
      expect(screen.getByText("Find great deals on near-expiry food")).toBeInTheDocument();
    });
  });

  it("should display view toggle buttons", async () => {
    renderWithProviders(<MarketplacePage />);
    await waitFor(() => {
      expect(screen.getByText("List")).toBeInTheDocument();
      expect(screen.getByText("Map")).toBeInTheDocument();
    });
  });

  it("should display My Listings button", async () => {
    renderWithProviders(<MarketplacePage />);
    await waitFor(() => {
      expect(screen.getByText("My Listings")).toBeInTheDocument();
    });
  });

  it("should display My Purchases button", async () => {
    renderWithProviders(<MarketplacePage />);
    await waitFor(() => {
      expect(screen.getByText("My Purchases")).toBeInTheDocument();
    });
  });

  it("should display Create button", async () => {
    renderWithProviders(<MarketplacePage />);
    await waitFor(() => {
      expect(screen.getByText("Create")).toBeInTheDocument();
    });
  });

  it("should display search input", async () => {
    renderWithProviders(<MarketplacePage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search listings...")).toBeInTheDocument();
    });
  });

  it("should display category filter buttons", async () => {
    renderWithProviders(<MarketplacePage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Produce" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Dairy" })).toBeInTheDocument();
    });
  });

  it("should display listing titles", async () => {
    renderWithProviders(<MarketplacePage />);
    await waitFor(() => {
      expect(screen.getByText("Fresh Organic Apples")).toBeInTheDocument();
      expect(screen.getByText("Milk 1L")).toBeInTheDocument();
    });
  });

  it("should display listing prices", async () => {
    renderWithProviders(<MarketplacePage />);
    await waitFor(() => {
      expect(screen.getByText("$8.00")).toBeInTheDocument();
      expect(screen.getByText("$3.50")).toBeInTheDocument();
    });
  });

  it("should display discount badges", async () => {
    renderWithProviders(<MarketplacePage />);
    await waitFor(() => {
      expect(screen.getByText("-33%")).toBeInTheDocument();
      expect(screen.getByText("-30%")).toBeInTheDocument();
    });
  });

  it("should filter listings by search query", async () => {
    renderWithProviders(<MarketplacePage />);
    await waitFor(() => {
      expect(screen.getByText("Fresh Organic Apples")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search listings...");
    fireEvent.change(searchInput, { target: { value: "Milk" } });

    await waitFor(() => {
      expect(screen.queryByText("Fresh Organic Apples")).not.toBeInTheDocument();
      expect(screen.getByText("Milk 1L")).toBeInTheDocument();
    });
  });

  it("should filter listings by category", async () => {
    renderWithProviders(<MarketplacePage />);
    await waitFor(() => {
      expect(screen.getByText("Fresh Organic Apples")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Dairy" }));

    await waitFor(() => {
      expect(screen.queryByText("Fresh Organic Apples")).not.toBeInTheDocument();
      expect(screen.getByText("Milk 1L")).toBeInTheDocument();
    });
  });

  it("should switch to map view when Map button clicked", async () => {
    renderWithProviders(<MarketplacePage />);
    await waitFor(() => {
      expect(screen.getByText("Map")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Map"));

    // Map button should be active (has shadow)
    const mapButton = screen.getByText("Map").closest("button");
    expect(mapButton).toHaveClass("shadow-sm");
  });
});

describe("MarketplacePage - Empty State", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/marketplace/listings")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("should show empty state when no listings", async () => {
    renderWithProviders(<MarketplacePage />);
    await waitFor(() => {
      expect(screen.getByText("No listings found")).toBeInTheDocument();
    });
  });

  it("should show create first listing button", async () => {
    renderWithProviders(<MarketplacePage />);
    await waitFor(() => {
      expect(screen.getByText("Create the first listing")).toBeInTheDocument();
    });
  });

  it("should have no accessibility violations", async () => {
    const { container } = renderWithProviders(<MarketplacePage />);
    await waitFor(() => {
      expect(screen.getByText("No listings found")).toBeInTheDocument();
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
