# EcoPlate

A sustainability-focused food management platform that helps reduce food waste through smart inventory tracking, community marketplace, and gamification.

## System Architecture

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        WEB["Web Browser"]
        IOS["iOS App"]
        ANDROID["Android App"]
    end

    subgraph Frontend["Frontend (React + Vite)"]
        REACT["React 18 + TypeScript"]
        CAPACITOR["Capacitor"]
        TAILWIND["Tailwind CSS + shadcn/ui"]
    end

    subgraph Backend["Backend (Bun)"]
        API["REST API Server"]
        AUTH["JWT Auth Middleware"]
        ROUTES["Route Handlers"]
    end

    subgraph Services["External Services"]
        OPENAI["OpenAI API"]
        RECOMMEND["Recommendation Engine"]
    end

    subgraph Database["Database Layer"]
        SQLITE["SQLite"]
        DRIZZLE["Drizzle ORM"]
    end

    WEB --> REACT
    IOS --> CAPACITOR
    ANDROID --> CAPACITOR
    CAPACITOR --> REACT
    REACT --> TAILWIND
    REACT -->|HTTP/REST| API
    API --> AUTH
    AUTH --> ROUTES
    ROUTES --> DRIZZLE
    DRIZZLE --> SQLITE
    ROUTES -->|Receipt Scan| OPENAI
    ROUTES -->|Price Suggestion| RECOMMEND
```

## Features

### MyFridge
- Track food items with expiry dates
- Receive expiry warnings and notifications
- Scan grocery receipts with AI (OpenAI Vision)
- Log consumption, sharing, and waste

### Marketplace
- List near-expiry food items for sale or free
- Browse and reserve listings from others
- AI-powered price recommendations
- In-app messaging between buyers and sellers

### Gamification (EcoBoard)
- Earn points for sustainable actions
- Track streaks and sustainability metrics
- Unlock badges for achievements
- View CO2 savings and waste reduction rate
- Community leaderboard

## User Flow

```mermaid
flowchart TD
    START((Start)) --> AUTH{Authenticated?}
    AUTH -->|No| LOGIN[Login/Register]
    LOGIN --> DASHBOARD
    AUTH -->|Yes| DASHBOARD[Dashboard]

    DASHBOARD --> FRIDGE[MyFridge]
    DASHBOARD --> MARKET[Marketplace]
    DASHBOARD --> ECO[EcoBoard]

    subgraph MyFridge["MyFridge Module"]
        FRIDGE --> ADD[Add Product]
        FRIDGE --> SCAN[Scan Receipt]
        FRIDGE --> VIEW[View Items]
        ADD --> POINTS1[+2 Points]
        SCAN -->|AI Processing| PARSE[Parse Items]
        PARSE --> ADD
        VIEW --> CONSUME{Action?}
        CONSUME -->|Consumed| POINTS2[+5 Points]
        CONSUME -->|Shared| POINTS3[+10 Points]
        CONSUME -->|Sold| POINTS4[+8 Points]
        CONSUME -->|Wasted| POINTS5[-2 Points]
    end

    subgraph Marketplace["Marketplace Module"]
        MARKET --> BROWSE[Browse Listings]
        MARKET --> CREATE[Create Listing]
        BROWSE --> RESERVE[Reserve Item]
        RESERVE --> MESSAGE[Message Seller]
        CREATE --> PRICE[Get AI Price]
        CREATE --> PUBLISH[Publish]
    end

    subgraph Gamification["Gamification Module"]
        ECO --> STATS[View Stats]
        ECO --> BADGES[View Badges]
        ECO --> LEADER[Leaderboard]
        POINTS1 & POINTS2 & POINTS3 & POINTS4 --> STATS
        STATS --> UNLOCK{Badge Unlock?}
        UNLOCK -->|Yes| BADGES
    end
```

## Database Schema

```mermaid
erDiagram
    users ||--o{ products : owns
    users ||--o{ marketplace_listings : sells
    users ||--o{ messages : sends
    users ||--|| user_points : has
    users ||--|| user_sustainability_metrics : has
    users ||--o{ user_badges : earns

    products ||--o{ consumption_logs : tracks
    products ||--o{ marketplace_listings : listed_as

    marketplace_listings ||--o{ listing_images : has
    marketplace_listings ||--o{ messages : contains

    badges ||--o{ user_badges : awarded_to

    users {
        int id PK
        string email UK
        string password_hash
        string name
        timestamp created_at
    }

    products {
        int id PK
        int user_id FK
        string name
        string category
        float quantity
        date expiry_date
        string storage_location
        boolean is_consumed
    }

    marketplace_listings {
        int id PK
        int seller_id FK
        string title
        float price
        string status
        int view_count
    }

    user_points {
        int id PK
        int user_id FK
        int total_points
        int current_streak
    }

    badges {
        int id PK
        string code UK
        string name
        int points_awarded
    }

    user_sustainability_metrics {
        int id PK
        int user_id FK
        int items_consumed
        int items_wasted
        float co2_saved
        float waste_reduction_rate
    }
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | [Bun](https://bun.sh) |
| Database | SQLite (via `bun:sqlite`) |
| ORM | [Drizzle ORM](https://orm.drizzle.team) |
| Backend | Bun native HTTP server |
| Frontend | React 18 + TypeScript |
| Build Tool | [Vite](https://vitejs.dev) |
| Styling | [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) |
| Mobile | [Capacitor](https://capacitorjs.com) (iOS & Android) |
| Auth | JWT (jose library) |
| Validation | [Zod](https://zod.dev) |

## API Authentication Flow

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

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── index.ts           # Main server entry
│   │   ├── routes/            # API route handlers
│   │   │   ├── auth.ts        # Authentication endpoints
│   │   │   ├── myfridge.ts    # Fridge management endpoints
│   │   │   ├── marketplace.ts # Marketplace endpoints
│   │   │   └── gamification.ts# Gamification endpoints
│   │   ├── middleware/        # Auth middleware
│   │   ├── db/
│   │   │   ├── schema.ts      # Drizzle ORM schema
│   │   │   ├── migrations/    # Database migrations
│   │   │   └── seed.ts        # Seed data
│   │   └── utils/             # Utilities
│   ├── public/                # Built frontend assets
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Page components
│   │   ├── contexts/          # React contexts
│   │   ├── services/          # API client + Capacitor utils
│   │   ├── hooks/             # Custom hooks
│   │   └── lib/               # Utilities
│   ├── ios/                   # iOS native project (after cap add)
│   ├── android/               # Android native project (after cap add)
│   ├── capacitor.config.ts    # Capacitor configuration
│   ├── vite.config.ts
│   └── package.json
├── scripts/                   # Start/stop/build scripts
├── package.json               # Root workspace
└── .env.example               # Environment template
```

## Prerequisites

- [Bun](https://bun.sh) v1.0 or higher

## Quick Start

### Using Scripts

**Windows (PowerShell):**
```powershell
# Start both frontend and backend
.\scripts\start-all.ps1

# Stop all servers
.\scripts\stop-all.ps1
```

**Mac/Linux:**
```bash
# Start both frontend and backend
./scripts/start-all.sh

# Stop all servers
./scripts/stop-all.sh
```

### Manual Setup

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Run database migrations:**
   ```bash
   bun run db:migrate
   bun run db:seed
   ```

4. **Start development servers:**
   ```bash
   # Terminal 1: Backend
   bun run dev:backend

   # Terminal 2: Frontend
   bun run dev:frontend
   ```

5. **Open the app:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

## Production Build

**Windows:**
```powershell
.\scripts\build.ps1
```

**Mac/Linux:**
```bash
./scripts/build.sh
```

Then start the production server:
```bash
cd backend
bun run src/index.ts
```

The server will serve both the API and the built frontend on http://localhost:3000.

## Mobile Apps (iOS & Android)

The app uses [Capacitor](https://capacitorjs.com) to build native iOS and Android apps.

### Prerequisites

- **iOS**: macOS with Xcode 14+ and CocoaPods
- **Android**: Android Studio with SDK 33+

### Building for Android

**Windows/Mac/Linux:**
```bash
./scripts/build-android.sh
# or on Windows:
.\scripts\build-android.ps1
```

Then open in Android Studio:
```bash
cd frontend && bunx cap open android
```

Or build APK from command line:
```bash
cd frontend/android && ./gradlew assembleDebug
```

APK location: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

### Building for iOS (macOS only)

```bash
./scripts/build-ios.sh
```

Then open in Xcode:
```bash
cd frontend && bunx cap open ios
```

Or open directly: `frontend/ios/App/App.xcworkspace`

### Mobile Configuration

Edit `frontend/.env.mobile` to set the production API URL:
```
VITE_API_URL=https://api.ecoplate.app/api/v1
```

For development, the app connects to `localhost`. For production builds, update the API URL and rebuild.

### Capacitor Commands

```bash
cd frontend

# Sync web assets to native projects
bun run cap:sync

# Open native IDE
bun run cap:open:ios      # Opens Xcode
bun run cap:open:android  # Opens Android Studio

# Build for mobile
bun run build:mobile      # Build and sync both platforms
bun run build:ios         # Build and copy to iOS
bun run build:android     # Build and copy to Android
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `JWT_SECRET` | Secret key for JWT signing | Yes (for production) |
| `OPENAI_API_KEY` | OpenAI API key for receipt scanning | No |

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
| GET | `/api/v1/marketplace/listings` | Browse listings |
| POST | `/api/v1/marketplace/listings` | Create listing |
| GET | `/api/v1/marketplace/listings/:id` | Get listing |
| PATCH | `/api/v1/marketplace/listings/:id` | Update listing |
| DELETE | `/api/v1/marketplace/listings/:id` | Delete listing |
| POST | `/api/v1/marketplace/listings/:id/reserve` | Reserve listing |
| POST | `/api/v1/marketplace/listings/:id/sold` | Mark as sold |
| POST | `/api/v1/marketplace/listings/:id/price-recommendation` | Get AI price suggestion |
| GET | `/api/v1/marketplace/listings/:id/messages` | Get messages |
| POST | `/api/v1/marketplace/listings/:id/messages` | Send message |
| GET | `/api/v1/marketplace/messages` | Get all conversations |

### Gamification
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/gamification/dashboard` | Get dashboard data |
| GET | `/api/v1/gamification/points` | Get points details |
| GET | `/api/v1/gamification/badges` | Get all badges |
| GET | `/api/v1/gamification/metrics` | Get sustainability metrics |
| GET | `/api/v1/gamification/leaderboard` | Get leaderboard |

## Scripts Reference

| Script | Description |
|--------|-------------|
| `start-backend.ps1` / `.sh` | Start backend server with dependencies |
| `stop-backend.ps1` / `.sh` | Stop backend server |
| `start-frontend.ps1` / `.sh` | Start frontend dev server with dependencies |
| `stop-frontend.ps1` / `.sh` | Stop frontend dev server |
| `start-all.ps1` / `.sh` | Start all servers (backend, frontend, recommendation) |
| `stop-all.ps1` / `.sh` | Stop all servers |
| `build.ps1` / `.sh` | Build web app for production |
| `build-android.ps1` / `.sh` | Build Android app |
| `build-ios.sh` | Build iOS app (macOS only) |

## Database

The application uses SQLite stored at `backend/ecoplate.db`. The schema includes:

- **Users & Auth**: users, refresh_tokens, password_reset_tokens
- **MyFridge**: products, receipt_scans, consumption_logs
- **Marketplace**: marketplace_listings, listing_images, messages
- **Gamification**: user_points, point_transactions, badges, user_badges, user_sustainability_metrics, daily_sustainability_snapshots

## License

MIT
