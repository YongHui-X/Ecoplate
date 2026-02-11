import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MyListingsPage from "./MyListingsPage";
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

// Mock window.confirm
vi.spyOn(window, "confirm").mockImplementation(() => true);

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
    title: "Fresh Apples",
    description: "Organic apples",
    category: "produce",
    quantity: 5,
    unit: "kg",
    price: 8.0,
    originalPrice: 12.0,
    expiryDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    pickupLocation: "123 Main St",
    images: null,
    status: "active",
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    title: "Sold Bread",
    description: "Whole wheat bread",
    category: "bakery",
    quantity: 2,
    unit: "pcs",
    price: 3.0,
    originalPrice: 5.0,
    expiryDate: null,
    pickupLocation: "456 Oak Ave",
    images: null,
    status: "sold",
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  },
];

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>
  );
}

describe("MyListingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/marketplace/my-listings")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockListings)),
        });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({})) });
    });
  });

  it("should show loading state initially", () => {
    renderWithProviders(<MyListingsPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("should render page title", async () => {
    renderWithProviders(<MyListingsPage />);
    await waitFor(() => {
      expect(screen.getByText("My Listings")).toBeInTheDocument();
    });
  });

  it("should display page subtitle", async () => {
    renderWithProviders(<MyListingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Manage your marketplace listings")).toBeInTheDocument();
    });
  });

  it("should display Create Listing button", async () => {
    renderWithProviders(<MyListingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Create Listing")).toBeInTheDocument();
    });
  });

  it("should display filter tabs", async () => {
    renderWithProviders(<MyListingsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /All \(2\)/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Active \(1\)/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Sold \(1\)/ })).toBeInTheDocument();
    });
  });

  it("should display listing titles", async () => {
    renderWithProviders(<MyListingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Fresh Apples")).toBeInTheDocument();
      expect(screen.getByText("Sold Bread")).toBeInTheDocument();
    });
  });

  it("should display listing prices", async () => {
    renderWithProviders(<MyListingsPage />);
    await waitFor(() => {
      expect(screen.getByText("$8.00")).toBeInTheDocument();
      expect(screen.getByText("$3.00")).toBeInTheDocument();
    });
  });

  it("should display status badges", async () => {
    renderWithProviders(<MyListingsPage />);
    await waitFor(() => {
      expect(screen.getByText("active")).toBeInTheDocument();
      expect(screen.getByText("Completed")).toBeInTheDocument();
    });
  });

  it("should display Edit button for active listings", async () => {
    renderWithProviders(<MyListingsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
    });
  });

  it("should display Delete button for active listings", async () => {
    renderWithProviders(<MyListingsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Delete/i })).toBeInTheDocument();
    });
  });

  it("should filter to show only active listings", async () => {
    renderWithProviders(<MyListingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Fresh Apples")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Active \(1\)/ }));

    await waitFor(() => {
      expect(screen.getByText("Fresh Apples")).toBeInTheDocument();
      expect(screen.queryByText("Sold Bread")).not.toBeInTheDocument();
    });
  });

  it("should filter to show only sold listings", async () => {
    renderWithProviders(<MyListingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Fresh Apples")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Sold \(1\)/ }));

    await waitFor(() => {
      expect(screen.queryByText("Fresh Apples")).not.toBeInTheDocument();
      expect(screen.getByText("Sold Bread")).toBeInTheDocument();
    });
  });
});

describe("MyListingsPage - Empty State", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/marketplace/my-listings")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify([])),
        });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({})) });
    });
  });

  it("should show empty state when no listings", async () => {
    renderWithProviders(<MyListingsPage />);
    await waitFor(() => {
      expect(screen.getByText("You haven't created any listings yet")).toBeInTheDocument();
    });
  });

  it("should show create first listing button in empty state", async () => {
    renderWithProviders(<MyListingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Create Your First Listing")).toBeInTheDocument();
    });
  });
});
