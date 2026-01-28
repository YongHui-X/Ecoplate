# MyFridge Module - Use Cases
## Sprint 1 | EcoPlate

**Team:** Nithvin, Aung Kyaw Kyaw

---

## 1. Core Use Cases

### UC-MF-001: Scan Receipt
**Actor:** System  
**Description:** Extract product information from receipt images using OpenAI Vision API

**Preconditions:**
- User is authenticated
- User has camera/gallery access permissions

**Main Flow:**
1. User captures or uploads receipt image
2. System sends image to OpenAI Vision API
3. System parses product names, quantities, purchase dates, and prices
4. System displays extracted items for user confirmation
5. User confirms or edits extracted data

**Postconditions:**
- Products are ready to be added to MyFridge

**Acceptance Criteria:**
- [ ] User can capture receipt photo and initiate scan
- [ ] System extracts ≥80% product information accuracy (evaluated on test dataset)

---

### UC-MF-002: Add Product to List
**Actor:** User  
**Description:** Manually add products to MyFridge inventory

**Preconditions:**
- User is authenticated

**Main Flow:**
1. User opens "Add Product" form
2. User enters product details (name, category, quantity, unit)
3. System auto-populates fields from receipt scan (if applicable)
4. System estimates expiry date based on product category
5. User confirms and saves product

**Alternative Flow:**
- 3a. User manually enters all fields without receipt scan

**Postconditions:**
- Product is added to user's inventory with status "active"

---

### UC-MF-003: View MyFridge Products
**Actor:** User  
**Description:** View and manage current inventory

**Preconditions:**
- User is authenticated
- User has at least one product in inventory

**Main Flow:**
1. User navigates to MyFridge screen
2. System displays list of current inventory
3. User can filter by expiry date, category, quantity
4. System shows visual indicators for items expiring soon (≤3 days)

**Postconditions:**
- User sees current inventory status

**Acceptance Criteria:**
- [ ] User can view inventory sorted by expiry date
- [ ] Products expiring ≤3 days show warning banner

---

### UC-MF-004: Track Consumption & Waste
**Actor:** User  
**Description:** Log product consumption or waste

**Preconditions:**
- User is authenticated
- Product exists in inventory with status "active"

**Main Flow:**
1. User selects product from inventory
2. User marks item as consumed or thrown away
3. If wasted, user selects waste reason (spoiled, expired, unwanted)
4. System calculates and displays CO2 impact
5. System updates inventory and sustainability metrics

**Postconditions:**
- Product status updated to "consumed" or "wasted"
- Consumption log created
- User sustainability metrics updated

**Acceptance Criteria:**
- [ ] User can mark product as consumed/wasted with reason
- [ ] CO2 impact displays per product

---

### UC-MF-005: Sell MyFridge Product
**Actor:** User  
**Description:** Quick list product to marketplace from inventory

**Preconditions:**
- User is authenticated
- Product exists in inventory with status "active"

**Main Flow:**
1. User selects product from inventory
2. User chooses "Sell on Marketplace"
3. System pre-fills product details from inventory
4. System suggests pricing based on remaining freshness
5. User completes listing and publishes

**Postconditions:**
- Marketplace listing created
- Product linked to listing

---

## 2. Database Schema

```sql
-- Products table
CREATE TABLE products (
    id INT PRIMARY KEY,
    userId INT NOT NULL,
    productName VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    quantity FLOAT,
    unit_price FLOAT,
    purchase_date DATE,
    description TEXT,
    co2_emission FLOAT,
    FOREIGN KEY (userId) REFERENCES users(id)
);

-- Product interaction table (tracks consumption, waste, sharing, selling)
CREATE TABLE product_interaction (
    id INT PRIMARY KEY,
    product_id INT NOT NULL,
    user_id INT NOT NULL,
    today_date DATE,
    quantity FLOAT,
    type VARCHAR(100),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 3. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/myfridge/receipt/scan` | Upload receipt image |
| GET | `/api/v1/myfridge/receipt/{scanId}/status` | Check scan status |
| POST | `/api/v1/myfridge/products` | Add product manually |
| GET | `/api/v1/myfridge/products` | List user's products (with filters) |
| PATCH | `/api/v1/myfridge/products/{productId}` | Update product |
| POST | `/api/v1/myfridge/products/{productId}/consume` | Log consumption/waste |

---

## 4. UI Prototypes

- Receipt scanning camera interface
- Product list view with expiry warnings
- Add/edit product form
- Consumption logging modal

---

## 5. Acceptance Criteria Summary

- [ ] User can capture receipt photo and initiate scan
- [ ] System extracts ≥80% product information accuracy (evaluated on test dataset)
- [ ] User can view inventory sorted by expiry date
- [ ] Products expiring ≤3 days show warning banner
- [ ] User can mark product as consumed/wasted with reason
- [ ] CO2 impact displays per product
