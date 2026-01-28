# Sustainability Gamification Module - Use Cases
## Sprint 1 | EcoPlate

**Team:** Yong Hui, Song Jiaqi, Zhou Jiasheng

---

## 1. Core Use Cases

### User-Facing Use Cases

#### UC-GF-001: View CO2 Emission Saved Dashboard
**Actor:** User  
**Description:** View sustainability metrics for CO2 savings

**Preconditions:**
- User is authenticated
- User has activity data (consumed/sold products)

**Main Flow:**
1. User navigates to EcoBoard dashboard
2. System displays CO2 saved panel showing:
   - Lifetime CO2 savings (kg)
   - Monthly CO2 savings (kg)
   - Visual charts (line/bar graphs)
3. User can toggle between daily, weekly, monthly views

**Postconditions:**
- User sees their CO2 savings impact

**Acceptance Criteria:**
- [ ] Dashboard displays real-time CO2 metrics
- [ ] Charts render smoothly for up to 90 days of data

---

#### UC-GF-002: View CO2 Emission Wasted Dashboard
**Actor:** User  
**Description:** View CO2 impact of wasted food

**Preconditions:**
- User is authenticated

**Main Flow:**
1. User navigates to EcoBoard dashboard
2. System displays CO2 wasted panel showing:
   - Total CO2 impact from wasted food (kg)
   - Breakdown by waste reason (spoiled, expired, unwanted)
3. User can view detailed waste analytics

**Postconditions:**
- User understands their waste impact

---

#### UC-GF-003: View Food Consumption % Dashboard
**Actor:** User  
**Description:** View consumption vs. waste percentage

**Preconditions:**
- User is authenticated
- User has tracked products

**Main Flow:**
1. User navigates to EcoBoard dashboard
2. System displays consumption panel showing:
   - Percentage of food consumed vs. wasted
   - Item counts: consumed, sold, thrown away
   - Visual pie chart or progress bar

**Postconditions:**
- User sees consumption efficiency

---

#### UC-GF-004: View Money Saved Dashboard
**Actor:** User  
**Description:** View financial savings from sustainable actions

**Preconditions:**
- User is authenticated

**Main Flow:**
1. User navigates to EcoBoard dashboard
2. System displays money saved panel showing:
   - Total savings from preventing waste
   - Earnings from marketplace sales
   - Combined financial impact

**Postconditions:**
- User sees financial benefits of sustainability

---

#### UC-GF-005: Collect Points
**Actor:** User  
**Description:** Earn points from sustainable actions

**Preconditions:**
- User is authenticated
- User performs qualifying action

**Main Flow:**
1. User completes sustainable action (consume product, sell item, etc.)
2. System automatically calculates points based on action type
3. System awards points to user account
4. User receives notification of points earned

**Postconditions:**
- User's total and redeemable points updated
- Point transaction logged

**Acceptance Criteria:**
- [ ] Points automatically awarded for qualifying actions within 5s

---

#### UC-GF-006: Redeem Points
**Actor:** User  
**Description:** Exchange points for rewards

**Preconditions:**
- User is authenticated
- User has sufficient redeemable points

**Main Flow:**
1. User navigates to Points Redemption screen
2. System displays available rewards:
   - Marketplace credits
   - Special badges
3. User selects reward
4. System verifies point balance
5. System deducts points and grants reward

**Postconditions:**
- Points deducted from redeemable balance
- Reward applied to user account

**Acceptance Criteria:**
- [ ] Redemption flow prevents overspending points

---

#### UC-GF-007: View Achievement Badges
**Actor:** User  
**Description:** View earned and available badges

**Preconditions:**
- User is authenticated

**Main Flow:**
1. User navigates to Achievements screen
2. System displays:
   - Earned badges with earn dates
   - Locked badges with unlock criteria
   - Progress toward locked badges
3. User can tap badge for details

**Postconditions:**
- User sees badge collection

**Acceptance Criteria:**
- [ ] Badge system correctly detects unlock conditions

---

#### UC-GF-008: Share Achievement Badge
**Actor:** User  
**Description:** Share earned badge to social media

**Preconditions:**
- User is authenticated
- User has earned at least one badge

**Main Flow:**
1. User selects earned badge
2. User chooses "Share" option
3. System generates shareable image/link
4. System opens share dialog (social media options)
5. User completes sharing

**Postconditions:**
- Badge shared to selected platform
- Share timestamp recorded

---

### System-Facing Use Cases

#### UC-GF-009: Generate Badge
**Actor:** System  
**Description:** Automatically award badges based on criteria

**Trigger:** User action or milestone reached

**Main Flow:**
1. System monitors user actions and metrics
2. System evaluates badge unlock criteria
3. When criteria met, system awards badge
4. System sends push notification to user

**Postconditions:**
- Badge added to user's collection
- Notification sent

**Acceptance Criteria:**
- [ ] Users receive push notifications for new badges (integration TBD)

---

#### UC-GF-010: Generate Points
**Actor:** System  
**Description:** Calculate and award points for actions

**Trigger:** User completes qualifying action

**Main Flow:**
1. System receives action event
2. System applies point rules to determine award
3. System updates user's point balance
4. System logs transaction

**Postconditions:**
- Points updated
- Transaction recorded

---

## 2. Point System Rules

| Action | Points Awarded |
|--------|----------------|
| Consume a product | +10 |
| List item for sale | +25 |
| Sell a product | +50 |
| No waste streak (3 days) | +100 |
| Scan receipt | +5 |
| First badge earned | +200 |
| Redeem marketplace credit | Variable (spending points) |

---

## 3. Initial Badge Set

| Badge Name | Tier | Unlock Criteria |
|------------|------|-----------------|
| First Step | Bronze | Scan first receipt |
| Share & Care | Bronze | List first item for sale |
| Saver | Bronze | Save $50 from prevented waste |
| Local Hero | Silver | Sell to 5 different buyers |
| Green King/Queen | Gold | Save 100kg CO2 |
| Master Seller | Gold | Earn $100 from marketplace |
| Zero Waste Hero | Platinum | Achieve 0 waste for 7 days |

---

## 4. Database Schema

> **Note:** UserPoint schema is currently marked as **Unconfirmed** in the LDM and may change.

```sql
-- User points table (Unconfirmed)
CREATE TABLE user_points (
    id INT PRIMARY KEY,
    userId INT NOT NULL,
    total_points INT DEFAULT 0,
    current_streak INT DEFAULT 0,
    FOREIGN KEY (userId) REFERENCES users(id)
);

-- Badges table
CREATE TABLE badges (
    id INT PRIMARY KEY,
    code VARCHAR(100),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    points_awarded INT,
    sort_order INT,
    badge_image_url VARCHAR(500)
);

-- User badges table
CREATE TABLE user_badges (
    id INT PRIMARY KEY,
    userId INT NOT NULL,
    badge_id INT NOT NULL,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (badge_id) REFERENCES badges(id)
);
```

---

## 5. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/gamification/dashboard` | Get all dashboard metrics |
| GET | `/api/v1/gamification/dashboard/co2-saved` | CO2 saved data |
| GET | `/api/v1/gamification/dashboard/co2-wasted` | CO2 wasted data |
| GET | `/api/v1/gamification/dashboard/consumption` | Food consumption % |
| GET | `/api/v1/gamification/dashboard/money-saved` | Money saved data |
| GET | `/api/v1/gamification/points` | Get user points balance |
| GET | `/api/v1/gamification/points/history` | Points transaction history |
| POST | `/api/v1/gamification/points/redeem` | Redeem points |
| GET | `/api/v1/gamification/badges` | Get user's badges |
| GET | `/api/v1/gamification/badges/available` | Get all badges (locked/unlocked) |
| POST | `/api/v1/gamification/badges/{badgeId}/share` | Share badge to social media |

---

## 6. UI Prototypes

- EcoBoard dashboard (4-panel layout as per Figma)
- EcoPoints screen with redemption options
- Achievements screen with badge gallery
- Daily/monthly chart views (line + bar charts)

---

## 7. Acceptance Criteria Summary

- [ ] Dashboard displays real-time CO2, consumption %, and money metrics
- [ ] Points automatically awarded for qualifying actions within 5s
- [ ] Charts render smoothly for up to 90 days of data
- [ ] Badge system correctly detects unlock conditions
- [ ] Users receive push notifications for new badges (integration TBD)
- [ ] Redemption flow prevents overspending points
