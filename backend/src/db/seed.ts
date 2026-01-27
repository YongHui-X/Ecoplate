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

// Sample listings
const sampleListings = [
  {
    title: "Fresh Organic Apples",
    description: "Sweet and crispy organic apples from local farm.",
    category: "produce",
    quantity: 2,
    unit: "kg",
    price: 5.0,
    originalPrice: 12.0,
    expiryDays: 5,
    location: "Queenstown MRT Station, Singapore 149305|1.2943,103.8016",
  },
  {
    title: "Whole Wheat Bread",
    description: "Freshly baked whole wheat bread.",
    category: "bakery",
    quantity: 2,
    unit: "loaf",
    price: null,
    originalPrice: 4.5,
    expiryDays: 2,
    location: "Clementi Mall, Singapore 129588|1.3149,103.7651",
  },
  {
    title: "Fresh Milk (2L)",
    description: "Full cream fresh milk, unopened.",
    category: "dairy",
    quantity: 2,
    unit: "l",
    price: 3.5,
    originalPrice: 6.0,
    expiryDays: 3,
    location: "Buona Vista MRT, Singapore 138600|1.3073,103.7897",
  },
  {
    title: "Mixed Vegetables Pack",
    description: "Assorted fresh vegetables - carrots, broccoli, lettuce.",
    category: "produce",
    quantity: 1,
    unit: "pack",
    price: 4.0,
    originalPrice: 8.0,
    expiryDays: 4,
    location: "Commonwealth MRT, Singapore 149732|1.3025,103.7981",
  },
];

async function seed() {
  try {
    // Clear existing data
    console.log("Clearing existing data...");
    sqlite.exec("DELETE FROM listing_images");
    sqlite.exec("DELETE FROM marketplace_listings");
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

    // Create listings
    console.log("\nCreating sample listings...");
    for (let i = 0; i < sampleListings.length; i++) {
      const listing = sampleListings[i];
      const seller = createdUsers[i % createdUsers.length];

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + listing.expiryDays);

      await db.insert(schema.marketplaceListings).values({
        sellerId: seller.id,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        quantity: listing.quantity,
        unit: listing.unit,
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
