import type { ReferenceInstruction } from "@/lib/content/reference-data";

/**
 * Wrap a one-instruction example in a program that assembles, so the
 * try-in-playground link opens a whole program. The assembler starts in
 * .text, so a prologue, an epilogue, and a return of 0 are all it needs.
 */
export function wrapInMain(example: string): string {
  const body = example
    .split("\n")
    .map((line) => `        ${line}`)
    .join("\n");
  return `        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
${body}
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
`;
}

/**
 * The source a try-in-playground link carries. An entry whose example names an
 * undefined label brings its own `runnable`; the rest are wrapped. The
 * reference and its assemble test share this so both see the same program.
 */
export function playgroundSource(instruction: ReferenceInstruction): string {
  return instruction.runnable ?? wrapInMain(instruction.example);
}
