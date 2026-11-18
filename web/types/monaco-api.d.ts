// @monaco-editor/react and its loader still type against this old deep path,
// which the `exports` map in monaco-editor 0.56 no longer resolves. TypeScript
// would quietly type it as `any`, leaving every editor call unchecked, so the
// old path points at its replacement until both packages stop using it.
declare module "monaco-editor/esm/vs/editor/editor.api" {
  export * from "monaco-editor/editor";
}

// Monaco's colour registry has no public API and ships no types. The editor
// reads the id of every colour Monaco registers from it, and only that.
declare module "monaco-editor/platform/registry/common/platform" {
  export const Registry: { as(id: string): { getColors(): { id: string }[] } };
}
declare module "monaco-editor/platform/theme/common/colorUtils" {
  export const Extensions: { ColorContribution: string };
}

// The suggestion list's controller ships no types either. It registers itself
// on import, and the editor reads nothing from it.
declare module "monaco-editor/editor/contrib/suggest/browser/suggestController" {}
