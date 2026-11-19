// sim_: game states, physics, pipes, collision, score, rng and the autopilot.
// The whole game state is one block of 64-bit fields, so a hash can cover it in a fixed order.

define(sim_s_r, x19)
define(sim_press_r, w20)
define(sim_flap_r, w21)
define(sim_i_r, x22)
define(sim_n_r, x19)

SIM_RNG_ZERO = 0x9E3779B97F4A7C15
SIM_RNG_MUL = 0x2545F4914F6CDD1D
SIM_FNV_BASIS = 0xcbf29ce484222325
SIM_FNV_PRIME = 0x100000001b3

        .section .rodata
        .balign 4
        .global sim_wingframe
sim_wingframe:
        .byte   0, 1, 2, 1

        .bss
        .balign 16
        .global sim_s
sim_s:  .skip   SIM_SIZE
// collision masks: three wing frames x twelve rows, bit k = column SIM_BIRD_X + k
sim_mask:   .skip   SIM_MASKS_SIZE

        .text

// sim_rand() -> x0 = next xorshift64* output
        .balign 4
sim_rand:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =sim_s
        ldr     x10, [x9, SIM_RNG]
        eor     x10, x10, x10, lsr 12
        eor     x10, x10, x10, lsl 25
        eor     x10, x10, x10, lsr 27
        str     x10, [x9, SIM_RNG]
        ldr     x11, =SIM_RNG_MUL
        mul     x0, x10, x11
        ldp     fp, lr, [sp], 16
        ret

// sim_pick(x0 = n) -> x0 = uniform value in [0, n)
sim_pick_alloc = -(16 + 8) & -16
sim_pick_dealloc = 0 - sim_pick_alloc
        .balign 4
sim_pick:
        stp     fp, lr, [sp, sim_pick_alloc]!
        mov     fp, sp
        str     sim_n_r, [sp, 16]
        mov     sim_n_r, x0
        bl      sim_rand
        umulh   x0, x0, sim_n_r
        ldr     sim_n_r, [sp, 16]
        ldp     fp, lr, [sp], sim_pick_dealloc
        ret

// sim_pick_look(): day or night and one of three bird colours for the next run
        .balign 4
sim_pick_look:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x0, SIM_THEMES
        bl      sim_pick
        ldr     x9, =sim_s
        str     x0, [x9, SIM_THEME]
        mov     x0, SIM_COLOURS
        bl      sim_pick
        ldr     x9, =sim_s
        str     x0, [x9, SIM_BIRDC]
        ldp     fp, lr, [sp], 16
        ret

// sim_clear_pipes(): parks every pipe far right, where it never draws, hits or scores
        .balign 4
sim_clear_pipes:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =sim_s
        add     x9, x9, SIM_PIPEX
        mov     x10, SIM_PIPE_NONE
        mov     x11, 0
        b       sim_clear_test
sim_clear_loop:
        str     x10, [x9]
        str     xzr, [x9, SIM_PIPE_GAP]
        add     x9, x9, SIM_PIPE_REC
        add     x11, x11, 1
sim_clear_test:
        cmp     x11, SIM_PIPES
        b.lt    sim_clear_loop
        ldp     fp, lr, [sp], 16
        ret

// sim_masks(): masks from the scale 1 bird art, so collision always matches the drawing
        .balign 4
sim_masks:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =art_bird1
        ldr     x10, =sim_mask
        mov     x11, 0
sim_masks_row:
        mov     w12, 0
        mov     x13, 0
sim_masks_col:
        ldrb    w14, [x9], 1
        cmp     w14, ART_CLEAR
        b.eq    sim_masks_clear
        mov     w15, 1
        lsl     w15, w15, w13
        orr     w12, w12, w15
sim_masks_clear:
        add     x13, x13, 1
        cmp     x13, SIM_BIRD_W
        b.lt    sim_masks_col
        str     w12, [x10, x11, lsl 2]
        add     x11, x11, 1
        cmp     x11, SIM_MASK_ROWS
        b.lt    sim_masks_row
        ldp     fp, lr, [sp], 16
        ret

// sim_init(x0 = seed): title state with every field reset
        .balign 4
        .global sim_init
sim_init:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =sim_s
        mov     x10, 0
        b       sim_init_test
sim_init_loop:
        str     xzr, [x9, x10]
        add     x10, x10, 8
sim_init_test:
        cmp     x10, SIM_SIZE
        b.lt    sim_init_loop
        cbnz    x0, sim_init_seeded
        ldr     x0, =SIM_RNG_ZERO
sim_init_seeded:
        str     x0, [x9, SIM_RNG]
        mov     x10, SIM_Y0_Q8
        str     x10, [x9, SIM_Y]
        mov     x10, SIM_BOB_STEP
        str     x10, [x9, SIM_BOBD]
        bl      sim_clear_pipes
        bl      sim_pick_look
        bl      sim_masks
        ldp     fp, lr, [sp], 16
        ret

// sim_reset_run(): a fresh get ready after the fade, with a new look
        .balign 4
sim_reset_run:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =sim_s
        mov     x10, SIM_READY
        str     x10, [x9, SIM_STATE]
        str     xzr, [x9, SIM_ST]
        mov     x10, SIM_Y0_Q8
        str     x10, [x9, SIM_Y]
        str     xzr, [x9, SIM_VY]
        str     xzr, [x9, SIM_GC]
        str     xzr, [x9, SIM_TILT]
        str     xzr, [x9, SIM_BOB]
        mov     x10, SIM_BOB_STEP
        str     x10, [x9, SIM_BOBD]
        str     xzr, [x9, SIM_SCORE]
        str     xzr, [x9, SIM_HITPIPE]
        str     xzr, [x9, SIM_HITT]
        bl      sim_clear_pipes
        bl      sim_pick_look
        ldp     fp, lr, [sp], 16
        ret

// sim_start_play(): the bird keeps its bobbing height and the first pipes line up offscreen
sim_start_play_alloc = -(16 + 16) & -16
sim_start_play_dealloc = 0 - sim_start_play_alloc
        .balign 4
sim_start_play:
        stp     fp, lr, [sp, sim_start_play_alloc]!
        mov     fp, sp
        stp     x19, x22, [sp, 16]
        ldr     sim_s_r, =sim_s
        ldr     x9, [sim_s_r, SIM_Y]
        ldr     x10, [sim_s_r, SIM_BOB]
        add     x9, x9, x10
        str     x9, [sim_s_r, SIM_Y]
        str     xzr, [sim_s_r, SIM_BOB]
        mov     sim_i_r, 0
        b       sim_start_test
sim_start_loop:
        mov     x9, SIM_PIPE_SPACING
        mov     x10, SIM_PIPE_FIRST_X
        madd    x10, sim_i_r, x9, x10
        add     x11, sim_s_r, SIM_PIPEX
        mov     x12, SIM_PIPE_REC
        madd    x11, sim_i_r, x12, x11
        str     x10, [x11]
        mov     x0, SIM_GAP_RANGE
        bl      sim_pick
        add     x0, x0, SIM_GAP_MIN
        add     x11, sim_s_r, SIM_PIPEX
        mov     x12, SIM_PIPE_REC
        madd    x11, sim_i_r, x12, x11
        str     x0, [x11, SIM_PIPE_GAP]
        add     sim_i_r, sim_i_r, 1
sim_start_test:
        cmp     sim_i_r, SIM_PIPES
        b.lt    sim_start_loop
        mov     x9, SIM_PLAY
        str     x9, [sim_s_r, SIM_STATE]
        str     xzr, [sim_s_r, SIM_ST]
        ldp     x19, x22, [sp, 16]
        ldp     fp, lr, [sp], sim_start_play_dealloc
        ret

// sim_bob_step(): triangle wave for the title and get ready bob
        .balign 4
sim_bob_step:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =sim_s
        ldr     x10, [x9, SIM_BOB]
        ldr     x11, [x9, SIM_BOBD]
        cmp     x10, 0
        cneg    x12, x10, lt
        cmp     x12, SIM_BOB_MAX
        b.ne    sim_bob_add
        neg     x11, x11
        str     x11, [x9, SIM_BOBD]
sim_bob_add:
        add     x10, x10, x11
        str     x10, [x9, SIM_BOB]
        ldp     fp, lr, [sp], 16
        ret

// sim_wing_step(): frames 0 1 2 1, one step every SIM_WING_TICKS ticks
        .balign 4
sim_wing_step:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =sim_s
        ldr     x10, [x9, SIM_WSUB]
        add     x10, x10, 1
        cmp     x10, SIM_WING_TICKS
        b.ne    sim_wing_store
        mov     x10, 0
        ldr     x11, [x9, SIM_WING]
        add     x11, x11, 1
        and     x11, x11, 3
        str     x11, [x9, SIM_WING]
sim_wing_store:
        str     x10, [x9, SIM_WSUB]
        ldp     fp, lr, [sp], 16
        ret

// sim_ground_step(): the ground scrolls one pixel, wrapping at its pattern period
        .balign 4
sim_ground_step:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =sim_s
        ldr     x10, [x9, SIM_GROUNDX]
        add     x10, x10, 1
        cmp     x10, SIM_GROUND_PERIOD
        csel    x10, x10, xzr, lt
        str     x10, [x9, SIM_GROUNDX]
        ldp     fp, lr, [sp], 16
        ret

// sim_gravity(x0 = step, x1 = max fall): velocity changes once per classic frame, never on a flap's own
        .balign 4
sim_gravity:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =sim_s
        ldr     x10, [x9, SIM_GC]
        tst     x10, 1
        b.ne    sim_grav_count
        cbz     x10, sim_grav_count
        ldr     x11, [x9, SIM_VY]
        cmp     x11, x1
        b.ge    sim_grav_count
        add     x11, x11, x0
        str     x11, [x9, SIM_VY]
sim_grav_count:
        add     x10, x10, 1
        str     x10, [x9, SIM_GC]
        ldp     fp, lr, [sp], 16
        ret

// sim_hit_test() -> w0 = 0 clear, 1 pipe, 2 ground; masks are unrotated, tilt is drawing only
        .balign 4
sim_hit_test:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =sim_s
        ldr     x10, [x9, SIM_Y]
        asr     x10, x10, 8
        add     x11, x10, SIM_BIRD_LOW
        cmp     x11, GROUND_Y
        b.ge    sim_hit_ground
        ldr     x11, [x9, SIM_WING]
        ldr     x12, =sim_wingframe
        ldrb    w11, [x12, x11]
        mov     x12, SIM_MASK_BYTES
        mul     x11, x11, x12
        ldr     x12, =sim_mask
        add     x12, x12, x11
        add     x13, x9, SIM_PIPEX
        add     x14, x13, SIM_PIPE_BYTES
sim_hit_pipe:
        ldr     x15, [x13]
        cmp     x15, SIM_BIRD_X1
        b.gt    sim_hit_next
        add     x0, x15, SIM_CAP_X1
        cmp     x0, SIM_BIRD_X
        b.lt    sim_hit_next
        // the cap overhangs the body by a pixel each side, so a pipe tests two column spans,
        // each as bits of the bird's row word so one AND against the mask decides the row
        sub     x1, x15, SIM_BIRD_X
        cmp     x1, 0
        csel    x1, x1, xzr, ge
        add     x2, x15, SIM_CAP_X1
        sub     x2, x2, SIM_BIRD_X
        mov     x3, SIM_MASK_LAST
        cmp     x2, x3
        csel    x2, x2, x3, le
        mov     x3, 2
        lsl     x3, x3, x2
        mov     x4, 1
        lsl     x4, x4, x1
        sub     x3, x3, x4
        cmp     x1, x2
        csel    x3, x3, xzr, le
        add     x1, x15, 1
        sub     x1, x1, SIM_BIRD_X
        cmp     x1, 0
        csel    x1, x1, xzr, ge
        add     x2, x15, SIM_BODY_X1
        sub     x2, x2, SIM_BIRD_X
        mov     x4, SIM_MASK_LAST
        cmp     x2, x4
        csel    x2, x2, x4, le
        mov     x4, 2
        lsl     x4, x4, x2
        mov     x5, 1
        lsl     x5, x5, x1
        sub     x4, x4, x5
        cmp     x1, x2
        csel    x4, x4, xzr, le
        ldr     x5, [x13, SIM_PIPE_GAP]
        mov     x6, 0
sim_hit_row:
        add     x7, x10, x6
        sub     x8, x7, x5
        mov     x0, x4
        cmn     x8, SIM_PIPE_CAP_H
        b.lt    sim_hit_and
        mov     x0, x3
        cmp     x8, 0
        b.lt    sim_hit_and
        cmp     x8, SIM_GAP_H
        b.lt    sim_hit_rnext
        cmp     x8, SIM_LOW_CAP
        b.lt    sim_hit_and
        mov     x0, x4
        cmp     x7, GROUND_Y
        b.ge    sim_hit_rnext
sim_hit_and:
        ldr     w8, [x12, x6, lsl 2]
        tst     x8, x0
        b.ne    sim_hit_found
sim_hit_rnext:
        add     x6, x6, 1
        cmp     x6, SIM_BIRD_H
        b.lt    sim_hit_row
sim_hit_next:
        add     x13, x13, SIM_PIPE_REC
        cmp     x13, x14
        b.lt    sim_hit_pipe
        mov     w0, 0
        b       sim_hit_done
sim_hit_found:
        mov     w0, 1
        b       sim_hit_done
sim_hit_ground:
        mov     w0, 2
sim_hit_done:
        ldp     fp, lr, [sp], 16
        ret

// sim_pipes_step(): pipes move one pixel left; one leaving the field returns at the far end
sim_pipes_step_alloc = -(16 + 16) & -16
sim_pipes_step_dealloc = 0 - sim_pipes_step_alloc
        .balign 4
sim_pipes_step:
        stp     fp, lr, [sp, sim_pipes_step_alloc]!
        mov     fp, sp
        stp     x19, x22, [sp, 16]
        ldr     sim_s_r, =sim_s
        add     sim_s_r, sim_s_r, SIM_PIPEX
        mov     sim_i_r, 0
        b       sim_pipes_test
sim_pipes_loop:
        ldr     x9, [sim_s_r]
        sub     x9, x9, 1
        mov     x10, SIM_PIPE_OFF
        cmp     x9, x10
        b.ge    sim_pipes_store
        add     x9, x9, SIM_PIPE_WRAP
        str     x9, [sim_s_r]
        mov     x0, SIM_GAP_RANGE
        bl      sim_pick
        add     x0, x0, SIM_GAP_MIN
        str     x0, [sim_s_r, SIM_PIPE_GAP]
        b       sim_pipes_inc
sim_pipes_store:
        str     x9, [sim_s_r]
sim_pipes_inc:
        add     sim_s_r, sim_s_r, SIM_PIPE_REC
        add     sim_i_r, sim_i_r, 1
sim_pipes_test:
        cmp     sim_i_r, SIM_PIPES
        b.lt    sim_pipes_loop
        ldp     x19, x22, [sp, 16]
        ldp     fp, lr, [sp], sim_pipes_step_dealloc
        ret

// sim_inc(x0 = field offset): adds one to a field
        .balign 4
sim_inc:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =sim_s
        ldr     x10, [x9, x0]
        add     x10, x10, 1
        str     x10, [x9, x0]
        ldp     fp, lr, [sp], 16
        ret

// sim_tick(w0 = press): one 60 Hz tick, in the classic loop's order
sim_tick_alloc = -(16 + 24) & -16
sim_tick_dealloc = 0 - sim_tick_alloc
        .balign 4
        .global sim_tick
sim_tick:
        stp     fp, lr, [sp, sim_tick_alloc]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        str     x21, [sp, 32]
        ldr     sim_s_r, =sim_s
        mov     sim_press_r, w0
        mov     x0, SIM_TCOUNT
        bl      sim_inc
        ldr     x9, [sim_s_r, SIM_STATE]
        cmp     x9, SIM_READY
        b.gt    sim_tick_late
        cbz     sim_press_r, sim_tick_idle
        cbnz    x9, sim_tick_start
        mov     x10, SIM_FADE
        str     x10, [sim_s_r, SIM_STATE]
        str     xzr, [sim_s_r, SIM_ST]
        b       sim_tick_done
sim_tick_idle:
        bl      sim_bob_step
        bl      sim_wing_step
        bl      sim_ground_step
        mov     x0, SIM_ST
        bl      sim_inc
        b       sim_tick_done
sim_tick_start:
        bl      sim_start_play
        b       sim_tick_play
sim_tick_late:
        cmp     x9, SIM_PLAY
        b.eq    sim_tick_play
        cmp     x9, SIM_DYING
        b.eq    sim_tick_dying
        cmp     x9, SIM_OVER
        b.eq    sim_tick_over
        mov     x0, SIM_ST
        bl      sim_inc
        ldr     x9, [sim_s_r, SIM_ST]
        cmp     x9, SIM_FADE_TICKS
        b.lt    sim_tick_done
        bl      sim_reset_run
        b       sim_tick_done

sim_tick_play:
        mov     sim_flap_r, 0
        cbz     sim_press_r, sim_tick_hit
        ldr     x9, [sim_s_r, SIM_Y]
        mov     x10, SIM_CEIL
        cmp     x9, x10
        b.le    sim_tick_hit
        mov     x10, SIM_FLAP_VY
        str     x10, [sim_s_r, SIM_VY]
        str     xzr, [sim_s_r, SIM_GC]
        mov     sim_flap_r, 1
sim_tick_hit:
        bl      sim_hit_test
        cbz     w0, sim_tick_score
        str     xzr, [sim_s_r, SIM_HITT]
        str     xzr, [sim_s_r, SIM_GC]
        str     xzr, [sim_s_r, SIM_ST]
        cmp     w0, 1
        cset    x9, eq
        str     x9, [sim_s_r, SIM_HITPIPE]
        mov     x10, SIM_OVER
        mov     x11, SIM_DYING
        csel    x10, x11, x10, eq
        str     x10, [sim_s_r, SIM_STATE]
        b       sim_tick_done
sim_tick_score:
        add     x9, sim_s_r, SIM_PIPEX
        add     x10, x9, SIM_PIPE_BYTES
        ldr     x11, [sim_s_r, SIM_SCORE]
sim_tick_sloop:
        ldr     x12, [x9], SIM_PIPE_REC
        cmp     x12, SIM_SCORE_X
        cinc    x11, x11, eq
        cmp     x9, x10
        b.lt    sim_tick_sloop
        str     x11, [sim_s_r, SIM_SCORE]
        bl      sim_wing_step
        bl      sim_ground_step
        ldr     x9, [sim_s_r, SIM_TILT]
        mov     x10, SIM_TILT_MIN
        cmp     x9, x10
        b.le    sim_tick_tilted
        sub     x9, x9, SIM_TILT_STEP
sim_tick_tilted:
        cbz     sim_flap_r, sim_tick_tset
        mov     x9, SIM_TILT_FLAP
sim_tick_tset:
        str     x9, [sim_s_r, SIM_TILT]
        mov     x0, SIM_GRAVITY
        mov     x1, SIM_MAX_FALL
        bl      sim_gravity
        ldr     x9, [sim_s_r, SIM_Y]
        ldr     x10, [sim_s_r, SIM_VY]
        add     x9, x9, x10
        mov     x11, SIM_Y_MAX
        cmp     x9, x11
        csel    x9, x9, x11, le
        str     x9, [sim_s_r, SIM_Y]
        bl      sim_pipes_step
        mov     x0, SIM_ST
        bl      sim_inc
        b       sim_tick_done

sim_tick_dying:
        mov     x0, SIM_ST
        bl      sim_inc
        mov     x0, SIM_HITT
        bl      sim_inc
        ldr     x9, [sim_s_r, SIM_HITPIPE]
        cbz     x9, sim_tick_dfall
        ldr     x9, [sim_s_r, SIM_TILT]
        sub     x9, x9, SIM_TILT_HIT_STEP
        mov     x10, SIM_TILT_MIN
        cmp     x9, x10
        csel    x9, x9, x10, gt
        str     x9, [sim_s_r, SIM_TILT]
sim_tick_dfall:
        mov     x0, SIM_HIT_GRAVITY
        mov     x1, SIM_HIT_MAX_FALL
        bl      sim_gravity
        ldr     x9, [sim_s_r, SIM_Y]
        ldr     x10, [sim_s_r, SIM_VY]
        add     x9, x9, x10
        mov     x11, SIM_Y_MAX
        cmp     x9, x11
        b.lt    sim_tick_dstore
        mov     x9, x11
        mov     x10, SIM_OVER
        str     x10, [sim_s_r, SIM_STATE]
        str     xzr, [sim_s_r, SIM_ST]
sim_tick_dstore:
        str     x9, [sim_s_r, SIM_Y]
        b       sim_tick_done

sim_tick_over:
        cbz     sim_press_r, sim_tick_oinc
        ldr     x9, [sim_s_r, SIM_ST]
        cmp     x9, SIM_OVER_LOCK
        b.lt    sim_tick_oinc
        mov     x10, SIM_FADE
        str     x10, [sim_s_r, SIM_STATE]
        str     xzr, [sim_s_r, SIM_ST]
        b       sim_tick_done
sim_tick_oinc:
        mov     x0, SIM_ST
        bl      sim_inc
        mov     x0, SIM_HITT
        bl      sim_inc

sim_tick_done:
        ldp     x19, x20, [sp, 16]
        ldr     x21, [sp, 32]
        ldp     fp, lr, [sp], sim_tick_dealloc
        ret

// sim_autopilot() -> w0 = press; flaps when the bird's centre falls a margin below the next gap's
        .balign 4
        .global sim_autopilot
sim_autopilot:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =sim_s
        ldr     x10, [x9, SIM_STATE]
        ldr     x11, [x9, SIM_ST]
        mov     w0, 0
        cmp     x10, SIM_READY
        b.gt    sim_ap_late
        cmp     x11, SIM_AP_DELAY
        cset    w0, eq
        b       sim_ap_done
sim_ap_late:
        cmp     x10, SIM_OVER
        b.ne    sim_ap_play
        cmp     x11, SIM_AP_OVER
        cset    w0, eq
        b       sim_ap_done
sim_ap_play:
        cmp     x10, SIM_PLAY
        b.ne    sim_ap_done
        add     x12, x9, SIM_PIPEX
        add     x13, x12, SIM_PIPE_BYTES
        mov     x14, SIM_PIPE_NONE
        mov     x15, 0
sim_ap_scan:
        ldr     x1, [x12]
        ldr     x2, [x12, SIM_PIPE_GAP]
        cmp     x1, SIM_NEXT_X
        b.lt    sim_ap_skip
        cmp     x1, x14
        b.ge    sim_ap_skip
        mov     x14, x1
        mov     x15, x2
sim_ap_skip:
        add     x12, x12, SIM_PIPE_REC
        cmp     x12, x13
        b.lt    sim_ap_scan
        ldr     x1, [x9, SIM_Y]
        asr     x1, x1, 8
        add     x1, x1, SIM_AP_BIRD
        add     x15, x15, SIM_AP_GAP
        cmp     x1, x15
        cset    w0, gt
sim_ap_done:
        ldp     fp, lr, [sp], 16
        ret

// sim_hash() -> x0 = FNV-1a 64 over every state field in order
        .balign 4
        .global sim_hash
sim_hash:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x9, =sim_s
        ldr     x0, =SIM_FNV_BASIS
        ldr     x11, =SIM_FNV_PRIME
        mov     x10, 0
sim_hash_loop:
        ldrb    w12, [x9, x10]
        eor     x0, x0, x12
        mul     x0, x0, x11
        add     x10, x10, 1
        cmp     x10, SIM_SIZE
        b.lt    sim_hash_loop
        ldp     fp, lr, [sp], 16
        ret
