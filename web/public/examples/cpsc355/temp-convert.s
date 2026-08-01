// temp-convert - the temperature instrument, one reading at a time
//
// The full project (build files, history) lives at
//   https://github.com/Abdalla-Eldoumani/temp-convert
//
// how to run: press assemble, then run. With the args box empty it
// draws the instrument and reads readings until you stop it. Put
//   ./temp-convert 32 F
// in the args box -- the box carries the whole argv, program name
// first -- and it prints that one conversion and exits instead. The
// term tab does the same thing with  ./program 32 F
//
// how to use: type a number with its unit stuck to it (36.6C, 98.6F,
// 310K; case does not matter) and the three scales come back with
// your reading marked on them. Anything else gets one line naming
// what was expected, and a reading below absolute zero is refused
// with the floor quoted in the unit you typed. Type q to quit.

// temp-convert - a temperature instrument for the terminal
//
// Two modes, picked by the argument count so the same binary serves a
// shell pipeline and a student poking at it:
//
//   ./temp-convert            draws the scale and reads readings until q
//   ./temp-convert 32 F       prints one conversion and exits
//
// A reading is a number with a unit stuck to it: 36.6C, 98.6f, 310K.
// Case does not matter. The instrument is one downward pass of text with
// no cursor tricks, so the previous reading stays on screen as history.
//
// build:  m4 temp-convert.asm > temp-convert.s
//         gcc temp-convert.s -o temp-convert

define(fp, x29)
define(lr, x30)

define(token_r, x19)            // parse_reading: the token, kept over atof
define(bar_r, x20)              // build_bar: the bar buffer
define(anchor_r, x21)           // build_bar: which tick is being placed
define(row_r, x22)              // draw_face: which unit's scale row

// The bar is 38 columns wide and starts 13 columns in, which puts the
// widest row (" C   -273.15 " + bar + "  100.00") at 59 columns. Past 60
// the rows wrap in a narrow terminal pane and the scales stop lining up.
BAR_WIDTH = 38
BAR_LAST = 37
BAR_LEAD = 13
ANCHORS = 4

// A reading arrives through "%15s", so 16 bytes hold it plus its NUL.
// The one-shot splice needs one of those bytes for the unit letter.
TOK_SIZE = 16
TOK_LAST = 14

UNIT_BAD = 3

tok_s = 16
alloc = -(16 + TOK_SIZE) & -16
dealloc = -alloc

        .data

// Every conversion comes out of these three: one celsius degree spans
// 1.8 fahrenheit degrees, and the other two scales read 32 and 273.15
// where celsius reads zero. None of them fits the fmov immediate, whose
// ceiling is 31.0, so they are loaded from memory.
ratio_m:        .double 1.8
ice_f_m:        .double 32.0
ice_k_m:        .double 273.15

// fcvtzs truncates, so a column index is rounded by adding a half first.
half_m:         .double 0.5

// Absolute zero doubles as the bar's column 0, and boiling water as its
// last column: the scale spans everything that can physically happen up
// to steam. Indexed by unit code, so a floor can be quoted back in the
// unit it was typed in.
abszero_m:      .double -273.15
                .double -459.67
                .double 0.0
boiling_m:      .double 100.0
                .double 212.0
                .double 373.15

// The tick marks, in celsius: absolute zero, ice, body heat, boiling.
anchor_m:       .double -273.15
                .double 0.0
                .double 37.0
                .double 100.0

// A reading inside one of these windows is named outright rather than
// called "somewhere between", which is the answer a person wants when
// they type 32F or 98.6F.
frost_lo_m:     .double -0.5
frost_hi_m:     .double 0.5
body_lo_m:      .double 36.5
body_hi_m:      .double 37.5

units_m:        .string "CFK"

// Palette: cyan is the program talking to you, dim grey is the fixed
// instrument face, amber is where your reading landed, red is a refusal.
// Nothing is carried by colour alone, so the face still reads when the
// escapes are stripped.
title_m:        .string "\x1b[36mtemp-convert\x1b[0m\n"
help_m:         .string "\x1b[90m  a reading is a number and a unit: 36.6C, 98.6F, 310K.\n  type q to quit.\x1b[0m\n"
prompt_m:       .string "\n\x1b[36mreading> \x1b[0m"
bye_m:          .string "\x1b[90mbye.\x1b[0m\n"
nl_m:           .string "\n"

fmt_tok_m:      .string "%15s"
fmt_trio_m:     .string "  %9.2f C  = %9.2f F  = %9.2f K\n"

// The label row is hand-spaced to the tick columns build_bar computes
// (0, 27, 31, 37); the leading run matches BAR_LEAD.
face_m:         .string "\x1b[90m             abs zero                   ice body  boil\x1b[0m\n"
fmt_mark_m:     .string "\x1b[33m%sv\x1b[0m\n"
fmt_row_m:      .string "\x1b[90m %c %9.2f %s %7.2f\x1b[0m\n"

note_ice_m:     .string "\x1b[33m  below the freezing point of water.\x1b[0m\n"
note_frost_m:   .string "\x1b[33m  right at the freezing point of water.\x1b[0m\n"
note_cool_m:    .string "\x1b[33m  between freezing and body heat.\x1b[0m\n"
note_body_m:    .string "\x1b[33m  right about human body temperature.\x1b[0m\n"
note_warm_m:    .string "\x1b[33m  between body heat and the boiling point.\x1b[0m\n"
note_steam_m:   .string "\x1b[33m  at or above the boiling point of water.\x1b[0m\n"

// Each mode names the shape it actually takes, so the advice is usable
// where it is read.
msg_bad_m:      .string "\x1b[31m  need a number and a unit: 36.6C, 98.6F, 310K.\x1b[0m\n"
msg_shot_bad_m: .string "\x1b[31m  need a number then a unit: 32 F, 36.6 C, 310 K.\x1b[0m\n"
msg_floor_m:    .string "\x1b[31m  %.2f %c is below absolute zero (%.2f %c).\x1b[0m\n"
msg_usage_m:    .string "usage: %s <value> <C|F|K>   (no arguments: interactive)\n"

        .bss
        .balign 8

value_m:        .skip 8         // the reading exactly as typed
unit_m:         .skip 8         // 0 celsius, 1 fahrenheit, 2 kelvin
cel_m:          .skip 8
fah_m:          .skip 8
kel_m:          .skip 8

// Whole rows are staged here and printed one call each, rather than a
// call per character.
bar_m:          .skip 48
pad_m:          .skip 64

        .text
        .balign 4
        .global main

main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        // argc is 0 when a host hands the program no argv at all, so the
        // instrument has to answer for both 0 and 1 or the empty case
        // dereferences a null argv.
        cmp     w0, 1
        b.le    interactive
        cmp     w0, 3
        b.eq    oneshot

        // Arguments were given but not two of them. argv[0] is safe to
        // read here: the null-argv case already branched away.
        ldr     x0, =msg_usage_m
        ldr     x1, [x1]
        bl      printf
        mov     w0, 1
        b       main_done

// ---------------------------------------------------------------- one shot

oneshot:
        ldr     x10, [x1, 16]           // argv[2], the unit
        ldrb    w11, [x10]
        cbz     w11, shot_bad           // an empty argument is not a unit
        ldrb    w11, [x10, 1]
        cbnz    w11, shot_bad           // and a unit is exactly one letter

        // Splice the two arguments into the token the interactive parser
        // already understands, so both modes accept the same forms.
        ldr     x9, [x1, 8]             // argv[1], the number
        add     x12, fp, tok_s
        mov     w13, 0
shot_copy:
        cmp     w13, TOK_LAST
        b.ge    shot_bad
        ldrb    w14, [x9, w13, sxtw]
        cbz     w14, shot_splice
        strb    w14, [x12, w13, sxtw]
        add     w13, w13, 1
        b       shot_copy
shot_splice:
        ldrb    w14, [x10]
        strb    w14, [x12, w13, sxtw]
        add     w13, w13, 1
        strb    wzr, [x12, w13, sxtw]

        add     x0, fp, tok_s
        bl      parse_reading
        cbz     w0, shot_bad
        bl      check_floor
        cbz     w0, shot_floor
        bl      derive
        bl      print_trio
        mov     w0, 0
        b       main_done

shot_bad:
        ldr     x0, =msg_shot_bad_m
        bl      printf
        mov     w0, 1
        b       main_done

shot_floor:
        bl      say_floor
        mov     w0, 1
        b       main_done

// ------------------------------------------------------------- interactive

interactive:
        ldr     x0, =title_m
        bl      printf
        ldr     x0, =help_m
        bl      printf
        bl      build_bar

read_loop:
        ldr     x0, =prompt_m
        bl      printf
        ldr     x0, =fmt_tok_m
        add     x1, fp, tok_s
        bl      scanf
        cmp     w0, 1
        b.ne    read_eof                // -1 at end of input, 0 on nothing

        add     x0, fp, tok_s
        bl      is_quit
        cbnz    w0, read_quit

        add     x0, fp, tok_s
        bl      parse_reading
        cbz     w0, read_bad
        bl      check_floor
        cbz     w0, read_floor
        bl      derive
        bl      draw_face
        b       read_loop

read_bad:
        ldr     x0, =msg_bad_m
        bl      printf
        b       read_loop

read_floor:
        bl      say_floor
        b       read_loop

read_eof:
        // The prompt is still hanging without its newline.
        ldr     x0, =nl_m
        bl      printf

read_quit:
        ldr     x0, =bye_m
        bl      printf
        mov     w0, 0

main_done:
        ldp     fp, lr, [sp], dealloc
        ret

// ------------------------------------------------------------------ parsing

// scan_number(x0 = string) -> w0 = index just past the number,
//                             w1 = how many digits were in it
// Stops at the first byte that cannot continue a decimal number. A digit
// count of zero means there was no number at all, which is the only way
// to tell a genuine 0 from atof's answer for junk.
scan_number:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     w9, 0                   // index
        mov     w10, 0                  // digits seen
        mov     w11, 0                  // a point has been seen
        ldrb    w12, [x0]
        cmp     w12, '+'
        b.eq    scan_sign
        cmp     w12, '-'
        b.ne    scan_loop
scan_sign:
        mov     w9, 1
scan_loop:
        ldrb    w12, [x0, w9, sxtw]
        cmp     w12, '.'
        b.eq    scan_point
        sub     w13, w12, '0'
        cmp     w13, 9                  // unsigned, so anything under '0' wraps high
        b.hi    scan_out
        add     w10, w10, 1
        add     w9, w9, 1
        b       scan_loop
scan_point:
        cbnz    w11, scan_out           // a second point ends the number
        mov     w11, 1
        add     w9, w9, 1
        b       scan_loop
scan_out:
        mov     w1, w10
        mov     w0, w9
        ldp     fp, lr, [sp], 16
        ret

// fold_unit(w0 = byte) -> w0 = 0 celsius, 1 fahrenheit, 2 kelvin,
//                              UNIT_BAD otherwise
fold_unit:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        orr     w0, w0, 32              // one bit is the whole of ASCII case
        cmp     w0, 'c'
        b.eq    fold_c
        cmp     w0, 'f'
        b.eq    fold_f
        cmp     w0, 'k'
        b.eq    fold_k
        mov     w0, UNIT_BAD
        b       fold_done
fold_c:
        mov     w0, 0
        b       fold_done
fold_f:
        mov     w0, 1
        b       fold_done
fold_k:
        mov     w0, 2
fold_done:
        ldp     fp, lr, [sp], 16
        ret

// parse_reading(x0 = token) -> w0 = 1 accepted, 0 rejected
// Fills value_m and unit_m. atof alone cannot reject anything, so the
// shape of the token is checked here first.
parse_reading:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        str     token_r, [sp, -16]!
        mov     token_r, x0

        bl      scan_number
        cbz     w1, parse_bad
        ldrb    w9, [token_r, w0, sxtw]
        add     w0, w0, 1
        ldrb    w10, [token_r, w0, sxtw]
        cbnz    w10, parse_bad          // the unit has to be the last byte

        mov     w0, w9
        bl      fold_unit
        cmp     w0, UNIT_BAD
        b.eq    parse_bad
        ldr     x9, =unit_m
        str     x0, [x9]

        mov     x0, token_r
        bl      atof
        ldr     x9, =value_m
        str     d0, [x9]
        mov     w0, 1
        b       parse_done
parse_bad:
        mov     w0, 0
parse_done:
        ldr     token_r, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// is_quit(x0 = token) -> w0 = 1 when the token is q or quit, any case
is_quit:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldrb    w9, [x0]
        orr     w9, w9, 32
        cmp     w9, 'q'
        b.ne    quit_no
        ldrb    w9, [x0, 1]
        cbz     w9, quit_yes
        orr     w9, w9, 32
        cmp     w9, 'u'
        b.ne    quit_no
        ldrb    w9, [x0, 2]
        orr     w9, w9, 32
        cmp     w9, 'i'
        b.ne    quit_no
        ldrb    w9, [x0, 3]
        orr     w9, w9, 32
        cmp     w9, 't'
        b.ne    quit_no
        ldrb    w9, [x0, 4]
        cbnz    w9, quit_no
quit_yes:
        mov     w0, 1
        b       quit_done
quit_no:
        mov     w0, 0
quit_done:
        ldp     fp, lr, [sp], 16
        ret

// ------------------------------------------------------------- conversions

// check_floor() -> w0 = 1 when value_m is at or above absolute zero.
// The comparison happens in the unit that was typed, so the refusal can
// name the floor without converting it first.
check_floor:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =value_m
        ldr     d0, [x9]
        ldr     x9, =unit_m
        ldr     x10, [x9]
        ldr     x9, =abszero_m
        lsl     x11, x10, 3
        add     x9, x9, x11
        ldr     d1, [x9]
        fcmp    d0, d1
        b.lt    floor_under
        mov     w0, 1
        b       floor_done
floor_under:
        mov     w0, 0
floor_done:
        ldp     fp, lr, [sp], 16
        ret

// derive() : value_m and unit_m -> cel_m, fah_m, kel_m.
// Everything routes through celsius so there is one formula per scale
// instead of six.
derive:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =value_m
        ldr     d0, [x9]
        ldr     x9, =unit_m
        ldr     x10, [x9]
        cmp     x10, 1
        b.eq    derive_from_f
        cmp     x10, 2
        b.eq    derive_from_k
        b       derive_have_c

derive_from_f:
        ldr     x9, =ice_f_m
        ldr     d1, [x9]
        fsub    d0, d0, d1
        ldr     x9, =ratio_m
        ldr     d1, [x9]
        fdiv    d0, d0, d1
        b       derive_have_c

derive_from_k:
        ldr     x9, =ice_k_m
        ldr     d1, [x9]
        fsub    d0, d0, d1

derive_have_c:
        ldr     x9, =cel_m
        str     d0, [x9]

        ldr     x9, =ratio_m
        ldr     d1, [x9]
        fmul    d2, d0, d1
        ldr     x9, =ice_f_m
        ldr     d1, [x9]
        fadd    d2, d2, d1
        ldr     x9, =fah_m
        str     d2, [x9]

        ldr     x9, =ice_k_m
        ldr     d1, [x9]
        fadd    d2, d0, d1
        ldr     x9, =kel_m
        str     d2, [x9]

        ldp     fp, lr, [sp], 16
        ret

// ------------------------------------------------------------- instrument

// bar_column(d0 = celsius) -> w0 = column 0 .. BAR_LAST
// A reading hotter than boiling parks on the last column rather than
// running off the row; the note line still names it as steam.
bar_column:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =abszero_m
        ldr     d1, [x9]
        ldr     x9, =boiling_m
        ldr     d2, [x9]
        fsub    d2, d2, d1              // celsius the whole bar covers
        fsub    d0, d0, d1
        fdiv    d0, d0, d2

        mov     w9, BAR_LAST
        scvtf   d1, w9
        fmul    d0, d0, d1
        ldr     x9, =half_m
        ldr     d1, [x9]
        fadd    d0, d0, d1
        fcvtzs  w0, d0

        cmp     w0, 0
        b.ge    column_high
        mov     w0, 0
column_high:
        cmp     w0, BAR_LAST
        b.le    column_done
        mov     w0, BAR_LAST
column_done:
        ldp     fp, lr, [sp], 16
        ret

// build_bar() : lay out the ruler once, since the ticks never move.
build_bar:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     bar_r, anchor_r, [sp, -16]!

        ldr     bar_r, =bar_m
        mov     w9, 0
bar_fill:
        cmp     w9, BAR_WIDTH
        b.ge    bar_filled
        mov     w10, '-'
        strb    w10, [bar_r, w9, sxtw]
        add     w9, w9, 1
        b       bar_fill
bar_filled:
        strb    wzr, [bar_r, w9, sxtw]

        mov     anchor_r, 0
bar_ticks:
        cmp     anchor_r, ANCHORS
        b.ge    bar_done
        ldr     x9, =anchor_m
        lsl     x10, anchor_r, 3
        add     x9, x9, x10
        ldr     d0, [x9]
        bl      bar_column
        mov     w10, '+'
        strb    w10, [bar_r, w0, sxtw]
        add     anchor_r, anchor_r, 1
        b       bar_ticks
bar_done:
        ldp     bar_r, anchor_r, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// build_pad(w0 = column) : the run of blanks that puts the pointer under
// its column once the row's fixed left margin is counted in.
build_pad:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =pad_m
        add     w1, w0, BAR_LEAD
        mov     w2, 0
pad_fill:
        cmp     w2, w1
        b.ge    pad_filled
        mov     w3, ' '
        strb    w3, [x9, w2, sxtw]
        add     w2, w2, 1
        b       pad_fill
pad_filled:
        strb    wzr, [x9, w2, sxtw]

        ldp     fp, lr, [sp], 16
        ret

// print_trio() : the answer line, shared by both modes and deliberately
// free of escapes so a shell can pipe it somewhere.
print_trio:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =cel_m
        ldr     d0, [x9]
        ldr     x9, =fah_m
        ldr     d1, [x9]
        ldr     x9, =kel_m
        ldr     d2, [x9]
        ldr     x0, =fmt_trio_m
        bl      printf

        ldp     fp, lr, [sp], 16
        ret

// draw_face() : the whole instrument, one printf per row.
draw_face:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        str     row_r, [sp, -16]!

        bl      print_trio

        ldr     x0, =face_m
        bl      printf

        ldr     x9, =cel_m
        ldr     d0, [x9]
        bl      bar_column
        bl      build_pad
        ldr     x0, =fmt_mark_m
        ldr     x1, =pad_m
        bl      printf

        // The three scales share one ruler because they are one axis
        // read three ways; only the end labels differ.
        mov     row_r, 0
face_rows:
        cmp     row_r, 3
        b.ge    face_rows_done
        ldr     x0, =fmt_row_m
        ldr     x9, =units_m
        ldrb    w1, [x9, row_r]
        lsl     x10, row_r, 3
        ldr     x9, =abszero_m
        add     x9, x9, x10
        ldr     d0, [x9]
        ldr     x2, =bar_m
        ldr     x9, =boiling_m
        add     x9, x9, x10
        ldr     d1, [x9]
        bl      printf
        add     row_r, row_r, 1
        b       face_rows
face_rows_done:

        bl      say_note

        ldr     row_r, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// say_note() : one line naming the band the reading landed in.
say_note:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =cel_m
        ldr     d0, [x9]

        ldr     x9, =frost_lo_m
        ldr     d1, [x9]
        fcmp    d0, d1
        b.lt    note_ice

        ldr     x9, =frost_hi_m
        ldr     d1, [x9]
        fcmp    d0, d1
        b.le    note_frost

        ldr     x9, =body_lo_m
        ldr     d1, [x9]
        fcmp    d0, d1
        b.lt    note_cool

        ldr     x9, =body_hi_m
        ldr     d1, [x9]
        fcmp    d0, d1
        b.le    note_body

        ldr     x9, =boiling_m
        ldr     d1, [x9]
        fcmp    d0, d1
        b.lt    note_warm

        ldr     x0, =note_steam_m
        b       note_say
note_ice:
        ldr     x0, =note_ice_m
        b       note_say
note_frost:
        ldr     x0, =note_frost_m
        b       note_say
note_cool:
        ldr     x0, =note_cool_m
        b       note_say
note_body:
        ldr     x0, =note_body_m
        b       note_say
note_warm:
        ldr     x0, =note_warm_m
note_say:
        bl      printf

        ldp     fp, lr, [sp], 16
        ret

// say_floor() : the refusal, quoting the floor in the unit that was typed.
say_floor:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =value_m
        ldr     d0, [x9]
        ldr     x9, =unit_m
        ldr     x10, [x9]
        ldr     x9, =units_m
        ldrb    w1, [x9, x10]
        mov     w2, w1
        ldr     x9, =abszero_m
        lsl     x11, x10, 3
        add     x9, x9, x11
        ldr     d1, [x9]
        ldr     x0, =msg_floor_m
        bl      printf

        ldp     fp, lr, [sp], 16
        ret
