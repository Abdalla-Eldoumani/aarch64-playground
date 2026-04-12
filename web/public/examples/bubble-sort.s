// bubble sort -- sort [5, 3, 8, 1, 4] in ascending order
//
// Array of 5 64-bit values stored on the stack.
// X0 = array base, X1 = length, X2/X3 = loop counters

    // push 5 values onto the stack as our array
    MOV X10, #4
    STR X10, [SP, #-8]!
    MOV X10, #1
    STR X10, [SP, #-8]!
    MOV X10, #8
    STR X10, [SP, #-8]!
    MOV X10, #3
    STR X10, [SP, #-8]!
    MOV X10, #5
    STR X10, [SP, #-8]!

    MOV X0, SP           // X0 = base of array
    MOV X1, #5           // X1 = length

    // outer loop: i = length-1 down to 1
    SUB X2, X1, #1       // X2 = i = 4
outer:
    CMP X2, #0
    B.LE sorted

    MOV X3, #0           // X3 = j = 0
inner:
    CMP X3, X2
    B.GE next_outer

    // load a[j] and a[j+1]
    LSL X4, X3, #3       // byte offset = j * 8
    ADD X5, X0, X4
    LDR X6, [X5]         // X6 = a[j]
    LDR X7, [X5, #8]     // X7 = a[j+1]

    CMP X6, X7
    B.LE no_swap

    // swap
    STR X7, [X5]
    STR X6, [X5, #8]

no_swap:
    ADD X3, X3, #1
    B inner

next_outer:
    SUBS X2, X2, #1
    B outer

sorted:
    // result: stack contains [1, 3, 4, 5, 8]
    // load first element to verify
    LDR X0, [SP]         // X0 should be 1
    SVC #0
