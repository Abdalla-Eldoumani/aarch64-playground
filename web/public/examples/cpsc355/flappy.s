// flappy - Flappy Bird's gameplay in ARMv8 assembly, drawn in the terminal
// with half blocks at 60 ticks a second.  Full project at
// https://github.com/Abdalla-Eldoumani/flappy-a64
//
// how to run: press run. The game takes over the terminal pane and grabs
// the keyboard.  Or from the term tab:  ./program
// The picture fits the pane: it needs at least 36 columns by 32 rows, and
// a smaller pane shows the size it has and the size it needs until it
// grows.  The pane's full screen button or zooming out gives it room.
//
// how to play: space, w, k, the up arrow, enter or a left click flaps,
// starts a round and plays again; p pauses, d shows the debug numbers,
// and q, esc or ctrl-c quits.  --autopilot in the args box lets it play
// by itself, and --size 48x43 makes it draw for that many columns and
// rows.  The best score is written to the file .flappy_best, which here
// lasts until the next run.
//
// The shared definitions come first, then main; the files under flappy/
// follow in the order the repo's one-file bundle pastes them.

// Shared definitions for every source file: frame aliases, syscalls, layout, physics.
// Constants are assembler symbols so m4 never rewrites them; only register aliases are m4.
//
// Byte budget, from size -A on each object (each section must stay under 1 MiB)
//   .bss    main  display buffers 2 x 36864                     73728
//                 flap list 4096 x 4, dump list 1024 x 4        20480
//                 line, path, settings, debug text, bench        1248
//                 sigaction for SIGTERM                            32
//           gfx   logical scratch 240 x 256                     61440
//                 static background                             36864
//                 rotated bird, 69 boxes of 24 x 24             39744
//                 ground strip 240 x 56                         13440
//                 UI words baked for the scale                  16384
//                 text bitmap, debug overlay                     8704
//                 division table, sprites, digits, tables        6344
//           term  output buffer                                131072
//                 colour strings 2 x 64 x 24, decimals, state    7256
//                 palette last sent 64 x 4                        256
//           art   palette, legend map                             392
//           sim   state 26 x 8, masks 36 x 4                      352
//           tty   termios x 2, input buffer, decoder, sign        312
//           save  ppm row buffer, header, best score              512
//                 total                                        418560
//   .rodata art   palettes, sprites, fonts, UI words             8764
//           rest  messages and tables                             956
//                 total                                          9720

define(fp, x29)
define(lr, x30)

// syscalls (the twelve the playground implements)
SYS_FCNTL = 25
SYS_IOCTL = 29
SYS_OPENAT = 56
SYS_CLOSE = 57
SYS_LSEEK = 62
SYS_READ = 63
SYS_WRITE = 64
SYS_EXIT = 93
SYS_EXIT_GROUP = 94
SYS_NANOSLEEP = 101
SYS_CLOCK_GETTIME = 113
SYS_GETRANDOM = 278

EINTR = 4
EIO = 5
EAGAIN = 11
AT_FDCWD = -100
O_RDONLY = 0
O_WRONLY = 1
O_CREAT = 64
O_TRUNC = 512
O_NONBLOCK = 0x800
// a file written whole each time: created when missing, emptied when there, mode rw-r--r--
FILE_NEW = O_WRONLY + O_CREAT + O_TRUNC
FILE_MODE = 420
F_GETFL = 3
F_SETFL = 4
CLOCK_MONOTONIC = 1
TCGETS = 0x5401
TCSETS = 0x5402
TIOCGWINSZ = 0x5413

// playfield, in logical pixels
LOG_W = 144
LOG_H = 256
GROUND_Y = 200

// physics, Q8 (1/256 px) per tick at 60 Hz; each tuning value is set once, the rest derive
SIM_GRAVITY = 64
SIM_FLAP_VY = -576
SIM_MAX_FALL = 640
SIM_HIT_GRAVITY = 128
SIM_HIT_MAX_FALL = 960
SIM_CEIL_PX = -24
SIM_TILT_FLAP = 90
SIM_TILT_STEP = 3
SIM_TILT_MIN = -180
SIM_TILT_HIT_STEP = 7
SIM_TILT_DRAW_MAX = 40
SIM_WING_TICKS = 6
SIM_BOB_STEP = 64
SIM_BOB_MAX = 1024
SIM_BIRD_X = 28
SIM_BIRD_W = 17
SIM_BIRD_H = 12
SIM_BIRD_LOW = 11
SIM_BIRD_Y0 = 122
SIM_PIPES = 4
SIM_PIPE_SPACING = 72
SIM_PIPE_FIRST_X = 244
SIM_PIPE_CAP_W = 26
SIM_PIPE_CAP_H = 12
SIM_GAP_H = 50
SIM_GAP_MIN = 40
SIM_GAP_RANGE = 71
SIM_PIPE_NONE = 1000
SIM_THEMES = 2
SIM_COLOURS = 3
SIM_GROUND_PERIOD = 24
SIM_OVER_LOCK = 90
SIM_FADE_TICKS = 20
SIM_AP_DELAY = 30
SIM_AP_MARGIN = 16
SIM_TITLE_X = 64
// medals: one per GFX_MEDAL_STEP points, bronze to platinum; the hit flash fades this long
GFX_MEDAL_STEP = 10
GFX_MEDALS = 4
GFX_FLASH_TICKS = 18

// art geometry, shared because the sprites are decoded and placed in other files
ART_FRAMES = 3
ART_CLOUD_W = 48
ART_CLOUD_H = 12
ART_CLOUD_PX = ART_CLOUD_W * ART_CLOUD_H
ART_CITY_W = 48
ART_CITY_H = 26
ART_CITY_PX = ART_CITY_W * ART_CITY_H
ART_BUSH_W = 36
ART_BUSH_H = 16
ART_BUSH_PX = ART_BUSH_W * ART_BUSH_H
ART_GROUND_H = 12
ART_GROUND_PX = SIM_GROUND_PERIOD * ART_GROUND_H
ART_CAP_PX = SIM_PIPE_CAP_W * SIM_PIPE_CAP_H
ART_BODY_W = SIM_PIPE_CAP_W - 2
// the bird drawn again at scales 2 to 4, where shrinking would lose it
ART_BIRD2_W = 9
ART_BIRD2_H = 6
ART_BIRD3_W = 6
ART_BIRD3_H = 4
ART_BIRD4_W = 5
ART_BIRD4_H = 3
// glyph text: w x h characters plus a slash between rows
ART_BIG_W = 6
ART_BIG_H = 10
ART_BIG_STEP = ART_BIG_W * ART_BIG_H + ART_BIG_H - 1
ART_F5_W = 5
ART_F5_H = 7
ART_F5_STEP = ART_F5_W * ART_F5_H + ART_F5_H - 1
ART_F3_W = 3
ART_F3_H = 5
ART_F3_STEP = ART_F3_W * ART_F3_H + ART_F3_H - 1
ART_DIGIT0 = 26
ART_CLEAR = 46
ART_ON = 43
ART_SLASH = 47
ART_CHAR_A = 65
ART_CHAR_0 = 48
ART_DIGIT_LAST = 9
ART_LINE = 95
ART_MEDAL1 = 15
ART_MEDAL2 = 8
ART_MEDAL3 = 5
ART_SPARK1 = 5
ART_SPARK2 = 3
ART_SPARK3 = 1
ART_UI_WORDS = 13

SIM_CEIL = SIM_CEIL_PX * 256
SIM_Y0_Q8 = SIM_BIRD_Y0 * 256
SIM_Y_MAX = (GROUND_Y - SIM_BIRD_LOW) * 256
SIM_BIRD_X1 = SIM_BIRD_X + SIM_BIRD_W - 1
SIM_BIRD_MID = SIM_BIRD_W / 2
SIM_PIPE_MID = SIM_PIPE_CAP_W / 2
SIM_CAP_X1 = SIM_PIPE_CAP_W - 1
SIM_BODY_X1 = SIM_PIPE_CAP_W - 2
SIM_PIPE_OFF = 0 - SIM_PIPE_CAP_W
SIM_PIPE_WRAP = SIM_PIPES * SIM_PIPE_SPACING
SIM_SCORE_X = SIM_BIRD_X + SIM_BIRD_MID - SIM_PIPE_MID
SIM_NEXT_X = SIM_BIRD_X - SIM_CAP_X1
SIM_LOW_CAP = SIM_GAP_H + SIM_PIPE_CAP_H
SIM_MASK_LAST = SIM_BIRD_W - 1
SIM_MASK_BYTES = SIM_BIRD_H * 4
SIM_MASK_ROWS = ART_FRAMES * SIM_BIRD_H
SIM_MASKS_SIZE = ART_FRAMES * SIM_MASK_BYTES
SIM_AP_OVER = SIM_OVER_LOCK + SIM_AP_DELAY
SIM_AP_BIRD = SIM_BIRD_H / 2
SIM_AP_GAP = SIM_GAP_H / 2 + SIM_AP_MARGIN

// states; the title is 0, the zeroed field, so code tests it with cbz and cbnz
SIM_READY = 1
SIM_PLAY = 2
SIM_DYING = 3
SIM_OVER = 4
SIM_FADE = 5

// sim state fields, 8 bytes each, hashed in this order
SIM_STATE = 0
SIM_ST = 8
SIM_Y = 16
SIM_VY = 24
SIM_GC = 32
SIM_TILT = 40
SIM_WING = 48
SIM_WSUB = 56
SIM_BOB = 64
SIM_BOBD = 72
SIM_GROUNDX = 80
SIM_SCORE = 88
SIM_HITPIPE = 96
SIM_HITT = 104
SIM_THEME = 112
SIM_BIRDC = 120
SIM_RNG = 128
SIM_TCOUNT = 136
SIM_PIPEX = 144
// SIM_PIPES records from SIM_PIPEX: each pipe x, then the top of its gap
SIM_PIPE_GAP = 8
SIM_PIPE_REC = 16
SIM_PIPE_BYTES = SIM_PIPES * SIM_PIPE_REC
SIM_SIZE = SIM_PIPEX + SIM_PIPE_BYTES

// colour slots: what each pixel stores; a palette maps them to RGB
SLOT_BORDER = 0
SLOT_SKY1 = 1
SLOT_SKY2 = 2
SLOT_CLOUD = 3
SLOT_CLOUD2 = 4
SLOT_CITY = 5
SLOT_CITY2 = 6
SLOT_WINDOW = 7
SLOT_BUSH = 8
SLOT_BUSH2 = 9
SLOT_GLINE = 10
SLOT_GRASS = 11
SLOT_GRASS2 = 12
SLOT_GRASSDK = 13
SLOT_DIRT = 14
SLOT_DIRT2 = 15
SLOT_POUT = 16
SLOT_PLIGHT = 17
SLOT_PMID = 18
SLOT_PDARK = 19
SLOT_BOUT = 20
SLOT_BODY = 21
SLOT_BSHADE = 22
SLOT_BELLY = 23
SLOT_WING = 24
SLOT_EYE = 25
SLOT_PUPIL = 26
SLOT_BEAK = 27
SLOT_BEAK2 = 28
SLOT_WHITE = 29
SLOT_TOUT = 30
SLOT_PANEL = 31
SLOT_PEDGE = 32
SLOT_LABEL = 33
SLOT_WORD = 34
SLOT_NEW = 35
SLOT_MED1 = 36
SLOT_MED2 = 37
SLOT_MED3 = 38
SLOT_COUNT = 64
// a decoded sprite pixel with this value is transparent
SLOT_CLEAR = 255

// display, at scale 1
GFX_MAX_BUF = LOG_W * LOG_H
GFX_SCALE_MAX = 4
// the lite profile's first scale, so its picture is never larger than s = 3; term fits the
// picture from it, and gfx shows the title's zoom hint only above it, where zooming out helps
TERM_LITE_FIRST = 3
TERM_OUT_SIZE = 131072
// the encoder checks for room only between rows, so the slack holds the longest row: at s = 1
// a first cell of at most 49 bytes, 143 more of at most 45, and 16 that word stores write past
// the end: 6,500 bytes at most
TERM_OUT_SLACK = 8192
// where the bench adds up each kind of byte in term_bsplit, which main prints per frame
TERM_SPLIT_CURSOR = 0
TERM_SPLIT_COLOUR = 8
TERM_SPLIT_GLYPH = 16
TERM_SPLIT_OTHER = 24
TERM_SPLIT_BYTES = TERM_SPLIT_OTHER + 8
// flappy: a remake of Flappy Bird's gameplay for a terminal, in AArch64 assembly.
// main_: arguments, start-up order, the paced loop, shutdown and the headless modes.

define(main_argc_r, x19)
define(main_argv_r, x20)
define(main_i_r, x21)
define(main_t_r, x22)
define(main_next_r, x23)
define(main_phase_r, x24)
define(main_ran_r, x25)
define(main_now_r, x26)
define(main_since_r, x27)
define(main_k_r, x28)
define(main_arg_r, x19)
define(main_dst_r, x20)
define(main_cap_r, x21)
define(main_cnt_r, x22)
define(main_sim_r, x19)
define(main_dbg_r, x19)
define(main_tl_r, x19)
define(main_bt_r, x23)
define(main_bv_r, x24)

MAIN_HEADLESS = 1
MAIN_RENDER = 2
MAIN_BENCH = 3
// a tally: minimum, maximum, sum, count
MAIN_T_MIN = 0
MAIN_T_MAX = 8
MAIN_T_SUM = 16
MAIN_T_N = 24
MAIN_T_BYTES = MAIN_T_N + 8
MAIN_FLAP_MAX = 4096
MAIN_DUMP_MAX = 1024
// both lists hold 32-bit ticks
MAIN_FLAPS_BYTES = MAIN_FLAP_MAX * 4
MAIN_DUMPS_BYTES = MAIN_DUMP_MAX * 4
MAIN_LINE_BYTES = 256
MAIN_PATH_BYTES = 512
MAIN_PERIOD = 16666667
MAIN_PERIOD3 = 16666666
MAIN_CATCHUP = 5
// as many ticks as either profile waits for before it draws
MAIN_FORCE = 2
MAIN_RESIZE = 30
MAIN_LINE_TICKS = 60
MAIN_MS = 1000000
MAIN_SECOND = 1000000000
// the debug numbers refresh twice a second; outlining the text costs too much per frame
MAIN_DBG_FRAMES = 30
MAIN_NUM_CAP = 1000000000000
// the characters of the text main reads and writes: --flaps and --dump-frames split ticks by
// commas and --size takes columns x rows, where setting MAIN_LOWER on the x accepts an X too;
// output lines split fields by spaces, and a dump path puts a slash after its folder
MAIN_LF = 10
MAIN_SPACE = 32
MAIN_COMMA = 44
MAIN_MINUS = 45
MAIN_SLASH = 47
MAIN_SIZE_X = 120
MAIN_LOWER = 32
// a hex digit from ten up is a letter: the digit plus this gives a for ten
MAIN_HEX_LETTER = 87
// numbers in arguments and output lines are decimal, and a hex digit below ten is a digit too
MAIN_DEC_BASE = 10
// the lite profile outside the playground catches SIGTERM to give the terminal its palette back.
// rt_sigaction is the one syscall here that the playground lacks, and only a terminal without
// the playground's sign makes it. A sigaction is a handler, flags, a restorer and a mask of 8
// bytes; the exit status is the one a shell gives a death by SIGTERM, 128 plus the signal.
MAIN_SYS_SIGACTION = 134
MAIN_SIGTERM = 15
MAIN_SIGSET_BYTES = 8
MAIN_SIGACT_BYTES = 32
MAIN_SIGNALLED = 128
MAIN_TERM_STATUS = MAIN_SIGNALLED + MAIN_SIGTERM

        .section .rodata
main_o_headless:    .asciz  "--headless"
main_o_render:      .asciz  "--render-out"
main_o_bench:       .asciz  "--bench"
main_o_auto:        .asciz  "--autopilot"
main_o_lite:        .asciz  "--lite"
main_o_stats:       .asciz  "--stats"
main_o_ticks:       .asciz  "--ticks"
main_o_seed:        .asciz  "--seed"
main_o_flaps:       .asciz  "--flaps"
main_o_dumps:       .asciz  "--dump-frames"
main_o_dumpdir:     .asciz  "--dump-dir"
main_o_size:        .asciz  "--size"
main_s_idx:         .asciz  "render.idx"
main_s_ppm:         .asciz  ".ppm"
main_s_end:         .asciz  "END "
main_s_bframes:     .asciz  "frames "
main_s_bns:         .asciz  "; ns per frame "
main_s_bbytes:      .asciz  "; bytes per frame "
main_s_bmin:        .asciz  "min "
main_s_bavg:        .asciz  " avg "
main_s_bmax:        .asciz  " max "
main_s_bcur:        .asciz  "; average cursor "
main_s_bcol:        .asciz  " colour "
main_s_bgly:        .asciz  " glyph "
main_s_both:        .asciz  " other "
main_s_fps:         .asciz  "FPS "
main_s_bytes:       .asciz  "_B "
main_s_avg:         .asciz  "_AVG "
main_s_scale:       .asciz  "_S"
main_s_full:        .asciz  " FULL"
main_s_lite:        .asciz  " LITE"
main_s_drop:        .asciz  "_DROP "
main_s_dbg_end:
// the overlay's text holds every word above, five numbers and a zero; main_fmt_dec writes at
// most MAIN_DEC_MAX characters for one number
MAIN_DEC_MAX = 20
// a dump path is the --dump-dir, a slash, a tick and .ppm with its zero, all in main_path
MAIN_PPM_BYTES = main_s_end - main_s_ppm
MAIN_DIR_MAX = MAIN_PATH_BYTES - MAIN_DEC_MAX - MAIN_PPM_BYTES - 1
MAIN_DBG_NUMS = 5
MAIN_DBG_BYTES = main_s_dbg_end - main_s_fps + MAIN_DBG_NUMS * MAIN_DEC_MAX + 1
main_e_tty:
        .ascii  "flappy: stdin is not a terminal; --headless and --render-out run without one"
        .byte   MAIN_LF
main_e_tty_end:
main_e_arg:         .ascii  "flappy: bad argument: "
main_e_arg_end:
main_e_small:
        .ascii  "flappy: the --size given is too small, the game needs 36x32"
        .byte   MAIN_LF
main_e_small_end:
main_e_idx:
        .ascii  "flappy: cannot write render.idx here"
        .byte   MAIN_LF
main_e_idx_end:

MAIN_E_TTY_LEN = main_e_tty_end - main_e_tty
MAIN_E_ARG_LEN = main_e_arg_end - main_e_arg
MAIN_E_SMALL_LEN = main_e_small_end - main_e_small
MAIN_E_IDX_LEN = main_e_idx_end - main_e_idx

        .bss
        .balign 64
main_bufa:      .skip   GFX_MAX_BUF
main_bufb:      .skip   GFX_MAX_BUF
main_flaps:     .skip   MAIN_FLAPS_BYTES
main_dumps:     .skip   MAIN_DUMPS_BYTES
main_line:      .skip   MAIN_LINE_BYTES
main_path:      .skip   MAIN_PATH_BYTES
main_ts:        .skip   16
        .balign 8
        .global main_size_c
        .global main_size_r
main_size_c:    .skip   8
main_size_r:    .skip   8
main_mode:      .skip   8
main_ticks:     .skip   8
main_seed:      .skip   8
main_seeded:    .skip   8
main_auto:      .skip   8
        .global main_lite
main_lite:      .skip   8
main_stats:     .skip   8
main_nflaps:    .skip   8
main_fi:        .skip   8
main_ndumps:    .skip   8
main_di:        .skip   8
main_dumpdir:   .skip   8
main_back:      .skip   8
main_front:     .skip   8
main_scale:     .skip   8
main_palnew:    .skip   8
main_frames:    .skip   8
main_simticks:  .skip   8
main_dropped:   .skip   8
main_start:     .skip   8
main_idxfd:     .skip   8
main_lastc:     .skip   8
main_lastr:     .skip   8
main_bns:       .skip   MAIN_T_BYTES
main_bbytes:    .skip   MAIN_T_BYTES
main_lastfl:    .skip   8
main_prevst:    .skip   8
main_dbgn:      .skip   8
main_fpst:      .skip   8
main_fpsn:      .skip   8
main_lastb:     .skip   8
main_dbgtxt:    .skip   MAIN_DBG_BYTES
        .balign 8
        .global main_pace
main_pace:      .skip   8
main_sigact:    .skip   MAIN_SIGACT_BYTES

        .text

// main_streq(x0 = a, x1 = b) -> w0 = 1 when the two strings match
        .balign 4
main_streq:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
main_streq_loop:
        ldrb    w9, [x0], 1
        ldrb    w10, [x1], 1
        cmp     w9, w10
        b.ne    main_streq_no
        cbnz    w9, main_streq_loop
        mov     w0, 1
        b       main_streq_done
main_streq_no:
        mov     w0, 0
main_streq_done:
        ldp     fp, lr, [sp], 16
        ret

// main_strlen(x0 = string) -> x0 = length
        .balign 4
main_strlen:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x9, x0
main_strlen_loop:
        ldrb    w10, [x9], 1
        cbnz    w10, main_strlen_loop
        sub     x0, x9, x0
        sub     x0, x0, 1
        ldp     fp, lr, [sp], 16
        ret

// main_num(x0 = string) -> x0 = value, x1 = first byte after the digits, w2 = 1 if any digit
        .balign 4
main_num:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x1, x0
        mov     x0, 0
        mov     w2, 0
        mov     x11, MAIN_DEC_BASE
        ldr     x12, =MAIN_NUM_CAP
        b       main_num_test
main_num_digit:
        madd    x0, x0, x11, x10
        cmp     x0, x12
        csel    x0, x0, x12, le
        mov     w2, 1
        add     x1, x1, 1
main_num_test:
        ldrb    w9, [x1]
        sub     w10, w9, ART_CHAR_0
        cmp     w10, ART_DIGIT_LAST
        b.ls    main_num_digit
        ldp     fp, lr, [sp], 16
        ret

// main_cpy(x0 = dest, x1 = string) -> x0 = dest end, the NUL not copied
        .balign 4
main_cpy:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        b       main_cpy_test
main_cpy_byte:
        strb    w9, [x0], 1
main_cpy_test:
        ldrb    w9, [x1], 1
        cbnz    w9, main_cpy_byte
        ldp     fp, lr, [sp], 16
        ret

// main_fmt_dec(x0 = signed value, x1 = dest) -> x0 = end of the digits
main_fmt_alloc = -(16 + 32) & -16
main_fmt_dealloc = 0 - main_fmt_alloc
main_fmt_digits = 16
        .balign 4
        .global main_fmt_dec
main_fmt_dec:
        stp     fp, lr, [sp, main_fmt_alloc]!
        mov     fp, sp
        tbz     x0, 63, main_fmt_pos
        mov     w9, MAIN_MINUS
        strb    w9, [x1], 1
        neg     x0, x0
main_fmt_pos:
        add     x9, sp, main_fmt_digits
        mov     x10, 0
        mov     x11, MAIN_DEC_BASE
main_fmt_split:
        udiv    x12, x0, x11
        msub    x13, x12, x11, x0
        add     w13, w13, ART_CHAR_0
        strb    w13, [x9, x10]
        add     x10, x10, 1
        mov     x0, x12
        cbnz    x0, main_fmt_split
main_fmt_out:
        sub     x10, x10, 1
        ldrb    w13, [x9, x10]
        strb    w13, [x1], 1
        cbnz    x10, main_fmt_out
        mov     x0, x1
        ldp     fp, lr, [sp], main_fmt_dealloc
        ret

// main_fmt_hex(x0 = value, x1 = dest) -> x0 = end of 16 lowercase hex digits
        .balign 4
main_fmt_hex:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x9, 60
main_hex_loop:
        lsr     x10, x0, x9
        and     x10, x10, 15
        add     x11, x10, ART_CHAR_0
        add     x12, x10, MAIN_HEX_LETTER
        cmp     x10, MAIN_DEC_BASE
        csel    x10, x11, x12, lt
        strb    w10, [x1], 1
        subs    x9, x9, 4
        b.ge    main_hex_loop
        mov     x0, x1
        ldp     fp, lr, [sp], 16
        ret

// main_write(w0 = fd, x1 = start, x2 = end): writes [start, end)
        .balign 4
main_write:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        sub     x2, x2, x1
        bl      tty_write_all
        ldp     fp, lr, [sp], 16
        ret

// main_clock() -> x0 = CLOCK_MONOTONIC in nanoseconds
        .balign 4
main_clock:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x0, CLOCK_MONOTONIC
        ldr     x1, =main_ts
        mov     x8, SYS_CLOCK_GETTIME
        svc     0
        ldr     x9, =main_ts
        ldp     x10, x11, [x9]
        ldr     x12, =MAIN_SECOND
        madd    x0, x10, x12, x11
        ldp     fp, lr, [sp], 16
        ret

// main_exit(w0 = status): leaves raw mode and ends the process; never returns
main_exit_alloc = -(16 + 8) & -16
        .balign 4
        .global main_exit
main_exit:
        stp     fp, lr, [sp, main_exit_alloc]!
        mov     fp, sp
        str     main_arg_r, [sp, 16]
        mov     main_arg_r, x0
        bl      tty_close
        mov     x0, main_arg_r
        mov     x8, SYS_EXIT_GROUP
        svc     0

// main_badarg(x0 = argument): reports it on stderr and exits with status 2
main_badarg_alloc = -(16 + 8) & -16
        .balign 4
main_badarg:
        stp     fp, lr, [sp, main_badarg_alloc]!
        mov     fp, sp
        str     main_arg_r, [sp, 16]
        mov     main_arg_r, x0
        mov     w0, 2
        ldr     x1, =main_e_arg
        mov     x2, MAIN_E_ARG_LEN
        bl      tty_write_all
        mov     x0, main_arg_r
        bl      main_strlen
        mov     x2, x0
        mov     w0, 2
        mov     x1, main_arg_r
        bl      tty_write_all
        ldr     x1, =main_line
        mov     w9, MAIN_LF
        strb    w9, [x1]
        mov     w0, 2
        mov     x2, 1
        bl      tty_write_all
        mov     w0, 2
        bl      main_exit

// main_list(x0 = string, x1 = dest words, x2 = capacity) -> x0 = count; a malformed list exits
main_list_alloc = -(16 + 32 + 8) & -16
main_list_dealloc = 0 - main_list_alloc
main_list_whole = 48
        .balign 4
main_list:
        stp     fp, lr, [sp, main_list_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        mov     main_arg_r, x0
        mov     main_dst_r, x1
        mov     main_cap_r, x2
        mov     main_cnt_r, 0
        str     x0, [sp, main_list_whole]
main_list_loop:
        mov     x0, main_arg_r
        bl      main_num
        cbz     w2, main_list_bad
        cmp     main_cnt_r, main_cap_r
        b.ge    main_list_bad
        str     w0, [main_dst_r, main_cnt_r, lsl 2]
        add     main_cnt_r, main_cnt_r, 1
        ldrb    w9, [x1]
        add     main_arg_r, x1, 1
        cmp     w9, MAIN_COMMA
        b.eq    main_list_loop
        cbz     w9, main_list_done
main_list_bad:
        ldr     x0, [sp, main_list_whole]
        bl      main_badarg
main_list_done:
        mov     x0, main_cnt_r
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     fp, lr, [sp], main_list_dealloc
        ret

// main_value(x0 = string) -> x0 = the whole string as a number; anything else exits
main_value_alloc = -(16 + 8) & -16
main_value_dealloc = 0 - main_value_alloc
        .balign 4
main_value:
        stp     fp, lr, [sp, main_value_alloc]!
        mov     fp, sp
        str     main_arg_r, [sp, 16]
        mov     main_arg_r, x0
        bl      main_num
        cbz     w2, main_value_bad
        ldrb    w9, [x1]
        cbnz    w9, main_value_bad
        ldr     main_arg_r, [sp, 16]
        ldp     fp, lr, [sp], main_value_dealloc
        ret
main_value_bad:
        mov     x0, main_arg_r
        bl      main_badarg

// main_parse(): reads every argument into the main_ settings
main_parse_alloc = -(16 + 16 + 8) & -16
main_parse_dealloc = 0 - main_parse_alloc
main_parse_value = 32
        .balign 4
main_parse:
        stp     fp, lr, [sp, main_parse_alloc]!
        mov     fp, sp
        stp     x21, x28, [sp, 16]
        mov     main_i_r, 1
        b       main_parse_test
main_parse_loop:
        ldr     main_k_r, [main_argv_r, main_i_r, lsl 3]
        mov     x0, main_k_r
        ldr     x1, =main_o_headless
        bl      main_streq
        cbz     w0, main_parse_render
        mov     x9, MAIN_HEADLESS
        ldr     x10, =main_mode
        str     x9, [x10]
        b       main_parse_next
main_parse_render:
        mov     x0, main_k_r
        ldr     x1, =main_o_render
        bl      main_streq
        cbz     w0, main_parse_bench
        mov     x9, MAIN_RENDER
        ldr     x10, =main_mode
        str     x9, [x10]
        b       main_parse_next
main_parse_bench:
        mov     x0, main_k_r
        ldr     x1, =main_o_bench
        bl      main_streq
        cbz     w0, main_parse_auto
        mov     x9, MAIN_BENCH
        ldr     x10, =main_mode
        str     x9, [x10]
        b       main_parse_next
main_parse_auto:
        mov     x0, main_k_r
        ldr     x1, =main_o_auto
        bl      main_streq
        cbz     w0, main_parse_lite
        ldr     x10, =main_auto
        b       main_parse_flag
main_parse_lite:
        mov     x0, main_k_r
        ldr     x1, =main_o_lite
        bl      main_streq
        cbz     w0, main_parse_stats
        ldr     x10, =main_lite
        b       main_parse_flag
main_parse_stats:
        mov     x0, main_k_r
        ldr     x1, =main_o_stats
        bl      main_streq
        cbz     w0, main_parse_valued
        ldr     x10, =main_stats
main_parse_flag:
        mov     x9, 1
        str     x9, [x10]
        b       main_parse_next
main_parse_valued:
        // every remaining option takes a value
        add     main_i_r, main_i_r, 1
        cmp     main_i_r, main_argc_r
        b.ge    main_parse_bad
        ldr     x9, [main_argv_r, main_i_r, lsl 3]
        str     x9, [sp, main_parse_value]
        mov     x0, main_k_r
        ldr     x1, =main_o_ticks
        bl      main_streq
        cbz     w0, main_parse_seed
        ldr     x0, [sp, main_parse_value]
        bl      main_value
        ldr     x10, =main_ticks
        str     x0, [x10]
        b       main_parse_next
main_parse_seed:
        mov     x0, main_k_r
        ldr     x1, =main_o_seed
        bl      main_streq
        cbz     w0, main_parse_flaps
        ldr     x0, [sp, main_parse_value]
        bl      main_value
        ldr     x10, =main_seed
        str     x0, [x10]
        ldr     x10, =main_seeded
        mov     x9, 1
        str     x9, [x10]
        b       main_parse_next
main_parse_flaps:
        mov     x0, main_k_r
        ldr     x1, =main_o_flaps
        bl      main_streq
        cbz     w0, main_parse_dumps
        ldr     x0, [sp, main_parse_value]
        ldr     x1, =main_flaps
        mov     x2, MAIN_FLAP_MAX
        bl      main_list
        ldr     x10, =main_nflaps
        str     x0, [x10]
        b       main_parse_next
main_parse_dumps:
        mov     x0, main_k_r
        ldr     x1, =main_o_dumps
        bl      main_streq
        cbz     w0, main_parse_dir
        ldr     x0, [sp, main_parse_value]
        ldr     x1, =main_dumps
        mov     x2, MAIN_DUMP_MAX
        bl      main_list
        ldr     x10, =main_ndumps
        str     x0, [x10]
        b       main_parse_next
main_parse_dir:
        mov     x0, main_k_r
        ldr     x1, =main_o_dumpdir
        bl      main_streq
        cbz     w0, main_parse_size
        ldr     x0, [sp, main_parse_value]
        bl      main_strlen
        cmp     x0, MAIN_DIR_MAX
        b.gt    main_parse_badv
        ldr     x9, [sp, main_parse_value]
        ldr     x10, =main_dumpdir
        str     x9, [x10]
        b       main_parse_next
main_parse_size:
        mov     x0, main_k_r
        ldr     x1, =main_o_size
        bl      main_streq
        cbz     w0, main_parse_bad
        ldr     x0, [sp, main_parse_value]
        bl      main_num
        cbz     w2, main_parse_badv
        cbz     x0, main_parse_badv
        ldrb    w9, [x1]
        orr     w9, w9, MAIN_LOWER
        cmp     w9, MAIN_SIZE_X
        b.ne    main_parse_badv
        ldr     x10, =main_size_c
        str     x0, [x10]
        add     x0, x1, 1
        bl      main_value
        cbz     x0, main_parse_badv
        ldr     x10, =main_size_r
        str     x0, [x10]
        b       main_parse_next
main_parse_badv:
        ldr     x0, [sp, main_parse_value]
        bl      main_badarg
main_parse_bad:
        mov     x0, main_k_r
        bl      main_badarg
main_parse_next:
        add     main_i_r, main_i_r, 1
main_parse_test:
        cmp     main_i_r, main_argc_r
        b.lt    main_parse_loop
        ldp     x21, x28, [sp, 16]
        ldp     fp, lr, [sp], main_parse_dealloc
        ret

// main_seed_sim(): seeds the game from --seed or from getrandom
        .balign 4
main_seed_sim:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =main_seeded
        ldr     x9, [x9]
        cbnz    x9, main_seed_have
        ldr     x0, =main_seed
        mov     x1, 8
        mov     x2, 0
        mov     x8, SYS_GETRANDOM
        svc     0
main_seed_have:
        ldr     x9, =main_seed
        ldr     x0, [x9]
        bl      sim_init
        ldp     fp, lr, [sp], 16
        ret

// main_press(x0 = tick) -> w0 = 1 when the autopilot or the flap list presses on this tick
main_press_alloc = -(16 + 8 + 8) & -16
main_press_dealloc = 0 - main_press_alloc
main_press_tick = 24
        .balign 4
main_press:
        stp     fp, lr, [sp, main_press_alloc]!
        mov     fp, sp
        str     main_arg_r, [sp, 16]
        str     x0, [sp, main_press_tick]
        mov     main_arg_r, 0
        ldr     x9, =main_auto
        ldr     x9, [x9]
        cbz     x9, main_press_list
        bl      sim_autopilot
        mov     main_arg_r, x0
main_press_list:
        ldr     x0, [sp, main_press_tick]
        ldr     x9, =main_fi
        ldr     x10, [x9]
        ldr     x11, =main_nflaps
        ldr     x11, [x11]
        ldr     x12, =main_flaps
        b       main_press_test
main_press_scan:
        cset    x14, eq
        orr     main_arg_r, main_arg_r, x14
        add     x10, x10, 1
main_press_test:
        cmp     x10, x11
        b.ge    main_press_done
        ldr     w13, [x12, x10, lsl 2]
        cmp     x13, x0
        b.le    main_press_scan
main_press_done:
        str     x10, [x9]
        mov     x0, main_arg_r
        ldr     main_arg_r, [sp, 16]
        ldp     fp, lr, [sp], main_press_dealloc
        ret

// main_status(x0 = tick): one headless line, "t score y vy state hash"
main_status_alloc = -(16 + 8 + 8) & -16
main_status_dealloc = 0 - main_status_alloc
main_status_end = 24
        .balign 4
main_status:
        stp     fp, lr, [sp, main_status_alloc]!
        mov     fp, sp
        str     main_sim_r, [sp, 16]
        ldr     x1, =main_line
        bl      main_fmt_dec
        ldr     main_sim_r, =sim_s
        mov     w9, MAIN_SPACE
        strb    w9, [x0], 1
        mov     x1, x0
        ldr     x0, [main_sim_r, SIM_SCORE]
        bl      main_fmt_dec
        mov     w9, MAIN_SPACE
        strb    w9, [x0], 1
        mov     x1, x0
        ldr     x0, [main_sim_r, SIM_Y]
        bl      main_fmt_dec
        mov     w9, MAIN_SPACE
        strb    w9, [x0], 1
        mov     x1, x0
        ldr     x0, [main_sim_r, SIM_VY]
        bl      main_fmt_dec
        mov     w9, MAIN_SPACE
        strb    w9, [x0], 1
        mov     x1, x0
        ldr     x0, [main_sim_r, SIM_STATE]
        bl      main_fmt_dec
        mov     w9, MAIN_SPACE
        strb    w9, [x0], 1
        str     x0, [sp, main_status_end]
        bl      sim_hash
        ldr     x1, [sp, main_status_end]
        bl      main_fmt_hex
        mov     w9, MAIN_LF
        strb    w9, [x0], 1
        mov     x2, x0
        mov     w0, 1
        ldr     x1, =main_line
        bl      main_write
        ldr     main_sim_r, [sp, 16]
        ldp     fp, lr, [sp], main_status_dealloc
        ret

// main_headless(): the simulation alone, no terminal and no art
main_headless_alloc = -(16 + 16 + 8) & -16
main_headless_dealloc = 0 - main_headless_alloc
main_headless_end = 32
        .balign 4
main_headless:
        stp     fp, lr, [sp, main_headless_alloc]!
        mov     fp, sp
        stp     x22, x28, [sp, 16]
        bl      main_seed_sim
        mov     main_t_r, 0
        mov     main_k_r, 0
        b       main_hl_test
main_hl_loop:
        add     main_t_r, main_t_r, 1
        mov     x0, main_t_r
        bl      main_press
        bl      sim_tick
        add     main_k_r, main_k_r, 1
        cmp     main_k_r, MAIN_LINE_TICKS
        b.ne    main_hl_test
        mov     main_k_r, 0
        mov     x0, main_t_r
        bl      main_status
        // the sleep changes nothing printed; it keeps the playground's step budget topped up
        ldr     x0, =MAIN_MS
        bl      tty_sleep
main_hl_test:
        ldr     x9, =main_ticks
        ldr     x9, [x9]
        cmp     main_t_r, x9
        b.lt    main_hl_loop
        ldr     x0, =main_line
        ldr     x1, =main_s_end
        bl      main_cpy
        mov     x1, x0
        mov     x0, main_t_r
        bl      main_fmt_dec
        mov     w9, MAIN_SPACE
        strb    w9, [x0], 1
        mov     x1, x0
        ldr     x9, =sim_s
        ldr     x0, [x9, SIM_SCORE]
        bl      main_fmt_dec
        mov     w9, MAIN_SPACE
        strb    w9, [x0], 1
        str     x0, [sp, main_headless_end]
        bl      sim_hash
        ldr     x1, [sp, main_headless_end]
        bl      main_fmt_hex
        mov     w9, MAIN_LF
        strb    w9, [x0], 1
        mov     x2, x0
        mov     w0, 1
        ldr     x1, =main_line
        bl      main_write
        ldp     x22, x28, [sp, 16]
        ldp     fp, lr, [sp], main_headless_dealloc
        ret

// main_dump(x0 = tick): writes the composed frame as dir/tick.ppm when the list asks for it
main_dump_alloc = -(16 + 8) & -16
main_dump_dealloc = 0 - main_dump_alloc
        .balign 4
main_dump:
        stp     fp, lr, [sp, main_dump_alloc]!
        mov     fp, sp
        str     main_arg_r, [sp, 16]
        mov     main_arg_r, x0
        ldr     x9, =main_di
        ldr     x10, [x9]
        ldr     x11, =main_ndumps
        ldr     x11, [x11]
        ldr     x12, =main_dumps
        b       main_dump_test
main_dump_skip:
        add     x10, x10, 1
        str     x10, [x9]
        b.eq    main_dump_path
main_dump_test:
        cmp     x10, x11
        b.ge    main_dump_done
        ldr     w13, [x12, x10, lsl 2]
        cmp     x13, main_arg_r
        b.le    main_dump_skip
        b       main_dump_done
main_dump_path:
        ldr     x1, =main_path
        ldr     x9, =main_dumpdir
        ldr     x9, [x9]
        cbz     x9, main_dump_name
        mov     x0, x1
        mov     x1, x9
        bl      main_cpy
        mov     w10, MAIN_SLASH
        strb    w10, [x0], 1
        mov     x1, x0
main_dump_name:
        mov     x0, main_arg_r
        bl      main_fmt_dec
        ldr     x1, =main_s_ppm
        bl      main_cpy
        strb    wzr, [x0]
        ldr     x0, =main_path
        ldr     x1, =main_back
        ldr     x1, [x1]
        ldr     x2, =gfx_stride
        ldr     x2, [x2]
        ldr     x3, =gfx_pal
        bl      save_ppm
main_dump_done:
        ldr     main_arg_r, [sp, 16]
        ldp     fp, lr, [sp], main_dump_dealloc
        ret

// main_draw(x0 = tick): compose, present, dump if asked, then swap the display buffers
main_draw_alloc = -(16 + 8) & -16
main_draw_dealloc = 0 - main_draw_alloc
        .balign 4
main_draw:
        stp     fp, lr, [sp, main_draw_alloc]!
        mov     fp, sp
        str     main_arg_r, [sp, 16]
        mov     main_arg_r, x0
        bl      gfx_palette
        ldr     x9, =main_palnew
        ldr     x10, [x9]
        orr     x10, x10, x0
        str     x10, [x9]
        bl      main_debug
        bl      main_flags
        mov     w1, w0
        ldr     x9, =main_back
        ldr     x0, [x9]
        bl      gfx_frame
        ldr     x9, =term_total
        ldr     x10, [x9]
        ldr     x9, =main_lastb
        str     x10, [x9]
        ldr     x9, =main_back
        ldr     x0, [x9]
        ldr     x1, =gfx_stride
        ldr     x1, [x1]
        ldr     x2, =gfx_pal
        ldr     x9, =main_palnew
        ldr     w3, [x9]
        str     xzr, [x9]
        bl      present_frame
        ldr     x9, =term_total
        ldr     x10, [x9]
        ldr     x9, =main_lastb
        ldr     x11, [x9]
        sub     x10, x10, x11
        str     x10, [x9]
        mov     x0, main_arg_r
        bl      main_dump
        ldr     x9, =main_frames
        ldr     x10, [x9]
        add     x10, x10, 1
        str     x10, [x9]
        ldr     x9, =main_back
        ldr     x10, [x9]
        ldr     x11, =main_front
        ldr     x12, [x11]
        str     x12, [x9]
        str     x10, [x11]
        ldr     main_arg_r, [sp, 16]
        ldp     fp, lr, [sp], main_draw_dealloc
        ret

// main_buffers(): the two display buffers and a first-frame palette upload
        .balign 4
main_buffers:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =main_back
        ldr     x10, =main_bufa
        str     x10, [x9]
        ldr     x9, =main_front
        ldr     x10, =main_bufb
        str     x10, [x9]
        ldr     x9, =main_palnew
        mov     x10, 1
        str     x10, [x9]
        ldp     fp, lr, [sp], 16
        ret

// main_flags() -> w0 = 1 while paused, + 2 while the debug overlay is on
        .balign 4
main_flags:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =tty_pause
        ldr     x9, [x9]
        and     x9, x9, 1
        ldr     x10, =tty_debug
        ldr     x10, [x10]
        and     x10, x10, 1
        orr     w0, w9, w10, lsl 1
        ldp     fp, lr, [sp], 16
        ret

// main_ended(): the tick a run reaches its over screen, its score meets the best
        .balign 4
main_ended:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =sim_s
        ldr     x10, [x9, SIM_STATE]
        ldr     x11, =main_prevst
        ldr     x12, [x11]
        str     x10, [x11]
        cmp     x10, SIM_OVER
        b.ne    main_ended_done
        cmp     x12, SIM_OVER
        b.eq    main_ended_done
        ldr     x0, [x9, SIM_SCORE]
        bl      save_best_check
main_ended_done:
        ldp     fp, lr, [sp], 16
        ret

// main_debug(): while the overlay is on, its text is rebuilt every MAIN_DBG_FRAMES frames
main_debug_alloc = -(16 + 8) & -16
main_debug_dealloc = 0 - main_debug_alloc
        .balign 4
main_debug:
        stp     fp, lr, [sp, main_debug_alloc]!
        mov     fp, sp
        str     main_dbg_r, [sp, 16]
        ldr     x9, =tty_debug
        ldr     x9, [x9]
        ldr     x10, =main_dbgn
        tbnz    x9, 0, main_debug_on
        str     xzr, [x10]
        b       main_debug_done
main_debug_on:
        ldr     x11, [x10]
        add     x12, x11, 1
        cmp     x12, MAIN_DBG_FRAMES
        csel    x12, x12, xzr, lt
        str     x12, [x10]
        cbnz    x11, main_debug_done
        bl      main_clock
        ldr     x9, =main_fpst
        ldr     x10, [x9]
        str     x0, [x9]
        sub     x10, x0, x10
        ldr     x11, =main_frames
        ldr     x11, [x11]
        ldr     x12, =main_fpsn
        ldr     x13, [x12]
        str     x11, [x12]
        sub     x13, x11, x13
        ldr     x14, =MAIN_SECOND
        mul     x13, x13, x14
        mov     x0, 0
        cbz     x10, main_debug_text
        udiv    x0, x13, x10
main_debug_text:
        mov     main_dbg_r, x0
        ldr     x0, =main_dbgtxt
        ldr     x1, =main_s_fps
        bl      main_cpy
        mov     x1, x0
        mov     x0, main_dbg_r
        bl      main_fmt_dec
        ldr     x1, =main_s_bytes
        bl      main_cpy
        mov     x1, x0
        ldr     x9, =main_lastb
        ldr     x0, [x9]
        bl      main_fmt_dec
        ldr     x1, =main_s_avg
        bl      main_cpy
        mov     x1, x0
        ldr     x9, =term_total
        ldr     x9, [x9]
        ldr     x10, =main_frames
        ldr     x10, [x10]
        mov     x0, 0
        cbz     x10, main_debug_avg
        udiv    x0, x9, x10
main_debug_avg:
        bl      main_fmt_dec
        ldr     x1, =main_s_scale
        bl      main_cpy
        mov     x1, x0
        ldr     x9, =main_scale
        ldr     x0, [x9]
        bl      main_fmt_dec
        ldr     x1, =main_s_full
        ldr     x9, =main_lite
        ldr     x9, [x9]
        cbz     x9, main_debug_profile
        ldr     x1, =main_s_lite
main_debug_profile:
        bl      main_cpy
        ldr     x1, =main_s_drop
        bl      main_cpy
        mov     x1, x0
        ldr     x9, =main_dropped
        ldr     x0, [x9]
        bl      main_fmt_dec
        strb    wzr, [x0]
        ldr     x0, =main_dbgtxt
        bl      gfx_overlay
main_debug_done:
        ldr     main_dbg_r, [sp, 16]
        ldp     fp, lr, [sp], main_debug_dealloc
        ret

// main_tally(x0 = value, x1 = tally): folds one sample into its minimum, maximum, sum, count
        .balign 4
main_tally:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, [x1, MAIN_T_N]
        ldr     x10, [x1, MAIN_T_MIN]
        cmp     x0, x10
        csel    x10, x0, x10, lo
        cmp     x9, 0
        csel    x10, x0, x10, eq
        str     x10, [x1, MAIN_T_MIN]
        ldr     x10, [x1, MAIN_T_MAX]
        cmp     x0, x10
        csel    x10, x0, x10, hi
        str     x10, [x1, MAIN_T_MAX]
        ldr     x10, [x1, MAIN_T_SUM]
        add     x10, x10, x0
        str     x10, [x1, MAIN_T_SUM]
        add     x9, x9, 1
        str     x9, [x1, MAIN_T_N]
        ldp     fp, lr, [sp], 16
        ret

// main_put3(x0 = dest, x1 = tally) -> x0 = dest end: "min A avg B max C"
main_put3_alloc = -(16 + 16) & -16
main_put3_dealloc = 0 - main_put3_alloc
        .balign 4
main_put3:
        stp     fp, lr, [sp, main_put3_alloc]!
        mov     fp, sp
        str     main_tl_r, [sp, 16]
        mov     main_tl_r, x1
        ldr     x1, =main_s_bmin
        bl      main_cpy
        mov     x1, x0
        ldr     x0, [main_tl_r, MAIN_T_MIN]
        bl      main_fmt_dec
        ldr     x1, =main_s_bavg
        bl      main_cpy
        mov     x1, x0
        ldr     x0, [main_tl_r, MAIN_T_SUM]
        ldr     x9, [main_tl_r, MAIN_T_N]
        cmp     x9, 0
        csinc   x9, x9, xzr, ne
        udiv    x0, x0, x9
        bl      main_fmt_dec
        ldr     x1, =main_s_bmax
        bl      main_cpy
        mov     x1, x0
        ldr     x0, [main_tl_r, MAIN_T_MAX]
        bl      main_fmt_dec
        ldr     main_tl_r, [sp, 16]
        ldp     fp, lr, [sp], main_put3_dealloc
        ret

// main_putavg(x0 = dest, x1 = label, x2 = total) -> x0 = dest end: the label, total / frames
main_putavg_alloc = -(16 + 16) & -16
main_putavg_dealloc = 0 - main_putavg_alloc
        .balign 4
main_putavg:
        stp     fp, lr, [sp, main_putavg_alloc]!
        mov     fp, sp
        str     main_tl_r, [sp, 16]
        mov     main_tl_r, x2
        bl      main_cpy
        mov     x1, x0
        ldr     x9, =main_bns
        ldr     x9, [x9, MAIN_T_N]
        cmp     x9, 0
        csinc   x9, x9, xzr, ne
        udiv    x0, main_tl_r, x9
        bl      main_fmt_dec
        ldr     main_tl_r, [sp, 16]
        ldp     fp, lr, [sp], main_putavg_dealloc
        ret

// main_bench(): renders and encodes the ticks without writing them, then prints the cost of a frame
main_bench_alloc = -(16 + 24) & -16
main_bench_dealloc = 0 - main_bench_alloc
        .balign 4
main_bench:
        stp     fp, lr, [sp, main_bench_alloc]!
        mov     fp, sp
        stp     x22, x23, [sp, 16]
        str     x24, [sp, 32]
        ldr     x9, =term_bench
        mov     x10, 1
        str     x10, [x9]
        bl      main_seed_sim
        bl      save_best_load
        mov     x0, LOG_W
        mov     x1, LOG_H
        bl      present_open
        cbnz    w0, main_bench_fits
        bl      main_small
main_bench_fits:
        bl      gfx_setup
        bl      main_buffers
        // the screen set-up is not a frame
        bl      term_bench_take
        ldr     x9, =term_bsplit
        stp     xzr, xzr, [x9, TERM_SPLIT_CURSOR]
        stp     xzr, xzr, [x9, TERM_SPLIT_GLYPH]
        mov     main_t_r, 0
        b       main_bench_test
main_bench_loop:
        add     main_t_r, main_t_r, 1
        mov     x0, main_t_r
        bl      main_press
        bl      sim_tick
        bl      main_ended
        ldr     x9, =main_lite
        ldr     x9, [x9]
        cbz     x9, main_bench_draw
        tbnz    main_t_r, 0, main_bench_test
main_bench_draw:
        bl      main_clock
        mov     main_bt_r, x0
        mov     x0, main_t_r
        bl      main_draw
        bl      main_clock
        sub     x0, x0, main_bt_r
        ldr     x1, =main_bns
        bl      main_tally
        bl      term_bench_take
        ldr     x1, =main_bbytes
        bl      main_tally
main_bench_test:
        ldr     x9, =main_ticks
        ldr     x9, [x9]
        cmp     main_t_r, x9
        b.lt    main_bench_loop
        ldr     x0, =main_line
        ldr     x1, =main_s_bframes
        bl      main_cpy
        mov     x1, x0
        ldr     x9, =main_bns
        ldr     x0, [x9, MAIN_T_N]
        bl      main_fmt_dec
        ldr     x1, =main_s_bns
        bl      main_cpy
        ldr     x1, =main_bns
        bl      main_put3
        ldr     x1, =main_s_bbytes
        bl      main_cpy
        ldr     x1, =main_bbytes
        bl      main_put3
        ldr     main_bv_r, =term_bsplit
        ldr     x1, =main_s_bcur
        ldr     x2, [main_bv_r, TERM_SPLIT_CURSOR]
        bl      main_putavg
        ldr     x1, =main_s_bcol
        ldr     x2, [main_bv_r, TERM_SPLIT_COLOUR]
        bl      main_putavg
        ldr     x1, =main_s_bgly
        ldr     x2, [main_bv_r, TERM_SPLIT_GLYPH]
        bl      main_putavg
        ldr     x1, =main_s_both
        ldr     x2, [main_bv_r, TERM_SPLIT_OTHER]
        bl      main_putavg
        mov     w9, MAIN_LF
        strb    w9, [x0], 1
        mov     x2, x0
        ldr     x1, =main_line
        mov     w0, 1
        bl      main_write
        ldp     x22, x23, [sp, 16]
        ldr     x24, [sp, 32]
        ldp     fp, lr, [sp], main_bench_dealloc
        ret

// main_render(): the full game with rendering into stdout, no terminal and no sleeping
main_render_alloc = -(16 + 8) & -16
main_render_dealloc = 0 - main_render_alloc
        .balign 4
main_render:
        stp     fp, lr, [sp, main_render_alloc]!
        mov     fp, sp
        str     x22, [sp, 16]
        mov     x0, AT_FDCWD
        ldr     x1, =main_s_idx
        mov     x2, FILE_NEW
        mov     x3, FILE_MODE
        mov     x8, SYS_OPENAT
        svc     0
        cmp     x0, 0
        b.ge    main_render_open
        mov     w0, 2
        ldr     x1, =main_e_idx
        mov     x2, MAIN_E_IDX_LEN
        bl      tty_write_all
        mov     w0, 2
        bl      main_exit
main_render_open:
        ldr     x9, =main_idxfd
        str     x0, [x9]
        bl      main_seed_sim
        bl      save_best_load
        mov     x0, LOG_W
        mov     x1, LOG_H
        bl      present_open
        cbnz    w0, main_render_fits
        bl      main_small
main_render_fits:
        bl      gfx_setup
        bl      main_buffers
        mov     main_t_r, 0
        b       main_render_test
main_render_loop:
        add     main_t_r, main_t_r, 1
        mov     x0, main_t_r
        bl      main_press
        bl      sim_tick
        bl      main_ended
        ldr     x9, =main_lite
        ldr     x9, [x9]
        cbz     x9, main_render_draw
        tbnz    main_t_r, 0, main_render_idx
main_render_draw:
        mov     x0, main_t_r
        bl      main_draw
main_render_idx:
        // a frame that writes nothing still gets a line, so a checker can find every tick
        mov     x0, main_t_r
        ldr     x1, =main_line
        bl      main_fmt_dec
        mov     w9, MAIN_SPACE
        strb    w9, [x0], 1
        mov     x1, x0
        ldr     x9, =term_total
        ldr     x0, [x9]
        bl      main_fmt_dec
        mov     w9, MAIN_LF
        strb    w9, [x0], 1
        mov     x2, x0
        ldr     x9, =main_idxfd
        ldr     w0, [x9]
        ldr     x1, =main_line
        bl      main_write
main_render_test:
        ldr     x9, =main_ticks
        ldr     x9, [x9]
        cmp     main_t_r, x9
        b.lt    main_render_loop
        bl      present_close
        ldr     x9, =main_idxfd
        ldr     x0, [x9]
        mov     x8, SYS_CLOSE
        svc     0
        ldr     x22, [sp, 16]
        ldp     fp, lr, [sp], main_render_dealloc
        ret

// main_small(): no scale fits the terminal: one line on stderr, then exit 2
        .balign 4
main_small:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 2
        ldr     x1, =main_e_small
        mov     x2, MAIN_E_SMALL_LEN
        bl      tty_write_all
        mov     w0, 2
        bl      main_exit

// main_onterm(): SIGTERM in the lite profile outside the playground: the terminal goes back as q
// leaves it, its palette too, and the game exits; never returns
        .balign 4
main_onterm:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      present_abort
        mov     w0, MAIN_TERM_STATUS
        bl      main_exit

// main_trap(): SIGTERM runs main_onterm. It needs no restorer, since it never returns, and no
// flag or mask, since a signal is held back while its own handler runs: a second SIGTERM waits.
        .balign 4
main_trap:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x1, =main_sigact
        ldr     x9, =main_onterm
        str     x9, [x1]
        mov     x0, MAIN_SIGTERM
        mov     x2, 0
        mov     x3, MAIN_SIGSET_BYTES
        mov     x8, MAIN_SYS_SIGACTION
        svc     0
        ldp     fp, lr, [sp], 16
        ret

// main_resize(): every 30 ticks, a new terminal size means a new layout and maybe a new scale
        .balign 4
main_resize:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =main_size_c
        ldr     x9, [x9]
        cbnz    x9, main_resize_done
        bl      tty_size
        ldr     x9, =main_lastc
        ldr     x10, [x9]
        ldr     x11, =main_lastr
        ldr     x12, [x11]
        cmp     x10, x0
        b.ne    main_resize_new
        cmp     x12, x1
        b.eq    main_resize_done
main_resize_new:
        str     x0, [x9]
        str     x1, [x11]
        mov     x0, LOG_W
        mov     x1, LOG_H
        bl      present_open
        ldr     x9, =main_scale
        str     x0, [x9]
        cbz     w0, main_resize_done
        bl      gfx_setup
        bl      main_buffers
main_resize_done:
        ldp     fp, lr, [sp], 16
        ret

// main_stats_line(): frames ticks dropped elapsed_ns on stderr
main_stats_line_alloc = -(16 + 8) & -16
main_stats_line_dealloc = 0 - main_stats_line_alloc
main_stats_line_out = 16
        .balign 4
main_stats_line:
        stp     fp, lr, [sp, main_stats_line_alloc]!
        mov     fp, sp
        ldr     x1, =main_line
        ldr     x9, =main_frames
        ldr     x0, [x9]
        bl      main_fmt_dec
        mov     w9, MAIN_SPACE
        strb    w9, [x0], 1
        mov     x1, x0
        ldr     x9, =main_simticks
        ldr     x0, [x9]
        bl      main_fmt_dec
        mov     w9, MAIN_SPACE
        strb    w9, [x0], 1
        mov     x1, x0
        ldr     x9, =main_dropped
        ldr     x0, [x9]
        bl      main_fmt_dec
        mov     w9, MAIN_SPACE
        strb    w9, [x0], 1
        str     x0, [sp, main_stats_line_out]
        bl      main_clock
        ldr     x9, =main_start
        ldr     x9, [x9]
        sub     x0, x0, x9
        ldr     x1, [sp, main_stats_line_out]
        bl      main_fmt_dec
        mov     w9, MAIN_LF
        strb    w9, [x0], 1
        mov     x2, x0
        mov     w0, 2
        ldr     x1, =main_line
        bl      main_write
        ldp     fp, lr, [sp], main_stats_line_dealloc
        ret

// main_play(): the interactive game, paced to 60 ticks a second by deadline
main_play_alloc = -(16 + 64 + 8) & -16
main_play_dealloc = 0 - main_play_alloc
main_play_press = 80
        .balign 4
main_play:
        stp     fp, lr, [sp, main_play_alloc]!
        mov     fp, sp
        stp     x21, x22, [sp, 16]
        stp     x23, x24, [sp, 32]
        stp     x25, x26, [sp, 48]
        stp     x27, x28, [sp, 64]
        bl      tty_open
        cbz     w0, main_play_tty
        mov     w0, 2
        ldr     x1, =main_e_tty
        mov     x2, MAIN_E_TTY_LEN
        bl      tty_write_all
        mov     w0, 2
        bl      main_exit
main_play_tty:
        bl      tty_size
        ldr     x9, =main_lastc
        str     x0, [x9]
        ldr     x9, =main_lastr
        str     x1, [x9]
        // a terminal with no control character is the playground (see tty_open), which gets the
        // lite profile with nothing typed; whether it reports a size does not matter
        ldr     x9, =tty_nocc
        ldr     x10, [x9]
        cbz     x10, main_play_seed
        ldr     x9, =main_lite
        mov     x10, 1
        str     x10, [x9]
main_play_seed:
        ldr     x9, =main_lite
        ldr     x10, [x9]
        ldr     x9, =main_pace
        str     x10, [x9]
        // --lite anywhere else: SIGTERM gives the palette back too
        cbz     x10, main_play_start
        ldr     x9, =tty_nocc
        ldr     x9, [x9]
        cbnz    x9, main_play_start
        bl      main_trap
main_play_start:
        bl      main_seed_sim
        bl      save_best_load
        mov     x0, LOG_W
        mov     x1, LOG_H
        bl      present_open
        ldr     x9, =main_scale
        str     x0, [x9]
        cbz     w0, main_play_clock
        bl      gfx_setup
        bl      main_buffers
main_play_clock:
        bl      main_clock
        ldr     x9, =main_start
        str     x0, [x9]
        mov     main_next_r, x0
        mov     main_phase_r, 0
        mov     main_t_r, 0
        mov     main_since_r, 0
        mov     main_k_r, 0
        b       main_play_poll
main_play_loop:
        bl      main_clock
        mov     main_now_r, x0
        mov     main_ran_r, 0
        b       main_play_tick
main_play_one:
        add     main_t_r, main_t_r, 1
        ldr     x9, =main_scale
        ldr     x9, [x9]
        cbz     x9, main_play_paced
        ldr     x9, =tty_pause
        ldr     x9, [x9]
        tbnz    x9, 0, main_play_paced
        // each tick takes at most one queued flap, so two fast taps fly on two ticks
        mov     w0, 0
        ldr     x9, =tty_flaps
        ldr     x10, [x9]
        cbz     x10, main_play_auto
        sub     x10, x10, 1
        str     x10, [x9]
        mov     w0, 1
main_play_auto:
        str     x0, [sp, main_play_press]
        ldr     x9, =main_auto
        ldr     x9, [x9]
        cbz     x9, main_play_sim
        bl      sim_autopilot
        ldr     x1, [sp, main_play_press]
        orr     w0, w0, w1
        str     x0, [sp, main_play_press]
main_play_sim:
        ldr     x0, [sp, main_play_press]
        bl      sim_tick
        bl      main_ended
        ldr     x9, =main_simticks
        ldr     x10, [x9]
        add     x10, x10, 1
        str     x10, [x9]
        add     main_since_r, main_since_r, 1
main_play_paced:
        add     main_k_r, main_k_r, 1
        cmp     main_k_r, MAIN_RESIZE
        b.ne    main_play_period
        mov     main_k_r, 0
        bl      main_resize
main_play_period:
        // two periods of 16666667 ns and one of 16666666 make exactly 50 ms per three ticks
        ldr     x9, =MAIN_PERIOD
        cmp     main_phase_r, 2
        b.ne    main_play_add
        ldr     x9, =MAIN_PERIOD3
main_play_add:
        add     main_next_r, main_next_r, x9
        add     main_phase_r, main_phase_r, 1
        cmp     main_phase_r, 3
        csel    main_phase_r, main_phase_r, xzr, lt
        add     main_ran_r, main_ran_r, 1
main_play_tick:
        cmp     main_now_r, main_next_r
        b.lt    main_play_draw
        cmp     main_ran_r, MAIN_CATCHUP
        b.lt    main_play_one
        // too far behind: drop the backlog instead of fast-forwarding the game
        b       main_play_behind
main_play_drop:
        ldr     x9, =MAIN_PERIOD
        add     main_next_r, main_next_r, x9
        ldr     x10, =main_dropped
        ldr     x11, [x10]
        add     x11, x11, 1
        str     x11, [x10]
main_play_behind:
        cmp     main_now_r, main_next_r
        b.ge    main_play_drop
main_play_draw:
        cbz     main_since_r, main_play_sleep
        ldr     x9, =main_scale
        ldr     x9, [x9]
        cbz     x9, main_play_sleep
        ldr     x9, =main_lite
        ldr     x9, [x9]
        cbz     x9, main_play_render
        cmp     main_since_r, 2
        b.lt    main_play_sleep
main_play_render:
        mov     main_since_r, 0
        mov     x0, main_t_r
        bl      main_draw
main_play_sleep:
        bl      main_clock
        subs    x0, main_next_r, x0
        b.le    main_play_poll
        bl      tty_sleep
main_play_poll:
        mov     x0, main_t_r
        bl      tty_poll
        bl      main_flags
        ldr     x9, =main_lastfl
        ldr     x10, [x9]
        cmp     x0, x10
        b.eq    main_play_quit
        str     x0, [x9]
        mov     main_since_r, MAIN_FORCE
main_play_quit:
        ldr     x9, =tty_quit
        ldr     x9, [x9]
        cbz     x9, main_play_loop
        bl      present_close
        bl      tty_close
        ldr     x9, =main_stats
        ldr     x9, [x9]
        cbz     x9, main_play_done
        bl      main_stats_line
main_play_done:
        ldp     x21, x22, [sp, 16]
        ldp     x23, x24, [sp, 32]
        ldp     x25, x26, [sp, 48]
        ldp     x27, x28, [sp, 64]
        ldp     fp, lr, [sp], main_play_dealloc
        ret

// main(w0 = argc, x1 = argv) -> w0 = exit status
main_alloc = -(16 + 16) & -16
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, main_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        sxtw    main_argc_r, w0
        mov     main_argv_r, x1
        bl      main_parse
        ldr     x9, =main_mode
        ldr     x9, [x9]
        cmp     x9, MAIN_HEADLESS
        b.ne    main_not_headless
        bl      main_headless
        b       main_done
main_not_headless:
        cmp     x9, MAIN_RENDER
        b.ne    main_not_render
        bl      main_render
        b       main_done
main_not_render:
        cmp     x9, MAIN_BENCH
        b.ne    main_interactive
        bl      main_bench
        b       main_done
main_interactive:
        bl      main_play
main_done:
        mov     w0, 0
        bl      main_exit
