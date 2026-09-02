import { NextResponse, type NextRequest } from "next/server";

/**
 * Apply security headers in code so they work for `next start` and dev,
 * not just on Vercel's edge. vercel.json carries the same set as a
 * deploy-time guarantee; this proxy is the framework-level one.
 *
 * Keep in lockstep with vercel.json: both carry what docs/security.md
 * promises. proxy.test.ts asserts the two sets match, so a drift fails the
 * suite instead of shipping. The old-host redirect lives only in vercel.json:
 * the platform resolves redirects before this proxy runs, and localhost never
 * wears the old host.
 *
 * Exported for that parity test alone; nothing else may import it.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy":
    "default-src 'self'; " +
    // 'unsafe-eval' is only needed by the Next.js dev runtime (React Refresh
    // evaluates modules with eval). Production must never ship it, because it
    // reopens the eval-based XSS the CSP exists to close, so it is gated to
    // development. vercel.json carries the production policy without it.
    "script-src 'self' " +
    (process.env.NODE_ENV === "development" ? "'unsafe-eval' " : "") +
    "'wasm-unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "font-src 'self' data:; " +
    "img-src 'self' data: blob:; " +
    "connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com; " +
    "worker-src 'self' blob:; " +
    "child-src 'self' blob:; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "object-src 'none'; " +
    "manifest-src 'self'; " +
    "upgrade-insecure-requests",
};

export function proxy(_req: NextRequest) {
  const res = NextResponse.next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(name, value);
  }
  return res;
}

export const config = {
  // Apply to every route except Next's internal asset paths and the
  // PWA manifest / service worker / icons (those have their own
  // cache headers and don't need CSP).
  matcher: [
    "/((?!_next/static|_next/image|sw\\.js|manifest\\.webmanifest|icons/).*)",
  ],
};
