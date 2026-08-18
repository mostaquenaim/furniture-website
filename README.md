# Sakigai Furniture — Backend

NestJS + Prisma (PostgreSQL) API powering the Sakigai / Ondorkotha furniture e-commerce platform: storefront catalog, cart and checkout, order management, courier integrations, payments, and the admin dashboard.

## Project Overview

- **Framework:** NestJS 11 (Express platform), TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **Realtime:** Socket.IO gateway for order status and stock events
- **Queues:** Bull + Redis (background jobs, e.g. email, scheduled tasks)
- **Auth:** JWT (Passport) with role/permission-based access control, plus Google OAuth
- **Payments:** SSLCOMMERZ
- **Courier:** Pathao, RedX, Paperfly integrations (webhook-driven order status updates)
- **File storage:** Cloudinary
- **Email/SMS:** Resend, SMTP (nodemailer), MIM SMS
- **API docs:** Swagger, scoped to the partner-facing inventory API at `/docs/partner`

All routes are served under `/api` with URI versioning, so the base path is `/api/v1/...`.

## Running Locally

### Prerequisites

- Node.js 20+
- PostgreSQL (local instance or hosted)
- Redis (required for Bull queues)

### Setup

```bash
npm install
cp .env.example .env   # then fill in the values, see below
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

The API starts on `http://localhost:3000` (or the `PORT` you set) with hot reload.

## Environment Variables

Copy `.env.example` to `.env` and configure. Key variables:

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development` / `production` |
| `DATABASE_URL` | Postgres connection string used by Prisma |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | Individual DB connection parts (kept in sync with `DATABASE_URL`) |
| `PORT` | Port the API listens on |
| `BASE_URL` | Public URL of this API (used in emails, callbacks) |
| `FRONTEND_URL` | Public URL of the storefront, used for CORS and redirects |
| `ENABLE_NEW_PAYMENT`, `PAYMENT_PROVIDER` | Payment gateway toggle/selection |
| `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_IS_LIVE` | SSLCOMMERZ credentials |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Image upload/storage |
| `DEFAULT_DELIVERY_FEE` | Fallback delivery fee used when a courier rate isn't available |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Transactional email via SMTP |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Transactional email via Resend |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Google OAuth login |
| `PATHAO_CLIENT_ID`, `PATHAO_CLIENT_SECRET`, `PATHAO_USERNAME`, `PATHAO_PASSWORD`, `PATHAO_BASE_URL`, `PATHAO_MERCHANT_STORE_ID` | Pathao courier integration |
| `PATHAO_WEBHOOK_SECRET`, `REDX_WEBHOOK_SECRET`, `PAPERFLY_WEBHOOK_SECRET` | Shared secrets used to authenticate courier status webhooks (sent as `x-webhook-secret` header or `?secret=` query param) |
| `MANUAL_ORDER_STATUS_UPDATE` | When `true`, allows admins to override order status manually instead of relying solely on courier webhooks |
| `MIMSMS_API_KEY`, `MIMSMS_USERNAME`, `MIMSMS_SENDER_NAME` | SMS notifications |
| `REDIS_HOST`, `REDIS_PORT` | Redis connection for Bull queues |
| `FRAUD_SPY_BD_API_KEY`, `FRAUDURL` | Fraud-check integration |
| `ADMIN_PASSWORD` | Seed password for the initial admin account |
| `COMPANY_NAME` | Company name used in generated documents/emails |

## Database: Migrations & Seeding

Prisma manages the schema (`prisma/schema.prisma`) and migrations (`prisma/migrations/`).

```bash
# create and apply a new migration during development
npx prisma migrate dev --name <migration_name>

# apply pending migrations without generating a new one (used in deploys)
npx prisma migrate deploy

# regenerate the Prisma client after a schema change
npx prisma generate

# open Prisma Studio to browse/edit data
npx prisma studio

# seed the database (creates default roles/permissions, admin user, etc.)
npm run seed:prod
```

`npm run build` runs `prisma generate` automatically before compiling.

## Production / Deployment

```bash
# install dependencies
npm ci

# build (generates Prisma client + compiles TypeScript)
npm run build

# apply pending migrations, then start the compiled app
npm run start:prod
```

`start:prod` runs `prisma migrate deploy` before starting `dist/src/main.js`, so it's safe to use directly as the deploy command.

Notes:
- The app applies `helmet` and CORS (`FRONTEND_URL`-driven origin) on boot — see `src/main.ts`.
- Socket.IO is mounted on the same HTTP server via `IoAdapter` for the realtime order/stock gateway.
- Swagger docs for the partner inventory API are exposed at `/docs/partner` (key-authenticated via `X-Api-Key`; no admin routes are included in this document — see `PARTNER_API.md`).

## Important Folders & Features

| Path | Purpose |
|---|---|
| `src/auth`, `src/admin-user`, `src/roles`, `src/permission` | Authentication (JWT + Google OAuth) and role/permission-based access control |
| `src/product`, `src/category`, `src/subcategory`, `src/series`, `src/piece` | Product catalog structure |
| `src/inventory`, `src/partner-inventory` | Stock management; partner-inventory exposes a read-only, API-key-authenticated feed for third-party integrations (see `PARTNER_API.md`) |
| `src/cart`, `src/order`, `src/order-status` | Cart, checkout, and order lifecycle |
| `src/payment`, `src/payment-method-config` | SSLCOMMERZ payment processing and gateway configuration |
| `src/courier` | Pathao/RedX/Paperfly booking and webhook-driven status updates |
| `src/realtime` | Socket.IO gateway for live order status and stock events |
| `src/refund`, `src/reservation` | Refund handling and stock reservations |
| `src/supplier`, `src/purchase` (via `piece`/`inventory`) | Supplier and purchasing data |
| `src/blog`, `src/cms`, `src/faq`, `src/seo`, `src/homepage-gallery`, `src/banner`, `src/urgency-banner`, `src/seasonal-category`, `src/featured-category` | Content management for the storefront |
| `src/notifications`, `src/admin-notifications` | Customer and admin notification delivery |
| `src/support` | Support ticket system |
| `src/review`, `src/wishlist`, `src/recommendations` | Customer engagement features |
| `src/company`, `src/settings` | Site-wide company/settings configuration |
| `src/activity-log` | Audit log of admin actions |
| `src/dashboard` | Admin dashboard aggregate data/stats |
| `src/api-client` | Management of partner API keys |
| `src/common` | Shared guards, interceptors, decorators, and utilities |
| `prisma/` | Prisma schema, migrations, and seed script |

## Tests

```bash
npm run test        # unit tests
npm run test:e2e     # end-to-end tests
npm run test:cov     # coverage report
```
