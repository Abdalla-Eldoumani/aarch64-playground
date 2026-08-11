import type { Action } from "@/lib/playground/commands";

/**
 * Everything the palette table needs to read or call. It is a parameter
 * rather than a hub reference because the table is the one part of the
 * playground shell with no state of its own: the machine facts arrive as
 * plain booleans, the effects arrive as callbacks, and the builder stays a
 * pure function of them. The guards below (a blocked read swallows step,
 * back, and run) belong to the table, not to its caller: the palette rows
 * must no-op exactly where the disabled buttons do.
 */
export type PaletteDeps = {
  /** Machine is parked on a read; step / back / run cannot pass it. */
  blocked: boolean;
  programLoaded: boolean;
  canStepBack: boolean;
  /** The composite launch has a pane to land in (full chrome, terminal mode). */
  launchable: boolean;
  /** The buffer the download / copy / format rows act on. */
  source: string;
  assemble: () => void;
  step: () => void;
  stepBack: () => void;
  run: () => void;
  pause: () => void;
  reset: () => void;
  launchInteractive: () => void;
  formatSource: () => void;
  openShare: () => void;
  openShortcuts: () => void;
  openTour: () => void;
  openConverter: () => void;
  toggleTheme: () => void;
};

// One download path for both extensions: the buffer becomes a blob, an
// anchor clicks itself, and the object URL is released immediately after.
function downloadSource(source: string, filename: string): void {
  const blob = new Blob([source], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * The command palette's rows, rebuilt each time the palette opens so a
 * description can name the state the machine is actually in. Rows are never
 * dropped for being unavailable: a row that only sometimes exists is
 * unfindable by the student who saw it once, so the description carries the
 * reason it would do nothing instead.
 */
export function buildPaletteCommands(deps: PaletteDeps): Action[] {
  return [
    {
      id: "assemble",
      label: "Assemble",
      description: "parse source and load into memory",
      shortcut: "F6",
      run: () => deps.assemble(),
    },
    {
      id: "step",
      label: "Step",
      // The hint mirrors step-back's: the hub ignores step/run without a
      // loaded program, so the palette says why instead of no-oping mutely.
      description: deps.blocked
        ? "(waiting for stdin; feed the console first)"
        : deps.programLoaded
          ? "execute one instruction"
          : "(no program; assemble first)",
      shortcut: "F10",
      run: () => {
        if (!deps.blocked) deps.step();
      },
    },
    {
      id: "step-back",
      label: "Step back",
      description: deps.blocked
        ? "(waiting for stdin; feed the console first)"
        : deps.canStepBack
          ? "undo the last instruction from the snapshot ring"
          : "(no snapshots; run a step first)",
      shortcut: "Shift+F10",
      run: () => {
        if (!deps.blocked) deps.stepBack();
      },
    },
    {
      id: "run",
      label: "Run",
      // The list is rebuilt every time the palette opens, so the
      // description can name the surface this program's run lands in
      // rather than describing only the console flow. In terminal mode
      // with nothing assembled, run IS the launch, so it says so
      // instead of sending the student to the assemble button.
      description: deps.blocked
        ? "(waiting for stdin; feed the console first)"
        : deps.launchable
          ? deps.programLoaded
            ? "hand the terminal pane to this program"
            : "assemble, then hand the terminal pane over"
          : deps.programLoaded
            ? "run until halt or breakpoint"
            : "(no program; assemble first)",
      shortcut: "F5",
      run: () => {
        if (!deps.blocked) deps.run();
      },
    },
    {
      id: "launch-terminal",
      label: "Start in the terminal",
      // Always present, with the description carrying the reason it
      // would do nothing -- a row that only sometimes exists is
      // unfindable by the student who saw it once.
      description: deps.launchable
        ? "assemble and run with the terminal pane"
        : "(this program runs in the console)",
      run: () => {
        if (deps.launchable) deps.launchInteractive();
      },
    },
    {
      id: "pause",
      label: "Pause",
      description: "stop the run loop",
      shortcut: "F5",
      run: () => deps.pause(),
    },
    {
      id: "reset",
      label: "Reset",
      description: "clear state, keep breakpoints",
      shortcut: "Shift+F5",
      run: () => deps.reset(),
    },
    {
      id: "share",
      label: "Share link",
      description: "copy a compressed URL",
      run: () => deps.openShare(),
    },
    {
      id: "tutorial",
      label: "Start guided tour",
      description: "walk through a concept one step at a time",
      run: () => deps.openTour(),
    },
    {
      id: "base-converter",
      label: "Base converter",
      description: "hex, binary, decimal, and two's complement side by side",
      run: () => deps.openConverter(),
    },
    {
      id: "toggle-theme",
      label: "Toggle theme",
      description: "switch between dark and light palettes",
      run: () => deps.toggleTheme(),
    },
    {
      id: "format-source",
      label: "Format source",
      description: "lowercase mnemonics and align operand columns",
      shortcut: "Ctrl+Shift+F",
      run: () => deps.formatSource(),
    },
    {
      id: "help",
      label: "Keyboard shortcuts",
      description: "open the shortcuts help modal",
      shortcut: "?",
      run: () => deps.openShortcuts(),
    },
    {
      id: "import-file",
      label: "Import file",
      description: "open the file picker and load assembly into the active buffer",
      run: () => {
        const el = document.querySelector<HTMLInputElement>(
          'input[type="file"][accept=".s,.asm,.txt"]',
        );
        el?.click();
      },
    },
    {
      id: "download-asm",
      label: "Download as .asm",
      description: "save the current buffer to your computer",
      run: () => downloadSource(deps.source, "program.asm"),
    },
    {
      id: "download-s",
      label: "Download as .s",
      description: "save the current buffer with the .s extension",
      run: () => downloadSource(deps.source, "program.s"),
    },
    {
      id: "copy-source",
      label: "Copy source to clipboard",
      description: "copy the current buffer for pasting elsewhere",
      run: () => {
        void navigator.clipboard?.writeText(deps.source);
      },
    },
    {
      id: "open-source",
      label: "View source on GitHub",
      description: "open the playground repo in a new tab",
      run: () => {
        window.open(
          "https://github.com/Abdalla-Eldoumani/aarch64-playground",
          "_blank",
          "noopener,noreferrer",
        );
      },
    },
  ];
}
