import type { Response } from 'express';

// How long a shared cache (Cloudflare, once a Cache Rule is enabled for these
// paths) may serve a public storefront response without asking the backend.
export const PUBLIC_EDGE_CACHE_SECONDS = 60;

/**
 * Marks a response as public: identical for every caller, safe to share.
 *
 * Call it only AFTER the data has been loaded, so an error response never
 * goes out with these headers (Nest's @Header() is applied before the
 * handler runs, which is why it isn't used here), and only for responses
 * that don't depend on who is asking.
 *
 * - Cache-Control: browsers revalidate every time (max-age=0; the ETag makes
 *   that a cheap 304), so shoppers and admins see an edit on their next load.
 *   Shared caches may keep it for s-maxage seconds.
 * - CORS: swaps the per-origin Access-Control-Allow-Origin set by
 *   app.enableCors() for `*` and drops Allow-Credentials. Cloudflare ignores
 *   `Vary: Origin`, so a per-origin copy cached at the edge would be served
 *   to the other origin (www vs apex), and a copy cached from a request with
 *   no Origin (a crawler, curl) would have no CORS header at all — either way
 *   browsers would reject it until it expired. The data is public anyway; `*`
 *   only refuses credentialed requests, and the storefront reads these with
 *   axiosPublic, which sends none. Keep it that way: calling one of these
 *   endpoints with axiosSecure (withCredentials) would fail CORS.
 */
export function markPublicCacheable(res: Response): void {
  if (res.headersSent) return;
  res.setHeader(
    'Cache-Control',
    `public, max-age=0, s-maxage=${PUBLIC_EDGE_CACHE_SECONDS}`,
  );
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.removeHeader('Access-Control-Allow-Credentials');
}
