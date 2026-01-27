import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ==================== Users & Auth ====================

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  userLocation: text("user_location"), // Default location for user (e.g., "Singapore 123456")
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ==================== MyFridge ====================

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category"), // e.g., "dairy", "produce", "meat"
  quantity: real("quantity").notNull().default(1),
  unit: text("unit").default("item"), // "item", "kg", "g", "l", "ml"
  purchaseDate: integer("purchase_date", { mode: "timestamp" }),
  expiryDate: integer("expiry_date", { mode: "timestamp" }),
  storageLocation: text("storage_location").default("fridge"), // "fridge", "freezer", "pantry"
  notes: text("notes"),
  imageUrl: text("image_url"),
  barcode: text("barcode"),
  isConsumed: integer("is_consumed", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const receiptScans = sqliteTable("receipt_scans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  rawText: text("raw_text"),
  parsedData: text("parsed_data"), // JSON string of parsed items
  status: text("status").default("pending"), // "pending", "processed", "failed"
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const consumptionLogs = sqliteTable("consumption_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // "consumed", "wasted", "shared", "sold"
  quantity: real("quantity").notNull(),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ==================== Marketplace ====================

export const marketplaceListings = sqliteTable("marketplace_listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sellerId: integer("seller_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  buyerId: integer("buyer_id").references(() => users.id), // Final buyer who completes the transaction
  productId: integer("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  quantity: real("quantity").notNull().default(1),
  unit: text("unit").default("item"),
  price: real("price"), // null = free
  originalPrice: real("original_price"),
  expiryDate: integer("expiry_date", { mode: "timestamp" }),
  pickupLocation: text("pickup_location"), // Specific pickup location with Google Maps address
  pickupInstructions: text("pickup_instructions"),
  status: text("status").default("active"), // "active", "reserved", "completed", "expired", "cancelled"
  reservedBy: integer("reserved_by").references(() => users.id),
  reservedAt: integer("reserved_at", { mode: "timestamp" }),
  soldAt: integer("sold_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }), // When transaction is completed
  viewCount: integer("view_count").default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const listingImages = sqliteTable("listing_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id")
    .notNull()
    .references(() => marketplaceListings.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Messages between buyers and sellers for a listing
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id")
    .notNull()
    .references(() => marketplaceListings.id, { onDelete: "cascade" }),
  senderId: integer("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  receiverId: integer("receiver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ==================== Gamification ====================

export const userPoints = sqliteTable("user_points", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  totalPoints: integer("total_points").default(0),
  availablePoints: integer("available_points").default(0),
  lifetimePoints: integer("lifetime_points").default(0),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  lastActivityDate: integer("last_activity_date", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const pointTransactions = sqliteTable("point_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // positive = earn, negative = spend
  type: text("type").notNull(), // "earn", "redeem", "bonus", "penalty"
  action: text("action").notNull(), // e.g., "product_consumed", "listing_sold", "badge_earned"
  referenceType: text("reference_type"), // e.g., "product", "listing", "badge"
  referenceId: integer("reference_id"),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const badges = sqliteTable("badges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),
  category: text("category"), // "waste-reduction", "sharing", "streaks", "milestones"
  pointsAwarded: integer("points_awarded").default(0),
  requirement: text("requirement"), // JSON describing unlock criteria
  sortOrder: integer("sort_order").default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

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
  notifiedAt: integer("notified_at", { mode: "timestamp" }),
});

export const userSustainabilityMetrics = sqliteTable(
  "user_sustainability_metrics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    totalItemsConsumed: integer("total_items_consumed").default(0),
    totalItemsWasted: integer("total_items_wasted").default(0),
    totalItemsShared: integer("total_items_shared").default(0),
    totalItemsSold: integer("total_items_sold").default(0),
    estimatedMoneySaved: real("estimated_money_saved").default(0),
    estimatedCo2Saved: real("estimated_co2_saved").default(0), // in kg
    wasteReductionRate: real("waste_reduction_rate").default(0), // percentage
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  }
);

export const dailySustainabilitySnapshots = sqliteTable(
  "daily_sustainability_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD format
    itemsConsumed: integer("items_consumed").default(0),
    itemsWasted: integer("items_wasted").default(0),
    itemsShared: integer("items_shared").default(0),
    itemsSold: integer("items_sold").default(0),
    pointsEarned: integer("points_earned").default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  }
);

// ==================== Relations ====================

export const usersRelations = relations(users, ({ many, one }) => ({
  products: many(products),
  receiptScans: many(receiptScans),
  consumptionLogs: many(consumptionLogs),
  listings: many(marketplaceListings, { relationName: "seller" }),
  boughtListings: many(marketplaceListings, { relationName: "buyer" }),
  sentMessages: many(messages, { relationName: "sender" }),
  receivedMessages: many(messages, { relationName: "receiver" }),
  points: one(userPoints),
  pointTransactions: many(pointTransactions),
  badges: many(userBadges),
  sustainabilityMetrics: one(userSustainabilityMetrics),
  dailySnapshots: many(dailySustainabilitySnapshots),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  user: one(users, { fields: [products.userId], references: [users.id] }),
  consumptionLogs: many(consumptionLogs),
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
    reservedByUser: one(users, {
      fields: [marketplaceListings.reservedBy],
      references: [users.id],
    }),
    images: many(listingImages),
    messages: many(messages),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  listing: one(marketplaceListings, {
    fields: [messages.listingId],
    references: [marketplaceListings.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "sender",
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: "receiver",
  }),
}));

export const badgesRelations = relations(badges, ({ many }) => ({
  userBadges: many(userBadges),
}));

export const userBadgesRelations = relations(userBadges, ({ one }) => ({
  user: one(users, { fields: [userBadges.userId], references: [users.id] }),
  badge: one(badges, { fields: [userBadges.badgeId], references: [badges.id] }),
}));
