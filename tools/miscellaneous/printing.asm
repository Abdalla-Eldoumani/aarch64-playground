.data
    // Format string for printing an integer
    format1:   .string  "Integer Variable Content: %d\n"

    // Variable storing the number 85
    importantNumber:      .word 85

.text
    .balign 4
    .global main

main:
    // Program prologue
    stp     x29, x30, [sp, -16]!
    mov     x29, sp
    
    // Loading the format string (format1) into x0 for printing an integer.
    ldr x0, =format1
    // passing the integer value to be printed to next argument register.
    ldr  x21, =importantNumber
    ldr x1, [x21]
    bl printf

    // program epilogue
    mov     x0, 0
    ldp     x29, x30, [sp], 16
    ret