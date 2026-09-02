// temp-convert - a thermometer for the terminal
// https://github.com/Abdalla-Eldoumani/temp-convert
//
//   ./temp-convert            the instrument in colour, reads until q
//   ./temp-convert console    the same loop with no escape bytes at all
//   ./temp-convert 32 F       one conversion, then exit
//
// A reading is a number with a unit stuck to it: 36.6C, 98.6f, 310K.
// Each one draws the three scales, a thermometer filled to where the
// reading landed, and a line naming the band. build: make (m4 + gcc).

define(fp, x29)
define(lr, x30)

define(token_r, x19)            // parse_reading, is_quit: the token
define(bar_r, x20)              // build_bar: the bar buffer
define(anchor_r, x21)           // build_bar: which tick is being placed
define(row_r, x22)              // draw_face: which unit's scale row
define(band_r, x23)             // draw_face: where the reading landed
define(col_r, x24)              // draw_face: that spot as a bar column
define(tint_r, x25)             // draw_face: the colour that band fills in

// A scale row is " C -273.15 " + "(*)" + 37 columns of bar + " 100.00",
// which is 59 wide. Past 60 the rows wrap in a narrow pane and the three
// scales stop lining up, so the lead, the bulb, the bar and the
// hand-spaced label row in face_m are one layout: move one and the
// pointer leaves its tick. With this width the ticks land on columns
// 0, 26, 30 and 36, which is what face_m is spaced to.
BAR_WIDTH = 37
BAR_LAST = 36
BAR_LEAD = 11
BULB_WIDTH = 3
MARK_LEAD = BAR_LEAD + BULB_WIDTH
ANCHORS = 4

// Colour is one indirection: every escape a row prints comes out of
// pal_m, and console mode fills pal_m with the empty string instead. so there
// is no second set of strings to drift.
P_CYAN = 0
P_GREY = 8
P_AMBER = 16
P_RED = 24
P_OFF = 32
PALETTE = 5

// The six bands a reading can land in, coldest first. One chain names
// them, and both the note line and the fill colour read off the answer.
BAND_ICE = 0
BAND_FROST = 1
BAND_COOL = 2
BAND_BODY = 3
BAND_WARM = 4
BAND_STEAM = 5

// A reading arrives through "%15s", so 16 bytes hold it plus its NUL.
// The one-shot splice needs one of those bytes for the unit letter.
TOK_SIZE = 16
TOK_LAST = 14

UNIT_BAD = 3

tok_s = 16
argv_s = 32
alloc = -(16 + TOK_SIZE + 8) & -16
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
// last column: Indexed by unit code, so a floor can be quoted back in the
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

// The band edges. A reading inside one of these windows is named
// outright rather than called "somewhere between", which is the answer a
// person wants when they type 32F or 98.6F.
frost_lo_m:     .double -0.5
frost_hi_m:     .double 0.5
body_lo_m:      .double 36.5
body_hi_m:      .double 37.5

units_m:        .string "CFK"
console_m:      .string "console"
q_m:            .string "q"
quit_m:         .string "quit"

// Cyan is the program talking, dim grey is the fixed instrument, amber
// is where the reading landed, red is a refusal. The empty string is
// what console mode puts in every slot.
esc_cyan_m:     .string "\x1b[36m"
esc_grey_m:     .string "\x1b[90m"
esc_amber_m:    .string "\x1b[33m"
esc_red_m:      .string "\x1b[31m"
esc_off_m:      .string "\x1b[0m"
empty_m:        .string ""

        .balign 8
colour_m:       .dword esc_cyan_m, esc_grey_m, esc_amber_m, esc_red_m
                .dword esc_off_m

// The column fill is the one thing that shifts: cold reads cyan, the
// ordinary middle keeps the face's own grey, body heat is amber and
// anything hotter is red. The pointer and the note stay amber, so the
// reading is always findable whatever band it is in.
band_pal_m:     .byte P_CYAN, P_CYAN, P_GREY, P_AMBER, P_RED, P_RED

        .balign 8
note_m:         .dword note_ice_m, note_frost_m, note_cool_m
                .dword note_body_m, note_warm_m, note_steam_m

note_ice_m:     .string "  below the freezing point of water."
note_frost_m:   .string "  right at the freezing point of water."
note_cool_m:    .string "  between freezing and body heat."
note_body_m:    .string "  right about human body temperature."
note_warm_m:    .string "  between body heat and the boiling point."
note_steam_m:   .string "  at or above the boiling point of water."

title_m:        .string "temp-convert"
help_m:         .string "  a reading is a number and a unit: 36.6C, 98.6F, 310K.\n  type q to quit."
bye_m:          .string "bye."
nl_m:           .string "\n"

// The prompt is drawn as a field: a labelled rule, then a caret on its
// own line with nothing after it, so the pane's cursor sits exactly
// where the typing goes. Nothing is redrawn or moved, which is what
// keeps every reading on screen as history.
rule_m:         .string "-------------------------------------------------"
fmt_field_m:    .string "\n%s  reading %s%s\n"
fmt_caret_m:    .string "%s  > %s"

// One format for every line that is coloured end to end.
fmt_line_m:     .string "%s%s%s\n"

fmt_tok_m:      .string "%15s"
fmt_trio_m:     .string "  %9.2f C  = %9.2f F  = %9.2f K\n"

// The label row is hand-spaced to the tick columns build_bar computes
// (0, 26, 30, 36); the leading run is MARK_LEAD, past the bulb.
face_m:         .string "              abs zero                  ice body  boil"
fmt_mark_m:     .string "%s%sv%s\n"
fmt_row_m:      .string "%s %c %7.2f %s%s%s%s %7.2f%s\n"

// The interactive face takes one token and the one-shot face two, so each
// names its own shape.
msg_bad_m:      .string "  need a number and a unit: 36.6C, 98.6F, 310K."
msg_shot_bad_m: .string "  need a number then a unit: 32 F, 36.6 C, 310 K."
msg_floor_m:    .string "%s  %.2f %c is below absolute zero (%.2f %c).%s\n"
msg_usage_m:    .string "usage: %s [console | <value> <C|F|K>]\n"

bulb_m:         .string "(*)"

        .bss
        .balign 8

value_m:        .skip 8         // the reading exactly as typed
unit_m:         .skip 8         // 0 celsius, 1 fahrenheit, 2 kelvin
cel_m:          .skip 8
fah_m:          .skip 8
kel_m:          .skip 8

pal_m:          .skip 40        // the five colour slots, in P_ order

// Whole rows are staged here and printed one call each, rather than a
// call per character.
bar_m:          .skip 48        // the ruler, laid out once
fill_m:         .skip 48        // bulb plus the filled part of the ruler
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
        b.le    terminal_face

        // Past here argv is real, and the palette call below would lose
        // it, so it goes on the frame first.
        str     x1, [fp, argv_s]
        cmp     w0, 3
        b.eq    oneshot
        cmp     w0, 2
        b.ne    usage

        // The one argument this program takes is console, the face with no
        // escapes in it.
        ldr     x0, [x1, 8]
        ldr     x1, =console_m
        bl      same_word
        cbz     w0, usage

console_face:
        mov     w0, 1
        bl      set_palette
        b       read_start

terminal_face:
        mov     w0, 0
        bl      set_palette
        b       read_start

usage:
        ldr     x1, [fp, argv_s]
        ldr     x1, [x1]
        ldr     x0, =msg_usage_m
        bl      printf
        mov     w0, 1
        b       main_done

// one shot

// No escapes, so the line pipes; the instrument is drawn all the same.
oneshot:
        mov     w0, 1
        bl      set_palette

        ldr     x1, [fp, argv_s]
        ldr     x10, [x1, 16]           // argv[2], the unit
        ldrb    w11, [x10]
        cbz     w11, shot_bad           // an empty argument is not a unit
        ldrb    w11, [x10, 1]
        cbnz    w11, shot_bad           // and a unit is exactly one letter

        // Splice the two arguments into the token the interactive parser
        // already understands, so every face accepts the same forms.
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
        bl      build_bar
        bl      draw_face
        mov     w0, 0
        b       main_done

shot_bad:
        mov     w0, P_RED
        ldr     x1, =msg_shot_bad_m
        bl      say
        mov     w0, 1
        b       main_done

shot_floor:
        bl      say_floor
        mov     w0, 1
        b       main_done

// the reading loop

// Both interactive faces are this loop. The only difference between them
// is what set_palette left in the slots.
read_start:
        mov     w0, P_CYAN
        ldr     x1, =title_m
        bl      say
        mov     w0, P_GREY
        ldr     x1, =help_m
        bl      say
        bl      build_bar

read_loop:
        bl      say_field
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
        mov     w0, P_RED
        ldr     x1, =msg_bad_m
        bl      say
        b       read_loop

read_floor:
        bl      say_floor
        b       read_loop

read_eof:
        // The caret is still hanging without its newline.
        ldr     x0, =nl_m
        bl      printf

read_quit:
        mov     w0, P_GREY
        ldr     x1, =bye_m
        bl      say
        mov     w0, 0

main_done:
        ldp     fp, lr, [sp], dealloc
        ret

// colour

// set_palette(w0 = 1 for a face with no escapes in it) : point the five
// slots at the escapes, or all five at the empty string. Every colour a
// row prints is one load from here, so this is the whole of the gate.
set_palette:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =pal_m
        ldr     x10, =colour_m
        ldr     x11, =empty_m
        mov     w12, 0
pal_next:
        cmp     w12, PALETTE
        b.ge    pal_done
        ldr     x13, [x10, w12, sxtw 3]
        cbz     w0, pal_put
        mov     x13, x11
pal_put:
        str     x13, [x9, w12, sxtw 3]
        add     w12, w12, 1
        b       pal_next
pal_done:
        ldp     fp, lr, [sp], 16
        ret

// say(w0 = palette slot, x1 = text) : one line in one colour, which is
// one plain line when the slots are empty.
say:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x2, x1
        ldr     x9, =pal_m
        ldr     x1, [x9, w0, sxtw]
        ldr     x3, [x9, P_OFF]
        ldr     x0, =fmt_line_m
        bl      printf

        ldp     fp, lr, [sp], 16
        ret

// say_field() : the input field, a labelled rule and a caret on the line
// below it. The caret ends the write, so the cursor the pane already
// blinks lands where the reading gets typed.
say_field:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =pal_m
        ldr     x1, [x9, P_GREY]
        ldr     x3, [x9, P_OFF]
        ldr     x2, =rule_m
        ldr     x0, =fmt_field_m
        bl      printf

        ldr     x9, =pal_m
        ldr     x1, [x9, P_CYAN]
        ldr     x2, [x9, P_OFF]
        ldr     x0, =fmt_caret_m
        bl      printf

        ldp     fp, lr, [sp], 16
        ret

// parsing

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

// same_word(x0 = token, x1 = word) -> w0 = 1 when they are the same word,
// either case. The word's own bytes are already lowercase, so folding it
// costs nothing and keeps one comparison for both sides.
same_word:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     w9, 0
word_next:
        ldrb    w10, [x0, w9, sxtw]
        ldrb    w11, [x1, w9, sxtw]
        cbz     w11, word_end
        cbz     w10, word_no            // fold first and a NUL would match
        orr     w10, w10, 32
        orr     w11, w11, 32
        cmp     w10, w11
        b.ne    word_no
        add     w9, w9, 1
        b       word_next
word_end:
        cbnz    w10, word_no            // the token carried on past the word
        mov     w0, 1
        b       word_done
word_no:
        mov     w0, 0
word_done:
        ldp     fp, lr, [sp], 16
        ret

// is_quit(x0 = token) -> w0 = 1 when the token is q or quit, either case
is_quit:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        str     token_r, [sp, -16]!
        mov     token_r, x0

        ldr     x1, =q_m
        bl      same_word
        cbnz    w0, quit_done
        mov     x0, token_r
        ldr     x1, =quit_m
        bl      same_word
quit_done:
        ldr     token_r, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// conversions

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

// band_of() -> w0 = which band cel_m landed in, coldest first
band_of:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =cel_m
        ldr     d0, [x9]

        ldr     x9, =frost_lo_m
        ldr     d1, [x9]
        fcmp    d0, d1
        b.lt    band_ice

        ldr     x9, =frost_hi_m
        ldr     d1, [x9]
        fcmp    d0, d1
        b.le    band_frost

        ldr     x9, =body_lo_m
        ldr     d1, [x9]
        fcmp    d0, d1
        b.lt    band_cool

        ldr     x9, =body_hi_m
        ldr     d1, [x9]
        fcmp    d0, d1
        b.le    band_body

        ldr     x9, =boiling_m
        ldr     d1, [x9]
        fcmp    d0, d1
        b.lt    band_warm

        mov     w0, BAND_STEAM
        b       band_done
band_ice:
        mov     w0, BAND_ICE
        b       band_done
band_frost:
        mov     w0, BAND_FROST
        b       band_done
band_cool:
        mov     w0, BAND_COOL
        b       band_done
band_body:
        mov     w0, BAND_BODY
        b       band_done
band_warm:
        mov     w0, BAND_WARM
band_done:
        ldp     fp, lr, [sp], 16
        ret

// band_tint(w0 = band) -> x0 = the colour that band's column fills in
band_tint:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =band_pal_m
        ldrb    w10, [x9, w0, sxtw]
        ldr     x9, =pal_m
        ldr     x0, [x9, w10, sxtw]

        ldp     fp, lr, [sp], 16
        ret

// instrument

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

// build_fill(w0 = column) : the bulb and the mercury behind it, up to
// and including the reading's column. Filled columns print '=' against
// the '-' of the empty rest, so the level still reads once the escapes
// are gone. Ticks survive the fill, since they are what it is measured
// against.
build_fill:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =fill_m
        ldr     x10, =bulb_m
        mov     w11, 0
fill_bulb:
        ldrb    w12, [x10, w11, sxtw]
        cbz     w12, fill_column
        strb    w12, [x9, w11, sxtw]
        add     w11, w11, 1
        b       fill_bulb
fill_column:
        ldr     x10, =bar_m
        mov     w13, 0
fill_next:
        cmp     w13, w0
        b.gt    fill_done
        ldrb    w12, [x10, w13, sxtw]
        cmp     w12, '+'
        b.eq    fill_put
        mov     w12, '='
fill_put:
        strb    w12, [x9, w11, sxtw]
        add     w11, w11, 1
        add     w13, w13, 1
        b       fill_next
fill_done:
        strb    wzr, [x9, w11, sxtw]

        ldp     fp, lr, [sp], 16
        ret

// build_pad(w0 = column) : the run of blanks that puts the pointer under
// its column once the row's fixed left margin and the bulb are counted.
build_pad:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =pad_m
        add     w1, w0, MARK_LEAD
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

// print_trio() : the answer line, shared by every face and free of escapes so
// a shell can pipe it.
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
        stp     row_r, band_r, [sp, -16]!
        stp     col_r, tint_r, [sp, -16]!

        bl      print_trio

        mov     w0, P_GREY
        ldr     x1, =face_m
        bl      say

        bl      band_of
        mov     band_r, x0
        bl      band_tint
        mov     tint_r, x0

        ldr     x9, =cel_m
        ldr     d0, [x9]
        bl      bar_column
        mov     col_r, x0
        bl      build_pad
        mov     x0, col_r
        bl      build_fill

        ldr     x9, =pal_m
        ldr     x1, [x9, P_AMBER]
        ldr     x3, [x9, P_OFF]
        ldr     x2, =pad_m
        ldr     x0, =fmt_mark_m
        bl      printf

        // The three scales share one thermometer because they are one
        // axis read three ways; only the end labels differ.
        mov     row_r, 0
face_rows:
        cmp     row_r, 3
        b.ge    face_rows_done

        lsl     x10, row_r, 3
        ldr     x9, =abszero_m
        add     x9, x9, x10
        ldr     d0, [x9]
        ldr     x9, =boiling_m
        add     x9, x9, x10
        ldr     d1, [x9]

        ldr     x9, =units_m
        ldrb    w2, [x9, row_r]

        // The empty rest of the row is the ruler itself, read from just
        // past where the fill stopped.
        ldr     x9, =bar_m
        add     x6, x9, col_r
        add     x6, x6, 1

        ldr     x9, =pal_m
        ldr     x1, [x9, P_GREY]
        ldr     x5, [x9, P_GREY]
        ldr     x7, [x9, P_OFF]
        mov     x3, tint_r
        ldr     x4, =fill_m
        ldr     x0, =fmt_row_m
        bl      printf

        add     row_r, row_r, 1
        b       face_rows
face_rows_done:

        mov     x0, band_r
        bl      say_note

        ldp     col_r, tint_r, [sp], 16
        ldp     row_r, band_r, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// say_note(w0 = band) : one line naming the band the reading landed in.
say_note:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =note_m
        ldr     x1, [x9, w0, sxtw 3]
        mov     w0, P_AMBER
        bl      say

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
        ldrb    w2, [x9, x10]
        mov     w3, w2
        ldr     x9, =abszero_m
        lsl     x11, x10, 3
        add     x9, x9, x11
        ldr     d1, [x9]
        ldr     x9, =pal_m
        ldr     x1, [x9, P_RED]
        ldr     x4, [x9, P_OFF]
        ldr     x0, =msg_floor_m
        bl      printf

        ldp     fp, lr, [sp], 16
        ret
