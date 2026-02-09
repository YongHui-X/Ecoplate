import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AccountPage from "./AccountPage";
import { AuthProvider } from "../contexts/AuthContext";
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

// Mock AuthContext
vi.mock("../contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: {
      id: 1,
      name: "Test User",
      email: "test@example.com",
      avatarUrl: "avatar1",
      userLocation: "Singapore 123456",
    },
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    updateProfile: vi.fn(() => Promise.resolve()),
  }),
}));

// Mock notificationService
vi.mock("../services/notifications", () => ({
  notificationService: {
    getPreferences: vi.fn(() => Promise.resolve({
      preferences: {
        expiringProducts: true,
        badgeUnlocked: true,
        streakMilestone: true,
        productStale: true,
        staleDaysThreshold: 7,
        expiryDaysThreshold: 3,
      }
    })),
    updatePreferences: vi.fn(() => Promise.resolve()),
  },
}));

const mockUser = {
  id: 1,
  name: "Test User",
  email: "test@example.com",
  avatarUrl: "avatar1",
  userLocation: "Singapore 123456",
};

const mockNotificationPrefs = {
  preferences: {
    expiringProducts: true,
    badgeUnlocked: true,
    streakMilestone: true,
    productStale: true,
    staleDaysThreshold: 7,
    expiryDaysThreshold: 3,
  },
};

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>{ui}</ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("AccountPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUser),
        });
      }
      if (url.includes("/notifications/preferences")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockNotificationPrefs),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("should render page title", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("Account Settings")).toBeInTheDocument();
    });
  });

  it("should display profile section", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("Profile")).toBeInTheDocument();
      expect(screen.getByText("Your current avatar")).toBeInTheDocument();
    });
  });

  it("should display edit profile section", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("Edit Profile")).toBeInTheDocument();
      expect(screen.getByText("Update your profile information")).toBeInTheDocument();
    });
  });

  it("should display name input field", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toBeInTheDocument();
    });
  });

  it("should display email field as disabled", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByText("Email cannot be changed")).toBeInTheDocument();
    });
  });

  it("should display location input field", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Location")).toBeInTheDocument();
    });
  });

  it("should display avatar selection", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("Choose Your Avatar")).toBeInTheDocument();
    });
  });

  it("should display save button", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
    });
  });

  it("should display notification preferences section", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("Notification Preferences")).toBeInTheDocument();
      expect(screen.getByText("Choose which notifications you want to receive")).toBeInTheDocument();
    });
  });

  it("should display expiring products toggle", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("Expiring Products")).toBeInTheDocument();
      expect(screen.getByText("Get notified when products are expiring soon")).toBeInTheDocument();
    });
  });

  it("should display badge unlocked toggle", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("Badge Unlocked")).toBeInTheDocument();
      expect(screen.getByText("Get notified when you earn a new badge")).toBeInTheDocument();
    });
  });

  it("should display streak milestones toggle", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("Streak Milestones")).toBeInTheDocument();
      expect(screen.getByText("Get notified when you hit streak milestones")).toBeInTheDocument();
    });
  });

  it("should display stale products toggle", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("Stale Products")).toBeInTheDocument();
      expect(screen.getByText("Get notified about products sitting too long")).toBeInTheDocument();
    });
  });

  it("should display threshold settings section", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("Thresholds")).toBeInTheDocument();
      expect(screen.getByText("Expiry Warning")).toBeInTheDocument();
      expect(screen.getByText("Stale Product Warning")).toBeInTheDocument();
    });
  });

  it("should display mobile navigation items", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("EcoPoints")).toBeInTheDocument();
      expect(screen.getByText("Badges")).toBeInTheDocument();
      expect(screen.getByText("Rewards")).toBeInTheDocument();
      expect(screen.getByText("Notifications")).toBeInTheDocument();
    });
  });
});

describe("AccountPage - Profile Update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUser),
        });
      }
      if (url.includes("/notifications/preferences")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockNotificationPrefs),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("should display name input field", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText("Name");
    expect(nameInput).toBeInTheDocument();
  });

  it("should display location input field", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Location")).toBeInTheDocument();
    });

    const locationInput = screen.getByLabelText("Location");
    expect(locationInput).toBeInTheDocument();
  });

  it("should disable email input", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText("Email");
    expect(emailInput).toBeDisabled();
  });

  it("should display avatar selection options", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("Choose Your Avatar")).toBeInTheDocument();
    });
  });
});

describe("AccountPage - Notification Preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUser),
        });
      }
      if (url.includes("/notifications/preferences")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockNotificationPrefs),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("should display notification toggle switches", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("Expiring Products")).toBeInTheDocument();
      expect(screen.getByText("Badge Unlocked")).toBeInTheDocument();
      expect(screen.getByText("Streak Milestones")).toBeInTheDocument();
      expect(screen.getByText("Stale Products")).toBeInTheDocument();
    });
  });

  it("should display threshold configuration", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("Expiry Warning")).toBeInTheDocument();
      expect(screen.getByText("Stale Product Warning")).toBeInTheDocument();
    });
  });
});

describe("AccountPage - Mobile Navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUser),
        });
      }
      if (url.includes("/notifications/preferences")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockNotificationPrefs),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("should navigate to EcoPoints when clicked", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("EcoPoints")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("EcoPoints"));
    expect(mockNavigate).toHaveBeenCalledWith("/ecopoints");
  });

  it("should navigate to Badges when clicked", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("Badges")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Badges"));
    expect(mockNavigate).toHaveBeenCalledWith("/badges");
  });

  it("should navigate to Rewards when clicked", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("Rewards")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Rewards"));
    expect(mockNavigate).toHaveBeenCalledWith("/rewards");
  });

  it("should navigate to Notifications when clicked", async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText("Notifications")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Notifications"));
    expect(mockNavigate).toHaveBeenCalledWith("/notifications");
  });
});

