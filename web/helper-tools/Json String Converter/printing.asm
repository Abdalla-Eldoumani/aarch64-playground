.data
    message:    .string  "Hello, World!\n"

.text
    .balign 4
    .global main

main:
    // This is the program prologue
    stp     x29, x30, [sp, -16]!    
    mov     x29, sp                  

    // printf(“%s”, message)
    ldr     x0, =message            // Load address of message
    bl      printf                  // Call printf

    // This is the program epilogue
    mov     x0, 0                   // End the program by returning 0.
    ldp     x29, x30, [sp], 16      
    ret                             