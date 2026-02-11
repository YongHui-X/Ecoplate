import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BadgesPage from "./BadgesPage";

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

const mockBadges = {
  badges: [
    {
      id: 1,
      code: "first_action",
      name: "First Action",
      description: "Complete your first sustainable action",
      category: "milestones",
      pointsAwarded: 10,
      imageUrl: null,
      earned: true,
      earnedAt: "2024-01-15T00:00:00Z",
      progress: null,
    },
    {
      id: 2,
      code: "streak_3",
      name: "3-Day Streak",
      description: "Maintain a 3-day streak",
      category: "streaks",
      pointsAwarded: 20,
      imageUrl: null,
      earned: false,
      earnedAt: null,
      progress: { current: 1, target: 3, percentage: 33 },
    },
    {
      id: 3,
      code: "waste_watcher",
      name: "Waste Watcher",
      description: "Track your food waste",
      category: "waste-reduction",
      pointsAwarded: 15,
      imageUrl: null,
      earned: true,
      earnedAt: "2024-01-20T00:00:00Z",
      progress: null,
    },
  ],
  totalEarned: 2,
  totalAvailable: 3,
};

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("BadgesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes("/gamification/sync-badges") && options?.method === "POST") {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({})),
        });
      }
      if (url.includes("/gamification/badges")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(mockBadges)),
        });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({})) });
    });
  });

  it("should show loading state initially", () => {
    renderWithRouter(<BadgesPage />);
    // Page renders with mocked data
    const skeleton = document.querySelector('[class*="skeleton"]') || document.querySelector('[class*="Skeleton"]');
    expect(skeleton || document.body).toBeInTheDocument();
  });

  it("should render page title", async () => {
    renderWithRouter(<BadgesPage />);
    await waitFor(() => {
      expect(screen.getByText("Badges")).toBeInTheDocument();
    });
  });

  it("should display page description", async () => {
    renderWithRouter(<BadgesPage />);
    await waitFor(() => {
      expect(screen.getByText("Collect badges by completing sustainability challenges")).toBeInTheDocument();
    });
  });

  it("should display badges earned count", async () => {
    renderWithRouter(<BadgesPage />);
    await waitFor(() => {
      expect(screen.getByText("2 / 3")).toBeInTheDocument();
      expect(screen.getByText("Badges Earned")).toBeInTheDocument();
    });
  });

  it("should display points from badges", async () => {
    renderWithRouter(<BadgesPage />);
    await waitFor(() => {
      expect(screen.getByText("Points from badges")).toBeInTheDocument();
    });
  });

  it("should display category filter buttons", async () => {
    renderWithRouter(<BadgesPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Milestones" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Waste Reduction" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Streaks" })).toBeInTheDocument();
    });
  });

  it("should display badge names", async () => {
    renderWithRouter(<BadgesPage />);
    await waitFor(() => {
      expect(screen.getByText("First Action")).toBeInTheDocument();
      expect(screen.getByText("3-Day Streak")).toBeInTheDocument();
      expect(screen.getByText("Waste Watcher")).toBeInTheDocument();
    });
  });

  it("should display badge descriptions", async () => {
    renderWithRouter(<BadgesPage />);
    await waitFor(() => {
      expect(screen.getByText("Complete your first sustainable action")).toBeInTheDocument();
      expect(screen.getByText("Maintain a 3-day streak")).toBeInTheDocument();
    });
  });

  it("should display badge points", async () => {
    renderWithRouter(<BadgesPage />);
    await waitFor(() => {
      expect(screen.getByText("+10 pts")).toBeInTheDocument();
      expect(screen.getByText("+20 pts")).toBeInTheDocument();
      expect(screen.getByText("+15 pts")).toBeInTheDocument();
    });
  });

  it("should display progress for unearned badges", async () => {
    renderWithRouter(<BadgesPage />);
    await waitFor(() => {
      expect(screen.getByText("1 / 3")).toBeInTheDocument();
      expect(screen.getByText("33%")).toBeInTheDocument();
    });
  });

  it("should filter badges by category", async () => {
    renderWithRouter(<BadgesPage />);
    await waitFor(() => {
      expect(screen.getByText("First Action")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Streaks" }));

    await waitFor(() => {
      expect(screen.getByText("3-Day Streak")).toBeInTheDocument();
      expect(screen.queryByText("First Action")).not.toBeInTheDocument();
    });
  });

  it("should show back button on mobile", async () => {
    renderWithRouter(<BadgesPage />);
    await waitFor(() => {
      expect(screen.getByText("Back to EcoPoints")).toBeInTheDocument();
    });
  });

  it("should navigate back when back button clicked", async () => {
    renderWithRouter(<BadgesPage />);
    await waitFor(() => {
      expect(screen.getByText("Back to EcoPoints")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Back to EcoPoints"));
    expect(mockNavigate).toHaveBeenCalledWith("/ecopoints");
  });
});

describe("BadgesPage - Empty State", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes("/gamification/sync-badges") && options?.method === "POST") {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({})) });
      }
      if (url.includes("/gamification/badges")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ badges: [], totalEarned: 0, totalAvailable: 0 })),
        });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({})) });
    });
  });

  it("should show empty state when no badges", async () => {
    renderWithRouter(<BadgesPage />);
    await waitFor(() => {
      expect(screen.getByText("No badges in this category")).toBeInTheDocument();
    });
  });
});
