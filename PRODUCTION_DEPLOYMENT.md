# Deploying this project professionally (real production)

This is the "real customers, real money" version of [DEPLOYMENT.md](DEPLOYMENT.md).
Differences from the portfolio setup: paid/always-on infra, real payment +
courier credentials, backups, monitoring, CI/CD, and a few code-level
hardening changes called out below (not yet made — flagged so you can decide,
not applied automatically).

## 0. Architecture decision

Two viable paths. Pick one before starting:

| | **Managed PaaS** (recommended default) | **VPS + Docker** |
|---|---|---|
| Backend | Render (Standard plan, ~$25/mo) or Railway | Any VPS (DigitalOcean, Hetzner) running Docker Compose behind Nginx |
| Ops burden | Low — platform handles TLS, restarts, scaling knobs | Higher — you own the OS, Nginx config, cert renewal, log rotation |
| When to pick | Default choice for a small-to-mid e-commerce site with 1-2 engineers | You need cost control at scale, or specific compliance/networking control |

The rest of this guide assumes the **managed PaaS path** (Render), since it's
the natural upgrade from the portfolio setup you already have. Where it
matters, VPS-equivalent notes are added inline.

## 1. Domain, DNS, TLS

1. Buy a domain (Namecheap, Cloudflare Registrar, etc.).
2. Put DNS on Cloudflare (free) for DDoS protection and easy record
   management, even if hosting elsewhere.
3. `api.yourdomain.com` → Render backend service, `yourdomain.com` /
   `www` → Vercel frontend. Both platforms auto-provision TLS certs once DNS
   points at them — no manual Let's Encrypt setup needed on this path.

## 2. Database — managed Postgres with backups

Free-tier Neon (used for the portfolio) is fine to start, but for production
confirm/upgrade to a plan with:
- **Automated daily backups** with a retention window (Neon Pro, RDS, or
  DigitalOcean Managed Postgres all do this).
- **Connection pooling** — Prisma + serverless-style platforms exhaust direct
  Postgres connections fast. Use the provider's pooled connection string
  (Neon gives you one automatically; PgBouncer if self-hosting).
- Note the **region** — colocate DB and backend region to cut latency (e.g.
  both in Singapore if your customers are in Bangladesh).

**Test the restore, not just the backup.** A backup you've never restored is
a hope, not a plan — do one dry-run restore to a scratch DB now, before you
need it for real.

## 3. Redis — managed, persistent

Same idea: Upstash's paid tier (or DigitalOcean/AWS ElastiCache) with
persistence enabled. Bull queues and the partner-API rate limiter both
depend on Redis staying up — an ephemeral/free instance that evicts data
under memory pressure will silently drop queued jobs.

## 4. Backend — Render Standard plan

Upgrade the free service from [render.yaml](render.yaml) to a paid plan:
- Eliminates the 15-min idle spin-down (real customers shouldn't eat a
  60s cold start).
- More RAM headroom for the Puppeteer PDF path (`order.service.ts` →
  `renderPdf`) — under the free tier's 512MB this is the first thing that
  falls over under concurrent invoice downloads.
- Consider splitting the **Bull queue processor** into its own Render
  **background worker** service once job volume grows, so a slow PDF render
  or notification job can't starve the web process handling HTTP requests.
  Not needed on day one; needed once you notice request latency spiking
  during bursts of order activity.

## 5. Frontend — Vercel Pro (optional) or stay on Hobby

Vercel's free Hobby tier is usable in production for a small store, but its
license technically restricts Hobby to non-commercial use — for a real
storefront, Vercel Pro (~$20/mo) is the compliant + supported choice, and
adds team access control and better analytics.

## 6. Real integrations — swap sandbox for live credentials

Go through each one deliberately, not all at once:

- **SSLCommerz**: get your live merchant `STORE_ID`/`STORE_PASSWORD` from
  SSLCommerz after their merchant verification process, set
  `SSLCOMMERZ_IS_LIVE=true`. Test a real small-value transaction end-to-end
  before announcing launch.
- **Pathao / RedX / Paperfly**: real merchant accounts + webhook secrets.
  Set `MANUAL_ORDER_STATUS_UPDATE=false` once webhooks are confirmed
  reliably updating order status — leaving it `true` in production means
  status can drift from what the courier actually did if an admin forgets
  to update it.
- **Email**: verify your sending domain (SPF, DKIM, DMARC records) with
  whichever provider (Resend or SMTP) — unverified domains land in spam,
  which for order confirmations is a real support-ticket generator.
- **SMS (MimSMS)**: real API key, and check their rate limits against your
  expected order volume.

## 7. Security hardening (code-level — not yet applied)

A few things in the current code are fine for a demo but worth tightening
before real traffic. Flagging rather than changing, since these are judgment
calls:

- **`app.enableCors({ origin: true, credentials: true })`** in
  [src/main.ts](src/main.ts) reflects *any* origin. For production, restrict
  it to `process.env.FRONTEND_URL` (and any admin dashboard origin) —
  `origin: true` + `credentials: true` means any website can make
  credentialed requests to your API on a visitor's behalf.
- **No global rate limiting** — `ApiRateLimitGuard` only covers the partner
  API. Public-facing auth/checkout endpoints have no throttle, which is an
  open door for credential-stuffing or checkout abuse. `@nestjs/throttler`
  is a small addition.
- **JWT secret rotation** — confirm `JWT_SECRET` (wherever it's configured)
  is a long random value distinct from anything used in dev/staging, and
  is only ever set via the platform's secret manager, never in a file.
- **Admin account**: consider requiring a strong password policy + optional
  2FA for admin login given it controls order status, refunds, and coupons.
- **Dependency scanning**: turn on GitHub Dependabot (free) for automated
  vulnerability alerts on `package-lock.json`.

## 8. CI/CD

Add a GitHub Actions workflow so `main` never reaches production untested:

```
on: pull_request → run `npm ci`, `npm run lint`, `npm test`, `tsc --noEmit`
on: push to main → same checks, then Render auto-deploys via its GitHub integration
```

Add a **staging environment** — a second Render service + a second Neon
branch/database — so schema migrations and integration changes (courier
webhooks especially) get exercised somewhere that isn't production first.
Neon's branching feature is well suited to this: branch prod data into a
staging DB cheaply.

## 9. Observability

- **Error tracking**: Sentry (free tier is enough to start) wired into both
  the NestJS backend and the Next.js frontend — you want to know about a
  failed checkout before a customer emails you about it.
- **Uptime monitoring**: UptimeRobot or Better Stack pinging
  `GET /api/v1` every few minutes, alerting to email/Slack on downtime.
- **Logs**: Render's built-in log stream is enough at this scale; pipe to
  a log drain (Logtail/Axiom) once you need retention beyond Render's
  default window.

## 10. Zero-downtime migrations

`start:prod` already runs `prisma migrate deploy` before boot, which is
correct for this scale. The one discipline to keep: **never write a
migration that both drops/renames a column and ships in the same deploy as
code that stops reading it** — split into two deploys (add new column, dual
-write/read, backfill, then drop old column) once the schema has real data
you can't afford to lose mid-deploy.

## 11. Launch checklist

- [ ] DNS + TLS live on both `api.` and root domain
- [ ] DB backups confirmed automated + one restore tested
- [ ] Redis persistence on, not the free ephemeral tier
- [ ] CORS restricted to real frontend origin
- [ ] Live SSLCommerz transaction tested end-to-end (and refunded)
- [ ] Courier webhook received and order status updated automatically
- [ ] Order confirmation email lands in inbox, not spam (SPF/DKIM/DMARC set)
- [ ] Sentry catching errors from a deliberate test throw
- [ ] Uptime monitor configured and alerting to somewhere you'll see it
- [ ] Staging environment exists and the last deploy went through it first
