"use client";

import { useCallback, useRef } from "react";
import type { HandoffPayload } from "@/lib/playground/playground-handoff";
import type { useLaunchMode } from "@/lib/playground/use-launch-mode";
import { describeTarget, type ImportTarget } from "@/lib/hooks/use-import-target";
import { definesMain } from "@/lib/playground/file-map";
import type { FullChromeSurfaceProps } from "@/components/playground/FullChromeSurface";
import type { useToast } from "@/components/ui/Toast";

/** What a new tab starts with. */
export const fileStub = (name: string) => `// ${name}\n`;

// An import, unlike a program load, keeps no copy in recents of what it
// writes over, so it asks before replacing code that differs from the file
// coming in, in main.asm or in any helper tab. A tab still holding its new
// stub (`name`) has nothing to lose.
function importReplaces(current: string | undefined, incoming: string, name?: string): boolean {
  return (
    current !== undefined &&
    current.trim() !== "" &&
    current !== incoming &&
    (name === undefined || current !== fileStub(name))
  );
}

function confirmImport(what: string, replaced: string[], edited: boolean): boolean {
  return (
    replaced.length === 0 ||
    window.confirm(
      `Import ${what}? It replaces the code in ${replaced.join(", ")}${edited ? ", including your edits" : ""}.`,
    )
  );
}

/** Import and program loads into the workspace, asking before either
 *  replaces code the student wrote. */
export function useWorkspaceImport({
  source,
  setSource,
  extraFiles,
  setExtraFiles,
  toast,
  resetLaunch,
  loadProgram,
}: Pick<FullChromeSurfaceProps, "source" | "setSource" | "extraFiles" | "setExtraFiles" | "loadProgram"> & {
  toast: ReturnType<typeof useToast>;
  resetLaunch: ReturnType<typeof useLaunchMode>["reset"];
}) {
  // The main buffer as the last program load or import left it: anything
  // else in there is the student's own edit.
  const loadedSourceRef = useRef(source);
  // The helper tabs as the last load or import left them, by name.
  const loadedFilesRef = useRef(new Map(extraFiles.map((f) => [f.name, f.body])));
  // Whether a buffer holds anything the student typed since it was loaded.
  const isEdited = useCallback(
    (name: string, body: string) =>
      body !== (name === "main.asm" ? loadedSourceRef.current : loadedFilesRef.current.get(name)),
    [],
  );

  const handleImport = useCallback(
    (target: ImportTarget, body: string) => {
      const tab = target.kind === "extra" ? extraFiles[target.index] : undefined;
      const current = target.kind === "main" ? source : tab?.body;
      const name = describeTarget(target, extraFiles);
      const replaced = importReplaces(current, body, tab?.name) ? [name] : [];
      if (!confirmImport("this file", replaced, isEdited(name, current ?? ""))) return;
      resetLaunch();
      switch (target.kind) {
        case "main":
          setSource(body);
          loadedSourceRef.current = body;
          toast.show("imported into main.asm");
          return;
        case "extra": {
          const idx = target.index;
          loadedFilesRef.current.set(name, body);
          setExtraFiles(
            extraFiles.map((f, i) => (i === idx ? { ...f, body } : f)),
          );
          toast.show(`imported into ${name}`);
          return;
        }
      }
    },
    [source, extraFiles, setExtraFiles, setSource, toast, resetLaunch, isEdited],
  );

  // Multi-select import: the program replaces the main buffer; every other
  // file becomes (or refreshes) a named tab, so a whole multi-file program
  // lands in one gesture. The program is a file named main.asm / main.s, or
  // else the first that defines main, since a student's files are never
  // called main.
  const handleImportMany = useCallback(
    (files: { name: string; body: string }[]) => {
      let mainIdx = files.findIndex((f) => /^main\.(asm|s)$/i.test(f.name));
      if (mainIdx < 0) mainIdx = files.findIndex((f) => definesMain(f.body));
      const currentOf = (name: string) =>
        name === "main.asm" ? source : extraFiles.find((x) => x.name === name)?.body;
      const replaced = files.flatMap((f, i) => {
        const name = i === mainIdx ? "main.asm" : f.name;
        return importReplaces(currentOf(name), f.body, i === mainIdx ? undefined : f.name)
          ? [name]
          : [];
      });
      const edited = replaced.some((name) => isEdited(name, currentOf(name) ?? ""));
      const what = files.length === 1 ? files[0].name : `${files.length} files`;
      if (!confirmImport(what, replaced, edited)) return;
      resetLaunch();
      if (mainIdx >= 0) {
        setSource(files[mainIdx].body);
        loadedSourceRef.current = files[mainIdx].body;
      }
      const rest = files.filter((_, i) => i !== mainIdx);
      const next = [...extraFiles];
      for (const f of rest) {
        loadedFilesRef.current.set(f.name, f.body);
        const at = next.findIndex((x) => x.name === f.name);
        if (at >= 0) next[at] = { name: f.name, body: f.body };
        else next.push({ name: f.name, body: f.body });
      }
      setExtraFiles(next);
      toast.show(`imported ${what}`);
    },
    [source, extraFiles, setExtraFiles, setSource, toast, resetLaunch, isEdited],
  );

  // A load replacing edits made since the last load or import asks first.
  // The replaced text also goes to recents, so the question is only about
  // work the student may not know is kept there; an untouched example is
  // swapped without asking.
  const loadProgramWithConfirm = useCallback(
    (payload: HandoffPayload) => {
      const edited = source.trim() !== "" && source !== loadedSourceRef.current;
      if (
        edited &&
        source !== payload.source &&
        !window.confirm(
          `Load ${payload.label ?? "this program"}? It replaces your edits in main.asm. The current code stays under "recent" if you want it back.`,
        )
      ) {
        return;
      }
      loadProgram(payload);
    },
    [source, loadProgram],
  );
  return { loadedSourceRef, loadedFilesRef, handleImport, handleImportMany, loadProgramWithConfirm };
}
