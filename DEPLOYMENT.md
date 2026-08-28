# Deploying this project as a portfolio demo

This guide deploys the app for **showcase purposes** — recruiters clicking a
live link, not real customer traffic. It skips anything that would require a
real business (live payment processing, live courier accounts, live SMS
credits) and uses sandbox/dummy values instead.

Stack:
- **Backend** (this repo) → [Render](https://render.com) free web service
- **Database** → [Neon](https://neon.tech) free Postgres (Render's free
  Postgres auto-expires after 30 days; Neon's free tier doesn't)
- **Redis** (used by Bull queues + the partner-API rate limiter) →
  [Upstash](https://upstash.com) free Redis (same reason — Render dropped its
  permanently-free Redis plan)
- **File uploads** → Cloudinary (already integrated, free tier is enough)
- **Frontend** (`sakigai` Next.js app) → [Vercel](https://vercel.com) free tier

## 1. Database — Neon

**Option A — Neon CLI (what this repo used, gives you the Claude Code /
`neon.ts` tooling too):**

```bash
npx skills add neondatabase/agent-skills -s neon -s neon-postgres -y   # one-time
npx neon@latest auth                                                    # browser sign-in
npx neon@latest link --project-id <id> --org-id <org-id>               # pick or create a project first in the Neon console
```
`neon link` writes `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`
(direct) straight into `.env`, and a git-ignored `.neon` file recording which
project/branch you're linked to.

**Option B — Neon console, manual copy-paste:**

1. Create a free project at neon.tech.
2. From the connection details, copy **both** the pooled connection string
   (hostname has a `-pooler` suffix) and the direct one (no `-pooler`) —
   `postgresql://user:pass@ep-xxxx-pooler.region.aws.neon.tech/dbname?sslmode=require`
   and the `-pooler`-less equivalent.
3. Pooled → `DATABASE_URL`. Direct → `DATABASE_URL_UNPOOLED`.

**Both are required.** `prisma/schema.prisma` declares:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")           // pooled — app runtime queries
  directUrl = env("DATABASE_URL_UNPOOLED")   // direct — Prisma Migrate
}
```
Without `directUrl`, `prisma migrate deploy` (run automatically by
`start:prod`) goes over the pooled/PgBouncer connection instead, which can
fail in ways that never mention pooling as the cause (`prepared statement
"s0" already exists`, a `SET search_path` that silently doesn't persist,
etc.) — see the gotchas section below.

After the DB is provisioned: `npx prisma migrate deploy` once to apply the
existing migrations, then seed it (see §5).

## 2. Redis — Upstash

1. Create a free Redis database at upstash.com (pick a region close to
   Render's — e.g. Singapore, matching `render.yaml`).
2. From the database's "Details" tab, copy the **`rediss://...` connection
   string** (not the individual host/port/password fields) — that's your
   `REDIS_URL`. Also note the REST API URL + token if you want the
   `@upstash/redis` REST client (`src/common/redis.service.ts`) for
   general-purpose caching, separate from the queue/rate-limiter Redis usage.
3. Set `REDIS_URL` in Render (or `.env` locally). `src/common/utils/redis.utils.ts`
   resolves the connection from `REDIS_URL` when present, falling back to
   `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`/`REDIS_TLS` only for local dev
   without Upstash.

## 3. Backend — Render

This repo includes a `render.yaml` Blueprint, so the fastest path is:

1. Push this repo to GitHub (if it isn't already).
2. In the Render dashboard: **New → Blueprint**, point it at the repo. Render
   reads `render.yaml` and creates the web service for you.
3. It will prompt for every env var marked `sync: false` — fill them in from
   the table below. Vars with a `value:` already in `render.yaml` (like
   `SSLCOMMERZ_IS_LIVE=false`) don't need to be re-entered.
4. Deploy. First build installs deps, runs `prisma generate`, and builds
   Nest; on boot, `start:prod` runs `prisma migrate deploy` before starting
   the server, so your Neon DB gets the schema automatically.

If you'd rather not use the Blueprint, create the web service manually with:
- **Build command**: `npm install --include=dev && npx prisma generate && npm run build`
  (`--include=dev` matters — see gotchas below)
- **Start command**: `npm run start:prod`
- **Health check path**: `/api/v1`

### Environment variables to set in Render

| Variable | Value for this demo |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string |
| `DATABASE_URL_UNPOOLED` | Neon **direct** connection string — required by `prisma migrate deploy` in `start:prod` |
| `REDIS_URL` | Upstash's `rediss://...` connection string |
| `FRONTEND_URL` | Your Vercel URL, e.g. `https://sakigai.vercel.app` |
| `BASE_URL` | Your Render URL, e.g. `https://sakigai-furniture-backend.onrender.com` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | From your Cloudinary dashboard (free tier) |
| `SMTP_*` or `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Pick one mailer. Resend's free tier is the easier of the two to demo with. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | Only needed if you want "Sign in with Google" to work; set the callback to `https://<render-url>/api/v1/auth/google/callback` |
| `ADMIN_PASSWORD` | Any password you'll use to log into the admin panel |
| `SSLCOMMERZ_STORE_ID` / `SSLCOMMERZ_STORE_PASSWORD` | SSLCommerz's public **sandbox** test credentials, not real ones — `SSLCOMMERZ_IS_LIVE` is already pinned to `false` in `render.yaml` |
| `PATHAO_*`, `REDX_WEBHOOK_SECRET`, `PAPERFLY_WEBHOOK_SECRET`, `MIMSMS_*`, `FRAUD_SPY_BD_API_KEY` | Leave blank. These are real 3rd-party courier/SMS/fraud-check integrations with no sandbox mode worth wiring up for a demo — leaving them unset just means those specific features (courier booking, SMS OTP, fraud scoring) no-op or fail gracefully rather than pretend to work |

`MANUAL_ORDER_STATUS_UPDATE` is set to `true` in `render.yaml` — orders
normally advance status only via courier webhooks, which won't fire without
real courier accounts, so this lets the admin dashboard move an order's
status by hand for the demo.

### Gotchas hit while setting this up (read before you redo this on a fresh project)

- **Bull silently drops TLS on `rediss://` URLs.** If the queue library is
  `bull` (not `bullmq`), its own URL parser (`bull/lib/queue.js`) strips the
  scheme when building the connection object and never sets `tls` — so
  handing it a raw Upstash `rediss://...` string makes it connect over plain
  TCP to a TLS-only port and **hang forever with no error, no timeout**.
  Fix: don't pass Bull a URL string — resolve it to an explicit options
  object yourself (`src/common/utils/redis.utils.ts` → `getRedisConnection()`)
  so `tls` is set correctly. Plain `ioredis` (`new Redis(url)`) parses
  `rediss://` fine on its own; this only bites Bull's own config path.
- **`NODE_ENV=production` makes `npm install` skip devDependencies.**
  `@nestjs/cli` (the `nest` binary `nest build` needs) is a devDependency.
  Render's build phase inherits the service's env vars, so with
  `NODE_ENV=production` set, a plain `npm install` silently installs
  without it and the build fails with `sh: 1: nest: not found`. Fix:
  `npm install --include=dev` in the build command.
- **A startup hook doing many sequential DB queries is invisible locally,
  catastrophic on a remote DB.** `PermissionService.onApplicationBootstrap()`
  used to check-then-insert one role×action combination at a time (up to
  ~850 round trips on a fresh DB). Sub-millisecond against local Postgres;
  against Neon it silently stalled for **27 minutes** before the connection
  was dropped server-side and the query finally errored (`P1017: Server has
  closed the connection`). Fix: one bulk `createMany({ skipDuplicates: true })`
  instead of N sequential `findUnique`/`create` calls. Audit any other
  `onModuleInit`/`onApplicationBootstrap` hook for the same pattern before
  moving a project from local Postgres to a networked one.
- **Debugging technique for a silent hang with no error and no log output:**
  check whether the process is actually doing work — sample its CPU twice a
  few seconds apart (`Get-Process -Id <pid> | Select CPU`). A near-zero delta
  means it's blocked on I/O waiting for something that'll never resolve, not
  "just slow." Add a temporary `console.error('TRACE: X START')` at the top
  of each lifecycle hook to find exactly which one it's stuck in, then remove
  the tracer once found.
- **`prisma/schema.prisma` needs `directUrl` for Neon, or migrations can fail
  in ways that never mention pooling as the cause** (`prepared statement
  "s0" already exists`, a `SET search_path` that doesn't persist past its own
  transaction, an intermittent read-only-transaction error). See §1 above.

### Known limitations of the free tier (worth knowing before you send the link)

- **Cold starts.** Render's free web services spin down after 15 minutes of
  no traffic. The first request after that takes 30-60s to wake back up. If
  a recruiter's first impression matters, either upgrade the service to a
  paid always-on plan (~$7/mo) or add a scheduled uptime ping (e.g. a free
  cron-job.org hit every 10 min) — the latter is a workaround, not a real
  fix, and burns your free monthly hours faster.
- **PDF invoice generation uses Puppeteer** (`order.service.ts` →
  `renderPdf`), which launches a full headless Chromium. That's fine
  occasionally but is memory-heavy against Render free's 512MB RAM cap — if
  invoice download looks slow or times out under any concurrent load, that's
  why. Not worth re-architecting for a portfolio demo; just know it's there.
- **Realtime features** (`StockEventsGateway`, `CustomerOrderEventsGateway`
  over Socket.IO) work fine on a single free instance — just don't scale to
  multiple instances without sticky sessions or a Redis adapter, which the
  free tier doesn't need anyway.

## 4. Frontend — Vercel

1. Import the `sakigai` Next.js project into Vercel from GitHub.
2. Set `NEXT_PUBLIC_API_URL` to `https://<your-render-url>/api/v1`.
3. Copy over the other `NEXT_PUBLIC_*` vars from the frontend's
   `.env.example` (brand name, phone/support placeholders, etc.) — these are
   just display strings, safe to leave as dummy values.
4. Set `NEXT_PUBLIC_SSLCOMMERZ_ENABLED=false` unless you've wired up sandbox
   SSLCommerz end-to-end.
5. Deploy. Vercel gives you a `*.vercel.app` URL immediately; a custom domain
   is optional.

## 5. Seed demo data

Before sending the link to anyone, seed the Neon database so the storefront
isn't empty:

```
DATABASE_URL="<neon-connection-string>" npx prisma db seed
```

Run this from your machine (or as a one-off Render shell command) after the
first deploy. Check `prisma/seed.ts` to see what it populates, and adjust the
admin user / sample products there if you want the demo to show your own
branding rather than defaults.

## 6. Smoke test checklist

- [ ] Storefront loads on the Vercel URL and product images render (Cloudinary)
- [ ] Can register/log in a customer account
- [ ] Can add to cart and place a test order (COD, since SSLCommerz is sandboxed)
- [ ] Admin can log in and see the order, and manually advance its status
- [ ] Invoice PDF download works (tests the Puppeteer path)
- [ ] CORS is happy — no console errors calling the Render API from the
      Vercel origin (`FRONTEND_URL` must match the Vercel URL exactly)
