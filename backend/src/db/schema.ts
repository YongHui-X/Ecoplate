import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
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
});

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
  todayDate: text("today_date"), // YYYY-MM-DD format
  quantity: real("quantity"),
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
