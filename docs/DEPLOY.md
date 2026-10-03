# Deploying

The site deploys on Vercel. `vercel.json` at the repository root names the
framework, the install and build commands, and the output folder
(`web/.next`), so the Vercel project needs no other settings.

## First deploy

1. On Vercel, import the repository. Leave the root directory blank.
2. Add no environment variables; the site needs none.
3. Deploy. The first build is slow because it installs the Rust toolchain.
   Later builds reuse Vercel's cache.

## What the build does

The install command installs the root `package.json` (which exists only so
Vercel detects Next.js) and then runs `npm ci` in `web/`. The build command is
[`scripts/vercel-build.sh`](../scripts/vercel-build.sh). It:

1. Installs rustup if it is missing, then the Rust toolchain pinned at the top
   of the script, with the `wasm32-unknown-unknown` target. The pin means
   production is built by the same compiler the release was tested with, so
   change it only together with a full rebuild and test run.
2. Installs the pinned wasm-pack unless that exact version is already there.
3. Builds the emulator twice from `emulator/`: `--target web` into
   `web/lib/wasm/` for the site, and `--target nodejs` into
   `web/lib/wasm-node/`. The second copy never ships, but `next build`
   type-checks the test files, and some of them import it.
4. Picks one build id, `PLAYGROUND_BUILD_ID`, and exports it, so both builds
   in the next steps share it. An id containing "ad" is drawn again, because
   ad blockers block file names that contain it.
5. Runs `npm run build` in `web/`, which is `next build --webpack` followed by
   `scripts/write-precache-list.js`. That script writes `web/public/sw.js`, the
   service worker with this build's file list. The `--webpack` flag matters:
   the emulator loads through webpack's `asyncWebAssembly`, and the
   playground's default program is a `?raw` import that only a webpack rule in
   `web/next.config.mjs` can read.
6. Runs `next build --webpack` a second time. Vercel collects `web/public/`
   during the build, so the worker the first build wrote after it finished
   would never ship. The second build has the same id, so it produces the same
   files and ships that worker.
7. Runs `node ../scripts/write-precache-list.js --check`, which fails the
   deploy if the worker's file list does not match the files the second build
   made.

CI pins the same Rust and wasm-pack versions (`.github/workflows/check.yml`),
so a pull request tests the compiler that ships.

## Addresses

`vercel.json` sends every request to one of Vercel's production addresses
(`aarch64-playground.vercel.app` and the project's two team aliases) to the
same path on `aarch64-playground.com` with a permanent redirect, so links and
search results settle on one address. `www` redirects to the bare domain in
Vercel's domain settings.

## Headers

`vercel.json` gives content-hashed files (`/_next/static/`, `/icons/`, `.wasm`)
a one-year immutable cache and the example programs and the manifest one hour.
Browsers check `/sw.js` again on every load, and each build writes its file
list into it, so a new service worker installs on a student's next visit and
takes over once their open tabs of the old build are closed. It
also serves `.wasm` as `application/wasm`. The security headers, and why each
one is there, are in [security.md](security.md).

## The star count

The GitHub star count in the site's menu is read once per build, so every page
stays a static file. `.github/workflows/refresh-stars.yml` starts a new
production build through a Vercel deploy hook each time the repository gets a
star, and weekly to catch removed stars. The hook's address is a repository
secret named `VERCEL_DEPLOY_HOOK_URL`; without it the workflow fails and the
count stays as it was.

## When a deploy goes wrong

- **`rustup: command not found`** or **`wasm-pack: command not found`**: an
  install step failed. Read the build log; a failed download usually works on
  a redeploy.
- **The playground says "failed to load emulator"**: open the browser's
  network tab and find the `.wasm` request. A 404 means the build ran before
  `web/lib/wasm/` existed; run `npm run build` in `web/` locally and look for a
  `.wasm` file under `web/.next/static/media/`. A response whose type is not
  `application/wasm` means the `vercel.json` header rule did not match.

## Releasing

A release is its own pull request that bumps every version together:
`web/package.json` and `web/package-lock.json`, the root `package.json`,
`emulator/Cargo.toml` with `emulator/Cargo.lock`, and `CITATION.cff`
(`version` and `date-released`). Before it, run the dependency audit on what
ships, from the repository root:

```bash
node scripts/audit-deps.js --omit=dev
```

It fails on any advisory of moderate severity or higher; CI runs the same
check on every pull request. After the merge, tag the commit `v<version>` and
publish the GitHub release.
