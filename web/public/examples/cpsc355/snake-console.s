// snake - a turn-based snake game for the console
//
// The full real-time terminal version of this game lives at
//   https://github.com/Abdalla-Eldoumani/snake-game
//
// how to play: run the program, then type a line of moves into the
// console each turn and press run to continue.
//   w a s d   one step up / left / down / right
//   dddww     a whole route, one frame per step
//   5d        a count repeats a move
//   enter     a blank line steps ahead once
//   q         end the game
// pass a number as a program argument for a different food layout.

// board geometry. the border strings in .data are sized to GRID_W,
// so the two must change together.
GRID_W = 20
GRID_H = 12
GRID_W_M1 = 19
GRID_H_M1 = 11
ROW_EDGE = 22
GRID_CELLS = 240
SPAWN_Y = 6

MAX_SNAKE = 240
START_LEN = 3
START_LIVES = 3
NUM_OBST = 8

MODE_CLASSIC = 1
MODE_ENDLESS = 2
MODE_SPRINT = 3
MODE_MAZE = 4

CELL_EMPTY = 0
CELL_SNAKE = 1
CELL_FOOD = 2
CELL_GOLD = 3
CELL_OBST = 4
CELL_SHRINK = 5

FOOD_PTS = 10
GOLD_PTS = 50
GOLD_CHANCE = 6
BONUS_CHANCE = 10
SHRINK_N = 3

STEP_OK = 0
STEP_DIED = 1
STEP_OVER = 2

PLAY_QUIT = 0
PLAY_MENU = 1

SYS_OPENAT = 56
SYS_CLOSE = 57
SYS_READ = 63
SYS_WRITE = 64
AT_FDCWD = -100
O_RDONLY = 0
O_WRFLAGS = 577
FILE_MODE = 420

DEFAULT_SEED = 355

// ascii codes, since the assembler wants plain numbers in compares
CH_NL = 10
CH_CR = 13
CH_TAB = 9
CH_SPACE = 32
CH_ZERO = 48
CH_NINE = 57
CH_ONE = 49
CH_FOUR = 52
CH_COLON = 58
CH_AT = 64
CH_PIPE = 124
CH_LOW_A = 97
CH_LOW_D = 100
CH_LOW_M = 109
CH_LOW_Q = 113
CH_LOW_S = 115
CH_LOW_W = 119
CH_LOW_Y = 121
CH_UP_Q = 81

// register names. every alias ends in _r so no name can collide with
// a word inside a string when m4 substitutes tokens.
define(fp, x29)
define(lr, x30)

// main
define(argc_r, w19)
define(argv_r, x20)
define(mode_r, w21)
define(seed_r, w22)

// play_game input pump
define(ch_r, w19)
define(rpt_r, w20)
define(hadmv_r, w21)
define(times_r, w22)
define(ndx_r, w23)
define(ndy_r, w24)

// step_once
define(nx_r, w19)
define(ny_r, w20)
define(cell_r, w21)
define(pts_r, w22)

// draw_frame
define(row_r, w19)
define(col_r, w20)
define(gp_r, x21)
define(rp_r, x22)
define(hx_r, w23)
define(hy_r, w24)

// lay_board / init_game / place_food / spawn_bonus
define(i_r, w19)
define(px_r, w19)
define(py_r, w20)
define(pn_r, w21)

// load_scores / save_scores / game_over_screen
define(fd_r, w19)
define(bp_r, x20)
define(sl_r, w21)
define(val_r, w22)
define(choice_r, w19)

        .data

banner_1:   .string "  ####  #   #  ####  #  #  #####"
banner_2:   .string " #      ##  # #    # # #   #"
banner_3:   .string "  ###   # # # ###### ##    ###"
banner_4:   .string "     #  #  ## #    # # #   #"
banner_5:   .string " ####   #   # #    # #  #  #####"
banner_6:   .string "        turn-based arcade"

menu_1:     .string "   1) classic - walls end a life"
menu_2:     .string "   2) endless - edges wrap around"
menu_3:     .string "   3) sprint  - two cells per move"
menu_4:     .string "   4) maze    - dodge the obstacles"
menu_5:     .string "   q) quit"
menu_hs:    .string "  best: classic %d  endless %d  sprint %d  maze %d\n"
menu_seed:  .string "  seed %d (run with a number argument to change it)\n"
menu_pick:  .string "  pick a mode:"

legend_1:   .string "controls: w=up s=down a=left d=right  q=end game"
legend_2:   .string "type a line of moves, then enter: dddww walks, 5d repeats,"
legend_3:   .string "a blank line steps ahead once"
legend_4:   .string "board: @ head  o body  * food +10  $ gold +50  ~ shrink  # wall"

status_fmt: .string " score %d | len %d | lives %d | %s | moves %d\n"
top_border: .string " +--------------------+"
glyphs:     .string " o*$#~"
prompt_txt: .string "move:"

name_classic: .string "classic"
name_endless: .string "endless"
name_sprint:  .string "sprint"
name_maze:    .string "maze"

msg_wall:    .string "-- you hit a wall"
msg_self:    .string "-- you ran into yourself"
msg_obst:    .string "-- you hit an obstacle"
msg_lives:   .string "-- lives left: %d\n"
msg_shrink:  .string "-- shrink pickup: the snake loses a few segments"
msg_norev:   .string "-- the snake cannot reverse into itself"
msg_full:    .string "-- the board is full: perfect game"

over_1:      .string " +--------------------------+"
over_2:      .string " |        GAME  OVER        |"
over_fmt:    .string "  final score %d in %s mode\n"
over_rec:    .string "  new high score for this mode!"
over_ask:    .string "  again? y=same mode  m=menu  q=quit"

bye_txt:     .string "thanks for playing"
save_warn:   .string "-- could not write scores.txt"

score_path:  .string "scores.txt"
lbl_classic: .string "classic:"
lbl_endless: .string "endless:"
lbl_sprint:  .string "sprint:"
lbl_maze:    .string "maze:"

        .bss

// word-sized state first so everything stays naturally aligned
high_scores: .skip 16
score:       .skip 4
lives:       .skip 4
game_mode:   .skip 4
snake_len:   .skip 4
head_idx:    .skip 4
tail_idx:    .skip 4
dir_x:       .skip 4
dir_y:       .skip 4
bonus_live:  .skip 4
move_count:  .skip 4
obst_x:      .skip 32
obst_y:      .skip 32

grid:        .skip 240
body_x:      .skip 240
body_y:      .skip 240
row_buf:     .skip 32
io_buf:      .skip 160

        .text

// ---------------------------------------------------------------
// main: seed the generator, load saved scores, then loop between
// the menu and the game until the player quits.
// ---------------------------------------------------------------
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x19, x20, [sp, -16]!
        stp     x21, x22, [sp, -16]!

        mov     argc_r, w0
        mov     argv_r, x1

        // seed from the first program argument when one is given
        mov     seed_r, DEFAULT_SEED
        cmp     argc_r, 1
        b.lt    main_seeded
        ldr     x0, [argv_r]
        bl      atoi
        cmp     w0, 0
        b.le    main_seeded
        mov     seed_r, w0
main_seeded:
        mov     w0, seed_r
        bl      srand

        bl      load_scores

main_menu_loop:
        mov     w0, seed_r
        bl      show_menu
        mov     mode_r, w0
        cmp     mode_r, 0
        b.eq    main_done

        mov     w0, mode_r
        bl      init_game

        ldr     x0, =legend_1
        bl      puts
        ldr     x0, =legend_2
        bl      puts
        ldr     x0, =legend_3
        bl      puts
        ldr     x0, =legend_4
        bl      puts

        bl      draw_frame
        ldr     x0, =prompt_txt
        bl      puts

        bl      play_game
        cmp     w0, PLAY_MENU
        b.eq    main_menu_loop

main_done:
        ldr     x0, =bye_txt
        bl      puts

        mov     w0, 0
        ldp     x21, x22, [sp], 16
        ldp     x19, x20, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// ---------------------------------------------------------------
// show_menu(seed) -> mode 1..4, or 0 to quit.
// prints the banner, the mode list, and the saved high scores,
// then reads one choice character.
// ---------------------------------------------------------------
show_menu:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        str     x19, [sp, -16]!

        mov     w19, w0

        ldr     x0, =banner_1
        bl      puts
        ldr     x0, =banner_2
        bl      puts
        ldr     x0, =banner_3
        bl      puts
        ldr     x0, =banner_4
        bl      puts
        ldr     x0, =banner_5
        bl      puts
        ldr     x0, =banner_6
        bl      puts
        ldr     x0, =menu_1
        bl      puts
        ldr     x0, =menu_2
        bl      puts
        ldr     x0, =menu_3
        bl      puts
        ldr     x0, =menu_4
        bl      puts
        ldr     x0, =menu_5
        bl      puts

        ldr     x4, =high_scores
        ldr     x0, =menu_hs
        ldr     w1, [x4]
        ldr     w2, [x4, 4]
        ldr     w3, [x4, 8]
        ldr     w4, [x4, 12]
        bl      printf

        ldr     x0, =menu_seed
        mov     w1, w19
        bl      printf

        ldr     x0, =menu_pick
        bl      puts

menu_read:
        bl      getchar
        tbnz    w0, 31, menu_quit
        cmp     w0, CH_LOW_Q
        b.eq    menu_quit
        cmp     w0, CH_UP_Q
        b.eq    menu_quit
        cmp     w0, CH_ONE
        b.lt    menu_read
        cmp     w0, CH_FOUR
        b.gt    menu_read
        sub     w19, w0, CH_ZERO
        bl      eat_line
        mov     w0, w19
        b       menu_out

menu_quit:
        mov     w0, 0
menu_out:
        ldr     x19, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// ---------------------------------------------------------------
// init_game(mode): fresh score, lives, and obstacles, then lay the
// board. respawns after a lost life go through lay_board directly
// so score and lives carry over.
// ---------------------------------------------------------------
init_game:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x19, x20, [sp, -16]!
        str     x21, [sp, -16]!

        ldr     x1, =game_mode
        str     w0, [x1]
        ldr     x1, =score
        str     wzr, [x1]
        ldr     x1, =lives
        mov     w2, START_LIVES
        str     w2, [x1]
        ldr     x1, =move_count
        str     wzr, [x1]

        // maze mode rolls its obstacle spots once per game. the spawn
        // row stays clear so the snake always has a safe lane.
        ldr     x1, =game_mode
        ldr     w1, [x1]
        cmp     w1, MODE_MAZE
        b.ne    init_laid

        mov     i_r, 0
init_obst_loop:
        cmp     i_r, NUM_OBST
        b.ge    init_laid
init_obst_roll:
        mov     w0, GRID_H
        bl      rand_range
        cmp     w0, SPAWN_Y
        b.eq    init_obst_roll
        mov     w20, w0
        mov     w0, GRID_W
        bl      rand_range
        mov     w21, w0

        ldr     x2, =obst_x
        str     w21, [x2, w19, sxtw 2]
        ldr     x2, =obst_y
        str     w20, [x2, w19, sxtw 2]
        add     i_r, i_r, 1
        b       init_obst_loop

init_laid:
        bl      lay_board

        ldr     x21, [sp], 16
        ldp     x19, x20, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// ---------------------------------------------------------------
// lay_board: clear the grid, place obstacles and the starting
// snake, then drop the first food. used for both a new game and a
// respawn after a lost life.
// ---------------------------------------------------------------
lay_board:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        str     x19, [sp, -16]!

        ldr     x0, =grid
        mov     w1, 0
        mov     x2, GRID_CELLS
        bl      memset

        ldr     x1, =game_mode
        ldr     w1, [x1]
        cmp     w1, MODE_MAZE
        b.ne    lay_snake

        mov     i_r, 0
lay_obst_loop:
        cmp     i_r, NUM_OBST
        b.ge    lay_snake
        ldr     x2, =obst_x
        ldr     w0, [x2, w19, sxtw 2]
        ldr     x2, =obst_y
        ldr     w1, [x2, w19, sxtw 2]
        bl      grid_addr
        mov     w2, CELL_OBST
        strb    w2, [x0]
        add     i_r, i_r, 1
        b       lay_obst_loop

lay_snake:
        // three segments on the spawn row, head at the right end,
        // heading right
        ldr     x1, =snake_len
        mov     w2, START_LEN
        str     w2, [x1]
        ldr     x1, =tail_idx
        str     wzr, [x1]
        ldr     x1, =head_idx
        mov     w2, 2
        str     w2, [x1]
        ldr     x1, =dir_x
        mov     w2, 1
        str     w2, [x1]
        ldr     x1, =dir_y
        str     wzr, [x1]

        mov     i_r, 0
lay_seg_loop:
        cmp     i_r, START_LEN
        b.ge    lay_food
        add     w2, i_r, 2
        ldr     x3, =body_x
        strb    w2, [x3, w19, sxtw]
        mov     w2, SPAWN_Y
        ldr     x3, =body_y
        strb    w2, [x3, w19, sxtw]

        add     w0, i_r, 2
        mov     w1, SPAWN_Y
        bl      grid_addr
        mov     w2, CELL_SNAKE
        strb    w2, [x0]
        add     i_r, i_r, 1
        b       lay_seg_loop

lay_food:
        ldr     x1, =bonus_live
        str     wzr, [x1]
        bl      place_food

        ldr     x19, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// ---------------------------------------------------------------
// place_food -> 0 placed, 1 board full. picks random empty cells,
// then falls back to a linear scan so a nearly full board still
// gets its food.
// ---------------------------------------------------------------
place_food:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x19, x20, [sp, -16]!
        str     x21, [sp, -16]!

        mov     pn_r, 0
place_try:
        cmp     pn_r, 1000
        b.ge    place_scan
        add     pn_r, pn_r, 1
        mov     w0, GRID_W
        bl      rand_range
        mov     px_r, w0
        mov     w0, GRID_H
        bl      rand_range
        mov     py_r, w0
        mov     w0, px_r
        mov     w1, py_r
        bl      grid_addr
        ldrb    w2, [x0]
        cmp     w2, CELL_EMPTY
        b.ne    place_try
        b       place_put

place_scan:
        // random placement kept missing: walk every cell once
        mov     py_r, 0
place_scan_row:
        cmp     py_r, GRID_H
        b.ge    place_none
        mov     px_r, 0
place_scan_col:
        cmp     px_r, GRID_W
        b.ge    place_scan_next
        mov     w0, px_r
        mov     w1, py_r
        bl      grid_addr
        ldrb    w2, [x0]
        cmp     w2, CELL_EMPTY
        b.eq    place_put
        add     px_r, px_r, 1
        b       place_scan_col
place_scan_next:
        add     py_r, py_r, 1
        b       place_scan_row

place_none:
        mov     w0, 1
        b       place_out

place_put:
        // one food in GOLD_CHANCE is golden
        mov     w0, GOLD_CHANCE
        bl      rand_range
        cmp     w0, 0
        mov     w2, CELL_GOLD
        mov     w3, CELL_FOOD
        csel    w2, w2, w3, eq

        mov     w0, px_r
        mov     w1, py_r
        bl      grid_addr
        strb    w2, [x0]
        mov     w0, 0
place_out:
        ldr     x21, [sp], 16
        ldp     x19, x20, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// ---------------------------------------------------------------
// spawn_bonus: after a meal there is a small chance a shrink
// pickup appears. only one lives on the board at a time.
// ---------------------------------------------------------------
spawn_bonus:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x19, x20, [sp, -16]!
        str     x21, [sp, -16]!

        ldr     x1, =bonus_live
        ldr     w1, [x1]
        cbnz    w1, bonus_out

        mov     w0, BONUS_CHANCE
        bl      rand_range
        cbnz    w0, bonus_out

        mov     pn_r, 0
bonus_try:
        cmp     pn_r, 200
        b.ge    bonus_out
        add     pn_r, pn_r, 1
        mov     w0, GRID_W
        bl      rand_range
        mov     px_r, w0
        mov     w0, GRID_H
        bl      rand_range
        mov     py_r, w0
        mov     w0, px_r
        mov     w1, py_r
        bl      grid_addr
        ldrb    w2, [x0]
        cmp     w2, CELL_EMPTY
        b.ne    bonus_try

        mov     w2, CELL_SHRINK
        strb    w2, [x0]
        ldr     x1, =bonus_live
        mov     w2, 1
        str     w2, [x1]
bonus_out:
        ldr     x21, [sp], 16
        ldp     x19, x20, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// ---------------------------------------------------------------
// do_move -> STEP_OK / STEP_DIED / STEP_OVER. one move command;
// sprint mode advances two cells.
// ---------------------------------------------------------------
do_move:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        bl      step_once
        cbnz    w0, do_move_out

        ldr     x1, =game_mode
        ldr     w1, [x1]
        cmp     w1, MODE_SPRINT
        b.ne    do_move_ok
        bl      step_once
        b       do_move_out

do_move_ok:
        mov     w0, STEP_OK
do_move_out:
        ldp     fp, lr, [sp], 16
        ret

// ---------------------------------------------------------------
// step_once -> STEP_OK / STEP_DIED / STEP_OVER. advances the head
// one cell in the current direction and resolves whatever is
// there: wall, body, obstacle, food, or a shrink pickup.
// ---------------------------------------------------------------
step_once:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x19, x20, [sp, -16]!
        stp     x21, x22, [sp, -16]!

        // next head cell from the current heading
        ldr     x1, =head_idx
        ldr     w1, [x1]
        ldr     x2, =body_x
        ldrb    nx_r, [x2, w1, sxtw]
        ldr     x2, =body_y
        ldrb    ny_r, [x2, w1, sxtw]
        ldr     x2, =dir_x
        ldr     w2, [x2]
        add     nx_r, nx_r, w2
        ldr     x2, =dir_y
        ldr     w2, [x2]
        add     ny_r, ny_r, w2

        ldr     x1, =game_mode
        ldr     w1, [x1]
        cmp     w1, MODE_ENDLESS
        b.ne    step_walls

        // endless mode: coordinates wrap around each edge
        cmp     nx_r, 0
        mov     w2, GRID_W_M1
        csel    nx_r, w2, nx_r, lt
        cmp     nx_r, GRID_W
        mov     w2, 0
        csel    nx_r, w2, nx_r, ge
        cmp     ny_r, 0
        mov     w2, GRID_H_M1
        csel    ny_r, w2, ny_r, lt
        cmp     ny_r, GRID_H
        mov     w2, 0
        csel    ny_r, w2, ny_r, ge
        b       step_cell

step_walls:
        cmp     nx_r, 0
        b.lt    step_hit_wall
        cmp     nx_r, GRID_W
        b.ge    step_hit_wall
        cmp     ny_r, 0
        b.lt    step_hit_wall
        cmp     ny_r, GRID_H
        b.ge    step_hit_wall

step_cell:
        mov     w0, nx_r
        mov     w1, ny_r
        bl      grid_addr
        ldrb    cell_r, [x0]

        cmp     cell_r, CELL_FOOD
        b.eq    step_eat
        cmp     cell_r, CELL_GOLD
        b.eq    step_eat
        cmp     cell_r, CELL_SHRINK
        b.eq    step_shrink

        // ordinary move: free the tail cell first so the head may
        // follow directly behind it
        bl      pop_tail
        mov     w0, nx_r
        mov     w1, ny_r
        bl      grid_addr
        ldrb    cell_r, [x0]
        cmp     cell_r, CELL_SNAKE
        b.eq    step_hit_self
        cmp     cell_r, CELL_OBST
        b.eq    step_hit_obst

        mov     w0, nx_r
        mov     w1, ny_r
        bl      push_head
        mov     w0, STEP_OK
        b       step_out

step_eat:
        mov     pts_r, FOOD_PTS
        cmp     cell_r, CELL_GOLD
        mov     w2, GOLD_PTS
        csel    pts_r, w2, pts_r, eq
        ldr     x1, =score
        ldr     w2, [x1]
        add     w2, w2, pts_r
        str     w2, [x1]

        mov     w0, nx_r
        mov     w1, ny_r
        bl      push_head
        ldr     x1, =snake_len
        ldr     w2, [x1]
        add     w2, w2, 1
        str     w2, [x1]

        bl      place_food
        cbnz    w0, step_board_full
        bl      spawn_bonus
        mov     w0, STEP_OK
        b       step_out

step_shrink:
        mov     w0, nx_r
        mov     w1, ny_r
        bl      push_head
        bl      pop_tail

        ldr     x1, =bonus_live
        str     wzr, [x1]
        ldr     x0, =msg_shrink
        bl      puts

        // drop up to SHRINK_N extra tail segments, but never below
        // the starting length
        mov     nx_r, SHRINK_N
step_shrink_loop:
        cbz     nx_r, step_shrink_done
        ldr     x1, =snake_len
        ldr     w2, [x1]
        cmp     w2, START_LEN
        b.le    step_shrink_done
        bl      pop_tail
        ldr     x1, =snake_len
        ldr     w2, [x1]
        sub     w2, w2, 1
        str     w2, [x1]
        sub     nx_r, nx_r, 1
        b       step_shrink_loop
step_shrink_done:
        mov     w0, STEP_OK
        b       step_out

step_board_full:
        ldr     x0, =msg_full
        bl      puts
        mov     w0, STEP_OVER
        b       step_out

step_hit_wall:
        ldr     x0, =msg_wall
        b       step_die
step_hit_self:
        ldr     x0, =msg_self
        b       step_die
step_hit_obst:
        ldr     x0, =msg_obst

step_die:
        bl      puts
        ldr     x1, =lives
        ldr     w2, [x1]
        sub     w2, w2, 1
        str     w2, [x1]
        ldr     x0, =msg_lives
        mov     w1, w2
        bl      printf

        ldr     x1, =lives
        ldr     w2, [x1]
        cbz     w2, step_over
        bl      lay_board
        mov     w0, STEP_DIED
        b       step_out
step_over:
        mov     w0, STEP_OVER
step_out:
        ldp     x21, x22, [sp], 16
        ldp     x19, x20, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// ---------------------------------------------------------------
// push_head(x, y): advance the circular body buffer and mark the
// grid. leaf, so scratch registers are enough.
// ---------------------------------------------------------------
push_head:
        ldr     x9, =head_idx
        ldr     w10, [x9]
        add     w10, w10, 1
        cmp     w10, MAX_SNAKE
        mov     w11, 0
        csel    w10, w11, w10, ge
        str     w10, [x9]

        ldr     x11, =body_x
        strb    w0, [x11, w10, sxtw]
        ldr     x11, =body_y
        strb    w1, [x11, w10, sxtw]

        mov     w12, GRID_W
        madd    w12, w1, w12, w0
        ldr     x13, =grid
        sxtw    x12, w12
        add     x13, x13, x12
        mov     w14, CELL_SNAKE
        strb    w14, [x13]
        ret

// ---------------------------------------------------------------
// pop_tail: clear the tail cell from the grid and advance the tail
// index. leaf.
// ---------------------------------------------------------------
pop_tail:
        ldr     x9, =tail_idx
        ldr     w10, [x9]

        ldr     x11, =body_x
        ldrb    w12, [x11, w10, sxtw]
        ldr     x11, =body_y
        ldrb    w13, [x11, w10, sxtw]

        mov     w14, GRID_W
        madd    w14, w13, w14, w12
        ldr     x15, =grid
        sxtw    x14, w14
        add     x15, x15, x14
        strb    wzr, [x15]

        add     w10, w10, 1
        cmp     w10, MAX_SNAKE
        mov     w11, 0
        csel    w10, w11, w10, ge
        str     w10, [x9]
        ret

// ---------------------------------------------------------------
// grid_addr(x, y) -> address of grid[y][x]. leaf.
// ---------------------------------------------------------------
grid_addr:
        mov     w9, GRID_W
        madd    w9, w1, w9, w0
        ldr     x10, =grid
        sxtw    x9, w9
        add     x0, x10, x9
        ret

// ---------------------------------------------------------------
// rand_range(n) -> uniform-ish value in 0..n-1 built on rand().
// ---------------------------------------------------------------
rand_range:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        str     x19, [sp, -16]!

        mov     w19, w0
        bl      rand
        udiv    w1, w0, w19
        msub    w0, w1, w19, w0

        ldr     x19, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// ---------------------------------------------------------------
// draw_frame: one status line, then the bordered board. the head
// is drawn over its grid cell so it stands out from the body.
// ---------------------------------------------------------------
draw_frame:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x19, x20, [sp, -16]!
        stp     x21, x22, [sp, -16]!
        stp     x23, x24, [sp, -16]!

        ldr     x1, =score
        ldr     w1, [x1]
        ldr     x2, =snake_len
        ldr     w2, [x2]
        ldr     x3, =lives
        ldr     w3, [x3]
        bl      mode_name
        mov     x4, x0
        ldr     x5, =move_count
        ldr     w5, [x5]
        ldr     x0, =status_fmt
        bl      printf

        ldr     x0, =top_border
        bl      puts

        // current head position, for the @ overlay
        ldr     x1, =head_idx
        ldr     w1, [x1]
        ldr     x2, =body_x
        ldrb    hx_r, [x2, w1, sxtw]
        ldr     x2, =body_y
        ldrb    hy_r, [x2, w1, sxtw]

        ldr     gp_r, =grid
        ldr     rp_r, =row_buf

        mov     row_r, 0
draw_row_loop:
        cmp     row_r, GRID_H
        b.ge    draw_bottom

        mov     w2, CH_SPACE
        strb    w2, [rp_r]
        mov     w2, CH_PIPE
        strb    w2, [rp_r, 1]

        mov     col_r, 0
draw_col_loop:
        cmp     col_r, GRID_W
        b.ge    draw_row_done
        mov     w2, GRID_W
        madd    w2, row_r, w2, col_r
        ldrb    w2, [gp_r, w2, sxtw]
        ldr     x3, =glyphs
        ldrb    w2, [x3, w2, sxtw]
        add     w3, col_r, 2
        strb    w2, [rp_r, w3, sxtw]
        add     col_r, col_r, 1
        b       draw_col_loop

draw_row_done:
        // overlay the head glyph on its row
        cmp     row_r, hy_r
        b.ne    draw_row_close
        add     w2, hx_r, 2
        mov     w3, CH_AT
        strb    w3, [rp_r, w2, sxtw]

draw_row_close:
        mov     w2, ROW_EDGE
        mov     w3, CH_PIPE
        strb    w3, [rp_r, w2, sxtw]
        add     w2, w2, 1
        strb    wzr, [rp_r, w2, sxtw]

        mov     x0, rp_r
        bl      puts
        add     row_r, row_r, 1
        b       draw_row_loop

draw_bottom:
        ldr     x0, =top_border
        bl      puts

        ldp     x23, x24, [sp], 16
        ldp     x21, x22, [sp], 16
        ldp     x19, x20, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// ---------------------------------------------------------------
// mode_name -> pointer to the current mode's display name.
// ---------------------------------------------------------------
mode_name:
        ldr     x9, =game_mode
        ldr     w9, [x9]
        cmp     w9, MODE_ENDLESS
        b.eq    mode_name_endless
        cmp     w9, MODE_SPRINT
        b.eq    mode_name_sprint
        cmp     w9, MODE_MAZE
        b.eq    mode_name_maze
        ldr     x0, =name_classic
        ret
mode_name_endless:
        ldr     x0, =name_endless
        ret
mode_name_sprint:
        ldr     x0, =name_sprint
        ret
mode_name_maze:
        ldr     x0, =name_maze
        ret

// ---------------------------------------------------------------
// play_game -> PLAY_MENU or PLAY_QUIT. the input pump: reads one
// character at a time, so a whole line of moves plays out frame by
// frame once the console delivers it.
// ---------------------------------------------------------------
play_game:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x19, x20, [sp, -16]!
        stp     x21, x22, [sp, -16]!
        stp     x23, x24, [sp, -16]!

        mov     rpt_r, 0
        mov     hadmv_r, 0

pump_loop:
        bl      getchar
        mov     ch_r, w0
        tbnz    ch_r, 31, pump_gameover

        cmp     ch_r, CH_NL
        b.eq    pump_newline
        cmp     ch_r, CH_CR
        b.eq    pump_loop
        cmp     ch_r, CH_SPACE
        b.eq    pump_loop
        cmp     ch_r, CH_TAB
        b.eq    pump_loop
        cmp     ch_r, CH_LOW_Q
        b.eq    pump_gameover
        cmp     ch_r, CH_UP_Q
        b.eq    pump_gameover

        // digits build a repeat count for the next move
        cmp     ch_r, CH_ZERO
        b.lt    pump_letter
        cmp     ch_r, CH_NINE
        b.gt    pump_letter
        mov     w2, 10
        mul     rpt_r, rpt_r, w2
        sub     w2, ch_r, CH_ZERO
        add     rpt_r, rpt_r, w2
        cmp     rpt_r, 99
        mov     w2, 99
        csel    rpt_r, w2, rpt_r, gt
        b       pump_loop

pump_letter:
        orr     w2, ch_r, 32
        cmp     w2, CH_LOW_W
        b.eq    pump_up
        cmp     w2, CH_LOW_S
        b.eq    pump_down
        cmp     w2, CH_LOW_A
        b.eq    pump_left
        cmp     w2, CH_LOW_D
        b.eq    pump_right
        b       pump_loop

pump_up:
        mov     ndx_r, 0
        mov     ndy_r, -1
        b       pump_move
pump_down:
        mov     ndx_r, 0
        mov     ndy_r, 1
        b       pump_move
pump_left:
        mov     ndx_r, -1
        mov     ndy_r, 0
        b       pump_move
pump_right:
        mov     ndx_r, 1
        mov     ndy_r, 0

pump_move:
        // refuse a move straight back into the neck
        ldr     x1, =snake_len
        ldr     w1, [x1]
        cmp     w1, 1
        b.le    pump_set_dir
        ldr     x1, =dir_x
        ldr     w1, [x1]
        add     w1, w1, ndx_r
        cbnz    w1, pump_set_dir
        ldr     x1, =dir_y
        ldr     w1, [x1]
        add     w1, w1, ndy_r
        cbnz    w1, pump_set_dir
        ldr     x0, =msg_norev
        bl      puts
        mov     rpt_r, 0
        b       pump_loop

pump_set_dir:
        ldr     x1, =dir_x
        str     ndx_r, [x1]
        ldr     x1, =dir_y
        str     ndy_r, [x1]

        cmp     rpt_r, 0
        mov     w2, 1
        csel    times_r, w2, rpt_r, eq
        mov     rpt_r, 0
        mov     hadmv_r, 1

pump_move_loop:
        bl      do_move
        mov     w2, w0
        ldr     x1, =move_count
        ldr     w3, [x1]
        add     w3, w3, 1
        str     w3, [x1]
        mov     w19, w2
        bl      draw_frame
        cmp     w19, STEP_OVER
        b.eq    pump_gameover
        cmp     w19, STEP_DIED
        b.eq    pump_loop
        sub     times_r, times_r, 1
        cmp     times_r, 0
        b.gt    pump_move_loop
        b       pump_loop

pump_newline:
        cbnz    hadmv_r, pump_prompt
        // a blank line steps ahead once in the current direction
        bl      do_move
        mov     w19, w0
        ldr     x1, =move_count
        ldr     w3, [x1]
        add     w3, w3, 1
        str     w3, [x1]
        bl      draw_frame
        cmp     w19, STEP_OVER
        b.eq    pump_gameover
pump_prompt:
        mov     hadmv_r, 0
        mov     rpt_r, 0
        ldr     x0, =prompt_txt
        bl      puts
        b       pump_loop

pump_gameover:
        bl      game_over_screen
        cmp     w0, 1
        b.eq    pump_again
        cmp     w0, 2
        mov     w1, PLAY_MENU
        mov     w2, PLAY_QUIT
        csel    w0, w1, w2, eq
        b       pump_out

pump_again:
        ldr     x1, =game_mode
        ldr     w0, [x1]
        bl      init_game
        bl      draw_frame
        ldr     x0, =prompt_txt
        bl      puts
        mov     rpt_r, 0
        mov     hadmv_r, 0
        b       pump_loop

pump_out:
        ldp     x23, x24, [sp], 16
        ldp     x21, x22, [sp], 16
        ldp     x19, x20, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// ---------------------------------------------------------------
// game_over_screen -> 1 play again, 2 back to menu, 0 quit.
// reports the final score, records a new high score, and reads the
// player's next choice.
// ---------------------------------------------------------------
game_over_screen:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        str     x19, [sp, -16]!

        ldr     x0, =over_1
        bl      puts
        ldr     x0, =over_2
        bl      puts
        ldr     x0, =over_1
        bl      puts

        ldr     x1, =score
        ldr     w1, [x1]
        bl      mode_name
        mov     x2, x0
        ldr     x0, =over_fmt
        bl      printf

        // record keeping: one slot per mode
        ldr     x1, =game_mode
        ldr     w1, [x1]
        sub     w1, w1, 1
        ldr     x2, =high_scores
        ldr     x3, =score
        ldr     w3, [x3]
        ldr     w4, [x2, w1, sxtw 2]
        cmp     w3, w4
        b.le    over_asked
        str     w3, [x2, w1, sxtw 2]
        ldr     x0, =over_rec
        bl      puts
        bl      save_scores

over_asked:
        ldr     x0, =over_ask
        bl      puts

over_read:
        bl      getchar
        tbnz    w0, 31, over_quit
        orr     choice_r, w0, 32
        cmp     choice_r, CH_LOW_Y
        b.eq    over_again
        cmp     choice_r, CH_LOW_M
        b.eq    over_menu
        cmp     choice_r, CH_LOW_Q
        b.eq    over_quit
        b       over_read

over_again:
        bl      eat_line
        mov     w0, 1
        b       over_out
over_menu:
        bl      eat_line
        mov     w0, 2
        b       over_out
over_quit:
        mov     w0, 0
over_out:
        ldr     x19, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// ---------------------------------------------------------------
// load_scores: read scores.txt into the four high score slots.
// missing or malformed files simply leave zeros behind. the file
// work uses the raw linux calls: openat, read, close.
// ---------------------------------------------------------------
load_scores:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x19, x20, [sp, -16]!
        stp     x21, x22, [sp, -16]!

        mov     x0, AT_FDCWD
        ldr     x1, =score_path
        mov     x2, O_RDONLY
        mov     x3, 0
        mov     x8, SYS_OPENAT
        svc     0
        tbnz    w0, 31, load_out
        mov     fd_r, w0

        mov     w0, fd_r
        ldr     x1, =io_buf
        mov     x2, 159
        mov     x8, SYS_READ
        svc     0
        mov     sl_r, w0

        mov     w0, fd_r
        mov     x8, SYS_CLOSE
        svc     0

        tbnz    sl_r, 31, load_out
        ldr     bp_r, =io_buf
        sxtw    x1, sl_r
        add     x1, bp_r, x1
        strb    wzr, [x1]

        // four lines, each "name:value". scan to the colon, then
        // gather digits.
        mov     sl_r, 0
load_next:
        cmp     sl_r, 4
        b.ge    load_out
load_colon:
        ldrb    w2, [bp_r]
        cbz     w2, load_out
        add     bp_r, bp_r, 1
        cmp     w2, CH_COLON
        b.ne    load_colon

        mov     val_r, 0
load_digits:
        ldrb    w2, [bp_r]
        cmp     w2, CH_ZERO
        b.lt    load_store
        cmp     w2, CH_NINE
        b.gt    load_store
        mov     w3, 10
        mul     val_r, val_r, w3
        sub     w2, w2, CH_ZERO
        add     val_r, val_r, w2
        add     bp_r, bp_r, 1
        b       load_digits

load_store:
        ldr     x2, =high_scores
        str     val_r, [x2, w21, sxtw 2]
        add     sl_r, sl_r, 1
        b       load_next

load_out:
        ldp     x21, x22, [sp], 16
        ldp     x19, x20, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// ---------------------------------------------------------------
// save_scores: write the four slots back as "name:value" lines
// using openat, write, close.
// ---------------------------------------------------------------
save_scores:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        stp     x19, x20, [sp, -16]!

        ldr     x0, =io_buf

        ldr     x1, =lbl_classic
        bl      append_str
        ldr     x2, =high_scores
        ldr     w1, [x2]
        bl      append_num
        ldr     x1, =lbl_endless
        bl      append_str
        ldr     x2, =high_scores
        ldr     w1, [x2, 4]
        bl      append_num
        ldr     x1, =lbl_sprint
        bl      append_str
        ldr     x2, =high_scores
        ldr     w1, [x2, 8]
        bl      append_num
        ldr     x1, =lbl_maze
        bl      append_str
        ldr     x2, =high_scores
        ldr     w1, [x2, 12]
        bl      append_num
        mov     bp_r, x0

        mov     x0, AT_FDCWD
        ldr     x1, =score_path
        mov     x2, O_WRFLAGS
        mov     x3, FILE_MODE
        mov     x8, SYS_OPENAT
        svc     0
        tbnz    w0, 31, save_fail
        mov     fd_r, w0

        mov     w0, fd_r
        ldr     x1, =io_buf
        ldr     x2, =io_buf
        sub     x2, bp_r, x2
        mov     x8, SYS_WRITE
        svc     0

        mov     w0, fd_r
        mov     x8, SYS_CLOSE
        svc     0
        b       save_out

save_fail:
        ldr     x0, =save_warn
        bl      puts
save_out:
        ldp     x19, x20, [sp], 16
        ldp     fp, lr, [sp], 16
        ret

// ---------------------------------------------------------------
// eat_line: swallow input up to and including the next newline, so
// a menu choice does not leak its line ending into the move pump.
// ---------------------------------------------------------------
eat_line:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
eat_line_loop:
        bl      getchar
        tbnz    w0, 31, eat_line_done
        cmp     w0, CH_NL
        b.ne    eat_line_loop
eat_line_done:
        ldp     fp, lr, [sp], 16
        ret

// ---------------------------------------------------------------
// append_str(x0 = cursor, x1 = string) -> x0 past the last byte
// copied. leaf.
// ---------------------------------------------------------------
append_str:
append_str_loop:
        ldrb    w9, [x1]
        cbz     w9, append_str_done
        strb    w9, [x0]
        add     x0, x0, 1
        add     x1, x1, 1
        b       append_str_loop
append_str_done:
        ret

// ---------------------------------------------------------------
// append_num(x0 = cursor, w1 = value) -> x0 past the newline it
// writes after the decimal digits. leaf.
// ---------------------------------------------------------------
append_num:
        // digits come out backwards, so build them on a small
        // scratch area first
        ldr     x9, =row_buf
        mov     w10, 0
append_num_split:
        mov     w11, 10
        udiv    w12, w1, w11
        msub    w13, w12, w11, w1
        add     w13, w13, CH_ZERO
        strb    w13, [x9, w10, sxtw]
        add     w10, w10, 1
        mov     w1, w12
        cbnz    w1, append_num_split

append_num_flip:
        sub     w10, w10, 1
        ldrb    w11, [x9, w10, sxtw]
        strb    w11, [x0]
        add     x0, x0, 1
        cbnz    w10, append_num_flip

        mov     w11, 10
        strb    w11, [x0]
        add     x0, x0, 1
        ret
