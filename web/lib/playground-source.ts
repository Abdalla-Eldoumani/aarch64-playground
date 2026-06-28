import type { ReferenceInstruction } from "@/lib/reference-data";

/**
 * Wrap a single-instruction example in a minimal program the playground can
 * assemble. The assembler defaults to .text, so the example needs only an
 * aapcs64 prologue/epilogue and a success return around it. The try-in-
 * playground deep-link uses this so a one-line example still opens as a
 * complete, assemblable program rather than a bare instruction.
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
 * The source the try-in-playground link carries for an instruction. Entries
 * whose bare example names an undefined label or symbol carry a complete
 * authored `runnable`; every other entry wraps its illustrative example. Shared
 * by the reference component and the assemble test so the linked payload and the
 * asserted payload are the one source.
 */
export function playgroundSource(instruction: ReferenceInstruction): string {
  return instruction.runnable ?? wrapInMain(instruction.example);
}
