# Marketplace Module - Use Cases
## Sprint 1 | EcoPlate

**Team:** Glenn, Thae Thae Hsu

---

## 1. Core Use Cases

### UC-MP-001: Search Products
**Actor:** User  
**Description:** Search for products on the marketplace

**Preconditions:**
- User is authenticated
- Marketplace has active listings

**Main Flow:**
1. User navigates to Marketplace screen
2. User enters keyword in search bar
3. System returns matching listings
4. User can filter results by category
5. User can view location-based results

**Postconditions:**
- User sees relevant search results

**Acceptance Criteria:**
- [ ] Search returns relevant results within <2s response time

---

### UC-MP-002: Filter Products
**Actor:** User  
**Description:** Apply filters to narrow down product listings

**Preconditions:**
- User is on Marketplace screen
- Search results or browse listings are displayed

**Main Flow:**
1. User opens filter panel
2. User selects filters:
   - Price range
   - Category
   - Location/distance
   - Freshness (days until expiry)
3. User selects sort order (newest, price, expiry date, distance)
4. System updates results based on filters

**Postconditions:**
- Filtered results displayed to user

**Acceptance Criteria:**
- [ ] User can browse marketplace with category filters

---

### UC-MP-003: View Product Listing
**Actor:** User  
**Description:** View detailed information about a marketplace listing

**Preconditions:**
- User is authenticated
- Listing exists and is active

**Main Flow:**
1. User selects listing from search/browse results
2. System displays:
   - Product details (title, description, price, quantity)
   - Seller information
   - CO2 impact saved by purchasing
   - Image gallery
   - Location map with pickup point
3. User can contact seller or proceed to purchase

**Postconditions:**
- User has viewed listing details
- View count incremented

**Acceptance Criteria:**
- [ ] Listings show CO2 impact saved by purchasing vs. new

---

### UC-MP-004: Create Product Listing
**Actor:** User  
**Description:** List a product for sale on the marketplace

**Preconditions:**
- User is authenticated

**Main Flow:**
1. User initiates "Create Listing"
2. User completes multi-step form:
   - Step 1: Product details (title, description, category)
   - Step 2: Pricing (price, quantity, unit)
   - Step 3: Photos (upload up to 5 images)
3. System integrates with MyFridge inventory (optional)
4. User sets pickup location
5. User publishes listing

**Alternative Flow:**
- 3a. User creates listing from MyFridge product (pre-filled details)

**Postconditions:**
- New listing created with status "active"

**Acceptance Criteria:**
- [ ] User can create listing with images (max 5 photos)

---

### UC-MP-005: Update/Delete Product Listing
**Actor:** User  
**Description:** Modify or remove an existing listing

**Preconditions:**
- User is authenticated
- User owns the listing

**Main Flow (Update):**
1. User navigates to "My Listings"
2. User selects listing to edit
3. User modifies details
4. System saves changes

**Main Flow (Delete):**
1. User navigates to "My Listings"
2. User selects listing to delete
3. User confirms deletion
4. System marks listing as "deleted"

**Alternative Flow:**
- User can mark listing as "sold" or "unavailable"

**Postconditions:**
- Listing updated or removed from active listings

---

### UC-MP-006: Send/Receive Messages
**Actor:** User  
**Description:** In-app messaging between buyer and seller

**Preconditions:**
- User is authenticated
- Listing exists

**Main Flow:**
1. Buyer opens listing detail page
2. Buyer initiates conversation with seller
3. System creates message thread for listing
4. Buyer and seller exchange messages
5. Messages support negotiation for price/pickup

**Postconditions:**
- Message thread created and stored
- Both parties can view conversation history

**Acceptance Criteria:**
- [ ] In-app messaging works real-time (WebSocket or polling TBD)

---

### UC-MP-007: Receive Price Recommendation
**Actor:** System  
**Description:** Provide AI-based suggested pricing for listings

**Preconditions:**
- User is creating or editing a listing
- Product details are entered

**Main Flow:**
1. User requests price recommendation
2. System analyzes:
   - Product freshness (days until expiry)
   - Market rates for similar products
   - Location/demand factors
3. System returns suggested price
4. User can accept, modify, or ignore suggestion

**Postconditions:**
- Price recommendation displayed to user

**Acceptance Criteria:**
- [ ] Price recommendation API returns suggestion within 3s

---

## 2. Database Schema

```sql
-- Marketplace listings table
CREATE TABLE marketplace_listings (
    id INT PRIMARY KEY,
    seller_id INT NOT NULL,
    buyer_id INT,
    product_id INT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    quantity FLOAT,
    price FLOAT,
    original_price FLOAT,
    expiry_date DATE,
    pickup_location VARCHAR(500),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Image listing table
CREATE TABLE image_listing (
    id INT PRIMARY KEY,
    listing_id INT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id)
);

-- Conversation table
CREATE TABLE conversation (
    id INT PRIMARY KEY,
    listing_id INT,
    seller_id INT NOT NULL,
    buyer_id INT NOT NULL,
    FOREIGN KEY (seller_id) REFERENCES users(id),
    FOREIGN KEY (buyer_id) REFERENCES users(id)
);

-- Message table
CREATE TABLE message (
    id INT PRIMARY KEY,
    conversation_id INT,
    user_id INT NOT NULL,
    message_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversation(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 3. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/marketplace/listings` | Search/filter listings |
| GET | `/api/v1/marketplace/listings/{listingId}` | Get listing details |
| POST | `/api/v1/marketplace/listings` | Create new listing |
| PATCH | `/api/v1/marketplace/listings/{listingId}` | Update listing |
| DELETE | `/api/v1/marketplace/listings/{listingId}` | Delete listing |
| POST | `/api/v1/marketplace/listings/{listingId}/price-recommendation` | Get AI price suggestion |
| POST | `/api/v1/marketplace/messages` | Send message |
| GET | `/api/v1/marketplace/messages/conversations` | Get user's conversations |
| GET | `/api/v1/marketplace/messages/{listingId}` | Get messages for listing |

---

## 4. UI Prototypes

- Marketplace browse/search interface
- Product listing detail page
- Create listing flow (3-step wizard)
- Messaging interface

---

## 5. Acceptance Criteria Summary

- [ ] User can browse marketplace with category filters
- [ ] Search returns relevant results within <2s response time
- [ ] User can create listing with images (max 5 photos)
- [ ] Price recommendation API returns suggestion within 3s
- [ ] In-app messaging works real-time (WebSocket or polling TBD)
- [ ] Listings show CO2 impact saved by purchasing vs. new
