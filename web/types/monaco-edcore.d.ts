// Ambient declaration for monaco's editor-only entry. `edcore.main.js` is the
// code editor with every widget and none of the bundled language services,
// which is what the playground vendors (it registers arm64 itself), but the
// package ships no declaration file for that path, only for the everything
// entry. Its runtime exports are exactly the public editor API, so point the
// path at the API types the rest of the app already types against; this is
// also the type @monaco-editor/react's loader expects.
declare module "monaco-editor/esm/vs/editor/edcore.main.js" {
  export * from "monaco-editor/esm/vs/editor/editor.api";
}
