import { Router, json, error, parseBody } from "../utils/router";
import { db } from "../index";
import { marketplaceListings, listingImages, messages, users } from "../db/schema";
import { eq, and, desc, ne, or, like } from "drizzle-orm";
import { z } from "zod";
import { getUser } from "../middleware/auth";
import OpenAI from "openai";
import { calculateDistance, parseCoordinates, type Coordinates } from "../utils/distance";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

// Ensure uploads directory exists
const UPLOADS_DIR = join(import.meta.dir, "../../uploads/listings");
if (!existsSync(UPLOADS_DIR)) {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

const listingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  quantity: z.number().positive().default(1),
  unit: z.string().default("item"),
  price: z.number().min(0).nullable().optional(),
  originalPrice: z.number().positive().optional(),
  expiryDate: z.string().optional(),
  pickupLocation: z.string().optional(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  pickupInstructions: z.string().optional(),
  productId: z.number().optional(),
  imageUrls: z.array(z.string()).optional(), // Array of uploaded image URLs
});

const messageSchema = z.object({
  content: z.string().min(1).max(1000),
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
        // Validate file type
        if (!file.type.startsWith("image/")) {
          return error("Only image files are allowed", 400);
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          return error("Image size must be less than 5MB", 400);
        }

        // Generate unique filename
        const ext = file.name.split(".").pop() || "jpg";
        const filename = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const filepath = join(UPLOADS_DIR, filename);

        // Save file
        const buffer = await file.arrayBuffer();
        await Bun.write(filepath, buffer);

        // Return URL path (will be served statically)
        uploadedUrls.push(`/uploads/listings/${filename}`);
      }

      return json({ urls: uploadedUrls });
    } catch (e) {
      console.error("Upload error:", e);
      return error("Failed to upload images", 500);
    }
  });

  // Get all listings (excludes user's own)
  router.get("/api/v1/marketplace/listings", async (req) => {
    const user = getUser(req);
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const category = url.searchParams.get("category") || "";

    let whereClause = and(
      ne(marketplaceListings.sellerId, user.id),
      eq(marketplaceListings.status, "active")
    );

    const allListings = await db.query.marketplaceListings.findMany({
      where: whereClause,
      with: {
        seller: {
          columns: { id: true, name: true, avatarUrl: true },
        },
        images: true,
      },
      orderBy: [desc(marketplaceListings.createdAt)],
    });

    // Filter by search and category in memory for simplicity
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
    const radius = parseFloat(url.searchParams.get("radius") || "10"); // Default 10km

    if (isNaN(lat) || isNaN(lng)) {
      return error("Invalid latitude or longitude", 400);
    }

    const userLocation: Coordinates = { latitude: lat, longitude: lng };

    // Get all active listings (exclude user's own)
    const allListings = await db.query.marketplaceListings.findMany({
      where: and(
        ne(marketplaceListings.sellerId, user.id),
        eq(marketplaceListings.status, "active")
      ),
      with: {
        seller: {
          columns: { id: true, name: true, avatarUrl: true },
        },
        images: true,
      },
      orderBy: [desc(marketplaceListings.createdAt)],
    });

    // Parse coordinates and calculate distances
    const listingsWithDistance = allListings
      .map((listing) => {
        const coords = parseCoordinates(listing.pickupLocation);

        if (!coords) {
          return null; // Skip listings without coordinates
        }

        const distance = calculateDistance(userLocation, coords);

        // Parse pickup location to separate address from coordinates
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
      .sort((a, b) => (a!.distance || 0) - (b!.distance || 0)); // Sort by distance

    return json(listingsWithDistance);
  });

  // Get user's own listings
  router.get("/api/v1/marketplace/my-listings", async (req) => {
    const user = getUser(req);

    const listings = await db.query.marketplaceListings.findMany({
      where: eq(marketplaceListings.sellerId, user.id),
      with: {
        images: true,
      },
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
        images: true,
      },
    });

    if (!listing) {
      return error("Listing not found", 404);
    }

    // Increment view count
    await db
      .update(marketplaceListings)
      .set({ viewCount: (listing.viewCount || 0) + 1 })
      .where(eq(marketplaceListings.id, listingId));

    return json(listing);
  });

  // Create listing
  router.post("/api/v1/marketplace/listings", async (req) => {
    try {
      const user = getUser(req);
      const body = await parseBody(req);
      const data = listingSchema.parse(body);

      // Store coordinates in pickupLocation as "address|lat,lng" format
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
          pickupInstructions: data.pickupInstructions,
        })
        .returning();

      // Save images if provided
      if (data.imageUrls && data.imageUrls.length > 0) {
        for (let i = 0; i < data.imageUrls.length; i++) {
          await db.insert(listingImages).values({
            listingId: listing.id,
            imageUrl: data.imageUrls[i],
            sortOrder: i,
          });
        }
      }

      // Return listing with images
      const listingWithImages = await db.query.marketplaceListings.findFirst({
        where: eq(marketplaceListings.id, listing.id),
        with: {
          images: true,
        },
      });

      return json(listingWithImages);
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

      const [updated] = await db
        .update(marketplaceListings)
        .set({
          ...data,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : existing.expiryDate,
          updatedAt: new Date(),
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
        reservedBy: user.id,
        reservedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(marketplaceListings.id, listingId));

    return json({ message: "Listing reserved" });
  });

  // Mark as sold
  router.post("/api/v1/marketplace/listings/:id/sold", async (req, params) => {
    const user = getUser(req);
    const listingId = parseInt(params.id, 10);

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
        status: "sold",
        soldAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(marketplaceListings.id, listingId));

    return json({ message: "Listing marked as sold" });
  });

  // Get price recommendation
  router.post("/api/v1/marketplace/listings/:id/price-recommendation", async (req, params) => {
    const listingId = parseInt(params.id, 10);

    const listing = await db.query.marketplaceListings.findFirst({
      where: eq(marketplaceListings.id, listingId),
    });

    if (!listing) {
      return error("Listing not found", 404);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Fallback to simple calculation
      const daysUntilExpiry = listing.expiryDate
        ? Math.ceil((new Date(listing.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 7;

      const originalPrice = listing.originalPrice || 10;
      let discount = 0.3; // 30% base discount

      if (daysUntilExpiry <= 1) discount = 0.7;
      else if (daysUntilExpiry <= 3) discount = 0.5;
      else if (daysUntilExpiry <= 7) discount = 0.4;

      const recommendedPrice = Math.max(0.5, originalPrice * (1 - discount));

      return json({
        recommendedPrice: Math.round(recommendedPrice * 100) / 100,
        reasoning: `Based on ${daysUntilExpiry} days until expiry, a ${Math.round(discount * 100)}% discount is recommended.`,
      });
    }

    try {
      const openai = new OpenAI({ apiKey });

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a pricing expert for a food sharing marketplace. Recommend fair prices for near-expiry food items.",
          },
          {
            role: "user",
            content: `Recommend a price for this food item:
- Name: ${listing.title}
- Original price: ${listing.originalPrice || "unknown"}
- Expiry date: ${listing.expiryDate || "unknown"}
- Quantity: ${listing.quantity} ${listing.unit}
- Category: ${listing.category || "unknown"}

Return JSON with recommendedPrice (number) and reasoning (string).`,
          },
        ],
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content || "{}";
      try {
        const result = JSON.parse(content);
        return json(result);
      } catch {
        return json({
          recommendedPrice: (listing.originalPrice || 10) * 0.5,
          reasoning: "Unable to generate specific recommendation",
        });
      }
    } catch (e) {
      console.error("Price recommendation error:", e);
      return error("Failed to get price recommendation", 500);
    }
  });

  // Get messages for a listing
  router.get("/api/v1/marketplace/listings/:id/messages", async (req, params) => {
    const user = getUser(req);
    const listingId = parseInt(params.id, 10);

    const listing = await db.query.marketplaceListings.findFirst({
      where: eq(marketplaceListings.id, listingId),
    });

    if (!listing) {
      return error("Listing not found", 404);
    }

    const listingMessages = await db.query.messages.findMany({
      where: and(
        eq(messages.listingId, listingId),
        or(eq(messages.senderId, user.id), eq(messages.receiverId, user.id))
      ),
      with: {
        sender: {
          columns: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: [desc(messages.createdAt)],
    });

    return json(listingMessages);
  });

  // Send message
  router.post("/api/v1/marketplace/listings/:id/messages", async (req, params) => {
    try {
      const user = getUser(req);
      const listingId = parseInt(params.id, 10);
      const body = await parseBody(req);
      const data = messageSchema.parse(body);

      const listing = await db.query.marketplaceListings.findFirst({
        where: eq(marketplaceListings.id, listingId),
      });

      if (!listing) {
        return error("Listing not found", 404);
      }

      const receiverId = listing.sellerId === user.id ? listing.reservedBy : listing.sellerId;

      if (!receiverId) {
        return error("No recipient for message", 400);
      }

      const [message] = await db
        .insert(messages)
        .values({
          listingId,
          senderId: user.id,
          receiverId,
          content: data.content,
        })
        .returning();

      return json(message);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Send message error:", e);
      return error("Failed to send message", 500);
    }
  });

  // Get all user's conversations
  router.get("/api/v1/marketplace/messages", async (req) => {
    const user = getUser(req);

    // Get all messages where user is sender or receiver
    const allMessages = await db.query.messages.findMany({
      where: or(eq(messages.senderId, user.id), eq(messages.receiverId, user.id)),
      with: {
        listing: {
          columns: { id: true, title: true },
        },
        sender: {
          columns: { id: true, name: true, avatarUrl: true },
        },
        receiver: {
          columns: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: [desc(messages.createdAt)],
    });

    // Group by listing
    const conversations = new Map<
      number,
      {
        listingId: number;
        listingTitle: string;
        otherUser: { id: number; name: string; avatarUrl: string | null };
        lastMessage: string;
        lastMessageAt: Date;
        unreadCount: number;
      }
    >();

    for (const msg of allMessages) {
      if (!conversations.has(msg.listingId)) {
        const otherUser = msg.senderId === user.id ? msg.receiver : msg.sender;
        conversations.set(msg.listingId, {
          listingId: msg.listingId,
          listingTitle: msg.listing.title,
          otherUser,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount: !msg.isRead && msg.receiverId === user.id ? 1 : 0,
        });
      } else {
        const conv = conversations.get(msg.listingId)!;
        if (!msg.isRead && msg.receiverId === user.id) {
          conv.unreadCount++;
        }
      }
    }

    return json(Array.from(conversations.values()));
  });
}
