# Partner Inventory API — Integration Guide

A read-only feed of current stock levels for approved third-party systems (ERP, POS, marketplace sync). No order, customer, or pricing-management data is exposed.

## 1. Getting a key

An admin creates a key for you from the admin panel (or `POST /api/v1/api-clients`). You'll receive an API key **once** — save it immediately, it can't be viewed again. If it's lost, ask the admin to revoke it and issue a new one.

## 2. Authenticating

Send your key on every request as a header:

```
X-Api-Key: <your-api-key>
```

No login, no tokens to refresh — the key works until it's revoked or expires.

## 3. Endpoints

Base URL: `https://<your-domain>/api/v1/partner/inventory`

| Method | Path | What it returns |
|---|---|---|
| GET | `/` | List of stock items (paginated) |
| GET | `/low-stock` | Only items at or below their low-stock threshold |
| GET | `/{id}` | One item by its id |

**Query parameters** (all optional, on `/` and `/low-stock`):

| Param | Meaning |
|---|---|
| `limit` | Page size, 1–200 (default 50) |
| `cursor` | Continue from the last page's `nextCursor` |
| `updatedSince` | ISO date — only items changed since then (for syncing) |
| `sku` | Filter to one exact SKU |

## 4. Example

```
curl https://your-domain/api/v1/partner/inventory?limit=2 \
  -H "X-Api-Key: <your-api-key>"
```

```json
{
  "data": [
    {
      "id": 4821,
      "sku": "SF-SOFA-CHR-3S",
      "productTitle": "Chairo 3-Seater Sofa",
      "productSlug": "chairo-3-seater-sofa",
      "size": "3-Seater",
      "color": "Charcoal",
      "quantity": 14,
      "lowStockAt": 5,
      "isLowStock": false,
      "updatedAt": "2026-08-17T09:31:04.000Z"
    }
  ],
  "meta": { "nextCursor": "4821", "count": 1 }
}
```

To get the next page, call again with `?cursor=4821`. When `nextCursor` is `null`, you're on the last page.

## 5. Limits

- **60 requests/minute** per key by default (raise this by asking the admin — it's per-key, not shared).
- Every response includes `X-RateLimit-Limit` / `X-RateLimit-Remaining` so you can watch your usage.
- Going over the limit returns `429` with a `Retry-After` header telling you how many seconds to wait.

## 6. Errors

Every error looks the same, so your code only needs to check one shape:

```json
{ "error": { "code": "NOT_FOUND", "message": "..." } }
```

| Status | Code | Meaning |
|---|---|---|
| 401 | `INVALID_API_KEY` | Key missing or wrong |
| 403 | `FORBIDDEN` | Key is revoked/expired, or not scoped for this data |
| 404 | `NOT_FOUND` | That id doesn't exist |
| 400 | `VALIDATION_ERROR` | Bad query parameter (message says which) |
| 429 | `RATE_LIMITED` | Too many requests — wait and retry |

## 7. Notes

- This is **read-only** — there is no way to change stock through this API.
- `/v1` in the URL won't change behavior under you. If we ever need a breaking change, it will be a new `/v2`, and `/v1` will keep working.
- Full interactive docs: `/docs/partner`
