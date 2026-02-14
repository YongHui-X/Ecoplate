# EcoPlate

> A full-stack sustainability platform that reduces household food waste through AI-powered inventory tracking, a peer-to-peer marketplace, and a gamified reward system.

EcoPlate transforms how households manage food consumption by combining **OpenAI Vision receipt scanning**, **ML-driven price recommendations**, **real-time WebSocket messaging**, and a **CO2-based gamification engine** — turning sustainable actions into points, badges, and leaderboard achievements.

Built with **React 19**, **TypeScript**, **Bun**, **SQLite (Drizzle ORM)**, **Capacitor (Android/iOS)**, and **Tailwind CSS + shadcn/ui**.

---

## System Architecture

<img width="2071" height="1246" alt="Software Architecture" src="https://github.com/user-attachments/assets/e0d499c6-43bd-4a5b-8474-b5c163b69a4e" />

---

## Screenshots

| Messaging (WebSockets) | Consumption Tracking |
|:-:|:-:|
| <img width="720" alt="Messaging" src="https://github.com/user-attachments/assets/888b6b55-b94b-479e-b12c-80240b8ebf2f" /> | <img width="720" alt="Consumption Tracking" src="https://github.com/user-attachments/assets/0e440e56-441f-44d4-b210-7c3db3d3de05" /> |

| Dashboard | Marketplace |
|:-:|:-:|
| <img width="720" alt="Dashboard" src="https://github.com/user-attachments/assets/d211ece2-4428-45e7-9d3c-a209f44827a4" /> | <img width="720" alt="Marketplace" src="https://github.com/user-attachments/assets/4347a102-2834-445c-ae5f-eb79b6c79564" /> |

| EcoPoints & Rewards |
|:-:|
| <img width="720" alt="EcoPoints" src="https://github.com/user-attachments/assets/668048fe-849b-465b-8dc3-c52d372fa5a4" /> |

---

## Key Features

### MyFridge — AI-Powered Inventory Management
- Track food items with expiration dates and CO2 emission data
- **Receipt scanning** via OpenAI Vision — snap a photo, items are parsed and added automatically
- Log consumption, waste, sharing, and sales with per-action sustainability metrics

### Marketplace — Peer-to-Peer Food Redistribution
- List near-expiry food items for sale or free pickup
- Browse listings with geolocation-based map view
- **ML-powered price recommendations** for optimal listing pricing
- **Real-time in-app messaging** between buyers and sellers via WebSockets
- Complete transactions to earn EcoPoints tied to CO2 savings

### EcoPoints & Badges — Gamification Engine
- Earn points calculated from **CO2 savings** (CO2 value x 1.5, minimum 3 points per action)
- **16 unlockable badges** across 4 categories: Milestones, Waste Reduction, Sharing, and Streaks
- Daily streak tracking with milestone notifications (3, 7, 14, 30+ days)
- Community leaderboard ranked by lifetime points
- Redeem points for rewards

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | [Bun](https://bun.sh) |
| **Database** | SQLite via `bun:sqlite` |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team) |
| **Backend** | Bun native HTTP server + WebSockets |
| **Frontend** | React 19 + TypeScript |
| **Build Tool** | [Vite](https://vitejs.dev) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) |
| **Mobile** | [Capacitor](https://capacitorjs.com) (Android & iOS) |
| **AI/ML** | OpenAI Vision API, Python recommendation engine |
| **Auth** | JWT (jose library) |
| **Validation** | [Zod](https://zod.dev) |

---

## User Flow

```mermaid
flowchart TD
    START((Start)) --> AUTH{Authenticated?}
    AUTH -- No --> LOGIN[Login/Register]
    LOGIN --> DASHBOARD
    AUTH -- Yes --> DASHBOARD[Dashboard]

    DASHBOARD --> FRIDGE[MyFridge]
    DASHBOARD --> MARKET[Marketplace]
    DASHBOARD --> ECO[EcoPoints]

    subgraph MyFridge["MyFridge Module"]
       FRIDGE --> ADD[Add Product]
       FRIDGE --> SCAN[Scan Receipt]
       FRIDGE --> VIEW[Track Consumption and Waste]

       SCAN -- AI Processing --> PARSE[Parse Items]
       PARSE --> ADD

       VIEW --> CONSUME{Action?}
       CONSUME -- Consumed --> POINTS_CONSUMED["+5 Points"]
       CONSUME -- Shared --> POINTS_SHARED["+10 Points"]
       CONSUME -- Sold --> POINTS_SOLD["+8 Points"]
       CONSUME -- Wasted --> POINTS_WASTED["-3 Points"]
    end

    subgraph Marketplace["Marketplace Module"]
        MARKET --> BROWSE[Browse Listings]
        MARKET --> CREATE[Create Listing]
        MARKET --> EDIT[Edit Listing]
        MARKET --> DELETE_L[Delete Listing]
        MARKET --> MapView[Geolocation]
        BROWSE --> MESSAGE[Message Seller]
        CREATE --> PRODUCT[Get Product Recommendation]

        MARKET --> COMPLETE[Complete Listing - Sold]
        COMPLETE --> POINTS_SOLD
    end

    subgraph Gamification["Gamification Module"]
        ECO --> STATS[View Stats]
        ECO --> BADGES[View Badges]
        ECO --> LEADER[Leaderboard]
        ECO --> REWARDS[Redeem Rewards]
        STATS --> UNLOCK{Badge Unlock?}
        UNLOCK -- Yes --> BADGES
    end
```

---

## Database Schema

<img width="4947" height="2689" alt="ERD Diagram" src="https://github.com/user-attachments/assets/f04b8b4c-e6cf-40bb-9810-cf306cacaea0" />

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Logout |

### MyFridge
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/myfridge/products` | List all products |
| POST | `/api/v1/myfridge/products` | Add product |
| GET | `/api/v1/myfridge/products/:id` | Get product |
| PATCH | `/api/v1/myfridge/products/:id` | Update product |
| DELETE | `/api/v1/myfridge/products/:id` | Delete product |
| POST | `/api/v1/myfridge/products/:id/consume` | Log consumption |
| POST | `/api/v1/myfridge/receipt/scan` | Scan receipt (AI) |

### Marketplace
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/marketplace/listings` | Browse active listings |
| GET | `/api/v1/marketplace/listings/nearby` | Get nearby listings (geolocation) |
| GET | `/api/v1/marketplace/my-listings` | Get user's own listings |
| GET | `/api/v1/marketplace/listings/:id` | Get listing details |
| POST | `/api/v1/marketplace/listings` | Create new listing |
| PATCH | `/api/v1/marketplace/listings/:id` | Update listing |
| DELETE | `/api/v1/marketplace/listings/:id` | Delete listing |
| POST | `/api/v1/marketplace/listings/:id/complete` | Mark as sold/completed |

### Gamification
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/gamification/dashboard` | Dashboard summary |
| GET | `/api/v1/gamification/points` | Points breakdown & history |
| GET | `/api/v1/gamification/badges` | All badges with progress |
| GET | `/api/v1/gamification/metrics` | Sustainability metrics |
| GET | `/api/v1/gamification/leaderboard` | Community leaderboard |

---

## Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API Server
    participant DB as Database

    Note over C,DB: Registration
    C->>A: POST /auth/register
    A->>DB: Create user + hash password
    DB-->>A: User created
    A->>A: Generate JWT tokens
    A-->>C: { accessToken, refreshToken }

    Note over C,DB: Login
    C->>A: POST /auth/login
    A->>DB: Verify credentials
    DB-->>A: User data
    A->>A: Generate JWT tokens
    A-->>C: { accessToken, refreshToken }

    Note over C,DB: Protected Request
    C->>A: GET /myfridge/products<br/>Authorization: Bearer {token}
    A->>A: Verify JWT
    A->>DB: Query products
    DB-->>A: Products list
    A-->>C: [products]

    Note over C,DB: Token Refresh
    C->>A: POST /auth/refresh
    A->>DB: Verify refresh token
    A->>A: Generate new tokens
    A-->>C: { accessToken, refreshToken }
```

## Receipt Scanning Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant AI as OpenAI Vision

    U->>F: Upload receipt image
    F->>F: Convert to Base64
    F->>B: POST /myfridge/receipt/scan
    B->>AI: Analyze image
    AI-->>B: Extracted items JSON
    B-->>F: { items: [...] }
    F->>U: Show parsed items
    U->>F: Confirm items
    F->>B: POST /myfridge/products (batch)
    B-->>F: Products created
    F->>U: Success + points awarded
```

---

## Project Structure

```
ecoplate/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Server entry point
│   │   ├── routes/               # API route handlers
│   │   │   ├── auth.ts           # Authentication
│   │   │   ├── myfridge.ts       # Fridge management
│   │   │   ├── marketplace.ts    # Marketplace
│   │   │   └── gamification.ts   # EcoPoints & Badges
│   │   ├── services/             # Business logic
│   │   │   ├── gamification-service.ts
│   │   │   └── badge-service.ts
│   │   ├── middleware/           # Auth middleware
│   │   ├── db/
│   │   │   ├── schema.ts        # Drizzle ORM schema
│   │   │   ├── migrations/      # Database migrations
│   │   │   └── seed.ts          # Seed data
│   │   └── utils/
│   └── public/                  # Built frontend assets
├── frontend/
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── pages/               # Page components
│   │   ├── contexts/            # React contexts
│   │   ├── services/            # API client + Capacitor utils
│   │   ├── hooks/               # Custom hooks
│   │   └── lib/                 # Utilities
│   ├── android/                 # Android native project
│   └── capacitor.config.ts      # Capacitor config
├── recommendation-engine/
│   ├── app.py                   # ML recommendation service
│   ├── Dockerfile               # Container deployment
│   └── requirements.txt         # Python dependencies
└── scripts/                     # Build & deployment scripts
```

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) v1.0+
- (Optional) Android Studio with SDK 33+ for mobile builds

### Quick Start

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env

# Run migrations and seed
bun run db:migrate && bun run db:seed

# Start development servers
bun run dev:backend    # Terminal 1 → http://localhost:3000
bun run dev:frontend   # Terminal 2 → http://localhost:5173
```

Or use the convenience scripts:

```bash
# Mac/Linux
./scripts/start-all.sh

# Windows (PowerShell)
.\scripts\start-all.ps1
```

### Production Build

```bash
# Mac/Linux
./scripts/build.sh

# Windows
.\scripts\build.ps1

# Serve
cd backend && bun run src/index.ts  # → http://localhost:3000
```

### Android Build

```bash
./scripts/build-android.sh     # or .\scripts\build-android.ps1
cd frontend && bunx cap open android
```

APK output: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

> **Note:** Capacitor 6.x + Android Gradle Plugin 9.0+ compatibility patches are applied automatically via `bun install`. See `docs/android-build-patching.md` for details.

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `JWT_SECRET` | Secret key for JWT signing | Yes (production) |
| `OPENAI_API_KEY` | OpenAI API key for receipt scanning | No |

---

## Database

SQLite database stored at `backend/ecoplate.db`:

| Domain | Tables |
|--------|--------|
| **Users** | `users` |
| **MyFridge** | `products`, `product_interaction` |
| **Marketplace** | `marketplace_listings`, `image_listing`, `conversation`, `message` |
| **Gamification** | `user_points`, `badges`, `user_badges`, `product_sustainability_metrics` |

---

## License

MIT
