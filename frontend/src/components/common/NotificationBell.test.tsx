import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotificationBell from "./NotificationBell";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock notification data
const mockNotifications = [
  {
    id: 1,
    type: "expiring_soon" as const,
    title: "Product Expiring Soon",
    message: "Your milk is expiring tomorrow",
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    type: "badge_unlocked" as const,
    title: "New Badge Earned!",
    message: "You earned the First Action badge",
    isRead: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  },
  {
    id: 3,
    type: "streak_milestone" as const,
    title: "Streak Milestone",
    message: "You've reached a 7-day streak!",
    isRead: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  },
  {
    id: 4,
    type: "product_stale" as const,
    title: "Product Stale",
    message: "Your apples have been in fridge for 10 days",
    isRead: false,
    createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
  },
];

const mockUseNotifications = {
  unreadCount: 3,
  notifications: mockNotifications,
  refreshNotifications: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
};

// Mock NotificationContext
vi.mock("../../contexts/NotificationContext", () => ({
  useNotifications: () => mockUseNotifications,
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNotifications.unreadCount = 3;
    mockUseNotifications.notifications = mockNotifications;
  });

  it("should render bell icon", () => {
    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    expect(bellButton).toBeInTheDocument();
  });

  it("should show unread count badge", () => {
    renderWithProviders(<NotificationBell />);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("should show 99+ when unread count exceeds 99", () => {
    mockUseNotifications.unreadCount = 100;

    renderWithProviders(<NotificationBell />);

    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("should not show badge when no unread notifications", () => {
    mockUseNotifications.unreadCount = 0;

    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    expect(bellButton.querySelector("span")).toBeNull();
  });

  it("should open dropdown when bell clicked", async () => {
    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("Notifications", { selector: "h3" })).toBeInTheDocument();
    });
  });

  it("should refresh notifications when dropdown opens", async () => {
    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(mockUseNotifications.refreshNotifications).toHaveBeenCalled();
    });
  });

  it("should display notification titles", async () => {
    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("Product Expiring Soon")).toBeInTheDocument();
      expect(screen.getByText("New Badge Earned!")).toBeInTheDocument();
      expect(screen.getByText("Streak Milestone")).toBeInTheDocument();
    });
  });

  it("should display notification messages", async () => {
    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("Your milk is expiring tomorrow")).toBeInTheDocument();
    });
  });

  it("should show Mark all read button when unread notifications exist", async () => {
    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("Mark all read")).toBeInTheDocument();
    });
  });

  it("should call markAllAsRead when Mark all read clicked", async () => {
    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("Mark all read")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Mark all read"));

    expect(mockUseNotifications.markAllAsRead).toHaveBeenCalled();
  });

  it("should navigate to /notifications when View All clicked", async () => {
    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("View All Notifications")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View All Notifications"));

    expect(mockNavigate).toHaveBeenCalledWith("/notifications");
  });

  it("should close dropdown when clicking outside", async () => {
    renderWithProviders(
      <div>
        <NotificationBell />
        <button>Outside</button>
      </div>
    );

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("Notifications", { selector: "h3" })).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByText("Outside"));

    await waitFor(() => {
      expect(screen.queryByText("View All Notifications")).not.toBeInTheDocument();
    });
  });

  it("should show empty state when no notifications", async () => {
    mockUseNotifications.notifications = [];
    mockUseNotifications.unreadCount = 0;

    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("No notifications yet")).toBeInTheDocument();
    });
  });

  it("should limit displayed notifications to 5", async () => {
    const manyNotifications = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      type: "badge_unlocked" as const,
      title: `Notification ${i + 1}`,
      message: `Message ${i + 1}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    }));

    mockUseNotifications.notifications = manyNotifications;

    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      // Should only show first 5 notifications
      expect(screen.getByText("Notification 1")).toBeInTheDocument();
      expect(screen.getByText("Notification 5")).toBeInTheDocument();
      expect(screen.queryByText("Notification 6")).not.toBeInTheDocument();
    });
  });
});

describe("NotificationBell - Navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNotifications.unreadCount = 3;
    mockUseNotifications.notifications = mockNotifications;
  });

  it("should navigate to /marketplace/my-listings for expiring_soon notification", async () => {
    mockUseNotifications.notifications = [
      {
        id: 1,
        type: "expiring_soon" as const,
        title: "Product Expiring",
        message: "Your item is expiring",
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ];

    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("Product Expiring")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Product Expiring").closest("button")!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/marketplace/my-listings");
    });
    expect(mockUseNotifications.markAsRead).toHaveBeenCalledWith(1);
  });

  it("should navigate to /badges for badge_unlocked notification", async () => {
    mockUseNotifications.notifications = [
      {
        id: 1,
        type: "badge_unlocked" as const,
        title: "Badge Earned",
        message: "You earned a badge",
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ];

    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("Badge Earned")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Badge Earned").closest("button")!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/badges");
    });
  });

  it("should navigate to /ecopoints for streak_milestone notification", async () => {
    mockUseNotifications.notifications = [
      {
        id: 1,
        type: "streak_milestone" as const,
        title: "Streak!",
        message: "You hit a streak",
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ];

    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("Streak!")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Streak!").closest("button")!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/ecopoints");
    });
  });

  it("should navigate to /myfridge for product_stale notification", async () => {
    mockUseNotifications.notifications = [
      {
        id: 1,
        type: "product_stale" as const,
        title: "Stale Product",
        message: "Your product is stale",
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ];

    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("Stale Product")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Stale Product").closest("button")!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/myfridge");
    });
  });

  it("should not call markAsRead if notification is already read", async () => {
    mockUseNotifications.notifications = [
      {
        id: 1,
        type: "badge_unlocked" as const,
        title: "Already Read",
        message: "This was read",
        isRead: true,
        createdAt: new Date().toISOString(),
      },
    ];

    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("Already Read")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Already Read").closest("button")!);

    expect(mockUseNotifications.markAsRead).not.toHaveBeenCalled();
  });
});

describe("NotificationBell - Time Formatting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display 'Just now' for recent notifications", async () => {
    mockUseNotifications.notifications = [
      {
        id: 1,
        type: "badge_unlocked" as const,
        title: "Recent",
        message: "Just happened",
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ];

    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("Just now")).toBeInTheDocument();
    });
  });

  it("should display minutes ago for notifications under an hour", async () => {
    mockUseNotifications.notifications = [
      {
        id: 1,
        type: "badge_unlocked" as const,
        title: "Minutes Ago",
        message: "30 minutes ago",
        isRead: false,
        createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
      },
    ];

    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("30m ago")).toBeInTheDocument();
    });
  });

  it("should display hours ago for notifications under a day", async () => {
    mockUseNotifications.notifications = [
      {
        id: 1,
        type: "badge_unlocked" as const,
        title: "Hours Ago",
        message: "3 hours ago",
        isRead: false,
        createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      },
    ];

    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("3h ago")).toBeInTheDocument();
    });
  });

  it("should display days ago for notifications under a week", async () => {
    mockUseNotifications.notifications = [
      {
        id: 1,
        type: "badge_unlocked" as const,
        title: "Days Ago",
        message: "2 days ago",
        isRead: false,
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
    ];

    renderWithProviders(<NotificationBell />);

    const bellButton = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("2d ago")).toBeInTheDocument();
    });
  });
});
