// theme.asm - the colour palette, by role rather than by name
//
// One 256-colour palette drives every screen. Modules ask for a role
// ("this cell is being compared") and never for a colour, so the whole
// program restyles from this file alone. The values track the same
// palette the c++ and rust versions use, so the three look like one
// project.

define(fp, x29)
define(lr, x30)

    .data
    .balign 8

// Foreground escapes, \x1b[38;5;Nm. Roles, in the order a reader meets
// them: chrome first, then the meanings a running algorithm paints.
th_fg_text:         .string "\x1b[38;5;189m"   // body text
th_fg_dim:          .string "\x1b[38;5;146m"   // secondary text, units
th_fg_faint:        .string "\x1b[38;5;243m"   // borders, rules, hints
th_fg_accent:       .string "\x1b[38;5;183m"   // headings, the app mark
th_fg_key:          .string "\x1b[38;5;111m"   // keys, indices, links
th_fg_ok:           .string "\x1b[38;5;157m"   // sorted, found, settled
th_fg_warn:         .string "\x1b[38;5;223m"   // comparing, probing
th_fg_hot:          .string "\x1b[38;5;216m"   // the element in hand
th_fg_bad:          .string "\x1b[38;5;211m"   // removed, missing, error
th_fg_node:         .string "\x1b[38;5;158m"   // nodes, cells at rest

// Background escapes for the cells that need a filled look.
th_bg_ok:           .string "\x1b[48;5;157m\x1b[38;5;235m"
th_bg_warn:         .string "\x1b[48;5;223m\x1b[38;5;235m"
th_bg_hot:          .string "\x1b[48;5;216m\x1b[38;5;235m"
th_bg_bad:          .string "\x1b[48;5;211m\x1b[38;5;235m"
th_bg_key:          .string "\x1b[48;5;111m\x1b[38;5;235m"
th_bg_accent:       .string "\x1b[48;5;183m\x1b[38;5;235m"
th_bg_faint:        .string "\x1b[48;5;237m\x1b[38;5;189m"

th_reset:           .string "\x1b[0m"
th_bold:            .string "\x1b[1m"
th_dim_attr:        .string "\x1b[2m"

// Role -> escape, indexed by the TH_* constants below. Keeping the
// table here means a module can pick a role at runtime (a cell's state
// is data, not a branch).
    .balign 8
th_fg_table:
    .dword th_fg_text, th_fg_dim, th_fg_faint, th_fg_accent, th_fg_key
    .dword th_fg_ok, th_fg_warn, th_fg_hot, th_fg_bad, th_fg_node

    .balign 8
th_bg_table:
    .dword th_bg_faint, th_bg_faint, th_bg_faint, th_bg_accent, th_bg_key
    .dword th_bg_ok, th_bg_warn, th_bg_hot, th_bg_bad, th_bg_faint

    .text
    .balign 4

// th_fg(w0 = role) - paint following text in the role's colour
    .global th_fg
th_fg:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x1, =th_fg_table
    ldr     x0, [x1, w0, sxtw 3]
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// th_bg(w0 = role) - fill the following cell with the role's colour
    .global th_bg
th_bg:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x1, =th_bg_table
    ldr     x0, [x1, w0, sxtw 3]
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// th_off() - back to plain text
    .global th_off
th_off:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =th_reset
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

// th_bold_on() / th_dim_on() - weight, cleared by th_off
    .global th_bold_on
th_bold_on:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =th_bold
    bl      printf

    ldp     fp, lr, [sp], 16
    ret

    .global th_dim_on
th_dim_on:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =th_dim_attr
    bl      printf

    ldp     fp, lr, [sp], 16
    ret
