/**
 * Import-target routing. Decides where an `import` action lands based on
 * the current view and the active MultiFileTabs index.
 *
 * - playground + activeFile === -1 -> main editor buffer
 * - playground + activeFile >= 0   -> extras[activeFile]
 * - c-to-asm view                  -> the c-to-asm pane (subview chooses
 *                                     left "c" pane vs right "asm" pane)
 *
 * Pure function so it can be exercised without React state. Page-level
 * code calls it on every render and routes the import callback.
 */

export type View = "playground" | "c-to-asm";
export type CtoAsmSubview = "c" | "asm";

export type ImportTarget =
  | { kind: "main" }
  | { kind: "extra"; index: number }
  | { kind: "c-to-asm"; subview: CtoAsmSubview };

export function getImportTarget(
  view: View,
  activeFile: number,
  subview: CtoAsmSubview = "asm",
): ImportTarget {
  if (view === "c-to-asm") return { kind: "c-to-asm", subview };
  if (activeFile === -1) return { kind: "main" };
  return { kind: "extra", index: activeFile };
}

export function describeTarget(target: ImportTarget, files: { name: string }[]): string {
  switch (target.kind) {
    case "main":
      return "main.asm";
    case "extra":
      return files[target.index]?.name ?? `extra ${target.index}`;
    case "c-to-asm":
      return target.subview === "c" ? "c source" : "asm output";
  }
}
