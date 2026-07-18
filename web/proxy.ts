import { NextResponse, type NextRequest } from "next/server";

/**
 * Apply security headers in code so they work for `next start` and dev,
 * not just on Vercel's edge. vercel.json carries the same set as a
 * deploy-time guarantee; this proxy is the framework-level one.
 *
 * Keep in lockstep with vercel.json -- both should reject anything we
 * promise in docs/security.md.
 */
const SECURITY_HEADERS: Record<string, string> = {
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
    // evaluates modules with eval). Production must never ship it -- it would
    // reopen the eval-based XSS the CSP exists to close -- so it is gated to
    // development. vercel.json carries the production policy without it.
    "script-src 'self' " +
    (process.env.NODE_ENV === "development" ? "'unsafe-eval' " : "") +
    "'wasm-unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://va.vercel-scripts.com; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "font-src 'self' data:; " +
    "img-src 'self' data: blob:; " +
    "connect-src 'self' https://cdn.jsdelivr.net https://vitals.vercel-insights.com https://va.vercel-scripts.com; " +
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
