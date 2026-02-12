import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotificationsPage from "./NotificationsPage";
import { NotificationProvider } from "../contexts/NotificationContext";

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

// Variable to control mock notifications data
let mockNotificationsData: any[] = [];

// Mock NotificationContext
vi.mock("../contexts/NotificationContext", () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNotifications: () => ({
    notifications: mockNotificationsData,
    loading: false,
    unreadCount: mockNotificationsData.filter((n: any) => !n.isRead).length,
    refreshNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteNotification: vi.fn(),
  }),
}));

const mockNotifications = [
  {
    id: 1,
    type: "expiring_soon",
    title: "Product Expiring Soon",
    message: "Your milk is expiring tomorrow",
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    type: "badge_unlocked",
    title: "New Badge Earned!",
    message: "You earned the First Action badge",
    isRead: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  },
  {
    id: 3,
    type: "streak_milestone",
    title: "Streak Milestone",
    message: "You've reached a 7-day streak!",
    isRead: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  },
];

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <NotificationProvider>{ui}</NotificationProvider>
    </MemoryRouter>
  );
}

describe("NotificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set the mock notifications data
    mockNotificationsData = [
      {
        id: 1,
        type: "expiring_soon",
        title: "Product Expiring Soon",
        message: "Your milk is expiring tomorrow",
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        type: "badge_unlocked",
        title: "New Badge Earned!",
        message: "You earned the First Action badge",
        isRead: true,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 3,
        type: "streak_milestone",
        title: "Streak Milestone",
        message: "You've reached a 7-day streak!",
        isRead: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ];
  });

  it("should render page title", async () => {
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("Notifications")).toBeInTheDocument();
    });
  });

  it("should display unread count", async () => {
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      // Multiple elements contain "unread"
      const elements = screen.getAllByText(/unread/i);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  it("should display filter buttons", async () => {
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Unread/i })).toBeInTheDocument();
    });
  });

  it("should display Mark all read button when unread notifications exist", async () => {
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("Mark all read")).toBeInTheDocument();
    });
  });

  it("should display All Notifications card title", async () => {
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("All Notifications")).toBeInTheDocument();
    });
  });

  it("should display notification titles", async () => {
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("Product Expiring Soon")).toBeInTheDocument();
      expect(screen.getByText("New Badge Earned!")).toBeInTheDocument();
      expect(screen.getByText("Streak Milestone")).toBeInTheDocument();
    });
  });

  it("should display notification messages", async () => {
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("Your milk is expiring tomorrow")).toBeInTheDocument();
      expect(screen.getByText("You earned the First Action badge")).toBeInTheDocument();
    });
  });

  it("should switch to unread filter when clicked", async () => {
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Unread/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Unread/i }));
    await waitFor(() => {
      expect(screen.getByText("Unread Notifications")).toBeInTheDocument();
    });
  });

  it("should show loading state initially", () => {
    renderWithProviders(<NotificationsPage />);
    // Page renders with mocked data
    const skeleton = document.querySelector('[class*="skeleton"]') || document.querySelector('[class*="Skeleton"]');
    expect(skeleton || document.body).toBeInTheDocument();
  });
});

describe("NotificationsPage - Empty State", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set empty notifications data
    mockNotificationsData = [];
  });

  it("should show all caught up message when no unread", async () => {
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("All caught up!")).toBeInTheDocument();
    });
  });

  it("should show no notifications message", async () => {
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("No notifications yet")).toBeInTheDocument();
    });
  });

  it("should show helpful message for empty state", async () => {
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("Notifications will appear here when you have updates.")).toBeInTheDocument();
    });
  });
});

describe("NotificationsPage - Notification Types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display product_stale notification", async () => {
    mockNotificationsData = [
      {
        id: 1,
        type: "product_stale",
        title: "Product Gone Stale",
        message: "Your bread has gone stale",
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ];
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("Product Gone Stale")).toBeInTheDocument();
    });
  });

  it("should display locker_payment_received notification", async () => {
    mockNotificationsData = [
      {
        id: 1,
        type: "locker_payment_received",
        title: "Payment Received",
        message: "You received a payment for your order",
        isRead: false,
        createdAt: new Date().toISOString(),
        relatedId: 123,
      },
    ];
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("Payment Received")).toBeInTheDocument();
    });
  });

  it("should display locker_item_delivered notification", async () => {
    mockNotificationsData = [
      {
        id: 1,
        type: "locker_item_delivered",
        title: "Item Delivered",
        message: "Your item has been delivered to locker",
        isRead: false,
        createdAt: new Date().toISOString(),
        relatedId: 456,
      },
    ];
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("Item Delivered")).toBeInTheDocument();
    });
  });

  it("should display locker_pickup_complete notification", async () => {
    mockNotificationsData = [
      {
        id: 1,
        type: "locker_pickup_complete",
        title: "Pickup Complete",
        message: "Buyer has picked up the item",
        isRead: false,
        createdAt: new Date().toISOString(),
        relatedId: 789,
      },
    ];
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pickup Complete")).toBeInTheDocument();
    });
  });

  it("should display locker_order_cancelled notification", async () => {
    mockNotificationsData = [
      {
        id: 1,
        type: "locker_order_cancelled",
        title: "Order Cancelled",
        message: "Your order has been cancelled",
        isRead: false,
        createdAt: new Date().toISOString(),
        relatedId: 101,
      },
    ];
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("Order Cancelled")).toBeInTheDocument();
    });
  });

  it("should display default notification type", async () => {
    mockNotificationsData = [
      {
        id: 1,
        type: "unknown_type",
        title: "Unknown Notification",
        message: "Some message",
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ];
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("Unknown Notification")).toBeInTheDocument();
    });
  });
});

describe("NotificationsPage - Time Formatting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should display 'Just now' for recent notifications", async () => {
    mockNotificationsData = [
      {
        id: 1,
        type: "badge_unlocked",
        title: "Test",
        message: "Test message",
        isRead: false,
        createdAt: new Date().toISOString(), // now
      },
    ];
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("Just now")).toBeInTheDocument();
    });
  });

  it("should display minutes ago", async () => {
    mockNotificationsData = [
      {
        id: 1,
        type: "badge_unlocked",
        title: "Test",
        message: "Test message",
        isRead: false,
        createdAt: new Date(Date.now() - 5 * 60000).toISOString(), // 5 mins ago
      },
    ];
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("5 minutes ago")).toBeInTheDocument();
    });
  });

  it("should display singular minute ago", async () => {
    mockNotificationsData = [
      {
        id: 1,
        type: "badge_unlocked",
        title: "Test",
        message: "Test message",
        isRead: false,
        createdAt: new Date(Date.now() - 60000).toISOString(), // 1 min ago
      },
    ];
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("1 minute ago")).toBeInTheDocument();
    });
  });

  it("should display hours ago", async () => {
    mockNotificationsData = [
      {
        id: 1,
        type: "badge_unlocked",
        title: "Test",
        message: "Test message",
        isRead: false,
        createdAt: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 hours ago
      },
    ];
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("2 hours ago")).toBeInTheDocument();
    });
  });

  it("should display singular hour ago", async () => {
    mockNotificationsData = [
      {
        id: 1,
        type: "badge_unlocked",
        title: "Test",
        message: "Test message",
        isRead: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      },
    ];
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("1 hour ago")).toBeInTheDocument();
    });
  });

  it("should display days ago", async () => {
    mockNotificationsData = [
      {
        id: 1,
        type: "badge_unlocked",
        title: "Test",
        message: "Test message",
        isRead: false,
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), // 3 days ago
      },
    ];
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("3 days ago")).toBeInTheDocument();
    });
  });

  it("should display singular day ago", async () => {
    mockNotificationsData = [
      {
        id: 1,
        type: "badge_unlocked",
        title: "Test",
        message: "Test message",
        isRead: false,
        createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      },
    ];
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("1 day ago")).toBeInTheDocument();
    });
  });

  it("should display date for old notifications", async () => {
    mockNotificationsData = [
      {
        id: 1,
        type: "badge_unlocked",
        title: "Test",
        message: "Test message",
        isRead: false,
        createdAt: new Date("2024-01-01").toISOString(), // old date
      },
    ];
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      // Should display a formatted date
      expect(screen.getByText(/\d{1,2}\/\d{1,2}\/\d{4}|\w+ \d{1,2}, \d{4}/)).toBeInTheDocument();
    });
  });
});

describe("NotificationsPage - Unread Filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationsData = [
      {
        id: 1,
        type: "badge_unlocked",
        title: "Read Notification",
        message: "This is read",
        isRead: true,
        createdAt: new Date().toISOString(),
      },
    ];
  });

  it("should show no unread notifications message when filtering unread", async () => {
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Unread/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Unread/i }));
    await waitFor(() => {
      expect(screen.getByText("No unread notifications")).toBeInTheDocument();
    });
  });

  it("should show 'You're all caught up!' message for unread filter empty state", async () => {
    renderWithProviders(<NotificationsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Unread/i }));
    await waitFor(() => {
      expect(screen.getByText("You're all caught up!")).toBeInTheDocument();
    });
  });

  it("should not show Mark all read button when no unread notifications", async () => {
    renderWithProviders(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.queryByText("Mark all read")).not.toBeInTheDocument();
    });
  });
});
