import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";
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
  {
    email: "charlie@demo.com",
    password: "demo123",
    name: "Charlie Lim",
    userLocation: "Tampines, Singapore 529510",
  },
  {
    email: "diana@demo.com",
    password: "demo123",
    name: "Diana Chen",
    userLocation: "Jurong East, Singapore 609731",
  },
  {
    email: "evan@demo.com",
    password: "demo123",
    name: "Evan Ng",
    userLocation: "Bishan, Singapore 570283",
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
  // PRODUCE - Apples (multiple for similarity testing)
  {
    title: "Fresh Organic Apples",
    description: "Sweet and crispy organic apples from local farm. Selling half my stock!",
    category: "produce",
    quantity: 2.0,
    unit: "kg",
    price: 5.0,
    originalPrice: 12.0,
    expiryDays: 5,
    location: "Queenstown MRT Station|1.2946,103.8060",
    sellerIndex: 0, // Alice
  },
  {
    title: "Red Fuji Apples",
    description: "Imported Japanese Fuji apples, super sweet and crunchy. Bought too many!",
    category: "produce",
    quantity: 1.5,
    unit: "kg",
    price: 6.0,
    originalPrice: 15.0,
    expiryDays: 7,
    location: "Tampines Mall|1.3525,103.9447",
    sellerIndex: 2, // Charlie
  },
  {
    title: "Green Granny Smith Apples",
    description: "Tart and crisp green apples, perfect for baking or eating fresh.",
    category: "produce",
    quantity: 1.0,
    unit: "kg",
    price: 4.5,
    originalPrice: 10.0,
    expiryDays: 6,
    location: "Jurong Point|1.3397,103.7066",
    sellerIndex: 3, // Diana
  },
  // PRODUCE - Other fruits
  {
    title: "Fresh Bananas",
    description: "Ripe bananas from Malaysia. Perfect for smoothies or snacking.",
    category: "produce",
    quantity: 1.0,
    unit: "kg",
    price: 2.0,
    originalPrice: 4.0,
    expiryDays: 3,
    location: "Bishan MRT|1.3513,103.8492",
    sellerIndex: 4, // Evan
  },
  {
    title: "Organic Oranges",
    description: "Juicy navel oranges, great for fresh juice. Selling excess from bulk purchase.",
    category: "produce",
    quantity: 2.0,
    unit: "kg",
    price: 5.5,
    originalPrice: 12.0,
    expiryDays: 10,
    location: "Clementi MRT|1.3151,103.7654",
    sellerIndex: 1, // Bob
  },
  {
    title: "Fresh Strawberries",
    description: "Sweet Korean strawberries. Need to sell before they go bad!",
    category: "produce",
    quantity: 500,
    unit: "g",
    price: 4.0,
    originalPrice: 9.0,
    expiryDays: 2,
    location: "Tampines Hub|1.3535,103.9395",
    sellerIndex: 2, // Charlie
  },
  // PRODUCE - Vegetables
  {
    title: "Organic Spinach",
    description: "Fresh organic baby spinach leaves. Great for salads and smoothies.",
    category: "produce",
    quantity: 300,
    unit: "g",
    price: 2.5,
    originalPrice: 5.0,
    expiryDays: 3,
    location: "Jurong East MRT|1.3331,103.7422",
    sellerIndex: 3, // Diana
  },
  {
    title: "Fresh Tomatoes",
    description: "Vine-ripened tomatoes from Cameron Highlands. Perfect for cooking.",
    category: "produce",
    quantity: 1.0,
    unit: "kg",
    price: 3.0,
    originalPrice: 6.0,
    expiryDays: 5,
    location: "Queenstown|1.2946,103.8060",
    sellerIndex: 0, // Alice
  },
  // DAIRY
  {
    title: "Fresh Milk 2L",
    description: "Meiji fresh milk, expiring soon but still good. Half price!",
    category: "dairy",
    quantity: 2,
    unit: "L",
    price: 3.5,
    originalPrice: 7.0,
    expiryDays: 2,
    location: "Bishan Junction 8|1.3500,103.8488",
    sellerIndex: 4, // Evan
  },
  {
    title: "Greek Yogurt Tub",
    description: "Fage Greek yogurt 500g. Bought extra, need to clear.",
    category: "dairy",
    quantity: 500,
    unit: "g",
    price: 4.0,
    originalPrice: 8.5,
    expiryDays: 5,
    location: "Clementi Mall|1.3148,103.7641",
    sellerIndex: 1, // Bob
  },
  {
    title: "Cheddar Cheese Block",
    description: "Mainland cheddar cheese. Opened but well-sealed. Great for sandwiches.",
    category: "dairy",
    quantity: 250,
    unit: "g",
    price: 3.0,
    originalPrice: 7.0,
    expiryDays: 14,
    location: "Tampines|1.3525,103.9447",
    sellerIndex: 2, // Charlie
  },
  // BAKERY
  {
    title: "Whole Wheat Bread",
    description: "Freshly baked whole wheat bread. Free to good home!",
    category: "bakery",
    quantity: 1,
    unit: "pcs",
    price: 0,
    originalPrice: 4.5,
    expiryDays: 2,
    location: "Clementi Mall|1.3148,103.7641",
    sellerIndex: 1, // Bob
  },
  {
    title: "Croissants Pack",
    description: "Pack of 4 butter croissants from BreadTalk. Still fresh!",
    category: "bakery",
    quantity: 4,
    unit: "pcs",
    price: 3.0,
    originalPrice: 8.0,
    expiryDays: 1,
    location: "Jurong Point|1.3397,103.7066",
    sellerIndex: 3, // Diana
  },
  {
    title: "Sourdough Loaf",
    description: "Artisan sourdough bread. Baked yesterday, still soft inside.",
    category: "bakery",
    quantity: 1,
    unit: "pcs",
    price: 4.0,
    originalPrice: 9.0,
    expiryDays: 3,
    location: "Bishan|1.3513,103.8492",
    sellerIndex: 4, // Evan
  },
  // MEAT
  {
    title: "Chicken Breast Pack",
    description: "Fresh chicken breast 500g. Bought too much for meal prep.",
    category: "meat",
    quantity: 500,
    unit: "g",
    price: 4.0,
    originalPrice: 8.0,
    expiryDays: 2,
    location: "Queenstown|1.2946,103.8060",
    sellerIndex: 0, // Alice
  },
  {
    title: "Minced Beef",
    description: "Premium Australian minced beef. Great for burgers or pasta sauce.",
    category: "meat",
    quantity: 400,
    unit: "g",
    price: 5.0,
    originalPrice: 12.0,
    expiryDays: 1,
    location: "Tampines|1.3525,103.9447",
    sellerIndex: 2, // Charlie
  },
  // FROZEN
  {
    title: "Frozen Dumplings",
    description: "Homemade frozen pork dumplings. 20 pieces per pack.",
    category: "frozen",
    quantity: 20,
    unit: "pcs",
    price: 6.0,
    originalPrice: 12.0,
    expiryDays: 30,
    location: "Jurong East|1.3331,103.7422",
    sellerIndex: 3, // Diana
  },
  {
    title: "Frozen Mixed Vegetables",
    description: "Birds Eye frozen mixed veggies. Unopened pack.",
    category: "frozen",
    quantity: 500,
    unit: "g",
    price: 2.5,
    originalPrice: 5.5,
    expiryDays: 60,
    location: "Bishan|1.3513,103.8492",
    sellerIndex: 4, // Evan
  },
  // BEVERAGES
  {
    title: "Orange Juice Carton",
    description: "Tropicana pure premium OJ. Opened yesterday, still fresh.",
    category: "beverages",
    quantity: 1,
    unit: "L",
    price: 2.0,
    originalPrice: 6.0,
    expiryDays: 3,
    location: "Clementi|1.3151,103.7654",
    sellerIndex: 1, // Bob
  },
  {
    title: "Coconut Water Pack",
    description: "UFC coconut water 6-pack. Selling 4 remaining bottles.",
    category: "beverages",
    quantity: 4,
    unit: "bottles",
    price: 4.0,
    originalPrice: 10.0,
    expiryDays: 30,
    location: "Queenstown|1.2946,103.8060",
    sellerIndex: 0, // Alice
  },
  // PANTRY
  {
    title: "Pasta Pack",
    description: "Barilla spaghetti 500g. Bought by mistake, prefer penne.",
    category: "pantry",
    quantity: 500,
    unit: "g",
    price: 2.0,
    originalPrice: 4.5,
    expiryDays: 180,
    location: "Tampines|1.3525,103.9447",
    sellerIndex: 2, // Charlie
  },
  {
    title: "Canned Tuna",
    description: "Ayam Brand tuna chunks in water. 3 cans available.",
    category: "pantry",
    quantity: 3,
    unit: "pcs",
    price: 4.5,
    originalPrice: 9.0,
    expiryDays: 365,
    location: "Jurong|1.3397,103.7066",
    sellerIndex: 3, // Diana
  },
];

// Sample conversation messages
const sampleConversationMessages = [
  { text: "Hi! Is this still available?", fromBuyer: true },
  { text: "Yes, it is! When would you like to pick it up?", fromBuyer: false },
  { text: "Can I come by tomorrow afternoon around 3pm?", fromBuyer: true },
  { text: "That works for me. See you then!", fromBuyer: false },
];

// Sample badges
const sampleBadges = [
  {
    code: "first_sale",
    name: "First Sale",
    description: "Sold your first item on the marketplace",
    category: "marketplace",
    pointsAwarded: 50,
    sortOrder: 1,
  },
  {
    code: "eco_warrior",
    name: "Eco Warrior",
    description: "Saved 10kg of food from going to waste",
    category: "sustainability",
    pointsAwarded: 100,
    sortOrder: 2,
  },
  {
    code: "streak_7",
    name: "Week Warrior",
    description: "Maintained a 7-day sustainability streak",
    category: "streak",
    pointsAwarded: 75,
    sortOrder: 3,
  },
  {
    code: "streak_30",
    name: "Monthly Champion",
    description: "Maintained a 30-day sustainability streak",
    category: "streak",
    pointsAwarded: 200,
    sortOrder: 4,
  },
  {
    code: "community_helper",
    name: "Community Helper",
    description: "Shared food with 5 different people",
    category: "community",
    pointsAwarded: 80,
    sortOrder: 5,
  },
  {
    code: "zero_waste",
    name: "Zero Waste Hero",
    description: "Achieved 100% waste reduction rate for a month",
    category: "sustainability",
    pointsAwarded: 150,
    sortOrder: 6,
  },
  {
    code: "marketplace_pro",
    name: "Marketplace Pro",
    description: "Successfully sold 10 items",
    category: "marketplace",
    pointsAwarded: 120,
    sortOrder: 7,
  },
  {
    code: "early_adopter",
    name: "Early Adopter",
    description: "Joined EcoPlate in its early days",
    category: "special",
    pointsAwarded: 50,
    sortOrder: 8,
  },
];

async function seed() {
  try {
    // Clear existing data in correct order (respecting foreign keys)
    console.log("Clearing existing data...");
    sqlite.exec("DELETE FROM messages");
    sqlite.exec("DELETE FROM conversations");
    sqlite.exec("DELETE FROM listing_images");
    sqlite.exec("DELETE FROM marketplace_listings");
    sqlite.exec("DELETE FROM product_sustainability_metrics");
    sqlite.exec("DELETE FROM products");
    sqlite.exec("DELETE FROM user_badges");
    sqlite.exec("DELETE FROM user_points");
    sqlite.exec("DELETE FROM badges");
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

    // Create badges
    console.log("\nCreating badges...");
    for (const badge of sampleBadges) {
      await db.insert(schema.badges).values(badge);
      console.log(`  ✓ ${badge.name}`);
    }

    // Create user points for all users
    console.log("\nInitializing user points...");
    for (const user of createdUsers) {
      await db.insert(schema.userPoints).values({
        userId: user.id,
        totalPoints: 0,
        currentStreak: 0,
      });
      console.log(`  ✓ Points initialized for ${user.name}`);
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
    const createdListings: { id: number; sellerId: number; title: string }[] = [];

    for (let i = 0; i < sampleListings.length; i++) {
      const listing = sampleListings[i];
      const sellerIndex = listing.sellerIndex !== undefined ? listing.sellerIndex : (i % createdUsers.length);
      const seller = createdUsers[sellerIndex];

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + listing.expiryDays);

      const [created] = await db.insert(schema.marketplaceListings).values({
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
      }).returning();

      createdListings.push({ id: created.id, sellerId: seller.id, title: created.title });
      console.log(`  ✓ "${listing.title}" by ${seller.name}`);
    }

    // Create sample conversations and messages
    console.log("\nCreating sample conversations and messages...");

    // Create a conversation for the first listing (Alice's apples, Bob inquiring)
    const listing1 = createdListings[0]; // Alice's apples
    const alice = createdUsers[0]; // Alice (seller)
    const bob = createdUsers[1]; // Bob (buyer)

    const [conversation1] = await db.insert(schema.conversations).values({
      listingId: listing1.id,
      sellerId: alice.id,
      buyerId: bob.id,
    }).returning();

    console.log(`  ✓ Conversation for "${listing1.title}" between ${alice.name} and ${bob.name}`);

    // Add messages to the conversation
    for (let i = 0; i < sampleConversationMessages.length; i++) {
      const msg = sampleConversationMessages[i];
      const senderId = msg.fromBuyer ? bob.id : alice.id;

      // Add small delay between messages for ordering
      const messageDate = new Date();
      messageDate.setMinutes(messageDate.getMinutes() - (sampleConversationMessages.length - i));

      await db.insert(schema.messages).values({
        conversationId: conversation1.id,
        userId: senderId,
        messageText: msg.text,
        isRead: i < sampleConversationMessages.length - 1, // Last message unread
        createdAt: messageDate,
      });
    }

    console.log(`    Added ${sampleConversationMessages.length} messages`);

    // Update conversation timestamp
    await db.update(schema.conversations)
      .set({ updatedAt: new Date() })
      .where(eq(schema.conversations.id, conversation1.id));

    console.log("\n========================================");
    console.log("Done! Demo accounts (password: demo123):");
    console.log("  - alice@demo.com (seller)");
    console.log("  - bob@demo.com (seller)");
    console.log("  - charlie@demo.com (seller)");
    console.log("  - diana@demo.com (seller)");
    console.log("  - evan@demo.com (seller)");
    console.log(`\nCreated ${createdListings.length} marketplace listings`);
    console.log("========================================\n");

  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }

  sqlite.close();
}

seed();
