/**
 * Every shipped example under public/examples/cpsc355/, in menu order, with
 * what the app does when it loads one. The example loads, the `?example=`
 * links and scripts/verify-corpus.js all read this list; the menu's stages
 * and labels live in ExampleLoader, whose test holds its stems to these.
 *
 * Imports nothing: verify-corpus requires it through Node's type stripping in
 * a CI job that installs no node_modules.
 */

export interface Example {
  /** The file name without `.s`, and the `?example=` value. */
  stem: string;
  /** Helper files served from `<stem>/` beside the main `<stem>.s`, in tab
   *  order and paste order. Their folder holds no program of its own. */
  files?: string[];
  /** Input files in fixtures/ (`<stem>.args`, `.stdin`, `.vfs.json`) a load
   *  delivers. A test keeps these in sync with that directory. */
  inputs?: { args?: true; stdin?: true; vfs?: true };
  /** The terminal pane, not the console, owns run press by default: run
   *  takes it over (clear, focus, live keys). The program draws a full-screen
   *  ANSI frame, which the console's plain-text scrollback renders as
   *  escape-sequence garbage. */
  terminal?: true;
  /** The run-mode control is offered: both surfaces are a real answer. It
   *  gates a surface, never behavior: a program without it runs unchanged. */
  interactive?: true;
  /** Two faces: in the console it takes the argument `console` and prints
   *  plain lines; in the terminal it takes none and draws a full screen. The
   *  mode sets the args box on load and on each mode change, over `inputs`,
   *  unless the student typed something of their own there. */
  modeArgs?: true;
  /** Stems the example had before a rename, so an old `?example=` link still
   *  opens it. */
  aliases?: string[];
}

export const EXAMPLES: Example[] = [
  { stem: "basics", aliases: ["week03_exercise"] },
  { stem: "distance" },
  { stem: "globals" },
  { stem: "locals", inputs: { stdin: true } },
  { stem: "array-scores", inputs: { stdin: true }, aliases: ["week08_scores"] },
  { stem: "student-record", inputs: { stdin: true }, aliases: ["week09_student_record"] },
  { stem: "find-max", aliases: ["week10_find_max"] },
  { stem: "is-prime", aliases: ["week12_is_prime"] },
  { stem: "static-counter", aliases: ["week11_static_counter"] },
  { stem: "command-line-args", inputs: { args: true }, aliases: ["week11_argv"] },
  { stem: "circle-area", inputs: { stdin: true }, aliases: ["week12_fp_circle"] },
  { stem: "triangle-area", inputs: { stdin: true } },
  { stem: "hello", aliases: ["week13_hello"] },
  { stem: "echo", inputs: { stdin: true }, aliases: ["week13_echo"] },
  { stem: "write-file", aliases: ["week13_write_file"] },
  { stem: "read-file", inputs: { vfs: true }, aliases: ["week13_read_file"] },
  { stem: "copy-file", inputs: { vfs: true }, aliases: ["week13_copy_file"] },
  { stem: "vector-upper", inputs: { stdin: true } },
  { stem: "vector-strlen", inputs: { stdin: true } },
  { stem: "vector-sum" },
  { stem: "vector-dot" },
  { stem: "vector-brighten" },
  { stem: "vector-mean" },
  { stem: "snake", interactive: true },
  {
    stem: "dsav",
    terminal: true,
    interactive: true,
    files: [
      "theme.s",
      "ui.s",
      "ansi.s",
      "display.s",
      "utils.s",
      "array.s",
      "stack.s",
      "queue.s",
      "list.s",
      "bst.s",
      "rbt.s",
      "heap.s",
      "hash.s",
      "graph.s",
      "sort.s",
      "search.s",
      "recursion.s",
    ],
  },
  { stem: "calc", interactive: true, modeArgs: true },
  { stem: "temp-convert", inputs: { args: true }, interactive: true, modeArgs: true },
  { stem: "two-sum", terminal: true, interactive: true, modeArgs: true },
  {
    stem: "deadzone",
    interactive: true,
    // The repo builds this one with m4 include(), and the paste order is
    // load-bearing: an equate only resolves for the modules below it, so
    // constants comes first and the rest follow the includes. main's own
    // uses reach back through the assembler's positional first-definition
    // fallback, but a helper's do not.
    files: [
      "constants.s",
      "terminal.s",
      "input.s",
      "player.s",
      "enemies.s",
      "projectiles.s",
      "upgrades.s",
      "file-io.s",
      "effects.s",
      "boss.s",
      "abilities.s",
    ],
  },
  {
    stem: "flappy",
    terminal: true,
    interactive: true,
    // flappy.s holds the shared definitions and main, so the helpers follow
    // in the order the repo's one-file bundle pastes them.
    files: ["tty.s", "sim.s", "art.s", "gfx.s", "term.s", "save.s"],
  },
];
