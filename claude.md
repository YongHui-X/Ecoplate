# EcoPlate Project Rules

## General Guidelines

- When running any command on the shell, ALWAYS check what operating system the agent is running on (Windows, Linux, macOS) to ensure correct syntax (e.g., path separators, environment variables).

This is a monorepo with three main components:

- `backend/` - Bun API server
- `frontend/` - React application with Capacitor (Web + Android only)
- `recommendation-engine/` - Python Flask API for ML recommendations

## Database Schema

The project uses SQLite with Drizzle ORM. Schema is defined in `backend/src/db/schema.ts`.

**Core Tables (matching ERD):**
- `users` - User accounts and profiles
- `products` - MyFridge inventory items
- `marketplace_listings` - Marketplace listings

**CRITICAL: Database Migration Process**

The SQLite database (`backend/ecoplate.db`) is **committed to git** to share data among team members.

1. **Never modify the database directly** - Always modify `schema.ts`
2. **The `.db` file IS committed** - Shared dev data via version control
3. **When pulling changes:**
   - If schema changed, you may need to run migrations
   - If only data changed, git pull will update your local database
   - **Stop the backend server before pulling** to avoid file lock conflicts

4. **To reset your local database (if needed):**
   ```bash
   cd backend
   # Stop the server first!
   # Windows:
   del ecoplate.db
   bun run db:migrate
   bun run db:seed
   # Linux/macOS:
   rm -f ecoplate.db && bun run db:migrate && bun run db:seed
   ```

5. **When modifying schema:**
   - Edit `backend/src/db/schema.ts`
   - Delete old migration: `rm -rf backend/src/db/migrations` (or `rmdir /s backend\src\db\migrations` on Windows)
   - Generate new migration: `cd backend && bunx drizzle-kit generate:sqlite`
   - Update `migrate.ts` to reference new migration file name
   - Test locally, then commit schema.ts, migration files, AND the updated `.db` file

**Note:** Avoid committing sensitive data (real user emails, passwords). The database should only contain demo/test data.

## Backend (Bun API Server)

Default to using Bun instead of Node.js.

### Project Structure

```
backend/
├── src/
│   ├── routes/         # Route handlers
│   ├── services/       # Business logic
│   ├── middleware/     # Auth and other middleware
│   ├── db/             # Database schema and migrations
│   ├── utils/          # Utility functions
│   └── index.ts        # Main server entry point
├── public/             # Static files (frontend build in production)
├── package.json
├── tsconfig.json
├── drizzle.config.ts   # Drizzle ORM config
└── .env
```

### Commands

```bash
cd backend
bun run dev      # Development with hot reload
bun run start    # Production
bun install      # Install dependencies
```

### APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Use `Bun.$\`cmd\`` instead of execa
- Bun automatically loads .env, so don't use dotenv
- Use `drizzle-orm` with `bun:sqlite` for database operations

### Adding Routes

1. Create file in `src/routes/` (e.g., `users.ts`)
2. Export register function (e.g., `registerUserRoutes`)
3. Import and call register function in `src/index.ts`

### Adding Services

1. Create file in `src/services/` (e.g., `user-service.ts`)
2. Export service functions
3. Import where needed in routes

## Frontend (React + Capacitor)

The frontend is a React application with Tailwind CSS, shadcn/ui, and Capacitor for mobile deployment.

### Project Structure

```
frontend/
├── index.html              # Entry point
├── src/
│   ├── components/
│   │   ├── ui/             # shadcn/ui components
│   │   ├── common/         # Reusable composite components
│   │   ├── MyFridge/       # MyFridge feature components
│   │   ├── Marketplace/    # Marketplace feature components
│   │   └── Gamification/   # EcoBoard feature components
│   ├── pages/              # Page components (routes)
│   ├── router/             # React Router setup
│   ├── hooks/              # Custom hooks
│   ├── services/           # API client services
│   ├── store/              # State management (Context API)
│   ├── utils/              # Helper functions
│   ├── lib/                # shadcn/ui utilities (cn function)
│   ├── constants/          # Theme, colors, strings
│   ├── App.tsx             # Root component
│   └── main.tsx            # React entry point
├── android/                # Capacitor Android project
├── capacitor.config.ts     # Capacitor configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── components.json         # shadcn/ui configuration
├── vite.config.ts          # Vite configuration
└── package.json
```

### Commands

```bash
cd frontend
bun run dev        # Development with hot reload
bun run build      # Production build
bun run preview    # Preview production build
npx cap sync       # Sync Capacitor native projects
npx cap open android  # Open Android project in Android Studio
```

### Guidelines

- Use React with TypeScript (`.tsx` files)
- Use Vite as the bundler
- Use Tailwind CSS for styling with shadcn/ui components
- Use functional components with hooks
- Use React Router for navigation
- Export components/hooks/utils from their respective `index.ts` files
- Mobile-first responsive design

### Adding Components

1. For shadcn/ui components: `npx shadcn-ui@latest add <component>`
2. For custom components: Create in `src/components/` and export from index

```tsx
// src/components/common/ProductCard.tsx
interface ProductCardProps {
  product: Product
  onClick?: () => void
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  return <div onClick={onClick}>{product.name}</div>
}
```

### Adding Hooks

1. Create hook file in `src/hooks/` (e.g., `useAuth.ts`)
2. Export from `src/hooks/index.ts`

### Adding Pages

1. Create page component in `src/pages/`
2. Add route in `src/router/index.tsx`

## Environment Variables

Backend requires these environment variables (in `.env` at project root):

- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - Secret key for JWT token signing
- `OPENAI_API_KEY` - OpenAI API key for receipt scanning and recommendations
- `RECOMMENDATION_ENGINE_URL` - URL to Flask recommendation service (default: http://localhost:5000)

Recommendation Engine requires (in `recommendation-engine/.env`):

- `PORT` - Flask server port (default: 5000)
- `FLASK_ENV` - Environment (development/production)

## Project Conventions

- TypeScript for all backend and frontend code
- Use async/await over promises
- Handle errors with try/catch blocks
- Use Zod for API request validation
- Use `jose` library for JWT operations (not jsonwebtoken)

## Pre-Push Checklist (CRITICAL)

Before ANY push to GitHub, you MUST:

1. Check for TypeScript errors using the IDE's `get_errors` tool or error panel on ALL modified files

2. Build the frontend to catch TypeScript/syntax errors:
```bash
cd frontend
bun run build
```

3. Type-check the backend (if backend files were modified):
```bash
cd backend
bunx tsc --noEmit
```

4. Verify closing tags - ensure all JSX elements have matching closing tags

The Docker build WILL FAIL if there are TypeScript errors. ALWAYS run these checks before pushing.

## Documentation Rules

- DO NOT create markdown (`.md`) files in the project root or subdirectories
- Exceptions: `README.md` and `claude.md` are allowed in the root
- All other documentation must be in `docs/` or `PRDs/` folders
- Update existing documentation rather than creating new files when possible

## Docker

Docker Compose runs all services:

```bash
docker-compose up -d          # Run all services
docker-compose build          # Rebuild images
docker-compose logs -f        # View logs
```

Services:
- `ecoplate` (port 3000) - Main app (Bun backend + React frontend)
- `recommendation-engine` (port 5000) - Flask ML API

The backend serves the frontend static files from `/public` in production.

## Recommendation Engine (Flask/Python)

Python service for buyer/seller matching and notifications.

### Project Structure

```
recommendation-engine/
├── app.py              # Main Flask application
├── requirements.txt    # Python dependencies
├── Dockerfile          # Container build
└── .env.example        # Environment template
```

### Commands

```bash
cd recommendation-engine
pip install -r requirements.txt   # Install dependencies
python app.py                     # Development server
gunicorn app:app                  # Production server
```

### API Endpoints

- `GET /health` - Health check
- `POST /api/v1/recommendations/price` - Get price recommendation
- `POST /api/v1/recommendations/seller/notifications` - Get seller alerts for expiring items
- `POST /api/v1/recommendations/buyer/matches` - Match listings to buyer preferences
- `POST /api/v1/recommendations/urgency` - Calculate urgency scores

### Guidelines

- Use Flask with flask-cors for CORS support
- Use numpy for numerical calculations
- Return JSON responses
- Include proper error handling with status codes
