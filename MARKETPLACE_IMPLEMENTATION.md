# Marketplace & Messaging Implementation Guide

## Overview
Implement Marketplace listing views (list and map) and Messaging/Conversation system for EcoPlate.

## Database Schema Updates ✅ COMPLETED

### Updated Tables:
- **users**: Added `user_location` field for default location
- **marketplace_listings**: Added `buyer_id` and `completed_at` fields
- **conversations**: NEW table to group messages between buyer/seller
- **messages**: Updated to use `conversation_id` and `sender_id`

## Implementation Tasks

### 1. Backend API Routes

#### Marketplace Routes (`src/routes/marketplace.ts`)

**Listing Management:**
- `POST /api/marketplace/listings` - Create new listing (from MyFridge product)
  - Body: `{ productId, title, description, category, quantity, unit, price, originalPrice, expiryDate, pickupLocation, pickupInstructions }`
  - Use Google Maps API for `pickupLocation` validation/geocoding

- `GET /api/marketplace/listings` - Get all active listings (list view)
  - Query params: `?category=&maxPrice=&search=&limit=&offset=`

- `GET /api/marketplace/listings/nearby` - Get listings near user (map view)
  - Query params: `?lat=&lng=&radius=` (radius in km)
  - Use Google Maps Distance Matrix API to calculate distances
  - Return listings with distance and coordinates

- `GET /api/marketplace/listings/:id` - Get single listing details
  - Include: seller info, images, pickup location coordinates

- `PATCH /api/marketplace/listings/:id/status` - Update listing status
  - Body: `{ status: "reserved" | "completed" | "cancelled", buyerId? }`
  - When status = "completed", set `buyerId` and `completedAt`

- `DELETE /api/marketplace/listings/:id` - Delete listing (seller only)

**Listing Images:**
- `POST /api/marketplace/listings/:id/images` - Upload listing images
- `DELETE /api/marketplace/listings/:id/images/:imageId` - Delete image

#### Conversation & Messaging Routes (`src/routes/conversations.ts`)

**Conversations:**
- `GET /api/conversations` - Get all conversations for current user
  - Return: conversations with last message preview, unread count

- `GET /api/conversations/:listingId/:otherUserId` - Get or create conversation
  - If conversation exists, return it
  - If not, create new conversation between buyer and seller

- `GET /api/conversations/:id` - Get conversation details
  - Include: listing info, other user info, all messages

**Messages:**
- `GET /api/conversations/:id/messages` - Get all messages in conversation
  - Query params: `?limit=&offset=` for pagination

- `POST /api/conversations/:id/messages` - Send message
  - Body: `{ messageText }`
  - Create message with `senderId` = current user

- `DELETE /api/messages/:id` - Delete message (sender only)

### 2. Frontend Components

#### Marketplace List View (`frontend/src/pages/Marketplace/MarketplaceList.tsx`)

**Features:**
- Grid/List toggle view
- Filter by category, price range, search
- Sort by: newest, price (low to high), expiring soon
- Product cards showing:
  - Image, title, price, original price (strikethrough)
  - Category badge
  - Expiry date with urgency indicator (red if < 2 days)
  - Distance from user
  - "View Details" button

**Components to create:**
- `MarketplaceList.tsx` - Main page
- `ListingCard.tsx` - Individual listing card
- `ListingFilters.tsx` - Filter sidebar/panel
- `ListingGrid.tsx` - Grid view
- `ListingList.tsx` - List view

#### Marketplace Map View (`frontend/src/pages/Marketplace/MarketplaceMap.tsx`)

**Features:**
- Google Maps integration
- Show listings as markers/pins on map
- Cluster markers when zoomed out
- Click marker to show listing preview card
- User location marker (blue dot)
- Radius filter (show listings within X km)
- "List View" toggle button

**Components to create:**
- `MarketplaceMap.tsx` - Main map page
- `ListingMarker.tsx` - Custom map marker
- `ListingMapCard.tsx` - Popup card on marker click
- Use: `@react-google-maps/api` library

**Google Maps Setup:**
- Add API key to `.env`: `GOOGLE_MAPS_API_KEY`
- Enable: Maps JavaScript API, Geocoding API, Distance Matrix API
- Load map with user's current location or default location

#### Listing Details Page (`frontend/src/pages/Marketplace/ListingDetails.tsx`)

**Features:**
- Image carousel
- Listing info: title, description, price, quantity, expiry date
- Seller info: name, avatar, location
- Pickup location with embedded map
- "Message Seller" button → opens conversation
- "Reserve" button (if buyer, status is active)
- "Complete Transaction" button (if reserved by current user)
- "Edit" / "Delete" buttons (if seller)

#### Create Listing Form (`frontend/src/pages/Marketplace/CreateListing.tsx`)

**Features:**
- Triggered from MyFridge "Sell" button on product
- Pre-fill product info (name, category, quantity, unit)
- Form fields:
  - Title (editable)
  - Description
  - Price (optional, can be free)
  - Original price (for comparison)
  - Expiry date (required when selling)
  - Pickup location (Google Maps autocomplete input)
  - Pickup instructions
  - Upload images (multiple)
- Submit creates listing and redirects to listing details

#### Conversations List (`frontend/src/pages/Messages/ConversationsList.tsx`)

**Features:**
- List of all conversations
- Show: other user avatar/name, listing title, last message preview, timestamp
- Unread indicator (badge with count)
- Search/filter conversations
- Click to open conversation

#### Conversation View (`frontend/src/pages/Messages/ConversationView.tsx`)

**Features:**
- Chat interface
- Header: other user info, listing thumbnail, "View Listing" link
- Messages list:
  - Sender's messages on right (blue bubble)
  - Receiver's messages on left (grey bubble)
  - Timestamp on each message
  - Auto-scroll to bottom
- Message input with send button
- Real-time updates (WebSocket or polling)

**Components to create:**
- `ConversationsList.tsx` - All conversations
- `ConversationView.tsx` - Single conversation
- `MessageBubble.tsx` - Individual message
- `MessageInput.tsx` - Text input + send button

### 3. Services

#### Marketplace Service (`frontend/src/services/marketplace-service.ts`)

```typescript
export const marketplaceService = {
  // Listings
  createListing(data: CreateListingDto): Promise<Listing>
  getListings(filters?: ListingFilters): Promise<Listing[]>
  getNearbyListings(lat: number, lng: number, radius: number): Promise<ListingWithDistance[]>
  getListingById(id: number): Promise<ListingDetails>
  updateListingStatus(id: number, status: string, buyerId?: number): Promise<Listing>
  deleteListing(id: number): Promise<void>

  // Images
  uploadImages(listingId: number, files: File[]): Promise<ListingImage[]>
  deleteImage(listingId: number, imageId: number): Promise<void>
}
```

#### Conversation Service (`frontend/src/services/conversation-service.ts`)

```typescript
export const conversationService = {
  getConversations(): Promise<Conversation[]>
  getOrCreateConversation(listingId: number, otherUserId: number): Promise<Conversation>
  getConversationById(id: number): Promise<ConversationDetails>

  // Messages
  getMessages(conversationId: number): Promise<Message[]>
  sendMessage(conversationId: number, messageText: string): Promise<Message>
  deleteMessage(messageId: number): Promise<void>
}
```

### 4. Google Maps Integration

**Setup:**
1. Get Google Maps API key from Google Cloud Console
2. Enable required APIs:
   - Maps JavaScript API
   - Geocoding API
   - Distance Matrix API
   - Places API (for autocomplete)

**Frontend:**
- Install: `bun add @react-google-maps/api`
- Create `GoogleMapsProvider` wrapper in `frontend/src/components/common/`
- Create custom hook: `useGeolocation()` to get user's current location

**Backend:**
- Install: `bun add @googlemaps/google-maps-services-js`
- Create utility: `src/utils/maps.ts`
  - `geocodeAddress(address: string)` → get lat/lng
  - `calculateDistance(origin: LatLng, destination: LatLng)` → distance in km
  - `validateAddress(address: string)` → check if valid Singapore address

### 5. User Flow

**Selling Flow:**
1. User views product in MyFridge
2. Clicks "Sell" button
3. Create Listing form opens (pre-filled with product data)
4. User adds expiry date, price, pickup location, images
5. Submits → listing created with status "active"
6. Redirects to listing details page

**Buying Flow:**
1. User browses marketplace (list or map view)
2. Clicks on listing → listing details page
3. Clicks "Message Seller" → creates/opens conversation
4. User and seller chat
5. Buyer clicks "Reserve" → status changes to "reserved", buyerId set
6. After meeting, buyer clicks "Complete Transaction" → status "completed", completedAt set

**Messaging Flow:**
1. User clicks "Message Seller" on listing
2. System checks if conversation exists between buyer and seller for this listing
3. If not, creates new conversation
4. Opens conversation view
5. Users exchange messages in real-time

### 6. Additional Considerations

**Distance Calculation:**
- Use Haversine formula or Google Distance Matrix API
- Cache distances in frontend to avoid repeated API calls

**Real-time Messaging:**
- Option 1: WebSocket for real-time updates
- Option 2: Polling every 5-10 seconds
- Option 3: Use Bun's built-in WebSocket support

**Image Upload:**
- Store images in `backend/public/uploads/listings/`
- Create upload utility in `src/utils/upload.ts`
- Return image URLs as `http://localhost:3000/uploads/listings/{filename}`
- Consider image compression before upload

**Status Workflow:**
- `active` → anyone can view and message
- `reserved` → buyer has expressed intent, others can still message
- `completed` → transaction done, listing hidden from marketplace
- `expired` → past expiry date, auto-updated by cron job
- `cancelled` → seller cancelled, listing hidden

**Permissions:**
- Sellers can edit/delete their own listings
- Sellers can mark as "completed" only if reserved
- Buyers can reserve listings
- Buyers who reserved can mark as "completed"
- Only conversation participants can view messages

## Next Steps

1. ✅ Database schema updated
2. TODO: Implement backend API routes for marketplace
3. TODO: Implement backend API routes for conversations
4. TODO: Create frontend components for marketplace list view
5. TODO: Create frontend components for marketplace map view
6. TODO: Create frontend components for messaging
7. TODO: Integrate Google Maps API
8. TODO: Test complete user flows
9. TODO: Add real-time messaging (WebSocket)

## Files to Create/Modify

### Backend:
- `src/routes/marketplace.ts` (NEW)
- `src/routes/conversations.ts` (NEW)
- `src/services/marketplace-service.ts` (NEW)
- `src/services/conversation-service.ts` (NEW)
- `src/utils/maps.ts` (NEW)
- `src/utils/upload.ts` (NEW)
- `src/index.ts` (register new routes)

### Frontend:
- `src/pages/Marketplace/MarketplaceList.tsx` (NEW)
- `src/pages/Marketplace/MarketplaceMap.tsx` (NEW)
- `src/pages/Marketplace/ListingDetails.tsx` (NEW)
- `src/pages/Marketplace/CreateListing.tsx` (NEW)
- `src/pages/Messages/ConversationsList.tsx` (NEW)
- `src/pages/Messages/ConversationView.tsx` (NEW)
- `src/components/marketplace/ListingCard.tsx` (NEW)
- `src/components/marketplace/ListingFilters.tsx` (NEW)
- `src/components/messages/MessageBubble.tsx` (NEW)
- `src/components/messages/MessageInput.tsx` (NEW)
- `src/components/common/GoogleMapsProvider.tsx` (NEW)
- `src/services/marketplace-service.ts` (NEW)
- `src/services/conversation-service.ts` (NEW)
- `src/hooks/useGeolocation.ts` (NEW)
- `src/router/index.tsx` (add new routes)

## Environment Variables

```bash
# Backend .env
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Frontend .env
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
VITE_API_URL=http://localhost:3000
```

---

**Current Status:** Database schema updated. Ready to start backend API implementation.
**Branch:** marketplace/glenn
**Last Updated:** 2026-01-26
