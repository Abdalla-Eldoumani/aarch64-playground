// string reverse -- reverse "HELLO" in memory
//
// The string is stored at address 0x10000000 (heap).
// X0 = pointer to start, X1 = pointer to end.

    // store "HELLO" (5 bytes) at heap base
    MOV X0, #0x4C4C     // "LL" in little-endian
    MOVK X0, #0x4548, LSL #16  // "HE"
    MOV X10, #0x10000000
    STR X0, [X10]
    MOV X0, #0x4F       // 'O'
    STRB X0, [X10, #4]

    // X0 = start pointer, X1 = end pointer
    MOV X0, #0x10000000
    ADD X1, X0, #4      // point to last char

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
