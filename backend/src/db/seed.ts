import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { hashPassword } from "../middleware/auth";
import { BADGE_DEFINITIONS } from "../services/badge-service";
import { calculateCo2Saved } from "../utils/co2-factors";
try { require('dotenv/config'); } catch {}

const dbPath = process.env.DATABASE_PATH || "ecoplate.db";
const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

console.log("Seeding database...\n");

// Demo users
const DEMO_PASSWORD = "demo123"; // NOSONAR — development-only seed data, not used in production

const demoUsers = [
  { email: "alice@demo.com", password: DEMO_PASSWORD, name: "Alice Wong", userLocation: "Queenstown, Singapore 169648" },
  { email: "bob@demo.com", password: DEMO_PASSWORD, name: "Bob Tan", userLocation: "Clementi, Singapore 129588" },
  { email: "charlie@demo.com", password: DEMO_PASSWORD, name: "Charlie Lim", userLocation: "Tampines, Singapore 529510" },
  { email: "diana@demo.com", password: DEMO_PASSWORD, name: "Diana Chen", userLocation: "Jurong East, Singapore 609731" },
  { email: "evan@demo.com", password: DEMO_PASSWORD, name: "Evan Ng", userLocation: "Bishan, Singapore 570283" },
  // Additional users for ML training (20+ total)
  { email: "fiona@demo.com", password: DEMO_PASSWORD, name: "Fiona Lee", userLocation: "Woodlands, Singapore 730001" },
  { email: "george@demo.com", password: DEMO_PASSWORD, name: "George Koh", userLocation: "Ang Mo Kio, Singapore 560123" },
  { email: "hannah@demo.com", password: DEMO_PASSWORD, name: "Hannah Teo", userLocation: "Bedok, Singapore 460456" },
  { email: "isaac@demo.com", password: DEMO_PASSWORD, name: "Isaac Lim", userLocation: "Yishun, Singapore 760789" },
  { email: "julia@demo.com", password: DEMO_PASSWORD, name: "Julia Ong", userLocation: "Pasir Ris, Singapore 510321" },
  { email: "kevin@demo.com", password: DEMO_PASSWORD, name: "Kevin Chua", userLocation: "Sengkang, Singapore 540654" },
  { email: "lisa@demo.com", password: DEMO_PASSWORD, name: "Lisa Tan", userLocation: "Punggol, Singapore 820987" },
  { email: "marcus@demo.com", password: DEMO_PASSWORD, name: "Marcus Goh", userLocation: "Toa Payoh, Singapore 310111" },
  { email: "nancy@demo.com", password: DEMO_PASSWORD, name: "Nancy Yeo", userLocation: "Hougang, Singapore 530222" },
  { email: "oliver@demo.com", password: DEMO_PASSWORD, name: "Oliver Seah", userLocation: "Bukit Batok, Singapore 650333" },
  { email: "paula@demo.com", password: DEMO_PASSWORD, name: "Paula Ng", userLocation: "Choa Chu Kang, Singapore 680444" },
  { email: "" +
        "", password: DEMO_PASSWORD, name: "Quincy Wee", userLocation: "Marine Parade, Singapore 440555" },
  { email: "rachel@demo.com", password: DEMO_PASSWORD, name: "Rachel Sim", userLocation: "Geylang, Singapore 380666" },
  { email: "samuel@demo.com", password: DEMO_PASSWORD, name: "Samuel Foo", userLocation: "Kallang, Singapore 330777" },
  { email: "tina@demo.com", password: DEMO_PASSWORD, name: "Tina Loh", userLocation: "Novena, Singapore 320888" },
  { email: "ulric@demo.com", password: DEMO_PASSWORD, name: "Ulric Ho", userLocation: "Orchard, Singapore 238999" },
  { email: "vivian@demo.com", password: DEMO_PASSWORD, name: "Vivian Kwa", userLocation: "Tiong Bahru, Singapore 160111" },
  { email: "william@demo.com", password: DEMO_PASSWORD, name: "William Pang", userLocation: "Bugis, Singapore 180222" },
  { email: "xena@demo.com", password: DEMO_PASSWORD, name: "Xena Yeoh", userLocation: "City Hall, Singapore 179333" },
  { email: "yang@demo.com", password: DEMO_PASSWORD, name: "Yang Wei", userLocation: "Dhoby Ghaut, Singapore 238444" },
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
  // Additional products for new users (5-24)
  { productName: "Fresh Kale", category: "produce", quantity: 0.5, unit: "kg", unitPrice: 4.0, co2Emission: 0.3, description: "Organic curly kale", daysAgo: 3, ownerIndex: 5 },
  { productName: "Cottage Cheese", category: "dairy", quantity: 0.5, unit: "kg", unitPrice: 5.0, co2Emission: 1.2, description: "Low-fat cottage cheese", daysAgo: 7, ownerIndex: 5 },
  { productName: "Turkey Breast", category: "meat", quantity: 0.8, unit: "kg", unitPrice: 10.0, co2Emission: 4.0, description: "Lean turkey breast", daysAgo: 5, ownerIndex: 6 },
  { productName: "Rye Bread", category: "bakery", quantity: 1.0, unit: "pcs", unitPrice: 4.5, co2Emission: 0.7, description: "Traditional rye loaf", daysAgo: 2, ownerIndex: 6 },
  { productName: "Soy Milk", category: "dairy", quantity: 1.0, unit: "L", unitPrice: 3.5, co2Emission: 0.2, description: "Unsweetened soy milk", daysAgo: 10, ownerIndex: 7 },
  { productName: "Cauliflower", category: "produce", quantity: 1.0, unit: "pcs", unitPrice: 3.0, co2Emission: 0.3, description: "Fresh cauliflower head", daysAgo: 4, ownerIndex: 7 },
  { productName: "Salmon Steaks", category: "meat", quantity: 0.6, unit: "kg", unitPrice: 15.0, co2Emission: 5.0, description: "Wild salmon steaks", daysAgo: 3, ownerIndex: 8 },
  { productName: "Bagels Pack", category: "bakery", quantity: 6.0, unit: "pcs", unitPrice: 5.0, co2Emission: 1.0, description: "Sesame seed bagels", daysAgo: 1, ownerIndex: 8 },
  { productName: "Feta Cheese", category: "dairy", quantity: 0.2, unit: "kg", unitPrice: 6.0, co2Emission: 2.5, description: "Greek feta cheese", daysAgo: 14, ownerIndex: 9 },
  { productName: "Bell Peppers", category: "produce", quantity: 0.8, unit: "kg", unitPrice: 5.0, co2Emission: 0.4, description: "Mixed color peppers", daysAgo: 6, ownerIndex: 9 },
  { productName: "Ground Pork", category: "meat", quantity: 0.5, unit: "kg", unitPrice: 7.0, co2Emission: 4.5, description: "Lean ground pork", daysAgo: 4, ownerIndex: 10 },
  { productName: "Ciabatta Bread", category: "bakery", quantity: 2.0, unit: "pcs", unitPrice: 4.0, co2Emission: 0.8, description: "Italian ciabatta rolls", daysAgo: 2, ownerIndex: 10 },
  { productName: "Coconut Yogurt", category: "dairy", quantity: 0.5, unit: "kg", unitPrice: 7.0, co2Emission: 0.4, description: "Dairy-free coconut yogurt", daysAgo: 8, ownerIndex: 11 },
  { productName: "Zucchini", category: "produce", quantity: 1.0, unit: "kg", unitPrice: 4.0, co2Emission: 0.3, description: "Fresh green zucchini", daysAgo: 5, ownerIndex: 11 },
  { productName: "Beef Ribs", category: "meat", quantity: 1.0, unit: "kg", unitPrice: 18.0, co2Emission: 12.0, description: "Bone-in beef ribs", daysAgo: 3, ownerIndex: 12 },
  { productName: "Focaccia", category: "bakery", quantity: 1.0, unit: "pcs", unitPrice: 6.0, co2Emission: 0.9, description: "Rosemary focaccia", daysAgo: 1, ownerIndex: 12 },
  { productName: "Ricotta Cheese", category: "dairy", quantity: 0.3, unit: "kg", unitPrice: 5.0, co2Emission: 1.8, description: "Fresh ricotta", daysAgo: 7, ownerIndex: 13 },
  { productName: "Eggplant", category: "produce", quantity: 0.8, unit: "kg", unitPrice: 3.5, co2Emission: 0.3, description: "Purple eggplant", daysAgo: 4, ownerIndex: 13 },
  { productName: "Duck Legs", category: "meat", quantity: 0.6, unit: "kg", unitPrice: 12.0, co2Emission: 6.0, description: "Free-range duck legs", daysAgo: 5, ownerIndex: 14 },
  { productName: "Pretzel Rolls", category: "bakery", quantity: 4.0, unit: "pcs", unitPrice: 5.0, co2Emission: 0.6, description: "Soft pretzel rolls", daysAgo: 2, ownerIndex: 14 },
  { productName: "Halloumi", category: "dairy", quantity: 0.25, unit: "kg", unitPrice: 8.0, co2Emission: 2.2, description: "Grilling cheese", daysAgo: 12, ownerIndex: 15 },
  { productName: "Bok Choy", category: "produce", quantity: 0.5, unit: "kg", unitPrice: 3.0, co2Emission: 0.2, description: "Baby bok choy", daysAgo: 3, ownerIndex: 15 },
  { productName: "Venison", category: "meat", quantity: 0.5, unit: "kg", unitPrice: 25.0, co2Emission: 8.0, description: "NZ venison steaks", daysAgo: 4, ownerIndex: 16 },
  { productName: "Challah Bread", category: "bakery", quantity: 1.0, unit: "pcs", unitPrice: 7.0, co2Emission: 0.8, description: "Braided challah", daysAgo: 1, ownerIndex: 16 },
  { productName: "Mascarpone", category: "dairy", quantity: 0.25, unit: "kg", unitPrice: 6.0, co2Emission: 2.0, description: "Italian mascarpone", daysAgo: 10, ownerIndex: 17 },
  { productName: "Asparagus", category: "produce", quantity: 0.4, unit: "kg", unitPrice: 8.0, co2Emission: 0.5, description: "Green asparagus spears", daysAgo: 4, ownerIndex: 17 },
  { productName: "Rabbit Meat", category: "meat", quantity: 0.8, unit: "kg", unitPrice: 20.0, co2Emission: 3.0, description: "Farm-raised rabbit", daysAgo: 5, ownerIndex: 18 },
  { productName: "Brioche", category: "bakery", quantity: 1.0, unit: "pcs", unitPrice: 5.5, co2Emission: 0.9, description: "French brioche loaf", daysAgo: 2, ownerIndex: 18 },
  { productName: "Brie Cheese", category: "dairy", quantity: 0.2, unit: "kg", unitPrice: 9.0, co2Emission: 2.8, description: "French brie wheel", daysAgo: 14, ownerIndex: 19 },
  { productName: "Artichokes", category: "produce", quantity: 4.0, unit: "pcs", unitPrice: 6.0, co2Emission: 0.4, description: "Fresh artichokes", daysAgo: 5, ownerIndex: 19 },
  { productName: "Quail Eggs", category: "dairy", quantity: 12.0, unit: "pcs", unitPrice: 5.0, co2Emission: 0.8, description: "Fresh quail eggs", daysAgo: 7, ownerIndex: 20 },
  { productName: "Radishes", category: "produce", quantity: 0.3, unit: "kg", unitPrice: 2.5, co2Emission: 0.2, description: "Red radishes bunch", daysAgo: 3, ownerIndex: 20 },
  { productName: "Goose Liver", category: "meat", quantity: 0.2, unit: "kg", unitPrice: 35.0, co2Emission: 4.0, description: "Premium foie gras", daysAgo: 2, ownerIndex: 21 },
  { productName: "Pumpernickel", category: "bakery", quantity: 1.0, unit: "pcs", unitPrice: 5.0, co2Emission: 0.7, description: "Dark pumpernickel", daysAgo: 3, ownerIndex: 21 },
  { productName: "Camembert", category: "dairy", quantity: 0.25, unit: "kg", unitPrice: 8.0, co2Emission: 2.5, description: "French camembert", daysAgo: 10, ownerIndex: 22 },
  { productName: "Fennel", category: "produce", quantity: 0.5, unit: "kg", unitPrice: 4.0, co2Emission: 0.3, description: "Fresh fennel bulbs", daysAgo: 4, ownerIndex: 22 },
  { productName: "Ostrich Steak", category: "meat", quantity: 0.4, unit: "kg", unitPrice: 28.0, co2Emission: 5.0, description: "Lean ostrich fillet", daysAgo: 3, ownerIndex: 23 },
  { productName: "Cornbread", category: "bakery", quantity: 1.0, unit: "pcs", unitPrice: 4.0, co2Emission: 0.6, description: "Southern cornbread", daysAgo: 1, ownerIndex: 23 },
  { productName: "Parmesan", category: "dairy", quantity: 0.3, unit: "kg", unitPrice: 15.0, co2Emission: 3.5, description: "Aged parmesan wedge", daysAgo: 30, ownerIndex: 24 },
  { productName: "Leeks", category: "produce", quantity: 0.6, unit: "kg", unitPrice: 3.5, co2Emission: 0.3, description: "Fresh leeks", daysAgo: 5, ownerIndex: 24 },
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
    imageUrl: "/images/marketplace/1560806887-1e4cd0b6cbd6.jpg",
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
    imageUrl: "/images/marketplace/1570913149827-d2ac84ab3f9a.jpg",
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
    imageUrl: "/images/marketplace/1619546813926-a78fa6372cd2.jpg",
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
    imageUrl: "/images/marketplace/1571771894821-ce9b6c11b08e.jpg",
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
    imageUrl: "/images/marketplace/1547514701-42782101795e.jpg",
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
    imageUrl: "/images/marketplace/1464965911861-746a04b4bca6.jpg",
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
    imageUrl: "/images/marketplace/1576045057995-568f588f82fb.jpg",
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
    imageUrl: "/images/marketplace/1546470427-0d4db154ceb8.jpg",
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
    imageUrl: "/images/marketplace/1563636619-e9143da7973b.jpg",
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
    imageUrl: "/images/marketplace/1488477181946-6428a0291777.jpg",
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
    imageUrl: "/images/marketplace/1618164436241-4473940d1f5c.jpg",
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
    imageUrl: "/images/marketplace/1509440159596-0249088772ff.jpg",
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
    imageUrl: "/images/marketplace/1555507036-ab1f4038808a.jpg",
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
    imageUrl: "/images/marketplace/sourdough-loaf.jpg",
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
    imageUrl: "/images/marketplace/1604503468506-a8da13d82791.jpg",
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
    imageUrl: "/images/marketplace/1602470520998-f4a52199a3d6.jpg",
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
    imageUrl: "/images/marketplace/1496116218417-1a781b1c416c.jpg",
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
    imageUrl: "/images/marketplace/1597362925123-77861d3fbac7.jpg",
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
    imageUrl: "/images/marketplace/1621506289937-a8e4df240d0b.jpg",
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
    imageUrl: "/images/marketplace/1536657464919-892534f60d6e.jpg",
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
    imageUrl: "/images/marketplace/1551462147-ff29053bfc14.jpg",
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
    imageUrl: "/images/marketplace/1558642452-9d2a7deb7f62.jpg",
  },
];

// Additional marketplace listings for ML training (200+ total)
// These will be dynamically generated to have varied statuses and prices
const categories = ["produce", "dairy", "meat", "bakery", "frozen", "beverages", "pantry", "snacks"] as const;
const locations = [
  "Woodlands MRT|1.4368,103.7865",
  "Ang Mo Kio Hub|1.3691,103.8494",
  "Bedok Mall|1.3245,103.9302",
  "Yishun MRT|1.4293,103.8350",
  "Pasir Ris MRT|1.3730,103.9493",
  "Sengkang MRT|1.3916,103.8955",
  "Punggol MRT|1.4052,103.9023",
  "Toa Payoh Hub|1.3326,103.8471",
  "Hougang Mall|1.3723,103.8925",
  "Bukit Batok MRT|1.3490,103.7498",
];

const productTemplates = [
  // Produce
  { title: "Fresh Carrots", category: "produce", unit: "kg", basePrice: 3.0, imageUrl: "/images/marketplace/1598170845058-32b9d6a5da37.jpg" },
  { title: "Organic Lettuce", category: "produce", unit: "pcs", basePrice: 4.0, imageUrl: "/images/marketplace/1622206151226-18ca2c9ab4a1.jpg" },
  { title: "Ripe Mangoes", category: "produce", unit: "kg", basePrice: 8.0, imageUrl: "/images/marketplace/1553279768-865429fa0078.jpg" },
  { title: "Fresh Grapes", category: "produce", unit: "kg", basePrice: 12.0, imageUrl: "/images/marketplace/1537640538966-79f369143f8f.jpg" },
  { title: "Watermelon Half", category: "produce", unit: "pcs", basePrice: 6.0, imageUrl: "/images/marketplace/1589984662646-e7b2e4962f18.jpg" },
  { title: "Papaya", category: "produce", unit: "pcs", basePrice: 5.0, imageUrl: "/images/marketplace/1517282009859-f000ec3b26fe.jpg" },
  { title: "Dragon Fruit", category: "produce", unit: "pcs", basePrice: 4.0, imageUrl: "/images/marketplace/1527325678964-54921661f888.jpg" },
  { title: "Fresh Corn", category: "produce", unit: "pcs", basePrice: 2.0, imageUrl: "/images/marketplace/1551754655-cd27e38d2076.jpg" },
  { title: "Bell Peppers", category: "produce", unit: "kg", basePrice: 6.0, imageUrl: "/images/marketplace/1563565375-f3fdfdbefa83.jpg" },
  { title: "Mushrooms Pack", category: "produce", unit: "pcs", basePrice: 5.0, imageUrl: "/images/marketplace/1504545102780-26774c1bb073.jpg" },
  // Dairy
  { title: "Fresh Butter", category: "dairy", unit: "pcs", basePrice: 7.0, imageUrl: "/images/marketplace/1589985270826-4b7bb135bc9d.jpg" },
  { title: "Cream Cheese", category: "dairy", unit: "pcs", basePrice: 6.0, imageUrl: "/images/marketplace/1486297678162-eb2a19b0a32d.jpg" },
  { title: "Sour Cream", category: "dairy", unit: "pcs", basePrice: 4.0, imageUrl: "/images/marketplace/sour-cream.jpg" },
  { title: "Cottage Cheese", category: "dairy", unit: "pcs", basePrice: 5.0, imageUrl: "/images/marketplace/1628088062854-d1870b4553da.jpg" },
  { title: "Flavored Yogurt Pack", category: "dairy", unit: "pcs", basePrice: 6.0, imageUrl: "/images/marketplace/1571212515416-fef01fc43637.jpg" },
  // Meat
  { title: "Pork Ribs", category: "meat", unit: "kg", basePrice: 15.0, imageUrl: "/images/marketplace/1544025162-d76694265947.jpg" },
  { title: "Duck Breast", category: "meat", unit: "kg", basePrice: 20.0, imageUrl: "/images/marketplace/1580554530778-ca36943938b2.jpg" },
  { title: "Lamb Leg", category: "meat", unit: "kg", basePrice: 25.0, imageUrl: "/images/marketplace/1603048297172-c92544798d5a.jpg" },
  { title: "Beef Steak", category: "meat", unit: "kg", basePrice: 30.0, imageUrl: "/images/marketplace/1600891964092-4316c288032e.jpg" },
  { title: "Chicken Wings", category: "meat", unit: "kg", basePrice: 8.0, imageUrl: "/images/marketplace/1527477396000-e27163b481c2.jpg" },
  // Bakery
  { title: "Baguette", category: "bakery", unit: "pcs", basePrice: 4.0, imageUrl: "/images/marketplace/1549931319-a545dcf3bc73.jpg" },
  { title: "Cinnamon Rolls", category: "bakery", unit: "pcs", basePrice: 8.0, imageUrl: "/images/marketplace/1509365465985-25d11c17e812.jpg" },
  { title: "Muffins Pack", category: "bakery", unit: "pcs", basePrice: 6.0, imageUrl: "/images/marketplace/1607958996333-41aef7caefaa.jpg" },
  { title: "Danish Pastry", category: "bakery", unit: "pcs", basePrice: 5.0, imageUrl: "/images/marketplace/1509983165097-0c31a863e3f3.jpg" },
  { title: "Birthday Cake Slice", category: "bakery", unit: "pcs", basePrice: 7.0, imageUrl: "/images/marketplace/1578985545062-69928b1d9587.jpg" },
  // Frozen
  { title: "Frozen Pizza", category: "frozen", unit: "pcs", basePrice: 12.0, imageUrl: "/images/marketplace/1565299624946-b28f40a0ae38.jpg" },
  { title: "Ice Cream Pint", category: "frozen", unit: "pcs", basePrice: 8.0, imageUrl: "/images/marketplace/1497034825429-c343d7c6a68f.jpg" },
  { title: "Frozen Fish Sticks", category: "frozen", unit: "pcs", basePrice: 7.0, imageUrl: "/images/marketplace/1544943910-4c1dc44aab44.jpg" },
  { title: "Frozen Waffles", category: "frozen", unit: "pcs", basePrice: 5.0, imageUrl: "/images/marketplace/1562376552-0d160a2f238d.jpg" },
  { title: "Frozen Berries Mix", category: "frozen", unit: "kg", basePrice: 10.0, imageUrl: "/images/marketplace/1465056836041-7f43ac27dcb5.jpg" },
  // Beverages
  { title: "Apple Juice", category: "beverages", unit: "L", basePrice: 5.0, imageUrl: "/images/marketplace/1576673442511-7e39b6545c87.jpg" },
  { title: "Almond Milk", category: "beverages", unit: "L", basePrice: 6.0, imageUrl: "/images/marketplace/1600788907416-456578634209.jpg" },
  { title: "Iced Tea Pack", category: "beverages", unit: "pcs", basePrice: 8.0, imageUrl: "/images/marketplace/1556679343-c7306c1976bc.jpg" },
  { title: "Smoothie Bottle", category: "beverages", unit: "pcs", basePrice: 7.0, imageUrl: "/images/marketplace/1505252585461-04db1eb84625.jpg" },
  { title: "Coconut Milk", category: "beverages", unit: "L", basePrice: 4.0, imageUrl: "/images/marketplace/1550583724-b2692b85b150.jpg" },
  // Pantry
  { title: "Olive Oil", category: "pantry", unit: "L", basePrice: 15.0, imageUrl: "/images/marketplace/1474979266404-7eaacbcd87c5.jpg" },
  { title: "Peanut Butter", category: "pantry", unit: "pcs", basePrice: 6.0, imageUrl: "/images/marketplace/peanut-butter.jpg" },
  { title: "Maple Syrup", category: "pantry", unit: "pcs", basePrice: 12.0, imageUrl: "/images/marketplace/1589496933738-f5c27bc146e3.jpg" },
  { title: "Rice Crackers", category: "pantry", unit: "pcs", basePrice: 4.0, imageUrl: "/images/marketplace/1558961363-fa8fdf82db35.jpg" },
  { title: "Instant Noodles Pack", category: "pantry", unit: "pcs", basePrice: 5.0, imageUrl: "/images/marketplace/1612929633738-8fe44f7ec841.jpg" },
  // Snacks
  { title: "Chocolate Bar", category: "snacks", unit: "pcs", basePrice: 3.0, imageUrl: "/images/marketplace/1549007994-cb92caebd54b.jpg" },
  { title: "Chips Variety Pack", category: "snacks", unit: "pcs", basePrice: 8.0, imageUrl: "/images/marketplace/1566478989037-eec170784d0b.jpg" },
  { title: "Trail Mix", category: "snacks", unit: "pcs", basePrice: 6.0, imageUrl: "/images/marketplace/1604068549290-dea0e4a305ca.jpg" },
  { title: "Cookies Box", category: "snacks", unit: "pcs", basePrice: 7.0, imageUrl: "/images/marketplace/1499636136210-6f4ee915583e.jpg" },
  { title: "Granola Bars", category: "snacks", unit: "pcs", basePrice: 5.0, imageUrl: "/images/marketplace/1558864559-ed673ba3610b.jpg" },
];

// Generate additional active listings
const additionalActiveListings: typeof sampleListings = [];
for (let i = 0; i < 80; i++) {
  const template = productTemplates[i % productTemplates.length];
  const sellerIndex = (i % 20) + 5; // Use users 5-24 (the new users)
  const locationIdx = i % locations.length;
  const expiryDays = Math.floor(Math.random() * 30) + 1; // 1-30 days
  const quantity = Math.random() * 3 + 0.5;
  const discountPercent = Math.random() * 0.5 + 0.1; // 10-60% discount
  const originalPrice = template.basePrice * (1 + Math.random() * 0.5); // Vary base price
  const price = Math.round(originalPrice * (1 - discountPercent) * 100) / 100;

  additionalActiveListings.push({
    title: template.title + (i > 44 ? ` (Lot ${Math.floor(i / 45) + 1})` : ""),
    description: `Fresh ${template.title.toLowerCase()}. Selling surplus from bulk purchase.`,
    category: template.category,
    quantity: Math.round(quantity * 10) / 10,
    unit: template.unit,
    price: Math.max(price, 0.5),
    originalPrice: Math.round(originalPrice * 100) / 100,
    expiryDays,
    location: locations[locationIdx],
    sellerIndex,
    imageUrl: template.imageUrl,
  });
}

// Generate sold listings with varied discount ratios for price model training
interface SoldListingTemplate {
  title: string;
  category: string;
  unit: string;
  quantity: number;
  price: number;
  originalPrice: number;
  daysAgo: number;
  sellerIndex: number;
  buyerIndex: number;
}

const additionalSoldListings: SoldListingTemplate[] = [];
for (let i = 0; i < 120; i++) {
  const template = productTemplates[i % productTemplates.length];
  const sellerIndex = i % 25;
  const buyerIndex = (i + 5) % 25; // Different buyer
  const daysAgo = Math.floor(Math.random() * 365) + 1; // Sold in past year

  // Create varied discount ratios for ML training
  // Some quick sales at high discount, some slower at low discount
  const discountTiers = [
    { discount: 0.15, weight: 10 },  // 15% discount
    { discount: 0.25, weight: 15 },  // 25% discount
    { discount: 0.35, weight: 25 },  // 35% discount
    { discount: 0.45, weight: 25 },  // 45% discount
    { discount: 0.55, weight: 15 },  // 55% discount
    { discount: 0.65, weight: 10 },  // 65% discount
  ];

  let rand = Math.random() * 100;
  let discount = 0.35;
  let cumWeight = 0;
  for (const tier of discountTiers) {
    cumWeight += tier.weight;
    if (rand < cumWeight) {
      discount = tier.discount + (Math.random() * 0.08 - 0.04); // Add noise
      break;
    }
  }
  discount = Math.max(0.05, Math.min(0.75, discount)); // Clamp to valid range

  const originalPrice = template.basePrice * (1 + Math.random() * 0.5);
  const price = Math.round(originalPrice * (1 - discount) * 100) / 100;

  additionalSoldListings.push({
    title: `${template.title} (Sold)`,
    category: template.category,
    unit: template.unit,
    quantity: Math.round((Math.random() * 2 + 0.5) * 10) / 10,
    price: Math.max(price, 0.5),
    originalPrice: Math.round(originalPrice * 100) / 100,
    daysAgo,
    sellerIndex,
    buyerIndex,
  });
}

// Generate expired/cancelled listings for realistic data distribution
interface ExpiredListingTemplate {
  title: string;
  category: string;
  unit: string;
  quantity: number;
  price: number;
  originalPrice: number;
  daysAgo: number;
  sellerIndex: number;
  status: "expired" | "cancelled";
}

const additionalExpiredListings: ExpiredListingTemplate[] = [];
for (let i = 0; i < 30; i++) {
  const template = productTemplates[i % productTemplates.length];
  const sellerIndex = i % 25;
  const daysAgo = Math.floor(Math.random() * 180) + 30;
  const originalPrice = template.basePrice * (1 + Math.random() * 0.3);
  // Items that didn't sell often had low discounts
  const discount = Math.random() * 0.2 + 0.05; // Only 5-25% discount
  const price = Math.round(originalPrice * (1 - discount) * 100) / 100;

  additionalExpiredListings.push({
    title: `${template.title} (Expired)`,
    category: template.category,
    unit: template.unit,
    quantity: Math.round((Math.random() * 2 + 0.5) * 10) / 10,
    price,
    originalPrice: Math.round(originalPrice * 100) / 100,
    daysAgo,
    sellerIndex,
    status: i % 3 === 0 ? "cancelled" : "expired",
  });
}

// Sample conversation messages
const sampleConversationMessages = [
  { text: "Hi! Is this still available?", fromBuyer: true },
  { text: "Yes, it is! When would you like to pick it up?", fromBuyer: false },
  { text: "Can I come by tomorrow afternoon around 3pm?", fromBuyer: true },
  { text: "That works for me. See you then!", fromBuyer: false },
];

// EcoLocker locations - 20 Singapore locker stations
const singaporeLockers = [
  // Central
  { name: "Orchard Gateway", address: "277 Orchard Rd, Singapore 238858", coordinates: "1.3008,103.8442", compartments: 16, hours: "24/7" },
  { name: "Somerset MRT", address: "1 Somerset Rd, Singapore 238162", coordinates: "1.3006,103.8387", compartments: 12, hours: "6:00 AM - 12:00 AM" },
  { name: "Raffles City", address: "252 North Bridge Rd, Singapore 179103", coordinates: "1.2937,103.8530", compartments: 16, hours: "24/7" },
  { name: "Marina Bay Sands", address: "10 Bayfront Ave, Singapore 018956", coordinates: "1.2834,103.8607", compartments: 20, hours: "10:00 AM - 11:00 PM" },
  // East
  { name: "Tampines Mall", address: "4 Tampines Central 5, Singapore 529510", coordinates: "1.3525,103.9447", compartments: 16, hours: "24/7" },
  { name: "Bedok Mall", address: "311 New Upper Changi Rd, Singapore 467360", coordinates: "1.3244,103.9302", compartments: 12, hours: "10:00 AM - 10:00 PM" },
  { name: "Changi City Point", address: "5 Changi Business Park Central 1, Singapore 486038", coordinates: "1.3341,103.9670", compartments: 12, hours: "24/7" },
  { name: "Paya Lebar Quarter", address: "10 Paya Lebar Rd, Singapore 409057", coordinates: "1.3177,103.8929", compartments: 16, hours: "24/7" },
  // West
  { name: "Jurong Point", address: "63 Jurong West Central 3, Singapore 648331", coordinates: "1.3397,103.7066", compartments: 16, hours: "24/7" },
  { name: "Clementi Mall", address: "3155 Commonwealth Ave West, Singapore 129588", coordinates: "1.3148,103.7641", compartments: 12, hours: "10:00 AM - 10:00 PM" },
  { name: "Westgate", address: "3 Gateway Dr, Singapore 608532", coordinates: "1.3340,103.7424", compartments: 16, hours: "24/7" },
  { name: "JEM", address: "50 Jurong Gateway Rd, Singapore 608549", coordinates: "1.3333,103.7431", compartments: 12, hours: "10:00 AM - 10:00 PM" },
  // North
  { name: "Northpoint City", address: "930 Yishun Ave 2, Singapore 769098", coordinates: "1.4299,103.8359", compartments: 16, hours: "24/7" },
  { name: "Causeway Point", address: "1 Woodlands Square, Singapore 738099", coordinates: "1.4363,103.7864", compartments: 16, hours: "24/7" },
  { name: "Sun Plaza", address: "30 Sembawang Dr, Singapore 757713", coordinates: "1.4489,103.8201", compartments: 12, hours: "10:00 AM - 10:00 PM" },
  { name: "Ang Mo Kio Hub", address: "53 Ang Mo Kio Ave 3, Singapore 569933", coordinates: "1.3691,103.8488", compartments: 16, hours: "24/7" },
  // Northeast
  { name: "NEX Serangoon", address: "23 Serangoon Central, Singapore 556083", coordinates: "1.3506,103.8718", compartments: 16, hours: "24/7" },
  { name: "Punggol Waterway Point", address: "83 Punggol Central, Singapore 828761", coordinates: "1.4061,103.9024", compartments: 12, hours: "10:00 AM - 10:00 PM" },
  { name: "Compass One", address: "1 Sengkang Square, Singapore 545078", coordinates: "1.3920,103.8953", compartments: 12, hours: "10:00 AM - 10:00 PM" },
  { name: "Hougang Mall", address: "90 Hougang Ave 10, Singapore 538766", coordinates: "1.3726,103.8937", compartments: 12, hours: "10:00 AM - 10:00 PM" },
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

// Sample rewards for EcoPoints redemption
// Categories: "food" (F&B vouchers), "apparel" (clothing brands)
const sampleRewards = [
  // Food & Beverage vouchers
  {
    name: "Starbucks Gift Card $5",
    description: "Enjoy a $5 Starbucks gift card. Perfect for your morning coffee!",
    imageUrl: "/images/rewards/starbucks.png",
    category: "food",
    pointsCost: 300,
    stock: 50,
  },
  {
    name: "Grab Voucher $5",
    description: "Redeem for a $5 Grab voucher. Use for rides or GrabFood!",
    imageUrl: "/images/rewards/grab.jpg",
    category: "food",
    pointsCost: 350,
    stock: 75,
  },
  {
    name: "Luckin Coffee $3",
    description: "Enjoy a $3 Luckin Coffee voucher. Great value for quality coffee!",
    imageUrl: "/images/rewards/luckin.jpg",
    category: "food",
    pointsCost: 200,
    stock: 100,
  },
  {
    name: "CHAGEE Voucher $5",
    description: "Redeem for a $5 CHAGEE voucher. Premium tea at your fingertips!",
    imageUrl: "/images/rewards/chagee.png",
    category: "food",
    pointsCost: 300,
    stock: 80,
  },
  {
    name: "EZ-Link Card Top-up $5",
    description: "Get $5 credit for your EZ-Link card. Use for public transport!",
    imageUrl: "/images/rewards/ezlink.png",
    category: "food",
    pointsCost: 400,
    stock: 60,
  },
  {
    name: "GongCha Voucher $5",
    description: "Redeem for a $5 GongCha voucher. Enjoy premium bubble tea!",
    imageUrl: "/images/rewards/gongcha.webp",
    category: "food",
    pointsCost: 300,
    stock: 80,
  },
  // Apparel vouchers
  {
    name: "Adidas Voucher $10",
    description: "Get a $10 Adidas voucher. Treat yourself to sustainable sportswear!",
    imageUrl: "/images/rewards/adidas.jpg",
    category: "apparel",
    pointsCost: 800,
    stock: 30,
  },
  {
    name: "Nike Voucher $10",
    description: "Redeem for a $10 Nike voucher. Gear up with eco-conscious style!",
    imageUrl: "/images/rewards/nike.jpg",
    category: "apparel",
    pointsCost: 800,
    stock: 30,
  },
  // Premium high-value vouchers (requires saving up)
  {
    name: "Uniqlo Voucher $50",
    description: "Premium $50 Uniqlo voucher. Reward yourself with sustainable fashion essentials!",
    imageUrl: "/images/rewards/uniqlo.png",
    category: "apparel",
    pointsCost: 3500,
    stock: 10,
  },
  {
    name: "Din Tai Fung Voucher $50",
    description: "Premium $50 Din Tai Fung voucher. Treat yourself to world-famous dumplings and cuisine!",
    imageUrl: "/images/rewards/dintaifung.png",
    category: "food",
    pointsCost: 4000,
    stock: 8,
  },
];

async function seed() {
  try {
    // Clear existing data in correct order (respecting foreign keys)
    console.log("Clearing existing data...");
    sqlite.exec("DELETE FROM user_redemptions");
    sqlite.exec("DELETE FROM rewards");
    sqlite.exec("DELETE FROM locker_notifications");
    sqlite.exec("DELETE FROM locker_orders");
    sqlite.exec("DELETE FROM lockers");
    sqlite.exec("DELETE FROM messages");
    sqlite.exec("DELETE FROM conversations");
    sqlite.exec("DELETE FROM listing_images");
    sqlite.exec("DELETE FROM product_sustainability_metrics");
    sqlite.exec("DELETE FROM user_points");
    sqlite.exec("DELETE FROM marketplace_listings");
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

    // Create EcoLocker locations
    console.log("\nCreating EcoLocker locations...");
    for (const locker of singaporeLockers) {
      await db.insert(schema.lockers).values({
        name: locker.name,
        address: locker.address,
        coordinates: locker.coordinates,
        totalCompartments: locker.compartments,
        availableCompartments: locker.compartments,
        operatingHours: locker.hours,
        status: "active",
      });
      console.log(`  ✓ ${locker.name}`);
    }

    // Create badges
    console.log("\nCreating badges...");
    for (const badge of sampleBadges) {
      await db.insert(schema.badges).values(badge);
      console.log(`  ✓ ${badge.name}`);
    }

    // Create rewards
    console.log("\nCreating rewards...");
    for (const reward of sampleRewards) {
      await db.insert(schema.rewards).values({
        name: reward.name,
        description: reward.description,
        imageUrl: reward.imageUrl,
        category: reward.category,
        pointsCost: reward.pointsCost,
        stock: reward.stock,
        isActive: true,
      });
      console.log(`  ✓ ${reward.name} (${reward.pointsCost} points)`);
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

      // Calculate CO2 saved for this listing
      const co2Saved = calculateCo2Saved(listing.quantity, listing.unit, listing.category);

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
        co2Saved,
        images: listing.imageUrl ? JSON.stringify([listing.imageUrl]) : null,
      }).returning();

      createdListings.push({ id: created.id, sellerId: seller.id, title: created.title });
      console.log(`  ✓ "${listing.title}" by ${seller.name} (${co2Saved}kg CO2)`);
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

    // Varying discount multipliers so distribution isn't all 50%
    const discountMultipliers = [1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.5, 3.0, 3.5, 4.0];

    for (let i = 0; i < soldItems.length; i++) {
      const item = soldItems[i];
      const seller = createdUsers[item.sellerIndex];
      const completedDate = new Date();
      completedDate.setDate(completedDate.getDate() - item.daysAgo);

      // createdAt must be BEFORE completedAt (listed 1-14 days before sold)
      const listingDuration = Math.floor(Math.random() * 13) + 1; // 1-14 days
      const createdDate = new Date(completedDate);
      createdDate.setDate(createdDate.getDate() - listingDuration);

      // Varying originalPrice for realistic discount distribution
      const multiplier = discountMultipliers[i % discountMultipliers.length];
      const originalPrice = Math.round(item.price * multiplier * 100) / 100;

      // Calculate CO2 saved for sold items
      const co2Saved = calculateCo2Saved(1, "pcs", "pantry");

      await db.insert(schema.marketplaceListings).values({
        sellerId: seller.id,
        title: item.title,
        description: `Sold item - ${item.title}`,
        category: "pantry",
        quantity: 1,
        unit: "pcs",
        price: item.price,
        originalPrice,
        status: "sold",
        createdAt: createdDate,
        completedAt: completedDate,
        pickupLocation: "Singapore",
        co2Saved,
      });
    }
    console.log(`  ✓ Created ${soldItems.length} sold listings (with CO2 data)`);

    // ==================== Additional ML Training Data ====================
    console.log("\nCreating additional ML training data...");

    // Insert additional active listings
    let additionalActiveCount = 0;
    for (const listing of additionalActiveListings) {
      if (listing.sellerIndex >= createdUsers.length) continue;
      const seller = createdUsers[listing.sellerIndex];

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + listing.expiryDays);

      const co2Saved = calculateCo2Saved(listing.quantity, listing.unit, listing.category);

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
        co2Saved,
        images: listing.imageUrl ? JSON.stringify([listing.imageUrl]) : null,
      });
      additionalActiveCount++;
    }
    console.log(`  ✓ Created ${additionalActiveCount} additional active listings`);

    // Insert additional sold listings with varied discount ratios
    let additionalSoldCount = 0;
    for (const listing of additionalSoldListings) {
      if (listing.sellerIndex >= createdUsers.length) continue;
      if (listing.buyerIndex >= createdUsers.length) continue;

      const seller = createdUsers[listing.sellerIndex];
      const buyer = createdUsers[listing.buyerIndex];

      const completedDate = new Date();
      completedDate.setDate(completedDate.getDate() - listing.daysAgo);

      const listingDuration = Math.floor(Math.random() * 10) + 1;
      const createdDate = new Date(completedDate);
      createdDate.setDate(createdDate.getDate() - listingDuration);

      const expiryDate = new Date(completedDate);
      expiryDate.setDate(expiryDate.getDate() + Math.floor(Math.random() * 14) + 1);

      const co2Saved = calculateCo2Saved(listing.quantity, listing.unit, listing.category);

      await db.insert(schema.marketplaceListings).values({
        sellerId: seller.id,
        buyerId: buyer.id,
        title: listing.title,
        description: `Sold: ${listing.title}`,
        category: listing.category,
        quantity: listing.quantity,
        unit: listing.unit,
        price: listing.price,
        originalPrice: listing.originalPrice,
        expiryDate,
        pickupLocation: locations[listing.sellerIndex % locations.length],
        status: "sold",
        createdAt: createdDate,
        completedAt: completedDate,
        co2Saved,
      });
      additionalSoldCount++;
    }
    console.log(`  ✓ Created ${additionalSoldCount} additional sold listings (for ML training)`);

    // Insert expired/cancelled listings
    let additionalExpiredCount = 0;
    for (const listing of additionalExpiredListings) {
      if (listing.sellerIndex >= createdUsers.length) continue;

      const seller = createdUsers[listing.sellerIndex];

      const createdDate = new Date();
      createdDate.setDate(createdDate.getDate() - listing.daysAgo);

      const expiryDate = new Date(createdDate);
      expiryDate.setDate(expiryDate.getDate() + 7); // Was listed for 7 days

      await db.insert(schema.marketplaceListings).values({
        sellerId: seller.id,
        title: listing.title,
        description: `${listing.status}: ${listing.title}`,
        category: listing.category,
        quantity: listing.quantity,
        unit: listing.unit,
        price: listing.price,
        originalPrice: listing.originalPrice,
        expiryDate,
        pickupLocation: locations[listing.sellerIndex % locations.length],
        status: listing.status,
        createdAt: createdDate,
      });
      additionalExpiredCount++;
    }
    console.log(`  ✓ Created ${additionalExpiredCount} expired/cancelled listings`);

    // ==================== User Points (Gamification) ====================
    console.log("\nCreating user points...");

    // Generate points for all users
    for (let i = 0; i < createdUsers.length; i++) {
      const user = createdUsers[i];
      // First 5 users have higher points (original demo users)
      const basePoints = i < 5 ? 50 + Math.floor(Math.random() * 100) : 10 + Math.floor(Math.random() * 50);
      const streak = Math.floor(Math.random() * 15) + 1;

      await db.insert(schema.userPoints).values({
        userId: user.id,
        totalPoints: basePoints,
        currentStreak: streak,
      });
      if (i < 5) {
        console.log(`  ✓ ${user.name}: ${basePoints} points, ${streak}-day streak`);
      }
    }
    console.log(`  ✓ Created points for ${createdUsers.length} users`)

    // ==================== Award Badges Based on Metrics ====================
    console.log("\nAwarding badges based on user activity...");

    // Get all badges from DB
    const allBadges = await db.query.badges.findMany();
    const badgeByCode = new Map(allBadges.map((b) => [b.code, b]));

    for (const user of createdUsers) {
      // Get user's metrics
      const interactions = await db.query.productSustainabilityMetrics.findMany({
        where: eq(schema.productSustainabilityMetrics.userId, user.id),
      });

      const userPoints = await db.query.userPoints.findFirst({
        where: eq(schema.userPoints.userId, user.id),
      });

      let totalConsumed = 0;
      let totalWasted = 0;
      let totalShared = 0;
      let totalSold = 0;

      // Collect unique active dates for streak calculation
      const activeDateSet = new Set<string>();
      const streakActions = ["consumed", "consume", "shared", "sold"];

      for (const interaction of interactions) {
        const type = (interaction.type || "").toLowerCase();
        if (type === "consumed" || type === "consume") totalConsumed++;
        else if (type === "wasted" || type === "waste") totalWasted++;
        else if (type === "shared") totalShared++;
        else if (type === "sold") totalSold++;

        if (streakActions.includes(type)) {
          const d = new Date(interaction.todayDate);
          d.setHours(0, 0, 0, 0);
          activeDateSet.add(d.toISOString().split("T")[0]);
        }
      }

      // Compute longest streak
      const activeDates = Array.from(activeDateSet).sort().map((d) => new Date(d));
      let longestStreak = 0;
      let currentRun = 0;
      for (let i = 0; i < activeDates.length; i++) {
        if (i === 0) {
          currentRun = 1;
        } else {
          const prev = activeDates[i - 1];
          const curr = activeDates[i];
          const diffMs = curr.getTime() - prev.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          currentRun = diffDays === 1 ? currentRun + 1 : 1;
        }
        if (currentRun > longestStreak) longestStreak = currentRun;
      }

      const totalActions = totalConsumed + totalShared + totalSold;
      const totalItems = totalActions + totalWasted;
      const wasteReductionRate = totalItems > 0 ? (totalActions / totalItems) * 100 : 0;

      const metrics = {
        totalPoints: userPoints?.totalPoints || 0,
        currentStreak: userPoints?.currentStreak || 0,
        longestStreak,
        totalConsumed,
        totalWasted,
        totalShared,
        totalSold,
        totalActions,
        totalItems,
        wasteReductionRate,
      };

      // Check each badge definition and award if condition met
      let badgesAwarded = 0;
      for (const def of BADGE_DEFINITIONS) {
        const dbBadge = badgeByCode.get(def.code);
        if (!dbBadge) continue;

        if (def.condition(metrics)) {
          try {
            await db.insert(schema.userBadges).values({
              userId: user.id,
              badgeId: dbBadge.id,
            });
            badgesAwarded++;
          } catch {
            // Badge already exists, skip
          }
        }
      }
      console.log(`  ✓ ${user.name}: ${badgesAwarded} badges awarded`);
    }

    const totalListings = createdListings.length + additionalActiveCount + additionalSoldCount + additionalExpiredCount + soldItems.length;

    console.log("\n========================================");
    console.log("Done! Demo accounts (password: demo123):");
    console.log("  - alice@demo.com through yang@demo.com");
    console.log(`\nCreated ${createdUsers.length} users`);
    console.log(`Created ${totalListings} marketplace listings:`);
    console.log(`  - ${createdListings.length + additionalActiveCount} active`);
    console.log(`  - ${soldItems.length + additionalSoldCount} sold`);
    console.log(`  - ${additionalExpiredCount} expired/cancelled`);
    console.log(`Created ${singaporeLockers.length} EcoLocker locations`);
    console.log(`Created ${metricsCount} sustainability metrics`);
    console.log("\nML Training Data Ready!");
    console.log("========================================\n");

  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }

  sqlite.close();
}

seed();
