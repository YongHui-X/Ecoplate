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

// Sample products (MyFridge items) - many products across categories with CO2 data
const sampleProducts = [
  // Alice's products
  { productName: "Fresh Organic Apples", category: "produce", quantity: 5.0, unit: "kg", unitPrice: 6.0, co2Emission: 1.2, description: "Sweet and crispy organic apples", daysAgo: 2, ownerIndex: 0 },
  { productName: "Whole Wheat Bread", category: "bakery", quantity: 2.0, unit: "pcs", unitPrice: 2.25, co2Emission: 0.8, description: "Freshly baked whole wheat bread", daysAgo: 1, ownerIndex: 0 },
  { productName: "Brown Rice 2kg", category: "pantry", quantity: 2.0, unit: "kg", unitPrice: 5.5, co2Emission: 2.7, description: "Organic brown rice", daysAgo: 30, ownerIndex: 0 },
  { productName: "Greek Yogurt", category: "dairy", quantity: 1.0, unit: "pcs", unitPrice: 4.5, co2Emission: 1.4, description: "Plain Greek yogurt 500g", daysAgo: 5, ownerIndex: 0 },
  { productName: "Fresh Salmon Fillet", category: "meat", quantity: 0.5, unit: "kg", unitPrice: 12.0, co2Emission: 3.2, description: "Norwegian salmon fillet", daysAgo: 3, ownerIndex: 0 },
  { productName: "Avocados", category: "produce", quantity: 4.0, unit: "pcs", unitPrice: 8.0, co2Emission: 2.0, description: "Ripe Hass avocados", daysAgo: 60, ownerIndex: 0 },
  { productName: "Oat Milk", category: "dairy", quantity: 1.0, unit: "L", unitPrice: 4.0, co2Emission: 0.3, description: "Oatly barista edition", daysAgo: 90, ownerIndex: 0 },
  { productName: "Chicken Thighs", category: "meat", quantity: 1.0, unit: "kg", unitPrice: 7.0, co2Emission: 3.5, description: "Free-range chicken thighs", daysAgo: 120, ownerIndex: 0 },
  { productName: "Pasta 500g", category: "pantry", quantity: 0.5, unit: "kg", unitPrice: 3.0, co2Emission: 0.9, description: "Barilla spaghetti", daysAgo: 150, ownerIndex: 0 },
  { productName: "Fresh Spinach", category: "produce", quantity: 0.3, unit: "kg", unitPrice: 3.5, co2Emission: 0.4, description: "Organic baby spinach", daysAgo: 180, ownerIndex: 0 },
  { productName: "Cheddar Cheese", category: "dairy", quantity: 0.25, unit: "kg", unitPrice: 7.0, co2Emission: 3.0, description: "Aged cheddar block", daysAgo: 210, ownerIndex: 0 },
  { productName: "Bananas", category: "produce", quantity: 6.0, unit: "pcs", unitPrice: 2.5, co2Emission: 0.5, description: "Fresh Cavendish bananas", daysAgo: 240, ownerIndex: 0 },
  { productName: "Tofu Pack", category: "produce", quantity: 0.4, unit: "kg", unitPrice: 2.0, co2Emission: 0.2, description: "Firm silken tofu", daysAgo: 300, ownerIndex: 0 },
  { productName: "Eggs 10-pack", category: "dairy", quantity: 10.0, unit: "pcs", unitPrice: 5.0, co2Emission: 2.5, description: "Free-range eggs", daysAgo: 365, ownerIndex: 0 },
  { productName: "Orange Juice 1L", category: "beverages", quantity: 1.0, unit: "L", unitPrice: 4.5, co2Emission: 0.7, description: "Fresh squeezed OJ", daysAgo: 400, ownerIndex: 0 },
  { productName: "Frozen Peas 500g", category: "frozen", quantity: 0.5, unit: "kg", unitPrice: 3.0, co2Emission: 0.6, description: "Garden peas", daysAgo: 500, ownerIndex: 0 },
  // Bob's products
  { productName: "Organic Milk 2L", category: "dairy", quantity: 2.0, unit: "L", unitPrice: 6.0, co2Emission: 3.0, description: "Fresh organic milk", daysAgo: 3, ownerIndex: 1 },
  { productName: "Sourdough Bread", category: "bakery", quantity: 1.0, unit: "pcs", unitPrice: 5.0, co2Emission: 0.9, description: "Artisan sourdough loaf", daysAgo: 7, ownerIndex: 1 },
  { productName: "Broccoli", category: "produce", quantity: 0.5, unit: "kg", unitPrice: 3.0, co2Emission: 0.4, description: "Fresh broccoli crowns", daysAgo: 45, ownerIndex: 1 },
  { productName: "Minced Beef 500g", category: "meat", quantity: 0.5, unit: "kg", unitPrice: 9.0, co2Emission: 13.0, description: "Grass-fed beef mince", daysAgo: 100, ownerIndex: 1 },
  { productName: "Tomatoes 1kg", category: "produce", quantity: 1.0, unit: "kg", unitPrice: 4.0, co2Emission: 0.7, description: "Vine-ripened tomatoes", daysAgo: 200, ownerIndex: 1 },
  { productName: "Almond Butter", category: "pantry", quantity: 0.3, unit: "kg", unitPrice: 8.0, co2Emission: 0.5, description: "Organic almond butter", daysAgo: 350, ownerIndex: 1 },
  // Charlie's products
  { productName: "Strawberries 500g", category: "produce", quantity: 0.5, unit: "kg", unitPrice: 6.0, co2Emission: 0.3, description: "Korean strawberries", daysAgo: 4, ownerIndex: 2 },
  { productName: "Pork Belly 1kg", category: "meat", quantity: 1.0, unit: "kg", unitPrice: 14.0, co2Emission: 5.5, description: "Fresh pork belly", daysAgo: 50, ownerIndex: 2 },
  { productName: "Kimchi 500g", category: "pantry", quantity: 0.5, unit: "kg", unitPrice: 5.0, co2Emission: 0.3, description: "Homemade kimchi", daysAgo: 130, ownerIndex: 2 },
  { productName: "Coconut Oil", category: "pantry", quantity: 0.5, unit: "L", unitPrice: 7.0, co2Emission: 1.2, description: "Cold-pressed coconut oil", daysAgo: 250, ownerIndex: 2 },
  // Diana's products
  { productName: "Sweet Potatoes", category: "produce", quantity: 1.5, unit: "kg", unitPrice: 4.0, co2Emission: 0.3, description: "Japanese sweet potatoes", daysAgo: 10, ownerIndex: 3 },
  { productName: "Mozzarella", category: "dairy", quantity: 0.25, unit: "kg", unitPrice: 5.5, co2Emission: 2.8, description: "Fresh buffalo mozzarella", daysAgo: 75, ownerIndex: 3 },
  { productName: "Frozen Dumplings", category: "frozen", quantity: 1.0, unit: "packs", unitPrice: 8.0, co2Emission: 2.0, description: "Handmade pork dumplings 30pcs", daysAgo: 160, ownerIndex: 3 },
  { productName: "Honey 500g", category: "pantry", quantity: 0.5, unit: "kg", unitPrice: 12.0, co2Emission: 0.2, description: "Raw Manuka honey", daysAgo: 300, ownerIndex: 3 },
  // Evan's products
  { productName: "Blueberries 250g", category: "produce", quantity: 0.25, unit: "kg", unitPrice: 5.0, co2Emission: 0.4, description: "Chilean blueberries", daysAgo: 6, ownerIndex: 4 },
  { productName: "Lamb Chops", category: "meat", quantity: 0.6, unit: "kg", unitPrice: 18.0, co2Emission: 15.0, description: "NZ lamb rack", daysAgo: 80, ownerIndex: 4 },
  { productName: "Soy Sauce 500ml", category: "pantry", quantity: 0.5, unit: "L", unitPrice: 4.0, co2Emission: 0.3, description: "Kikkoman soy sauce", daysAgo: 200, ownerIndex: 4 },
  { productName: "Ice Cream 1L", category: "frozen", quantity: 1.0, unit: "L", unitPrice: 9.0, co2Emission: 1.8, description: "Haagen-Dazs vanilla", daysAgo: 400, ownerIndex: 4 },
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

// Badge definitions (16 badges across 4 categories)
const sampleBadges = [
  // --- Milestones ---
  { code: "first_action", name: "First Steps", description: "Complete your first sustainability action", category: "milestones", pointsAwarded: 25, sortOrder: 1 },
  { code: "eco_starter", name: "Eco Starter", description: "Complete 10 sustainability actions", category: "milestones", pointsAwarded: 50, sortOrder: 2 },
  { code: "eco_enthusiast", name: "Eco Enthusiast", description: "Complete 50 sustainability actions", category: "milestones", pointsAwarded: 100, sortOrder: 3 },
  { code: "eco_champion", name: "Eco Champion", description: "Earn 1000 total EcoPoints", category: "milestones", pointsAwarded: 150, sortOrder: 4 },
  // --- Waste Reduction ---
  { code: "first_consume", name: "Clean Plate", description: "Consume your first item", category: "waste-reduction", pointsAwarded: 25, sortOrder: 5 },
  { code: "waste_watcher", name: "Waste Watcher", description: "Consume 25 items", category: "waste-reduction", pointsAwarded: 75, sortOrder: 6 },
  { code: "waste_warrior", name: "Waste Warrior", description: "80%+ waste reduction rate (min 20 items)", category: "waste-reduction", pointsAwarded: 100, sortOrder: 7 },
  { code: "zero_waste_hero", name: "Zero Waste Hero", description: "95%+ waste reduction rate (min 50 items)", category: "waste-reduction", pointsAwarded: 200, sortOrder: 8 },
  // --- Sharing ---
  { code: "first_sale", name: "First Sale", description: "Sell your first marketplace item", category: "sharing", pointsAwarded: 25, sortOrder: 9 },
  { code: "marketplace_regular", name: "Market Regular", description: "Sell 5 items on the marketplace", category: "sharing", pointsAwarded: 75, sortOrder: 10 },
  { code: "marketplace_pro", name: "Marketplace Pro", description: "Sell 15 items on the marketplace", category: "sharing", pointsAwarded: 150, sortOrder: 11 },
  { code: "sharing_champion", name: "Sharing Champion", description: "Share or sell 25 items total", category: "sharing", pointsAwarded: 200, sortOrder: 12 },
  // --- Streaks ---
  { code: "streak_3", name: "Getting Started", description: "3-day sustainability streak", category: "streaks", pointsAwarded: 25, sortOrder: 13 },
  { code: "streak_7", name: "Week Warrior", description: "7-day sustainability streak", category: "streaks", pointsAwarded: 75, sortOrder: 14 },
  { code: "streak_14", name: "Two-Week Titan", description: "14-day sustainability streak", category: "streaks", pointsAwarded: 125, sortOrder: 15 },
  { code: "streak_30", name: "Monthly Champion", description: "30-day sustainability streak", category: "streaks", pointsAwarded: 250, sortOrder: 16 },
];

async function seed() {
  try {
    // Clear existing data in correct order (respecting foreign keys)
    console.log("Clearing existing data...");
    sqlite.exec("DELETE FROM messages");
    sqlite.exec("DELETE FROM conversations");
    sqlite.exec("DELETE FROM product_sustainability_metrics");
    sqlite.exec("DELETE FROM user_points");
    sqlite.exec("DELETE FROM marketplace_listings");
    sqlite.exec("DELETE FROM listing_images");
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
    const createdProducts: { id: number; productName: string; userId: number; co2Emission: number; quantity: number; daysAgo: number }[] = [];

    for (let i = 0; i < sampleProducts.length; i++) {
      const product = sampleProducts[i];
      const owner = createdUsers[product.ownerIndex];

      const purchaseDate = new Date();
      purchaseDate.setDate(purchaseDate.getDate() - product.daysAgo);

      const [created] = await db
        .insert(schema.products)
        .values({
          userId: owner.id,
          productName: product.productName,
          category: product.category,
          quantity: product.quantity,
          unit: product.unit,
          unitPrice: product.unitPrice,
          purchaseDate,
          description: product.description,
          co2Emission: product.co2Emission,
        })
        .returning();

      createdProducts.push({
        id: created.id,
        productName: created.productName,
        userId: owner.id,
        co2Emission: product.co2Emission,
        quantity: product.quantity,
        daysAgo: product.daysAgo,
      });
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

    // ==================== Dashboard Data: Sustainability Metrics ====================
    console.log("\nCreating sustainability metrics (dashboard data)...");

    // Clear existing metrics
    sqlite.exec("DELETE FROM product_sustainability_metrics");
    sqlite.exec("DELETE FROM user_points");

    const actionTypes: ("consumed" | "wasted" | "shared" | "sold")[] = ["consumed", "wasted", "shared", "sold"];
    // Weights: most interactions are consumed, then shared/sold, least wasted
    const actionWeights = { consumed: 50, shared: 20, sold: 15, wasted: 15 };
    let metricsCount = 0;

    // Generate metrics spanning ~2 years for all users, denser in recent months
    for (const user of createdUsers) {
      const userProducts = createdProducts.filter(p => p.userId === user.id);
      if (userProducts.length === 0) continue;

      // Generate data points across 730 days (2 years)
      // More entries for recent months, fewer for older months
      for (let daysAgo = 0; daysAgo < 730; daysAgo++) {
        // Probability of an entry: higher for recent days
        let entriesForDay: number;
        if (daysAgo < 30) {
          entriesForDay = Math.random() < 0.7 ? Math.floor(Math.random() * 3) + 1 : 0;
        } else if (daysAgo < 90) {
          entriesForDay = Math.random() < 0.5 ? Math.floor(Math.random() * 2) + 1 : 0;
        } else if (daysAgo < 365) {
          entriesForDay = Math.random() < 0.3 ? 1 : 0;
        } else {
          entriesForDay = Math.random() < 0.15 ? 1 : 0;
        }

        for (let e = 0; e < entriesForDay; e++) {
          // Pick a weighted random action
          const rand = Math.random() * 100;
          let action: "consumed" | "wasted" | "shared" | "sold";
          if (rand < actionWeights.consumed) action = "consumed";
          else if (rand < actionWeights.consumed + actionWeights.shared) action = "shared";
          else if (rand < actionWeights.consumed + actionWeights.shared + actionWeights.sold) action = "sold";
          else action = "wasted";

          const product = userProducts[Math.floor(Math.random() * userProducts.length)];
          const quantity = Math.round((Math.random() * product.quantity * 0.3 + 0.1) * 100) / 100;

          const date = new Date();
          date.setDate(date.getDate() - daysAgo);
          const todayDate = date.toISOString().slice(0, 10); // YYYY-MM-DD

          await db.insert(schema.productSustainabilityMetrics).values({
            productId: product.id,
            userId: user.id,
            todayDate,
            quantity,
            type: action,
          });
          metricsCount++;
        }
      }
    }
    console.log(`  ✓ Created ${metricsCount} sustainability metric records`);

    // ==================== Sold Marketplace Listings (for money saved) ====================
    console.log("\nCreating sold marketplace listings (financial data)...");

    const soldItems = [
      { title: "Extra Rice Bag", price: 8.0, daysAgo: 5, sellerIndex: 0 },
      { title: "Leftover Party Snacks", price: 12.0, daysAgo: 15, sellerIndex: 0 },
      { title: "Excess Cooking Oil", price: 5.0, daysAgo: 30, sellerIndex: 0 },
      { title: "Bulk Oats Portion", price: 4.0, daysAgo: 60, sellerIndex: 0 },
      { title: "Homemade Cookies", price: 6.0, daysAgo: 90, sellerIndex: 0 },
      { title: "Canned Goods Set", price: 15.0, daysAgo: 120, sellerIndex: 0 },
      { title: "Frozen Berries", price: 7.0, daysAgo: 180, sellerIndex: 0 },
      { title: "Organic Tea Set", price: 10.0, daysAgo: 240, sellerIndex: 0 },
      { title: "Dried Pasta Bundle", price: 6.0, daysAgo: 300, sellerIndex: 0 },
      { title: "Jam Jars 3-pack", price: 9.0, daysAgo: 400, sellerIndex: 0 },
      { title: "Extra Milk Cartons", price: 5.0, daysAgo: 10, sellerIndex: 1 },
      { title: "Surplus Vegetables", price: 8.0, daysAgo: 45, sellerIndex: 1 },
      { title: "Bread Loaves", price: 3.0, daysAgo: 100, sellerIndex: 1 },
      { title: "Frozen Fish Portions", price: 11.0, daysAgo: 200, sellerIndex: 1 },
      { title: "Spice Collection", price: 14.0, daysAgo: 350, sellerIndex: 1 },
      { title: "Kimchi Batch", price: 6.0, daysAgo: 20, sellerIndex: 2 },
      { title: "Leftover BBQ Meat", price: 10.0, daysAgo: 70, sellerIndex: 2 },
      { title: "Excess Noodles", price: 4.0, daysAgo: 150, sellerIndex: 2 },
      { title: "Homemade Sauce Jars", price: 8.0, daysAgo: 280, sellerIndex: 2 },
      { title: "Dumpling Batch", price: 9.0, daysAgo: 25, sellerIndex: 3 },
      { title: "Sweet Potato Surplus", price: 5.0, daysAgo: 80, sellerIndex: 3 },
      { title: "Honey Jar", price: 12.0, daysAgo: 190, sellerIndex: 3 },
      { title: "Smoothie Fruits", price: 7.0, daysAgo: 12, sellerIndex: 4 },
      { title: "Lamb Cutlets", price: 15.0, daysAgo: 55, sellerIndex: 4 },
      { title: "Ice Cream Tubs", price: 8.0, daysAgo: 160, sellerIndex: 4 },
    ];

    for (const item of soldItems) {
      const seller = createdUsers[item.sellerIndex];
      const completedDate = new Date();
      completedDate.setDate(completedDate.getDate() - item.daysAgo);

      await db.insert(schema.marketplaceListings).values({
        sellerId: seller.id,
        title: item.title,
        description: `Sold item - ${item.title}`,
        category: "pantry",
        quantity: 1,
        unit: "pcs",
        price: item.price,
        originalPrice: item.price * 2,
        status: "sold",
        completedAt: completedDate,
        pickupLocation: "Singapore",
      });
    }
    console.log(`  ✓ Created ${soldItems.length} sold listings`);

    // ==================== User Points (Gamification) ====================
    console.log("\nCreating user points...");

    const userPointsData = [
      { userIndex: 0, totalPoints: 1250, currentStreak: 12 },
      { userIndex: 1, totalPoints: 980, currentStreak: 7 },
      { userIndex: 2, totalPoints: 720, currentStreak: 3 },
      { userIndex: 3, totalPoints: 540, currentStreak: 5 },
      { userIndex: 4, totalPoints: 860, currentStreak: 9 },
    ];

    for (const up of userPointsData) {
      const user = createdUsers[up.userIndex];
      await db.insert(schema.userPoints).values({
        userId: user.id,
        totalPoints: up.totalPoints,
        currentStreak: up.currentStreak,
      });
      console.log(`  ✓ ${user.name}: ${up.totalPoints} points, ${up.currentStreak}-day streak`);
    }

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
