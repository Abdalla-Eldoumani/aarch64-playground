/** @type {import('next').NextConfig} */
const nextConfig = {
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
