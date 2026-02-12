import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// Store subscriptions for triggering events in tests
let wsSubscriptions: Array<{
  eventType: string;
  callback: (payload: unknown) => void;
}> = [];

// Mock the messageService
vi.mock("../services/messages", () => ({
  messageService: {
    getUnreadCount: vi.fn(() => Promise.resolve({ count: 0 })),
  },
}));

// Mock the websocket service
vi.mock("../services/websocket", () => ({
  WS_EVENTS: {
    CONNECTION_ESTABLISHED: "connection_established",
    NEW_MESSAGE: "new_message",
    UNREAD_COUNT_UPDATE: "unread_count_update",
    PONG: "pong",
  },
  wsService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn(
      (eventType: string, callback: (payload: unknown) => void) => {
        const subscription = { eventType, callback };
        wsSubscriptions.push(subscription);
        return () => {
          const index = wsSubscriptions.indexOf(subscription);
          if (index !== -1) wsSubscriptions.splice(index, 1);
        };
      }
    ),
    isConnected: vi.fn(() => false),
    getState: vi.fn(() => "disconnected" as const),
  },
}));

// Import after mocks
import { UnreadCountProvider, useUnreadCount } from "./UnreadCountContext";
import { WebSocketProvider } from "./WebSocketContext";
import { messageService } from "../services/messages";
import { wsService } from "../services/websocket";

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
};
Object.defineProperty(global, "localStorage", { value: localStorageMock });

// Mock window events
const eventListeners: Record<string, Array<(event: Event) => void>> = {};
const originalAddEventListener = window.addEventListener;
const originalRemoveEventListener = window.removeEventListener;

// Test component that uses the unread count context
function TestConsumer() {
  const { unreadCount, refreshUnreadCount } = useUnreadCount();
  return (
    <div>
      <span data-testid="unread-count">{unreadCount}</span>
      <button data-testid="refresh-button" onClick={refreshUnreadCount}>
        Refresh
      </button>
    </div>
  );
}

// Helper to trigger WebSocket events
function triggerWsEvent(eventType: string, payload: unknown) {
  for (const sub of wsSubscriptions) {
    if (sub.eventType === eventType) {
      sub.callback(payload);
    }
  }
}

describe("UnreadCountContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.store = {};
    wsSubscriptions = [];
    vi.useFakeTimers();

    // Setup event listener mocks
    window.addEventListener = vi.fn((event: string, handler: EventListener) => {
      if (!eventListeners[event]) {
        eventListeners[event] = [];
      }
      eventListeners[event].push(handler as (event: Event) => void);
    });
    window.removeEventListener = vi.fn(
      (event: string, handler: EventListener) => {
        if (eventListeners[event]) {
          const index = eventListeners[event].indexOf(
            handler as (event: Event) => void
          );
          if (index !== -1) {
            eventListeners[event].splice(index, 1);
          }
        }
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
    Object.keys(eventListeners).forEach((key) => delete eventListeners[key]);
  });

  describe("UnreadCountProvider", () => {
    it("should render children", () => {
      render(
        <WebSocketProvider>
          <UnreadCountProvider>
            <div data-testid="child">Child Content</div>
          </UnreadCountProvider>
        </WebSocketProvider>
      );

      expect(screen.getByTestId("child")).toHaveTextContent("Child Content");
    });

    it("should provide initial unread count of 0", () => {
      render(
        <WebSocketProvider>
          <UnreadCountProvider>
            <TestConsumer />
          </UnreadCountProvider>
        </WebSocketProvider>
      );

      expect(screen.getByTestId("unread-count")).toHaveTextContent("0");
    });

    it("should use cached count from localStorage", () => {
      localStorageMock.store.ecoplate_unread_count = "5";

      render(
        <WebSocketProvider>
          <UnreadCountProvider>
            <TestConsumer />
          </UnreadCountProvider>
        </WebSocketProvider>
      );

      expect(screen.getByTestId("unread-count")).toHaveTextContent("5");
    });

    it("should call getUnreadCount when user is logged in", () => {
      vi.mocked(messageService.getUnreadCount).mockResolvedValue({ count: 3 });
      localStorageMock.store.token = "test-token";

      render(
        <WebSocketProvider>
          <UnreadCountProvider>
            <TestConsumer />
          </UnreadCountProvider>
        </WebSocketProvider>
      );

      expect(messageService.getUnreadCount).toHaveBeenCalled();
    });

    it("should not call getUnreadCount when user is not logged in", () => {
      // No token in localStorage
      render(
        <WebSocketProvider>
          <UnreadCountProvider>
            <TestConsumer />
          </UnreadCountProvider>
        </WebSocketProvider>
      );

      expect(messageService.getUnreadCount).not.toHaveBeenCalled();
    });

    it("should subscribe to unread_count_update WebSocket events", () => {
      render(
        <WebSocketProvider>
          <UnreadCountProvider>
            <TestConsumer />
          </UnreadCountProvider>
        </WebSocketProvider>
      );

      // Check that a subscription was registered for unread_count_update
      const hasUnreadCountSub = wsSubscriptions.some(
        (sub) => sub.eventType === "unread_count_update"
      );
      expect(hasUnreadCountSub).toBe(true);
    });

    it("should update count when WebSocket event is received", () => {
      render(
        <WebSocketProvider>
          <UnreadCountProvider>
            <TestConsumer />
          </UnreadCountProvider>
        </WebSocketProvider>
      );

      expect(screen.getByTestId("unread-count")).toHaveTextContent("0");

      // Trigger WebSocket event
      act(() => {
        triggerWsEvent("unread_count_update", { count: 7 });
      });

      expect(screen.getByTestId("unread-count")).toHaveTextContent("7");
    });

    it("should cache count to localStorage on WebSocket update", () => {
      render(
        <WebSocketProvider>
          <UnreadCountProvider>
            <TestConsumer />
          </UnreadCountProvider>
        </WebSocketProvider>
      );

      act(() => {
        triggerWsEvent("unread_count_update", { count: 12 });
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "ecoplate_unread_count",
        "12"
      );
    });

    it("should poll every 60 seconds when WebSocket is not connected", () => {
      vi.mocked(wsService.isConnected).mockReturnValue(false);
      vi.mocked(messageService.getUnreadCount).mockResolvedValue({ count: 1 });
      localStorageMock.store.token = "test-token";

      render(
        <WebSocketProvider>
          <UnreadCountProvider>
            <TestConsumer />
          </UnreadCountProvider>
        </WebSocketProvider>
      );

      // Clear initial call
      vi.mocked(messageService.getUnreadCount).mockClear();

      // Advance 60 seconds
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      expect(messageService.getUnreadCount).toHaveBeenCalled();
    });

    it("should call refreshUnreadCount on auth:login event", () => {
      vi.mocked(messageService.getUnreadCount).mockResolvedValue({ count: 2 });
      localStorageMock.store.token = "test-token";

      render(
        <WebSocketProvider>
          <UnreadCountProvider>
            <TestConsumer />
          </UnreadCountProvider>
        </WebSocketProvider>
      );

      vi.mocked(messageService.getUnreadCount).mockClear();

      // Trigger auth:login event
      if (eventListeners["auth:login"]) {
        act(() => {
          eventListeners["auth:login"].forEach((handler) =>
            handler(new Event("auth:login"))
          );
        });
      }

      expect(messageService.getUnreadCount).toHaveBeenCalled();
    });
  });

  describe("useUnreadCount hook", () => {
    it("should throw error when used outside provider", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow("useUnreadCount must be used within UnreadCountProvider");

      consoleSpy.mockRestore();
    });

    it("should call getUnreadCount when refreshUnreadCount is called", () => {
      vi.mocked(messageService.getUnreadCount).mockResolvedValue({ count: 8 });
      localStorageMock.store.token = "test-token";

      render(
        <WebSocketProvider>
          <UnreadCountProvider>
            <TestConsumer />
          </UnreadCountProvider>
        </WebSocketProvider>
      );

      vi.mocked(messageService.getUnreadCount).mockClear();

      // Click refresh button
      const refreshButton = screen.getByTestId("refresh-button");
      act(() => {
        refreshButton.click();
      });

      expect(messageService.getUnreadCount).toHaveBeenCalled();
    });
  });

  describe("localStorage caching", () => {
    it("should handle invalid cached value gracefully", () => {
      localStorageMock.store.ecoplate_unread_count = "invalid";

      render(
        <WebSocketProvider>
          <UnreadCountProvider>
            <TestConsumer />
          </UnreadCountProvider>
        </WebSocketProvider>
      );

      // Should fall back to 0 for invalid value
      expect(screen.getByTestId("unread-count")).toHaveTextContent("0");
    });
  });

  describe("error handling", () => {
    it("should keep cached value when API fails", () => {
      vi.mocked(messageService.getUnreadCount).mockRejectedValue(
        new Error("API Error")
      );
      localStorageMock.store.token = "test-token";
      localStorageMock.store.ecoplate_unread_count = "5";

      render(
        <WebSocketProvider>
          <UnreadCountProvider>
            <TestConsumer />
          </UnreadCountProvider>
        </WebSocketProvider>
      );

      // Should show cached value initially
      expect(screen.getByTestId("unread-count")).toHaveTextContent("5");
    });

    it("should reset to 0 when user logs out", () => {
      localStorageMock.store.ecoplate_unread_count = "10";
      localStorageMock.store.token = "test-token";

      render(
        <WebSocketProvider>
          <UnreadCountProvider>
            <TestConsumer />
          </UnreadCountProvider>
        </WebSocketProvider>
      );

      // Remove token (simulate logout)
      delete localStorageMock.store.token;

      // Trigger refresh
      const refreshButton = screen.getByTestId("refresh-button");
      act(() => {
        refreshButton.click();
      });

      expect(screen.getByTestId("unread-count")).toHaveTextContent("0");
    });
  });
});
