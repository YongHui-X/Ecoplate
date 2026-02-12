import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { WS_EVENTS } from "../services/websocket";

// Store subscriptions for triggering events in tests
let wsSubscriptions: Array<{
  eventType: string;
  callback: (payload: unknown) => void;
}> = [];

// Mock the websocket service - must be before any imports that use it
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

// Import after mocks are defined
import { WebSocketProvider, useWebSocket } from "./WebSocketContext";
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

// Helper to trigger WebSocket events
function triggerWsEvent(eventType: string, payload: unknown) {
  for (const sub of wsSubscriptions) {
    if (sub.eventType === eventType) {
      sub.callback(payload);
    }
  }
}

// Test component that uses the WebSocket context
function TestConsumer() {
  const { isConnected, connectionState, subscribe } = useWebSocket();
  return (
    <div>
      <span data-testid="is-connected">{String(isConnected)}</span>
      <span data-testid="connection-state">{connectionState}</span>
      <button
        data-testid="subscribe-button"
        onClick={() => {
          subscribe(WS_EVENTS.NEW_MESSAGE, (payload) => {
            console.log("Received:", payload);
          });
        }}
      >
        Subscribe
      </button>
    </div>
  );
}

describe("WebSocketContext", () => {
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

  describe("WebSocketProvider", () => {
    it("should render children", () => {
      render(
        <WebSocketProvider>
          <div data-testid="child">Child Content</div>
        </WebSocketProvider>
      );

      expect(screen.getByTestId("child")).toHaveTextContent("Child Content");
    });

    it("should provide context values", () => {
      render(
        <WebSocketProvider>
          <TestConsumer />
        </WebSocketProvider>
      );

      expect(screen.getByTestId("is-connected")).toHaveTextContent("false");
      expect(screen.getByTestId("connection-state")).toHaveTextContent(
        "disconnected"
      );
    });

    it("should connect when token is present in localStorage", () => {
      localStorageMock.store.token = "test-token";

      render(
        <WebSocketProvider>
          <TestConsumer />
        </WebSocketProvider>
      );

      expect(wsService.connect).toHaveBeenCalledWith("test-token");
    });

    it("should not connect when no token is present", () => {
      render(
        <WebSocketProvider>
          <TestConsumer />
        </WebSocketProvider>
      );

      expect(wsService.connect).not.toHaveBeenCalled();
    });

    it("should subscribe to connection_established event", () => {
      render(
        <WebSocketProvider>
          <TestConsumer />
        </WebSocketProvider>
      );

      expect(wsService.subscribe).toHaveBeenCalledWith(
        WS_EVENTS.CONNECTION_ESTABLISHED,
        expect.any(Function)
      );
    });

    it("should disconnect on unmount", () => {
      const { unmount } = render(
        <WebSocketProvider>
          <TestConsumer />
        </WebSocketProvider>
      );

      unmount();

      expect(wsService.disconnect).toHaveBeenCalled();
    });

    it("should connect on auth:login event", () => {
      localStorageMock.store.token = "new-token";

      render(
        <WebSocketProvider>
          <TestConsumer />
        </WebSocketProvider>
      );

      // Clear initial connect call
      vi.mocked(wsService.connect).mockClear();

      // Trigger auth:login event
      if (eventListeners["auth:login"]) {
        act(() => {
          eventListeners["auth:login"].forEach((handler) =>
            handler(new Event("auth:login"))
          );
        });
      }

      expect(wsService.connect).toHaveBeenCalledWith("new-token");
    });

    it("should disconnect on auth:logout event", () => {
      render(
        <WebSocketProvider>
          <TestConsumer />
        </WebSocketProvider>
      );

      // Clear any previous calls
      vi.mocked(wsService.disconnect).mockClear();

      // Trigger auth:logout event
      if (eventListeners["auth:logout"]) {
        act(() => {
          eventListeners["auth:logout"].forEach((handler) =>
            handler(new Event("auth:logout"))
          );
        });
      }

      expect(wsService.disconnect).toHaveBeenCalled();
    });

    it("should update isConnected when connection_established is received", () => {
      render(
        <WebSocketProvider>
          <TestConsumer />
        </WebSocketProvider>
      );

      // Initial state
      expect(screen.getByTestId("is-connected")).toHaveTextContent("false");

      // Simulate connection established
      act(() => {
        triggerWsEvent("connection_established", { userId: 1 });
      });

      // State should update
      expect(screen.getByTestId("is-connected")).toHaveTextContent("true");
    });

    it("should check connection state periodically", () => {
      render(
        <WebSocketProvider>
          <TestConsumer />
        </WebSocketProvider>
      );

      // Fast-forward 1 second
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(wsService.getState).toHaveBeenCalled();
    });
  });

  describe("useWebSocket hook", () => {
    it("should throw error when used outside provider", () => {
      // Suppress console.error for this test
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow("useWebSocket must be used within a WebSocketProvider");

      consoleSpy.mockRestore();
    });

    it("should provide subscribe function", () => {
      render(
        <WebSocketProvider>
          <TestConsumer />
        </WebSocketProvider>
      );

      expect(screen.getByTestId("subscribe-button")).toBeInTheDocument();
    });

    it("should return isConnected state", () => {
      render(
        <WebSocketProvider>
          <TestConsumer />
        </WebSocketProvider>
      );

      expect(screen.getByTestId("is-connected")).toHaveTextContent("false");
    });

    it("should return connectionState", () => {
      render(
        <WebSocketProvider>
          <TestConsumer />
        </WebSocketProvider>
      );

      expect(screen.getByTestId("connection-state")).toHaveTextContent(
        "disconnected"
      );
    });
  });

  describe("WS_EVENTS export", () => {
    it("should export correct event constants", () => {
      expect(WS_EVENTS.CONNECTION_ESTABLISHED).toBe("connection_established");
      expect(WS_EVENTS.NEW_MESSAGE).toBe("new_message");
      expect(WS_EVENTS.UNREAD_COUNT_UPDATE).toBe("unread_count_update");
      expect(WS_EVENTS.PONG).toBe("pong");
    });
  });
});
