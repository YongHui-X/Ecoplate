import { Router, json, error, parseBody } from "../utils/router";
import { db } from "../index";
import { marketplaceListings } from "../db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import { z } from "zod";
import { getUser } from "../middleware/auth";
import { calculateDistance, parseCoordinates, type Coordinates } from "../utils/distance";

const listingSchema = z.object({
  productId: z.number().optional(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  quantity: z.number().positive().default(1),
  price: z.number().min(0).nullable().optional(),
  originalPrice: z.number().positive().optional(),
  expiryDate: z.string().optional(),
  pickupLocation: z.string().optional(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
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

  // Create listing
  router.post("/api/v1/marketplace/listings", async (req) => {
    try {
      const user = getUser(req);
      console.log("Create listing - User:", user.id);

      const body = await parseBody(req);
      console.log("Create listing - Body:", JSON.stringify(body, null, 2));

      const data = listingSchema.parse(body);
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
          price: data.price,
          originalPrice: data.originalPrice,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
          pickupLocation: pickupLocationValue,
        })
        .returning();

      return json(listing);
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
          productId: data.productId,
          title: data.title,
          description: data.description,
          category: data.category,
          quantity: data.quantity,
          price: data.price,
          originalPrice: data.originalPrice,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : existing.expiryDate,
          pickupLocation: pickupLocationValue ?? existing.pickupLocation,
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

      return json({ message: "Listing marked as completed" });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      return error("Failed to complete listing", 500);
    }
  });
}
