import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RewardsPage from "./RewardsPage";

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

const mockRewards = [
  {
    id: 1,
    name: "Eco Tote Bag",
    description: "Sustainable cotton tote bag",
    imageUrl: null,
    category: "apparel",
    pointsCost: 500,
    stock: 10,
    isActive: true,
  },
  {
    id: 2,
    name: "$5 GrabFood Voucher",
    description: "Redeem for food delivery",
    imageUrl: null,
    category: "food",
    pointsCost: 300,
    stock: 50,
    isActive: true,
  },
  {
    id: 3,
    name: "Bamboo Cutlery Set",
    description: "Eco-friendly utensils",
    imageUrl: null,
    category: "apparel",
    pointsCost: 800,
    stock: 0,
    isActive: true,
  },
];

// Mock the api service
vi.mock("../services/api", () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url.includes("/rewards")) {
        return Promise.resolve(mockRewards);
      }
      if (url.includes("/gamification/points")) {
        return Promise.resolve({ points: { total: 1000 } });
      }
      return Promise.resolve({});
    }),
    post: vi.fn((url: string) => {
      if (url.includes("/rewards/redeem")) {
        return Promise.resolve({
          quantity: 1,
          pointsSpent: 500,
          reward: mockRewards[0],
          redemptions: [
            {
              id: 1,
              redemptionCode: "EP-ABC12345",
            },
          ],
        });
      }
      return Promise.resolve({});
    }),
  },
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("RewardsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the page with title", async () => {
    renderWithRouter(<RewardsPage />);

    await waitFor(() => {
      expect(screen.getByText("Rewards")).toBeInTheDocument();
    });
  });

  it("should display user balance", async () => {
    renderWithRouter(<RewardsPage />);

    await waitFor(() => {
      expect(screen.getByText("1,000")).toBeInTheDocument();
      expect(screen.getByText("points")).toBeInTheDocument();
    });
  });

  it("should display My Redemptions button", async () => {
    renderWithRouter(<RewardsPage />);

    await waitFor(() => {
      expect(screen.getByText("My Redemptions")).toBeInTheDocument();
    });
  });

  it("should display filter tabs", async () => {
    renderWithRouter(<RewardsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Food & Beverage/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Apparel/i })).toBeInTheDocument();
    });
  });

  it("should display reward cards", async () => {
    renderWithRouter(<RewardsPage />);

    await waitFor(() => {
      expect(screen.getByText("Eco Tote Bag")).toBeInTheDocument();
      expect(screen.getByText("$5 GrabFood Voucher")).toBeInTheDocument();
      expect(screen.getByText("Bamboo Cutlery Set")).toBeInTheDocument();
    });
  });

  it("should display points cost for each reward", async () => {
    renderWithRouter(<RewardsPage />);

    await waitFor(() => {
      expect(screen.getByText("500")).toBeInTheDocument();
      expect(screen.getByText("300")).toBeInTheDocument();
      expect(screen.getByText("800")).toBeInTheDocument();
    });
  });

  it("should show Out of Stock for zero stock items", async () => {
    renderWithRouter(<RewardsPage />);

    await waitFor(() => {
      expect(screen.getByText("Out of Stock")).toBeInTheDocument();
    });
  });

  it("should show loading state initially", () => {
    renderWithRouter(<RewardsPage />);
    // Loading spinner should be visible initially
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("should navigate to My Redemptions when button clicked", async () => {
    renderWithRouter(<RewardsPage />);

    await waitFor(() => {
      expect(screen.getByText("My Redemptions")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("My Redemptions"));

    expect(mockNavigate).toHaveBeenCalledWith("/rewards/my-redemptions");
  });
});

describe("RewardsPage - Filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should filter to show only apparel rewards", async () => {
    renderWithRouter(<RewardsPage />);

    await waitFor(() => {
      expect(screen.getByText("Eco Tote Bag")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Apparel/i }));

    await waitFor(() => {
      expect(screen.getByText("Eco Tote Bag")).toBeInTheDocument();
      expect(screen.getByText("Bamboo Cutlery Set")).toBeInTheDocument();
      expect(screen.queryByText("$5 GrabFood Voucher")).not.toBeInTheDocument();
    });
  });

  it("should filter to show only food rewards", async () => {
    renderWithRouter(<RewardsPage />);

    await waitFor(() => {
      expect(screen.getByText("$5 GrabFood Voucher")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Food & Beverage/i }));

    await waitFor(() => {
      expect(screen.getByText("$5 GrabFood Voucher")).toBeInTheDocument();
      expect(screen.queryByText("Eco Tote Bag")).not.toBeInTheDocument();
      expect(screen.queryByText("Bamboo Cutlery Set")).not.toBeInTheDocument();
    });
  });

  it("should show all rewards when All filter clicked", async () => {
    renderWithRouter(<RewardsPage />);

    await waitFor(() => {
      expect(screen.getByText("Eco Tote Bag")).toBeInTheDocument();
    });

    // Click Apparel first
    fireEvent.click(screen.getByRole("button", { name: /Apparel/i }));

    // Then click All
    fireEvent.click(screen.getByRole("button", { name: "All" }));

    await waitFor(() => {
      expect(screen.getByText("Eco Tote Bag")).toBeInTheDocument();
      expect(screen.getByText("$5 GrabFood Voucher")).toBeInTheDocument();
      expect(screen.getByText("Bamboo Cutlery Set")).toBeInTheDocument();
    });
  });
});

describe("RewardsPage - Redemption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should open confirmation dialog when Redeem clicked", async () => {
    renderWithRouter(<RewardsPage />);

    await waitFor(() => {
      expect(screen.getByText("Eco Tote Bag")).toBeInTheDocument();
    });

    // Find and click the first Redeem button (not disabled)
    const redeemButtons = screen.getAllByRole("button", { name: "Redeem" });
    const enabledButton = redeemButtons.find(btn => !btn.hasAttribute("disabled"));
    if (enabledButton) {
      fireEvent.click(enabledButton);
    }

    await waitFor(() => {
      // Use heading role to specifically find the dialog title
      expect(screen.getByRole("heading", { name: "Confirm Redemption" })).toBeInTheDocument();
    });
  });

  it("should show balance breakdown in confirmation dialog", async () => {
    renderWithRouter(<RewardsPage />);

    await waitFor(() => {
      expect(screen.getByText("Eco Tote Bag")).toBeInTheDocument();
    });

    const redeemButtons = screen.getAllByRole("button", { name: "Redeem" });
    fireEvent.click(redeemButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Your Balance:")).toBeInTheDocument();
      expect(screen.getByText("Cost (1x):")).toBeInTheDocument();
      expect(screen.getByText("Remaining:")).toBeInTheDocument();
    });
  });

  it("should close dialog when Cancel clicked", async () => {
    renderWithRouter(<RewardsPage />);

    await waitFor(() => {
      expect(screen.getByText("Eco Tote Bag")).toBeInTheDocument();
    });

    const redeemButtons = screen.getAllByRole("button", { name: "Redeem" });
    const enabledButton = redeemButtons.find(btn => !btn.hasAttribute("disabled"));
    if (enabledButton) {
      fireEvent.click(enabledButton);
    }

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Confirm Redemption" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Confirm Redemption" })).not.toBeInTheDocument();
    });
  });

  it("should show success dialog after redemption", async () => {
    renderWithRouter(<RewardsPage />);

    await waitFor(() => {
      expect(screen.getByText("Eco Tote Bag")).toBeInTheDocument();
    });

    const redeemButtons = screen.getAllByRole("button", { name: "Redeem" });
    const enabledButton = redeemButtons.find(btn => !btn.hasAttribute("disabled"));
    if (enabledButton) {
      fireEvent.click(enabledButton);
    }

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Confirm Redemption" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm Redemption" }));

    await waitFor(() => {
      expect(screen.getByText("Redemption Successful!")).toBeInTheDocument();
      expect(screen.getByText("EP-ABC12345")).toBeInTheDocument();
    });
  });

  it("should close success dialog when Done clicked", async () => {
    renderWithRouter(<RewardsPage />);

    await waitFor(() => {
      expect(screen.getByText("Eco Tote Bag")).toBeInTheDocument();
    });

    const redeemButtons = screen.getAllByRole("button", { name: "Redeem" });
    const enabledButton = redeemButtons.find(btn => !btn.hasAttribute("disabled"));
    if (enabledButton) {
      fireEvent.click(enabledButton);
    }

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Confirm Redemption" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm Redemption" }));

    await waitFor(() => {
      expect(screen.getByText("Redemption Successful!")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => {
      expect(screen.queryByText("Redemption Successful!")).not.toBeInTheDocument();
    });
  });
});

describe("RewardsPage - Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle API error gracefully", async () => {
    // Import and mock the api to reject
    const { api } = await import("../services/api");
    vi.mocked(api.get).mockRejectedValue(new Error("Server error"));

    renderWithRouter(<RewardsPage />);

    // Should not crash, loading should eventually stop
    await waitFor(
      () => {
        expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("should show error message on redemption failure", async () => {
    // Import the mocked api
    const { api } = await import("../services/api");

    // Reset to default behavior for get, but make post reject
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("/rewards")) {
        return Promise.resolve(mockRewards);
      }
      if (url.includes("/gamification/points")) {
        return Promise.resolve({ points: { total: 1000 } });
      }
      return Promise.resolve({});
    });
    vi.mocked(api.post).mockRejectedValue(new Error("Insufficient points"));

    renderWithRouter(<RewardsPage />);

    await waitFor(() => {
      expect(screen.getByText("Eco Tote Bag")).toBeInTheDocument();
    });

    const redeemButtons = screen.getAllByRole("button", { name: "Redeem" });
    const enabledButton = redeemButtons.find(btn => !btn.hasAttribute("disabled"));
    if (enabledButton) {
      fireEvent.click(enabledButton);
    }

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Confirm Redemption" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm Redemption" }));

    await waitFor(() => {
      expect(screen.getByText("Insufficient points")).toBeInTheDocument();
    });
  });
});

describe("RewardsPage - Empty State", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Import and mock the api to return empty data
    const { api } = await import("../services/api");
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("/rewards")) {
        return Promise.resolve([]);
      }
      if (url.includes("/gamification/points")) {
        return Promise.resolve({ points: { total: 0 } });
      }
      return Promise.resolve({});
    });
  });

  it("should show empty state when no rewards available", async () => {
    renderWithRouter(<RewardsPage />);

    await waitFor(() => {
      expect(screen.getByText("No rewards available")).toBeInTheDocument();
    });
  });
});
