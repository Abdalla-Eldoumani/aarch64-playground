# Deploying

The project is set up to deploy on Vercel. One `vercel.json` at the repo root pins the framework, points at a build script that compiles the emulator crate to WASM, then hands off to `next build`.

## First-time setup

1. Push the repo to a git remote.
2. On Vercel, **import project** and point at the remote. Leave the framework preset as auto-detected (it'll pick up `"framework": "nextjs"` from `vercel.json`).
3. **Root directory**: leave blank. The `vercel.json` at the repo root handles everything.
4. **Environment variables**: none required.
5. Deploy.

The build takes ~3 minutes end-to-end -- most of that is rustup downloading the toolchain on first install. Subsequent deploys reuse Vercel's build cache for `~/.cargo` and `node_modules`, so they finish in under a minute.

## How the build works

[`scripts/vercel-build.sh`](../scripts/vercel-build.sh) is the buildCommand entrypoint. It:

1. Installs `rustup` with a minimal profile if it isn't already present.
2. Adds the `wasm32-unknown-unknown` target.
3. `cargo install --locked wasm-pack` if not already present.
4. `wasm-pack build --target web --out-dir ../web/lib/wasm` from `emulator/`.
5. `npx next build` from `web/`.

Output goes to `web/.next` and is served by Vercel's Next.js runtime.

## Headers

`vercel.json` sets:

- `Cache-Control: public, max-age=31536000, immutable` on `/_next/static/*` and `*.wasm` -- these are content-hashed, safe to cache forever.
- `Cache-Control: public, max-age=3600` on `/examples/*.s` -- example programs rotate occasionally.
- `Content-Type: application/wasm` on `.wasm` -- Vercel already sets this, but we're explicit so nothing downstream can override it.
- `Content-Type: text/plain; charset=utf-8` on `/examples/*.s` -- browsers default to `application/octet-stream` which makes `fetch().text()` work but feels wrong.
- Standard security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.

## Troubleshooting

**`error: command not found: rustup`** during build -- the install step in `scripts/vercel-build.sh` failed. Check the build log for the curl fetch; it needs outbound HTTPS.

**`wasm-pack: command not found`** -- `cargo install --locked wasm-pack` failed. Look for a `cargo` error earlier in the log. Usually a transient network issue with crates.io; redeploy.

**404 on `/_next/static/...wasm`** -- Next.js didn't emit the WASM into its static output. Verify locally: `cd web && npx next build` then look for `.wasm` files under `web/.next/static/media/`. If they're missing, your `web/lib/wasm/` output wasn't in place when `next build` ran -- check `scripts/vercel-build.sh`.

**"loading emulator..." forever in the deployed app** -- open the browser devtools Network tab and look for the `.wasm` request. If it's a 404, see above. If it's 200 but the status stays on "loading", check the Console tab for a panic message from `console_error_panic_hook`. The panic-hook output gives a readable stack trace.

**Deploy succeeds but the page shows the WASM load error** -- the `Content-Type` on the WASM response might be wrong. `curl -I https://your-deploy.vercel.app/path/to/bg.wasm` and confirm you see `Content-Type: application/wasm`. If not, the `vercel.json` regex isn't matching; double-check the header block.

## npm audit status

`npm audit` reports four high-severity advisories that we intentionally do not patch, all against the pinned Next.js 14.2 line:

- **[GHSA-9g9p-9gw9-jx7f](https://github.com/advisories/GHSA-9g9p-9gw9-jx7f)** — DoS via `next/image` `remotePatterns`. We don't use `next/image`.
- **[GHSA-h25m-26qc-wcjf](https://github.com/advisories/GHSA-h25m-26qc-wcjf)** — HTTP request deserialization in insecure React Server Components. No RSC data flow; page is fully static.
- **[GHSA-ggv3-7p47-pfv8](https://github.com/advisories/GHSA-ggv3-7p47-pfv8)** — HTTP request smuggling in `rewrites`. No `rewrites` are configured.
- **[GHSA-3x4c-7xq6-9pq8](https://github.com/advisories/GHSA-3x4c-7xq6-9pq8)** — Unbounded `next/image` disk cache. Same as the first, we don't use `next/image`.
- **[GHSA-q4gf-8mx6-v5v3](https://github.com/advisories/GHSA-q4gf-8mx6-v5v3)** — DoS with Server Components. Same reason.

Plus **[GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2)** — command injection in the `glob` CLI, pulled transitively by `eslint-config-next`. We only use `glob` as a library; the vulnerable `-c/--cmd` flag is never invoked.

Fixing any of them requires upgrading to Next.js 15 or 16, which is a non-trivial migration. Revisit when we're ready to move off 14. The moderate-severity DOMPurify advisories are patched via an `overrides` entry in `web/package.json`.

## Alternative: pre-building the WASM

If you'd rather not run Rust on Vercel's build image, you can un-ignore `web/lib/wasm/` in the repo (remove that line from `.gitignore`), commit the built artifacts, and simplify `vercel.json` to:

```json
{
  "framework": "nextjs",
  "rootDirectory": "web",
  "installCommand": "npm ci",
  "buildCommand": "next build"
}
```

The tradeoff is that every emulator change has to be rebuilt and committed manually. The default setup (rebuild from source on each deploy) catches drift automatically.
