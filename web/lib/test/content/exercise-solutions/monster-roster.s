// read a roster of monsters into an array of structs and report the strongest
define(fp, x29)
define(lr, x30)

define(base_r, x19)
define(n_r, w20)
define(i_r, w21)
define(elem_r, x22)
define(best_r, x23)
define(best_hp_r, w24)
define(hp_r, w25)

define(MAX, 8)

// struct monster {
//         char  name[6];      // up to 5 letters and the zero byte
//         short attitude;     // -32768 (hostile) to 32767 (friendly)
//         int   hp;           // hit points
// };
name_o = 0                                  // field offsets inside one monster
attitude_o = 6
hp_o = 8
monster_size = 12

.data
fmt_n:      .string "%d"
fmt_in:     .string "%5s %d %d"
fmt_out:    .string "strongest: %s, %d hp, attitude %d\n"
msg_empty:  .string "the roster is empty\n"

.bss
.align 4
roster:     .skip 96                        // MAX monsters of monster_size bytes
count:      .skip 4
att_m:      .skip 4                         // the attitude as scanf reads it, a full int

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_n                  // how many monsters follow
        ldr     x1, =count
        bl      scanf
        ldr     x9, =count
        ldr     n_r, [x9]

        cmp     n_r, 0                      // keep n between 0 and MAX
        b.ge    n_not_negative
        mov     n_r, 0
n_not_negative:
        cmp     n_r, MAX
        b.le    n_in_range
        mov     n_r, MAX
n_in_range:
        ldr     base_r, =roster

        mov     i_r, 0                      // one line per monster
        b       fill_test
fill_loop:
        sxtw    x9, i_r
        mov     x10, monster_size
        madd    elem_r, x9, x10, base_r     // elem = roster + i * monster_size
        ldr     x0, =fmt_in
        add     x1, elem_r, name_o
        add     x2, elem_r, hp_o
        ldr     x3, =att_m
        bl      scanf
        ldr     x9, =att_m
        ldr     w10, [x9]
        strh    w10, [elem_r, attitude_o]   // the field keeps the low 16 bits
        add     i_r, i_r, 1
fill_test:
        cmp     i_r, n_r
        b.lt    fill_loop

        cmp     n_r, 0
        b.gt    search
        ldr     x0, =msg_empty
        bl      printf
        b       done

search:
        mov     best_r, base_r              // the first monster leads to begin with,
        ldr     best_hp_r, [best_r, hp_o]   // so negative hit points still compare
        mov     elem_r, base_r
        mov     i_r, 1
        b       search_test
search_loop:
        add     elem_r, elem_r, monster_size
        ldr     hp_r, [elem_r, hp_o]
        cmp     hp_r, best_hp_r
        b.le    search_next                 // a tie keeps the monster listed first
        mov     best_r, elem_r
        mov     best_hp_r, hp_r
search_next:
        add     i_r, i_r, 1
search_test:
        cmp     i_r, n_r
        b.lt    search_loop

        ldr     x0, =fmt_out
        add     x1, best_r, name_o          // %s wants the name's address
        mov     w2, best_hp_r
        ldrsh   w3, [best_r, attitude_o]    // signed 16 bits, widened to 32
        bl      printf

done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
