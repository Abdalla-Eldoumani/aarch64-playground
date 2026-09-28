// @monaco-editor/react and its loader still type against this old deep path,
// which the `exports` map in monaco-editor 0.56 no longer resolves. TypeScript
// would quietly type it as `any`, leaving every editor call unchecked, so the
// old path points at its replacement until both packages stop using it.
declare module "monaco-editor/esm/vs/editor/editor.api" {
  export * from "monaco-editor/editor";
}
