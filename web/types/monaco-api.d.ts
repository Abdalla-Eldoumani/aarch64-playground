// Ambient declaration for the deep path @monaco-editor/react and its loader
// still type against. monaco-editor 0.56 added an `exports` map that rewrites
// every subpath into the esm tree ("./*" -> "./esm/vs/*.js"), so the old
// "monaco-editor/esm/vs/..." spelling now resolves to esm/vs/esm/vs/... and
// finds nothing. TypeScript answers an unresolvable import with `any` and no
// build error, so every monaco call the editor makes through OnMount would
// go unchecked without a word of warning. Pointing the stale path at the
// entry that replaced it keeps the API typed until those two packages ship
// the new spelling.
declare module "monaco-editor/esm/vs/editor/editor.api" {
  export * from "monaco-editor/editor";
}
