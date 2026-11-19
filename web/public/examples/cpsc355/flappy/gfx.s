// gfx_: the compositor. A scale change bakes the background, ground, pipes, bird and digits
// from the logical art; each frame is then row copies and masked blits of those bakes.

define(gfx_buf_r, x19)
define(gfx_src_r, x20)
define(gfx_dst_r, x21)
define(gfx_w_r, x22)
define(gfx_h_r, x23)
define(gfx_y_r, x24)
define(gfx_x_r, x25)
define(gfx_s_r, x26)
define(gfx_k_r, x27)
define(gfx_n_r, x28)
define(gfx_fill32_r, w26)
define(gfx_edge32_r, w19)
define(gfx_out32_r, w28)
define(gfx_ang_r, x19)
define(gfx_frm_r, x20)
define(gfx_box_r, x24)
define(gfx_w32_r, w22)
define(gfx_h32_r, w23)
define(gfx_txt_r, x19)
define(gfx_gw_r, x20)
define(gfx_gh_r, x21)
define(gfx_step_r, x22)
define(gfx_adv_r, x23)
define(gfx_dig_r, x24)
define(gfx_sc_r, x19)
define(gfx_gy_r, x20)
define(gfx_gy0_r, x21)
define(gfx_gs_r, x22)
define(gfx_row_r, x21)
define(gfx_cx_r, x26)
define(gfx_bx_r, x27)
define(gfx_r0_r, x20)
define(gfx_r1_r, x21)
define(gfx_r2_r, x22)
define(gfx_r3_r, x23)
define(gfx_cnt_r, x20)
define(gfx_dadv_r, x21)
define(gfx_dw_r, x22)
define(gfx_px_r, x23)
define(gfx_py_r, x24)
define(gfx_fa_r, x20)
define(gfx_fb_r, x21)
define(gfx_fc_r, x22)
define(gfx_fd_r, x23)
define(gfx_fe_r, x24)
define(gfx_fd32_r, w23)
define(gfx_wt_r, x19)
define(gfx_wk_r, x20)
define(gfx_wd_r, x21)
define(gfx_wf_r, x22)
define(gfx_wgw_r, x23)
define(gfx_wgh_r, x24)
define(gfx_wst_r, x25)
define(gfx_ww_r, x26)
define(gfx_wx_r, x27)
define(gfx_wy_r, x28)
define(gfx_ue_r, x19)
define(gfx_ue32_r, w19)
define(gfx_us_r, x20)
define(gfx_uo_r, x21)
define(gfx_uy_r, x22)
define(gfx_ut_r, x23)
define(gfx_pw_r, x19)
define(gfx_ph_r, x20)
define(gfx_mb_r, x19)
define(gfx_me_r, x20)
define(gfx_my_r, x21)
define(gfx_nb_r, x19)
define(gfx_nx_r, x20)
define(gfx_ny_r, x21)
define(gfx_nc_r, x22)
define(gfx_tb_r, x19)
define(gfx_tv_r, x20)
define(gfx_tw_r, x21)
define(gfx_tg_r, x22)
define(gfx_tx_r, x23)
define(gfx_ty_r, x24)
define(gfx_rb_r, x19)
define(gfx_rx_r, x20)
define(gfx_ry_r, x21)
define(gfx_ob_r, x19)
define(gfx_ost_r, x20)
define(gfx_osc_r, x21)
define(gfx_opy_r, x22)
define(gfx_opy32_r, w22)
define(gfx_ox0_r, x23)
define(gfx_ocx_r, x23)
define(gfx_ox1_r, x24)
define(gfx_ocy_r, x24)
define(gfx_oy0_r, x25)
define(gfx_osh_r, x25)
define(gfx_oy1_r, x26)
define(gfx_oby_r, x26)
define(gfx_oplan_r, x27)
define(gfx_ol_r, x28)
define(gfx_ospot_r, x28)
define(gfx_pk_r, x19)
define(gfx_pc_r, x20)
define(gfx_ff_r, x25)

// gfx_geo per scale s: width LOG_W / s, height rounded up, a row stride rounded up to 16 bytes,
// and cell rows of two pixels each
GFX_ROW_ALIGN = -16
GFX_G1_S = (LOG_W + 15) & GFX_ROW_ALIGN
GFX_G1_R = (LOG_H + 1) / 2
GFX_G2_W = LOG_W / 2
GFX_G2_H = (LOG_H + 1) / 2
GFX_G2_S = (GFX_G2_W + 15) & GFX_ROW_ALIGN
GFX_G2_R = (GFX_G2_H + 1) / 2
GFX_G3_W = LOG_W / 3
GFX_G3_H = (LOG_H + 2) / 3
GFX_G3_S = (GFX_G3_W + 15) & GFX_ROW_ALIGN
GFX_G3_R = (GFX_G3_H + 1) / 2
GFX_G4_W = LOG_W / 4
GFX_G4_H = (LOG_H + 3) / 4
GFX_G4_S = (GFX_G4_W + 15) & GFX_ROW_ALIGN
GFX_G4_R = (GFX_G4_H + 1) / 2
GFX_DIV_OFF = 512
GFX_DIV_LO = -512
GFX_DIV_MAX = 511
// the scratch is as wide as the ground strip: the playfield plus room to scroll
GFX_LSTRIDE = 240
GFX_STRIP_W = GFX_LSTRIDE
GFX_SKY_SPLIT = 128
GFX_CLOUD_Y = 130
GFX_BUSH_Y = GROUND_Y - ART_BUSH_H
GFX_CITY_Y = GFX_BUSH_Y - ART_CITY_H
GFX_DIRT_Y = GROUND_Y + ART_GROUND_H
GFX_SCORE_Y = 18
GFX_BOX = 24
// baked angles run from SIM_TILT_DRAW_MAX down to SIM_TILT_MIN, a step apart
GFX_ANGLE_STEP = 10
GFX_ANGLES = (SIM_TILT_DRAW_MAX - SIM_TILT_MIN) / GFX_ANGLE_STEP + 1
GFX_ANGLE_LAST = GFX_ANGLES - 1
GFX_ANGLE_ROUND = GFX_ANGLE_STEP / 2
// an outline pixel looks at its 3 x 3 neighbourhood
GFX_RING_W = 3
GFX_RING = GFX_RING_W * GFX_RING_W
// an outlined sprite gains a pixel on each side, and its pixel (x, y) looks at the glyph from
// (x - 2, y - 2), the ring around glyph pixel (x - 1, y - 1)
GFX_RING_PAD = GFX_RING_W - 1
GFX_BREATH = 200000
GFX_MS = 1000000
// a byte times this is that byte in all eight lanes of a word
GFX_BYTES8 = 0x0101010101010101
GFX_DIGITS = 10
GFX_DIGIT_BYTES = (ART_BIG_W + GFX_RING_PAD) * (ART_BIG_H + GFX_RING_PAD)
GFX_DIGITS_BYTES = GFX_DIGIT_BYTES * GFX_DIGITS
// the city tile is the largest sprite decoded into the scratch sprite
GFX_SPRITE_BYTES = ART_CITY_PX
GFX_BITS_BYTES = ART_BIG_W * ART_BIG_H
// a 64-bit number has at most twenty digits
GFX_NUMS = 20
// x times this, shifted right 16, is x / GFX_ANGLE_STEP for every tilt the sim reaches
GFX_STEP_RECIP = 65536 / GFX_ANGLE_STEP + 1
// instructions each heavy init loop spends per unit of work, counted toward the next sleep
GFX_COST_TILE = 16
GFX_COST_SHRINK = 32
GFX_COST_ROTATE = 48
GFX_COST_OUTLINE = 300
GFX_COST_DIV = 12
GFX_LOGIC_BYTES = GFX_LSTRIDE * LOG_H
GFX_STRIP_BYTES = GFX_STRIP_W * (LOG_H - GROUND_Y)
GFX_ROT_BYTES = GFX_ANGLES * ART_FRAMES * GFX_BOX * GFX_BOX
GFX_DIV_SIZE = GFX_DIV_OFF * 2
GFX_DIV_COST = GFX_DIV_SIZE * GFX_COST_DIV
GFX_DIV_BYTES = GFX_DIV_SIZE * 2
GFX_BODY_STRIDE = 32
// big digits keep a pixel between outlines; font digits share one outline column
GFX_BIG_ADV = ART_BIG_W + 3
GFX_F5_ADV = ART_F5_W + 1
GFX_F3_ADV = ART_F3_W + 1
GFX_F5_DIGITS = ART_DIGIT0 * ART_F5_STEP
GFX_F3_DIGITS = ART_DIGIT0 * ART_F3_STEP

// UI: elements in art_ui order, their layout in logical pixels, and the over screen's timeline
GFX_E_WORD = 0
GFX_E_PRESS = 1
GFX_E_TBEST = 2
GFX_E_READY = 3
GFX_E_HINT = 4
GFX_E_SPACE = 5
GFX_E_OVER = 6
GFX_E_LSCORE = 7
GFX_E_LBEST = 8
GFX_E_LMEDAL = 9
GFX_E_NEW = 10
GFX_E_PAUSED = 11
GFX_E_ZOOM = 12
GFX_UI_STRINGS = ART_UI_WORDS * 4
// a gfx_uitab record: where the baked word starts in gfx_ui, then its width and height
GFX_UITAB_OFF = 0
GFX_UITAB_W = 8
GFX_UITAB_H = 16
GFX_UITAB_REC = 24
GFX_UITAB_BYTES = ART_UI_WORDS * GFX_UITAB_REC
GFX_UI_BYTES = 16384
GFX_WBITS = 4096
// an outlined word is its bitmap plus a one-pixel ring; gfx_word refuses one that would not fit
GFX_WORD_MAX = GFX_WBITS + 512
// a small digit is one glyph of the larger font with its outline
GFX_SDIGIT_BYTES = (ART_F5_W + GFX_RING_PAD) * (ART_F5_H + GFX_RING_PAD)
GFX_SDIGITS_BYTES = GFX_SDIGIT_BYTES * GFX_DIGITS
GFX_MEDAL_BYTES = ART_MEDAL1 * ART_MEDAL1
GFX_SPARK_BYTES = ART_SPARK1 * ART_SPARK1
GFX_PAL_BYTES = SLOT_COUNT * 4
GFX_WORD_Y = 52
GFX_TPRESS_Y = 148
GFX_TBEST_Y = 178
GFX_ZOOM_Y = 6
GFX_READY_Y = 60
GFX_HINT_X = SIM_BIRD_X + SIM_BIRD_MID
GFX_HINT_Y = 142
GFX_PAUSE_Y = 100
GFX_PROMPT_Y = 170
GFX_PANEL_X0 = 16
GFX_PANEL_X1 = 128
GFX_PANEL_H = 60
GFX_PANEL_LX = GFX_PANEL_X0 + 8
GFX_PANEL_NX = GFX_PANEL_X1 - 8
GFX_MEDAL_CX = GFX_PANEL_X0 + 22
GFX_MEDAL_CY = 34
// a gfx_plan record: label, number, label, number rows from the panel's top, its height, how far
// it rests above the slide, the medal's centre row and the prompt's top edge
GFX_PLAN_L1 = 0
GFX_PLAN_N1 = 2
GFX_PLAN_L2 = 4
GFX_PLAN_N2 = 6
GFX_PLAN_H = 8
GFX_PLAN_RISE = 10
GFX_PLAN_MEDAL = 12
GFX_PLAN_PROMPT = 14
GFX_PLAN_REC = GFX_PLAN_PROMPT + 2
// s = 1 has a panel of its own, laid out in logical rows: label, number, label, number
GFX_P1_L1 = 5
GFX_P1_N1 = 15
GFX_P1_L2 = 31
GFX_P1_N2 = 41
// s = 2 to 4 share one panel in display rows, in the small font: label, number, label, number,
// its height and the medal's centre; each scale's logical rows are these times the scale
GFX_TALL_L1 = 1
GFX_TALL_N1 = 8
GFX_TALL_L2 = 15
GFX_TALL_N2 = 22
GFX_TALL_H = 30
GFX_TALL_MEDAL = 17
GFX_P2_L1 = GFX_TALL_L1 * 2
GFX_P2_N1 = GFX_TALL_N1 * 2
GFX_P2_L2 = GFX_TALL_L2 * 2
GFX_P2_N2 = GFX_TALL_N2 * 2
GFX_P2_H = GFX_TALL_H * 2
GFX_P2_MEDAL = GFX_TALL_MEDAL * 2
GFX_P3_L1 = GFX_TALL_L1 * 3
GFX_P3_N1 = GFX_TALL_N1 * 3
GFX_P3_L2 = GFX_TALL_L2 * 3
GFX_P3_N2 = GFX_TALL_N2 * 3
GFX_P3_H = GFX_TALL_H * 3
GFX_P3_MEDAL = GFX_TALL_MEDAL * 3
GFX_P4_L1 = GFX_TALL_L1 * 4
GFX_P4_N1 = GFX_TALL_N1 * 4
GFX_P4_L2 = GFX_TALL_L2 * 4
GFX_P4_N2 = GFX_TALL_N2 * 4
GFX_P4_H = GFX_TALL_H * 4
GFX_P4_MEDAL = GFX_TALL_MEDAL * 4
// the taller panel at s = 3 rests this much higher, clear of the prompt; s = 4 has no room above
// GAME OVER, so its prompt moves down onto the dirt instead
GFX_RISE_S3 = 28
GFX_PROMPT_S4 = 224
GFX_DROP_LAST = 16
GFX_DROP_BIAS = 32
GFX_SLIDE_FROM = 16
GFX_SLIDE_LAST = 24
GFX_COUNT_FROM = GFX_SLIDE_FROM + GFX_SLIDE_LAST + 2
// a sparkle spends eight ticks on each of four spots, shown for the first six
GFX_SPARK_SHIFT = 3
GFX_SPARK_MASK = 7
GFX_SPARK_ON = 6
GFX_SPOT_MASK = 3
GFX_SPARK_BIAS = 8
GFX_FLASH_LEVELS = 3
GFX_FLASH_STEP = GFX_FLASH_TICKS / GFX_FLASH_LEVELS
GFX_DARK_LEVELS = 4
GFX_FADE_STEP = SIM_FADE_TICKS / GFX_DARK_LEVELS
GFX_FADEIN_TICKS = 12
GFX_FADEIN_STEP = GFX_FADEIN_TICKS / GFX_DARK_LEVELS
GFX_KEY_LEVEL = 7
GFX_KEY_FLASH = 8
GFX_KEY_DARK = 16
GFX_TINT_SHIFT = 6

        .section .rodata
// per scale: display width, display height, row stride (a multiple of 16), cell rows
        .balign 8
        .global gfx_geo
gfx_geo:
        .hword  0, 0, 0, 0
        .hword  LOG_W, LOG_H, GFX_G1_S, GFX_G1_R
        .hword  GFX_G2_W, GFX_G2_H, GFX_G2_S, GFX_G2_R
        .hword  GFX_G3_W, GFX_G3_H, GFX_G3_S, GFX_G3_R
        .hword  GFX_G4_W, GFX_G4_H, GFX_G4_S, GFX_G4_R
// GAME OVER's top edge for each tick of its drop, plus GFX_DROP_BIAS: a fall, then a bounce
gfx_drop:
        .hword  8, 9, 10, 14, 18, 23, 30, 38, 47, 57, 69, 82, 78, 76, 77, 80, 82
// the panel's top edge for each tick of its slide up, easing out
gfx_slide:
        .hword  256, 237, 220, 205, 190, 177, 166, 155, 146, 138, 131, 125, 120
        .hword  115, 111, 108, 106, 104, 102, 101, 101, 100, 100, 100, 100
// per scale, the panel's layout (fields at GFX_PLAN_*); s3 and s4 take s2's display rows, so
// their panel grows to hold a label over each number
gfx_plan:
        .hword  0, 0, 0, 0, 0, 0, 0, 0
        .hword  GFX_P1_L1, GFX_P1_N1, GFX_P1_L2, GFX_P1_N2, GFX_PANEL_H, 0, GFX_MEDAL_CY
        .hword  GFX_PROMPT_Y
        .hword  GFX_P2_L1, GFX_P2_N1, GFX_P2_L2, GFX_P2_N2, GFX_P2_H, 0, GFX_P2_MEDAL, GFX_PROMPT_Y
        .hword  GFX_P3_L1, GFX_P3_N1, GFX_P3_L2, GFX_P3_N2, GFX_P3_H, GFX_RISE_S3, GFX_P3_MEDAL
        .hword  GFX_PROMPT_Y
        .hword  GFX_P4_L1, GFX_P4_N1, GFX_P4_L2, GFX_P4_N2, GFX_P4_H, 0, GFX_P4_MEDAL, GFX_PROMPT_S4
// sparkle spots around the medal's centre, plus GFX_SPARK_BIAS to stay unsigned
gfx_sparks:
        .byte   2, 2, 14, 4, 4, 14, 13, 13
// per scale: hand-drawn bird frame width and height
gfx_birdwh:
        .hword  0, 0, SIM_BIRD_W, SIM_BIRD_H, ART_BIRD2_W, ART_BIRD2_H, ART_BIRD3_W, ART_BIRD3_H
        .hword  ART_BIRD4_W, ART_BIRD4_H

        .bss
        .balign 64
gfx_logic:      .skip   GFX_LOGIC_BYTES
gfx_bg:         .skip   GFX_MAX_BUF
gfx_ground:     .skip   GFX_STRIP_BYTES
gfx_rot:        .skip   GFX_ROT_BYTES
gfx_div:        .skip   GFX_DIV_BYTES
gfx_sprite:     .skip   GFX_SPRITE_BYTES
gfx_cap:        .skip   ART_CAP_PX
gfx_body:       .skip   GFX_BODY_STRIDE
gfx_digit:      .skip   GFX_DIGITS_BYTES
gfx_bits:       .skip   GFX_BITS_BYTES
gfx_nums:       .skip   GFX_NUMS
gfx_ui:         .skip   GFX_UI_BYTES
gfx_wbits:      .skip   GFX_WBITS
gfx_dbg:        .skip   GFX_WORD_MAX
gfx_sdigit:     .skip   GFX_SDIGITS_BYTES
gfx_medal:      .skip   GFX_MEDAL_BYTES
gfx_spark:      .skip   GFX_SPARK_BYTES
        .balign 16
        .global gfx_pal
gfx_pal:        .skip   GFX_PAL_BYTES
        .balign 8
gfx_uitab:      .skip   GFX_UITAB_BYTES
gfx_numtxt:     .skip   8
gfx_ncount:     .skip   8
gfx_sdw:        .skip   8
gfx_sdh:        .skip   8
gfx_sdadv:      .skip   8
gfx_medw:       .skip   8
gfx_sparkw:     .skip   8
gfx_effkey:     .skip   8
gfx_dbgw:       .skip   8
gfx_dbgh:       .skip   8
        .balign 8
        .global gfx_dw
        .global gfx_dh
        .global gfx_stride
gfx_scale:      .skip   8
gfx_dw:         .skip   8
gfx_dh:         .skip   8
gfx_stride:     .skip   8
gfx_groundy:    .skip   8
gfx_gstride:    .skip   8
gfx_capw:       .skip   8
gfx_caph:       .skip   8
gfx_bodyw:      .skip   8
gfx_box:        .skip   8
gfx_rotox:      .skip   8
gfx_rotoy:      .skip   8
gfx_digw:       .skip   8
gfx_digh:       .skip   8
gfx_digadv:     .skip   8
gfx_work:       .skip   8

        .text

// gfx_copy(x0 = dst, x1 = src, x2 = bytes, a multiple of 64)
        .balign 4
gfx_copy:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        cbz     x2, gfx_copy_done
gfx_copy_loop:
        // one instruction moves 64 bytes, and the playground meters instructions, not bytes
        ld1     {v0.16b, v1.16b, v2.16b, v3.16b}, [x1], 64
        st1     {v0.16b, v1.16b, v2.16b, v3.16b}, [x0], 64
        subs    x2, x2, 64
        b.gt    gfx_copy_loop
gfx_copy_done:
        ldp     fp, lr, [sp], 16
        ret

// gfx_span(x0 = dst, x1 = src, x2 = bytes): an opaque row copy, 16 bytes at a time
        .balign 4
gfx_span:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        b       gfx_span_test
gfx_span_wide:
        // a pipe or ground row is mostly whole 16-byte runs; one pair moves each run
        ld1     {v0.16b}, [x1], 16
        st1     {v0.16b}, [x0], 16
        sub     x2, x2, 16
gfx_span_test:
        cmp     x2, 16
        b.ge    gfx_span_wide
        cbz     x2, gfx_span_done
gfx_span_byte:
        ldrb    w9, [x1], 1
        strb    w9, [x0], 1
        subs    x2, x2, 1
        b.ne    gfx_span_byte
gfx_span_done:
        ldp     fp, lr, [sp], 16
        ret

// gfx_mask(x0 = dst, x1 = src, x2 = bytes): copies only the src bytes that are not transparent
        .balign 4
gfx_mask:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        movi    v31.16b, SLOT_CLEAR
        b       gfx_mask_test
gfx_mask_wide:
        // sixteen pixels per compare and select, so a sprite row costs a few steps
        ld1     {v0.16b}, [x1], 16
        ld1     {v1.16b}, [x0]
        cmeq    v2.16b, v0.16b, v31.16b
        bif     v1.16b, v0.16b, v2.16b
        st1     {v1.16b}, [x0], 16
        sub     x2, x2, 16
gfx_mask_test:
        cmp     x2, 16
        b.ge    gfx_mask_wide
        cbz     x2, gfx_mask_done
gfx_mask_byte:
        ldrb    w9, [x1], 1
        cmp     w9, SLOT_CLEAR
        b.eq    gfx_mask_skip
        strb    w9, [x0]
gfx_mask_skip:
        add     x0, x0, 1
        subs    x2, x2, 1
        b.ne    gfx_mask_byte
gfx_mask_done:
        ldp     fp, lr, [sp], 16
        ret

// gfx_d(x0 = logical coordinate) -> x0 = display coordinate, floor(v / s) from the table
        .balign 4
gfx_d:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x9, GFX_DIV_LO
        cmp     x0, x9
        csel    x0, x0, x9, ge
        mov     x9, GFX_DIV_MAX
        cmp     x0, x9
        csel    x0, x0, x9, le
        ldr     x10, =gfx_div
        add     x0, x0, GFX_DIV_OFF
        ldrsh   x0, [x10, x0, lsl 1]
        ldp     fp, lr, [sp], 16
        ret

// gfx_up(x0 = logical size) -> x0 = display size, rounded up
        .balign 4
gfx_up:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =gfx_scale
        ldr     x9, [x9]
        add     x0, x0, x9
        sub     x0, x0, 1
        bl      gfx_d
        ldp     fp, lr, [sp], 16
        ret

// gfx_breath(x0 = instructions just run): a 1 ms sleep every 200,000, as the playground needs
        .balign 4
        .global gfx_breath
gfx_breath:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =gfx_work
        ldr     x10, [x9]
        add     x10, x10, x0
        ldr     x11, =GFX_BREATH
        cmp     x10, x11
        b.lt    gfx_breath_keep
        mov     x10, 0
        str     x10, [x9]
        ldr     x0, =GFX_MS
        bl      tty_sleep
        b       gfx_breath_done
gfx_breath_keep:
        str     x10, [x9]
gfx_breath_done:
        ldp     fp, lr, [sp], 16
        ret

// gfx_fill(w0 = slot, x1 = first row, x2 = end row): fills whole rows of the logical scratch
        .balign 4
gfx_fill:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        and     x0, x0, 255
        ldr     x12, =GFX_BYTES8
        mul     x12, x0, x12
        ldr     x9, =gfx_logic
        mov     x10, GFX_LSTRIDE
        madd    x9, x1, x10, x9
        sub     x11, x2, x1
        mul     x11, x11, x10
        cbz     x11, gfx_fill_done
gfx_fill_loop:
        str     x12, [x9], 8
        subs    x11, x11, 8
        b.gt    gfx_fill_loop
gfx_fill_done:
        ldp     fp, lr, [sp], 16
        ret

// gfx_tile(x0 = sprite, x1 = w, x2 = h, x3 = logical row, x4 = width): repeats it across the scratch
        .balign 4
gfx_tile:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =gfx_logic
        mov     x10, GFX_LSTRIDE
        madd    x9, x3, x10, x9
        mov     x11, 0
gfx_tile_row:
        mul     x12, x11, x1
        add     x12, x0, x12
        mov     x13, 0
        mov     x14, 0
gfx_tile_px:
        ldrb    w15, [x12, x14]
        cmp     w15, SLOT_CLEAR
        b.eq    gfx_tile_next
        strb    w15, [x9, x13]
gfx_tile_next:
        add     x14, x14, 1
        cmp     x14, x1
        csel    x14, x14, xzr, lt
        add     x13, x13, 1
        cmp     x13, x4
        b.lt    gfx_tile_px
        add     x9, x9, x10
        add     x11, x11, 1
        cmp     x11, x2
        b.lt    gfx_tile_row
        mov     x0, GFX_COST_TILE
        mul     x0, x0, x4
        mul     x0, x0, x2
        bl      gfx_breath
        ldp     fp, lr, [sp], 16
        ret

// gfx_shrink(x0 = src, x1 = w, x2 = h, x3 = src stride, x4 = dst, x5 = dst stride)
// Each s x s block keeps its highest-priority slot, so outlines and eyes survive scaling down.
gfx_shrink_alloc = -(16 + 72) & -16
gfx_shrink_dealloc = 0 - gfx_shrink_alloc
        .balign 4
gfx_shrink:
        stp     fp, lr, [sp, gfx_shrink_alloc]!
        mov     fp, sp
        stp     x20, x21, [sp, 16]
        stp     x22, x23, [sp, 32]
        stp     x24, x25, [sp, 48]
        stp     x26, x27, [sp, 64]
        str     x28, [sp, 80]
        mov     gfx_src_r, x0
        mov     gfx_w_r, x1
        mov     gfx_h_r, x2
        mov     gfx_k_r, x3
        mov     gfx_dst_r, x4
        mov     gfx_n_r, x5
        ldr     x9, =gfx_scale
        ldr     gfx_s_r, [x9]
        mov     gfx_y_r, 0
gfx_shrink_row:
        mov     gfx_x_r, 0
        mov     x15, gfx_dst_r
gfx_shrink_px:
        mov     w0, SLOT_CLEAR
        mov     x1, -1
        add     x2, gfx_y_r, gfx_s_r
        cmp     x2, gfx_h_r
        csel    x2, x2, gfx_h_r, le
        add     x3, gfx_x_r, gfx_s_r
        cmp     x3, gfx_w_r
        csel    x3, x3, gfx_w_r, le
        ldr     x6, =art_prio
        mov     x4, gfx_y_r
gfx_shrink_by:
        madd    x7, x4, gfx_k_r, gfx_src_r
        mov     x5, gfx_x_r
gfx_shrink_bx:
        ldrb    w8, [x7, x5]
        cmp     w8, SLOT_CLEAR
        b.eq    gfx_shrink_bnext
        ldrb    w9, [x6, x8]
        cmp     x9, x1
        b.le    gfx_shrink_bnext
        mov     x1, x9
        mov     w0, w8
gfx_shrink_bnext:
        add     x5, x5, 1
        cmp     x5, x3
        b.lt    gfx_shrink_bx
        add     x4, x4, 1
        cmp     x4, x2
        b.lt    gfx_shrink_by
        strb    w0, [x15], 1
        add     gfx_x_r, gfx_x_r, gfx_s_r
        cmp     gfx_x_r, gfx_w_r
        b.lt    gfx_shrink_px
        mul     x0, gfx_w_r, gfx_s_r
        mov     x9, GFX_COST_SHRINK
        mul     x0, x0, x9
        bl      gfx_breath
        add     gfx_dst_r, gfx_dst_r, gfx_n_r
        add     gfx_y_r, gfx_y_r, gfx_s_r
        cmp     gfx_y_r, gfx_h_r
        b.lt    gfx_shrink_row
        ldp     x20, x21, [sp, 16]
        ldp     x22, x23, [sp, 32]
        ldp     x24, x25, [sp, 48]
        ldp     x26, x27, [sp, 64]
        ldr     x28, [sp, 80]
        ldp     fp, lr, [sp], gfx_shrink_dealloc
        ret

// gfx_glyph(x0 = text, x1 = w, x2 = h, x3 = dest): a glyph's pixels as bytes, 1 on and 0 off
        .balign 4
gfx_glyph:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mul     x9, x1, x2
gfx_glyph_loop:
        ldrb    w10, [x0], 1
        cmp     w10, ART_SLASH
        b.eq    gfx_glyph_loop
        cmp     w10, ART_ON
        cset    w10, eq
        strb    w10, [x3], 1
        subs    x9, x9, 1
        b.ne    gfx_glyph_loop
        ldp     fp, lr, [sp], 16
        ret

// gfx_on(x0 = bits, x1 = w, x2 = h, x3 = x, x4 = y) -> x0 = 1 when that pixel is on
        .balign 4
gfx_on:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        cmp     x3, x1
        b.hs    gfx_on_no
        cmp     x4, x2
        b.hs    gfx_on_no
        madd    x9, x4, x1, x3
        ldrb    w0, [x0, x9]
        b       gfx_on_done
gfx_on_no:
        mov     x0, 0
gfx_on_done:
        ldp     fp, lr, [sp], 16
        ret

// gfx_outline(x0 = bits, x1 = w, x2 = h, x3 = dest, w4 = fill, w5 = edge): a sprite of
// (w + 2) x (h + 2) whose on pixels take fill and whose off pixels touching them take edge
gfx_outline_alloc = -(16 + 80) & -16
gfx_outline_dealloc = 0 - gfx_outline_alloc
        .balign 4
gfx_outline:
        stp     fp, lr, [sp, gfx_outline_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        stp     x23, x24, [sp, 48]
        stp     x25, x26, [sp, 64]
        stp     x27, x28, [sp, 80]
        mov     gfx_src_r, x0
        mov     gfx_w_r, x1
        mov     gfx_h_r, x2
        mov     gfx_dst_r, x3
        mov     gfx_fill32_r, w4
        mov     gfx_edge32_r, w5
        mov     gfx_y_r, 0
gfx_outline_row:
        mov     gfx_x_r, 0
gfx_outline_px:
        // pixel (x - 1, y - 1) of the glyph sits under this one
        mov     x0, gfx_src_r
        mov     x1, gfx_w_r
        mov     x2, gfx_h_r
        sub     x3, gfx_x_r, 1
        sub     x4, gfx_y_r, 1
        bl      gfx_on
        mov     gfx_out32_r, gfx_fill32_r
        cbnz    x0, gfx_outline_put
        mov     gfx_out32_r, gfx_edge32_r
        mov     gfx_k_r, 0
gfx_outline_near:
        mov     x0, gfx_src_r
        mov     x1, gfx_w_r
        mov     x2, gfx_h_r
        mov     x9, GFX_RING_W
        udiv    x10, gfx_k_r, x9
        msub    x11, x10, x9, gfx_k_r
        add     x3, gfx_x_r, x11
        sub     x3, x3, GFX_RING_PAD
        add     x4, gfx_y_r, x10
        sub     x4, x4, GFX_RING_PAD
        bl      gfx_on
        cbnz    x0, gfx_outline_put
        add     gfx_k_r, gfx_k_r, 1
        cmp     gfx_k_r, GFX_RING
        b.lt    gfx_outline_near
        mov     gfx_out32_r, SLOT_CLEAR
gfx_outline_put:
        strb    gfx_out32_r, [gfx_dst_r], 1
        add     gfx_x_r, gfx_x_r, 1
        add     x9, gfx_w_r, GFX_RING_PAD
        cmp     gfx_x_r, x9
        b.lt    gfx_outline_px
        add     x0, gfx_w_r, GFX_RING_PAD
        mov     x9, GFX_COST_OUTLINE
        mul     x0, x0, x9
        bl      gfx_breath
        add     gfx_y_r, gfx_y_r, 1
        add     x9, gfx_h_r, GFX_RING_PAD
        cmp     gfx_y_r, x9
        b.lt    gfx_outline_row
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     x23, x24, [sp, 48]
        ldp     x25, x26, [sp, 64]
        ldp     x27, x28, [sp, 80]
        ldp     fp, lr, [sp], gfx_outline_dealloc
        ret

// gfx_rotate(x0 = frame, x1 = w, x2 = h, x3 = dest box, x4 = box, x5 = sin, x6 = cos, Q14)
// Inverse mapping in half-pixel units, so the frame turns about its own centre.
        .balign 4
gfx_rotate:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x7, 0
gfx_rot_row:
        lsl     x8, x7, 1
        add     x8, x8, 1
        sub     x8, x8, x4
        mov     x9, 0
gfx_rot_px:
        lsl     x10, x9, 1
        add     x10, x10, 1
        sub     x10, x10, x4
        mul     x11, x10, x6
        msub    x11, x8, x5, x11
        asr     x11, x11, 14
        mul     x12, x10, x5
        madd    x12, x8, x6, x12
        asr     x12, x12, 14
        add     x11, x11, x1
        asr     x11, x11, 1
        add     x12, x12, x2
        asr     x12, x12, 1
        mov     w13, SLOT_CLEAR
        cmp     x11, x1
        b.hs    gfx_rot_put
        cmp     x12, x2
        b.hs    gfx_rot_put
        madd    x14, x12, x1, x11
        ldrb    w13, [x0, x14]
gfx_rot_put:
        strb    w13, [x3], 1
        add     x9, x9, 1
        cmp     x9, x4
        b.lt    gfx_rot_px
        add     x7, x7, 1
        cmp     x7, x4
        b.lt    gfx_rot_row
        ldp     fp, lr, [sp], 16
        ret

// gfx_bake_bird(): the scale's three wing frames, turned to each of the 23 tilts
gfx_bake_bird_alloc = -(16 + 48) & -16
gfx_bake_bird_dealloc = 0 - gfx_bake_bird_alloc
        .balign 4
gfx_bake_bird:
        stp     fp, lr, [sp, gfx_bake_bird_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        stp     x23, x24, [sp, 48]
        ldr     x9, =gfx_scale
        ldr     x9, [x9]
        ldr     x10, =gfx_birdwh
        add     x10, x10, x9, lsl 2
        ldrh    gfx_w32_r, [x10]
        ldrh    gfx_h32_r, [x10, 2]
        ldr     x0, =art_bird1
        cmp     x9, 2
        b.lt    gfx_bake_text
        ldr     x0, =art_bird2
        b.eq    gfx_bake_text
        ldr     x0, =art_bird3
        cmp     x9, 3
        b.eq    gfx_bake_text
        ldr     x0, =art_bird4
gfx_bake_text:
        ldr     x1, =art_l_bird
        mul     x2, gfx_w_r, gfx_h_r
        mov     x9, ART_FRAMES
        mul     x2, x2, x9
        ldr     x3, =gfx_sprite
        bl      art_decode
        mov     x0, GFX_BOX
        bl      gfx_d
        mov     gfx_box_r, x0
        ldr     x9, =gfx_box
        str     gfx_box_r, [x9]
        // the box sits so that an unturned frame lands where the unrotated sprite would
        mov     x10, 1
        sub     x10, x10, gfx_box_r
        add     x11, x10, gfx_w_r
        asr     x11, x11, 1
        neg     x11, x11
        ldr     x9, =gfx_rotox
        str     x11, [x9]
        add     x11, x10, gfx_h_r
        asr     x11, x11, 1
        neg     x11, x11
        ldr     x9, =gfx_rotoy
        str     x11, [x9]
        ldr     gfx_dst_r, =gfx_rot
        mov     gfx_ang_r, 0
gfx_bake_angle:
        mov     gfx_frm_r, 0
gfx_bake_frame:
        ldr     x0, =gfx_sprite
        mul     x9, gfx_w_r, gfx_h_r
        madd    x0, gfx_frm_r, x9, x0
        mov     x1, gfx_w_r
        mov     x2, gfx_h_r
        mov     x3, gfx_dst_r
        mov     x4, gfx_box_r
        ldr     x9, =art_trig
        add     x9, x9, gfx_ang_r, lsl 2
        ldrsh   x5, [x9]
        ldrsh   x6, [x9, 2]
        bl      gfx_rotate
        mul     x9, gfx_box_r, gfx_box_r
        add     gfx_dst_r, gfx_dst_r, x9
        mov     x0, GFX_COST_ROTATE
        mul     x0, x0, x9
        bl      gfx_breath
        add     gfx_frm_r, gfx_frm_r, 1
        cmp     gfx_frm_r, ART_FRAMES
        b.lt    gfx_bake_frame
        add     gfx_ang_r, gfx_ang_r, 1
        cmp     gfx_ang_r, GFX_ANGLES
        b.lt    gfx_bake_angle
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     x23, x24, [sp, 48]
        ldp     fp, lr, [sp], gfx_bake_bird_dealloc
        ret

// gfx_bake_digits(): outlined score digits drawn at display size: big at scale 1, then 5 x 7
// and 3 x 5 fonts, because shrinking the big ones leaves unreadable smudges
gfx_bake_digits_alloc = -(16 + 48) & -16
gfx_bake_digits_dealloc = 0 - gfx_bake_digits_alloc
        .balign 4
gfx_bake_digits:
        stp     fp, lr, [sp, gfx_bake_digits_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        stp     x23, x24, [sp, 48]
        ldr     x9, =gfx_scale
        ldr     x9, [x9]
        ldr     gfx_txt_r, =art_big
        mov     gfx_gw_r, ART_BIG_W
        mov     gfx_gh_r, ART_BIG_H
        mov     gfx_step_r, ART_BIG_STEP
        mov     gfx_adv_r, GFX_BIG_ADV
        cmp     x9, 1
        b.eq    gfx_digits_size
        ldr     gfx_txt_r, =art_font5
        add     gfx_txt_r, gfx_txt_r, GFX_F5_DIGITS
        mov     gfx_gw_r, ART_F5_W
        mov     gfx_gh_r, ART_F5_H
        mov     gfx_step_r, ART_F5_STEP
        mov     gfx_adv_r, GFX_F5_ADV
        cmp     x9, 2
        b.eq    gfx_digits_size
        ldr     gfx_txt_r, =art_font3
        add     gfx_txt_r, gfx_txt_r, GFX_F3_DIGITS
        mov     gfx_gw_r, ART_F3_W
        mov     gfx_gh_r, ART_F3_H
        mov     gfx_step_r, ART_F3_STEP
        mov     gfx_adv_r, GFX_F3_ADV
gfx_digits_size:
        add     x9, gfx_gw_r, GFX_RING_PAD
        ldr     x10, =gfx_digw
        str     x9, [x10]
        add     x9, gfx_gh_r, GFX_RING_PAD
        ldr     x10, =gfx_digh
        str     x9, [x10]
        ldr     x10, =gfx_digadv
        str     gfx_adv_r, [x10]
        mov     gfx_dig_r, 0
gfx_digits_one:
        madd    x0, gfx_dig_r, gfx_step_r, gfx_txt_r
        mov     x1, gfx_gw_r
        mov     x2, gfx_gh_r
        ldr     x3, =gfx_bits
        bl      gfx_glyph
        ldr     x0, =gfx_bits
        mov     x1, gfx_gw_r
        mov     x2, gfx_gh_r
        ldr     x3, =gfx_digit
        mov     x9, GFX_DIGIT_BYTES
        madd    x3, gfx_dig_r, x9, x3
        mov     w4, SLOT_WHITE
        mov     w5, SLOT_TOUT
        bl      gfx_outline
        add     gfx_dig_r, gfx_dig_r, 1
        cmp     gfx_dig_r, GFX_DIGITS
        b.lt    gfx_digits_one
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     x23, x24, [sp, 48]
        ldp     fp, lr, [sp], gfx_bake_digits_dealloc
        ret

// gfx_setup(w0 = scale): bakes everything a frame needs at this scale
gfx_setup_alloc = -(16 + 32) & -16
gfx_setup_dealloc = 0 - gfx_setup_alloc
        .balign 4
        .global gfx_setup
gfx_setup:
        stp     fp, lr, [sp, gfx_setup_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        uxtw    gfx_sc_r, w0
        ldr     x9, =gfx_scale
        str     gfx_sc_r, [x9]
        ldr     x9, =gfx_geo
        add     x9, x9, gfx_sc_r, lsl 3
        ldrh    w10, [x9]
        ldrh    w11, [x9, 2]
        ldrh    w12, [x9, 4]
        ldr     x13, =gfx_dw
        str     x10, [x13]
        ldr     x13, =gfx_dh
        str     x11, [x13]
        ldr     x13, =gfx_stride
        str     x12, [x13]
        // floor division, so a sprite half off the left edge still steps every s pixels
        ldr     x9, =gfx_div
        mov     x10, 0
gfx_setup_div:
        sub     x11, x10, GFX_DIV_OFF
        sdiv    x12, x11, gfx_sc_r
        mul     x13, x12, gfx_sc_r
        cmp     x13, x11
        b.le    gfx_setup_dstore
        sub     x12, x12, 1
gfx_setup_dstore:
        strh    w12, [x9, x10, lsl 1]
        add     x10, x10, 1
        cmp     x10, GFX_DIV_SIZE
        b.lt    gfx_setup_div
        ldr     x0, =GFX_DIV_COST
        bl      gfx_breath
        mov     x0, GROUND_Y
        bl      gfx_d
        mov     gfx_gy_r, x0
        ldr     x9, =gfx_groundy
        str     gfx_gy_r, [x9]
        // drawn once at logical size and shrunk, so every scale shows the same scene
        mov     w0, SLOT_SKY1
        mov     x1, 0
        mov     x2, GFX_SKY_SPLIT
        bl      gfx_fill
        mov     w0, SLOT_SKY2
        mov     x1, GFX_SKY_SPLIT
        mov     x2, LOG_H
        bl      gfx_fill
        ldr     x0, =art_cloud
        ldr     x1, =art_l_cloud
        mov     x2, ART_CLOUD_PX
        ldr     x3, =gfx_sprite
        bl      art_decode
        ldr     x0, =gfx_sprite
        mov     x1, ART_CLOUD_W
        mov     x2, ART_CLOUD_H
        mov     x3, GFX_CLOUD_Y
        mov     x4, LOG_W
        bl      gfx_tile
        ldr     x0, =art_city
        ldr     x1, =art_l_city
        mov     x2, ART_CITY_PX
        ldr     x3, =gfx_sprite
        bl      art_decode
        ldr     x0, =gfx_sprite
        mov     x1, ART_CITY_W
        mov     x2, ART_CITY_H
        mov     x3, GFX_CITY_Y
        mov     x4, LOG_W
        bl      gfx_tile
        ldr     x0, =art_bush
        ldr     x1, =art_l_bush
        mov     x2, ART_BUSH_PX
        ldr     x3, =gfx_sprite
        bl      art_decode
        ldr     x0, =gfx_sprite
        mov     x1, ART_BUSH_W
        mov     x2, ART_BUSH_H
        mov     x3, GFX_BUSH_Y
        mov     x4, LOG_W
        bl      gfx_tile
        ldr     x0, =gfx_logic
        mov     x1, LOG_W
        mov     x2, LOG_H
        mov     x3, GFX_LSTRIDE
        ldr     x4, =gfx_bg
        ldr     x5, =gfx_stride
        ldr     x5, [x5]
        bl      gfx_shrink
        // the ground strip starts on the display grid, which may be a row or two above y 200
        mul     gfx_gy0_r, gfx_gy_r, gfx_sc_r
        mov     w0, SLOT_BUSH2
        mov     x1, gfx_gy0_r
        mov     x2, GROUND_Y
        bl      gfx_fill
        mov     w0, SLOT_DIRT
        mov     x1, GFX_DIRT_Y
        mov     x2, LOG_H
        bl      gfx_fill
        ldr     x0, =art_ground
        ldr     x1, =art_l_ground
        mov     x2, ART_GROUND_PX
        ldr     x3, =gfx_sprite
        bl      art_decode
        ldr     x0, =gfx_sprite
        mov     x1, SIM_GROUND_PERIOD
        mov     x2, ART_GROUND_H
        mov     x3, GROUND_Y
        mov     x4, GFX_STRIP_W
        bl      gfx_tile
        mov     x0, GFX_STRIP_W
        bl      gfx_up
        add     x0, x0, 15
        and     gfx_gs_r, x0, -16
        ldr     x9, =gfx_gstride
        str     gfx_gs_r, [x9]
        ldr     x0, =gfx_logic
        mov     x9, GFX_LSTRIDE
        madd    x0, gfx_gy0_r, x9, x0
        mov     x1, GFX_STRIP_W
        mov     x2, LOG_H
        sub     x2, x2, gfx_gy0_r
        mov     x3, GFX_LSTRIDE
        ldr     x4, =gfx_ground
        mov     x5, gfx_gs_r
        bl      gfx_shrink
        // a body row repeats all the way down, so only the cap and one body row are shrunk
        ldr     x0, =art_cap
        ldr     x1, =art_l_pipe
        mov     x2, ART_CAP_PX
        ldr     x3, =gfx_sprite
        bl      art_decode
        mov     x0, SIM_PIPE_CAP_W
        bl      gfx_up
        ldr     x9, =gfx_capw
        str     x0, [x9]
        mov     x0, SIM_PIPE_CAP_H
        bl      gfx_up
        ldr     x9, =gfx_caph
        str     x0, [x9]
        ldr     x0, =gfx_sprite
        mov     x1, SIM_PIPE_CAP_W
        mov     x2, SIM_PIPE_CAP_H
        mov     x3, SIM_PIPE_CAP_W
        ldr     x4, =gfx_cap
        ldr     x5, =gfx_capw
        ldr     x5, [x5]
        bl      gfx_shrink
        ldr     x0, =art_pbody
        ldr     x1, =art_l_pipe
        mov     x2, ART_BODY_W
        ldr     x3, =gfx_sprite
        bl      art_decode
        mov     x0, ART_BODY_W
        bl      gfx_up
        ldr     x9, =gfx_bodyw
        str     x0, [x9]
        ldr     x0, =gfx_sprite
        mov     x1, ART_BODY_W
        mov     x2, 1
        mov     x3, ART_BODY_W
        ldr     x4, =gfx_body
        mov     x5, GFX_BODY_STRIDE
        bl      gfx_shrink
        bl      gfx_bake_bird
        bl      gfx_bake_digits
        bl      gfx_bake_ui
        ldr     x9, =gfx_dbgw
        str     xzr, [x9]
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     fp, lr, [sp], gfx_setup_dealloc
        ret

// gfx_clip(x0 = x, x1 = w) -> x0 = first column kept, x1 = columns kept, x2 = columns skipped
        .balign 4
gfx_clip:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =gfx_dw
        ldr     x9, [x9]
        add     x10, x0, x1
        cmp     x10, x9
        csel    x10, x10, x9, le
        mov     x2, 0
        cmp     x0, 0
        b.ge    gfx_clip_left
        neg     x2, x0
        mov     x0, 0
gfx_clip_left:
        subs    x1, x10, x0
        csel    x1, x1, xzr, gt
        ldp     fp, lr, [sp], 16
        ret

// gfx_blit(x0 = back, x1 = sprite, x2 = w, x3 = h, x4 = x, x5 = y): transparent pixels show through
gfx_blit_alloc = -(16 + 80) & -16
gfx_blit_dealloc = 0 - gfx_blit_alloc
        .balign 4
gfx_blit:
        stp     fp, lr, [sp, gfx_blit_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        stp     x23, x24, [sp, 48]
        stp     x25, x26, [sp, 64]
        stp     x27, x28, [sp, 80]
        mov     gfx_buf_r, x0
        mov     gfx_src_r, x1
        mov     gfx_w_r, x2
        mov     gfx_h_r, x3
        mov     gfx_y_r, x5
        mov     x0, x4
        mov     x1, x2
        bl      gfx_clip
        cbz     x1, gfx_blit_done
        mov     gfx_x_r, x0
        mov     gfx_k_r, x1
        add     gfx_src_r, gfx_src_r, x2
        ldr     x9, =gfx_dh
        ldr     gfx_n_r, [x9]
        ldr     x9, =gfx_stride
        ldr     gfx_s_r, [x9]
        mov     gfx_row_r, 0
gfx_blit_row:
        add     x9, gfx_y_r, gfx_row_r
        cmp     x9, gfx_n_r
        b.hs    gfx_blit_next
        madd    x0, x9, gfx_s_r, gfx_buf_r
        add     x0, x0, gfx_x_r
        madd    x1, gfx_row_r, gfx_w_r, gfx_src_r
        mov     x2, gfx_k_r
        bl      gfx_mask
gfx_blit_next:
        add     gfx_row_r, gfx_row_r, 1
        cmp     gfx_row_r, gfx_h_r
        b.lt    gfx_blit_row
gfx_blit_done:
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     x23, x24, [sp, 48]
        ldp     x25, x26, [sp, 64]
        ldp     x27, x28, [sp, 80]
        ldp     fp, lr, [sp], gfx_blit_dealloc
        ret

// gfx_pipe_rows(x0 = back, x1 = src row, x2 = src stride, x3 = x, x4 = w, x5 = first row, x6 = end)
// copies one opaque pipe part over display rows [first, end), clipped at the edges
gfx_pipe_rows_alloc = -(16 + 72) & -16
gfx_pipe_rows_dealloc = 0 - gfx_pipe_rows_alloc
        .balign 4
gfx_pipe_rows:
        stp     fp, lr, [sp, gfx_pipe_rows_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x23, [sp, 32]
        stp     x24, x25, [sp, 48]
        stp     x26, x27, [sp, 64]
        str     x28, [sp, 80]
        mov     gfx_buf_r, x0
        mov     gfx_src_r, x1
        mov     gfx_n_r, x2
        mov     gfx_y_r, x5
        mov     gfx_h_r, x6
        mov     x0, x3
        mov     x1, x4
        bl      gfx_clip
        cbz     x1, gfx_prows_done
        mov     gfx_x_r, x0
        mov     gfx_k_r, x1
        add     gfx_src_r, gfx_src_r, x2
        ldr     x9, =gfx_stride
        ldr     gfx_s_r, [x9]
        cmp     gfx_y_r, 0
        csel    gfx_row_r, gfx_y_r, xzr, ge
        // rows above the top edge are skipped, but the source still advances past them
        sub     x9, gfx_row_r, gfx_y_r
        madd    gfx_src_r, x9, gfx_n_r, gfx_src_r
        b       gfx_prows_test
gfx_prows_row:
        madd    x0, gfx_row_r, gfx_s_r, gfx_buf_r
        add     x0, x0, gfx_x_r
        mov     x1, gfx_src_r
        mov     x2, gfx_k_r
        bl      gfx_span
        add     gfx_src_r, gfx_src_r, gfx_n_r
        add     gfx_row_r, gfx_row_r, 1
gfx_prows_test:
        cmp     gfx_row_r, gfx_h_r
        b.lt    gfx_prows_row
gfx_prows_done:
        ldp     x19, x20, [sp, 16]
        ldp     x21, x23, [sp, 32]
        ldp     x24, x25, [sp, 48]
        ldp     x26, x27, [sp, 64]
        ldr     x28, [sp, 80]
        ldp     fp, lr, [sp], gfx_pipe_rows_dealloc
        ret

// gfx_pipe(x0 = back, x1 = pipe x, x2 = gap top): body, cap, gap, cap, body down to the ground
gfx_pipe_alloc = -(16 + 72) & -16
gfx_pipe_dealloc = 0 - gfx_pipe_alloc
        .balign 4
gfx_pipe:
        stp     fp, lr, [sp, gfx_pipe_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        stp     x23, x24, [sp, 48]
        stp     x25, x26, [sp, 64]
        str     gfx_bx_r, [sp, 80]
        mov     gfx_buf_r, x0
        mov     gfx_x_r, x1
        mov     gfx_y_r, x2
        mov     x0, gfx_x_r
        bl      gfx_d
        mov     gfx_cx_r, x0
        add     x0, gfx_x_r, 1
        bl      gfx_d
        mov     gfx_bx_r, x0
        sub     x0, gfx_y_r, SIM_PIPE_CAP_H
        bl      gfx_d
        mov     gfx_r0_r, x0
        mov     x0, gfx_y_r
        bl      gfx_d
        mov     gfx_r1_r, x0
        add     x0, gfx_y_r, SIM_GAP_H
        bl      gfx_d
        mov     gfx_r2_r, x0
        add     x0, gfx_y_r, SIM_GAP_H
        add     x0, x0, SIM_PIPE_CAP_H
        bl      gfx_d
        mov     gfx_r3_r, x0
        // upper body, with a zero source stride so every row repeats the one body row
        mov     x0, gfx_buf_r
        ldr     x1, =gfx_body
        mov     x2, 0
        mov     x3, gfx_bx_r
        ldr     x4, =gfx_bodyw
        ldr     x4, [x4]
        mov     x5, 0
        mov     x6, gfx_r0_r
        bl      gfx_pipe_rows
        mov     x0, gfx_buf_r
        ldr     x1, =gfx_cap
        ldr     x2, =gfx_capw
        ldr     x2, [x2]
        mov     x3, gfx_cx_r
        mov     x4, x2
        mov     x5, gfx_r0_r
        mov     x6, gfx_r1_r
        bl      gfx_pipe_rows
        mov     x0, gfx_buf_r
        ldr     x1, =gfx_cap
        ldr     x2, =gfx_capw
        ldr     x2, [x2]
        mov     x3, gfx_cx_r
        mov     x4, x2
        mov     x5, gfx_r2_r
        mov     x6, gfx_r3_r
        bl      gfx_pipe_rows
        mov     x0, gfx_buf_r
        ldr     x1, =gfx_body
        mov     x2, 0
        mov     x3, gfx_bx_r
        ldr     x4, =gfx_bodyw
        ldr     x4, [x4]
        mov     x5, gfx_r3_r
        ldr     x6, =gfx_groundy
        ldr     x6, [x6]
        bl      gfx_pipe_rows
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     x23, x24, [sp, 48]
        ldp     x25, x26, [sp, 64]
        ldr     gfx_bx_r, [sp, 80]
        ldp     fp, lr, [sp], gfx_pipe_dealloc
        ret

// gfx_score(x0 = back, x1 = value): outlined digits centred near the top
gfx_score_alloc = -(16 + 48) & -16
gfx_score_dealloc = 0 - gfx_score_alloc
        .balign 4
gfx_score:
        stp     fp, lr, [sp, gfx_score_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        stp     x23, x24, [sp, 48]
        mov     gfx_buf_r, x0
        mov     x0, x1
        bl      gfx_split
        mov     gfx_cnt_r, x0
        ldr     x9, =gfx_digadv
        ldr     gfx_dadv_r, [x9]
        ldr     x9, =gfx_digw
        ldr     gfx_dw_r, [x9]
        sub     x9, gfx_cnt_r, 1
        madd    x9, x9, gfx_dadv_r, gfx_dw_r
        ldr     x10, =gfx_dw
        ldr     x10, [x10]
        sub     x10, x10, x9
        asr     gfx_px_r, x10, 1
        mov     x0, GFX_SCORE_Y
        bl      gfx_d
        mov     gfx_py_r, x0
gfx_score_digit:
        sub     gfx_cnt_r, gfx_cnt_r, 1
        ldr     x9, =gfx_nums
        ldrb    w10, [x9, gfx_cnt_r]
        ldr     x1, =gfx_digit
        mov     x9, GFX_DIGIT_BYTES
        madd    x1, x10, x9, x1
        mov     x0, gfx_buf_r
        mov     x2, gfx_dw_r
        ldr     x3, =gfx_digh
        ldr     x3, [x3]
        mov     x4, gfx_px_r
        mov     x5, gfx_py_r
        bl      gfx_blit
        add     gfx_px_r, gfx_px_r, gfx_dadv_r
        cbnz    gfx_cnt_r, gfx_score_digit
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     x23, x24, [sp, 48]
        ldp     fp, lr, [sp], gfx_score_dealloc
        ret

// gfx_frame(x0 = back, w1 = flags, 1 paused and 2 debug): composes the game state into back
gfx_frame_alloc = -(16 + 56) & -16
gfx_frame_dealloc = 0 - gfx_frame_alloc
        .balign 4
        .global gfx_frame
gfx_frame:
        stp     fp, lr, [sp, gfx_frame_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        stp     x23, x24, [sp, 48]
        str     x25, [sp, 64]
        mov     gfx_buf_r, x0
        uxtw    gfx_ff_r, w1
        ldr     x9, =gfx_dh
        ldr     x9, [x9]
        ldr     x10, =gfx_stride
        ldr     x10, [x10]
        mul     x2, x9, x10
        add     x2, x2, 63
        and     x2, x2, -64
        ldr     x1, =gfx_bg
        bl      gfx_copy
        mov     gfx_fa_r, 0
gfx_frame_pipe:
        ldr     x9, =sim_s
        add     x9, x9, SIM_PIPEX
        mov     x10, SIM_PIPE_REC
        madd    x9, gfx_fa_r, x10, x9
        ldr     x1, [x9]
        ldr     x2, [x9, SIM_PIPE_GAP]
        cmp     x1, LOG_W
        b.ge    gfx_frame_pnext
        cmn     x1, SIM_PIPE_CAP_W
        b.lt    gfx_frame_pnext
        mov     x0, gfx_buf_r
        bl      gfx_pipe
gfx_frame_pnext:
        add     gfx_fa_r, gfx_fa_r, 1
        cmp     gfx_fa_r, SIM_PIPES
        b.lt    gfx_frame_pipe
        ldr     x9, =sim_s
        ldr     x0, [x9, SIM_GROUNDX]
        bl      gfx_d
        ldr     gfx_fb_r, =gfx_ground
        add     gfx_fb_r, gfx_fb_r, x0
        ldr     x9, =gfx_groundy
        ldr     gfx_fc_r, [x9]
        ldr     x9, =gfx_dh
        ldr     gfx_fd_r, [x9]
        ldr     x9, =gfx_stride
        ldr     gfx_fe_r, [x9]
gfx_frame_ground:
        madd    x0, gfx_fc_r, gfx_fe_r, gfx_buf_r
        mov     x1, gfx_fb_r
        mov     x2, gfx_fe_r
        bl      gfx_span
        ldr     x9, =gfx_gstride
        ldr     x9, [x9]
        add     gfx_fb_r, gfx_fb_r, x9
        add     gfx_fc_r, gfx_fc_r, 1
        cmp     gfx_fc_r, gfx_fd_r
        b.lt    gfx_frame_ground
        ldr     x9, =sim_s
        ldr     x10, [x9, SIM_STATE]
        ldr     x11, [x9, SIM_Y]
        mov     gfx_fa_r, SIM_BIRD_X
        mov     x12, 0
        cmp     x10, SIM_READY
        b.gt    gfx_frame_late
        ldr     x13, [x9, SIM_BOB]
        add     x11, x11, x13
        cbnz    x10, gfx_frame_bird
        mov     gfx_fa_r, SIM_TITLE_X
        b       gfx_frame_bird
gfx_frame_late:
        ldr     x12, [x9, SIM_TILT]
        cmp     x10, SIM_FADE
        b.ne    gfx_frame_bird
        // a fade from the title has no pipe on the field yet
        ldr     x13, [x9, SIM_PIPEX]
        cmp     x13, SIM_PIPE_NONE
        b.ne    gfx_frame_bird
        mov     gfx_fa_r, SIM_TITLE_X
        mov     x12, 0
gfx_frame_bird:
        // half a step added first, so the division picks the nearest baked angle
        mov     x13, SIM_TILT_DRAW_MAX
        cmp     x12, x13
        csel    x12, x12, x13, le
        sub     x12, x13, x12
        add     x12, x12, GFX_ANGLE_ROUND
        mov     x13, GFX_STEP_RECIP
        mul     x12, x12, x13
        lsr     x12, x12, 16
        mov     x13, GFX_ANGLE_LAST
        cmp     x12, x13
        csel    gfx_fc_r, x12, x13, le
        ldr     x13, [x9, SIM_WING]
        ldr     x14, =sim_wingframe
        ldrb    gfx_fd32_r, [x14, x13]
        asr     gfx_fb_r, x11, 8
        mov     x0, gfx_fa_r
        bl      gfx_d
        ldr     x9, =gfx_rotox
        ldr     x9, [x9]
        sub     gfx_fa_r, x0, x9
        mov     x0, gfx_fb_r
        bl      gfx_d
        ldr     x9, =gfx_rotoy
        ldr     x9, [x9]
        sub     gfx_fb_r, x0, x9
        ldr     x9, =gfx_box
        ldr     x2, [x9]
        mul     x10, x2, x2
        mov     x11, ART_FRAMES
        mul     x11, gfx_fc_r, x11
        add     x11, x11, gfx_fd_r
        ldr     x1, =gfx_rot
        madd    x1, x11, x10, x1
        mov     x0, gfx_buf_r
        mov     x3, x2
        mov     x4, gfx_fa_r
        mov     x5, gfx_fb_r
        bl      gfx_blit
        ldr     x9, =sim_s
        ldr     x10, [x9, SIM_STATE]
        mov     x0, gfx_buf_r
        cbz     x10, gfx_frame_title
        cmp     x10, SIM_FADE
        b.eq    gfx_frame_extra
        cmp     x10, SIM_OVER
        b.eq    gfx_frame_over
        ldr     x1, [x9, SIM_SCORE]
        bl      gfx_score
        ldr     x9, =sim_s
        ldr     x10, [x9, SIM_STATE]
        cmp     x10, SIM_READY
        b.ne    gfx_frame_extra
        mov     x0, gfx_buf_r
        bl      gfx_ready
        b       gfx_frame_extra
gfx_frame_title:
        bl      gfx_title
        b       gfx_frame_extra
gfx_frame_over:
        bl      gfx_over
gfx_frame_extra:
        tbz     gfx_ff_r, 0, gfx_frame_debug
        mov     x0, gfx_buf_r
        mov     x1, GFX_E_PAUSED
        mov     x2, GFX_PAUSE_Y
        bl      gfx_ui_mid
gfx_frame_debug:
        tbz     gfx_ff_r, 1, gfx_frame_done
        mov     x0, gfx_buf_r
        ldr     x1, =gfx_dbg
        ldr     x2, =gfx_dbgw
        ldr     x2, [x2]
        ldr     x3, =gfx_dbgh
        ldr     x3, [x3]
        mov     x4, 1
        mov     x5, 1
        bl      gfx_blit
gfx_frame_done:
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     x23, x24, [sp, 48]
        ldr     x25, [sp, 64]
        ldp     fp, lr, [sp], gfx_frame_dealloc
        ret

// gfx_word(x0 = text, x1 = font 5 or 3, x2 = size k, x3 = dest, w4 = fill, w5 = edge,
//   x6 = dest bytes) -> x0 = width, x1 = height, outline included; 0 x 0 when the text is empty
//   or the word does not fit its bitmap or its destination
gfx_word_alloc = -(16 + 80 + 40) & -16
gfx_word_dealloc = 0 - gfx_word_alloc
gfx_word_text = 96
gfx_word_fill = 104
gfx_word_edge = 112
gfx_word_h = 120
gfx_word_room = 128
        .balign 4
gfx_word:
        stp     fp, lr, [sp, gfx_word_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        stp     x23, x24, [sp, 48]
        stp     x25, x26, [sp, 64]
        stp     x27, x28, [sp, 80]
        str     x0, [sp, gfx_word_text]
        str     w4, [sp, gfx_word_fill]
        str     w5, [sp, gfx_word_edge]
        str     x6, [sp, gfx_word_room]
        mov     gfx_wk_r, x2
        mov     gfx_wd_r, x3
        ldr     gfx_wf_r, =art_font5
        mov     gfx_wgw_r, ART_F5_W
        mov     gfx_wgh_r, ART_F5_H
        mov     gfx_wst_r, ART_F5_STEP
        cmp     x1, ART_F5_W
        b.eq    gfx_word_count
        ldr     gfx_wf_r, =art_font3
        mov     gfx_wgw_r, ART_F3_W
        mov     gfx_wgh_r, ART_F3_H
        mov     gfx_wst_r, ART_F3_STEP
gfx_word_count:
        // the widest line and the number of lines size the bitmap
        mov     x9, x0
        mov     x10, 0
        mov     x11, 0
        mov     x12, 1
        b       gfx_word_ctest
gfx_word_cchar:
        add     x10, x10, 1
        cmp     w13, ART_LINE
        b.ne    gfx_word_cmax
        add     x12, x12, 1
        mov     x10, 0
gfx_word_cmax:
        cmp     x10, x11
        csel    x11, x10, x11, gt
        add     x9, x9, 1
gfx_word_ctest:
        ldrb    w13, [x9]
        cbnz    w13, gfx_word_cchar
        mov     x0, 0
        mov     x1, 0
        cbz     x11, gfx_word_done
        add     x13, gfx_wgw_r, 1
        mul     x13, x13, x11
        sub     x13, x13, 1
        mul     gfx_ww_r, x13, gfx_wk_r
        add     x13, gfx_wgh_r, 1
        mul     x13, x13, x12
        sub     x13, x13, 1
        mul     x13, x13, gfx_wk_r
        str     x13, [sp, gfx_word_h]
        mul     x9, gfx_ww_r, x13
        cmp     x9, GFX_WBITS
        b.hi    gfx_word_done
        add     x10, gfx_ww_r, GFX_RING_PAD
        add     x11, x13, GFX_RING_PAD
        mul     x10, x10, x11
        ldr     x11, [sp, gfx_word_room]
        cmp     x10, x11
        b.hi    gfx_word_done
        ldr     x10, =gfx_wbits
gfx_word_clear:
        strb    wzr, [x10], 1
        subs    x9, x9, 1
        b.ne    gfx_word_clear
        mov     gfx_wx_r, 0
        mov     gfx_wy_r, 0
        ldr     gfx_wt_r, [sp, gfx_word_text]
        b       gfx_word_test
gfx_word_char:
        cmp     w0, ART_LINE
        b.ne    gfx_word_glyph
        mov     gfx_wx_r, 0
        add     x9, gfx_wgh_r, 1
        madd    gfx_wy_r, x9, gfx_wk_r, gfx_wy_r
        b       gfx_word_next
gfx_word_glyph:
        bl      art_glyph
        tbnz    x0, 63, gfx_word_adv
        madd    x9, x0, gfx_wst_r, gfx_wf_r
        ldr     x2, =gfx_wbits
        mov     x10, 0
gfx_word_gy:
        mov     x11, 0
gfx_word_gx:
        ldrb    w12, [x9], 1
        cmp     w12, ART_SLASH
        b.eq    gfx_word_gx
        cmp     w12, ART_ON
        b.ne    gfx_word_off
        // one font pixel becomes a k x k block of the bitmap
        madd    x13, x10, gfx_wk_r, gfx_wy_r
        madd    x1, x11, gfx_wk_r, gfx_wx_r
        mov     x14, 0
gfx_word_brow:
        add     x15, x13, x14
        madd    x3, x15, gfx_ww_r, x2
        add     x3, x3, x1
        mov     x4, gfx_wk_r
        mov     w5, 1
gfx_word_bcol:
        strb    w5, [x3], 1
        subs    x4, x4, 1
        b.ne    gfx_word_bcol
        add     x14, x14, 1
        cmp     x14, gfx_wk_r
        b.lt    gfx_word_brow
gfx_word_off:
        add     x11, x11, 1
        cmp     x11, gfx_wgw_r
        b.lt    gfx_word_gx
        add     x10, x10, 1
        cmp     x10, gfx_wgh_r
        b.lt    gfx_word_gy
gfx_word_adv:
        add     x9, gfx_wgw_r, 1
        madd    gfx_wx_r, x9, gfx_wk_r, gfx_wx_r
gfx_word_next:
        add     gfx_wt_r, gfx_wt_r, 1
gfx_word_test:
        ldrb    w0, [gfx_wt_r]
        cbnz    w0, gfx_word_char
        ldr     x0, =gfx_wbits
        mov     x1, gfx_ww_r
        ldr     x2, [sp, gfx_word_h]
        mov     x3, gfx_wd_r
        ldr     w4, [sp, gfx_word_fill]
        ldr     w5, [sp, gfx_word_edge]
        bl      gfx_outline
        add     x0, gfx_ww_r, GFX_RING_PAD
        ldr     x1, [sp, gfx_word_h]
        add     x1, x1, GFX_RING_PAD
gfx_word_done:
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     x23, x24, [sp, 48]
        ldp     x25, x26, [sp, 64]
        ldp     x27, x28, [sp, 80]
        ldp     fp, lr, [sp], gfx_word_dealloc
        ret

// gfx_bake_ui(): this scale's UI words, small digits, medal and sparkle
gfx_bake_ui_alloc = -(16 + 40) & -16
gfx_bake_ui_dealloc = 0 - gfx_bake_ui_alloc
        .balign 4
gfx_bake_ui:
        stp     fp, lr, [sp, gfx_bake_ui_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        str     x23, [sp, 48]
        // art_ui holds each element's word for scales 1 to 4 in turn, so one pass finds them all
        ldr     gfx_us_r, =art_ui
        ldr     gfx_uy_r, =art_style
        ldr     gfx_ut_r, =gfx_uitab
        mov     gfx_uo_r, 0
        mov     gfx_ue_r, 0
gfx_bake_ui_word:
        and     x9, gfx_ue_r, 3
        add     x9, x9, 1
        ldr     x10, =gfx_scale
        ldr     x10, [x10]
        cmp     x9, x10
        b.ne    gfx_bake_ui_end
        str     xzr, [gfx_ut_r, GFX_UITAB_W]
        str     xzr, [gfx_ut_r, GFX_UITAB_H]
        ldrb    w9, [gfx_us_r]
        cbz     w9, gfx_bake_ui_end
        str     gfx_uo_r, [gfx_ut_r, GFX_UITAB_OFF]
        mov     x0, gfx_us_r
        ldrb    w1, [gfx_uy_r]
        ldrb    w2, [gfx_uy_r, 1]
        ldr     x3, =gfx_ui
        add     x3, x3, gfx_uo_r
        ldrb    w4, [gfx_uy_r, 2]
        ldrb    w5, [gfx_uy_r, 3]
        ldr     x6, =GFX_UI_BYTES
        sub     x6, x6, gfx_uo_r
        bl      gfx_word
        str     x0, [gfx_ut_r, GFX_UITAB_W]
        str     x1, [gfx_ut_r, GFX_UITAB_H]
        madd    gfx_uo_r, x0, x1, gfx_uo_r
gfx_bake_ui_end:
        ldrb    w9, [gfx_us_r], 1
        cbnz    w9, gfx_bake_ui_end
        add     gfx_uy_r, gfx_uy_r, 4
        add     gfx_ue_r, gfx_ue_r, 1
        tst     gfx_ue_r, 3
        b.ne    gfx_bake_ui_more
        add     gfx_ut_r, gfx_ut_r, GFX_UITAB_REC
gfx_bake_ui_more:
        cmp     gfx_ue_r, GFX_UI_STRINGS
        b.lt    gfx_bake_ui_word
        // small digits for the panel and the title, drawn as one-character words
        ldr     x9, =gfx_scale
        ldr     x9, [x9]
        mov     gfx_uy_r, ART_F5_W
        cmp     x9, 1
        b.eq    gfx_bake_ui_digits
        mov     gfx_uy_r, ART_F3_W
gfx_bake_ui_digits:
        mov     gfx_ue_r, 0
gfx_bake_ui_digit:
        ldr     x0, =gfx_numtxt
        add     w9, gfx_ue32_r, ART_CHAR_0
        strb    w9, [x0]
        strb    wzr, [x0, 1]
        mov     x1, gfx_uy_r
        mov     x2, 1
        ldr     x3, =gfx_sdigit
        mov     x9, GFX_SDIGIT_BYTES
        madd    x3, gfx_ue_r, x9, x3
        mov     w4, SLOT_WHITE
        mov     w5, SLOT_TOUT
        mov     x6, GFX_SDIGIT_BYTES
        bl      gfx_word
        add     gfx_ue_r, gfx_ue_r, 1
        cmp     gfx_ue_r, GFX_DIGITS
        b.lt    gfx_bake_ui_digit
        ldr     x9, =gfx_sdw
        str     x0, [x9]
        ldr     x9, =gfx_sdh
        str     x1, [x9]
        sub     x0, x0, 1
        ldr     x9, =gfx_sdadv
        str     x0, [x9]
        // the medal and its sparkle are drawn at each size rather than shrunk
        ldr     x9, =gfx_scale
        ldr     x9, [x9]
        ldr     x0, =art_medal1
        mov     gfx_ue_r, ART_MEDAL1
        ldr     gfx_us_r, =art_spark1
        mov     gfx_uo_r, ART_SPARK1
        cmp     x9, 1
        b.eq    gfx_bake_ui_medal
        ldr     x0, =art_medal2
        mov     gfx_ue_r, ART_MEDAL2
        ldr     gfx_us_r, =art_spark2
        mov     gfx_uo_r, ART_SPARK2
        cmp     x9, 2
        b.eq    gfx_bake_ui_medal
        ldr     x0, =art_medal3
        mov     gfx_ue_r, ART_MEDAL3
        ldr     gfx_us_r, =art_spark3
        mov     gfx_uo_r, ART_SPARK3
gfx_bake_ui_medal:
        ldr     x9, =gfx_medw
        str     gfx_ue_r, [x9]
        ldr     x9, =gfx_sparkw
        str     gfx_uo_r, [x9]
        ldr     x1, =art_l_medal
        mul     x2, gfx_ue_r, gfx_ue_r
        ldr     x3, =gfx_medal
        bl      art_decode
        mov     x0, gfx_us_r
        ldr     x1, =art_l_medal
        mul     x2, gfx_uo_r, gfx_uo_r
        ldr     x3, =gfx_spark
        bl      art_decode
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldr     x23, [sp, 48]
        ldp     fp, lr, [sp], gfx_bake_ui_dealloc
        ret

// gfx_rect(x0 = back, x1 = x0, x2 = y0, x3 = x1, x4 = y1, w5 = slot): fills display [x0,x1) x [y0,y1)
        .balign 4
gfx_rect:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =gfx_dw
        ldr     x9, [x9]
        ldr     x10, =gfx_dh
        ldr     x10, [x10]
        ldr     x11, =gfx_stride
        ldr     x11, [x11]
        cmp     x1, 0
        csel    x1, x1, xzr, ge
        cmp     x2, 0
        csel    x2, x2, xzr, ge
        cmp     x3, x9
        csel    x3, x3, x9, le
        cmp     x4, x10
        csel    x4, x4, x10, le
        cmp     x1, x3
        b.ge    gfx_rect_done
        b       gfx_rect_test
gfx_rect_row:
        madd    x12, x2, x11, x0
        add     x12, x12, x1
        sub     x13, x3, x1
gfx_rect_px:
        strb    w5, [x12], 1
        subs    x13, x13, 1
        b.ne    gfx_rect_px
        add     x2, x2, 1
gfx_rect_test:
        cmp     x2, x4
        b.lt    gfx_rect_row
gfx_rect_done:
        ldp     fp, lr, [sp], 16
        ret

// gfx_ui_w(x0 = element) -> x0 = its width at this scale, 0 when it is not drawn here
        .balign 4
gfx_ui_w:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =gfx_uitab
        mov     x10, GFX_UITAB_REC
        madd    x9, x0, x10, x9
        ldr     x0, [x9, GFX_UITAB_W]
        ldp     fp, lr, [sp], 16
        ret

// gfx_ui_put(x0 = back, x1 = element, x2 = x, x3 = y) -> x0 = width, x1 = height, 0 when absent
gfx_ui_put_alloc = -(16 + 16) & -16
gfx_ui_put_dealloc = 0 - gfx_ui_put_alloc
        .balign 4
gfx_ui_put:
        stp     fp, lr, [sp, gfx_ui_put_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        ldr     x9, =gfx_uitab
        mov     x10, GFX_UITAB_REC
        madd    x9, x1, x10, x9
        ldr     gfx_pw_r, [x9, GFX_UITAB_W]
        ldr     gfx_ph_r, [x9, GFX_UITAB_H]
        cbz     gfx_pw_r, gfx_ui_put_done
        ldr     x10, [x9, GFX_UITAB_OFF]
        ldr     x1, =gfx_ui
        add     x1, x1, x10
        mov     x4, x2
        mov     x5, x3
        mov     x2, gfx_pw_r
        mov     x3, gfx_ph_r
        bl      gfx_blit
gfx_ui_put_done:
        mov     x0, gfx_pw_r
        mov     x1, gfx_ph_r
        ldp     x19, x20, [sp, 16]
        ldp     fp, lr, [sp], gfx_ui_put_dealloc
        ret

// gfx_ui_mid(x0 = back, x1 = element, x2 = logical y) -> x0 = width, x1 = height, x2 = display y
gfx_ui_mid_alloc = -(16 + 24) & -16
gfx_ui_mid_dealloc = 0 - gfx_ui_mid_alloc
        .balign 4
gfx_ui_mid:
        stp     fp, lr, [sp, gfx_ui_mid_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        str     x21, [sp, 32]
        mov     gfx_mb_r, x0
        mov     gfx_me_r, x1
        mov     x0, x2
        bl      gfx_d
        mov     gfx_my_r, x0
        mov     x0, gfx_me_r
        bl      gfx_ui_w
        ldr     x2, =gfx_dw
        ldr     x2, [x2]
        sub     x2, x2, x0
        asr     x2, x2, 1
        mov     x0, gfx_mb_r
        mov     x1, gfx_me_r
        mov     x3, gfx_my_r
        bl      gfx_ui_put
        mov     x2, gfx_my_r
        ldp     x19, x20, [sp, 16]
        ldr     x21, [sp, 32]
        ldp     fp, lr, [sp], gfx_ui_mid_dealloc
        ret

// gfx_split(x0 = value) -> x0 = how many digits; the digits, lowest first, go to gfx_nums
        .balign 4
gfx_split:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =gfx_nums
        mov     x10, 0
        mov     x11, GFX_DIGITS
gfx_split_digit:
        udiv    x12, x0, x11
        msub    x13, x12, x11, x0
        strb    w13, [x9, x10]
        add     x10, x10, 1
        mov     x0, x12
        cbnz    x0, gfx_split_digit
        mov     x0, x10
        ldp     fp, lr, [sp], 16
        ret

// gfx_numw(x0 = value) -> x0 = width in small digits; leaves the digits split in gfx_nums
        .balign 4
gfx_numw:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      gfx_split
        ldr     x9, =gfx_ncount
        str     x0, [x9]
        sub     x10, x0, 1
        ldr     x9, =gfx_sdadv
        ldr     x9, [x9]
        ldr     x11, =gfx_sdw
        ldr     x11, [x11]
        madd    x0, x10, x9, x11
        ldp     fp, lr, [sp], 16
        ret

// gfx_num(x0 = back, x1 = value, x2 = left x, x3 = y): the value in small digits
gfx_num_alloc = -(16 + 32) & -16
gfx_num_dealloc = 0 - gfx_num_alloc
        .balign 4
gfx_num:
        stp     fp, lr, [sp, gfx_num_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        mov     gfx_nb_r, x0
        mov     gfx_nx_r, x2
        mov     gfx_ny_r, x3
        mov     x0, x1
        bl      gfx_numw
        ldr     x9, =gfx_ncount
        ldr     gfx_nc_r, [x9]
gfx_num_digit:
        sub     gfx_nc_r, gfx_nc_r, 1
        ldr     x9, =gfx_nums
        ldrb    w10, [x9, gfx_nc_r]
        ldr     x1, =gfx_sdigit
        mov     x9, GFX_SDIGIT_BYTES
        madd    x1, x10, x9, x1
        mov     x0, gfx_nb_r
        ldr     x2, =gfx_sdw
        ldr     x2, [x2]
        ldr     x3, =gfx_sdh
        ldr     x3, [x3]
        mov     x4, gfx_nx_r
        mov     x5, gfx_ny_r
        bl      gfx_blit
        ldr     x9, =gfx_sdadv
        ldr     x9, [x9]
        add     gfx_nx_r, gfx_nx_r, x9
        cbnz    gfx_nc_r, gfx_num_digit
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     fp, lr, [sp], gfx_num_dealloc
        ret

// gfx_medal_of(x0 = score) -> x0 = 0 for none, else 1 bronze to 4 platinum
        .balign 4
gfx_medal_of:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x9, 0
        b       gfx_medal_of_test
gfx_medal_of_up:
        sub     x0, x0, GFX_MEDAL_STEP
        add     x9, x9, 1
gfx_medal_of_test:
        cmp     x9, GFX_MEDALS
        b.ge    gfx_medal_of_done
        cmp     x0, GFX_MEDAL_STEP
        b.ge    gfx_medal_of_up
gfx_medal_of_done:
        mov     x0, x9
        ldp     fp, lr, [sp], 16
        ret

// gfx_title(x0 = back): the wordmark, the prompt, the best score, and at s > 1 the zoom hint
// (in lite only above TERM_LITE_FIRST)
gfx_title_alloc = -(16 + 48) & -16
gfx_title_dealloc = 0 - gfx_title_alloc
        .balign 4
gfx_title:
        stp     fp, lr, [sp, gfx_title_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        stp     x23, x24, [sp, 48]
        mov     gfx_tb_r, x0
        mov     x1, GFX_E_WORD
        mov     x2, GFX_WORD_Y
        bl      gfx_ui_mid
        mov     x0, gfx_tb_r
        mov     x1, GFX_E_PRESS
        mov     x2, GFX_TPRESS_Y
        bl      gfx_ui_mid
        // lite never draws larger than its first scale, so there zooming out cannot help
        ldr     x9, =main_lite
        ldr     x9, [x9]
        cbz     x9, gfx_title_zoom
        ldr     x9, =gfx_scale
        ldr     x9, [x9]
        cmp     x9, TERM_LITE_FIRST
        b.le    gfx_title_best
gfx_title_zoom:
        mov     x0, gfx_tb_r
        mov     x1, GFX_E_ZOOM
        mov     x2, GFX_ZOOM_Y
        bl      gfx_ui_mid
gfx_title_best:
        // label, a one-digit gap, then the number, centred as one line
        ldr     x9, =save_best
        ldr     gfx_tv_r, [x9]
        cbz     gfx_tv_r, gfx_title_done
        mov     x0, GFX_E_TBEST
        bl      gfx_ui_w
        mov     gfx_tw_r, x0
        mov     x0, gfx_tv_r
        bl      gfx_numw
        ldr     x9, =gfx_sdadv
        ldr     gfx_tg_r, [x9]
        add     x9, gfx_tw_r, gfx_tg_r
        add     x9, x9, x0
        ldr     x10, =gfx_dw
        ldr     x10, [x10]
        sub     x10, x10, x9
        asr     gfx_tx_r, x10, 1
        mov     x0, GFX_TBEST_Y
        bl      gfx_d
        mov     gfx_ty_r, x0
        mov     x0, gfx_tb_r
        mov     x1, GFX_E_TBEST
        mov     x2, gfx_tx_r
        mov     x3, gfx_ty_r
        bl      gfx_ui_put
        add     x2, gfx_tx_r, gfx_tw_r
        add     x2, x2, gfx_tg_r
        mov     x0, gfx_tb_r
        mov     x1, gfx_tv_r
        mov     x3, gfx_ty_r
        bl      gfx_num
gfx_title_done:
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     x23, x24, [sp, 48]
        ldp     fp, lr, [sp], gfx_title_dealloc
        ret

// gfx_ready(x0 = back): GET READY, and an arrow under the bird with the key to press
gfx_ready_alloc = -(16 + 24) & -16
gfx_ready_dealloc = 0 - gfx_ready_alloc
        .balign 4
gfx_ready:
        stp     fp, lr, [sp, gfx_ready_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        str     x21, [sp, 32]
        mov     gfx_rb_r, x0
        mov     x1, GFX_E_READY
        mov     x2, GFX_READY_Y
        bl      gfx_ui_mid
        mov     x0, GFX_HINT_X
        bl      gfx_d
        mov     gfx_rx_r, x0
        mov     x0, GFX_HINT_Y
        bl      gfx_d
        mov     gfx_ry_r, x0
        mov     x0, GFX_E_HINT
        bl      gfx_ui_w
        sub     x2, gfx_rx_r, x0, lsr 1
        mov     x0, gfx_rb_r
        mov     x1, GFX_E_HINT
        mov     x3, gfx_ry_r
        bl      gfx_ui_put
        add     gfx_ry_r, gfx_ry_r, x1
        mov     x0, GFX_E_SPACE
        bl      gfx_ui_w
        sub     x2, gfx_rx_r, x0, lsr 1
        mov     x0, gfx_rb_r
        mov     x1, GFX_E_SPACE
        mov     x3, gfx_ry_r
        bl      gfx_ui_put
        ldp     x19, x20, [sp, 16]
        ldr     x21, [sp, 32]
        ldp     fp, lr, [sp], gfx_ready_dealloc
        ret

// gfx_over(x0 = back): GAME OVER drops in, the panel slides up, the score counts, then the
// medal, its sparkle, the NEW badge and the prompt, all timed from the over state's tick
gfx_over_alloc = -(16 + 80) & -16
gfx_over_dealloc = 0 - gfx_over_alloc
        .balign 4
gfx_over:
        stp     fp, lr, [sp, gfx_over_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        stp     x23, x24, [sp, 48]
        stp     x25, x26, [sp, 64]
        stp     x27, x28, [sp, 80]
        mov     gfx_ob_r, x0
        ldr     x9, =sim_s
        ldr     gfx_ost_r, [x9, SIM_ST]
        ldr     gfx_osc_r, [x9, SIM_SCORE]
        mov     x9, GFX_DROP_LAST
        cmp     gfx_ost_r, x9
        csel    x9, gfx_ost_r, x9, lt
        ldr     x10, =gfx_drop
        ldrh    w2, [x10, x9, lsl 1]
        sub     x2, x2, GFX_DROP_BIAS
        mov     x0, gfx_ob_r
        mov     x1, GFX_E_OVER
        bl      gfx_ui_mid
        subs    x9, gfx_ost_r, GFX_SLIDE_FROM
        b.lt    gfx_over_done
        mov     x10, GFX_SLIDE_LAST
        cmp     x9, x10
        csel    x9, x9, x10, lt
        ldr     x10, =gfx_slide
        ldrh    gfx_opy32_r, [x10, x9, lsl 1]
        ldr     x9, =gfx_scale
        ldr     x9, [x9]
        ldr     gfx_oplan_r, =gfx_plan
        mov     x10, GFX_PLAN_REC
        madd    gfx_oplan_r, x9, x10, gfx_oplan_r
        ldrh    w9, [gfx_oplan_r, GFX_PLAN_RISE]
        sub     gfx_opy_r, gfx_opy_r, x9
        mov     x0, GFX_PANEL_X0
        bl      gfx_d
        mov     gfx_ox0_r, x0
        mov     x0, GFX_PANEL_X1
        bl      gfx_d
        mov     gfx_ox1_r, x0
        mov     x0, gfx_opy_r
        bl      gfx_d
        mov     gfx_oy0_r, x0
        ldrh    w9, [gfx_oplan_r, GFX_PLAN_H]
        add     x0, gfx_opy_r, x9
        bl      gfx_d
        mov     gfx_oy1_r, x0
        mov     x0, gfx_ob_r
        mov     x1, gfx_ox0_r
        mov     x2, gfx_oy0_r
        mov     x3, gfx_ox1_r
        mov     x4, gfx_oy1_r
        mov     w5, SLOT_PEDGE
        bl      gfx_rect
        mov     x0, gfx_ob_r
        add     x1, gfx_ox0_r, 1
        add     x2, gfx_oy0_r, 1
        sub     x3, gfx_ox1_r, 1
        sub     x4, gfx_oy1_r, 1
        mov     w5, SLOT_PANEL
        bl      gfx_rect
        mov     x0, GFX_PANEL_NX
        bl      gfx_d
        mov     gfx_ox1_r, x0
        mov     x0, GFX_PANEL_LX
        bl      gfx_d
        mov     gfx_ox0_r, x0
        ldrh    w9, [gfx_oplan_r, GFX_PLAN_L1]
        add     x0, gfx_opy_r, x9
        bl      gfx_d
        mov     x3, x0
        mov     x0, gfx_ob_r
        mov     x1, GFX_E_LMEDAL
        mov     x2, gfx_ox0_r
        bl      gfx_ui_put
        mov     x0, GFX_E_LSCORE
        bl      gfx_ui_w
        sub     gfx_ol_r, gfx_ox1_r, x0
        ldrh    w9, [gfx_oplan_r, GFX_PLAN_L1]
        add     x0, gfx_opy_r, x9
        bl      gfx_d
        mov     x3, x0
        mov     x0, gfx_ob_r
        mov     x1, GFX_E_LSCORE
        mov     x2, gfx_ol_r
        bl      gfx_ui_put
        mov     x0, GFX_E_LBEST
        bl      gfx_ui_w
        sub     gfx_ol_r, gfx_ox1_r, x0
        ldrh    w9, [gfx_oplan_r, GFX_PLAN_L2]
        add     x0, gfx_opy_r, x9
        bl      gfx_d
        mov     x3, x0
        mov     x0, gfx_ob_r
        mov     x1, GFX_E_LBEST
        mov     x2, gfx_ol_r
        bl      gfx_ui_put
        // the count runs quadratically, so a big score still lands in about a second
        mov     gfx_osh_r, 0
        subs    x9, gfx_ost_r, GFX_COUNT_FROM
        b.lt    gfx_over_score
        mul     x9, x9, x9
        lsr     x9, x9, 2
        cmp     x9, gfx_osc_r
        csel    gfx_osh_r, x9, gfx_osc_r, lt
gfx_over_score:
        mov     x0, gfx_osh_r
        bl      gfx_numw
        sub     gfx_ol_r, gfx_ox1_r, x0
        ldrh    w9, [gfx_oplan_r, GFX_PLAN_N1]
        add     x0, gfx_opy_r, x9
        bl      gfx_d
        mov     x3, x0
        mov     x0, gfx_ob_r
        mov     x1, gfx_osh_r
        mov     x2, gfx_ol_r
        bl      gfx_num
        ldr     x9, =save_best
        ldr     x0, [x9]
        bl      gfx_numw
        sub     gfx_ol_r, gfx_ox1_r, x0
        ldrh    w9, [gfx_oplan_r, GFX_PLAN_N2]
        add     x0, gfx_opy_r, x9
        bl      gfx_d
        mov     gfx_oby_r, x0
        mov     x0, gfx_ob_r
        ldr     x9, =save_best
        ldr     x1, [x9]
        mov     x2, gfx_ol_r
        mov     x3, gfx_oby_r
        bl      gfx_num
        // the medal and the badge wait for the count to land
        cmp     gfx_ost_r, GFX_COUNT_FROM
        b.lt    gfx_over_prompt
        cmp     gfx_osh_r, gfx_osc_r
        b.lt    gfx_over_prompt
        ldr     x9, =save_new
        ldr     x9, [x9]
        cbz     x9, gfx_over_medal
        mov     x0, GFX_E_NEW
        bl      gfx_ui_w
        sub     x2, gfx_ol_r, x0
        sub     x2, x2, 1
        mov     x0, gfx_ob_r
        mov     x1, GFX_E_NEW
        mov     x3, gfx_oby_r
        bl      gfx_ui_put
gfx_over_medal:
        mov     x0, gfx_osc_r
        bl      gfx_medal_of
        cbz     x0, gfx_over_prompt
        mov     x0, GFX_MEDAL_CX
        bl      gfx_d
        mov     gfx_ocx_r, x0
        ldrh    w9, [gfx_oplan_r, GFX_PLAN_MEDAL]
        add     x0, gfx_opy_r, x9
        bl      gfx_d
        mov     gfx_ocy_r, x0
        ldr     x9, =gfx_medw
        ldr     x2, [x9]
        sub     x4, gfx_ocx_r, x2, lsr 1
        sub     x5, gfx_ocy_r, x2, lsr 1
        mov     x3, x2
        mov     x0, gfx_ob_r
        ldr     x1, =gfx_medal
        bl      gfx_blit
        and     x9, gfx_ost_r, GFX_SPARK_MASK
        cmp     x9, GFX_SPARK_ON
        b.ge    gfx_over_prompt
        lsr     x9, gfx_ost_r, GFX_SPARK_SHIFT
        and     x9, x9, GFX_SPOT_MASK
        ldr     gfx_ospot_r, =gfx_sparks
        add     gfx_ospot_r, gfx_ospot_r, x9, lsl 1
        ldrb    w0, [gfx_ospot_r]
        sub     x0, x0, GFX_SPARK_BIAS
        bl      gfx_d
        add     gfx_ocx_r, gfx_ocx_r, x0
        ldrb    w0, [gfx_ospot_r, 1]
        sub     x0, x0, GFX_SPARK_BIAS
        bl      gfx_d
        add     gfx_ocy_r, gfx_ocy_r, x0
        ldr     x9, =gfx_sparkw
        ldr     x2, [x9]
        sub     x4, gfx_ocx_r, x2, lsr 1
        sub     x5, gfx_ocy_r, x2, lsr 1
        mov     x3, x2
        mov     x0, gfx_ob_r
        ldr     x1, =gfx_spark
        bl      gfx_blit
gfx_over_prompt:
        cmp     gfx_ost_r, SIM_OVER_LOCK
        b.lt    gfx_over_done
        mov     x0, gfx_ob_r
        mov     x1, GFX_E_PRESS
        ldrh    w2, [gfx_oplan_r, GFX_PLAN_PROMPT]
        bl      gfx_ui_mid
gfx_over_done:
        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        ldp     x23, x24, [sp, 48]
        ldp     x25, x26, [sp, 64]
        ldp     x27, x28, [sp, 80]
        ldp     fp, lr, [sp], gfx_over_dealloc
        ret

// gfx_palette() -> w0 = 1 when gfx_pal changed: this run's look, then the hit flash or a fade
gfx_palette_alloc = -(16 + 16) & -16
gfx_palette_dealloc = 0 - gfx_palette_alloc
        .balign 4
        .global gfx_palette
gfx_palette:
        stp     fp, lr, [sp, gfx_palette_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        // the medal colours load only on the over screen, so a score of 10 mid-run repaints nothing
        mov     x2, 0
        ldr     x9, =sim_s
        ldr     x10, [x9, SIM_STATE]
        cmp     x10, SIM_OVER
        b.ne    gfx_palette_look
        ldr     x0, [x9, SIM_SCORE]
        bl      gfx_medal_of
        mov     x2, x0
gfx_palette_look:
        ldr     x9, =sim_s
        ldr     x0, [x9, SIM_THEME]
        ldr     x1, [x9, SIM_BIRDC]
        bl      art_build
        mov     gfx_pc_r, x0
        // the effect is a kind and a level, kept as one key: flash 1 to 3, dark 1 to 4
        ldr     x9, =sim_s
        ldr     x10, [x9, SIM_STATE]
        ldr     x11, [x9, SIM_ST]
        mov     gfx_pk_r, 0
        cmp     x10, SIM_DYING
        b.eq    gfx_palette_flash
        cmp     x10, SIM_OVER
        b.eq    gfx_palette_flash
        cmp     x10, SIM_FADE
        b.eq    gfx_palette_out
        cmp     x10, SIM_READY
        b.ne    gfx_palette_key
        cmp     x11, GFX_FADEIN_TICKS
        b.ge    gfx_palette_key
        mov     x12, GFX_DARK_LEVELS
        b       gfx_palette_intest
gfx_palette_in:
        sub     x11, x11, GFX_FADEIN_STEP
        sub     x12, x12, 1
gfx_palette_intest:
        cmp     x11, GFX_FADEIN_STEP
        b.ge    gfx_palette_in
        add     gfx_pk_r, x12, GFX_KEY_DARK
        b       gfx_palette_key
gfx_palette_out:
        mov     x12, 1
        b       gfx_palette_outtest
gfx_palette_outup:
        sub     x11, x11, GFX_FADE_STEP
        add     x12, x12, 1
gfx_palette_outtest:
        cmp     x11, GFX_FADE_STEP
        b.ge    gfx_palette_outup
        add     gfx_pk_r, x12, GFX_KEY_DARK
        b       gfx_palette_key
gfx_palette_flash:
        ldr     x11, [x9, SIM_HITT]
        cmp     x11, GFX_FLASH_TICKS
        b.ge    gfx_palette_key
        mov     x12, GFX_FLASH_LEVELS
        b       gfx_palette_ftest
gfx_palette_fdown:
        sub     x11, x11, GFX_FLASH_STEP
        sub     x12, x12, 1
gfx_palette_ftest:
        cmp     x11, GFX_FLASH_STEP
        b.ge    gfx_palette_fdown
        add     gfx_pk_r, x12, GFX_KEY_FLASH
gfx_palette_key:
        ldr     x9, =gfx_effkey
        ldr     x10, [x9]
        cmp     x10, gfx_pk_r
        b.ne    gfx_palette_build
        mov     w0, 0
        cbz     gfx_pc_r, gfx_palette_done
gfx_palette_build:
        str     gfx_pk_r, [x9]
        and     x12, gfx_pk_r, GFX_KEY_LEVEL
        lsl     x12, x12, GFX_TINT_SHIFT
        mov     x13, 256
        sub     x13, x13, x12
        ldr     x9, =art_pal
        ldr     x10, =gfx_pal
        mov     x11, 0
gfx_palette_byte:
        ldrb    w14, [x9, x11]
        tst     gfx_pk_r, GFX_KEY_FLASH
        b.ne    gfx_palette_white
        tst     gfx_pk_r, GFX_KEY_DARK
        b.eq    gfx_palette_put
        mul     x14, x14, x13
        lsr     x14, x14, 8
        b       gfx_palette_put
gfx_palette_white:
        mov     x15, 255
        sub     x15, x15, x14
        mul     x15, x15, x12
        add     x14, x14, x15, lsr 8
gfx_palette_put:
        strb    w14, [x10, x11]
        add     x11, x11, 1
        cmp     x11, GFX_PAL_BYTES
        b.lt    gfx_palette_byte
        mov     w0, 1
gfx_palette_done:
        ldp     x19, x20, [sp, 16]
        ldp     fp, lr, [sp], gfx_palette_dealloc
        ret

// gfx_overlay(x0 = text): the debug lines as one sprite, drawn in the corner while debug is on
        .balign 4
        .global gfx_overlay
gfx_overlay:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =gfx_scale
        ldr     x9, [x9]
        mov     x1, ART_F5_W
        cmp     x9, 1
        b.eq    gfx_overlay_font
        mov     x1, ART_F3_W
gfx_overlay_font:
        mov     x2, 1
        ldr     x3, =gfx_dbg
        mov     w4, SLOT_WHITE
        mov     w5, SLOT_TOUT
        ldr     x6, =GFX_WORD_MAX
        bl      gfx_word
        ldr     x9, =gfx_dbgw
        str     x0, [x9]
        ldr     x9, =gfx_dbgh
        str     x1, [x9]
        ldp     fp, lr, [sp], 16
        ret
