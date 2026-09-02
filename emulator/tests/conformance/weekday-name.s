// weekday-name.s - an argv-indexed .dword pointer table
// Seven day-name pointers live in a .data table; the day number arrives
// as argv[1], atoi converts it, and the name loads with the
// pointer-array form [table, Wi, SXTW 3]. every table entry is a
// forward reference the linker resolves to an absolute address.

define(fp, x29)
define(lr, x30)
define(argv_r, x19)
define(day_r, w20)
define(table_r, x21)

        .data
day_table:  .dword day_sun, day_mon, day_tue, day_wed, day_thu, day_fri, day_sat

fmt_day:    .string "day %d is %s\n"
fmt_usage:  .string "usage: weekday-name n\n"

day_sun:    .string "Sunday"
day_mon:    .string "Monday"
day_tue:    .string "Tuesday"
day_wed:    .string "Wednesday"
day_thu:    .string "Thursday"
day_fri:    .string "Friday"
day_sat:    .string "Saturday"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     argv_r, x1
        cmp     w0, 2                   // expect the program name plus one argument
        b.ne    show_usage

        ldr     x0, [argv_r, 8]         // argv[1]
        bl      atoi
        mov     day_r, w0

        cmp     day_r, 0                // day must be 0..6
        b.lt    show_usage
        cmp     day_r, 6
        b.gt    show_usage

        ldr     table_r, =day_table
        ldr     x2, [table_r, day_r, SXTW 3]    // 8-byte pointer slots
        mov     w1, day_r
        ldr     x0, =fmt_day
        bl      printf
        b       done

show_usage:
        ldr     x0, =fmt_usage
        bl      printf

done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
