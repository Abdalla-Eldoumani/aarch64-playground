import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    ignores: ["lib/wasm/**", "lib/wasm-node/**"],
  },
];

export default config;
