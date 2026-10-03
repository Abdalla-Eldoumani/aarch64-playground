import type { Action } from "@/lib/playground/commands";

/**
 * Everything the palette rows read or call, passed in so the builder stays a
 * pure function. The guards (a blocked read swallows step, back, and run) live
 * here so a row does nothing exactly where its disabled button does nothing.
 */
export type PaletteDeps = {
  /** Machine is parked on a read; step / back / run cannot pass it. */
  blocked: boolean;
  programLoaded: boolean;
  /** A run is in progress, which is the only time pause does anything. */
  isRunning: boolean;
  canStepBack: boolean;
  /** The composite launch has a pane to land in (full chrome, terminal mode). */
  launchable: boolean;
  /** The buffer the download / copy / format rows act on. */
  source: string;
  /** The caret's line in main.asm, or null while another file's tab is open:
   *  only the editor knows that caret, and F9 there reaches it. Left out, the
   *  breakpoint row stays and says how to set one from the editor. */
  caretLine?: number | null;
  toggleBreakpoint?: () => void;
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
  openTutorials: () => void;
  openWalkthrough: () => void;
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
 * Rebuilt each time the palette opens so a description can name the current
 * state. An unavailable row stays and says why it would do nothing: a row that
 * only sometimes exists is one a student cannot find again.
 */
export function buildPaletteCommands(deps: PaletteDeps): Action[] {
  return [
    {
      id: "assemble",
      label: "Assemble",
      description: "turn the source into machine code and load it, without running it",
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
          ? "undo the last instruction"
          : "(nothing to undo; take a step first)",
      shortcut: "Shift+F10",
      run: () => {
        if (!deps.blocked) deps.stepBack();
      },
    },
    {
      // Run's and reset's descriptions say "breakpoint" too. The palette ranks
      // a match that ends the text first and keeps list order among equals,
      // so this row ends on the word and sits ahead of both.
      id: "toggle-breakpoint",
      label: "Toggle breakpoint",
      description:
        deps.caretLine != null
          ? `line ${deps.caretLine}, where the caret is: set or clear a breakpoint`
          : "press F9 in the editor to set or clear a breakpoint",
      shortcut: "F9",
      run: () => {
        if (deps.caretLine != null) deps.toggleBreakpoint?.();
      },
    },
    {
      id: "run",
      label: "Run",
      // Run assembles first when nothing is loaded, so with no program the
      // row says it will, in either mode, instead of sending the student to
      // the assemble button.
      description: deps.blocked
        ? "(waiting for stdin; feed the console first)"
        : deps.launchable
          ? deps.programLoaded
            ? "run this program in the terminal tab"
            : "assemble, then run it in the terminal tab"
          : deps.programLoaded
            ? "run until halt or breakpoint, assembling first if the code changed or the program ended"
            : "assemble, then run until halt or breakpoint",
      shortcut: "F5",
      run: () => {
        if (!deps.blocked) deps.run();
      },
    },
    {
      id: "launch-terminal",
      label: "Start in the terminal",
      // Always present, with the description carrying the reason it would do
      // nothing.
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
      description: deps.isRunning
        ? "stop the run in progress"
        : "(nothing is running)",
      shortcut: "F5",
      run: () => deps.pause(),
    },
    {
      id: "reset",
      label: "Reset",
      description: "start the program over, keeping breakpoints",
      shortcut: "Shift+F5",
      run: () => deps.reset(),
    },
    {
      id: "share",
      label: "Share link",
      description: "open a link to this program that you can copy or send",
      run: () => deps.openShare(),
    },
    {
      id: "tutorials",
      label: "Tutorials",
      description: "walk through an example program one step at a time",
      run: () => deps.openTutorials(),
    },
    {
      id: "walkthrough",
      label: "Interface walkthrough",
      description: "point at each part of the playground in turn",
      run: () => deps.openWalkthrough(),
    },
    {
      id: "base-converter",
      label: "Base converter",
      description: "hex, octal, binary, decimal, two's complement, and IEEE-754 floats side by side",
      run: () => deps.openConverter(),
    },
    {
      id: "toggle-theme",
      label: "Toggle theme",
      description: "cycle through dark, light, and high contrast",
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
      description: "list every keyboard shortcut",
      shortcut: "?",
      run: () => deps.openShortcuts(),
    },
    {
      id: "import-file",
      label: "Import file",
      description: "load an assembly file from your computer into the open tab",
      run: () => {
        // ImportExport marks its hidden picker with this attribute; matching on
        // the accept list instead let the two drift and the row find no input.
        const el = document.querySelector<HTMLInputElement>(
          'input[type="file"][data-import-input]',
        );
        el?.click();
      },
    },
    {
      id: "download-asm",
      label: "Download as .asm",
      description: "save main.asm to your computer as program.asm",
      run: () => downloadSource(deps.source, "program.asm"),
    },
    {
      id: "download-s",
      label: "Download as .s",
      description: "save main.asm to your computer as program.s",
      run: () => downloadSource(deps.source, "program.s"),
    },
    {
      id: "copy-source",
      label: "Copy source to clipboard",
      description: "copy main.asm for pasting elsewhere",
      run: () => {
        void navigator.clipboard?.writeText(deps.source);
      },
    },
    {
      id: "open-source",
      label: "View source on GitHub",
      description: "open the playground's code on GitHub in a new tab",
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
