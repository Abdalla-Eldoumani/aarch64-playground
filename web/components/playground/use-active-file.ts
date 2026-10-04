"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  breakpointsForFile,
  combinedLineFor,
  diagnosticsForFile,
  errorWithLocation,
  MAIN_FILE,
  planBreakpointRemap,
  resolveLine,
  workspaceShape,
  type Workspace,
} from "@/lib/playground/file-map";
import { combineSources } from "@/components/playground/MultiFileTabs";
import type { FullChromeSurfaceProps } from "@/components/playground/FullChromeSurface";

/** The editor shows one file at a time while the machine counts lines
 *  across all of them: this is the active file's view of that machine. */
export function useActiveFile({
  emu,
  source,
  setSource,
  sourceRef,
  extraFiles,
  setExtraFiles,
  extraFilesRef,
  activeFile,
  setActiveFile,
  lintWarnings,
  assembledLayout,
}: Pick<
  FullChromeSurfaceProps,
  | "emu"
  | "source"
  | "setSource"
  | "sourceRef"
  | "extraFiles"
  | "setExtraFiles"
  | "extraFilesRef"
  | "activeFile"
  | "setActiveFile"
  | "lintWarnings"
  | "assembledLayout"
>) {
  // Editor wiring: main buffer vs an extra file tab.
  const isMain = activeFile === -1;
  const editorValue = isMain ? source : extraFiles[activeFile]?.body ?? "";
  const onEditorChange = useCallback(
    (next: string) => {
      if (isMain) {
        setSource(next);
      } else {
        setExtraFiles(
          extraFiles.map((f, i) => (i === activeFile ? { ...f, body: next } : f)),
        );
      }
    },
    [isMain, activeFile, extraFiles, setExtraFiles, setSource],
  );
  // Machine-produced lines resolve against the ASSEMBLED workspace; only the
  // gutter (which the student clicks in the buffer on screen) uses the live
  // one. Before the first assemble there is nothing pinned, so both fall back
  // to what is on screen.
  const machineMain = assembledLayout?.main ?? source;
  const machineExtras = assembledLayout?.extras ?? extraFiles;

  // The decode strip needs the combined source, since `emu.currentLine`
  // counts across every file: main.asm alone lost the gloss inside a helper.
  // Built from the pin, so it joins once per assemble, not per keystroke.
  const pinnedCombined = useMemo(() => {
    if (!assembledLayout) return null;
    return assembledLayout.extras.length > 0
      ? combineSources(assembledLayout.main, assembledLayout.extras)
      : assembledLayout.main;
  }, [assembledLayout]);
  const decodeSource = pinnedCombined ?? source;

  // Per-file views of the combined-line diagnostics: the editor shows one
  // buffer at a time, so markers, the current-line highlight, and gutter
  // breakpoints each translate to the active file's local lines (and hide
  // when they belong to another file).
  const activeErrors = useMemo(
    () => diagnosticsForFile(emu.assemblyErrors, machineMain, machineExtras, activeFile),
    [emu.assemblyErrors, machineMain, machineExtras, activeFile],
  );
  const activeLint = useMemo(
    () => diagnosticsForFile(lintWarnings, source, extraFiles, activeFile),
    [lintWarnings, source, extraFiles, activeFile],
  );
  const activeCurrentLine = useMemo(() => {
    if (emu.currentLine == null) return null;
    const loc = resolveLine(emu.currentLine, machineMain, machineExtras);
    return loc.file === activeFile ? loc.line : null;
  }, [emu.currentLine, machineMain, machineExtras, activeFile]);
  // Bring forward the tab the pc is in after a step or a stop. Not during a
  // run (the pc crosses files many times a second), not before the first
  // step (assembling from a helper tab must not jump to main's entry), and
  // never onto a tab closed since the assemble; keyed on the pc's line so a
  // tab picked while paused stays picked.
  const executing = emu.stepCount > 0 && !emu.isRunning;
  useEffect(() => {
    if (emu.currentLine == null || !executing) return;
    const loc = resolveLine(emu.currentLine, machineMain, machineExtras);
    if (loc.file !== MAIN_FILE && extraFilesRef.current[loc.file]?.name !== loc.name) return;
    setActiveFile(loc.file);
  }, [emu.currentLine, executing, machineMain, machineExtras, setActiveFile, extraFilesRef]);
  const activeBreakpoints = useMemo(
    () => breakpointsForFile(emu.breakpoints, source, extraFiles, activeFile),
    [emu.breakpoints, source, extraFiles, activeFile],
  );
  const toggleBreakpointInActive = useCallback(
    (line: number) => {
      emu.toggleBreakpoint(
        combinedLineFor(activeFile, line, sourceRef.current, extraFilesRef.current),
      );
    },
    [emu, activeFile, sourceRef, extraFilesRef],
  );
  // Breakpoints are combined-source lines, so adding lines to main.asm shifts
  // every dot in the helpers after it; this re-anchors them. Only line counts
  // can move a line, so it is keyed on those and typing within a line is free.
  const layoutShape = useMemo(() => workspaceShape(source, extraFiles), [
    source,
    extraFiles,
  ]);
  // Seeded with the workspace as it stands at mount (the strip rehydrates
  // from storage), so the first pass has nothing to move.
  const bpLayoutRef = useRef<Workspace>({ main: source, extras: extraFiles });
  // Not the shell's refs: a child's effects run before its parent's, so they
  // would be a render stale here, and the re-anchor gets one chance at each
  // change. This mirror's effect runs just before its reader, since effects in
  // one component run in declaration order.
  const latestRef = useRef({
    machine: emu,
    workspace: { main: source, extras: extraFiles } as Workspace,
  });
  useEffect(() => {
    latestRef.current = {
      machine: emu,
      workspace: { main: source, extras: extraFiles },
    };
  });
  useEffect(() => {
    const from = bpLayoutRef.current;
    const { machine, workspace: to } = latestRef.current;
    bpLayoutRef.current = to;
    const moved = planBreakpointRemap(machine.breakpoints, from, to);
    if (!moved) return;
    machine.remapBreakpoints((line) => moved.get(line) ?? null);
  }, [layoutShape]);
  // Controls shows the first error as plain text, led by its line (and its
  // file once helpers are open).
  const controlsError = useMemo(
    () => errorWithLocation(emu.error, emu.assemblyErrors[0], machineMain, machineExtras),
    [emu.error, emu.assemblyErrors, machineMain, machineExtras],
  );
  return {
    isMain,
    editorValue,
    onEditorChange,
    decodeSource,
    activeErrors,
    activeLint,
    activeCurrentLine,
    executing,
    activeBreakpoints,
    toggleBreakpointInActive,
    controlsError,
  };
}
