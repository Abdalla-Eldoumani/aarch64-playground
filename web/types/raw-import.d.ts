// Ambient declaration for `?raw` imports: load a file's contents as a
// string at build time. Vitest (Vite) supports this natively; the webpack
// build wires it via an `asset/source` rule in next.config.mjs. Used so the
// cold-load default program is the single fixture-tested basics.s rather
// than a duplicated string literal.
declare module "*?raw" {
  const content: string;
  export default content;
}
