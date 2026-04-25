// A4 -- structures and subroutines: a Person record
//
// scaffold -- fill in the YOUR CODE blocks. As shipped this file
// compiles, halts cleanly, and prints nothing.
//
// Goal: define a Person struct with fields { name: char[20], age: int,
// height: int }, then write two subroutines:
//   init_person(person*, name*, age, height)
//   print_person(person*)
// Main allocates a Person on the stack, fills it in, prints it.

define(fp, x29)
define(lr, x30)

// Person struct layout, offsets from the struct base
person_name   = 0           // char name[20]  -- 20 bytes
person_age    = 20          // int  age       -- 4 bytes
person_height = 24          // int  height    -- 4 bytes
person_size   = 32          // total with padding to 16-byte boundary

alloc   = -(16 + person_size) & -16
dealloc = -alloc
person_s = 16

        .data
sample_name: .string "Ada Lovelace"
fmt_out:     .string "name=%s age=%d height=%d\n"

        .text

// init_person(x0 = person*, x1 = name*, w2 = age, w3 = height)
        .balign 4
        .global init_person
init_person:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        // YOUR CODE -- copy the NUL-terminated name pointed to by x1
        //   into [x0, person_name] (loop with ldrb/strb until NUL).
        //   Then store w2 at [x0, person_age] and w3 at [x0, person_height].

        ldp     fp, lr, [sp], 16
        ret

// print_person(x0 = person*)
        .balign 4
        .global print_person
print_person:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        // YOUR CODE -- save x0 in a callee-saved register, then call
        //   printf with fmt_out + name address + age + height.

        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        // YOUR CODE -- compute the in-frame Person address (add x0, fp,
        //   person_s), then call init_person(x0=&p, x1=sample_name, w2=29, w3=170)
        //   and print_person(x0=&p).

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
