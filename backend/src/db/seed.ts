import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { hashPassword } from "../middleware/auth";

const sqlite = new Database("ecoplate.db");
const db = drizzle(sqlite, { schema });

console.log("Seeding database...\n");

// Demo users
const demoUsers = [
  {
    email: "alice@demo.com",
    password: "demo123",
    name: "Alice Wong",
    userLocation: "Queenstown, Singapore 169648",
  },
  {
    email: "bob@demo.com",
    password: "demo123",
    name: "Bob Tan",
    userLocation: "Clementi, Singapore 129588",
  },
];

// Sample products (MyFridge items)
const sampleProducts = [
  {
    productName: "Fresh Organic Apples",
    category: "produce",
    quantity: 5.0,
    unitPrice: 6.0,
    description: "Sweet and crispy organic apples from local farm",
    daysAgo: 2,
  },
  {
    productName: "Whole Wheat Bread",
    category: "bakery",
    quantity: 2.0,
    unitPrice: 2.25,
    description: "Freshly baked whole wheat bread",
    daysAgo: 1,
  },
];

// Sample marketplace listings
const sampleListings = [
  {
    title: "Fresh Organic Apples",
    description: "Sweet and crispy organic apples from local farm. Selling half my stock!",
    category: "produce",
    quantity: 2.0,
    price: 5.0,
    originalPrice: 12.0,
    expiryDays: 5,
    location: "Queenstown MRT Station, Singapore 149305",
  },
  {
    title: "Whole Wheat Bread",
    description: "Freshly baked whole wheat bread. Free to good home!",
    category: "bakery",
    quantity: 2.0,
    price: 0,
    originalPrice: 4.5,
    expiryDays: 2,
    location: "Clementi Mall, Singapore 129588",
  },
];

async function seed() {
  try {
    // Clear existing data in correct order (respecting foreign keys)
    console.log("Clearing existing data...");
    sqlite.exec("DELETE FROM marketplace_listings");
    sqlite.exec("DELETE FROM products");
    sqlite.exec("DELETE FROM users");
    sqlite.exec("DELETE FROM sqlite_sequence");

    // Create users
    console.log("Creating demo users...");
    const createdUsers: { id: number; name: string }[] = [];

    for (const user of demoUsers) {
      const passwordHash = await hashPassword(user.password);
      const [created] = await db
        .insert(schema.users)
        .values({
          email: user.email,
          passwordHash,
          name: user.name,
          userLocation: user.userLocation,
        })
        .returning();

      createdUsers.push({ id: created.id, name: created.name });
      console.log(`  ✓ ${user.email}`);
    }

    // Create products (MyFridge items)
    console.log("\nCreating sample products (MyFridge)...");
    const createdProducts: { id: number; productName: string }[] = [];

    for (let i = 0; i < sampleProducts.length; i++) {
      const product = sampleProducts[i];
      const owner = createdUsers[i % createdUsers.length];

      const purchaseDate = new Date();
      purchaseDate.setDate(purchaseDate.getDate() - product.daysAgo);

      const [created] = await db
        .insert(schema.products)
        .values({
          userId: owner.id,
          productName: product.productName,
          category: product.category,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          purchaseDate,
          description: product.description,
        })
        .returning();

      createdProducts.push({ id: created.id, productName: created.productName });
      console.log(`  ✓ "${product.productName}" owned by ${owner.name}`);
    }

    // Create marketplace listings
    console.log("\nCreating sample marketplace listings...");
    for (let i = 0; i < sampleListings.length; i++) {
      const listing = sampleListings[i];
      const seller = createdUsers[i % createdUsers.length];
      const product = createdProducts[i % createdProducts.length];

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + listing.expiryDays);

      await db.insert(schema.marketplaceListings).values({
        sellerId: seller.id,
        productId: product.id,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        quantity: listing.quantity,
        price: listing.price,
        originalPrice: listing.originalPrice,
        expiryDate,
        pickupLocation: listing.location,
        status: "active",
      });

      console.log(`  ✓ "${listing.title}" by ${seller.name}`);
    }

    console.log("\n========================================");
    console.log("Done! Demo accounts (password: demo123):");
    console.log("  - alice@demo.com");
    console.log("  - bob@demo.com");
    console.log("========================================\n");

  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }

  sqlite.close();
}

seed();
