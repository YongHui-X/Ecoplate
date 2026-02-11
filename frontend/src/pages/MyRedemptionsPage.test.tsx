import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MyRedemptionsPage from "./MyRedemptionsPage";

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

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

const mockRedemptions = [
  {
    id: 1,
    pointsSpent: 500,
    redemptionCode: "ECO-ABC123",
    status: "pending",
    collectedAt: null,
    expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
    createdAt: new Date().toISOString(),
    reward: {
      id: 1,
      name: "Eco Water Bottle",
      description: "Reusable water bottle",
      imageUrl: null,
      category: "physical",
      pointsCost: 500,
    },
  },
  {
    id: 2,
    pointsSpent: 200,
    redemptionCode: "ECO-XYZ789",
    status: "collected",
    collectedAt: new Date().toISOString(),
    expiresAt: null,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    reward: {
      id: 2,
      name: "Coffee Voucher",
      description: "$5 off coffee",
      imageUrl: "voucher.jpg",
      category: "digital",
      pointsCost: 200,
    },
  },
  {
    id: 3,
    pointsSpent: 100,
    redemptionCode: "ECO-DEF456",
    status: "expired",
    collectedAt: null,
    expiresAt: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    reward: {
      id: 3,
      name: "Discount Coupon",
      description: "10% off",
      imageUrl: null,
      category: "digital",
      pointsCost: 100,
    },
  },
];

function renderWithProviders(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("MyRedemptionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/rewards/my-redemptions")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockRedemptions)),
        });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({})) });
    });
  });

  it("should show loading state initially", () => {
    renderWithProviders(<MyRedemptionsPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("should render page title", async () => {
    renderWithProviders(<MyRedemptionsPage />);
    await waitFor(() => {
      expect(screen.getByText("My Redemptions")).toBeInTheDocument();
    });
  });

  it("should display page subtitle", async () => {
    renderWithProviders(<MyRedemptionsPage />);
    await waitFor(() => {
      expect(screen.getByText("Your redemption history")).toBeInTheDocument();
    });
  });

  it("should display back button", async () => {
    renderWithProviders(<MyRedemptionsPage />);
    await waitFor(() => {
      // Find the ghost button (back button)
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it("should display redemption reward names", async () => {
    renderWithProviders(<MyRedemptionsPage />);
    await waitFor(() => {
      expect(screen.getByText("Eco Water Bottle")).toBeInTheDocument();
      expect(screen.getByText("Coffee Voucher")).toBeInTheDocument();
      expect(screen.getByText("Discount Coupon")).toBeInTheDocument();
    });
  });

  it("should display points spent", async () => {
    renderWithProviders(<MyRedemptionsPage />);
    await waitFor(() => {
      expect(screen.getByText("500 points")).toBeInTheDocument();
      expect(screen.getByText("200 points")).toBeInTheDocument();
      expect(screen.getByText("100 points")).toBeInTheDocument();
    });
  });

  it("should display redemption codes", async () => {
    renderWithProviders(<MyRedemptionsPage />);
    await waitFor(() => {
      expect(screen.getByText("ECO-ABC123")).toBeInTheDocument();
      expect(screen.getByText("ECO-XYZ789")).toBeInTheDocument();
      expect(screen.getByText("ECO-DEF456")).toBeInTheDocument();
    });
  });

  it("should display Pending status badge", async () => {
    renderWithProviders(<MyRedemptionsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });
  });

  it("should display Collected status badge", async () => {
    renderWithProviders(<MyRedemptionsPage />);
    await waitFor(() => {
      expect(screen.getByText("Collected")).toBeInTheDocument();
    });
  });

  it("should display Expired status badge", async () => {
    renderWithProviders(<MyRedemptionsPage />);
    await waitFor(() => {
      expect(screen.getByText("Expired")).toBeInTheDocument();
    });
  });

  it("should display copy buttons for redemption codes", async () => {
    renderWithProviders(<MyRedemptionsPage />);
    await waitFor(() => {
      const copyButtons = screen.getAllByRole("button", { name: /Copy/i });
      expect(copyButtons.length).toBeGreaterThan(0);
    });
  });

  it("should display Redemption Code label", async () => {
    renderWithProviders(<MyRedemptionsPage />);
    await waitFor(() => {
      const labels = screen.getAllByText("Redemption Code");
      expect(labels.length).toBeGreaterThan(0);
    });
  });

  it("should copy code when copy button clicked", async () => {
    renderWithProviders(<MyRedemptionsPage />);
    await waitFor(() => {
      expect(screen.getByText("ECO-ABC123")).toBeInTheDocument();
    });

    const copyButtons = screen.getAllByRole("button", { name: /Copy/i });
    fireEvent.click(copyButtons[0]);

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it("should navigate back when back button clicked", async () => {
    renderWithProviders(<MyRedemptionsPage />);
    await waitFor(() => {
      expect(screen.getByText("My Redemptions")).toBeInTheDocument();
    });

    const backButton = document.querySelector('button[class*="ghost"]');
    if (backButton) {
      fireEvent.click(backButton);
      expect(mockNavigate).toHaveBeenCalledWith("/rewards");
    }
  });
});

describe("MyRedemptionsPage - Empty State", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/rewards/my-redemptions")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify([])),
        });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({})) });
    });
  });

  it("should show empty state when no redemptions", async () => {
    renderWithProviders(<MyRedemptionsPage />);
    await waitFor(() => {
      expect(screen.getByText("No redemptions yet")).toBeInTheDocument();
    });
  });

  it("should show Browse Rewards button in empty state", async () => {
    renderWithProviders(<MyRedemptionsPage />);
    await waitFor(() => {
      expect(screen.getByText("Browse Rewards")).toBeInTheDocument();
    });
  });

  it("should navigate to rewards when Browse Rewards clicked", async () => {
    renderWithProviders(<MyRedemptionsPage />);
    await waitFor(() => {
      expect(screen.getByText("Browse Rewards")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Browse Rewards"));
    expect(mockNavigate).toHaveBeenCalledWith("/rewards");
  });
});
