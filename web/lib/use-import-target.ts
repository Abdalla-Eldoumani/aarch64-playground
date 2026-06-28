/**
 * Import-target routing. Decides where an `import` action lands based on
 * the active MultiFileTabs index.
 *
 * - activeFile === -1 -> main editor buffer
 * - activeFile >= 0   -> extras[activeFile]
 *
 * Pure function so it can be exercised without React state. Page-level
 * code calls it on every render and routes the import callback.
 */

export type ImportTarget =
  | { kind: "main" }
  | { kind: "extra"; index: number };

export function getImportTarget(activeFile: number): ImportTarget {
  if (activeFile === -1) return { kind: "main" };
  return { kind: "extra", index: activeFile };
}

export function describeTarget(target: ImportTarget, files: { name: string }[]): string {
  switch (target.kind) {
    case "main":
      return "main.asm";
    case "extra":
      return files[target.index]?.name ?? `extra ${target.index}`;
  }
}
