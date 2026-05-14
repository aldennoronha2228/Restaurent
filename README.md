# NexResto

<p align="center">
	<strong>Multi-Tenant Restaurant Platform</strong><br />
	Dashboard, customer experience, AI assistance, and operations in one codebase.
</p>

<p align="center">
	<img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" />
	<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
	<img alt="Firebase" src="https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20Storage-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" />
	<img alt="Jest" src="https://img.shields.io/badge/Tests-Jest-C21325?style=for-the-badge&logo=jest&logoColor=white" />
</p>

---

## What Is NexResto?

NexResto is a full-stack, multi-tenant platform for restaurants to run digital menus, manage orders, monitor operations, and personalize customer-facing branding.

It is built with a production-first architecture that separates app entrypoints, domain features, shared services, and infrastructure concerns.

## Dashboard Preview

![NexResto Live Orders Dashboard - Monitor active orders, table status, and restaurant operations](docs/images/dashboard-live-orders.png)

## The 4-Layer Product Flow

| Layer | Purpose |
| --- | --- |
| Tenant & Auth | Secure store-based access with role guards for owner, manager, staff, and super-admin. |
| Operations | Orders, menu, inventory, analytics, and table-aware workflows for day-to-day management. |
| Customer Experience | Branded customer menu, cart, order history, and live theme-aware storefront behavior. |
| AI Assistance | Concierge and support assistants with Groq-first routing and fallback logic. |

## Project Structure

```
Restaurant/
├── apps/                         # Application entry points
│   ├── api/                      # Standalone backend boundary (Node/Express)
│   └── web/                      # Next.js App Router (UI + route handlers)
│
├── features/                     # Feature-first domain modules
│   ├── auth/                     # Authentication flows (restaurant, super-admin)
│   ├── cart/                     # Shopping cart functionality
│   ├── menu/                     # Menu management and display
│   └── orders/                   # Order processing and history
│
├── components/                   # Shared UI components
│   ├── auth/                     # Authentication UI
│   ├── customer/                 # Customer-facing components
│   ├── dashboard/                # Admin dashboard components
│   ├── pricing/                  # Pricing display components
│   ├── seo/                      # SEO-related components
│   ├── tenant/                   # Tenant-specific components
│   └── ui/                       # Reusable UI primitives
│
├── services/                     # Service clients & external integrations
│
├── lib/                          # Shared runtime logic
│   ├── server/                   # Server-only utilities
│   ├── client/                   # Client-only utilities
│   ├── seo/                      # SEO utilities
│   ├── crypto.ts                 # Encryption/decryption
│   ├── firebase.ts               # Firebase client SDK
│   ├── firebase-admin.ts         # Firebase Admin SDK
│   ├── firebase-api.ts           # Firebase API helpers
│   ├── email.ts                  # Email service
│   ├── logger.ts                 # Logging utilities
│   ├── validate.ts               # Validation logic
│   └── utils.ts                  # General utilities
│
├── context/                      # React Context providers
│   ├── AuthContext.tsx           # Restaurant/staff authentication state
│   ├── CartContext.tsx           # Shopping cart state
│   └── SuperAdminAuthContext.tsx # Super-admin authentication state
│
├── hooks/                        # Custom React hooks
│   └── useRestaurant.ts          # Restaurant context hook
│
├── config/                       # Runtime configuration
│   └── env.ts                    # Environment variables
│
├── types/                        # TypeScript types & interfaces
│
├── database/                     # Schema & migrations
│   ├── schema.md                 # Firestore schema documentation
│   ├── migrations/               # Migration scripts
│   └── README.md                 # Database setup guide
│
├── functions/                    # Firebase Cloud Functions
│   ├── src/                      # Function source code
│   ├── tsconfig.json             # TypeScript config
│   └── package.json              # Function dependencies
│
├── desktop/                      # Windows desktop wrapper
│   ├── main.js                   # Electron main process
│   ├── preload.js                # Preload script
│   ├── scripts/                  # Build scripts
│   ├── assets/                   # Desktop assets
│   └── README.md                 # Desktop build guide
│
├── scripts/                      # Operations & maintenance scripts
│
├── styles/                       # Global stylesheets
│
├── __tests__/                    # Automated test suites
│   ├── menuTenantIsolationApi.test.ts
│   ├── ordersTenantIsolationApi.test.ts
│   ├── security.test.ts
│   └── *.test.ts                 # Additional tests
│
├── docs/                         # Documentation
│   ├── PROJECT_BRIEF.md          # Project overview
│   ├── TENANT_ISOLATION_ARCHITECTURE.md
│   ├── SECURITY.md               # Security guidelines
│   ├── SECURE_BUILD_OBFUSCATION.md
│   ├── architecture/             # Architecture diagrams
│   └── notes/                    # Development notes
│
├── archive/                      # Archived artifacts
│   └── debug-artifacts/          # Debug builds & logs
│
├── .env                          # Environment variables (local)
├── .env.example                  # Environment template
├── vite.config.ts                # Vite configuration
├── vite.config.ts                # Vite configuration
├── jest.config.ts                # Jest testing configuration
├── tsconfig.json                 # TypeScript configuration
├── eslint.config.mjs             # ESLint configuration
├── firebase.json                 # Firebase project config
├── firestore.rules               # Firestore security rules
├── vercel.json                   # Vercel deployment config
├── app.json                      # Expo/mobile config
├── eas.json                      # EAS (Expo Application Services) config
├── package.json                  # Root dependencies
└── README.md                     # This file
```

### Key Directories Explained

| Directory | Purpose |
| --- | --- |
| `apps/` | Separate entry points: web (Next.js) and API (backend boundary) |
| `features/` | Domain modules organized by feature (auth, cart, menu, orders) |
| `components/` | Reusable UI components shared across features |
| `lib/` | Shared logic: Firebase, utilities, validation, logging |
| `context/` & `hooks/` | React state management and reusable logic |
| `database/` | Firestore schema, migrations, and setup documentation |
| `functions/` | Firebase Cloud Functions for backend operations |
| `desktop/` | Electron wrapper for Windows desktop auto-updates |
| `scripts/` | Operational scripts for maintenance and deployment |
| `__tests__/` | Test suites covering security, tenant isolation, and APIs |
| `docs/` | Architecture docs, security guidelines, and development notes |

## Core Capabilities

- Multi-tenant routing by `storeId`
- Restaurant and super-admin authentication flows
- Role-based access control and tenant isolation
- Table-aware customer menu + cart + order history
- Dashboard branding with live preview sync
- Firestore-first data model with fallback handling for branding

## What Is New (April 2026)

- Support chatbot UX refresh:
	- compact dark chat styling
	- quick suggestions auto-hidden after conversation starts
	- compact `Clear` action in the header
- AI provider reliability:
	- Groq prioritized for support and concierge routes
	- automatic endpoint normalization for `/chat/completions`
	- model fallback handling for Groq variants
	- OpenAI/Gemini fallback retained
- Groq quota resilience:
	- support for multiple Groq API keys
	- automatic failover when one key reaches rate/quota limits
- Dashboard UX improvements:
	- mobile table editing with tap-select + nudge movement controls
	- cleaner subscription summary controls in account settings
	- pricing cards unified via shared `PRICING_PLANS`
- Deployment stability:
	- post-build sync ensures root `.next/routes-manifest.json` availability for runtime environments that expect root output

## Branding System

Branding is persisted with a primary + fallback strategy:

- `branding/{restaurantId}` (primary)
- `restaurants/{restaurantId}.branding` (fallback/mirror)

Supported branding controls:

- Primary, secondary, and background colors
- Font family configuration
- Logo and hero image uploads
- Hero overlay opacity + headline + tagline
- Hero visibility toggles
- Catalog headline and featured images payloads
- Live preview synchronization via `postMessage`

Related API routes:

- `GET/POST /api/branding/settings`
- `POST /api/branding/upload`
- `GET /api/tenant/branding`

## Quick Start

1. Install dependencies.

```bash
npm install
```

2. Configure `.env` (or `.env.local`).

- Firebase client config: `NEXT_PUBLIC_FIREBASE_*`
- Firebase Admin credentials: `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- Tenant defaults: `NEXT_PUBLIC_RESTAURANT_ID`
- Optional integrations:
	- Email: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
	- AI: `GROQ_API_KEY` (recommended), `GROQ_API_KEY_2`, `OPENAI_API_KEY`, `GEMINI_API_KEY`

3. Start local development.

```bash
npm run dev
```

4. Build for production.

```bash
npm run build
```

## Testing

```bash
npm test
npm run test:security
```

## Secure Build / Obfuscation

```bash
npm run build:secure
npm run obfuscate:build
npm run verify:obfuscation
```

Reference: `docs/SECURE_BUILD_OBFUSCATION.md`

## Windows Desktop Auto-Updates

The repository includes an updater-enabled desktop wrapper under `desktop/`.

Key notes:

- Existing users on legacy ZIP/EXE builds must install the new installer one time.
- After migration, the app checks GitHub Releases and prompts users to restart after update download.

Commands:

```bash
npm run desktop:dev
npm run desktop:dist
```

Release pipeline:

- Workflow: `.github/workflows/windows-desktop-release.yml`
- Tag pattern: `desktop-v1.0.1`

Installer artifacts:

- NSIS source: `desktop/scripts/installer/NexRestoSetup.nsi`
- Archived generated installers: `archive/debug-artifacts/installer/`

## Architecture Snapshot

| Path | Responsibility |
| --- | --- |
| `apps/web/` | Next.js App Router app (UI + route handlers) |
| `apps/api/` | Standalone backend boundary (Node/Express bootstrap) |
| `features/` | Feature-first domain modules (`cart`, `orders`, `menu`, `auth`) |
| `components/` | Shared UI components |
| `services/` | Service clients and external integrations |
| `lib/` | Shared runtime logic, Firebase, validation, utilities |
| `context/`, `hooks/` | Client state and reusable React hooks |
| `config/`, `types/` | Runtime configuration and cross-layer contracts |
| `database/` | Schema and migration documentation |
| `scripts/`, `docs/` | Operations, maintenance, and architecture notes |
| `__tests__/` | Automated test suites |

## Operational Notes

- Never place server secrets in `NEXT_PUBLIC_*` variables.
- Rotate leaked credentials immediately and update deployment secrets.
- Use `?restaurant=<id>&preview=1` on `/customer` for branding preview testing.
- Runtime is launched from `apps/web` via root scripts; route behavior remains preserved under `apps/web/app/api`.
