    .data
    fmt1:   .string "XX\n"
    fmt2:   .string "XY\n"

    .text
    .balign 4
    .global main

main:
    // This is the program prologue
    stp     x29, x30, [sp, -16]!
    mov     x29, sp

    mov     x19, 6              // int a = 6;
    mov     x20, 7              // int b = 7;

    cmp     x19, x20            // Compare a and b: if (a > b)
    b.gt    greaterThan         // Jump to `greaterThan` if the condition code is met

    // else block
    // If the condition code is not met, execution continues with the instruction
    // immediately following the conditional branch.

    ldr     x0, =fmt2           // Load the address of the "XY" string
    bl      printf
    b       end

    // Branching to the label `end` is necessary here.
    // Otherwise, execution would continue into the code under the `greaterThan`
    // label and execute the if block after completing the else block.

greaterThan:
    ldr     x0, =fmt1           // Load the address of the "XX" string
    bl      printf

    // Branching to the label `end` is not necessary here because execution
    // naturally continues to the instruction immediately following this block,
    // which is the `end` label.

end:

    // This is the program epilogue
    mov     x0, 0               // End the program by returning 0.
    ldp     x29, x30, [sp], 16
    ret
