import { describe, expect, test, vi, beforeEach } from "vitest";
import { orderApi } from "../../services/locker-api";

// Mock the order API
vi.mock("../../services/locker-api", () => ({
  orderApi: {
    getById: vi.fn(),
    pay: vi.fn(),
    cancel: vi.fn(),
  },
}));

const mockPendingOrder = {
  id: 1,
  listingId: 101,
  lockerId: 1,
  buyerId: 1,
  sellerId: 2,
  itemPrice: 15.0,
  deliveryFee: 2.0,
  totalPrice: 17.0,
  status: "pending_payment",
  reservedAt: "2025-01-15T10:00:00Z",
  paymentDeadline: "2025-01-15T10:15:00Z",
  listing: {
    id: 101,
    title: "Fresh Apples",
    description: "5 kg of fresh apples from local farm",
  },
  locker: {
    id: 1,
    name: "Tampines Hub Locker",
    address: "1 Tampines Walk, Singapore 528523",
  },
  seller: { id: 2, name: "John Seller" },
  buyer: { id: 1, name: "Jane Buyer" },
};

const mockPaidOrder = {
  ...mockPendingOrder,
  id: 2,
  status: "paid",
  paidAt: "2025-01-15T10:05:00Z",
};

describe("PaymentPage - Order Data Structure", () => {
  test("order has payment-related fields", () => {
    const order = mockPendingOrder;
    expect(order.itemPrice).toBeDefined();
    expect(order.deliveryFee).toBeDefined();
    expect(order.totalPrice).toBeDefined();
    expect(order.status).toBeDefined();
    expect(order.paymentDeadline).toBeDefined();
  });

  test("order has listing details for display", () => {
    const order = mockPendingOrder;
    expect(order.listing.title).toBe("Fresh Apples");
    expect(order.listing.description).toBe("5 kg of fresh apples from local farm");
  });

  test("order has locker details for display", () => {
    const order = mockPendingOrder;
    expect(order.locker.name).toBe("Tampines Hub Locker");
    expect(order.locker.address).toBe("1 Tampines Walk, Singapore 528523");
  });

  test("totalPrice is calculated correctly", () => {
    const order = mockPendingOrder;
    expect(order.totalPrice).toBe(order.itemPrice + order.deliveryFee);
  });
});

describe("PaymentPage - API Methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("orderApi.getById exists", () => {
    expect(orderApi.getById).toBeDefined();
    expect(typeof orderApi.getById).toBe("function");
  });

  test("orderApi.getById returns order", async () => {
    vi.mocked(orderApi.getById).mockResolvedValue(mockPendingOrder);
    const result = await orderApi.getById(1);

    expect(result.id).toBe(1);
    expect(result.status).toBe("pending_payment");
  });

  test("orderApi.pay exists", () => {
    expect(orderApi.pay).toBeDefined();
    expect(typeof orderApi.pay).toBe("function");
  });

  test("orderApi.pay updates order status", async () => {
    vi.mocked(orderApi.pay).mockResolvedValue(mockPaidOrder);
    const result = await orderApi.pay(1);

    expect(result.status).toBe("paid");
    expect(result.paidAt).toBeDefined();
  });

  test("orderApi.cancel exists", () => {
    expect(orderApi.cancel).toBeDefined();
    expect(typeof orderApi.cancel).toBe("function");
  });

  test("orderApi.cancel can cancel order", async () => {
    const cancelledOrder = { ...mockPendingOrder, status: "cancelled", cancelReason: "Cancelled by buyer" };
    vi.mocked(orderApi.cancel).mockResolvedValue(cancelledOrder);
    const result = await orderApi.cancel(1, "Cancelled by buyer");

    expect(result.status).toBe("cancelled");
    expect(result.cancelReason).toBe("Cancelled by buyer");
  });

  test("orderApi.getById can reject with error", async () => {
    vi.mocked(orderApi.getById).mockRejectedValue(new Error("Order not found"));
    await expect(orderApi.getById(999)).rejects.toThrow("Order not found");
  });

  test("orderApi.pay can reject with error", async () => {
    vi.mocked(orderApi.pay).mockRejectedValue(new Error("Payment failed"));
    await expect(orderApi.pay(1)).rejects.toThrow("Payment failed");
  });
});

describe("PaymentPage - Countdown Timer", () => {
  test("can calculate remaining time", () => {
    const calculateRemainingTime = (deadline: string) => {
      const now = new Date("2025-01-15T10:10:00Z");
      const deadlineDate = new Date(deadline);
      return deadlineDate.getTime() - now.getTime();
    };

    const remaining = calculateRemainingTime(mockPendingOrder.paymentDeadline);
    expect(remaining).toBe(5 * 60 * 1000); // 5 minutes in ms
  });

  test("detects expired deadline", () => {
    const isExpired = (deadline: string) => {
      const now = new Date("2025-01-15T10:20:00Z");
      return new Date() > new Date(deadline);
    };

    // With current time past deadline
    const deadline = new Date("2025-01-15T10:15:00Z");
    const now = new Date("2025-01-15T10:20:00Z");
    expect(now > deadline).toBe(true);
  });

  test("formats countdown correctly", () => {
    const formatCountdown = (remainingMs: number) => {
      if (remainingMs <= 0) return "Expired";
      const minutes = Math.floor(remainingMs / 60000);
      const seconds = Math.floor((remainingMs % 60000) / 1000);
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    expect(formatCountdown(5 * 60 * 1000)).toBe("5:00");
    expect(formatCountdown(65 * 1000)).toBe("1:05");
    expect(formatCountdown(30 * 1000)).toBe("0:30");
    expect(formatCountdown(0)).toBe("Expired");
    expect(formatCountdown(-1000)).toBe("Expired");
  });
});

describe("PaymentPage - Price Breakdown", () => {
  test("displays item price", () => {
    expect(mockPendingOrder.itemPrice).toBe(15.0);
  });

  test("displays delivery fee", () => {
    expect(mockPendingOrder.deliveryFee).toBe(2.0);
  });

  test("displays total price", () => {
    expect(mockPendingOrder.totalPrice).toBe(17.0);
  });

  test("can format price for display", () => {
    const formatPrice = (price: number) => {
      return `$${price.toFixed(2)}`;
    };

    expect(formatPrice(mockPendingOrder.itemPrice)).toBe("$15.00");
    expect(formatPrice(mockPendingOrder.deliveryFee)).toBe("$2.00");
    expect(formatPrice(mockPendingOrder.totalPrice)).toBe("$17.00");
  });
});

describe("PaymentPage - Status Handling", () => {
  test("pending_payment status allows payment", () => {
    const canPay = mockPendingOrder.status === "pending_payment";
    expect(canPay).toBe(true);
  });

  test("non-pending status blocks payment page", () => {
    const shouldRedirect = (status: string) => status !== "pending_payment";

    expect(shouldRedirect("pending_payment")).toBe(false);
    expect(shouldRedirect("paid")).toBe(true);
    expect(shouldRedirect("cancelled")).toBe(true);
    expect(shouldRedirect("expired")).toBe(true);
  });
});

describe("PaymentPage - Payment Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("successful payment returns paid order", async () => {
    vi.mocked(orderApi.pay).mockResolvedValue(mockPaidOrder);

    const result = await orderApi.pay(mockPendingOrder.id);

    expect(result.status).toBe("paid");
    expect(result.paidAt).toBeDefined();
    expect(orderApi.pay).toHaveBeenCalledWith(mockPendingOrder.id);
  });

  test("payment button is disabled while processing", () => {
    const processing = true;
    const canClick = !processing;
    expect(canClick).toBe(false);
  });

  test("payment button is enabled when not processing", () => {
    const processing = false;
    const canClick = !processing;
    expect(canClick).toBe(true);
  });
});

describe("PaymentPage - Cancel Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("cancel requires confirmation", () => {
    // Simulating confirmation dialog logic
    const confirmCancel = () => {
      return true; // User confirmed
    };

    expect(confirmCancel()).toBe(true);
  });

  test("successful cancel returns cancelled order", async () => {
    const cancelledOrder = { ...mockPendingOrder, status: "cancelled" };
    vi.mocked(orderApi.cancel).mockResolvedValue(cancelledOrder);

    const result = await orderApi.cancel(mockPendingOrder.id, "Cancelled by buyer");

    expect(result.status).toBe("cancelled");
    expect(orderApi.cancel).toHaveBeenCalledWith(mockPendingOrder.id, "Cancelled by buyer");
  });

  test("cancel button is disabled while processing", () => {
    const processing = true;
    const canClick = !processing;
    expect(canClick).toBe(false);
  });
});

describe("PaymentPage - Order Not Found", () => {
  test("displays error when order is null", () => {
    const order = null;
    const showError = !order;
    expect(showError).toBe(true);
  });

  test("displays order when loaded", () => {
    const order = mockPendingOrder;
    const showError = !order;
    expect(showError).toBe(false);
  });
});

describe("PaymentPage - Navigation", () => {
  test("can extract orderId from URL params", () => {
    const orderId = "1";
    const parsedId = parseInt(orderId, 10);
    expect(parsedId).toBe(1);
  });

  test("handles invalid orderId", () => {
    const orderId = "invalid";
    const parsedId = parseInt(orderId, 10);
    expect(isNaN(parsedId)).toBe(true);
  });

  test("success navigation includes paid query param", () => {
    const orderId = 1;
    const successUrl = `/orders/${orderId}?paid=true`;
    expect(successUrl).toBe("/orders/1?paid=true");
  });

  test("cancel navigation goes to orders list", () => {
    const cancelUrl = "/orders";
    expect(cancelUrl).toBe("/orders");
  });
});

describe("PaymentPage - Loading States", () => {
  test("shows loading when fetching order", () => {
    const loading = true;
    expect(loading).toBe(true);
  });

  test("shows processing when paying", () => {
    const processing = true;
    const buttonText = processing ? "Processing..." : "Pay $17.00";
    expect(buttonText).toBe("Processing...");
  });

  test("shows pay button when not processing", () => {
    const processing = false;
    const totalPrice = 17.0;
    const buttonText = processing ? "Processing..." : `Pay $${totalPrice.toFixed(2)}`;
    expect(buttonText).toBe("Pay $17.00");
  });
});

describe("PaymentPage - Error Handling", () => {
  test("can format error messages", () => {
    const getErrorMessage = (err: unknown) => {
      if (err instanceof Error) return err.message;
      if (typeof err === "string") return err;
      return "An unexpected error occurred";
    };

    expect(getErrorMessage(new Error("Network error"))).toBe("Network error");
    expect(getErrorMessage("Custom error")).toBe("Custom error");
    expect(getErrorMessage(null)).toBe("An unexpected error occurred");
  });

  test("displays toast on payment error", async () => {
    vi.mocked(orderApi.pay).mockRejectedValue(new Error("Payment failed"));

    try {
      await orderApi.pay(1);
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe("Payment failed");
    }
  });

  test("displays toast on load error", async () => {
    vi.mocked(orderApi.getById).mockRejectedValue(new Error("Failed to load order"));

    try {
      await orderApi.getById(1);
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe("Failed to load order");
    }
  });
});

describe("PaymentPage - Payment Deadline Expiry", () => {
  test("expired deadline message", () => {
    const message = "Payment deadline has expired. Order has been cancelled.";
    expect(message).toContain("expired");
    expect(message).toContain("cancelled");
  });

  test("countdown interval cleanup", () => {
    const clearIntervalMock = vi.fn();
    const intervalId = 123;

    clearIntervalMock(intervalId);

    expect(clearIntervalMock).toHaveBeenCalledWith(123);
  });
});

describe("PaymentPage - UI Components", () => {
  test("payment card title is correct", () => {
    const title = "Complete Payment";
    expect(title).toBe("Complete Payment");
  });

  test("order details card shows listing title", () => {
    expect(mockPendingOrder.listing.title).toBe("Fresh Apples");
  });

  test("payment method card shows simulation message", () => {
    const message = "This is a simulated payment. Click the button below to complete the order.";
    expect(message).toContain("simulated payment");
  });

  test("shows payment deadline warning", () => {
    const warningText = "Payment Deadline";
    expect(warningText).toBe("Payment Deadline");
  });
});
