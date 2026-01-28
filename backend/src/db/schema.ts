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

// ==================== Products ====================

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  category: text("category"),
  quantity: real("quantity").notNull().default(1),
  unitPrice: real("unit_price"),
  purchaseDate: text("purchase_date"), // YYYY-MM-DD format
  expiryDate: text("expiry_date"), // YYYY-MM-DD format
  description: text("description"),
  co2Emission: real("co2_emission"),
  isConsumed: integer("is_consumed", { mode: "boolean" }).default(false),
});

export const productInteraction = sqliteTable("product_interaction", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  todayDate: text("today_date"), // YYYY-MM-DD format
  quantity: real("quantity"),
  type: text("type"), // e.g., "consumed", "wasted", "shared", "sold"
});

// ==================== Marketplace ====================

export const marketplaceListings = sqliteTable("marketplace_listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sellerId: integer("seller_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  quantity: real("quantity").notNull().default(1),
  unit: text("unit").default("item"),
  price: real("price"),
  originalPrice: real("original_price"),
  expiryDate: integer("expiry_date", { mode: "timestamp" }),
  pickupLocation: text("pickup_location"),
  pickupInstructions: text("pickup_instructions"),
  status: text("status").default("active"),
  reservedBy: integer("reserved_by").references(() => users.id),
  reservedAt: integer("reserved_at", { mode: "timestamp" }),
  soldAt: integer("sold_at", { mode: "timestamp" }),
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

// ==================== Relations ====================

export const usersRelations = relations(users, ({ many }) => ({
  products: many(products),
  productInteractions: many(productInteraction),
  listings: many(marketplaceListings, { relationName: "seller" }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  user: one(users, { fields: [products.userId], references: [users.id] }),
  interactions: many(productInteraction),
}));

export const productInteractionRelations = relations(productInteraction, ({ one }) => ({
  product: one(products, { fields: [productInteraction.productId], references: [products.id] }),
  user: one(users, { fields: [productInteraction.userId], references: [users.id] }),
}));

export const marketplaceListingsRelations = relations(
  marketplaceListings,
  ({ one, many }) => ({
    seller: one(users, {
      fields: [marketplaceListings.sellerId],
      references: [users.id],
    }),
    reservedByUser: one(users, {
      fields: [marketplaceListings.reservedBy],
      references: [users.id],
    }),
    images: many(listingImages),
  })
);

export const listingImagesRelations = relations(listingImages, ({ one }) => ({
  listing: one(marketplaceListings, {
    fields: [listingImages.listingId],
    references: [marketplaceListings.id],
  }),
}));
