import { Router, json, error, parseBody } from "../utils/router";
import { db } from "../index";
import { marketplaceListings } from "../db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import { z } from "zod";
import { getUser } from "../middleware/auth";
import { calculateDistance, parseCoordinates, type Coordinates } from "../utils/distance";
import { awardPoints, recordProductSustainabilityMetrics } from "../services/gamification-service";
import { POINT_VALUES} from "../services/gamification-service";

const listingSchema = z.object({
  productId: z.number().optional(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  quantity: z.number().positive().default(1),
  unit: z.string().optional(), // e.g., "kg", "L", "pcs"
  price: z.number().min(0).nullable().optional(),
  originalPrice: z.number().positive().optional(),
  expiryDate: z.string().optional(),
  pickupLocation: z.string().optional(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  images: z.array(z.string()).max(5).optional(), // Array of image URLs, max 5
});

export function registerMarketplaceRoutes(router: Router) {
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

    if (isNaN(lat) || isNaN(lng)) {
      return error("Invalid latitude or longitude", 400);
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

  // Get user's own listings
  router.get("/api/v1/marketplace/my-listings", async (req) => {
    const user = getUser(req);

    const listings = await db.query.marketplaceListings.findMany({
      where: eq(marketplaceListings.sellerId, user.id),
      orderBy: [desc(marketplaceListings.createdAt)],
    });

    return json(listings);
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

  // Get similar listings
  router.get("/api/v1/marketplace/listings/:id/similar", async (req, params) => {
    const user = getUser(req);
    const listingId = parseInt(params.id, 10);
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "6", 10);

    // Fetch target listing
    const listing = await db.query.marketplaceListings.findFirst({
      where: eq(marketplaceListings.id, listingId),
      with: {
        seller: { columns: { id: true, name: true, avatarUrl: true } },
      },
    });

    if (!listing) {
      return error("Listing not found", 404);
    }

    // Fetch all active listings (excluding target and same seller)
    const allListings = await db.query.marketplaceListings.findMany({
      where: and(
        ne(marketplaceListings.id, listingId),
        ne(marketplaceListings.sellerId, listing.sellerId),
        eq(marketplaceListings.status, "active")
      ),
      with: {
        seller: { columns: { id: true, name: true, avatarUrl: true } },
      },
    });

    // Calculate distances and days until expiry
    const targetCoords = parseCoordinates(listing.pickupLocation);
    const now = Date.now();
    const targetDaysUntilExpiry = listing.expiryDate
      ? Math.ceil((new Date(listing.expiryDate).getTime() - now) / (1000 * 60 * 60 * 24))
      : null;

    const candidates = allListings.map((l) => {
      const coords = parseCoordinates(l.pickupLocation);
      const distance = targetCoords && coords ? calculateDistance(targetCoords, coords) : null;
      const daysUntilExpiry = l.expiryDate
        ? Math.ceil((new Date(l.expiryDate).getTime() - now) / (1000 * 60 * 60 * 24))
        : null;

      return {
        ...l,
        distance_km: distance,
        days_until_expiry: daysUntilExpiry,
      };
    });

    try {
      // Call recommendation engine
      const recommendationUrl = process.env.RECOMMENDATION_ENGINE_URL || "http://localhost:5000";
      const response = await fetch(`${recommendationUrl}/api/v1/recommendations/similar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: {
            id: listing.id,
            title: listing.title,
            description: listing.description,
            category: listing.category,
            price: listing.price,
            days_until_expiry: targetDaysUntilExpiry,
            sellerId: listing.sellerId,
          },
          candidates,
          limit,
        }),
      });

      if (!response.ok) {
        throw new Error("Recommendation engine error");
      }

      const result = await response.json();
      return json({
        listings: result.similar_products,
        targetListing: { id: listing.id, title: listing.title },
        fallback: false,
      });
    } catch (e) {
      // Fallback: simple category match
      console.error("Recommendation engine unavailable, using fallback:", e);
      const fallbackResults = candidates
        .filter((c) => c.category === listing.category)
        .slice(0, limit);

      return json({
        listings: fallbackResults,
        targetListing: { id: listing.id, title: listing.title },
        fallback: true,
      });
    }
  });

  // Create listing
  router.post("/api/v1/marketplace/listings", async (req) => {
    try {
      const user = getUser(req);
      console.log("Create listing - User:", user.id);

      const body = await parseBody(req);
      console.log("Create listing - Body:", JSON.stringify(body, null, 2));

      // Validate with Zod
      const result = listingSchema.safeParse(body);
      if (!result.success) {
        console.error("Validation failed:", result.error.format());
        const firstError = result.error.errors[0];
        return error(`${firstError.path.join('.')}: ${firstError.message}`, 400);
      }

      const data = result.data;
      console.log("Create listing - Validated data:", JSON.stringify(data, null, 2));

      let pickupLocationValue = data.pickupLocation;
      if (data.coordinates && data.pickupLocation) {
        pickupLocationValue = `${data.pickupLocation}|${data.coordinates.latitude},${data.coordinates.longitude}`;
      }

      const [listing] = await db
        .insert(marketplaceListings)
        .values({
          sellerId: user.id,
          productId: data.productId,
          title: data.title,
          description: data.description,
          category: data.category,
          quantity: data.quantity,
          unit: data.unit,
          price: data.price,
          originalPrice: data.originalPrice,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
          pickupLocation: pickupLocationValue,
          images: data.images ? JSON.stringify(data.images) : null,
        })
        .returning();

      return json({ ...listing});
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        console.error("Create listing validation error:", e.errors);
        return error(e.errors[0].message, 400);
      }
      console.error("Create listing error:", e);
      console.error("Error message:", e?.message);
      console.error("Error stack:", e?.stack);
      return error(e?.message || "Failed to create listing", 500);
    }
  });

  // Update listing
  router.patch("/api/v1/marketplace/listings/:id", async (req, params) => {
    try {
      const user = getUser(req);
      const listingId = parseInt(params.id, 10);
      const body = await parseBody(req);
      console.log("Update listing - Body:", JSON.stringify(body, null, 2));

      // Validate with Zod
      const result = listingSchema.partial().safeParse(body);
      if (!result.success) {
        console.error("Validation failed:", result.error.format());
        const firstError = result.error.errors[0];
        return error(`${firstError.path.join('.')}: ${firstError.message}`, 400);
      }

      const data = result.data;
      console.log("Update listing - Validated data:", JSON.stringify(data, null, 2));

      const existing = await db.query.marketplaceListings.findFirst({
        where: and(
          eq(marketplaceListings.id, listingId),
          eq(marketplaceListings.sellerId, user.id)
        ),
      });

      if (!existing) {
        return error("Listing not found", 404);
      }

      // Build update object only with provided fields
      const updateData: any = {};

      if (data.productId !== undefined) updateData.productId = data.productId;
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.quantity !== undefined) updateData.quantity = data.quantity;
      if (data.unit !== undefined) updateData.unit = data.unit;
      if (data.price !== undefined) updateData.price = data.price;
      if (data.originalPrice !== undefined) updateData.originalPrice = data.originalPrice;
      if (data.expiryDate !== undefined) updateData.expiryDate = new Date(data.expiryDate);

      // Handle pickup location with coordinates
      if (data.pickupLocation !== undefined) {
        if (data.coordinates) {
          updateData.pickupLocation = `${data.pickupLocation}|${data.coordinates.latitude},${data.coordinates.longitude}`;
        } else {
          updateData.pickupLocation = data.pickupLocation;
        }
      }

      // Handle images
      if (data.images !== undefined) {
        updateData.images = data.images.length > 0 ? JSON.stringify(data.images) : null;
      }

      const [updated] = await db
        .update(marketplaceListings)
        .set(updateData)
        .where(eq(marketplaceListings.id, listingId))
        .returning();

      console.log("Update listing - Success:", updated);
      return json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        console.error("Update listing validation error:", e.errors);
        return error(e.errors[0].message, 400);
      }
      console.error("Update listing error:", e);
      console.error("Error message:", e?.message);
      console.error("Error stack:", e?.stack);
      return error(e?.message || "Failed to update listing", 500);
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

  // Complete transaction (mark as sold/completed)
  router.post("/api/v1/marketplace/listings/:id/complete", async (req, params) => {
    try {
      const user = getUser(req);
      const listingId = parseInt(params.id, 10);
      const body = await parseBody(req);
      const data = z.object({ buyerId: z.number().optional() }).parse(body);

      const listing = await db.query.marketplaceListings.findFirst({
        where: and(
          eq(marketplaceListings.id, listingId),
          eq(marketplaceListings.sellerId, user.id)
        ),
      });

      if (!listing) {
        return error("Listing not found", 404);
      }

      await db
        .update(marketplaceListings)
        .set({
          status: "completed",
          buyerId: data.buyerId || null,
          completedAt: new Date(),
        })
        .where(eq(marketplaceListings.id, listingId));

      // Record the sale in sustainability metrics
      await recordProductSustainabilityMetrics(
        listing.productId ?? null,
        user.id,
        listing.quantity,
        "sold"
      );

      // Award points to seller for completing sale
      const pointResult = await awardPoints(user.id, "sold");

      return json({
        message: `Listing marked as completed`,
        pointsAwarded: pointResult.amount,
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      return error("Failed to complete listing", 500);
    }
  });
}
