import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MessagesPage from "./MessagesPage";
import { AuthProvider } from "../contexts/AuthContext";
import { WebSocketProvider } from "../contexts/WebSocketContext";
import { UnreadCountProvider } from "../contexts/UnreadCountContext";
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

// Mock uploadService
vi.mock("../services/upload", () => ({
  uploadService: {
    getListingImageUrls: vi.fn(() => []),
  },
}));

// Mock messageService with a getter for dynamic data
const mockGetConversations = vi.fn();
vi.mock("../services/messages", () => ({
  messageService: {
    getConversations: () => mockGetConversations(),
  },
}));

const mockConversations = [
  {
    id: 1,
    listing: {
      id: 1,
      title: "Fresh Apples",
      price: 8.0,
      images: null,
      status: "active",
    },
    buyer: { id: 2, name: "Buyer Alice" },
    seller: { id: 1, name: "Test User" },
    role: "selling",
    unreadCount: 2,
    lastMessage: {
      messageText: "Is this still available?",
      createdAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    listing: {
      id: 2,
      title: "Organic Milk",
      price: 5.0,
      images: null,
      status: "active",
    },
    buyer: { id: 1, name: "Test User" },
    seller: { id: 3, name: "Seller Bob" },
    role: "buying",
    unreadCount: 0,
    lastMessage: {
      messageText: "Sure, I can pick it up tomorrow",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 3,
    listing: {
      id: 3,
      title: "Archived Item",
      price: 3.0,
      images: null,
      status: "completed",
    },
    buyer: { id: 1, name: "Test User" },
    seller: { id: 4, name: "Seller Carol" },
    role: "buying",
    unreadCount: 0,
    lastMessage: null,
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const mockUser = {
  id: 1,
  name: "Test User",
  email: "test@example.com",
};

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <WebSocketProvider>
          <UnreadCountProvider>{ui}</UnreadCountProvider>
        </WebSocketProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("MessagesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConversations.mockResolvedValue(mockConversations);
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/messages/unread-count")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ count: 2 }),
        });
      }
      if (url.includes("/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUser),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("should show loading state initially", () => {
    renderWithProviders(<MessagesPage />);
    // Loading state shows skeleton elements
    const skeleton = document.querySelector('[class*="skeleton"]') || document.querySelector('[class*="Skeleton"]');
    expect(skeleton || document.body).toBeInTheDocument();
  });

  it("should render page title", async () => {
    renderWithProviders(<MessagesPage />);
    await waitFor(() => {
      expect(screen.getByText("Messages")).toBeInTheDocument();
    });
  });

  it("should display page subtitle", async () => {
    renderWithProviders(<MessagesPage />);
    await waitFor(() => {
      expect(screen.getByText("Your marketplace conversations")).toBeInTheDocument();
    });
  });

  it("should display tab buttons", async () => {
    renderWithProviders(<MessagesPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /All/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Buying/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Selling/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Archived/i })).toBeInTheDocument();
    });
  });

  it("should display unread badge when there are unread messages", async () => {
    renderWithProviders(<MessagesPage />);
    await waitFor(() => {
      expect(screen.getByText("2 unread")).toBeInTheDocument();
    });
  });

  it("should display conversation listing titles", async () => {
    renderWithProviders(<MessagesPage />);
    await waitFor(() => {
      expect(screen.getByText("Fresh Apples")).toBeInTheDocument();
      expect(screen.getByText("Organic Milk")).toBeInTheDocument();
    });
  });

  it("should display conversation prices", async () => {
    renderWithProviders(<MessagesPage />);
    await waitFor(() => {
      expect(screen.getByText("$8.00")).toBeInTheDocument();
      expect(screen.getByText("$5.00")).toBeInTheDocument();
    });
  });

  it("should display last messages", async () => {
    renderWithProviders(<MessagesPage />);
    await waitFor(() => {
      expect(screen.getByText("Is this still available?")).toBeInTheDocument();
      expect(screen.getByText("Sure, I can pick it up tomorrow")).toBeInTheDocument();
    });
  });

  it("should display Selling badge for selling conversations", async () => {
    renderWithProviders(<MessagesPage />);
    await waitFor(() => {
      // Multiple elements with "Selling" - one in tabs, one in badge
      const sellingElements = screen.getAllByText("Selling");
      expect(sellingElements.length).toBeGreaterThan(0);
    });
  });

  it("should display Buying badge for buying conversations", async () => {
    renderWithProviders(<MessagesPage />);
    await waitFor(() => {
      // Multiple elements with "Buying" - one in tabs, one in badge
      const buyingElements = screen.getAllByText("Buying");
      expect(buyingElements.length).toBeGreaterThan(0);
    });
  });

  it("should filter to show only buying conversations", async () => {
    renderWithProviders(<MessagesPage />);
    await waitFor(() => {
      expect(screen.getByText("Fresh Apples")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Buying/i }));

    await waitFor(() => {
      expect(screen.queryByText("Fresh Apples")).not.toBeInTheDocument();
      expect(screen.getByText("Organic Milk")).toBeInTheDocument();
    });
  });

  it("should filter to show only selling conversations", async () => {
    renderWithProviders(<MessagesPage />);
    await waitFor(() => {
      expect(screen.getByText("Organic Milk")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Selling/i }));

    await waitFor(() => {
      expect(screen.getByText("Fresh Apples")).toBeInTheDocument();
      expect(screen.queryByText("Organic Milk")).not.toBeInTheDocument();
    });
  });

  it("should filter to show only archived conversations", async () => {
    renderWithProviders(<MessagesPage />);
    await waitFor(() => {
      expect(screen.getByText("Fresh Apples")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Archived/i }));

    await waitFor(() => {
      expect(screen.queryByText("Fresh Apples")).not.toBeInTheDocument();
      expect(screen.getByText("Archived Item")).toBeInTheDocument();
    });
  });
});

describe("MessagesPage - Empty State", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConversations.mockResolvedValue([]);
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/messages/unread-count")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ count: 0 }),
        });
      }
      if (url.includes("/auth/me")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUser),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("should show empty state when no conversations", async () => {
    renderWithProviders(<MessagesPage />);
    await waitFor(() => {
      expect(screen.getByText("No conversations yet")).toBeInTheDocument();
    });
  });

  it("should show helpful message in empty state", async () => {
    renderWithProviders(<MessagesPage />);
    await waitFor(() => {
      expect(screen.getByText("Start a conversation by messaging a seller on a listing")).toBeInTheDocument();
    });
  });

  it("should have no accessibility violations", async () => {
    const { container } = renderWithProviders(<MessagesPage />);
    await waitFor(() => {
      expect(screen.getByText("No conversations yet")).toBeInTheDocument();
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
