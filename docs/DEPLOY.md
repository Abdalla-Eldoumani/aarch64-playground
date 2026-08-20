# Deploying

The project deploys on Vercel. A single `vercel.json` at the repo root sets the framework, runs a build script that compiles the emulator to WASM, then runs `next build`.

## First-time setup

1. Push the repo to a git remote.
2. On Vercel, import the project. The framework preset is auto-detected from `"framework": "nextjs"` in `vercel.json`.
3. Leave the root directory blank; `vercel.json` handles paths.
4. No environment variables are required.
5. Deploy.

The first deploy is slower because rustup downloads the toolchain. Later deploys reuse Vercel's build cache for `~/.cargo` and `node_modules`.

## How the build works

[`scripts/vercel-build.sh`](../scripts/vercel-build.sh) is the `buildCommand`. It:

1. Installs rustup (minimal profile, stable toolchain) if `rustup` isn't on `PATH`, then sources `~/.cargo/env` when present.
2. Adds the `wasm32-unknown-unknown` target.
3. Runs `cargo install --locked wasm-pack` if wasm-pack is missing.
4. From `emulator/`, runs `wasm-pack build --target web --out-dir ../web/lib/wasm`.
5. From `web/`, runs `npm run build` (`next build --webpack`).

The `--webpack` flag is required: the `next.config` webpack hook (the `?raw` source-import rule) only applies under webpack, so the deploy must match local and CI. Output lands in `web/.next`, served by Vercel's Next.js runtime.

## Redirects

`vercel.json` carries one: a request whose host is the `vercel.app`
deployment domain gets a permanent (308) redirect to the same path on
`aarch64-playground.com`, so links, shares, and search results settle on one
origin.

## Headers

`vercel.json` sets:

- `Cache-Control: public, max-age=31536000, immutable` on `/_next/static/*`, `/icons/*`, and `*.wasm` (content-hashed or version-pinned).
- `Cache-Control: public, max-age=3600` on `/examples/*.s` and `/manifest.webmanifest`.
- `Cache-Control: public, max-age=0, must-revalidate` plus `Service-Worker-Allowed: /` on `/sw.js`, so service-worker updates land immediately.
- `Content-Type: application/wasm` on `.wasm`, and `text/plain; charset=utf-8` on `/examples/*.s`.
- Security headers on every route: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

The CSP is `default-src 'self'` with scripts from self plus Vercel analytics (the editor is vendored and served same-origin, so there is no third-party script CDN), workers from self and `blob:`, and no framing or objects. See [`security.md`](security.md) for the full policy and rationale; `proxy.ts` keeps the same headers in lockstep for `next start` and dev, and `web/proxy.test.ts` fails the suite if the two files drift.

## Troubleshooting

- **`command not found: rustup`**: the install step failed. Check the build log for the curl fetch, which needs outbound HTTPS.
- **`wasm-pack: command not found`**: `cargo install --locked wasm-pack` failed, usually a transient crates.io issue. Redeploy.
- **404 on `/_next/static/...wasm`**: Next.js didn't emit the WASM. Reproduce with `cd web && npm run build`, then look for `.wasm` under `web/.next/static/media/`. If missing, `web/lib/wasm/` wasn't in place before `next build` ran.
- **"loading emulator..." forever**: check the Network tab for the `.wasm` request. A 404 is the case above; a 200 that never finishes loading means a panic, so open the Console for the `console_error_panic_hook` trace.
- **Page shows a WASM load error**: confirm the response `Content-Type` with `curl -I https://<deploy>/path/to/bg.wasm`. It must be `application/wasm`, or the `vercel.json` header regex isn't matching.

## Dependency audit

Run `npm audit` from `web/` before a release and either clear what it reports or record the mitigation here. Most findings land in the dev toolchain and never reach a visitor; check the production tree specifically with `npm audit --omit=dev`. The DOMPurify chain that reaches in through monaco-editor is held at a fixed version by an `overrides` entry in `web/package.json`, so an advisory published after that pin still shows up in the report -- re-check the pin rather than assuming the entry cleared it.

## Alternative: commit the WASM

To avoid running Rust on Vercel, un-ignore `web/lib/wasm/` (remove the line from `.gitignore`), commit the built artifacts, and simplify `vercel.json` so the build step skips the Rust toolchain while keeping the same paths:

```json
{
  "framework": "nextjs",
  "outputDirectory": "web/.next",
  "installCommand": "npm install --no-audit --no-fund --ignore-scripts && cd web && npm ci",
  "buildCommand": "cd web && npx next build --webpack"
}
```

The tradeoff: every emulator change must be rebuilt and committed by hand. The default (rebuild from source on each deploy) catches drift automatically.
