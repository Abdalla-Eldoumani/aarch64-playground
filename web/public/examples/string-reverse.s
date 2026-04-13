// string reverse -- reverse "HELLO" in memory
//
// Writes "HELLO" one byte at a time at 0x10000000, then swaps around the
// midpoint until the string reads "OLLEH".

    // lay down the string byte-by-byte at 0x10000000
    MOV X10, #0x10000000
    MOV X0, #0x48       // 'H'
    STRB X0, [X10]
    MOV X0, #0x45       // 'E'
    STRB X0, [X10, #1]
    MOV X0, #0x4C       // 'L'
    STRB X0, [X10, #2]
    STRB X0, [X10, #3]  // 'L' again
    MOV X0, #0x4F       // 'O'
    STRB X0, [X10, #4]

    // X0 = front pointer, X1 = back pointer
    MOV X0, X10         // front = 0x10000000
    ADD X1, X0, #4      // back = front + 4 (points at 'O')

reverse_loop:
    CMP X0, X1
    B.GE done

    LDRB X2, [X0]       // load front char
    LDRB X3, [X1]       // load back char
    STRB X3, [X0]       // swap
    STRB X2, [X1]
    ADD X0, X0, #1      // front++
    SUB X1, X1, #1      // back--
    B reverse_loop

done:
    SVC #0               // halt -- memory at 0x10000000 = "OLLEH"
