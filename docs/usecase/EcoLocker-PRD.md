# EcoLocker - Product Requirements Document

## Overview

**EcoLocker** is a companion web application for EcoPlate that facilitates secure, contactless product handoff between marketplace sellers and buyers using a smart locker network. It bridges the gap between marketplace transactions and physical product delivery.

### Vision

Enable seamless, location-flexible product transfers that work regardless of seller-buyer proximity, making the EcoPlate marketplace more accessible and convenient for all users.

### Document Version

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-04 | - | Initial PRD |
| 1.1 | 2026-02-07 | - | Updated reserve flow: seller reserves for buyer |

---

## Problem Statement

After a product is sold on the EcoPlate marketplace, sellers and buyers need a reliable mechanism to transfer physical products. Current limitations include:

- **Geographic constraints**: Buyers and sellers may not be in the same location
- **Scheduling conflicts**: Coordinating meetup times is inconvenient
- **Safety concerns**: Direct meetups with strangers can be uncomfortable
- **No standardized handoff**: Each transaction requires manual coordination

---

## Solution

EcoLocker introduces a **smart locker network** simulation that enables:

1. Buyers to select a convenient pickup locker location
2. Sellers to schedule delivery rider pickups
3. Automated, secure PIN-based product retrieval

---

## Architecture

### System Design

```
                    ┌─────────────────────┐
                    │   EcoPlate App      │
                    │   (Marketplace)     │
                    └─────────┬───────────┘
                              │ Reserve Product
                              ▼
┌─────────────────────────────────────────────────────────┐
│                   EcoPlate Backend                       │
│                   (Shared API Server)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Marketplace │  │  EcoLocker  │  │    Locker       │  │
│  │   Routes    │  │   Routes    │  │    Routes       │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
      │  EcoPlate   │  │  EcoLocker  │  │   SQLite    │
      │  Frontend   │  │  Frontend   │  │  Database   │
      └─────────────┘  └─────────────┘  └─────────────┘
```

### Integration Approach

- **Frontend**: Separate React + Capacitor application
- **Backend**: New API routes added to existing EcoPlate backend
- **Database**: New tables in existing SQLite database
- **Authentication**: Shared JWT tokens (seamless SSO between apps)

---

## User Roles

| Role | Description |
|------|-------------|
| **Buyer** | EcoPlate user who purchases a marketplace product (after seller reserves it for them) |
| **Seller** | EcoPlate user who listed the product and reserves it for a specific buyer |
| **System** | Simulated delivery driver and locker management |

**Important:** The seller initiates the reservation for a buyer. The buyer then completes the purchase via "Buy" (direct) or "Use EcoLocker Delivery".

---

## Core User Flows

### Flow 0: Seller Reserves Listing for Buyer

```
EcoPlate Marketplace (Seller View)
       │
       │  1. Buyer expresses interest (e.g., via message)
       │
       ▼
Seller views their listing
       │
       ▼
Seller clicks "Reserve for Buyer"
       │
       ▼
Seller selects buyer from list
(users who messaged about this listing)
       │
       ▼
Listing status → "reserved"
Listing buyerId → selected buyer
       │
       ▼
Buyer notified: "Seller has reserved [item] for you"
       │
       ▼
Listing shows as "Reserved" to all other users
Only the selected buyer can purchase
```

**Key Points:**
- The **seller** initiates the reservation, not the buyer
- Buyer can complete purchase via "Buy" (direct) OR "Use EcoLocker Delivery"
- Other users see the listing as "Reserved" and cannot purchase

### Flow 1: Buyer Completes Purchase via EcoLocker

```
EcoPlate Marketplace                    EcoLocker
       │                                    │
       │  1. Buyer sees listing reserved    │
       │     for them                       │
       │                                    │
       │  2. Buyer clicks "Use EcoLocker    │
       │     Delivery"                      │
       │────────────────────────────────────>
       │                                    │
       │  3. Redirect to EcoLocker          │
       │     (JWT token passed)             │
       │                                    │
       │                           4. Display map with
       │                              locker locations
       │                                    │
       │                           5. Buyer selects locker
       │                                    │
       │                           6. Show payment summary:
       │                              - Product price
       │                              - Delivery fee
       │                              - Total
       │                                    │
       │                           7. Buyer confirms payment
       │                              (simulated)
       │                                    │
       │  8. Order created                  │
       │<────────────────────────────────────
       │                                    │
       │  9. Seller notified                │
```

**Alternative:** Buyer can also click "Buy" on EcoPlate to complete a direct purchase without EcoLocker delivery.

### Flow 2: Seller Schedules Pickup

```
Seller receives notification
       │
       ▼
Opens EcoLocker (auto-authenticated)
       │
       ▼
Views pending orders
       │
       ▼
Selects pickup time slot
(e.g., "Today 2PM-4PM")
       │
       ▼
Confirms pickup scheduled
       │
       ▼
System simulates:
  - Rider picks up product
  - Rider delivers to locker
  - PIN generated for buyer
       │
       ▼
Buyer notified: "Ready for pickup"
```

### Flow 3: Buyer Picks Up Product

```
Buyer receives "Ready for pickup" notification
       │
       ▼
Opens EcoLocker
       │
       ▼
Views pickup details:
  - Locker location (map)
  - Locker number
  - PIN code
  - Expiry time (24 hours)
       │
       ▼
Arrives at locker, enters PIN
(simulated in app)
       │
       ▼
Product marked as "Collected"
       │
       ▼
Transaction complete
  - EcoPoints awarded
  - Seller receives payment confirmation
```

---

## Features & Requirements

### F0: Seller Reserve for Buyer (EcoPlate Marketplace)

| ID | Requirement | Priority |
|----|-------------|----------|
| F0.1 | Seller can reserve their listing for a specific buyer | Must Have |
| F0.2 | Show list of users who messaged about the listing as candidates | Must Have |
| F0.3 | Update listing status to "reserved" with buyerId | Must Have |
| F0.4 | Notify buyer when listing is reserved for them | Must Have |
| F0.5 | Display "Reserved" badge to other marketplace users | Must Have |
| F0.6 | Only the reserved buyer can purchase (Buy or EcoLocker) | Must Have |
| F0.7 | Seller can unreserve if buyer doesn't complete purchase | Should Have |

### F1: Authentication (SSO with EcoPlate)

| ID | Requirement | Priority |
|----|-------------|----------|
| F1.1 | Accept JWT token from EcoPlate redirect | Must Have |
| F1.2 | Validate token against shared secret | Must Have |
| F1.3 | Auto-login without credentials if valid token | Must Have |
| F1.4 | Fallback to manual login if no token | Must Have |
| F1.5 | Session persistence across app restarts | Should Have |

### F2: Locker Selection (Buyer)

| ID | Requirement | Priority |
|----|-------------|----------|
| F2.1 | Display interactive map with locker markers | Must Have |
| F2.2 | Show locker details on marker click (name, address, available slots) | Must Have |
| F2.3 | Allow buyer to select preferred locker | Must Have |
| F2.4 | Pre-populate with 15-20 locker locations across Singapore | Must Have |
| F2.5 | Show distance from buyer's location (if permitted) | Should Have |
| F2.6 | Filter/search lockers by area | Could Have |

### F3: Payment Simulation (Buyer)

| ID | Requirement | Priority |
|----|-------------|----------|
| F3.1 | Display payment breakdown: product price, delivery fee, total | Must Have |
| F3.2 | Delivery fee calculation based on distance (simulated) | Must Have |
| F3.3 | "Pay Now" button to confirm transaction | Must Have |
| F3.4 | Payment success/failure screens | Must Have |
| F3.5 | 30-minute reservation timeout with auto-cancellation | Must Have |
| F3.6 | Show countdown timer during reservation | Should Have |

### F4: Order Management (Seller)

| ID | Requirement | Priority |
|----|-------------|----------|
| F4.1 | View list of pending orders requiring pickup | Must Have |
| F4.2 | Select pickup time slot for each order | Must Have |
| F4.3 | Confirm pickup scheduling | Must Have |
| F4.4 | View order history (completed, cancelled) | Should Have |
| F4.5 | Cancel order with reason | Should Have |

### F5: Delivery Simulation (System)

| ID | Requirement | Priority |
|----|-------------|----------|
| F5.1 | Auto-transition order to "In Transit" after pickup time | Must Have |
| F5.2 | Simulate delivery duration (30-60 min after pickup) | Must Have |
| F5.3 | Auto-transition to "Ready for Pickup" when delivered | Must Have |
| F5.4 | Generate unique 6-digit PIN for buyer | Must Have |
| F5.5 | Trigger in-app notification to buyer | Must Have |

### F6: Pickup & PIN Verification (Buyer)

| ID | Requirement | Priority |
|----|-------------|----------|
| F6.1 | Display pickup details: locker location, number, PIN | Must Have |
| F6.2 | Show locker location on map with directions link | Must Have |
| F6.3 | PIN input interface to simulate locker unlock | Must Have |
| F6.4 | Validate PIN and mark order as "Collected" | Must Have |
| F6.5 | PIN valid for 24 hours after delivery | Must Have |
| F6.6 | Show expiry countdown | Should Have |
| F6.7 | Extend pickup window option | Could Have |

### F7: Notifications (In-App)

| ID | Requirement | Priority |
|----|-------------|----------|
| F7.1 | Notify seller when buyer completes reservation | Must Have |
| F7.2 | Notify buyer when product is ready for pickup | Must Have |
| F7.3 | Notify buyer 2 hours before PIN expiry | Should Have |
| F7.4 | Notify seller when buyer collects product | Should Have |
| F7.5 | Notification center/history page | Should Have |

### F8: EcoPlate Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| F8.1 | Deep link from EcoPlate marketplace to EcoLocker | Must Have |
| F8.2 | Update marketplace listing status via API | Must Have |
| F8.3 | Award EcoPoints on successful transaction | Must Have |
| F8.4 | Sync user profile data from EcoPlate | Must Have |

---

## Database Schema (New Tables)

### lockers

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| name | TEXT | Locker location name |
| address | TEXT | Full address |
| latitude | REAL | GPS latitude |
| longitude | REAL | GPS longitude |
| total_slots | INTEGER | Number of compartments |
| available_slots | INTEGER | Currently available |
| created_at | DATETIME | Timestamp |

### locker_orders

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| listing_id | INTEGER | FK to marketplace_listings |
| buyer_id | INTEGER | FK to users |
| seller_id | INTEGER | FK to users |
| locker_id | INTEGER | FK to lockers |
| status | TEXT | pending_payment, paid, pickup_scheduled, in_transit, ready_for_pickup, collected, cancelled, expired |
| product_price | REAL | Original listing price |
| delivery_fee | REAL | Calculated delivery fee |
| total_amount | REAL | Total paid |
| pickup_pin | TEXT | 6-digit PIN (null until delivered) |
| pin_expires_at | DATETIME | 24 hours after delivery |
| pickup_time_slot | TEXT | Seller's selected slot |
| reserved_at | DATETIME | When buyer reserved |
| paid_at | DATETIME | When payment completed |
| delivered_at | DATETIME | When placed in locker |
| collected_at | DATETIME | When buyer picked up |
| cancelled_at | DATETIME | If cancelled |
| cancellation_reason | TEXT | Reason if cancelled |
| created_at | DATETIME | Timestamp |
| updated_at | DATETIME | Timestamp |

### locker_notifications

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | FK to users |
| order_id | INTEGER | FK to locker_orders |
| type | TEXT | reservation_confirmed, pickup_scheduled, ready_for_pickup, collected, expiry_warning, cancelled |
| title | TEXT | Notification title |
| message | TEXT | Notification body |
| read | BOOLEAN | Read status |
| created_at | DATETIME | Timestamp |

---

## API Endpoints

### Locker Routes

```
GET    /api/v1/lockers                    # List all lockers
GET    /api/v1/lockers/:id                # Get locker details
GET    /api/v1/lockers/nearby?lat=&lng=   # Get lockers near location
```

### Order Routes

```
POST   /api/v1/locker-orders              # Create reservation (buyer)
GET    /api/v1/locker-orders              # List user's orders
GET    /api/v1/locker-orders/:id          # Get order details
PATCH  /api/v1/locker-orders/:id/pay      # Complete payment (buyer)
PATCH  /api/v1/locker-orders/:id/schedule # Set pickup time (seller)
PATCH  /api/v1/locker-orders/:id/collect  # Verify PIN & collect (buyer)
DELETE /api/v1/locker-orders/:id          # Cancel order
```

### Notification Routes

```
GET    /api/v1/locker-notifications       # Get user notifications
PATCH  /api/v1/locker-notifications/:id   # Mark as read
PATCH  /api/v1/locker-notifications/read-all  # Mark all as read
```

---

## UI/UX Specifications

### Pages

| Page | Description | Access |
|------|-------------|--------|
| Login | Fallback manual login (if no SSO token) | Public |
| Locker Map | Map view for locker selection | Buyer |
| Payment | Payment breakdown and confirmation | Buyer |
| Order Details | Full order information with status | Both |
| Pickup | PIN display and collection interface | Buyer |
| Pending Orders | List of orders awaiting pickup scheduling | Seller |
| Schedule Pickup | Time slot selection | Seller |
| Notifications | Notification history | Both |
| Order History | Past orders | Both |

### Design Guidelines

Follow EcoPlate's "Eco Sage" design system:

- **Primary Color**: `#5F7A61` (green)
- **Secondary Color**: `#C17B5C` (terracotta) - for locker/delivery elements
- **Accent Color**: `#6B4E71` (purple) - for highlights
- Border radius: `rounded-xl` or `rounded-2xl`
- Mobile-first responsive design
- Skeleton loaders for loading states (no spinners)
- 44px minimum touch targets
- Bottom navigation on mobile, sidebar on desktop

### Map Component

- Use Leaflet/React-Leaflet (consistent with EcoPlate)
- Custom locker marker icons
- Cluster markers when zoomed out
- Popup on marker click with locker details

---

## Order Status Flow

```
┌──────────────────┐
│ pending_payment  │ ← Buyer selected locker, 30-min timer starts
└────────┬─────────┘
         │ Payment completed
         ▼
┌──────────────────┐
│      paid        │ ← Waiting for seller to schedule pickup
└────────┬─────────┘
         │ Seller sets pickup time
         ▼
┌──────────────────┐
│ pickup_scheduled │ ← Waiting for pickup time
└────────┬─────────┘
         │ Pickup time reached (simulated)
         ▼
┌──────────────────┐
│   in_transit     │ ← Rider has product (30-60 min)
└────────┬─────────┘
         │ Delivered to locker (simulated)
         ▼
┌──────────────────┐
│ ready_for_pickup │ ← PIN active, 24-hour countdown
└────────┬─────────┘
         │ Buyer enters correct PIN
         ▼
┌──────────────────┐
│    collected     │ ← Transaction complete
└──────────────────┘

Alternative paths:
- pending_payment → cancelled (30-min timeout)
- any status → cancelled (manual cancellation)
- ready_for_pickup → expired (24-hour PIN expiry)
```

---

## Seed Data: Singapore Lockers

Pre-populate 20 locker locations across Singapore:

| Area | Locations |
|------|-----------|
| Central | Raffles Place, Tanjong Pagar, City Hall, Bugis |
| North | Woodlands, Yishun, Sembawang, Ang Mo Kio |
| South | HarbourFront, Sentosa Gateway |
| East | Tampines, Bedok, Changi, Pasir Ris |
| West | Jurong East, Clementi, Buona Vista, Boon Lay |
| North-East | Sengkang, Punggol |

Each locker: 10-20 compartment slots

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Order completion rate | > 85% |
| Average time from reservation to collection | < 48 hours |
| PIN entry success rate (first attempt) | > 95% |
| Reservation timeout rate | < 10% |
| User satisfaction (post-transaction survey) | > 4.0/5.0 |

---

## Technical Considerations

### JWT Token Passing

When redirecting from EcoPlate to EcoLocker:
```
https://ecolocker.app/reserve?token={jwt}&listing={listingId}
```

EcoLocker validates the token using the shared JWT_SECRET.

### Delivery Simulation Logic

```typescript
// After seller confirms pickup time
async function simulateDelivery(orderId: number, pickupSlot: string) {
  // Wait until pickup time
  await scheduleAt(pickupSlot, async () => {
    await updateOrderStatus(orderId, 'in_transit');

    // Simulate transit (30-60 min random)
    const transitMinutes = 30 + Math.random() * 30;
    await delay(transitMinutes * 60 * 1000);

    // Generate PIN and mark ready
    const pin = generatePin(); // 6-digit
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await updateOrderStatus(orderId, 'ready_for_pickup', { pin, expiresAt });
    await notifyBuyer(orderId, 'ready_for_pickup');
  });
}
```

### Reservation Timeout

```typescript
// When reservation is created
setTimeout(async () => {
  const order = await getOrder(orderId);
  if (order.status === 'pending_payment') {
    await cancelOrder(orderId, 'Payment timeout - 30 minutes exceeded');
    await releaseListing(order.listingId);
  }
}, 30 * 60 * 1000); // 30 minutes
```

---

## Out of Scope (v1.0)

- Real payment processing
- Actual delivery driver interface
- Physical locker hardware integration
- Push notifications
- Multi-language support
- Locker compartment size selection
- Refrigerated locker compartments
- Return/refund flow
- Dispute resolution

---

## Timeline Estimate

| Phase | Scope |
|-------|-------|
| Phase 1 | Backend API routes, database schema, locker seed data |
| Phase 2 | Buyer flow: locker selection, payment, pickup |
| Phase 3 | Seller flow: order management, pickup scheduling |
| Phase 4 | Notifications, order history, polish |

---

## Appendix

### A. Delivery Fee Calculation (Simulated)

```
Base fee: $2.00
Distance fee: $0.50 per km (first 5km free)
Peak hour surcharge: +$1.00 (12-2pm, 6-8pm)

Example:
- Product in Jurong, Locker in Tampines (~20km)
- Weekday 7pm delivery
- Fee = $2.00 + ($0.50 × 15) + $1.00 = $10.50
```

### B. PIN Generation

- 6 numeric digits
- Cryptographically random
- Unique per active order
- Hashed in database, displayed only to buyer

### C. Related EcoPlate Endpoints

```
GET  /api/v1/marketplace/listings/:id              # Get listing details
PATCH /api/v1/marketplace/listings/:id             # Update listing status
POST /api/v1/marketplace/listings/:id/reserve      # Seller reserves for buyer (requires buyerId)
POST /api/v1/marketplace/listings/:id/unreserve    # Seller unreserves listing
POST /api/v1/gamification/points                   # Award EcoPoints
```

### D. Reserve Flow API Changes

The reserve endpoint behavior:

**Current (incorrect):**
```
POST /api/v1/marketplace/listings/:id/reserve
Called by: Buyer
Body: (none)
Effect: Reserves listing for the calling buyer
```

**Intended (correct):**
```
POST /api/v1/marketplace/listings/:id/reserve
Called by: Seller (owner of listing)
Body: { "buyerId": number }
Effect: Reserves listing for the specified buyer
```
