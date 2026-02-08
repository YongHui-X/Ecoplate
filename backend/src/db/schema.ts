import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ==================== Users ====================

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  userLocation: text("user_location"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ==================== Products (MyFridge) ====================

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  category: text("category"),
  quantity: real("quantity").notNull(),
  unit: text("unit"), // e.g., "kg", "L", "pcs", "bottles"
  unitPrice: real("unit_price"),
  purchaseDate: integer("purchase_date", { mode: "timestamp" }),
  description: text("description"),
  co2Emission: real("co2_emission"),
});

// ==================== User Points ====================

export const userPoints = sqliteTable("user_points", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  totalPoints: integer("total_points").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  totalCo2Saved: real("total_co2_saved").notNull().default(0),
});

// ==================== Badges ====================

export const badges = sqliteTable("badges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  pointsAwarded: integer("points_awarded").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  badgeImageUrl: text("badge_image_url"),
});

// ==================== User Badges ====================

export const userBadges = sqliteTable("user_badges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  badgeId: integer("badge_id")
    .notNull()
    .references(() => badges.id, { onDelete: "cascade" }),
  earnedAt: integer("earned_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => ({
  // Unique constraint to prevent duplicate badge awards
  userBadgeUnique: uniqueIndex("user_badge_unique_idx").on(table.userId, table.badgeId),
}));

// ==================== Listing Images ====================

export const listingImages = sqliteTable("listing_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id")
    .notNull()
    .references(() => marketplaceListings.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
});

// ==================== Product Sustainability Metrics ====================

export const productSustainabilityMetrics = sqliteTable("product_sustainability_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id")
    .references(() => products.id, { onDelete: "cascade" }), // Nullable for marketplace actions
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  todayDate: text("today_date").notNull(), // YYYY-MM-DD format
  quantity: real("quantity"),
  unit: text("unit"), // e.g., "kg", "L", "pcs", "bottles"
  type: text("type"), // e.g., "consumed", "wasted", "shared", "sold"
});

// ==================== Pending Consumption Records ====================

export const pendingConsumptionRecords = sqliteTable("pending_consumption_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  rawPhoto: text("raw_photo").notNull(), // Base64 encoded image
  ingredients: text("ingredients").notNull(), // JSON array of ingredients
  status: text("status").notNull().default("PENDING_WASTE_PHOTO"), // PENDING_WASTE_PHOTO | COMPLETED
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ==================== Marketplace Listings ====================

export const marketplaceListings = sqliteTable("marketplace_listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sellerId: integer("seller_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  buyerId: integer("buyer_id").references(() => users.id),
  productId: integer("product_id").references(() => products.id),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  quantity: real("quantity").notNull(),
  unit: text("unit"), // e.g., "kg", "L", "pcs", "bottles"
  price: real("price"),
  originalPrice: real("original_price"),
  expiryDate: integer("expiry_date", { mode: "timestamp" }),
  pickupLocation: text("pickup_location"),
  images: text("images"), // JSON array of image URLs: ["uploads/marketplace/abc.jpg", ...]
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  co2Saved: real("co2_saved"), // Estimated kg CO2 saved by sharing this food
});

// ==================== Conversations ====================

export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id")
    .notNull()
    .references(() => marketplaceListings.id, { onDelete: "cascade" }),
  sellerId: integer("seller_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  buyerId: integer("buyer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ==================== Messages ====================

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  messageText: text("message_text").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Alias for services that use PascalCase
export const ProductSustainabilityMetrics = productSustainabilityMetrics;

// ==================== Relations ====================

export const usersRelations = relations(users, ({ one, many }) => ({
  products: many(products),
  productSustainabilityMetrics: many(productSustainabilityMetrics),
  pendingConsumptionRecords: many(pendingConsumptionRecords),
  listings: many(marketplaceListings, { relationName: "seller" }),
  purchases: many(marketplaceListings, { relationName: "buyer" }),
  conversationsAsSeller: many(conversations, { relationName: "seller" }),
  conversationsAsBuyer: many(conversations, { relationName: "buyer" }),
  messages: many(messages),
  points: one(userPoints),
  badges: many(userBadges),
  lockerOrdersAsBuyer: many(lockerOrders, { relationName: "lockerOrderBuyer" }),
  lockerOrdersAsSeller: many(lockerOrders, { relationName: "lockerOrderSeller" }),
  lockerNotifications: many(lockerNotifications),
  notifications: many(notifications),
  notificationPreferences: one(notificationPreferences),
  redemptions: many(userRedemptions),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  user: one(users, {
    fields: [products.userId],
    references: [users.id],
  }),
  sustainabilityMetrics: many(productSustainabilityMetrics),
  listings: many(marketplaceListings),
}));

export const marketplaceListingsRelations = relations(
  marketplaceListings,
  ({ one, many }) => ({
    seller: one(users, {
      fields: [marketplaceListings.sellerId],
      references: [users.id],
      relationName: "seller",
    }),
    buyer: one(users, {
      fields: [marketplaceListings.buyerId],
      references: [users.id],
      relationName: "buyer",
    }),
    product: one(products, {
      fields: [marketplaceListings.productId],
      references: [products.id],
    }),
    conversations: many(conversations),
    images: many(listingImages),
  })
);

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    listing: one(marketplaceListings, {
      fields: [conversations.listingId],
      references: [marketplaceListings.id],
    }),
    seller: one(users, {
      fields: [conversations.sellerId],
      references: [users.id],
      relationName: "seller",
    }),
    buyer: one(users, {
      fields: [conversations.buyerId],
      references: [users.id],
      relationName: "buyer",
    }),
    messages: many(messages),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
}));

export const productSustainabilityMetricsRelations = relations(
  productSustainabilityMetrics,
  ({ one }) => ({
    product: one(products, {
      fields: [productSustainabilityMetrics.productId],
      references: [products.id],
    }),
    user: one(users, {
      fields: [productSustainabilityMetrics.userId],
      references: [users.id],
    }),
  })
);

export const userPointsRelations = relations(userPoints, ({ one }) => ({
  user: one(users, {
    fields: [userPoints.userId],
    references: [users.id],
  }),
}));

export const pendingConsumptionRecordsRelations = relations(
  pendingConsumptionRecords,
  ({ one }) => ({
    user: one(users, {
      fields: [pendingConsumptionRecords.userId],
      references: [users.id],
    }),
  })
);

export const badgesRelations = relations(badges, ({ many }) => ({
  userBadges: many(userBadges),
}));

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
  user: one(users, {
    fields: [userBadges.userId],
    references: [users.id],
  }),
  badge: one(badges, {
    fields: [userBadges.badgeId],
    references: [badges.id],
  }),
}));

export const listingImagesRelations = relations(listingImages, ({ one }) => ({
  listing: one(marketplaceListings, {
    fields: [listingImages.listingId],
    references: [marketplaceListings.id],
  }),
}));

// ==================== EcoLocker Tables ====================

// Lockers - 20 Singapore locker locations
export const lockers = sqliteTable("lockers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  address: text("address").notNull(),
  coordinates: text("coordinates").notNull(), // "lat,lng"
  totalCompartments: integer("total_compartments").notNull().default(12),
  availableCompartments: integer("available_compartments").notNull().default(12),
  operatingHours: text("operating_hours"),
  status: text("status").notNull().default("active"), // active, maintenance, offline
});

// Locker Orders - transaction tracking
export const lockerOrders = sqliteTable("locker_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id")
    .notNull()
    .references(() => marketplaceListings.id),
  lockerId: integer("locker_id")
    .notNull()
    .references(() => lockers.id),
  buyerId: integer("buyer_id")
    .notNull()
    .references(() => users.id),
  sellerId: integer("seller_id")
    .notNull()
    .references(() => users.id),
  itemPrice: real("item_price").notNull(),
  deliveryFee: real("delivery_fee").notNull().default(2.0),
  totalPrice: real("total_price").notNull(),
  status: text("status").notNull().default("pending_payment"),
  // Status flow: pending_payment -> paid -> pickup_scheduled -> in_transit -> ready_for_pickup -> collected
  // Also: cancelled, expired
  reservedAt: integer("reserved_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  paymentDeadline: integer("payment_deadline", { mode: "timestamp" }),
  paidAt: integer("paid_at", { mode: "timestamp" }),
  pickupScheduledAt: integer("pickup_scheduled_at", { mode: "timestamp" }),
  riderPickedUpAt: integer("rider_picked_up_at", { mode: "timestamp" }),
  deliveredAt: integer("delivered_at", { mode: "timestamp" }),
  pickedUpAt: integer("picked_up_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  // PIN for pickup
  pickupPin: text("pickup_pin"),
  compartmentNumber: integer("compartment_number"),
  cancelReason: text("cancel_reason"),
});

// Locker Notifications - in-app notifications
export const lockerNotifications = sqliteTable("locker_notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  orderId: integer("order_id")
    .notNull()
    .references(() => lockerOrders.id),
  type: text("type").notNull(), // payment_reminder, pickup_scheduled, item_delivered, pickup_reminder, order_cancelled, order_expired
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ==================== EcoLocker Relations ====================

export const lockersRelations = relations(lockers, ({ many }) => ({
  orders: many(lockerOrders),
}));

export const lockerOrdersRelations = relations(lockerOrders, ({ one, many }) => ({
  listing: one(marketplaceListings, {
    fields: [lockerOrders.listingId],
    references: [marketplaceListings.id],
  }),
  locker: one(lockers, {
    fields: [lockerOrders.lockerId],
    references: [lockers.id],
  }),
  buyer: one(users, {
    fields: [lockerOrders.buyerId],
    references: [users.id],
    relationName: "lockerOrderBuyer",
  }),
  seller: one(users, {
    fields: [lockerOrders.sellerId],
    references: [users.id],
    relationName: "lockerOrderSeller",
  }),
  notifications: many(lockerNotifications),
}));

export const lockerNotificationsRelations = relations(lockerNotifications, ({ one }) => ({
  user: one(users, {
    fields: [lockerNotifications.userId],
    references: [users.id],
  }),
  order: one(lockerOrders, {
    fields: [lockerNotifications.orderId],
    references: [lockerOrders.id],
  }),
}));

// ==================== Notifications ====================

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "expiring_soon" | "badge_unlocked" | "streak_milestone" | "product_stale"
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedId: integer("related_id"), // productId, badgeId, etc.
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  readAt: integer("read_at", { mode: "timestamp" }),
});

// ==================== Notification Preferences ====================

export const notificationPreferences = sqliteTable("notification_preferences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  expiringProducts: integer("expiring_products", { mode: "boolean" }).notNull().default(true),
  badgeUnlocked: integer("badge_unlocked", { mode: "boolean" }).notNull().default(true),
  streakMilestone: integer("streak_milestone", { mode: "boolean" }).notNull().default(true),
  productStale: integer("product_stale", { mode: "boolean" }).notNull().default(true),
  staleDaysThreshold: integer("stale_days_threshold").notNull().default(7),
  expiryDaysThreshold: integer("expiry_days_threshold").notNull().default(3),
});

// ==================== Notification Relations ====================

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));

// ==================== Rewards ====================

export const rewards = sqliteTable("rewards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  category: text("category").notNull(),
  pointsCost: integer("points_cost").notNull(),
  stock: integer("stock").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ==================== User Redemptions ====================

export const userRedemptions = sqliteTable("user_redemptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  rewardId: integer("reward_id")
    .notNull()
    .references(() => rewards.id, { onDelete: "cascade" }),
  pointsSpent: integer("points_spent").notNull(),
  redemptionCode: text("redemption_code").notNull().unique(),
  status: text("status").notNull().default("pending"),
  collectedAt: integer("collected_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ==================== Rewards Relations ====================

export const rewardsRelations = relations(rewards, ({ many }) => ({
  redemptions: many(userRedemptions),
}));

export const userRedemptionsRelations = relations(userRedemptions, ({ one }) => ({
  user: one(users, {
    fields: [userRedemptions.userId],
    references: [users.id],
  }),
  reward: one(rewards, {
    fields: [userRedemptions.rewardId],
    references: [rewards.id],
  }),
}));
