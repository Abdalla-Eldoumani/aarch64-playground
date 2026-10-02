/**
 * The rows of the reference's directives and debugger tab. They live apart
 * from the component so the tests can hold them to the assembler (each data
 * line takes the bytes it claims), to the command palette's keys, and to the
 * watch grammar.
 */

export interface DataDirective {
  directive: string;
  /** How many bytes the directive lays down, in words. */
  bytes: string;
  /** One line of `.data` (or `.bss` for `.skip`), label first. */
  example: string;
}

export const DATA_DIRECTIVES: readonly DataDirective[] = [
  { directive: ".byte", bytes: "1 per value", example: "flags: .byte 1, 0, 1" },
  { directive: ".hword", bytes: "2 per value", example: "ages: .hword 19, 21" },
  { directive: ".word", bytes: "4 per value", example: "scores: .word 72, 85, 90" },
  { directive: ".dword", bytes: "8 per value", example: "big: .dword 5000000000" },
  { directive: ".float", bytes: "4 per value", example: "g: .float 0r9.81" },
  { directive: ".double", bytes: "8 per value", example: "rate: .double 0r0.045" },
  { directive: ".string", bytes: "the text plus a 0 byte", example: 'fmt: .string "%d\\n"' },
  { directive: ".ascii", bytes: "the text, no 0 byte", example: 'tag: .ascii "OK"' },
  { directive: ".skip", bytes: "the count given, all 0", example: "buffer: .skip 256" },
];

export interface DebugControl {
  control: string;
  /** The command palette row that carries the same action and its key. */
  command: string;
  key: string;
  does: string;
}

export const DEBUG_CONTROLS: readonly DebugControl[] = [
  {
    control: "assemble",
    command: "assemble",
    key: "F6",
    does: "turns the source into machine code and loads it, without running it",
  },
  {
    control: "run",
    command: "run",
    key: "F5",
    does: "assembles first when nothing is loaded, the program has finished, or the code, files or args changed, then runs until the program ends, waits for input, or reaches a breakpoint; pressed during a run, it pauses",
  },
  { control: "step", command: "step", key: "F10", does: "runs one instruction; the highlighted line is the next one to run" },
  { control: "back", command: "step-back", key: "Shift+F10", does: "undoes the last step, registers and memory included" },
  { control: "reset", command: "reset", key: "Shift+F5", does: "starts the program over and keeps the breakpoints" },
];

export interface WatchForm {
  form: string;
  shows: string;
}

export const WATCH_FORMS: readonly WatchForm[] = [
  { form: "w19", shows: "a register: any `x` or `w` register, `sp`, `fp` or `lr`" },
  { form: "[fp, 16]", shows: "8 bytes of memory at `fp + 16`" },
  { form: "[fp, sum_s]", shows: "the same, with the offset named by a `sum_s = 16` line" },
  { form: "sum_s[1]", shows: "8 bytes at `fp + sum_s + 8`, the 8-byte slot after `sum_s`" },
  { form: "*x21", shows: "8 bytes of memory at the address held in `x21`" },
];
