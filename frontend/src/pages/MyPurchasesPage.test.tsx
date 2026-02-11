import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MyPurchasesPage from "./MyPurchasesPage";
import { ToastProvider } from "../contexts/ToastContext";

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

const mockPurchases = [
  {
    id: 1,
    title: "Organic Milk",
    description: "Fresh organic milk",
    category: "dairy",
    quantity: 2,
    unit: "L",
    price: 5.0,
    originalPrice: 8.0,
    pickupLocation: "123 Main St",
    images: null,
    status: "sold",
    completedAt: new Date().toISOString(),
    seller: { id: 2, name: "John Seller" },
  },
  {
    id: 2,
    title: "Free Vegetables",
    description: "Assorted vegetables",
    category: "produce",
    quantity: 3,
    unit: "kg",
    price: 0,
    originalPrice: 10.0,
    pickupLocation: "456 Oak Ave",
    images: null,
    status: "sold",
    completedAt: new Date().toISOString(),
    seller: { id: 3, name: "Jane Seller" },
  },
];

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>
  );
}

describe("MyPurchasesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/marketplace/my-purchases")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockPurchases)),
        });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({})) });
    });
  });

  it("should show loading state initially", () => {
    renderWithProviders(<MyPurchasesPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("should render page title", async () => {
    renderWithProviders(<MyPurchasesPage />);
    await waitFor(() => {
      expect(screen.getByText("My Purchases")).toBeInTheDocument();
    });
  });

  it("should display page subtitle", async () => {
    renderWithProviders(<MyPurchasesPage />);
    await waitFor(() => {
      expect(screen.getByText("Your purchase history from the marketplace")).toBeInTheDocument();
    });
  });

  it("should display purchase titles", async () => {
    renderWithProviders(<MyPurchasesPage />);
    await waitFor(() => {
      expect(screen.getByText("Organic Milk")).toBeInTheDocument();
      expect(screen.getByText("Free Vegetables")).toBeInTheDocument();
    });
  });

  it("should display purchase prices", async () => {
    renderWithProviders(<MyPurchasesPage />);
    await waitFor(() => {
      expect(screen.getByText("$5.00")).toBeInTheDocument();
      expect(screen.getByText("Free")).toBeInTheDocument();
    });
  });

  it("should display seller names", async () => {
    renderWithProviders(<MyPurchasesPage />);
    await waitFor(() => {
      expect(screen.getByText("Seller: John Seller")).toBeInTheDocument();
      expect(screen.getByText("Seller: Jane Seller")).toBeInTheDocument();
    });
  });

  it("should display Purchased status badge", async () => {
    renderWithProviders(<MyPurchasesPage />);
    await waitFor(() => {
      const badges = screen.getAllByText("Purchased");
      expect(badges.length).toBe(2);
    });
  });

  it("should display category badges", async () => {
    renderWithProviders(<MyPurchasesPage />);
    await waitFor(() => {
      expect(screen.getByText("dairy")).toBeInTheDocument();
      expect(screen.getByText("produce")).toBeInTheDocument();
    });
  });

  it("should display pickup locations", async () => {
    renderWithProviders(<MyPurchasesPage />);
    await waitFor(() => {
      expect(screen.getByText("123 Main St")).toBeInTheDocument();
      expect(screen.getByText("456 Oak Ave")).toBeInTheDocument();
    });
  });
});

describe("MyPurchasesPage - Empty State", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/marketplace/my-purchases")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify([])),
        });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({})) });
    });
  });

  it("should show empty state when no purchases", async () => {
    renderWithProviders(<MyPurchasesPage />);
    await waitFor(() => {
      expect(screen.getByText("No purchases yet")).toBeInTheDocument();
    });
  });

  it("should show helpful message in empty state", async () => {
    renderWithProviders(<MyPurchasesPage />);
    await waitFor(() => {
      expect(screen.getByText("Items you reserve and purchase will appear here")).toBeInTheDocument();
    });
  });
});
