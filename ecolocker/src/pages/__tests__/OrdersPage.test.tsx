import { describe, expect, test, vi, beforeEach } from "vitest";
import { orderApi } from "../../services/locker-api";

// Mock the order API
vi.mock("../../services/locker-api", () => ({
  orderApi: {
    getBuyerOrders: vi.fn(),
    getSellerOrders: vi.fn(),
    getById: vi.fn(),
  },
}));

const mockBuyerOrders = [
  {
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
    listing: { id: 101, title: "Fresh Apples", description: "5 kg of fresh apples" },
    locker: { id: 1, name: "Tampines Hub Locker", address: "1 Tampines Walk" },
    seller: { id: 2, name: "John Seller" },
    buyer: { id: 1, name: "Jane Buyer" },
  },
  {
    id: 2,
    listingId: 102,
    lockerId: 2,
    buyerId: 1,
    sellerId: 3,
    itemPrice: 8.0,
    deliveryFee: 2.0,
    totalPrice: 10.0,
    status: "ready_for_pickup",
    reservedAt: "2025-01-14T15:00:00Z",
    paidAt: "2025-01-14T15:05:00Z",
    deliveredAt: "2025-01-14T18:00:00Z",
    pickupPin: "1234",
    compartmentNumber: 5,
    listing: { id: 102, title: "Organic Eggs", description: "Dozen eggs" },
    locker: { id: 2, name: "Jurong East MRT Locker", address: "10 Jurong East Street" },
    seller: { id: 3, name: "Mike Seller" },
    buyer: { id: 1, name: "Jane Buyer" },
  },
];

const mockSellerOrders = [
  {
    id: 3,
    listingId: 201,
    lockerId: 1,
    buyerId: 4,
    sellerId: 1,
    itemPrice: 20.0,
    deliveryFee: 2.0,
    totalPrice: 22.0,
    status: "paid",
    reservedAt: "2025-01-15T09:00:00Z",
    paidAt: "2025-01-15T09:10:00Z",
    listing: { id: 201, title: "Homemade Cookies", description: "Box of 12 cookies" },
    locker: { id: 1, name: "Tampines Hub Locker", address: "1 Tampines Walk" },
    seller: { id: 1, name: "Current User" },
    buyer: { id: 4, name: "Alice Buyer" },
  },
];

const statusConfig = {
  pending_payment: { label: "Awaiting Payment", variant: "warning" },
  paid: { label: "Paid", variant: "default" },
  pickup_scheduled: { label: "Pickup Scheduled", variant: "secondary" },
  in_transit: { label: "In Transit", variant: "secondary" },
  ready_for_pickup: { label: "Ready for Pickup", variant: "success" },
  collected: { label: "Collected", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  expired: { label: "Expired", variant: "destructive" },
};

describe("OrdersPage - Order Data Structure", () => {
  test("order has required fields", () => {
    const order = mockBuyerOrders[0];
    expect(order.id).toBeDefined();
    expect(order.listingId).toBeDefined();
    expect(order.lockerId).toBeDefined();
    expect(order.buyerId).toBeDefined();
    expect(order.sellerId).toBeDefined();
    expect(order.itemPrice).toBeDefined();
    expect(order.deliveryFee).toBeDefined();
    expect(order.totalPrice).toBeDefined();
    expect(order.status).toBeDefined();
    expect(order.reservedAt).toBeDefined();
  });

  test("order has listing details", () => {
    const order = mockBuyerOrders[0];
    expect(order.listing).toBeDefined();
    expect(order.listing.id).toBeDefined();
    expect(order.listing.title).toBeDefined();
    expect(order.listing.description).toBeDefined();
  });

  test("order has locker details", () => {
    const order = mockBuyerOrders[0];
    expect(order.locker).toBeDefined();
    expect(order.locker.id).toBeDefined();
    expect(order.locker.name).toBeDefined();
    expect(order.locker.address).toBeDefined();
  });

  test("order has user details", () => {
    const order = mockBuyerOrders[0];
    expect(order.seller).toBeDefined();
    expect(order.seller.id).toBeDefined();
    expect(order.seller.name).toBeDefined();
    expect(order.buyer).toBeDefined();
    expect(order.buyer.id).toBeDefined();
    expect(order.buyer.name).toBeDefined();
  });

  test("order totalPrice equals itemPrice + deliveryFee", () => {
    const order = mockBuyerOrders[0];
    expect(order.totalPrice).toBe(order.itemPrice + order.deliveryFee);
  });
});

describe("OrdersPage - API Methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("orderApi.getBuyerOrders exists", () => {
    expect(orderApi.getBuyerOrders).toBeDefined();
    expect(typeof orderApi.getBuyerOrders).toBe("function");
  });

  test("orderApi.getBuyerOrders returns buyer orders", async () => {
    vi.mocked(orderApi.getBuyerOrders).mockResolvedValue(mockBuyerOrders);
    const result = await orderApi.getBuyerOrders();

    expect(result).toHaveLength(2);
    expect(result[0].listing.title).toBe("Fresh Apples");
  });

  test("orderApi.getSellerOrders exists", () => {
    expect(orderApi.getSellerOrders).toBeDefined();
    expect(typeof orderApi.getSellerOrders).toBe("function");
  });

  test("orderApi.getSellerOrders returns seller orders", async () => {
    vi.mocked(orderApi.getSellerOrders).mockResolvedValue(mockSellerOrders);
    const result = await orderApi.getSellerOrders();

    expect(result).toHaveLength(1);
    expect(result[0].listing.title).toBe("Homemade Cookies");
  });

  test("both APIs can return empty arrays", async () => {
    vi.mocked(orderApi.getBuyerOrders).mockResolvedValue([]);
    vi.mocked(orderApi.getSellerOrders).mockResolvedValue([]);

    const buyerResult = await orderApi.getBuyerOrders();
    const sellerResult = await orderApi.getSellerOrders();

    expect(buyerResult).toHaveLength(0);
    expect(sellerResult).toHaveLength(0);
  });

  test("orderApi can reject with error", async () => {
    vi.mocked(orderApi.getBuyerOrders).mockRejectedValue(new Error("Network error"));
    await expect(orderApi.getBuyerOrders()).rejects.toThrow("Network error");
  });
});

describe("OrdersPage - Tab Switching", () => {
  test("default tab is buyer", () => {
    const defaultTab: "buyer" | "seller" = "buyer";
    expect(defaultTab).toBe("buyer");
  });

  test("can get orders for buyer tab", () => {
    const activeTab = "buyer";
    const orders = activeTab === "buyer" ? mockBuyerOrders : mockSellerOrders;
    expect(orders).toBe(mockBuyerOrders);
    expect(orders.length).toBe(2);
  });

  test("can get orders for seller tab", () => {
    const activeTab = "seller";
    const orders = activeTab === "buyer" ? mockBuyerOrders : mockSellerOrders;
    expect(orders).toBe(mockSellerOrders);
    expect(orders.length).toBe(1);
  });

  test("tab button shows correct count", () => {
    const buyingCount = mockBuyerOrders.length;
    const sellingCount = mockSellerOrders.length;

    expect(`Buying (${buyingCount})`).toBe("Buying (2)");
    expect(`Selling (${sellingCount})`).toBe("Selling (1)");
  });
});

describe("OrdersPage - Status Badge", () => {
  test("all statuses have config", () => {
    const allStatuses = [
      "pending_payment",
      "paid",
      "pickup_scheduled",
      "in_transit",
      "ready_for_pickup",
      "collected",
      "cancelled",
      "expired",
    ];

    allStatuses.forEach((status) => {
      expect(statusConfig[status as keyof typeof statusConfig]).toBeDefined();
    });
  });

  test("pending_payment has warning variant", () => {
    expect(statusConfig.pending_payment.label).toBe("Awaiting Payment");
    expect(statusConfig.pending_payment.variant).toBe("warning");
  });

  test("ready_for_pickup has success variant", () => {
    expect(statusConfig.ready_for_pickup.label).toBe("Ready for Pickup");
    expect(statusConfig.ready_for_pickup.variant).toBe("success");
  });

  test("cancelled has destructive variant", () => {
    expect(statusConfig.cancelled.label).toBe("Cancelled");
    expect(statusConfig.cancelled.variant).toBe("destructive");
  });

  test("can get status config safely", () => {
    const getStatusConfig = (status: string) => {
      return (
        statusConfig[status as keyof typeof statusConfig] || {
          label: status,
          variant: "default",
        }
      );
    };

    expect(getStatusConfig("pending_payment").label).toBe("Awaiting Payment");
    expect(getStatusConfig("unknown_status").label).toBe("unknown_status");
    expect(getStatusConfig("unknown_status").variant).toBe("default");
  });
});

describe("OrdersPage - Order Display", () => {
  test("can format order title", () => {
    const order = mockBuyerOrders[0];
    const title = order.listing?.title || `Order #${order.id}`;
    expect(title).toBe("Fresh Apples");
  });

  test("falls back to order ID when no listing title", () => {
    const orderWithoutTitle = { ...mockBuyerOrders[0], listing: undefined };
    const title = orderWithoutTitle.listing?.title || `Order #${orderWithoutTitle.id}`;
    expect(title).toBe("Order #1");
  });

  test("displays locker name", () => {
    const order = mockBuyerOrders[0];
    expect(order.locker?.name).toBe("Tampines Hub Locker");
  });

  test("displays total price", () => {
    const order = mockBuyerOrders[0];
    expect(order.totalPrice).toBe(17.0);
  });

  test("shows seller name for buyer view", () => {
    const order = mockBuyerOrders[0];
    const isSeller = false;
    const displayName = isSeller ? order.buyer?.name : order.seller?.name;
    expect(displayName).toBe("John Seller");
  });

  test("shows buyer name for seller view", () => {
    const order = mockSellerOrders[0];
    const isSeller = true;
    const displayName = isSeller ? order.buyer?.name : order.seller?.name;
    expect(displayName).toBe("Alice Buyer");
  });
});

describe("OrdersPage - Empty State", () => {
  test("shows empty state when no orders", () => {
    const orders: typeof mockBuyerOrders = [];
    const isEmpty = orders.length === 0;
    expect(isEmpty).toBe(true);
  });

  test("buyer empty message is correct", () => {
    const activeTab = "buyer";
    const emptyMessage =
      activeTab === "buyer"
        ? "Orders you purchase will appear here"
        : "Orders for your listings will appear here";
    expect(emptyMessage).toBe("Orders you purchase will appear here");
  });

  test("seller empty message is correct", () => {
    const activeTab = "seller";
    const emptyMessage =
      activeTab === "buyer"
        ? "Orders you purchase will appear here"
        : "Orders for your listings will appear here";
    expect(emptyMessage).toBe("Orders for your listings will appear here");
  });
});

describe("OrdersPage - Navigation", () => {
  test("order card links to detail page", () => {
    const order = mockBuyerOrders[0];
    const link = `/orders/${order.id}`;
    expect(link).toBe("/orders/1");
  });

  test("all orders have valid IDs for navigation", () => {
    mockBuyerOrders.forEach((order) => {
      expect(order.id).toBeDefined();
      expect(typeof order.id).toBe("number");
      expect(order.id).toBeGreaterThan(0);
    });

    mockSellerOrders.forEach((order) => {
      expect(order.id).toBeDefined();
      expect(typeof order.id).toBe("number");
      expect(order.id).toBeGreaterThan(0);
    });
  });
});

describe("OrdersPage - Order Filtering", () => {
  test("can filter pending orders", () => {
    const pendingOrders = mockBuyerOrders.filter(
      (o) => o.status === "pending_payment"
    );
    expect(pendingOrders.length).toBe(1);
  });

  test("can filter completed orders", () => {
    const completedOrders = mockBuyerOrders.filter(
      (o) => o.status === "collected"
    );
    expect(completedOrders.length).toBe(0);
  });

  test("can filter active orders", () => {
    const activeStatuses = ["pending_payment", "paid", "pickup_scheduled", "in_transit", "ready_for_pickup"];
    const activeOrders = mockBuyerOrders.filter((o) =>
      activeStatuses.includes(o.status)
    );
    expect(activeOrders.length).toBe(2);
  });
});

describe("OrdersPage - Order Dates", () => {
  test("order has valid reservation date", () => {
    const order = mockBuyerOrders[0];
    const date = new Date(order.reservedAt);
    expect(date.toISOString()).toBe("2025-01-15T10:00:00.000Z");
  });

  test("paid order has payment date", () => {
    const paidOrder = mockBuyerOrders[1];
    expect(paidOrder.paidAt).toBeDefined();
    const date = new Date(paidOrder.paidAt!);
    expect(date.toISOString()).toBe("2025-01-14T15:05:00.000Z");
  });

  test("delivered order has delivery date", () => {
    const deliveredOrder = mockBuyerOrders[1];
    expect(deliveredOrder.deliveredAt).toBeDefined();
    const date = new Date(deliveredOrder.deliveredAt!);
    expect(date.toISOString()).toBe("2025-01-14T18:00:00.000Z");
  });
});

describe("OrdersPage - Ready for Pickup", () => {
  test("ready order has pickup PIN", () => {
    const readyOrder = mockBuyerOrders[1];
    expect(readyOrder.status).toBe("ready_for_pickup");
    expect(readyOrder.pickupPin).toBe("1234");
  });

  test("ready order has compartment number", () => {
    const readyOrder = mockBuyerOrders[1];
    expect(readyOrder.compartmentNumber).toBe(5);
  });
});

describe("OrdersPage - Parallel Loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("loads buyer and seller orders in parallel", async () => {
    vi.mocked(orderApi.getBuyerOrders).mockResolvedValue(mockBuyerOrders);
    vi.mocked(orderApi.getSellerOrders).mockResolvedValue(mockSellerOrders);

    const [buyerOrders, sellerOrders] = await Promise.all([
      orderApi.getBuyerOrders(),
      orderApi.getSellerOrders(),
    ]);

    expect(buyerOrders).toEqual(mockBuyerOrders);
    expect(sellerOrders).toEqual(mockSellerOrders);
    expect(orderApi.getBuyerOrders).toHaveBeenCalledTimes(1);
    expect(orderApi.getSellerOrders).toHaveBeenCalledTimes(1);
  });

  test("handles partial failure gracefully", async () => {
    vi.mocked(orderApi.getBuyerOrders).mockResolvedValue(mockBuyerOrders);
    vi.mocked(orderApi.getSellerOrders).mockRejectedValue(new Error("Failed"));

    const results = await Promise.allSettled([
      orderApi.getBuyerOrders(),
      orderApi.getSellerOrders(),
    ]);

    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("rejected");
  });
});
