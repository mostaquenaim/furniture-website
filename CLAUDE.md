# Sakigai Furniture Website — Backend

NestJS 11 + Prisma backend for a furniture e-commerce platform (products, orders, payments, courier/logistics, inventory, CMS, admin panel, etc).

## Commands

```bash
npm run start:dev      # dev server with watch (nest start --watch)
npm run build           # npx prisma generate && nest build
npm run lint             # eslint --fix on src/apps/libs/test
npm run format            # prettier --write on src/test
npm run test               # jest unit tests
npm run test:e2e            # jest e2e tests (test/jest-e2e.json)
npm run test:cov             # jest with coverage
```

Prisma:
```bash
npx prisma generate      # regenerate client after schema.prisma changes
npx prisma migrate dev     # create + apply a migration in development
npx prisma migrate deploy   # apply migrations in production (used in start:prod)
```

## Architecture

- Standard NestJS module-per-feature layout under [src/](src/): each feature (e.g. `cart`, `order`, `payment`, `courier`, `inventory`, `product`) has its own `*.module.ts`, `*.controller.ts`, `*.service.ts`, and DTOs, wired together in [src/app.module.ts](src/app.module.ts).
- [src/prisma/](src/prisma/) wraps the Prisma client as a global module; schema lives at [prisma/schema.prisma](prisma/schema.prisma).
- Background jobs use `@nestjs/bull` (Redis-backed queues); Redis connection is configured in `app.module.ts` from `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_TLS` env vars.
- Auth uses `@nestjs/passport` with JWT and Google OAuth strategies (`src/auth/`).
- Admin-side concerns (roles, permissions, admin users, activity log, dashboard) are separated from customer-facing modules (cart, wishlist, review, order, guest checkout).
- Realtime features live in `src/realtime/` (Socket.io via `@nestjs/websockets` / `@nestjs/platform-socket.io`).

## Conventions

- TypeScript strict-ish config: `strictNullChecks` on, `noImplicitAny` off — existing code relies on this, don't tighten it repo-wide as a side effect of an unrelated change.
- ESLint + Prettier via `eslint-plugin-prettier`; `@typescript-eslint/no-explicit-any` is intentionally off, `no-floating-promises` and `no-unsafe-argument` are warnings, not errors. Match existing style rather than fighting the linter.
- Module structure: keep controller thin, business logic in the service, DTOs for request validation (`class-validator` / `class-transformer`).
- `strict: true` is not set globally — don't assume all files are null-safety-checked.

## Related project

There's a companion frontend at `E:\Sammtech\furniture-bideshi\furniture-frontend\sakigai` (Next.js/React) — the `Checkout` component directory is set up as an additional working directory in this workspace when frontend/backend changes need to be coordinated (e.g. cart/checkout API contract changes).
