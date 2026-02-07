import { Router, json, error, parseBody } from "../utils/router";
import { db } from "../index";
import { marketplaceListings } from "../db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import { z } from "zod";
import { getUser } from "../middleware/auth";
import { calculateDistance, parseCoordinates, type Coordinates } from "../utils/distance";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { awardPoints, POINT_VALUES } from "../services/gamification-service";
import { calculateCo2Saved } from "../utils/co2-calculator";
import { generateSecureFilename, validateImageFile } from "../utils/file-utils";

// Fallback price calculation when recommendation engine is unavailable
function calculateFallbackPrice(
  originalPrice: number,
  expiryDate?: string,
  category?: string
) {
  let daysUntilExpiry = 30;

  if (expiryDate) {
    const expiry = new Date(expiryDate);
    const now = new Date();
    daysUntilExpiry = Math.max(0, Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  // Category freshness factors
  const categoryFactors: Record<string, number> = {
    produce: 0.85, dairy: 0.80, meat: 0.75, seafood: 0.70,
    bakery: 0.85, frozen: 0.95, canned: 0.98, beverages: 0.95,
    snacks: 0.95, condiments: 0.97, pantry: 0.96, other: 0.90
  };

  const freshnessFactor = categoryFactors[(category || "other").toLowerCase()] || 0.90;

  // Calculate discount based on expiry
  let discount: number;
  let urgencyLabel: string;

  if (daysUntilExpiry <= 1) {
    discount = 0.60;
    urgencyLabel = "Expiring today/tomorrow";
  } else if (daysUntilExpiry <= 3) {
    discount = 0.42;
    urgencyLabel = "Expiring in 2-3 days";
  } else if (daysUntilExpiry <= 7) {
    discount = 0.27;
    urgencyLabel = "Expiring this week";
  } else if (daysUntilExpiry <= 14) {
    discount = 0.15;
    urgencyLabel = "Expiring in 1-2 weeks";
  } else if (daysUntilExpiry <= 30) {
    discount = 0.10;
    urgencyLabel = "Expiring this month";
  } else {
    discount = 0.05;
    urgencyLabel = "Long shelf life";
  }

  // Adjust for category perishability
  discount = Math.min(discount + (1 - freshnessFactor) * 0.15, 0.75);

  const recommendedPrice = Math.max(originalPrice * (1 - discount), originalPrice * 0.25);
  const minPrice = Math.max(originalPrice * (1 - discount - 0.10), originalPrice * 0.25);
  const maxPrice = originalPrice * (1 - discount + 0.10);

  return {
    recommended_price: Math.round(recommendedPrice * 100) / 100,
    min_price: Math.round(minPrice * 100) / 100,
    max_price: Math.round(maxPrice * 100) / 100,
    original_price: originalPrice,
    discount_percentage: Math.round(discount * 100 * 10) / 10,
    days_until_expiry: daysUntilExpiry,
    category: category || "other",
    urgency_label: urgencyLabel,
    reasoning: `Based on ${daysUntilExpiry} days until expiry and ${category || "other"} category.`,
    fallback: true
  };
}

// Ensure uploads directory exists - inside public folder for static serving
const UPLOADS_DIR = join(import.meta.dir, "../../public/uploads/listings");
if (!existsSync(UPLOADS_DIR)) {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

const listingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(50).optional(),
  quantity: z.number().positive().max(10000).default(1),
  unit: z.string().max(20).default("item"),
  price: z.number().min(0).max(1000000).nullable().optional(),
  originalPrice: z.number().positive().max(1000000).optional(),
  expiryDate: z.string().max(50).optional(),
  pickupLocation: z.string().max(500).optional(),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
  pickupInstructions: z.string().max(1000).optional(),
  imageUrls: z.array(z.string().max(500)).max(5).optional(),
});

export function registerMarketplaceRoutes(router: Router) {
  // Upload image(s) for listing
  router.post("/api/v1/marketplace/upload", async (req) => {
    try {
      const user = getUser(req);
      const formData = await req.formData();
      const files = formData.getAll("images") as File[];

      if (!files || files.length === 0) {
        return error("No images provided", 400);
      }

      if (files.length > 5) {
        return error("Maximum 5 images allowed", 400);
      }

      const uploadedUrls: string[] = [];

      for (const file of files) {
        // Comprehensive file validation with magic bytes check
        const validation = await validateImageFile(file);
        if (!validation.valid) {
          return error(validation.error || "Invalid file", 400);
        }

        // Generate secure filename
        const filename = generateSecureFilename(user.id, file.name, "listing");
        const filepath = join(UPLOADS_DIR, filename);

        const buffer = await file.arrayBuffer();
        await Bun.write(filepath, buffer);

        uploadedUrls.push(`uploads/listings/${filename}`);
      }

      return json({ urls: uploadedUrls });
    } catch (e) {
      console.error("Upload error:", e);
      return error("Failed to upload images", 500);
    }
  });

  // Get all listings (excludes user's own listings - marketplace behavior)
  router.get("/api/v1/marketplace/listings", async (req) => {
    const user = getUser(req);
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const category = url.searchParams.get("category") || "";

    const allListings = await db.query.marketplaceListings.findMany({
      where: and(
        ne(marketplaceListings.sellerId, user.id),
        eq(marketplaceListings.status, "active")
      ),
      with: {
        seller: {
          columns: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: [desc(marketplaceListings.createdAt)],
    });

    let filtered = allListings;
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.title.toLowerCase().includes(searchLower) ||
          l.description?.toLowerCase().includes(searchLower)
      );
    }
    if (category) {
      filtered = filtered.filter((l) => l.category === category);
    }

    return json(filtered);
  });

  // Get nearby listings (for map view)
  router.get("/api/v1/marketplace/listings/nearby", async (req) => {
    const user = getUser(req);
    const url = new URL(req.url);

    const lat = parseFloat(url.searchParams.get("lat") || "");
    const lng = parseFloat(url.searchParams.get("lng") || "");
    const radius = parseFloat(url.searchParams.get("radius") || "10");

    // Validate coordinates
    if (isNaN(lat) || isNaN(lng)) {
      return error("Invalid latitude or longitude", 400);
    }

    // Validate coordinate bounds (valid lat: -90 to 90, lng: -180 to 180)
    if (lat < -90 || lat > 90) {
      return error("Latitude must be between -90 and 90", 400);
    }

    if (lng < -180 || lng > 180) {
      return error("Longitude must be between -180 and 180", 400);
    }

    // Validate radius bounds (0.1km to 100km max to prevent DoS)
    if (isNaN(radius) || radius < 0.1 || radius > 100) {
      return error("Radius must be between 0.1 and 100 km", 400);
    }

    const userLocation: Coordinates = { latitude: lat, longitude: lng };

    const allListings = await db.query.marketplaceListings.findMany({
      where: and(
        ne(marketplaceListings.sellerId, user.id),
        eq(marketplaceListings.status, "active")
      ),
      with: {
        seller: {
          columns: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: [desc(marketplaceListings.createdAt)],
    });

    const listingsWithDistance = allListings
      .map((listing) => {
        const coords = parseCoordinates(listing.pickupLocation);

        if (!coords) {
          return null;
        }

        const distance = calculateDistance(userLocation, coords);

        let cleanAddress = listing.pickupLocation;
        if (listing.pickupLocation?.includes("|")) {
          cleanAddress = listing.pickupLocation.split("|")[0];
        }

        return {
          ...listing,
          pickupLocation: cleanAddress,
          coordinates: coords,
          distance,
        };
      })
      .filter((listing) => listing !== null && listing.distance <= radius)
      .sort((a, b) => (a!.distance || 0) - (b!.distance || 0));

    return json(listingsWithDistance);
  });

  // Get user's own listings (as seller)
  router.get("/api/v1/marketplace/my-listings", async (req) => {
    const user = getUser(req);

    const listings = await db.query.marketplaceListings.findMany({
      where: eq(marketplaceListings.sellerId, user.id),
      orderBy: [desc(marketplaceListings.createdAt)],
    });

    return json(listings);
  });

  // Get user's purchase history (as buyer)
  router.get("/api/v1/marketplace/my-purchases", async (req) => {
    const user = getUser(req);

    const purchases = await db.query.marketplaceListings.findMany({
      where: eq(marketplaceListings.buyerId, user.id),
      with: {
        seller: {
          columns: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: [desc(marketplaceListings.completedAt)],
    });

    return json(purchases);
  });

  // Get single listing
  router.get("/api/v1/marketplace/listings/:id", async (req, params) => {
    const listingId = parseInt(params.id, 10);

    const listing = await db.query.marketplaceListings.findFirst({
      where: eq(marketplaceListings.id, listingId),
      with: {
        seller: {
          columns: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    if (!listing) {
      return error("Listing not found", 404);
    }

    return json(listing);
  });

  // Get similar listings (recommendation engine)
  router.get("/api/v1/marketplace/listings/:id/similar", async (req, params) => {
    const user = getUser(req);
    const listingId = parseInt(params.id, 10);
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "6", 10);

    const listing = await db.query.marketplaceListings.findFirst({
      where: eq(marketplaceListings.id, listingId),
    });

    if (!listing) {
      return error("Listing not found", 404);
    }

    // Get all active listings except the current one and user's own
    const allListings = await db.query.marketplaceListings.findMany({
      where: and(
        ne(marketplaceListings.id, listingId),
        ne(marketplaceListings.sellerId, user.id),
        eq(marketplaceListings.status, "active")
      ),
      with: {
        seller: {
          columns: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    if (allListings.length === 0) {
      return json({ listings: [], fallback: false });
    }

    // Try to use recommendation engine
    const recommendationUrl = process.env.RECOMMENDATION_ENGINE_URL || "http://localhost:5000";

    try {
      const response = await fetch(`${recommendationUrl}/api/v1/recommendations/similar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing: {
            id: listing.id,
            title: listing.title,
            description: listing.description,
            category: listing.category,
            price: listing.price,
            expiryDate: listing.expiryDate,
          },
          candidates: allListings.map((l) => ({
            id: l.id,
            title: l.title,
            description: l.description,
            category: l.category,
            price: l.price,
            expiryDate: l.expiryDate,
          })),
          limit,
        }),
      });

      if (response.ok) {
        const data = await response.json() as { recommendations: Array<{ id: number; score: number }> };
        const recommendedIds = data.recommendations.map((r) => r.id);
        const recommended = recommendedIds
          .map((id) => allListings.find((l) => l.id === id))
          .filter(Boolean);
        return json({ listings: recommended, fallback: false });
      }
    } catch (e) {
      console.error("Recommendation engine error:", e);
    }

    // Fallback: return listings in same category
    const sameCategory = allListings
      .filter((l) => l.category === listing.category)
      .slice(0, limit);

    if (sameCategory.length >= limit) {
      return json({ listings: sameCategory, fallback: true });
    }

    // If not enough in same category, add others
    const others = allListings
      .filter((l) => l.category !== listing.category)
      .slice(0, limit - sameCategory.length);

    return json({ listings: [...sameCategory, ...others], fallback: true });
  });

  // Get price recommendation for a listing
  router.post("/api/v1/marketplace/price-recommendation", async (req) => {
    const body = await parseBody(req);
    const { originalPrice, expiryDate, category } = body as {
      originalPrice: number;
      expiryDate?: string;
      category?: string;
    };

    if (!originalPrice || originalPrice <= 0) {
      return error("originalPrice is required and must be positive", 400);
    }

    const recommendationUrl = process.env.RECOMMENDATION_ENGINE_URL || "http://localhost:5000";

    try {
      const response = await fetch(`${recommendationUrl}/api/v1/recommendations/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_price: originalPrice,
          expiry_date: expiryDate,
          category: category || "other",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return json(data);
      }

      // Fallback: simple calculation if recommendation engine is unavailable
      return json(calculateFallbackPrice(originalPrice, expiryDate, category));
    } catch (e) {
      console.error("Recommendation engine error:", e);
      // Fallback calculation
      return json(calculateFallbackPrice(originalPrice, expiryDate, category));
    }
  });

  // Create listing
  router.post("/api/v1/marketplace/listings", async (req) => {
    try {
      const user = getUser(req);
      const body = await parseBody(req);
      const data = listingSchema.parse(body);

      let pickupLocationValue = data.pickupLocation;
      if (data.coordinates && data.pickupLocation) {
        pickupLocationValue = `${data.pickupLocation}|${data.coordinates.latitude},${data.coordinates.longitude}`;
      }

      // Calculate CO2 saved for this listing
      const co2Saved = calculateCo2Saved(data.quantity, data.unit, data.category);

      const [listing] = await db
        .insert(marketplaceListings)
        .values({
          sellerId: user.id,
          title: data.title,
          description: data.description,
          category: data.category,
          quantity: data.quantity,
          unit: data.unit,
          price: data.price,
          originalPrice: data.originalPrice,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
          pickupLocation: pickupLocationValue,
          images: data.imageUrls ? JSON.stringify(data.imageUrls) : null,
          co2Saved,
        })
        .returning();

      return json(listing);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Create listing error:", e);
      return error("Failed to create listing", 500);
    }
  });

  // Update listing
  router.patch("/api/v1/marketplace/listings/:id", async (req, params) => {
    try {
      const user = getUser(req);
      const listingId = parseInt(params.id, 10);
      const body = await parseBody(req);
      const data = listingSchema.partial().parse(body);

      const existing = await db.query.marketplaceListings.findFirst({
        where: and(
          eq(marketplaceListings.id, listingId),
          eq(marketplaceListings.sellerId, user.id)
        ),
      });

      if (!existing) {
        return error("Listing not found", 404);
      }

      let pickupLocationValue = data.pickupLocation;
      if (data.coordinates && data.pickupLocation) {
        pickupLocationValue = `${data.pickupLocation}|${data.coordinates.latitude},${data.coordinates.longitude}`;
      }

      const [updated] = await db
        .update(marketplaceListings)
        .set({
          title: data.title,
          description: data.description,
          category: data.category,
          quantity: data.quantity,
          unit: data.unit,
          price: data.price,
          originalPrice: data.originalPrice,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : existing.expiryDate,
          pickupLocation: pickupLocationValue ?? existing.pickupLocation,
          images: data.imageUrls ? JSON.stringify(data.imageUrls) : existing.images,
        })
        .where(eq(marketplaceListings.id, listingId))
        .returning();

      return json(updated);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Update listing error:", e);
      return error("Failed to update listing", 500);
    }
  });

  // Delete listing
  router.delete("/api/v1/marketplace/listings/:id", async (req, params) => {
    const user = getUser(req);
    const listingId = parseInt(params.id, 10);

    const existing = await db.query.marketplaceListings.findFirst({
      where: and(
        eq(marketplaceListings.id, listingId),
        eq(marketplaceListings.sellerId, user.id)
      ),
    });

    if (!existing) {
      return error("Listing not found", 404);
    }

    await db.delete(marketplaceListings).where(eq(marketplaceListings.id, listingId));

    return json({ message: "Listing deleted" });
  });

  // Reserve listing
  router.post("/api/v1/marketplace/listings/:id/reserve", async (req, params) => {
    const user = getUser(req);
    const listingId = parseInt(params.id, 10);

    const listing = await db.query.marketplaceListings.findFirst({
      where: eq(marketplaceListings.id, listingId),
    });

    if (!listing) {
      return error("Listing not found", 404);
    }

    if (listing.status !== "active") {
      return error("Listing is not available", 400);
    }

    if (listing.sellerId === user.id) {
      return error("Cannot reserve your own listing", 400);
    }

    await db
      .update(marketplaceListings)
      .set({
        status: "reserved",
        buyerId: user.id,
      })
      .where(eq(marketplaceListings.id, listingId));

    return json({ message: "Listing reserved" });
  });

  // Buy listing (buyer directly purchases)
  router.post("/api/v1/marketplace/listings/:id/buy", async (req, params) => {
    const user = getUser(req);
    const listingId = parseInt(params.id, 10);

    const listing = await db.query.marketplaceListings.findFirst({
      where: eq(marketplaceListings.id, listingId),
    });

    if (!listing) {
      return error("Listing not found", 404);
    }

    if (listing.status !== "active" && listing.status !== "reserved") {
      return error("Listing is not available", 400);
    }

    if (listing.sellerId === user.id) {
      return error("Cannot buy your own listing", 400);
    }

    // If reserved by someone else, only that person can buy
    if (listing.status === "reserved" && listing.buyerId !== user.id) {
      return error("This listing is reserved by another buyer", 400);
    }

    await db
      .update(marketplaceListings)
      .set({
        status: "sold",
        buyerId: user.id,
        completedAt: new Date(),
      })
      .where(eq(marketplaceListings.id, listingId));

    return json({ message: "Purchase successful" });
  });

  // Mark as sold
  router.post("/api/v1/marketplace/listings/:id/sold", async (req, params) => {
    const user = getUser(req);
    const listingId = parseInt(params.id, 10);

    // Parse optional buyerId from request body
    let buyerId: number | null = null;
    try {
      const body = await parseBody<{ buyerId?: number }>(req);
      if (body && typeof body.buyerId === "number") {
        buyerId = body.buyerId;
      }
    } catch {
      // No body or invalid body, continue without buyerId
    }

    const listing = await db.query.marketplaceListings.findFirst({
      where: and(
        eq(marketplaceListings.id, listingId),
        eq(marketplaceListings.sellerId, user.id)
      ),
    });

    if (!listing) {
      return error("Listing not found", 404);
    }

    // Use provided buyerId, or keep existing one (from reservation)
    const finalBuyerId = buyerId || listing.buyerId;

    await db
      .update(marketplaceListings)
      .set({
        status: "sold",
        completedAt: new Date(),
        buyerId: finalBuyerId,
      })
      .where(eq(marketplaceListings.id, listingId));

    // Award points for selling (reduces food waste)
    const pointsResult = await awardPoints(user.id, "sold", listing.productId, listing.quantity, undefined, {
      co2Saved: listing.co2Saved,
      buyerId: finalBuyerId,
    });

    return json({
      message: "Listing marked as sold",
      points: {
        earned: pointsResult.amount,
        action: pointsResult.action,
        newTotal: pointsResult.newTotal,
      },
      newBadges: pointsResult.newBadges,
      co2Saved: pointsResult.co2Saved,
    });
  });
}
