// The security headers docs/security.md promises. Declared here, the
// framework applies them under `next dev` and `next start`, and on Vercel
// they compile into the routes manifest and are attached by the platform with
// no function in the path. A proxy.ts used to set the same headers, but on
// Vercel a proxy runs as a Node function in front of every page request, which
// put a function invocation on every visit to a fully static site.
// vercel.json carries the identical set as the deploy-time copy;
// next.config.test.ts fails the suite if the two drift.
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy":
    "default-src 'self'; " +
    // 'unsafe-eval' is only needed by the Next.js dev runtime (React Refresh
    // evaluates modules with eval). Production must never ship it, because it
    // reopens the eval-based XSS the CSP exists to close, so it is gated on
    // NODE_ENV at the moment this config is evaluated: "development" under
    // `next dev`, "production" under `next build` and `next start`.
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  headers() {
    return [
      {
        // Every route except Next's own static assets and the PWA manifest,
        // service worker, and icons, which carry their own cache headers and
        // need no CSP.
        source:
          "/:path((?!_next/static|_next/image|sw\\.js|manifest\\.webmanifest|icons/).*)",
        headers: Object.entries(SECURITY_HEADERS).map(([key, value]) => ({
          key,
          value,
        })),
      },
    ];
  },
  // webpack handles our wasm module via `asyncWebAssembly`. Next 16 defaults
  // to Turbopack; the npm `dev`/`build` scripts pass `--webpack` explicitly
  // to opt back in until Turbopack's async-wasm support is stable for us.
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    // `?raw` imports load a file's contents as a string at build time, so
    // the cold-load default program can be sourced from the single
    // basics.s fixture instead of a duplicated literal.
    config.module.rules.push({ resourceQuery: /raw/, type: "asset/source" });
    // xterm's runtime is one 330 kB module, so Next's own splitting names its
    // chunk after a hash of its path, which moves with the package layout and
    // takes any bundle budget aimed at that hash with it. Naming the group
    // makes the runtime globbable by name, the way the monaco lane already
    // is. Async only: xterm never reaches an initial chunk.
    const groups = config.optimization?.splitChunks?.cacheGroups;
    if (groups) {
      groups.xterm = {
        test: /[\\/]node_modules[\\/]@xterm[\\/]/,
        name: "xterm",
        chunks: "async",
        priority: 40,
        reuseExistingChunk: true,
      };
    }
    return config;
  },
  // Silence the "multiple lockfiles" warning by pinning the turbopack root
  // to this directory. Applies even under the webpack build because Next 16
  // uses Turbopack's workspace detector for tracing either way.
  turbopack: {
    root: import.meta.dirname,
  },
};
export default nextConfig;
