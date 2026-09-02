// snake - the real-time arcade game, playable in the terminal pane
//
// The full project (build files, releases, history) lives at
//   https://github.com/Abdalla-Eldoumani/snake-game
//
// how to run: press assemble, then run. The game takes over the
// terminal pane and grabs the keyboard. Or run it the course way
// from the term tab:  ./program
//
// how to play: pick a mode with w/s or the arrow keys, enter to
// start, steer with wasd or the arrows, space pauses, q quits.
// Six modes, power-ups, combo streaks, three lives, and per-mode
// high scores saved to file.txt in the virtual filesystem. ctrl+c
// in the terminal stops the program at any point.


define(fp, x29)
define(lr, x30)

.text
.global _start

// System call numbers for ARMv8 Linux
SYS_READ = 63
SYS_WRITE = 64
SYS_EXIT = 93
SYS_NANOSLEEP = 101
SYS_IOCTL = 29
SYS_GETRANDOM = 278
SYS_FCNTL = 25
SYS_CLOCK_GETTIME = 113
SYS_OPENAT = 56
SYS_CLOSE = 57
AT_FDCWD = -100
CLOCK_MONOTONIC = 1

// File open flags  
O_RDONLY = 0
O_WRONLY = 1
O_CREAT = 64
O_TRUNC = 512

// Standard file descriptors
STDIN_FILENO = 0
STDOUT_FILENO = 1
STDERR_FILENO = 2

// Terminal control constants
TCGETS = 0x5401
TCSETS = 0x5402
ICANON = 0x0002
ECHO = 0x0008
F_GETFL = 3
F_SETFL = 4
O_NONBLOCK = 0x800

// Game constants
GRID_WIDTH = 30
GRID_HEIGHT = 20
MAX_SNAKE_LENGTH = 600
INITIAL_SNAKE_LENGTH = 3

// Level constants
LEVEL_NORMAL = 1
LEVEL_NO_WALLS = 2
LEVEL_SUPER_FAST = 3
LEVEL_OBSTACLES = 4
LEVEL_HYPER = 5
LEVEL_MINEFIELD = 6
LEVEL_QUIT = 7

// Score constants. The cap exists so the add and the file parse share
// one clamp; nine digits keeps every rendering column stable.
MAX_SCORE = 999999999

// Minefield pacing: one new mine this many seconds apart
MINE_INTERVAL_SEC = 5

// Direction constants
DIR_UP = 0
DIR_RIGHT = 1
DIR_DOWN = 2
DIR_LEFT = 3

// Cell types
CELL_EMPTY = 0
CELL_SNAKE = 1
CELL_FOOD = 2
CELL_WALL = 3
CELL_OBSTACLE = 4
CELL_POWERUP_SLOW = 5
CELL_POWERUP_SHRINK = 6

// Food types
FOOD_NORMAL = 0
FOOD_GOLDEN = 1
FOOD_SLOWMO = 2
FOOD_SHRINK = 3

// Power-up constants
NUM_OBSTACLES = 6
POWERUP_DURATION = 50
SHRINK_AMOUNT = 3
INITIAL_LIVES = 3
SLOWMO_SPEED = 400

// Combo streak: meals within COMBO_WINDOW seconds of each other
// multiply their points, up to COMBO_MAX
COMBO_WINDOW = 3
COMBO_MAX = 5

// Golden food goes back to normal after this many seconds
GOLD_LIFETIME = 7

// Maze mode grows a new obstacle every ESCALATE_EVERY meals, capped
// at NUM_OBSTACLES + MAX_EXTRA_OBSTACLES walls on the board
ESCALATE_EVERY = 5
MAX_EXTRA_OBSTACLES = 8

_start:
    // Set up stack frame
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    // Save original terminal settings
    bl      save_terminal_settings
    cmp     x0, 0
    b.ne    exit_error
    
    // Set raw mode
    bl      set_raw_mode
    cmp     x0, 0
    b.ne    restore_and_exit
    
    // Set non-blocking input
    bl      set_nonblocking_input
    cmp     x0, 0
    b.ne    restore_and_exit

    // Load high scores before showing menu
    bl      load_high_scores

    // Show welcome screen and get level selection
    bl      show_welcome_screen
    bl      get_level_selection
    
    // Initialize game with selected level
    bl      init_game
    
    // Clear screen and hide cursor
    bl      clear_screen
    bl      hide_cursor
    
    // Main game loop
game_loop:
    // Handle input
    bl      handle_input
    
    // Check if quit was pressed
    ldr     x0, =quit_flag
    ldr     w1, [x0]
    cmp     w1, 1
    b.eq    game_over
    
    // Check if game is paused
    ldr     x0, =game_paused
    ldr     w1, [x0]
    cmp     w1, 1
    b.eq    pause_loop
    
    // Move snake
    bl      move_snake
    
    // Check collisions
    bl      check_collisions
    cmp     x0, 0
    b.ne    game_over
    
    // Check food consumption
    bl      check_food_collision
    
    // Draw game
    bl      draw_game
    
    // Sleep
    bl      game_sleep
    
    // Continue loop
    b       game_loop

pause_loop:
    // Display pause message
    bl      draw_game
    bl      display_pause_message
    
    // Sleep briefly and continue checking input
    bl      game_sleep
    b       game_loop

game_over:
    // Show cursor and display game over
    bl      show_cursor
    bl      display_game_over
    
restore_and_exit:
    // Restore terminal settings
    bl      restore_terminal_settings
    
    // Normal exit
    mov     x0, 0
    b       exit_program
    
exit_error:
    mov     x0, 1
    
exit_program:
    mov     x8, SYS_EXIT
    svc     0

// Show welcome screen
show_welcome_screen:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    // Clear screen
    bl      clear_screen

    // Initialize animation position
    ldr     x0, =anim_snake_x
    mov     w1, -4
    str     w1, [x0]

    ldp     fp, lr, [sp], 16
    ret

// Draw one frame of animated logo (called from level selection loop)
draw_animated_logo_frame:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    stp     x19, x20, [sp, -16]!
    stp     x21, x22, [sp, -16]!

    // Get current snake position
    ldr     x0, =anim_snake_x
    ldr     w19, [x0]               // x19 = snake head X position

    // Move cursor home
    mov     x0, STDOUT_FILENO
    ldr     x1, =move_cursor_home
    mov     x2, move_cursor_home_len
    mov     x8, SYS_WRITE
    svc     0

    // Output 2 newlines for spacing at top
    mov     x0, STDOUT_FILENO
    ldr     x1, =anim_newline
    mov     x2, anim_newline_len
    mov     x8, SYS_WRITE
    svc     0
    mov     x0, STDOUT_FILENO
    ldr     x1, =anim_newline
    mov     x2, anim_newline_len
    mov     x8, SYS_WRITE
    svc     0

    // Draw each logo row with glow effect
    // Row 1
    ldr     x20, =logo_row_1
    mov     x21, logo_row_1_len
    bl      draw_logo_row_with_glow

    // Row 2
    ldr     x20, =logo_row_2
    mov     x21, logo_row_2_len
    bl      draw_logo_row_with_glow

    // Row 3
    ldr     x20, =logo_row_3
    mov     x21, logo_row_3_len
    bl      draw_logo_row_with_glow

    // Row 4
    ldr     x20, =logo_row_4
    mov     x21, logo_row_4_len
    bl      draw_logo_row_with_glow

    // Row 5
    ldr     x20, =logo_row_5
    mov     x21, logo_row_5_len
    bl      draw_logo_row_with_glow

    // Output subtitle
    mov     x0, STDOUT_FILENO
    ldr     x1, =logo_subtitle
    mov     x2, logo_subtitle_len
    mov     x8, SYS_WRITE
    svc     0

    // Advance snake position
    ldr     x0, =anim_snake_x
    ldr     w1, [x0]
    add     w1, w1, 1

    // Wrap around when reaching end
    cmp     w1, 56
    b.lt    anim_no_wrap
    mov     w1, -4                 // Reset to start
anim_no_wrap:
    str     w1, [x0]

    ldp     x21, x22, [sp], 16
    ldp     x19, x20, [sp], 16
    ldp     fp, lr, [sp], 16
    ret

// Draw a logo row with glow effect based on snake position
draw_logo_row_with_glow:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    stp     x23, x24, [sp, -16]!
    stp     x25, x26, [sp, -16]!

    mov     x23, x20                // x23 = current position in row
    mov     x24, x21                // x24 = remaining length
    mov     w25, 0                 // x25 = current column (character index)

    // Glow zone: snake_x - 2 to snake_x + 5
    sub     w26, w19, 2            // x26 = glow start

anim_row_loop:
    cbz     x24, anim_row_done

    // Get current byte
    ldrb    w0, [x23]

    // Check if this is a UTF-8 multi-byte character (█ is 3 bytes)
    cmp     w0, 0xE2               // UTF-8 block chars start with 0xE2
    b.eq    anim_handle_utf8

    // Single byte character (space or ASCII)
    // Check if current column is in glow zone
    cmp     w25, w26                // Compare with glow start
    b.lt    anim_output_green

    add     w1, w26, 8             // Glow end = glow start + 8
    cmp     w25, w1
    b.gt    anim_output_green

    // In glow zone - output white
    mov     x0, STDOUT_FILENO
    ldr     x1, =anim_color_white
    mov     x2, anim_color_white_len
    mov     x8, SYS_WRITE
    svc     0
    b       anim_output_char

anim_output_green:
    // Not in glow zone - output green
    mov     x0, STDOUT_FILENO
    ldr     x1, =anim_color_green
    mov     x2, anim_color_green_len
    mov     x8, SYS_WRITE
    svc     0

anim_output_char:
    // Output the character
    mov     x0, STDOUT_FILENO
    mov     x1, x23
    mov     x2, 1
    mov     x8, SYS_WRITE
    svc     0

    // Reset color
    mov     x0, STDOUT_FILENO
    ldr     x1, =anim_color_reset
    mov     x2, anim_color_reset_len
    mov     x8, SYS_WRITE
    svc     0

    add     x23, x23, 1
    sub     x24, x24, 1
    add     w25, w25, 1
    b       anim_row_loop

anim_handle_utf8:
    // Handle 3-byte UTF-8 character (█)
    // Check if current column is in glow zone
    cmp     w25, w26
    b.lt    anim_output_green_utf8

    add     w1, w26, 8
    cmp     w25, w1
    b.gt    anim_output_green_utf8

    // In glow zone - output white
    mov     x0, STDOUT_FILENO
    ldr     x1, =anim_color_white
    mov     x2, anim_color_white_len
    mov     x8, SYS_WRITE
    svc     0
    b       anim_output_utf8

anim_output_green_utf8:
    // Not in glow zone - output green
    mov     x0, STDOUT_FILENO
    ldr     x1, =anim_color_green
    mov     x2, anim_color_green_len
    mov     x8, SYS_WRITE
    svc     0

anim_output_utf8:
    // Output all 3 bytes of UTF-8 character
    mov     x0, STDOUT_FILENO
    mov     x1, x23
    mov     x2, 3
    mov     x8, SYS_WRITE
    svc     0

    // Reset color
    mov     x0, STDOUT_FILENO
    ldr     x1, =anim_color_reset
    mov     x2, anim_color_reset_len
    mov     x8, SYS_WRITE
    svc     0

    add     x23, x23, 3            // Advance 3 bytes
    sub     x24, x24, 3
    add     w25, w25, 1            // But only 1 character column
    b       anim_row_loop

anim_row_done:
    // Output newline
    mov     x0, STDOUT_FILENO
    ldr     x1, =anim_newline
    mov     x2, anim_newline_len
    mov     x8, SYS_WRITE
    svc     0

    ldp     x25, x26, [sp], 16
    ldp     x23, x24, [sp], 16
    ldp     fp, lr, [sp], 16
    ret

// Get level selection from user
get_level_selection:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // Initialize selected level to 1
    ldr     x0, =current_level
    mov     w1, LEVEL_NORMAL
    str     w1, [x0]

    // Clear confirmation flag
    ldr     x0, =quit_flag
    str     wzr, [x0]

    // Clear any buffered input
    bl      clear_input_buffer

level_selection_loop:
    // Draw animated logo frame (advances animation position)
    bl      draw_animated_logo_frame

    // Display level options with current selection indicator
    bl      display_level_options

    // Try to read input (non-blocking)
    mov     x0, STDIN_FILENO
    ldr     x1, =input_buffer
    mov     x2, 1
    mov     x8, SYS_READ
    svc     0

    // Check if we got input
    cmp     x0, 1
    b.ne    level_selection_sleep

    // Got input - process it
    ldr     x0, =input_buffer
    ldrb    w0, [x0]

    // Check for confirmation (ENTER)
    cmp     w0, 10
    b.eq    level_confirm_selection
    cmp     w0, 13
    b.eq    level_confirm_selection

    // Check for up/down movement
    cmp     w0, 'w'
    b.eq    level_move_up
    cmp     w0, 'W'
    b.eq    level_move_up
    cmp     w0, 's'
    b.eq    level_move_down
    cmp     w0, 'S'
    b.eq    level_move_down

    // Check for quick quit (Q key)
    cmp     w0, 'q'
    b.eq    level_quick_quit
    cmp     w0, 'Q'
    b.eq    level_quick_quit

    // Check for escape sequence (arrow keys)
    cmp     w0, 0x1b
    b.eq    level_handle_arrows

    b       level_selection_sleep

level_move_up:
    ldr     x0, =current_level
    ldr     w1, [x0]
    cmp     w1, LEVEL_NORMAL
    b.eq    level_wrap_to_quit
    sub     w1, w1, 1
    str     w1, [x0]
    b       level_selection_sleep

level_wrap_to_quit:
    ldr     x0, =current_level
    mov     w1, LEVEL_QUIT
    str     w1, [x0]
    b       level_selection_sleep

level_move_down:
    ldr     x0, =current_level
    ldr     w1, [x0]
    cmp     w1, LEVEL_QUIT
    b.eq    level_wrap_to_normal
    add     w1, w1, 1
    str     w1, [x0]
    b       level_selection_sleep

level_wrap_to_normal:
    ldr     x0, =current_level
    mov     w1, LEVEL_NORMAL
    str     w1, [x0]
    b       level_selection_sleep

level_handle_arrows:
    // Read next two bytes for arrow key sequence
    mov     x0, STDIN_FILENO
    ldr     x1, =input_buffer
    mov     x2, 1
    mov     x8, SYS_READ
    svc     0
    cmp     x0, 1
    b.ne    level_selection_sleep

    mov     x0, STDIN_FILENO
    ldr     x1, =input_buffer
    mov     x2, 1
    mov     x8, SYS_READ
    svc     0
    cmp     x0, 1
    b.ne    level_selection_sleep

    ldr     x0, =input_buffer
    ldrb    w0, [x0]

    cmp     w0, 'A'                // Up arrow
    b.eq    level_move_up
    cmp     w0, 'B'                // Down arrow
    b.eq    level_move_down

    b       level_selection_sleep

level_quick_quit:
    ldr     x0, =current_level
    mov     w1, LEVEL_QUIT
    str     w1, [x0]
    // Fall through to confirm

level_confirm_selection:
    // Check if quit was selected
    ldr     x0, =current_level
    ldr     w1, [x0]
    cmp     w1, LEVEL_QUIT
    b.eq    menu_quit_selected

    // Selection confirmed - exit loop
    ldp     fp, lr, [sp], 16
    ret

level_selection_sleep:
    // Sleep for 60ms (animation frame rate)
    ldr     x0, =anim_sleep_time
    mov     x1, 0
    mov     x8, SYS_NANOSLEEP
    svc     0

    b       level_selection_loop

menu_quit_selected:
    // Restore terminal and exit cleanly
    bl      restore_terminal_settings
    bl      show_cursor
    mov     x0, 0
    mov     x8, SYS_EXIT
    svc     0

// Display level options with selection indicator
display_level_options:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // Position cursor at menu start
    mov     x0, STDOUT_FILENO
    ldr     x1, =cursor_to_menu
    mov     x2, cursor_to_menu_len
    mov     x8, SYS_WRITE
    svc     0

    // Display level selection header
    mov     x0, STDOUT_FILENO
    ldr     x1, =level_select_text
    mov     x2, level_select_text_len
    mov     x8, SYS_WRITE
    svc     0

    // Get current level
    ldr     x0, =current_level
    ldr     w19, [x0]

    // Display Level 1
    cmp     w19, LEVEL_NORMAL
    b.ne    display_level_1_normal
    
    // Show indicator for Level 1
    mov     x0, STDOUT_FILENO
    ldr     x1, =level_indicator
    mov     x2, level_indicator_len
    mov     x8, SYS_WRITE
    svc     0
    b       display_level_1_text

display_level_1_normal:
    mov     x0, STDOUT_FILENO
    ldr     x1, =no_indicator
    mov     x2, no_indicator_len
    mov     x8, SYS_WRITE
    svc     0

display_level_1_text:
    mov     x0, STDOUT_FILENO
    ldr     x1, =level_1_text
    mov     x2, level_1_text_len
    mov     x8, SYS_WRITE
    svc     0
    
    // Display Level 2
    cmp     w19, LEVEL_NO_WALLS
    b.ne    display_level_2_normal
    
    mov     x0, STDOUT_FILENO
    ldr     x1, =level_indicator
    mov     x2, level_indicator_len
    mov     x8, SYS_WRITE
    svc     0
    b       display_level_2_text

display_level_2_normal:
    mov     x0, STDOUT_FILENO
    ldr     x1, =no_indicator
    mov     x2, no_indicator_len
    mov     x8, SYS_WRITE
    svc     0

display_level_2_text:
    mov     x0, STDOUT_FILENO
    ldr     x1, =level_2_text
    mov     x2, level_2_text_len
    mov     x8, SYS_WRITE
    svc     0
    
    // Display Level 3
    cmp     w19, LEVEL_SUPER_FAST
    b.ne    display_level_3_normal
    
    mov     x0, STDOUT_FILENO
    ldr     x1, =level_indicator
    mov     x2, level_indicator_len
    mov     x8, SYS_WRITE
    svc     0
    b       display_level_3_text

display_level_3_normal:
    mov     x0, STDOUT_FILENO
    ldr     x1, =no_indicator
    mov     x2, no_indicator_len
    mov     x8, SYS_WRITE
    svc     0

display_level_3_text:
    mov     x0, STDOUT_FILENO
    ldr     x1, =level_3_text
    mov     x2, level_3_text_len
    mov     x8, SYS_WRITE
    svc     0

    // Display Level 4
    cmp     w19, LEVEL_OBSTACLES
    b.ne    display_level_4_normal

    mov     x0, STDOUT_FILENO
    ldr     x1, =level_indicator
    mov     x2, level_indicator_len
    mov     x8, SYS_WRITE
    svc     0
    b       display_level_4_text

display_level_4_normal:
    mov     x0, STDOUT_FILENO
    ldr     x1, =no_indicator
    mov     x2, no_indicator_len
    mov     x8, SYS_WRITE
    svc     0

display_level_4_text:
    mov     x0, STDOUT_FILENO
    ldr     x1, =level_4_text
    mov     x2, level_4_text_len
    mov     x8, SYS_WRITE
    svc     0

    // Display Level 5
    cmp     w19, LEVEL_HYPER
    b.ne    display_level_5_normal

    mov     x0, STDOUT_FILENO
    ldr     x1, =level_indicator
    mov     x2, level_indicator_len
    mov     x8, SYS_WRITE
    svc     0
    b       display_level_5_text

display_level_5_normal:
    mov     x0, STDOUT_FILENO
    ldr     x1, =no_indicator
    mov     x2, no_indicator_len
    mov     x8, SYS_WRITE
    svc     0

display_level_5_text:
    mov     x0, STDOUT_FILENO
    ldr     x1, =level_5_text
    mov     x2, level_5_text_len
    mov     x8, SYS_WRITE
    svc     0

    // Display Level 6
    cmp     w19, LEVEL_MINEFIELD
    b.ne    display_level_6_normal

    mov     x0, STDOUT_FILENO
    ldr     x1, =level_indicator
    mov     x2, level_indicator_len
    mov     x8, SYS_WRITE
    svc     0
    b       display_level_6_text

display_level_6_normal:
    mov     x0, STDOUT_FILENO
    ldr     x1, =no_indicator
    mov     x2, no_indicator_len
    mov     x8, SYS_WRITE
    svc     0

display_level_6_text:
    mov     x0, STDOUT_FILENO
    ldr     x1, =level_6_text
    mov     x2, level_6_text_len
    mov     x8, SYS_WRITE
    svc     0

    // Display Quit option
    cmp     w19, LEVEL_QUIT
    b.ne    display_quit_normal

    mov     x0, STDOUT_FILENO
    ldr     x1, =level_indicator
    mov     x2, level_indicator_len
    mov     x8, SYS_WRITE
    svc     0
    b       display_quit_text

display_quit_normal:
    mov     x0, STDOUT_FILENO
    ldr     x1, =no_indicator
    mov     x2, no_indicator_len
    mov     x8, SYS_WRITE
    svc     0

display_quit_text:
    mov     x0, STDOUT_FILENO
    ldr     x1, =quit_option_text
    mov     x2, quit_option_text_len
    mov     x8, SYS_WRITE
    svc     0

    // Display high scores section
    mov     x0, STDOUT_FILENO
    ldr     x1, =high_score_label
    mov     x2, high_score_label_len
    mov     x8, SYS_WRITE
    svc     0

    // Classic high score
    mov     x0, STDOUT_FILENO
    ldr     x1, =hs_classic_label
    mov     x2, hs_classic_label_len
    mov     x8, SYS_WRITE
    svc     0

    ldr     x0, =high_score_level1
    ldr     w0, [x0]
    ldr     x1, =score_buffer
    bl      int_to_string
    mov     x2, x0
    mov     x0, STDOUT_FILENO
    ldr     x1, =score_buffer
    mov     x8, SYS_WRITE
    svc     0

    // Endless high score
    mov     x0, STDOUT_FILENO
    ldr     x1, =hs_endless_label
    mov     x2, hs_endless_label_len
    mov     x8, SYS_WRITE
    svc     0

    ldr     x0, =high_score_level2
    ldr     w0, [x0]
    ldr     x1, =score_buffer
    bl      int_to_string
    mov     x2, x0
    mov     x0, STDOUT_FILENO
    ldr     x1, =score_buffer
    mov     x8, SYS_WRITE
    svc     0

    // Speed high score
    mov     x0, STDOUT_FILENO
    ldr     x1, =hs_speed_label
    mov     x2, hs_speed_label_len
    mov     x8, SYS_WRITE
    svc     0

    ldr     x0, =high_score_level3
    ldr     w0, [x0]
    ldr     x1, =score_buffer
    bl      int_to_string
    mov     x2, x0
    mov     x0, STDOUT_FILENO
    ldr     x1, =score_buffer
    mov     x8, SYS_WRITE
    svc     0

    // Maze high score
    mov     x0, STDOUT_FILENO
    ldr     x1, =hs_maze_label
    mov     x2, hs_maze_label_len
    mov     x8, SYS_WRITE
    svc     0

    ldr     x0, =high_score_level4
    ldr     w0, [x0]
    ldr     x1, =score_buffer
    bl      int_to_string
    mov     x2, x0
    mov     x0, STDOUT_FILENO
    ldr     x1, =score_buffer
    mov     x8, SYS_WRITE
    svc     0

    // Hyper high score
    mov     x0, STDOUT_FILENO
    ldr     x1, =hs_hyper_label
    mov     x2, hs_hyper_label_len
    mov     x8, SYS_WRITE
    svc     0

    ldr     x0, =high_score_level5
    ldr     w0, [x0]
    ldr     x1, =score_buffer
    bl      int_to_string
    mov     x2, x0
    mov     x0, STDOUT_FILENO
    ldr     x1, =score_buffer
    mov     x8, SYS_WRITE
    svc     0

    // Mines high score
    mov     x0, STDOUT_FILENO
    ldr     x1, =hs_mines_label
    mov     x2, hs_mines_label_len
    mov     x8, SYS_WRITE
    svc     0

    ldr     x0, =high_score_level6
    ldr     w0, [x0]
    ldr     x1, =score_buffer
    bl      int_to_string
    mov     x2, x0
    mov     x0, STDOUT_FILENO
    ldr     x1, =score_buffer
    mov     x8, SYS_WRITE
    svc     0

    // Divider after scores
    mov     x0, STDOUT_FILENO
    ldr     x1, =hs_divider
    mov     x2, hs_divider_len
    mov     x8, SYS_WRITE
    svc     0

    // Display prompt
    mov     x0, STDOUT_FILENO
    ldr     x1, =level_select_prompt
    mov     x2, level_select_prompt_len
    mov     x8, SYS_WRITE
    svc     0

    ldp     fp, lr, [sp], 16
    ret

// Clear input buffer
clear_input_buffer:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
clear_buffer_loop:
    mov     x0, STDIN_FILENO
    ldr     x1, =input_buffer
    mov     x2, 1
    mov     x8, SYS_READ
    svc     0
    
    cmp     x0, 1
    b.eq    clear_buffer_loop
    
    ldp     fp, lr, [sp], 16
    ret

// Save original terminal settings
save_terminal_settings:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    mov     x0, STDIN_FILENO
    mov     x1, TCGETS
    ldr     x2, =termios_orig
    mov     x8, SYS_IOCTL
    svc     0
    
    ldp     fp, lr, [sp], 16
    ret

// Set terminal to raw mode
set_raw_mode:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    // Copy original settings to raw settings
    ldr     x0, =termios_orig
    ldr     x1, =termios_raw
    mov     x2, 60
    bl      memcpy
    
    // Modify c_lflag: disable ICANON and ECHO
    ldr     x0, =termios_raw
    ldr     w1, [x0, 12]
    mov     w2, ICANON
    orr     w2, w2, ECHO
    bic     w1, w1, w2
    str     w1, [x0, 12]
    
    // Set VMIN=1, VTIME=0
    mov     w1, 1
    strb    w1, [x0, 17]
    mov     w1, 0
    strb    w1, [x0, 18]
    
    // Apply settings
    mov     x0, STDIN_FILENO
    mov     x1, TCSETS
    ldr     x2, =termios_raw
    mov     x8, SYS_IOCTL
    svc     0
    
    ldp     fp, lr, [sp], 16
    ret

// Set non-blocking input
set_nonblocking_input:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    // Get current flags
    mov     x0, STDIN_FILENO
    mov     x1, F_GETFL
    mov     x8, SYS_FCNTL
    svc     0
    
    // Add O_NONBLOCK flag
    orr     x2, x0, O_NONBLOCK
    mov     x0, STDIN_FILENO
    mov     x1, F_SETFL
    mov     x8, SYS_FCNTL
    svc     0
    
    ldp     fp, lr, [sp], 16
    ret

// Restore terminal settings
restore_terminal_settings:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    mov     x0, STDIN_FILENO
    mov     x1, TCSETS
    ldr     x2, =termios_orig
    mov     x8, SYS_IOCTL
    svc     0
    
    ldp     fp, lr, [sp], 16
    ret

// Memory copy function
memcpy:
    cbz     x2, memcpy_done
memcpy_loop:
    ldrb    w3, [x0], 1
    strb    w3, [x1], 1
    subs    x2, x2, 1
    b.ne    memcpy_loop
memcpy_done:
    ret

// Initialize game state
init_game:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    // Initialize grid (all empty)
    ldr     x0, =game_grid
    mov     x1, CELL_EMPTY
    mov     x2, (GRID_WIDTH * GRID_HEIGHT)
    bl      memset
    
    // Initialize snake at center
    ldr     x0, =snake_length
    mov     w1, INITIAL_SNAKE_LENGTH
    str     w1, [x0]
    
    ldr     x0, =snake_head_index
    mov     w1, 0
    str     w1, [x0]
    
    ldr     x0, =snake_direction
    mov     w1, DIR_RIGHT
    str     w1, [x0]
    
    // Place initial snake segments
    mov     x0, (GRID_WIDTH / 2)
    mov     x1, (GRID_HEIGHT / 2)
    
    // Head
    ldr     x2, =snake_body
    str     w0, [x2]
    str     w1, [x2, 4]
    
    // Body segments
    sub     w0, w0, 1
    str     w0, [x2, 8]
    str     w1, [x2, 12]
    
    sub     w0, w0, 1
    str     w0, [x2, 16]
    str     w1, [x2, 20]
    
    // Initialize score
    ldr     x0, =score
    mov     w1, 0
    str     w1, [x0]
    
    // Initialize food count
    ldr     x0, =food_count
    mov     w1, 0
    str     w1, [x0]
    
    // Initialize pause state
    ldr     x0, =game_paused
    mov     w1, 0
    str     w1, [x0]

    // Initialize lives
    ldr     x0, =lives_remaining
    mov     w1, INITIAL_LIVES
    str     w1, [x0]

    // Initialize power-up state
    ldr     x0, =powerup_spawned
    str     wzr, [x0]
    ldr     x0, =powerup_active
    str     wzr, [x0]
    ldr     x0, =powerup_timer
    str     wzr, [x0]

    // Initialize restart flag
    ldr     x0, =restart_requested
    str     wzr, [x0]

    // Fresh run: reset the streak, the per-run records, the gold
    // timer, and the obstacle census
    ldr     x0, =combo_mult
    mov     w1, 1
    str     w1, [x0]
    ldr     x0, =best_combo
    str     w1, [x0]
    ldr     x0, =last_eat_sec
    mov     w1, -100
    str     w1, [x0]
    ldr     x0, =max_length
    mov     w1, INITIAL_SNAKE_LENGTH
    str     w1, [x0]
    ldr     x0, =gold_deadline
    str     wzr, [x0]
    ldr     x0, =obstacle_count
    str     wzr, [x0]
    ldr     x0, =next_mine_sec
    mov     w1, MINE_INTERVAL_SEC
    str     w1, [x0]

    // Record game start time
    bl      get_current_time
    ldr     x0, =game_start_time
    ldr     x1, =current_time
    ldp     x2, x3, [x1]
    stp     x2, x3, [x0]
    
    // Initialize total paused time
    ldr     x0, =total_paused_time
    mov     w1, 0
    str     w1, [x0]
    
    // Load high scores
    bl      load_high_scores
    
    // Place first food
    bl      place_food

    // Initialize obstacles for Level 4
    ldr     x0, =current_level
    ldr     w0, [x0]
    cmp     w0, LEVEL_OBSTACLES
    b.ne    skip_obstacle_init
    bl      init_obstacles
skip_obstacle_init:
    // Initialize grid with snake and food
    bl      update_grid
    
    // Initialize quit flag
    ldr     x0, =quit_flag
    mov     w1, 0
    str     w1, [x0]
    
    ldp     fp, lr, [sp], 16
    ret

// Memory set function
memset:
    cbz     x2, memset_done
memset_loop:
    strb    w1, [x0], 1
    subs    x2, x2, 1
    b.ne    memset_loop
memset_done:
    ret

// Initialize obstacles for Level 4
init_obstacles:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x19, =obstacle_positions
    mov     w20, 0  // Obstacle counter

init_obstacle_loop:
    cmp     w20, NUM_OBSTACLES
    b.ge    init_obstacles_done

    // Generate random position
init_obstacle_retry:
    ldr     x0, =random_buffer
    mov     x1, 2
    mov     x2, 0
    mov     x8, SYS_GETRANDOM
    svc     0

    ldr     x0, =random_buffer
    ldrb    w1, [x0]
    mov     w2, GRID_WIDTH
    udiv    w3, w1, w2
    mul     w3, w3, w2
    sub     w21, w1, w3  // x = w21

    ldrb    w1, [x0, 1]
    mov     w2, GRID_HEIGHT
    udiv    w3, w1, w2
    mul     w3, w3, w2
    sub     w22, w1, w3  // y = w22

    // Avoid center area (snake starting position) - 5x5 area
    mov     w0, (GRID_WIDTH / 2)
    sub     w1, w0, 3
    add     w2, w0, 3
    cmp     w21, w1
    b.lt    position_ok
    cmp     w21, w2
    b.gt    position_ok

    mov     w0, (GRID_HEIGHT / 2)
    sub     w1, w0, 3
    add     w2, w0, 3
    cmp     w22, w1
    b.lt    position_ok
    cmp     w22, w2
    b.gt    position_ok

    // Too close to center, retry
    b       init_obstacle_retry

position_ok:
    // Store obstacle position
    mov     w0, 8
    mul     w0, w20, w0
    add     x0, x19, x0
    str     w21, [x0]
    str     w22, [x0, 4]

    add     w20, w20, 1
    b       init_obstacle_loop

init_obstacles_done:
    ldr     x0, =obstacle_count
    mov     w1, NUM_OBSTACLES
    str     w1, [x0]

    ldp     fp, lr, [sp], 16
    ret

// Add one obstacle at a random empty cell, away from the snake's
// head, for the maze escalation. Gives up quietly at the array's
// capacity or after too many placement attempts on a crowded board.
add_obstacle:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =obstacle_count
    ldr     w1, [x0]
    cmp     w1, (NUM_OBSTACLES + MAX_EXTRA_OBSTACLES)
    b.ge    add_obstacle_done

    mov     w9, 0

add_obstacle_retry:
    add     w9, w9, 1
    cmp     w9, 200
    b.gt    add_obstacle_done

    ldr     x0, =random_buffer
    mov     x1, 2
    mov     x2, 0
    mov     x8, SYS_GETRANDOM
    svc     0

    ldr     x0, =random_buffer
    ldrb    w1, [x0]
    mov     w2, GRID_WIDTH
    udiv    w3, w1, w2
    msub    w10, w3, w2, w1

    ldrb    w1, [x0, 1]
    mov     w2, GRID_HEIGHT
    udiv    w3, w1, w2
    msub    w11, w3, w2, w1

    // Never wall off the cell the player is about to enter: keep a
    // small buffer around the head
    ldr     x0, =snake_head_index
    ldr     w1, [x0]
    mov     w2, 8
    mul     w1, w1, w2
    ldr     x0, =snake_body
    add     x0, x0, x1
    ldr     w5, [x0]
    ldr     w6, [x0, 4]

    subs    w5, w10, w5
    neg     w7, w5
    cmp     w5, 0
    csel    w5, w7, w5, lt
    subs    w6, w11, w6
    neg     w7, w6
    cmp     w6, 0
    csel    w6, w7, w6, lt
    add     w5, w5, w6
    cmp     w5, 3
    b.le    add_obstacle_retry

    // Only claim a cell that is empty right now
    mov     w2, GRID_WIDTH
    mul     w3, w11, w2
    add     w3, w3, w10
    ldr     x0, =game_grid
    ldrb    w4, [x0, x3]
    cbnz    w4, add_obstacle_retry

    // Append to the list and mark the grid
    ldr     x0, =obstacle_count
    ldr     w1, [x0]
    mov     w2, 8
    mul     w2, w1, w2
    ldr     x3, =obstacle_positions
    add     x3, x3, x2
    str     w10, [x3]
    str     w11, [x3, 4]
    add     w1, w1, 1
    str     w1, [x0]

    mov     w2, GRID_WIDTH
    mul     w3, w11, w2
    add     w3, w3, w10
    ldr     x0, =game_grid
    mov     w4, CELL_OBSTACLE
    strb    w4, [x0, x3]

add_obstacle_done:
    ldp     fp, lr, [sp], 16
    ret


// Handle keyboard input
handle_input:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    // Try to read input
    mov     x0, STDIN_FILENO
    ldr     x1, =input_buffer
    mov     x2, 1
    mov     x8, SYS_READ
    svc     0
    
    // Check if we got input
    cmp     x0, 1
    b.ne    handle_input_done
    
    // Get the character
    ldr     x0, =input_buffer
    ldrb    w0, [x0]
    
    // Check for quit
    cmp     w0, 'q'
    b.eq    set_quit_flag
    cmp     w0, 'Q'
    b.eq    set_quit_flag
    
    // Check for direction keys
    cmp     w0, 'w'
    b.eq    set_direction_up
    cmp     w0, 'W'
    b.eq    set_direction_up
    cmp     w0, 's'
    b.eq    set_direction_down
    cmp     w0, 'S'
    b.eq    set_direction_down
    cmp     w0, 'a'
    b.eq    set_direction_left
    cmp     w0, 'A'
    b.eq    set_direction_left
    cmp     w0, 'd'
    b.eq    set_direction_right
    cmp     w0, 'D'
    b.eq    set_direction_right
    
    // Check for pause (space key)
    cmp     w0, ' '
    b.eq    toggle_pause
    
    // Check for escape sequence (arrow keys)
    cmp     w0, 0x1b
    b.eq    handle_arrow_keys
    
    b       handle_input_done
    
set_quit_flag:
    ldr     x0, =quit_flag
    mov     w1, 1
    str     w1, [x0]
    b       handle_input_done

set_direction_up:
    ldr     x0, =snake_direction
    ldr     w1, [x0]
    cmp     w1, DIR_DOWN
    b.eq    handle_input_done
    mov     w1, DIR_UP
    str     w1, [x0]
    b       handle_input_done

set_direction_down:
    ldr     x0, =snake_direction
    ldr     w1, [x0]
    cmp     w1, DIR_UP
    b.eq    handle_input_done
    mov     w1, DIR_DOWN
    str     w1, [x0]
    b       handle_input_done

set_direction_left:
    ldr     x0, =snake_direction
    ldr     w1, [x0]
    cmp     w1, DIR_RIGHT
    b.eq    handle_input_done
    mov     w1, DIR_LEFT
    str     w1, [x0]
    b       handle_input_done

set_direction_right:
    ldr     x0, =snake_direction
    ldr     w1, [x0]
    cmp     w1, DIR_LEFT
    b.eq    handle_input_done
    mov     w1, DIR_RIGHT
    str     w1, [x0]
    b       handle_input_done

handle_arrow_keys:
    // Read next two characters of escape sequence
    mov     x0, STDIN_FILENO
    ldr     x1, =input_buffer
    mov     x2, 2
    mov     x8, SYS_READ
    svc     0
    
    cmp     x0, 2
    b.ne    handle_input_done
    
    ldr     x0, =input_buffer
    ldrb    w1, [x0]
    cmp     w1, '['
    b.ne    handle_input_done
    
    ldrb    w1, [x0, 1]
    cmp     w1, 'A'
    b.eq    set_direction_up
    cmp     w1, 'B'
    b.eq    set_direction_down
    cmp     w1, 'C'
    b.eq    set_direction_right
    cmp     w1, 'D'
    b.eq    set_direction_left

toggle_pause:
    ldr     x0, =game_paused
    ldr     w1, [x0]
    
    // Check if we're currently paused (about to unpause)
    cmp     w1, 1
    b.eq    unpause_game
    
    // Currently unpaused, about to pause - record pause start time
    bl      get_current_time
    ldr     x0, =pause_start_time
    ldr     x1, =current_time
    ldp     x2, x3, [x1]
    stp     x2, x3, [x0]
    
    // Set paused state
    ldr     x0, =game_paused
    mov     w1, 1
    str     w1, [x0]
    b       handle_input_done
    
unpause_game:
    // Currently paused, about to unpause - calculate paused time
    bl      get_current_time
    ldr     x0, =current_time
    ldr     x1, =pause_start_time
    ldr     x2, [x0]
    ldr     x3, [x1]
    sub     x2, x2, x3
    
    // Add to total paused time
    ldr     x0, =total_paused_time
    ldr     w1, [x0]
    add     w1, w1, w2
    str     w1, [x0]
    
    // Set unpaused state
    ldr     x0, =game_paused
    mov     w1, 0
    str     w1, [x0]
    
    // Clear screen and redraw for clean resume
    bl      clear_screen
    bl      draw_game

handle_input_done:
    ldp     fp, lr, [sp], 16
    ret

// Move snake
move_snake:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    // Get current head position
    ldr     x0, =snake_head_index
    ldr     w0, [x0]
    ldr     x1, =snake_body
    mov     w2, 8
    mul     w0, w0, w2
    add     x1, x1, x0
    
    ldr     w2, [x1]
    ldr     w3, [x1, 4]
    
    // Calculate new head position based on direction
    ldr     x0, =snake_direction
    ldr     w0, [x0]
    
    cmp     w0, DIR_UP
    b.eq    move_up
    cmp     w0, DIR_DOWN
    b.eq    move_down
    cmp     w0, DIR_LEFT
    b.eq    move_left
    cmp     w0, DIR_RIGHT
    b.eq    move_right
    b       move_snake_done

move_up:
    sub     w3, w3, 1
    b       update_head

move_down:
    add     w3, w3, 1
    b       update_head

move_left:
    sub     w2, w2, 1
    b       update_head

move_right:
    add     w2, w2, 1

update_head:
    // Calculate new head index (circular buffer)
    ldr     x0, =snake_head_index
    ldr     w1, [x0]
    add     w4, w1, 1
    cmp     w4, MAX_SNAKE_LENGTH
    csel    w4, wzr, w4, eq
    str     w4, [x0]
    
    // Store new head position
    ldr     x0, =snake_body
    mov     w5, 8
    mul     x6, x4, x5
    add     x0, x0, x6
    str     w2, [x0]
    str     w3, [x0, 4]
    
move_snake_done:
    ldp     fp, lr, [sp], 16
    ret

// Check collisions with walls and self
check_collisions:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    // Get head position
    ldr     x0, =snake_head_index
    ldr     w0, [x0]
    ldr     x1, =snake_body
    mov     w2, 8
    mul     w0, w0, w2
    add     x1, x1, x0
    
    ldr     w2, [x1]
    ldr     w3, [x1, 4]
    
    // Check current level for wall collision behavior. Endless and
    // minefield both wrap; every other mode treats the edge as a wall.
    ldr     x0, =current_level
    ldr     w4, [x0]
    cmp     w4, LEVEL_NO_WALLS
    b.eq    handle_wall_wrapping
    cmp     w4, LEVEL_MINEFIELD
    b.eq    handle_wall_wrapping
    
    // Normal wall collision detection (Level 1 and 3)
    cmp     w2, 0
    b.lt    collision_detected
    cmp     w2, (GRID_WIDTH - 1)
    b.gt    collision_detected
    cmp     w3, 0
    b.lt    collision_detected
    cmp     w3, (GRID_HEIGHT - 1)
    b.gt    collision_detected
    b       check_self_collision

handle_wall_wrapping:
    // Level 2: Wrap around edges instead of collision
    // Wrap X coordinate
    cmp     w2, 0
    b.lt    wrap_x_left
    cmp     w2, (GRID_WIDTH - 1)
    b.gt    wrap_x_right
    b       check_y_wrap

wrap_x_left:
    mov     w2, (GRID_WIDTH - 1)
    b       update_wrapped_position

wrap_x_right:
    mov     w2, 0
    b       update_wrapped_position

check_y_wrap:
    // Wrap Y coordinate
    cmp     w3, 0
    b.lt    wrap_y_top
    cmp     w3, (GRID_HEIGHT - 1)
    b.gt    wrap_y_bottom
    b       check_self_collision

wrap_y_top:
    mov     w3, (GRID_HEIGHT - 1)
    b       update_wrapped_position

wrap_y_bottom:
    mov     w3, 0

update_wrapped_position:
    // Update the head position with wrapped coordinates
    ldr     x0, =snake_head_index
    ldr     w0, [x0]
    ldr     x1, =snake_body
    mov     w4, 8
    mul     w0, w0, w4
    add     x1, x1, x0
    str     w2, [x1]
    str     w3, [x1, 4]

check_self_collision:
    
    // Check self collision
    mov     w4, GRID_WIDTH
    mul     w3, w3, w4
    add     w2, w2, w3
    
    ldr     x0, =game_grid
    ldrb    w1, [x0, x2]
    cmp     w1, CELL_SNAKE
    b.eq    collision_detected

    // Check obstacle collision
    ldr     x0, =current_level
    ldr     w0, [x0]
    cmp     w0, LEVEL_OBSTACLES
    b.ne    no_collision

    ldr     x0, =game_grid
    ldrb    w1, [x0, x2]
    cmp     w1, CELL_OBSTACLE
    b.eq    collision_detected

no_collision:
    // No collision
    mov     x0, 0
    ldp     fp, lr, [sp], 16
    ret

collision_detected:
    // Handle collision with lives system
    bl      handle_collision_with_lives
    ldp     fp, lr, [sp], 16
    ret

// Handle collision with lives system
// Returns 0 if still alive (respawned), 1 if game over
handle_collision_with_lives:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // Decrement lives
    ldr     x0, =lives_remaining
    ldr     w1, [x0]
    sub     w1, w1, 1
    str     w1, [x0]

    // Check if game over
    cbz     w1, lives_game_over

    // Dying breaks the combo streak
    ldr     x0, =combo_mult
    mov     w1, 1
    str     w1, [x0]
    ldr     x0, =last_eat_sec
    mov     w1, -100
    str     w1, [x0]

    // Still have lives - play death flash then respawn
    bl      play_death_flash
    bl      reset_snake_position
    bl      update_grid

    // Return 0 (continue playing)
    mov     x0, 0
    ldp     fp, lr, [sp], 16
    ret

lives_game_over:
    // No lives left - return 1 (game over)
    mov     x0, 1
    ldp     fp, lr, [sp], 16
    ret

// Reset snake position to center (keeps score/food count)
reset_snake_position:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // Reset snake length to initial
    ldr     x0, =snake_length
    mov     w1, INITIAL_SNAKE_LENGTH
    str     w1, [x0]

    // Reset head index
    ldr     x0, =snake_head_index
    mov     w1, 0
    str     w1, [x0]

    // Reset direction to right
    ldr     x0, =snake_direction
    mov     w1, DIR_RIGHT
    str     w1, [x0]

    // Place snake at center
    mov     x0, (GRID_WIDTH / 2)
    mov     x1, (GRID_HEIGHT / 2)

    // Head
    ldr     x2, =snake_body
    str     w0, [x2]
    str     w1, [x2, 4]

    // Body segments
    sub     w0, w0, 1
    str     w0, [x2, 8]
    str     w1, [x2, 12]

    sub     w0, w0, 1
    str     w0, [x2, 16]
    str     w1, [x2, 20]

    // Clear powerup state
    ldr     x0, =powerup_spawned
    str     wzr, [x0]
    ldr     x0, =powerup_active
    str     wzr, [x0]
    ldr     x0, =powerup_timer
    str     wzr, [x0]

    ldp     fp, lr, [sp], 16
    ret

// Check food collision and handle growth
check_food_collision:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    // Get head position
    ldr     x0, =snake_head_index
    ldr     w0, [x0]
    ldr     x1, =snake_body
    mov     w2, 8
    mul     w0, w0, w2
    add     x1, x1, x0
    
    ldr     w2, [x1]
    ldr     w3, [x1, 4]
    
    // Check if head is on food
    ldr     x0, =food_position
    ldr     w4, [x0]
    ldr     w5, [x0, 4]
    
    cmp     w2, w4
    b.ne    no_food_collision
    cmp     w3, w5
    b.ne    no_food_collision
    
    // Food eaten - grow snake and increase score
    ldr     x0, =snake_length
    ldr     w1, [x0]
    add     w1, w1, 1
    str     w1, [x0]

    // Track the longest the snake has been this run
    ldr     x0, =max_length
    ldr     w2, [x0]
    cmp     w1, w2
    csel    w2, w1, w2, gt
    str     w2, [x0]

    // Check food type for score bonus and sound
    ldr     x0, =food_type
    ldr     w2, [x0]
    cmp     w2, FOOD_GOLDEN
    b.eq    golden_food_eaten
    
    // Normal food eaten
    bl      play_food_sound
    mov     w2, 1
    b       add_score
    
golden_food_eaten:
    bl      play_golden_food_sound
    mov     w2, 5
    
add_score:
    // A live streak multiplies the base points
    mov     w0, w2
    bl      apply_combo
    mov     w2, w0

    ldr     x0, =score
    ldr     w1, [x0]
    
    // Check for potential overflow
    movz    w3, 0xC9FF
    movk    w3, 0x3B9A, lsl 16
    sub     w4, w3, w1  // w4 = MAX_SCORE - current_score
    cmp     w2, w4      // Compare points_to_add with remaining capacity
    b.le    safe_add    // If points_to_add <= remaining, safe to add
    
    // Would overflow, clamp to MAX_SCORE
    str     w3, [x0]
    b       add_score_done
    
safe_add:
    add     w1, w1, w2
    str     w1, [x0]
    
add_score_done:

    ldr     x0, =food_count
    ldr     w1, [x0]
    add     w1, w1, 1
    str     w1, [x0]

    // Maze mode grows a new wall every few meals
    ldr     x0, =current_level
    ldr     w0, [x0]
    cmp     w0, LEVEL_OBSTACLES
    b.ne    skip_escalation
    ldr     x0, =food_count
    ldr     w0, [x0]
    mov     w1, ESCALATE_EVERY
    udiv    w2, w0, w1
    msub    w3, w2, w1, w0
    cbnz    w3, skip_escalation
    bl      add_obstacle
skip_escalation:

    // Place new food
    bl      place_food
    
no_food_collision:
    // Check for power-up collision
    bl      check_powerup_collision

    // Update power-up timer
    bl      update_powerup_timer

    // Golden food does not wait around forever
    bl      update_gold_timer

    // Minefield mode grows its hazard on a timer
    bl      update_minefield

    // Update grid with new snake position
    bl      update_grid
    
    ldp     fp, lr, [sp], 16
    ret

// Place food randomly on grid
place_food:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    // Determine food type (20% chance for golden food)
    ldr     x0, =random_buffer
    mov     x1, 1
    mov     x2, 0
    mov     x8, SYS_GETRANDOM
    svc     0
    
    ldr     x0, =random_buffer
    ldrb    w1, [x0]
    mov     w2, 5
    udiv    w3, w1, w2
    mul     w3, w3, w2
    sub     w1, w1, w3
    
    // If w1 == 0 (20% chance), make it golden food
    ldr     x0, =food_type
    cmp     w1, 0
    mov     w2, FOOD_GOLDEN
    mov     w3, FOOD_NORMAL
    csel    w1, w2, w3, eq
    str     w1, [x0]

    // Golden food starts its expiry clock the moment it appears
    cmp     w1, FOOD_GOLDEN
    b.ne    place_food_loop
    bl      calculate_elapsed_time
    ldr     x0, =elapsed_seconds
    ldr     w1, [x0]
    add     w1, w1, GOLD_LIFETIME
    ldr     x0, =gold_deadline
    str     w1, [x0]

place_food_loop:
    // Get random numbers for x and y
    ldr     x0, =random_buffer
    mov     x1, 2
    mov     x2, 0
    mov     x8, SYS_GETRANDOM
    svc     0
    
    // Convert to grid coordinates
    ldr     x0, =random_buffer
    ldrb    w1, [x0]
    mov     w2, GRID_WIDTH
    udiv    w3, w1, w2
    mul     w3, w3, w2
    sub     w1, w1, w3
    
    ldrb    w4, [x0, 1]
    mov     w2, GRID_HEIGHT
    udiv    w5, w4, w2
    mul     w5, w5, w2
    sub     w4, w4, w5
    
    // Check if position is empty
    mov     w2, GRID_WIDTH
    mul     w4, w4, w2
    add     w1, w1, w4
    
    ldr     x0, =game_grid
    ldrb    w2, [x0, x1]
    cmp     w2, CELL_EMPTY
    b.ne    place_food_loop
    
    // Place food
    mov     w2, CELL_FOOD
    strb    w2, [x0, x1]
    
    // Store food position
    mov     w2, GRID_WIDTH
    udiv    w4, w1, w2
    mul     w5, w4, w2
    sub     w3, w1, w5
    
    ldr     x0, =food_position
    str     w3, [x0]
    str     w4, [x0, 4]
    
    ldp     fp, lr, [sp], 16
    ret

// Try to spawn a power-up (10% chance)
try_spawn_powerup:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // Check if powerup already spawned
    ldr     x0, =powerup_spawned
    ldr     w0, [x0]
    cbnz    w0, spawn_powerup_done

    // Generate random number (10% chance)
    ldr     x0, =random_buffer
    mov     x1, 1
    mov     x2, 0
    mov     x8, SYS_GETRANDOM
    svc     0

    ldr     x0, =random_buffer
    ldrb    w1, [x0]
    mov     w2, 10
    udiv    w3, w1, w2
    mul     w3, w3, w2
    sub     w1, w1, w3

    // Only spawn if w1 == 0 (10% chance)
    cbnz    w1, spawn_powerup_done

    // Spawn a powerup
    bl      spawn_powerup

spawn_powerup_done:
    ldp     fp, lr, [sp], 16
    ret

// Actually spawn a powerup at random position
spawn_powerup:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // Decide powerup type (50/50 slowmo or shrink)
    ldr     x0, =random_buffer
    mov     x1, 1
    mov     x2, 0
    mov     x8, SYS_GETRANDOM
    svc     0

    ldr     x0, =random_buffer
    ldrb    w1, [x0]
    and     w1, w1, 1  // 0 or 1

    ldr     x0, =powerup_type
    cmp     w1, 0
    mov     w2, FOOD_SLOWMO
    mov     w3, FOOD_SHRINK
    csel    w1, w2, w3, eq
    str     w1, [x0]

spawn_powerup_position:
    // Generate random position
    ldr     x0, =random_buffer
    mov     x1, 2
    mov     x2, 0
    mov     x8, SYS_GETRANDOM
    svc     0

    ldr     x0, =random_buffer
    ldrb    w1, [x0]
    mov     w2, GRID_WIDTH
    udiv    w3, w1, w2
    mul     w3, w3, w2
    sub     w19, w1, w3  // x = w19

    ldrb    w1, [x0, 1]
    mov     w2, GRID_HEIGHT
    udiv    w3, w1, w2
    mul     w3, w3, w2
    sub     w20, w1, w3  // y = w20

    // Check if position is empty
    mov     w1, GRID_WIDTH
    mul     w2, w20, w1
    add     w2, w2, w19

    ldr     x0, =game_grid
    ldrb    w3, [x0, x2]
    cmp     w3, CELL_EMPTY
    b.ne    spawn_powerup_position

    // Store powerup position
    ldr     x0, =powerup_position
    str     w19, [x0]
    str     w20, [x0, 4]

    // Mark powerup as spawned
    ldr     x0, =powerup_spawned
    mov     w1, 1
    str     w1, [x0]

    ldp     fp, lr, [sp], 16
    ret

// Check if snake head is on powerup
check_powerup_collision:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // Check if powerup exists
    ldr     x0, =powerup_spawned
    ldr     w0, [x0]
    cbz     w0, powerup_collision_done

    // Get head position
    ldr     x0, =snake_head_index
    ldr     w0, [x0]
    ldr     x1, =snake_body
    mov     w2, 8
    mul     w0, w0, w2
    add     x1, x1, x0

    ldr     w2, [x1]      // head x
    ldr     w3, [x1, 4]  // head y

    // Check if head is on powerup
    ldr     x0, =powerup_position
    ldr     w4, [x0]
    ldr     w5, [x0, 4]

    cmp     w2, w4
    b.ne    powerup_collision_done
    cmp     w3, w5
    b.ne    powerup_collision_done

    // Powerup consumed!
    ldr     x0, =powerup_spawned
    str     wzr, [x0]

    // Check powerup type
    ldr     x0, =powerup_type
    ldr     w0, [x0]
    cmp     w0, FOOD_SLOWMO
    b.eq    activate_slowmo
    cmp     w0, FOOD_SHRINK
    b.eq    activate_shrink
    b       powerup_collision_done

activate_slowmo:
    // Activate slow-mo effect
    ldr     x0, =powerup_active
    mov     w1, 1
    str     w1, [x0]

    ldr     x0, =powerup_timer
    mov     w1, POWERUP_DURATION
    str     w1, [x0]
    b       powerup_collision_done

activate_shrink:
    // Shrink the snake
    bl      shrink_snake

powerup_collision_done:
    ldp     fp, lr, [sp], 16
    ret

// Shrink snake by SHRINK_AMOUNT (minimum INITIAL_SNAKE_LENGTH)
shrink_snake:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =snake_length
    ldr     w1, [x0]

    // Calculate new length
    sub     w1, w1, SHRINK_AMOUNT
    cmp     w1, INITIAL_SNAKE_LENGTH
    mov     w2, INITIAL_SNAKE_LENGTH
    csel    w1, w2, w1, lt  // Use INITIAL_SNAKE_LENGTH if < INITIAL_SNAKE_LENGTH

    str     w1, [x0]

    ldp     fp, lr, [sp], 16
    ret

// Update powerup timer, deactivate when expired
update_powerup_timer:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // Check if powerup is active
    ldr     x0, =powerup_active
    ldr     w0, [x0]
    cbz     w0, update_timer_done

    // Decrement timer
    ldr     x0, =powerup_timer
    ldr     w1, [x0]
    sub     w1, w1, 1
    str     w1, [x0]

    // Check if expired
    cbnz    w1, update_timer_done

    // Deactivate powerup
    ldr     x0, =powerup_active
    str     wzr, [x0]

update_timer_done:
    ldp     fp, lr, [sp], 16
    ret

// Update grid with current snake position
update_grid:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    // Clear entire grid first
    ldr     x0, =game_grid
    mov     x1, CELL_EMPTY
    mov     x2, (GRID_WIDTH * GRID_HEIGHT)
    bl      memset
    
    // Place all snake segments
    ldr     x19, =snake_length
    ldr     w19, [x19]
    ldr     x20, =snake_head_index
    ldr     w20, [x20]
    ldr     x21, =snake_body
    
    mov     w22, 0
    
place_snake_segments:
    cmp     w22, w19
    b.ge    snake_placed
    
    // Calculate segment index (head - counter, with wraparound)
    sub     w23, w20, w22
    cmp     w23, 0
    b.ge    index_positive
    add     w23, w23, MAX_SNAKE_LENGTH
    
index_positive:
    // Get segment position
    mov     w24, 8
    mul     w23, w23, w24
    add     x23, x21, x23
    
    ldr     w24, [x23]
    ldr     w25, [x23, 4]
    
    // Calculate grid position
    mov     w26, GRID_WIDTH
    mul     w25, w25, w26
    add     w24, w24, w25
    
    // Place snake segment on grid
    ldr     x26, =game_grid
    mov     w27, CELL_SNAKE
    strb    w27, [x26, x24]
    
    add     w22, w22, 1
    b       place_snake_segments
    
snake_placed:
    // Place food
    ldr     x0, =food_position
    ldr     w1, [x0]
    ldr     w2, [x0, 4]
    
    mov     w3, GRID_WIDTH
    mul     w2, w2, w3
    add     w1, w1, w2
    
    ldr     x0, =game_grid
    mov     w3, CELL_FOOD
    strb    w3, [x0, x1]

    // Place obstacles (maze and minefield carry them)
    ldr     x0, =current_level
    ldr     w0, [x0]
    cmp     w0, LEVEL_OBSTACLES
    b.eq    place_obstacles_start
    cmp     w0, LEVEL_MINEFIELD
    b.ne    skip_place_obstacles

place_obstacles_start:

    ldr     x19, =obstacle_positions
    mov     w20, 0

place_obstacles_loop:
    ldr     x0, =obstacle_count
    ldr     w0, [x0]
    cmp     w20, w0
    b.ge    skip_place_obstacles

    mov     w0, 8
    mul     w0, w20, w0
    add     x0, x19, x0
    ldr     w1, [x0]      // x
    ldr     w2, [x0, 4]  // y

    mov     w3, GRID_WIDTH
    mul     w2, w2, w3
    add     w1, w1, w2

    ldr     x0, =game_grid
    mov     w3, CELL_OBSTACLE
    strb    w3, [x0, x1]

    add     w20, w20, 1
    b       place_obstacles_loop

skip_place_obstacles:

    // Place power-up if spawned
    ldr     x0, =powerup_spawned
    ldr     w0, [x0]
    cbz     w0, skip_place_powerup

    ldr     x0, =powerup_position
    ldr     w1, [x0]
    ldr     w2, [x0, 4]

    mov     w3, GRID_WIDTH
    mul     w2, w2, w3
    add     w1, w1, w2

    ldr     x0, =powerup_type
    ldr     w3, [x0]
    cmp     w3, FOOD_SLOWMO
    b.eq    place_slowmo_powerup

    // Shrink power-up
    ldr     x0, =game_grid
    mov     w3, CELL_POWERUP_SHRINK
    strb    w3, [x0, x1]
    b       skip_place_powerup

place_slowmo_powerup:
    ldr     x0, =game_grid
    mov     w3, CELL_POWERUP_SLOW
    strb    w3, [x0, x1]

skip_place_powerup:

    ldp     fp, lr, [sp], 16
    ret

// Clear screen
clear_screen:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    mov     x0, STDOUT_FILENO
    ldr     x1, =clear_screen_seq
    mov     x2, clear_screen_seq_len
    mov     x8, SYS_WRITE
    svc     0
    
    ldp     fp, lr, [sp], 16
    ret

// Hide cursor
hide_cursor:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    mov     x0, STDOUT_FILENO
    ldr     x1, =hide_cursor_seq
    mov     x2, hide_cursor_seq_len
    mov     x8, SYS_WRITE
    svc     0
    
    ldp     fp, lr, [sp], 16
    ret

// Show cursor
show_cursor:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    mov     x0, STDOUT_FILENO
    ldr     x1, =show_cursor_seq
    mov     x2, show_cursor_seq_len
    mov     x8, SYS_WRITE
    svc     0
    
    ldp     fp, lr, [sp], 16
    ret

// Draw the game
draw_game:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    // Move cursor to top
    mov     x0, STDOUT_FILENO
    ldr     x1, =move_cursor_home
    mov     x2, move_cursor_home_len
    mov     x8, SYS_WRITE
    svc     0
    
    // Draw title and score
    bl      draw_header
    
    // Draw top border
    bl      draw_horizontal_border
    
    // Draw game grid
    mov     w19, 0
    
draw_grid_loop:
    cmp     w19, GRID_HEIGHT
    b.ge    draw_grid_done
    
    // Draw left border
    mov     x0, STDOUT_FILENO
    ldr     x1, =vertical_border
    mov     x2, vertical_border_len
    mov     x8, SYS_WRITE
    svc     0
    
    // Draw row
    mov     w20, 0
    
draw_row_loop:
    cmp     w20, GRID_WIDTH
    b.ge    draw_row_done
    
    // Get cell value
    mov     w0, GRID_WIDTH
    mul     w1, w19, w0
    add     w1, w1, w20
    
    ldr     x0, =game_grid
    ldrb    w2, [x0, x1]
    
    // Draw cell based on type
    cmp     w2, CELL_SNAKE
    b.eq    draw_snake_cell
    cmp     w2, CELL_FOOD
    b.eq    draw_food_cell
    cmp     w2, CELL_OBSTACLE
    b.eq    draw_obstacle_cell
    cmp     w2, CELL_POWERUP_SLOW
    b.eq    draw_slowmo_cell
    cmp     w2, CELL_POWERUP_SHRINK
    b.eq    draw_shrink_cell

    // Empty cell
    mov     x0, STDOUT_FILENO
    ldr     x1, =empty_cell
    mov     x2, 1
    mov     x8, SYS_WRITE
    svc     0
    b       draw_cell_done

draw_snake_cell:
    // Check if this is the snake head position
    stp     x19, x20, [sp, -16]!

    // Get head position
    ldr     x0, =snake_head_index
    ldr     w0, [x0]
    ldr     x1, =snake_body
    mov     w2, 8
    mul     w0, w0, w2
    add     x1, x1, x0

    ldr     w2, [x1]      // head x
    ldr     w3, [x1, 4]  // head y

    ldp     x0, x1, [sp], 16

    // Compare current cell position (w20=x, w19=y) with head position
    cmp     w20, w2
    b.ne    draw_body_cell
    cmp     w19, w3
    b.ne    draw_body_cell

    // This is the head - draw bright green @
    mov     x0, STDOUT_FILENO
    ldr     x1, =snake_head_cell
    mov     x2, snake_head_cell_len
    mov     x8, SYS_WRITE
    svc     0
    b       draw_cell_done

draw_body_cell:
    // Checkerboard shading (by cell parity) gives the body texture
    add     w2, w19, w20
    tst     w2, 1
    b.ne    draw_body_cell_alt

    mov     x0, STDOUT_FILENO
    ldr     x1, =snake_cell
    mov     x2, snake_cell_len
    mov     x8, SYS_WRITE
    svc     0
    b       draw_cell_done

draw_body_cell_alt:
    mov     x0, STDOUT_FILENO
    ldr     x1, =snake_cell_alt
    mov     x2, snake_cell_alt_len
    mov     x8, SYS_WRITE
    svc     0
    b       draw_cell_done

draw_obstacle_cell:
    mov     x0, STDOUT_FILENO
    ldr     x1, =obstacle_cell
    mov     x2, obstacle_cell_len
    mov     x8, SYS_WRITE
    svc     0
    b       draw_cell_done

draw_slowmo_cell:
    mov     x0, STDOUT_FILENO
    ldr     x1, =slowmo_cell
    mov     x2, slowmo_cell_len
    mov     x8, SYS_WRITE
    svc     0
    b       draw_cell_done

draw_shrink_cell:
    mov     x0, STDOUT_FILENO
    ldr     x1, =shrink_cell
    mov     x2, shrink_cell_len
    mov     x8, SYS_WRITE
    svc     0
    b       draw_cell_done

draw_food_cell:
    // Check food type
    ldr     x0, =food_type
    ldr     w3, [x0]
    cmp     w3, FOOD_GOLDEN
    b.eq    draw_golden_food
    
    // Draw normal food
    mov     x0, STDOUT_FILENO
    ldr     x1, =food_cell
    mov     x2, food_cell_len
    mov     x8, SYS_WRITE
    svc     0
    b       draw_cell_done

draw_golden_food:
    // Draw golden food
    mov     x0, STDOUT_FILENO
    ldr     x1, =golden_food_cell
    mov     x2, golden_food_cell_len
    mov     x8, SYS_WRITE
    svc     0

draw_cell_done:
    add     w20, w20, 1
    b       draw_row_loop

draw_row_done:
    // Draw right border and newline
    mov     x0, STDOUT_FILENO
    ldr     x1, =vertical_border_newline
    mov     x2, vertical_border_newline_len
    mov     x8, SYS_WRITE
    svc     0
    
    add     w19, w19, 1
    b       draw_grid_loop

draw_grid_done:
    // Draw bottom border
    bl      draw_horizontal_border_bottom

    // Draw controls
    mov     x0, STDOUT_FILENO
    ldr     x1, =controls_text
    mov     x2, controls_text_len
    mov     x8, SYS_WRITE
    svc     0
    
    ldp     fp, lr, [sp], 16
    ret

// Draw header with score
draw_header:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // Clear line first to prevent stale text (fixes slow-mo indicator staying)
    mov     x0, STDOUT_FILENO
    ldr     x1, =clear_line
    mov     x2, clear_line_len
    mov     x8, SYS_WRITE
    svc     0

    // Draw title with color
    mov     x0, STDOUT_FILENO
    ldr     x1, =header_bar
    mov     x2, header_bar_len
    mov     x8, SYS_WRITE
    svc     0
    
    // Draw score
    mov     x0, STDOUT_FILENO
    ldr     x1, =score_text
    mov     x2, score_text_len
    mov     x8, SYS_WRITE
    svc     0
    
    // Convert score to string and display
    ldr     x0, =score
    ldr     w0, [x0]
    ldr     x1, =score_buffer
    bl      int_to_string
    
    mov     x2, x0
    mov     x0, STDOUT_FILENO
    ldr     x1, =score_buffer
    mov     x8, SYS_WRITE
    svc     0
    
    // Display current level
    mov     x0, STDOUT_FILENO
    ldr     x1, =level_display_text
    mov     x2, level_display_text_len
    mov     x8, SYS_WRITE
    svc     0
    
    ldr     x0, =current_level
    ldr     w0, [x0]
    ldr     x1, =speed_buffer
    bl      int_to_string
    
    mov     x2, x0
    mov     x0, STDOUT_FILENO
    ldr     x1, =speed_buffer
    mov     x8, SYS_WRITE
    svc     0
    
    // Display speed level  
    mov     x0, STDOUT_FILENO
    ldr     x1, =speed_text
    mov     x2, speed_text_len
    mov     x8, SYS_WRITE
    svc     0
    
    bl      calculate_speed_level
    ldr     x1, =speed_buffer
    bl      int_to_string
    
    mov     x2, x0
    mov     x0, STDOUT_FILENO
    ldr     x1, =speed_buffer
    mov     x8, SYS_WRITE
    svc     0
    
    // Display time played
    mov     x0, STDOUT_FILENO
    ldr     x1, =time_text
    mov     x2, time_text_len
    mov     x8, SYS_WRITE
    svc     0
    
    bl      calculate_elapsed_time
    ldr     x0, =elapsed_seconds
    ldr     w0, [x0]
    ldr     x1, =time_buffer
    bl      int_to_string
    
    mov     x2, x0
    mov     x0, STDOUT_FILENO
    ldr     x1, =time_buffer
    mov     x8, SYS_WRITE
    svc     0
    
    // Time unit
    mov     x0, STDOUT_FILENO
    ldr     x1, =seconds_text
    mov     x2, seconds_text_len
    mov     x8, SYS_WRITE
    svc     0

    // Display lives
    mov     x0, STDOUT_FILENO
    ldr     x1, =lives_text
    mov     x2, lives_text_len
    mov     x8, SYS_WRITE
    svc     0

    ldr     x0, =lives_remaining
    ldr     w0, [x0]
    ldr     x1, =speed_buffer
    bl      int_to_string

    mov     x2, x0
    mov     x0, STDOUT_FILENO
    ldr     x1, =speed_buffer
    mov     x8, SYS_WRITE
    svc     0

    // Show the streak multiplier while it is still alive
    ldr     x0, =combo_mult
    ldr     w0, [x0]
    cmp     w0, 1
    b.le    skip_combo_indicator
    ldr     x0, =elapsed_seconds
    ldr     w1, [x0]
    ldr     x0, =last_eat_sec
    ldr     w2, [x0]
    sub     w1, w1, w2
    cmp     w1, COMBO_WINDOW
    b.gt    skip_combo_indicator

    mov     x0, STDOUT_FILENO
    ldr     x1, =combo_prefix
    mov     x2, combo_prefix_len
    mov     x8, SYS_WRITE
    svc     0

    ldr     x0, =combo_mult
    ldr     w0, [x0]
    ldr     x1, =speed_buffer
    bl      int_to_string

    mov     x2, x0
    mov     x0, STDOUT_FILENO
    ldr     x1, =speed_buffer
    mov     x8, SYS_WRITE
    svc     0

    mov     x0, STDOUT_FILENO
    ldr     x1, =combo_suffix
    mov     x2, combo_suffix_len
    mov     x8, SYS_WRITE
    svc     0

skip_combo_indicator:

    // Display slowmo countdown if active
    ldr     x0, =powerup_active
    ldr     w0, [x0]
    cbz     w0, skip_slowmo_indicator

    // Write prefix " [SLOW "
    mov     x0, STDOUT_FILENO
    ldr     x1, =slowmo_prefix
    mov     x2, slowmo_prefix_len
    mov     x8, SYS_WRITE
    svc     0

    // Calculate seconds remaining (timer / 5 to approximate seconds)
    // Timer starts at 50, each game loop is ~200-400ms
    ldr     x0, =powerup_timer
    ldr     w0, [x0]
    mov     w1, 5
    udiv    w0, w0, w1          // w0 = timer / 5 (approximate seconds)
    add     w0, w0, 1          // Add 1 to avoid showing 0 while active

    // Convert to string
    ldr     x1, =slowmo_timer_buffer
    bl      int_to_string
    mov     x2, x0              // x2 = length from int_to_string

    // Write the number
    mov     x0, STDOUT_FILENO
    ldr     x1, =slowmo_timer_buffer
    mov     x8, SYS_WRITE
    svc     0

    // Write suffix "s]"
    mov     x0, STDOUT_FILENO
    ldr     x1, =slowmo_suffix
    mov     x2, slowmo_suffix_len
    mov     x8, SYS_WRITE
    svc     0

skip_slowmo_indicator:

    // Newline
    mov     x0, STDOUT_FILENO
    ldr     x1, =newline
    mov     x2, 1
    mov     x8, SYS_WRITE
    svc     0

    ldp     fp, lr, [sp], 16
    ret

// Draw horizontal border (top)
draw_horizontal_border:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // Top left corner with color
    mov     x0, STDOUT_FILENO
    ldr     x1, =corner_char
    mov     x2, corner_char_len
    mov     x8, SYS_WRITE
    svc     0

    // Horizontal line (gray color continues from corner_char)
    mov     w19, 0
border_loop:
    cmp     w19, GRID_WIDTH
    b.ge    border_done

    mov     x0, STDOUT_FILENO
    ldr     x1, =horizontal_border
    mov     x2, 3              // UTF-8 ─ is 3 bytes
    mov     x8, SYS_WRITE
    svc     0

    add     w19, w19, 1
    b       border_loop

border_done:
    // Top right corner and newline
    mov     x0, STDOUT_FILENO
    ldr     x1, =corner_newline
    mov     x2, corner_newline_len
    mov     x8, SYS_WRITE
    svc     0

    ldp     fp, lr, [sp], 16
    ret

// Draw horizontal border (bottom)
draw_horizontal_border_bottom:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // Bottom left corner with color
    mov     x0, STDOUT_FILENO
    ldr     x1, =corner_bottom
    mov     x2, corner_bottom_len
    mov     x8, SYS_WRITE
    svc     0

    // Horizontal line
    mov     w19, 0
border_bottom_loop:
    cmp     w19, GRID_WIDTH
    b.ge    border_bottom_done

    mov     x0, STDOUT_FILENO
    ldr     x1, =horizontal_border
    mov     x2, 3              // UTF-8 ─ is 3 bytes
    mov     x8, SYS_WRITE
    svc     0

    add     w19, w19, 1
    b       border_bottom_loop

border_bottom_done:
    // Bottom right corner and newline
    mov     x0, STDOUT_FILENO
    ldr     x1, =corner_bottom_end
    mov     x2, corner_bottom_end_len
    mov     x8, SYS_WRITE
    svc     0

    // Newline
    mov     x0, STDOUT_FILENO
    ldr     x1, =newline
    mov     x2, 1
    mov     x8, SYS_WRITE
    svc     0

    ldp     fp, lr, [sp], 16
    ret

// Convert integer to string
int_to_string:
    // x0 = number, x1 = buffer, returns length in x0
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    mov     x2, x1
    cbz     x0, zero_case
    
    // Handle negative numbers
    mov     x3, 0
    cmp     x0, 0
    b.ge    positive_number
    
    mov     w4, '-'
    strb    w4, [x1], 1
    neg     x0, x0
    add     x3, x3, 1

positive_number:
    mov     x4, x1
    
convert_loop:
    mov     x5, 10
    udiv    x6, x0, x5
    mul     x7, x6, x5
    sub     x5, x0, x7
    add     w5, w5, '0'
    strb    w5, [x1], 1
    add     x3, x3, 1
    mov     x0, x6
    cbnz    x0, convert_loop
    
    // Reverse the digits
    sub     x1, x1, 1
reverse_loop:
    cmp     x4, x1
    b.ge    reverse_done
    
    ldrb    w5, [x4]
    ldrb    w6, [x1]
    strb    w6, [x4], 1
    strb    w5, [x1], -1
    b       reverse_loop

reverse_done:
    mov     x0, x3
    ldp     fp, lr, [sp], 16
    ret

zero_case:
    mov     w4, '0'
    strb    w4, [x1]
    mov     x0, 1
    ldp     fp, lr, [sp], 16
    ret

// Display game over message
display_game_over:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // Play death flash effect
    bl      play_death_flash

    // Play game over sound
    bl      play_game_over_sound

    // Start the panel on a blank screen: drawn over the board (or over
    // a previous game over) the lines interleave with stale text
    bl      clear_screen
    mov     x0, STDOUT_FILENO
    ldr     x1, =move_cursor_home
    mov     x2, move_cursor_home_len
    mov     x8, SYS_WRITE
    svc     0

    mov     x0, STDOUT_FILENO
    ldr     x1, =game_over_text
    mov     x2, game_over_text_len
    mov     x8, SYS_WRITE
    svc     0
    
    // Display final score
    mov     x0, STDOUT_FILENO
    ldr     x1, =final_score_text
    mov     x2, final_score_text_len
    mov     x8, SYS_WRITE
    svc     0
    
    ldr     x0, =score
    ldr     w0, [x0]
    ldr     x1, =score_buffer
    bl      int_to_string
    
    mov     x2, x0
    mov     x0, STDOUT_FILENO
    ldr     x1, =score_buffer
    mov     x8, SYS_WRITE
    svc     0
    
    // Display newline
    mov     x0, STDOUT_FILENO
    ldr     x1, =newline
    mov     x2, 1
    mov     x8, SYS_WRITE
    svc     0
    
    // Display food count
    mov     x0, STDOUT_FILENO
    ldr     x1, =food_count_text
    mov     x2, food_count_text_len
    mov     x8, SYS_WRITE
    svc     0
    
    ldr     x0, =food_count
    ldr     w0, [x0]
    ldr     x1, =food_buffer
    bl      int_to_string
    
    mov     x2, x0
    mov     x0, STDOUT_FILENO
    ldr     x1, =food_buffer
    mov     x8, SYS_WRITE
    svc     0
    
    mov     x0, STDOUT_FILENO
    ldr     x1, =newline
    mov     x2, 1
    mov     x8, SYS_WRITE
    svc     0

    // Time survived
    bl      calculate_elapsed_time
    mov     x0, STDOUT_FILENO
    ldr     x1, =stats_time_text
    mov     x2, stats_time_text_len
    mov     x8, SYS_WRITE
    svc     0

    ldr     x0, =elapsed_seconds
    ldr     w0, [x0]
    ldr     x1, =time_buffer
    bl      int_to_string

    mov     x2, x0
    mov     x0, STDOUT_FILENO
    ldr     x1, =time_buffer
    mov     x8, SYS_WRITE
    svc     0

    mov     x0, STDOUT_FILENO
    ldr     x1, =stats_time_unit
    mov     x2, stats_time_unit_len
    mov     x8, SYS_WRITE
    svc     0

    // Longest the snake got
    mov     x0, STDOUT_FILENO
    ldr     x1, =stats_len_text
    mov     x2, stats_len_text_len
    mov     x8, SYS_WRITE
    svc     0

    ldr     x0, =max_length
    ldr     w0, [x0]
    ldr     x1, =speed_buffer
    bl      int_to_string

    mov     x2, x0
    mov     x0, STDOUT_FILENO
    ldr     x1, =speed_buffer
    mov     x8, SYS_WRITE
    svc     0

    mov     x0, STDOUT_FILENO
    ldr     x1, =newline
    mov     x2, 1
    mov     x8, SYS_WRITE
    svc     0

    // Deepest combo streak
    mov     x0, STDOUT_FILENO
    ldr     x1, =stats_combo_text
    mov     x2, stats_combo_text_len
    mov     x8, SYS_WRITE
    svc     0

    ldr     x0, =best_combo
    ldr     w0, [x0]
    ldr     x1, =speed_buffer
    bl      int_to_string

    mov     x2, x0
    mov     x0, STDOUT_FILENO
    ldr     x1, =speed_buffer
    mov     x8, SYS_WRITE
    svc     0

    mov     x0, STDOUT_FILENO
    ldr     x1, =newline
    mov     x2, 1
    mov     x8, SYS_WRITE
    svc     0

    // Check for new records and save high scores
    bl      check_and_update_records

    // Show restart prompt
    mov     x0, STDOUT_FILENO
    ldr     x1, =restart_prompt
    mov     x2, restart_prompt_len
    mov     x8, SYS_WRITE
    svc     0

    // Wait for restart or quit
    bl      wait_for_restart_or_quit

    ldp     fp, lr, [sp], 16
    ret

// Wait for R (restart) or Q (quit to menu) input
wait_for_restart_or_quit:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

restart_input_loop:
    // Poll for a key. stdin is still non-blocking here, so a miss
    // must sleep before retrying or the wait would spin the CPU.
    mov     x0, STDIN_FILENO
    ldr     x1, =input_buffer
    mov     x2, 1
    mov     x8, SYS_READ
    svc     0

    cmp     x0, 1
    b.eq    restart_have_key

    ldr     x0, =anim_sleep_time
    mov     x1, 0
    mov     x8, SYS_NANOSLEEP
    svc     0
    b       restart_input_loop

restart_have_key:

    // Get the character
    ldr     x0, =input_buffer
    ldrb    w0, [x0]

    // Check for R (restart)
    cmp     w0, 'r'
    b.eq    do_restart
    cmp     w0, 'R'
    b.eq    do_restart

    // Check for Q (quit)
    cmp     w0, 'q'
    b.eq    do_quit_menu
    cmp     w0, 'Q'
    b.eq    do_quit_menu

    b       restart_input_loop

do_restart:
    // Set restart flag and reinitialize game
    ldr     x0, =restart_requested
    mov     w1, 1
    str     w1, [x0]

    // Reinitialize game (keep current level)
    bl      init_game

    // Clear screen
    bl      clear_screen
    bl      hide_cursor

    // Jump back to game loop
    ldp     fp, lr, [sp], 16
    b       game_loop

do_quit_menu:
    // Go back to level selection
    bl      clear_screen
    bl      show_welcome_screen
    bl      get_level_selection

    // Reinitialize game with new level
    bl      init_game
    bl      clear_screen
    bl      hide_cursor

    ldp     fp, lr, [sp], 16
    b       game_loop

// Display pause message
// Play death flash effect (red flash 3 times)
play_death_flash:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w19, 3  // Flash 3 times

flash_loop:
    cbz     w19, flash_done

    // Set red background
    mov     x0, STDOUT_FILENO
    ldr     x1, =flash_red
    mov     x2, flash_red_len
    mov     x8, SYS_WRITE
    svc     0

    // Clear screen with red
    bl      clear_screen

    // Short delay (50ms)
    ldr     x0, =sleep_time
    mov     x1, 0
    str     x1, [x0]
    movz    x1, 0xF080, lsl 0    // 50ms in nanoseconds (0x02FAF080)
    movk    x1, 0x02FA, lsl 16
    str     x1, [x0, 8]
    mov     x8, SYS_NANOSLEEP
    svc     0

    // Reset colors
    mov     x0, STDOUT_FILENO
    ldr     x1, =flash_reset
    mov     x2, flash_reset_len
    mov     x8, SYS_WRITE
    svc     0

    // Clear screen
    bl      clear_screen

    // Short delay
    ldr     x0, =sleep_time
    mov     x1, 0
    str     x1, [x0]
    movz    x1, 0xF080, lsl 0    // 50ms in nanoseconds
    movk    x1, 0x02FA, lsl 16
    str     x1, [x0, 8]
    mov     x8, SYS_NANOSLEEP
    svc     0

    sub     w19, w19, 1
    b       flash_loop

flash_done:
    ldp     fp, lr, [sp], 16
    ret

display_pause_message:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // Move cursor to bottom of screen
    mov     x0, STDOUT_FILENO
    ldr     x1, =pause_text
    mov     x2, pause_text_len
    mov     x8, SYS_WRITE
    svc     0

    ldp     fp, lr, [sp], 16
    ret

// Get current time
get_current_time:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    mov     x0, CLOCK_MONOTONIC
    ldr     x1, =current_time
    mov     x8, SYS_CLOCK_GETTIME
    svc     0
    
    ldp     fp, lr, [sp], 16
    ret

// Calculate elapsed time in seconds
calculate_elapsed_time:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    bl      get_current_time
    
    // Load current time and start time
    ldr     x0, =current_time
    ldr     x1, =game_start_time
    ldr     x2, [x0]
    ldr     x3, [x1]
    
    sub     x2, x2, x3
    
    // Subtract total paused time to get actual playing time
    ldr     x0, =total_paused_time
    ldr     w4, [x0]
    sub     x2, x2, x4
    
    // Store playing seconds (not total elapsed)
    ldr     x0, =elapsed_seconds
    str     w2, [x0]
    
    ldp     fp, lr, [sp], 16
    ret

// Apply the combo streak to a meal's base points.
// In: w0 = base points. Out: w0 = points times the streak multiplier.
// A meal within COMBO_WINDOW seconds of the last one deepens the
// streak (up to COMBO_MAX); a slower meal resets it to 1.
apply_combo:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    stp     x19, x20, [sp, -16]!

    mov     w19, w0

    bl      calculate_elapsed_time
    ldr     x0, =elapsed_seconds
    ldr     w1, [x0]
    ldr     x2, =last_eat_sec
    ldr     w3, [x2]
    str     w1, [x2]
    sub     w3, w1, w3

    ldr     x4, =combo_mult
    ldr     w5, [x4]
    cmp     w3, COMBO_WINDOW
    b.gt    combo_reset

    add     w5, w5, 1
    mov     w0, COMBO_MAX
    cmp     w5, w0
    csel    w5, w0, w5, gt
    b       combo_store

combo_reset:
    mov     w5, 1

combo_store:
    str     w5, [x4]

    // Remember the deepest streak for the game over screen
    ldr     x0, =best_combo
    ldr     w1, [x0]
    cmp     w5, w1
    csel    w1, w5, w1, gt
    str     w1, [x0]

    mul     w0, w19, w5

    ldp     x19, x20, [sp], 16
    ldp     fp, lr, [sp], 16
    ret

// Downgrade golden food to normal once its window passes. The grid
// cell stays CELL_FOOD either way; the draw code reads food_type.
update_gold_timer:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =food_type
    ldr     w1, [x0]
    cmp     w1, FOOD_GOLDEN
    b.ne    gold_timer_done

    bl      calculate_elapsed_time
    ldr     x0, =elapsed_seconds
    ldr     w1, [x0]
    ldr     x2, =gold_deadline
    ldr     w3, [x2]
    cmp     w1, w3
    b.le    gold_timer_done

    ldr     x0, =food_type
    mov     w1, FOOD_NORMAL
    str     w1, [x0]

gold_timer_done:
    ldp     fp, lr, [sp], 16
    ret

// Drop one new mine every MINE_INTERVAL_SEC seconds of play in
// minefield mode. add_obstacle stays away from the head and gives up
// quietly at the array's capacity, so the field grows hostile without
// ever becoming unfair or unbounded.
update_minefield:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    ldr     x0, =current_level
    ldr     w1, [x0]
    cmp     w1, LEVEL_MINEFIELD
    b.ne    minefield_done

    bl      calculate_elapsed_time
    ldr     x0, =elapsed_seconds
    ldr     w1, [x0]
    ldr     x2, =next_mine_sec
    ldr     w3, [x2]
    cmp     w1, w3
    b.lt    minefield_done

    add     w3, w3, MINE_INTERVAL_SEC
    str     w3, [x2]
    bl      add_obstacle

minefield_done:
    ldp     fp, lr, [sp], 16
    ret

// Calculate current speed level (1-10)
calculate_speed_level:
    ldr     x0, =snake_length
    ldr     w0, [x0]
    
    // Speed level = min(10, 1 + (length-3)/3)
    sub     w0, w0, INITIAL_SNAKE_LENGTH
    mov     w1, 3
    udiv    w0, w0, w1
    add     w0, w0, 1
    
    mov     w1, 10
    cmp     w0, w1
    csel    w0, w1, w0, gt
    
    ret

// Load high scores from file
load_high_scores:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    // Try to open file for reading using openat
    mov     x0, AT_FDCWD
    ldr     x1, =high_score_file
    mov     x2, O_RDONLY
    mov     x3, 0
    mov     x8, SYS_OPENAT
    svc     0
    
    // If file doesn't exist (negative fd), set file_exists flag to false
    cmp     x0, 0
    b.lt    set_no_file_flag
    
    // Read high score data as text (up to 128 bytes)
    mov     x19, x0
    ldr     x1, =high_score_buffer
    mov     x2, 128
    mov     x8, SYS_READ
    svc     0
    
    // Store bytes read
    mov     x20, x0
    
    // Close file
    mov     x0, x19
    mov     x8, SYS_CLOSE
    svc     0
    
    // Check if we read some data
    cmp     x20, 0
    b.le    set_no_file_flag
    
    // Parse the multi-level high score format
    bl      parse_multilevel_scores
    
    // Set file exists flag to true
    ldr     x0, =file_exists
    mov     w1, 1
    str     w1, [x0]
    b       load_high_scores_done


set_no_file_flag:
    // Mark that no high score file exists yet
    ldr     x0, =file_exists
    str     wzr, [x0]
    
    // Initialize all level high scores to 0
    ldr     x0, =high_score_level1
    str     wzr, [x0]
    ldr     x0, =high_score_level2
    str     wzr, [x0]
    ldr     x0, =high_score_level3
    str     wzr, [x0]
    ldr     x0, =high_score_level4
    str     wzr, [x0]
    ldr     x0, =high_score_level5
    str     wzr, [x0]
    ldr     x0, =high_score_level6
    str     wzr, [x0]

load_high_scores_done:
    ldp     fp, lr, [sp], 16
    ret

// Build multi-level file format in high_score_buffer
// Format: "LEVEL1:123\nLEVEL2:456\nLEVEL3:789\n"
// Returns total length in x0
build_multilevel_file_format:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]    // Preserve x19, x20
    stp     x21, x22, [sp, 32]    // Preserve x21, x22
    stp     x23, x24, [sp, 48]    // Preserve x23, x24
    
    // Load all scores into preserved registers first
    ldr     x0, =high_score_level1
    ldr     w21, [x0]              // w21 = Level 1 score
    ldr     x0, =high_score_level2
    ldr     w22, [x0]              // w22 = Level 2 score
    ldr     x0, =high_score_level3
    ldr     w23, [x0]              // w23 = Level 3 score
    ldr     x0, =high_score_level4
    ldr     w24, [x0]              // w24 = Level 4 score
    
    ldr     x19, =high_score_buffer  // Current write position
    mov     x20, 0                 // Total length counter
    
    // Add LEVEL1: label
    ldr     x0, =level1_label
    mov     w1, level1_label_len
    bl      copy_string_to_buffer
    
    // Add Level 1 score - use maximum of current and backup
    mov     w0, w21               // w0 = current Level 1 score
    ldr     x25, =level1_backup
    ldr     w25, [x25]            // w25 = backup Level 1 score
    cmp     w0, w25
    csel    w0, w25, w0, lt       // w0 = max(current, backup)
    ldr     x1, =speed_buffer
    bl      int_to_string
    mov     w1, w0
    ldr     x0, =speed_buffer
    bl      copy_string_to_buffer

    // Add newline
    mov     w0, 10
    strb    w0, [x19], 1
    add     x20, x20, 1

    // Add LEVEL2: label
    ldr     x0, =level2_label
    mov     w1, level2_label_len
    bl      copy_string_to_buffer

    // Add Level 2 score - use maximum of current and backup
    mov     w0, w22               // w0 = current Level 2 score
    ldr     x25, =level2_backup
    ldr     w25, [x25]            // w25 = backup Level 2 score
    cmp     w0, w25
    csel    w0, w25, w0, lt       // w0 = max(current, backup)
    ldr     x1, =speed_buffer
    bl      int_to_string
    mov     w1, w0
    ldr     x0, =speed_buffer
    bl      copy_string_to_buffer

    // Add newline
    mov     w0, 10
    strb    w0, [x19], 1
    add     x20, x20, 1

    // Add LEVEL3: label
    ldr     x0, =level3_label
    mov     w1, level3_label_len
    bl      copy_string_to_buffer

    // Add Level 3 score - use maximum of current and backup
    mov     w0, w23               // w0 = current Level 3 score
    ldr     x25, =level3_backup
    ldr     w25, [x25]            // w25 = backup Level 3 score
    cmp     w0, w25
    csel    w0, w25, w0, lt       // w0 = max(current, backup)
    ldr     x1, =speed_buffer
    bl      int_to_string
    mov     w1, w0
    ldr     x0, =speed_buffer
    bl      copy_string_to_buffer

    // Add newline
    mov     w0, 10
    strb    w0, [x19], 1
    add     x20, x20, 1

    // Add LEVEL4: label
    ldr     x0, =level4_label
    mov     w1, level4_label_len
    bl      copy_string_to_buffer

    // Add Level 4 score - use maximum of current and backup
    mov     w0, w24               // w0 = current Level 4 score
    ldr     x25, =level4_backup
    ldr     w25, [x25]            // w25 = backup Level 4 score
    cmp     w0, w25
    csel    w0, w25, w0, lt       // w0 = max(current, backup)
    ldr     x1, =speed_buffer
    bl      int_to_string
    mov     w1, w0
    ldr     x0, =speed_buffer
    bl      copy_string_to_buffer

    // Add newline
    mov     w0, 10
    strb    w0, [x19], 1
    add     x20, x20, 1

    // Add LEVEL5: label and score (loaded fresh; the preserved
    // register set ran out at four levels)
    ldr     x0, =level5_label
    mov     w1, level5_label_len
    bl      copy_string_to_buffer

    ldr     x0, =high_score_level5
    ldr     w0, [x0]
    ldr     x25, =level5_backup
    ldr     w25, [x25]
    cmp     w0, w25
    csel    w0, w25, w0, lt
    ldr     x1, =speed_buffer
    bl      int_to_string
    mov     w1, w0
    ldr     x0, =speed_buffer
    bl      copy_string_to_buffer

    mov     w0, 10
    strb    w0, [x19], 1
    add     x20, x20, 1

    // Add LEVEL6: label and score
    ldr     x0, =level6_label
    mov     w1, level6_label_len
    bl      copy_string_to_buffer

    ldr     x0, =high_score_level6
    ldr     w0, [x0]
    ldr     x25, =level6_backup
    ldr     w25, [x25]
    cmp     w0, w25
    csel    w0, w25, w0, lt
    ldr     x1, =speed_buffer
    bl      int_to_string
    mov     w1, w0
    ldr     x0, =speed_buffer
    bl      copy_string_to_buffer

    // Add final newline
    mov     w0, 10
    strb    w0, [x19], 1
    add     x20, x20, 1

    // Null terminate
    strb    wzr, [x19]
    
    // Return length in x0
    mov     x0, x20
    
    ldp     x19, x20, [sp, 16]    // Restore x19, x20
    ldp     x21, x22, [sp, 32]    // Restore x21, x22
    ldp     x23, x24, [sp, 48]    // Restore x23, x24
    ldp     fp, lr, [sp], 64
    ret

// Copy string from x0 to buffer at x19, length w1
// Updates x19 and x20 (total length counter)
copy_string_to_buffer:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    mov     w2, 0  // Counter
    
copy_loop:
    cmp     w2, w1
    b.ge    copy_done
    
    ldrb    w3, [x0, x2]
    strb    w3, [x19], 1
    add     w2, w2, 1
    add     x20, x20, 1
    b       copy_loop

copy_done:
    ldp     fp, lr, [sp], 16
    ret

// Find string in buffer
// x19 = buffer, x1 = string to find, w2 = string length
// Returns x0 = pointer to found string or 0 if not found
find_string_in_buffer:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    mov     x3, x19  // Current search position
    
find_loop:
    ldrb    w4, [x3]
    cbz     w4, find_not_found  // End of buffer
    
    // Compare string at current position
    mov     x5, x3   // Position to compare
    mov     x6, x1   // String to find
    mov     w7, 0   // Counter
    
find_compare_loop:
    cmp     w7, w2
    b.ge    find_found  // Found complete match
    
    ldrb    w8, [x5, x7]
    ldrb    w9, [x6, x7]
    cmp     w8, w9
    b.ne    find_next_char
    
    add     w7, w7, 1
    b       find_compare_loop
    
find_next_char:
    add     x3, x3, 1
    b       find_loop
    
find_found:
    mov     x0, x3  // Return pointer to found string
    b       find_done
    
find_not_found:
    mov     x0, 0  // Return null
    
find_done:
    ldp     fp, lr, [sp], 16
    ret

// Preserve all level values from existing file
preserve_all_levels_from_file:
    stp     fp, lr, [sp, -32]!
    mov     fp, sp
    stp     x19, x20, [sp, 16]

    // Initialize all backups to 0
    ldr     x0, =level1_backup
    str     wzr, [x0]
    ldr     x0, =level2_backup
    str     wzr, [x0]
    ldr     x0, =level3_backup
    str     wzr, [x0]
    ldr     x0, =level4_backup
    str     wzr, [x0]
    ldr     x0, =level5_backup
    str     wzr, [x0]
    ldr     x0, =level6_backup
    str     wzr, [x0]

    // Try to read the current file
    mov     x0, AT_FDCWD
    ldr     x1, =high_score_file
    mov     x2, 0  // O_RDONLY
    mov     x8, SYS_OPENAT
    svc     0

    // Check if file opened successfully
    cmp     x0, 0
    b.lt    preserve_all_done  // File doesn't exist, nothing to preserve

    mov     x19, x0  // Save file descriptor

    // Read file content
    mov     x0, x19
    ldr     x1, =high_score_buffer
    mov     x2, 128
    mov     x8, SYS_READ
    svc     0

    // Close file
    mov     x0, x19
    mov     x8, SYS_CLOSE
    svc     0

    // Extract Level 1 from file
    ldr     x19, =high_score_buffer
    ldr     x1, =level1_label
    mov     w2, level1_label_len
    bl      find_string_in_buffer
    cmp     x0, 0
    b.eq    preserve_level2
    add     x19, x0, level1_label_len
    bl      parse_number_from_position
    ldr     x1, =level1_backup
    str     w0, [x1]

preserve_level2:
    // Extract Level 2 from file
    ldr     x19, =high_score_buffer
    ldr     x1, =level2_label
    mov     w2, level2_label_len
    bl      find_string_in_buffer
    cmp     x0, 0
    b.eq    preserve_level3
    add     x19, x0, level2_label_len
    bl      parse_number_from_position
    ldr     x1, =level2_backup
    str     w0, [x1]

preserve_level3:
    // Extract Level 3 from file
    ldr     x19, =high_score_buffer
    ldr     x1, =level3_label
    mov     w2, level3_label_len
    bl      find_string_in_buffer
    cmp     x0, 0
    b.eq    preserve_level4
    add     x19, x0, level3_label_len
    bl      parse_number_from_position
    ldr     x1, =level3_backup
    str     w0, [x1]

preserve_level4:
    // Extract Level 4 from file
    ldr     x19, =high_score_buffer
    ldr     x1, =level4_label
    mov     w2, level4_label_len
    bl      find_string_in_buffer
    cmp     x0, 0
    b.eq    preserve_level5
    add     x19, x0, level4_label_len
    bl      parse_number_from_position
    ldr     x1, =level4_backup
    str     w0, [x1]

preserve_level5:
    // Extract Level 5 from file
    ldr     x19, =high_score_buffer
    ldr     x1, =level5_label
    mov     w2, level5_label_len
    bl      find_string_in_buffer
    cmp     x0, 0
    b.eq    preserve_level6
    add     x19, x0, level5_label_len
    bl      parse_number_from_position
    ldr     x1, =level5_backup
    str     w0, [x1]

preserve_level6:
    // Extract Level 6 from file
    ldr     x19, =high_score_buffer
    ldr     x1, =level6_label
    mov     w2, level6_label_len
    bl      find_string_in_buffer
    cmp     x0, 0
    b.eq    preserve_all_done
    add     x19, x0, level6_label_len
    bl      parse_number_from_position
    ldr     x1, =level6_backup
    str     w0, [x1]

preserve_all_done:
    ldp     x19, x20, [sp, 16]
    ldp     fp, lr, [sp], 32
    ret

// Save high scores to file
save_high_scores:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    bl      preserve_all_levels_from_file
    
    // Build the multi-level file format in the buffer
    bl      build_multilevel_file_format
    
    // x0 now contains the total length of the formatted data
    mov     x20, x0  // Store length in x20 for later use
    
    // Debug: show what filename we're trying to create (commented out)
    // mov     x0, #STDOUT_FILENO
    // adr     x1, debug_filename_text
    // mov     x2, debug_filename_text_len
    // mov     x8, #SYS_WRITE
    // svc     #0

    // Show the actual filename string
    // mov     x0, #STDOUT_FILENO
    // adr     x1, high_score_file
    // mov     x2, #8
    // mov     x8, #SYS_WRITE
    // svc     #0
    
    // Print newline
    // mov     x0, #STDOUT_FILENO
    // adr     x1, newline
    // mov     x2, #1
    // mov     x8, #SYS_WRITE
    // svc     #0
    
    // Try multiple file creation approaches
    // Use openat system call
    // openat(dirfd, pathname, flags, mode)
    mov     x0, AT_FDCWD
    ldr     x1, =high_score_file
    mov     x2, 577
    mov     x3, 420
    mov     x8, SYS_OPENAT
    svc     0
    
file_open_success:
    
    // Debug: show file descriptor result
    mov     x19, x0
    // mov     x0, #STDOUT_FILENO
    // adr     x1, debug_fd_text
    // mov     x2, debug_fd_text_len
    // mov     x8, #SYS_WRITE
    // svc     #0
    
    // Convert fd to string and display
    // mov     w0, w19
    // adr     x1, score_buffer
    // bl      int_to_string
    // mov     x0, #STDOUT_FILENO
    // adr     x1, score_buffer
    // mov     x2, #10
    // mov     x8, #SYS_WRITE
    // svc     #0
    
    // Print newline
    // mov     x0, #STDOUT_FILENO
    // adr     x1, newline
    // mov     x2, #1
    // mov     x8, #SYS_WRITE
    // svc     #0
    
    // Check for errors
    mov     x0, x19
    cmp     x0, 0
    b.lt    save_high_scores_error
    
    // Write high score data as text
    mov     x0, x19
    ldr     x1, =high_score_buffer
    mov     x2, x20
    mov     x8, SYS_WRITE
    svc     0
    
    // Close file
    mov     x0, x19
    mov     x8, SYS_CLOSE
    svc     0
    
    // Check write result
    cmp     x0, 0
    b.lt    save_high_scores_error
    
    // Success message (commented out for clean gameplay)
    // mov     x0, #STDOUT_FILENO
    // adr     x1, save_success_text
    // mov     x2, save_success_text_len
    // mov     x8, #SYS_WRITE
    // svc     #0
    
    b       save_high_scores_done

save_high_scores_error:
    // Try alternative path in /tmp directory
    ldr     x0, =high_score_file_tmp
    mov     x1, O_WRONLY
    orr     x1, x1, O_CREAT
    orr     x1, x1, O_TRUNC
    mov     x2, 420
    mov     x8, SYS_OPENAT
    svc     0
    
    // Check if /tmp path worked
    cmp     x0, 0
    b.lt    save_high_scores_final_error
    
    // Write to /tmp file
    mov     x19, x0
    ldr     x1, =high_score_buffer
    mov     x2, x20
    mov     x8, SYS_WRITE
    svc     0
    
    // Close /tmp file
    mov     x0, x19
    mov     x8, SYS_CLOSE
    svc     0
    
    // Success with alternative path
    mov     x0, STDOUT_FILENO
    ldr     x1, =save_tmp_success_text
    mov     x2, save_tmp_success_text_len
    mov     x8, SYS_WRITE
    svc     0
    b       save_high_scores_done

save_high_scores_final_error:
    // Final error message
    mov     x0, STDOUT_FILENO
    ldr     x1, =save_error_text
    mov     x2, save_error_text_len
    mov     x8, SYS_WRITE
    svc     0

save_high_scores_done:
    ldp     fp, lr, [sp], 16
    ret

// Check for new records and update high scores (level-specific)
check_and_update_records:
    stp     fp, lr, [sp, -64]!
    mov     fp, sp
    stp     x22, x23, [sp, 16]
    stp     x24, x25, [sp, 32]
    stp     x26, x27, [sp, 48]

    // Save all high scores before any operations
    ldr     x0, =high_score_level1
    ldr     w22, [x0]  // Save Level 1
    ldr     x0, =high_score_level2
    ldr     w23, [x0]  // Save Level 2
    // Also save Level 2 to backup location
    ldr     x0, =level2_backup
    str     w23, [x0]  // Store Level 2 in backup
    ldr     x0, =high_score_level3
    ldr     w24, [x0]  // Save Level 3
    ldr     x0, =high_score_level4
    ldr     w25, [x0]  // Save Level 4
    ldr     x0, =high_score_level5
    ldr     w26, [x0]  // Save Level 5
    ldr     x0, =high_score_level6
    ldr     w27, [x0]  // Save Level 6

    // Get current score
    ldr     x0, =score
    ldr     w19, [x0]  // w19 = current score

    // Get current level and determine which high score to check
    ldr     x0, =current_level
    ldr     w0, [x0]

    // Get appropriate level high score address
    cmp     w0, LEVEL_NORMAL
    b.eq    check_level1_record
    cmp     w0, LEVEL_NO_WALLS
    b.eq    check_level2_record
    cmp     w0, LEVEL_SUPER_FAST
    b.eq    check_level3_record
    cmp     w0, LEVEL_OBSTACLES
    b.eq    check_level4_record
    cmp     w0, LEVEL_HYPER
    b.eq    check_level5_record
    cmp     w0, LEVEL_MINEFIELD
    b.eq    check_level6_record
    b       check_records_done  // Unknown level, skip

check_level1_record:
    ldr     x20, =high_score_level1
    b       compare_and_update

check_level2_record:
    ldr     x20, =high_score_level2
    b       compare_and_update

check_level3_record:
    ldr     x20, =high_score_level3
    b       compare_and_update

check_level4_record:
    ldr     x20, =high_score_level4
    b       compare_and_update

check_level5_record:
    ldr     x20, =high_score_level5
    b       compare_and_update

check_level6_record:
    ldr     x20, =high_score_level6
    b       compare_and_update

compare_and_update:
    // Compare current score with level-specific high score
    ldr     w21, [x20]  // w21 = current high score for this level
    cmp     w19, w21
    b.le    check_records_done
    
    // NEW HIGH SCORE for this level!
    str     w19, [x20]
    bl      save_high_scores
    
    // Only show message if file existed (had previous scores to beat)
    ldr     x0, =file_exists
    ldr     w0, [x0]
    cmp     w0, 1
    b.ne    check_records_done

    // ADDITIONAL CHECK: Verify against backup values from file to prevent
    // showing NEW RECORD when memory was corrupted
    ldr     x0, =current_level
    ldr     w0, [x0]

    cmp     w0, LEVEL_NORMAL
    b.eq    verify_backup_level1
    cmp     w0, LEVEL_NO_WALLS
    b.eq    verify_backup_level2
    cmp     w0, LEVEL_SUPER_FAST
    b.eq    verify_backup_level3
    cmp     w0, LEVEL_OBSTACLES
    b.eq    verify_backup_level4
    cmp     w0, LEVEL_HYPER
    b.eq    verify_backup_level5
    cmp     w0, LEVEL_MINEFIELD
    b.eq    verify_backup_level6
    b       check_records_done  // Unknown level, skip message

verify_backup_level1:
    ldr     x0, =level1_backup
    b       do_backup_verify
verify_backup_level2:
    ldr     x0, =level2_backup
    b       do_backup_verify
verify_backup_level3:
    ldr     x0, =level3_backup
    b       do_backup_verify
verify_backup_level4:
    ldr     x0, =level4_backup
    b       do_backup_verify
verify_backup_level5:
    ldr     x0, =level5_backup
    b       do_backup_verify
verify_backup_level6:
    ldr     x0, =level6_backup
    b       do_backup_verify

do_backup_verify:
    ldr     w0, [x0]            // w0 = backup value from file
    cmp     w19, w0             // Compare current score with backup
    b.le    check_records_done  // If not greater than backup, don't show message

    // Show NEW RECORD message
    mov     x0, STDOUT_FILENO
    ldr     x1, =new_record_text
    mov     x2, new_record_text_len
    mov     x8, SYS_WRITE
    svc     0

    bl      play_new_record_sound

check_records_done:
    // Only restore scores that weren't supposed to be updated
    ldr     x0, =current_level
    ldr     w0, [x0]
    
    // If we're not in Level 1, restore Level 1
    cmp     w0, LEVEL_NORMAL
    b.eq    skip_level1_restore
    ldr     x1, =high_score_level1
    str     w22, [x1]
skip_level1_restore:
    
    // If we're not in Level 2, restore Level 2
    cmp     w0, LEVEL_NO_WALLS
    b.eq    skip_level2_restore
    ldr     x1, =high_score_level2
    str     w23, [x1]
skip_level2_restore:
    
    // If we're not in Level 3, restore Level 3
    cmp     w0, LEVEL_SUPER_FAST
    b.eq    skip_level3_restore
    ldr     x1, =high_score_level3
    str     w24, [x1]
skip_level3_restore:

    // If we're not in Level 4, restore Level 4
    cmp     w0, LEVEL_OBSTACLES
    b.eq    skip_level4_restore
    ldr     x1, =high_score_level4
    str     w25, [x1]
skip_level4_restore:

    // If we're not in Level 5, restore Level 5
    cmp     w0, LEVEL_HYPER
    b.eq    skip_level5_restore
    ldr     x1, =high_score_level5
    str     w26, [x1]
skip_level5_restore:

    // If we're not in Level 6, restore Level 6
    cmp     w0, LEVEL_MINEFIELD
    b.eq    skip_level6_restore
    ldr     x1, =high_score_level6
    str     w27, [x1]
skip_level6_restore:

    ldp     x22, x23, [sp, 16]
    ldp     x24, x25, [sp, 32]
    ldp     x26, x27, [sp, 48]
    ldp     fp, lr, [sp], 64
    ret

// Sound effects functions
play_food_sound:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    // Try terminal bell first
    mov     x0, STDOUT_FILENO
    ldr     x1, =bell_sound
    mov     x2, 1
    mov     x8, SYS_WRITE
    svc     0
    
    ldp     fp, lr, [sp], 16
    ret

// // Next function
//     mov     x0, #STDOUT_FILENO
//     adr     x1, score_buffer
//     mov     x2, #10
//     mov     x8, #SYS_WRITE
//     svc     #0
    
//     mov     x0, #STDOUT_FILENO
//     adr     x1, debug_vs_high
//     mov     x2, debug_vs_high_len
//     mov     x8, #SYS_WRITE
//     svc     #0
    
//     mov     w0, w23
//     adr     x1, food_buffer
//     bl      int_to_string
//     mov     x0, #STDOUT_FILENO
//     adr     x1, food_buffer
//     mov     x2, #10
//     mov     x8, #SYS_WRITE
//     svc     #0
    
//     mov     x0, #STDOUT_FILENO
//     adr     x1, newline
//     mov     x2, #1
//     mov     x8, #SYS_WRITE
//     svc     #0
    
//     // Restore values and do comparison
//     cmp     w22, w23
//     b.le    check_food_record
    
//     // New high score
//     str     w22, [x21]
//     mov     w19, #1
    
// check_food_record:
//     // Check food count record
//     adr     x0, food_count
//     adr     x1, high_food_count
//     ldr     w2, [x0]
//     ldr     w3, [x1]
//     cmp     w2, w3
//     b.le    check_time_record
    
//     // New high food count
//     str     w2, [x1]
//     mov     w19, #1
    
// check_time_record:
//     // Check time record
//     bl      calculate_elapsed_time
//     adr     x0, elapsed_seconds
//     adr     x1, longest_time
//     ldr     w2, [x0]
//     ldr     w3, [x1]
//     cmp     w2, w3
//     b.le    save_records
    
//     // New time record
//     str     w2, [x1]
//     mov     w19, #1
    
// save_records:
//     // Debug: show what w19 is
//     mov     x0, #STDOUT_FILENO
//     adr     x1, debug_w19_text
//     mov     x2, debug_w19_text_len
//     mov     x8, #SYS_WRITE
//     svc     #0
    
//     mov     w0, w19
//     adr     x1, time_buffer
//     bl      int_to_string
//     mov     x0, #STDOUT_FILENO
//     adr     x1, time_buffer
//     mov     x2, #10
//     mov     x8, #SYS_WRITE
//     svc     #0
    
//     mov     x0, #STDOUT_FILENO
//     adr     x1, newline
//     mov     x2, #1
//     mov     x8, #SYS_WRITE
//     svc     #0
    
//     // If any new record, save and maybe display message
//     cmp     w19, #1
//     b.ne    check_records_done
    
//     // We have a new record - save it
//     mov     x0, #STDOUT_FILENO
//     adr     x1, debug_saving_text
//     mov     x2, debug_saving_text_len
//     mov     x8, #SYS_WRITE
//     svc     #0
    
//     bl      save_high_scores
    
//     // Only display "NEW RECORD" if file existed before (had previous scores to beat)
//     adr     x0, file_exists
//     ldr     w0, [x0]
//     cmp     w0, #1
//     b.ne    check_records_done
    
//     // Display NEW RECORD message
//     mov     x0, #STDOUT_FILENO
//     adr     x1, new_record_text
//     mov     x2, new_record_text_len
//     mov     x8, #SYS_WRITE
//     svc     #0
    
//     bl      play_new_record_sound
    
//     // Try terminal bell first
//     mov     x0, #STDOUT_FILENO
//     adr     x1, bell_sound
//     mov     x2, #1
//     mov     x8, #SYS_WRITE
//     svc     #0
    
//     // Force flush output
//     mov     x0, #STDOUT_FILENO
//     mov     x1, #0
//     mov     x8, #74
//     svc     #0
    
//     ldp     fp, lr, [sp], #16
//     ret

play_golden_food_sound:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    // Play two bells for golden food
    bl      play_food_sound
    bl      play_food_sound
    
    ldp     fp, lr, [sp], 16
    ret

play_new_record_sound:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    // Play three bells for new record
    bl      play_food_sound
    bl      play_food_sound  
    bl      play_food_sound
    
    ldp     fp, lr, [sp], 16
    ret

play_game_over_sound:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    // Play game over sound
    bl      play_food_sound
    
    ldp     fp, lr, [sp], 16
    ret

// Game sleep function with progressive speed
game_sleep:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    // Check if slow-mo powerup is active
    ldr     x0, =powerup_active
    ldr     w0, [x0]
    cbnz    w0, slowmo_speed

    // Check current level for speed adjustment
    ldr     x0, =current_level
    ldr     w0, [x0]
    cmp     w0, LEVEL_SUPER_FAST
    b.eq    super_fast_speed
    cmp     w0, LEVEL_HYPER
    b.eq    hyper_speed

    // Normal speed calculation for Level 1, 2, 4
    // Base speed: 200ms, reduce by 5ms per segment, minimum 80ms
    ldr     x0, =snake_length
    ldr     w1, [x0]

    // Calculate: max(80ms, 200ms - (length-3)*5ms)
    sub     w1, w1, INITIAL_SNAKE_LENGTH
    mov     w2, 5
    mul     w1, w1, w2

    mov     w3, 200
    subs    w3, w3, w1
    mov     w4, 80
    cmp     w3, w4
    csel    w3, w4, w3, lt
    b       apply_sleep_time

slowmo_speed:
    // Slow-mo powerup active: use SLOWMO_SPEED (400ms)
    mov     w3, SLOWMO_SPEED
    b       apply_sleep_time

super_fast_speed:
    // Level 3: Super fast - much shorter sleep times
    // Base speed: 60ms, reduce by 2ms per segment, minimum 30ms
    ldr     x0, =snake_length
    ldr     w1, [x0]

    sub     w1, w1, INITIAL_SNAKE_LENGTH
    mov     w2, 2
    mul     w1, w1, w2

    mov     w3, 60
    subs    w3, w3, w1
    mov     w4, 30
    cmp     w3, w4
    csel    w3, w4, w3, lt
    b       apply_sleep_time

hyper_speed:
    // Level 5: starts leisurely and accelerates with every meal, not
    // with length: max(50ms, 250ms - food*10ms). Around the twentieth
    // bite it is faster than SPEED ever gets.
    ldr     x0, =food_count
    ldr     w1, [x0]
    mov     w2, 10
    mul     w1, w1, w2

    mov     w3, 250
    subs    w3, w3, w1
    mov     w4, 50
    cmp     w3, w4
    csel    w3, w4, w3, lt

apply_sleep_time:
    
    // Convert milliseconds to nanoseconds
    movz    w4, 0x86A0, lsl 0
    movk    w4, 0xF, lsl 16
    mul     w3, w3, w4
    
    // Store in sleep_time structure
    ldr     x0, =sleep_time
    str     xzr, [x0]
    str     w3, [x0, 8]
    
    mov     x1, 0
    mov     x8, SYS_NANOSLEEP
    svc     0
    
    ldp     fp, lr, [sp], 16
    ret

// Parse score from text buffer
// Input: x0 = buffer address
// Output: Stores parsed score in high_score
parse_score_from_text:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    mov     x1, x0
    mov     w2, 0
    mov     w3, 10
    
parse_loop:
    ldrb    w4, [x1], 1
    
    // Check for end of string or newline
    cbz     w4, parse_done
    cmp     w4, 10
    b.eq    parse_done
    cmp     w4, 32
    b.eq    parse_done
    
    // Check if character is digit (0-9)
    sub     w4, w4, 48
    cmp     w4, 0
    b.lt    parse_loop
    cmp     w4, 9
    b.gt    parse_loop
    
    // Check for potential overflow before adding digit
    movz    w5, 0xC9FF
    movk    w5, 0x3B9A, lsl 16
    udiv    w6, w5, w3      // w6 = MAX_SCORE / 10 (max safe value before multiply)
    cmp     w2, w6
    b.gt    clamp_to_max    // If current > max_safe, clamp to max
    
    // Safe to multiply by 10
    mul     w2, w2, w3
    sub     w6, w5, w2      // w6 = MAX_SCORE - (current * 10)  
    cmp     w4, w6          // Compare digit with remaining capacity
    b.le    safe_digit_add  // If digit <= remaining, safe to add
    
clamp_to_max:
    movz    w2, 0xC9FF
    movk    w2, 0x3B9A, lsl 16
    b       parse_loop
    
safe_digit_add:
    add     w2, w2, w4
    b       parse_loop
    
parse_done:
    // Ensure final result doesn't exceed MAX_SCORE
    movz    w5, 0xC9FF
    movk    w5, 0x3B9A, lsl 16
    cmp     w2, w5
    csel    w2, w2, w5, le  // w2 = min(w2, MAX_SCORE)
    
    // Store result in high_score
    ldr     x0, =high_score_level1
    str     w2, [x0]
    
    ldp     fp, lr, [sp], 16
    ret

// Parse multi-level score format from buffer
// Format: "LEVEL1:123\nLEVEL2:456\nLEVEL3:789\n"
parse_multilevel_scores:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    // Initialize all scores to 0
    ldr     x0, =high_score_level1
    str     wzr, [x0]
    ldr     x0, =high_score_level2
    str     wzr, [x0]
    ldr     x0, =high_score_level3
    str     wzr, [x0]
    ldr     x0, =high_score_level4
    str     wzr, [x0]
    ldr     x0, =high_score_level5
    str     wzr, [x0]
    ldr     x0, =high_score_level6
    str     wzr, [x0]

    // Parse each level entry
    ldr     x19, =high_score_buffer  // x19 = current position in buffer
    
parse_next_level:
    // Check for end of buffer
    ldrb    w0, [x19]
    cbz     w0, parse_multilevel_done
    
    // Check for LEVEL1:
    ldr     x1, =level1_label
    mov     w2, level1_label_len
    bl      compare_string
    cmp     x0, 1
    b.eq    parse_level1_score
    
    // Check for LEVEL2:
    ldr     x1, =level2_label
    mov     w2, level2_label_len
    bl      compare_string
    cmp     x0, 1
    b.eq    parse_level2_score
    
    // Check for LEVEL3:
    ldr     x1, =level3_label
    mov     w2, level3_label_len
    bl      compare_string
    cmp     x0, 1
    b.eq    parse_level3_score

    // Check for LEVEL4:
    ldr     x1, =level4_label
    mov     w2, level4_label_len
    bl      compare_string
    cmp     x0, 1
    b.eq    parse_level4_score

    // Check for LEVEL5:
    ldr     x1, =level5_label
    mov     w2, level5_label_len
    bl      compare_string
    cmp     x0, 1
    b.eq    parse_level5_score

    // Check for LEVEL6:
    ldr     x1, =level6_label
    mov     w2, level6_label_len
    bl      compare_string
    cmp     x0, 1
    b.eq    parse_level6_score

    // Skip to next line if no match
    bl      skip_to_next_line
    b       parse_next_level

parse_level1_score:
    add     x19, x19, level1_label_len
    bl      parse_number_from_position
    ldr     x1, =high_score_level1
    str     w0, [x1]
    // parse_number_from_position already advances past newline, don't skip again
    b       parse_next_level

parse_level2_score:
    add     x19, x19, level2_label_len
    bl      parse_number_from_position
    ldr     x1, =high_score_level2
    str     w0, [x1]
    b       parse_next_level

parse_level3_score:
    add     x19, x19, level3_label_len
    bl      parse_number_from_position
    ldr     x1, =high_score_level3
    str     w0, [x1]
    b       parse_next_level

parse_level4_score:
    add     x19, x19, level4_label_len
    bl      parse_number_from_position
    ldr     x1, =high_score_level4
    str     w0, [x1]
    b       parse_next_level

parse_level5_score:
    add     x19, x19, level5_label_len
    bl      parse_number_from_position
    ldr     x1, =high_score_level5
    str     w0, [x1]
    b       parse_next_level

parse_level6_score:
    add     x19, x19, level6_label_len
    bl      parse_number_from_position
    ldr     x1, =high_score_level6
    str     w0, [x1]
    b       parse_next_level

parse_multilevel_done:
    ldp     fp, lr, [sp], 16
    ret

// Compare string at x19 with string at x1 (length w2)
// Returns 1 in x0 if match, 0 if no match
compare_string:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    mov     x3, x19  // Current buffer position
    mov     x4, 0   // Counter
    
compare_loop:
    cmp     w4, w2
    b.ge    compare_match
    
    ldrb    w5, [x3, x4]
    ldrb    w6, [x1, x4]
    cmp     w5, w6
    b.ne    compare_no_match
    
    add     w4, w4, 1
    b       compare_loop

compare_match:
    mov     x0, 1
    b       compare_done

compare_no_match:
    mov     x0, 0

compare_done:
    ldp     fp, lr, [sp], 16
    ret

// Parse number from current position x19
// Returns number in w0
parse_number_from_position:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
    mov     w0, 0
    mov     w1, 10
    
parse_number_loop:
    ldrb    w2, [x19], 1
    
    // Check for end of number (newline, space, null)
    cbz     w2, parse_number_done
    cmp     w2, 10
    b.eq    parse_number_done
    cmp     w2, 32
    b.eq    parse_number_done
    
    // Check if digit
    sub     w2, w2, 48  // Convert ASCII to digit
    cmp     w2, 0
    b.lt    parse_number_done
    cmp     w2, 9
    b.gt    parse_number_done
    
    mul     w0, w0, w1
    add     w0, w0, w2
    b       parse_number_loop

parse_number_done:
    ldp     fp, lr, [sp], 16
    ret

// Skip to next line from current position x19
skip_to_next_line:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp
    
skip_loop:
    ldrb    w0, [x19], 1
    cbz     w0, skip_done
    cmp     w0, 10
    b.eq    skip_done
    b       skip_loop

skip_done:
    ldp     fp, lr, [sp], 16
    ret

.data
.align 3

// Terminal settings
termios_orig:   .skip 60
termios_raw:    .skip 60

// Game state
game_grid:      .skip (GRID_WIDTH * GRID_HEIGHT)
snake_body:     .skip (MAX_SNAKE_LENGTH * 8)
snake_length:   .word INITIAL_SNAKE_LENGTH
snake_head_index: .word 0
snake_direction: .word DIR_RIGHT
food_position:  .skip 8
food_type:      .word 0
score:          .word 0
food_count:     .word 0
game_paused:    .word 0
quit_flag:      .word 0
current_level:  .word LEVEL_NORMAL

// Obstacle data: the six starting obstacles plus room for the walls
// maze mode adds as the game escalates, each an x,y pair
obstacle_positions: .skip ((NUM_OBSTACLES + MAX_EXTRA_OBSTACLES) * 8)
obstacle_count: .word 0

// Power-up data
powerup_position:   .skip 8
powerup_type:       .word 0
powerup_spawned:    .word 0
powerup_active:     .word 0
powerup_timer:      .word 0

// Lives system
lives_remaining:    .word INITIAL_LIVES
restart_requested:  .word 0

// Game statistics
game_start_time: .skip 16
current_time:   .skip 16
pause_start_time: .skip 16
total_paused_time: .word 0
elapsed_seconds: .word 0

// Combo streak and per-run records
combo_mult:     .word 1
last_eat_sec:   .word 0
best_combo:     .word 1
max_length:     .word INITIAL_SNAKE_LENGTH
gold_deadline:  .word 0
next_mine_sec:  .word 0

// High score data (level-specific)
high_score_level1: .word 0
high_score_level2: .word 0
high_score_level3: .word 0
high_score_level4: .word 0
high_score_level5: .word 0
high_score_level6: .word 0
high_food_count: .word 0
longest_time:   .word 0
file_exists:    .word 0
level1_backup:  .word 0   // Backup storage for Level 1 score
level2_backup:  .word 0   // Backup storage for Level 2 score
level3_backup:  .word 0   // Backup storage for Level 3 score
level4_backup:  .word 0   // Backup storage for Level 4 score
level5_backup:  .word 0   // Backup storage for Level 5 score
level6_backup:  .word 0   // Backup storage for Level 6 score

// Input/output buffers
input_buffer:   .skip 4
random_buffer:  .skip 2
score_buffer:   .skip 12
food_buffer:    .skip 12
time_buffer:    .skip 12
speed_buffer:   .skip 12
high_score_buffer: .skip 128

// High score file
high_score_file: .asciz "file.txt"
high_score_file_tmp: .asciz "/tmp/snake_high_score.txt"

// Level labels for file format
level1_label: .ascii "LEVEL1:"
level1_label_len = . - level1_label

level2_label: .ascii "LEVEL2:"
level2_label_len = . - level2_label

level3_label: .ascii "LEVEL3:"
level3_label_len = . - level3_label

level4_label: .ascii "LEVEL4:"
level4_label_len = . - level4_label
level5_label: .ascii "LEVEL5:"
level5_label_len = . - level5_label

level6_label: .ascii "LEVEL6:"
level6_label_len = . - level6_label

// Sleep timing
sleep_time:
    .dword 0
    .dword 200000000

// Animation data structures
anim_snake_x:      .word -4          // Snake head X position (-4 to 52)
anim_frame:        .word 0           // Frame counter for timing
anim_skipped:      .word 0           // Flag to skip animation

// Animation timing (60ms per frame)
anim_sleep_time:
    .dword 0
    .dword 60000000    // 60ms in nanoseconds

// Cursor positioning for animation
cursor_row_3: .ascii "\x1b[3;1H"
cursor_row_3_len = . - cursor_row_3

// Snake animated character (green body, yellow head)
snake_anim_head: .ascii "\x1b[93m@\x1b[0m"   // Yellow head
snake_anim_head_len = . - snake_anim_head

snake_anim_body: .ascii "\x1b[92mo\x1b[0m"   // Green body
snake_anim_body_len = . - snake_anim_body

// Color codes for animation glow effect
anim_color_white:  .ascii "\x1b[97m\x1b[1m"   // Bright white (glow)
anim_color_white_len = . - anim_color_white

anim_color_green:  .ascii "\x1b[92m\x1b[1m"   // Original green
anim_color_green_len = . - anim_color_green

anim_color_reset:  .ascii "\x1b[0m"
anim_color_reset_len = . - anim_color_reset

// Logo rows (raw, no color codes - we'll add colors dynamically)
logo_row_1: .ascii "    ███████ ███    ██  █████  ██   ██ ███████"
logo_row_1_len = . - logo_row_1

logo_row_2: .ascii "    ██      ████   ██ ██   ██ ██  ██  ██     "
logo_row_2_len = . - logo_row_2

logo_row_3: .ascii "    ███████ ██ ██  ██ ███████ █████   █████  "
logo_row_3_len = . - logo_row_3

logo_row_4: .ascii "         ██ ██  ██ ██ ██   ██ ██  ██  ██     "
logo_row_4_len = . - logo_row_4

logo_row_5: .ascii "    ███████ ██   ████ ██   ██ ██   ██ ███████"
logo_row_5_len = . - logo_row_5

// Subtitle (stays static)
logo_subtitle: .ascii "\n\x1b[93m           ~ Classic Arcade Game ~\x1b[0m\n\n"
logo_subtitle_len = . - logo_subtitle

// Newline for between rows
anim_newline: .ascii "\n"
anim_newline_len = . - anim_newline

// ANSI escape sequences
clear_screen_seq: .ascii "\x1b[2J"
clear_screen_seq_len = . - clear_screen_seq

hide_cursor_seq: .ascii "\x1b[?25l"
hide_cursor_seq_len = . - hide_cursor_seq

show_cursor_seq: .ascii "\x1b[?25h"
show_cursor_seq_len = . - show_cursor_seq

move_cursor_home: .ascii "\x1b[1;1H"
move_cursor_home_len = . - move_cursor_home

// Game display characters
snake_cell: .ascii "\x1b[42m \x1b[0m"
snake_cell_len = . - snake_cell

snake_cell_alt: .ascii "\x1b[102m \x1b[0m"
snake_cell_alt_len = . - snake_cell_alt

food_cell: .ascii "\x1b[41m*\x1b[0m"
food_cell_len = . - food_cell

golden_food_cell: .ascii "\x1b[43m*\x1b[0m"
golden_food_cell_len = . - golden_food_cell

// Snake head (bright green @ character)
snake_head_cell: .ascii "\x1b[92m@\x1b[0m"
snake_head_cell_len = . - snake_head_cell

// Obstacle cell (magenta #)
obstacle_cell: .ascii "\x1b[45m#\x1b[0m"
obstacle_cell_len = . - obstacle_cell

// Power-up cells
slowmo_cell: .ascii "\x1b[44m~\x1b[0m"
slowmo_cell_len = . - slowmo_cell

shrink_cell: .ascii "\x1b[45m-\x1b[0m"
shrink_cell_len = . - shrink_cell

// Death flash (red background)
flash_red: .ascii "\x1b[41m"
flash_red_len = . - flash_red

flash_reset: .ascii "\x1b[0m"
flash_reset_len = . - flash_reset

empty_cell: .ascii " "
vertical_border: .ascii "\x1b[90m│\x1b[0m"
vertical_border_len = . - vertical_border
horizontal_border: .ascii "─"
corner_char: .ascii "\x1b[90m┌"
corner_char_len = . - corner_char
corner_end: .ascii "┐\x1b[0m"
corner_end_len = . - corner_end
corner_bottom: .ascii "\x1b[90m└"
corner_bottom_len = . - corner_bottom
corner_bottom_end: .ascii "┘\x1b[0m"
corner_bottom_end_len = . - corner_bottom_end
vertical_border_newline: .ascii "\x1b[90m│\x1b[0m\n"
vertical_border_newline_len = . - vertical_border_newline
corner_newline: .ascii "┐\x1b[0m\n"
corner_newline_len = . - corner_newline
newline: .ascii "\n"

// Game text - Styled with ANSI colors
// Color codes: \x1b[92m=bright green, \x1b[93m=bright yellow, \x1b[96m=bright cyan
//              \x1b[91m=bright red, \x1b[95m=bright magenta, \x1b[1m=bold, \x1b[0m=reset

// Header bar for in-game display
header_bar: .ascii "\x1b[92m\x1b[1m SNAKE \x1b[0m\x1b[90m|\x1b[0m"
header_bar_len = . - header_bar

score_text: .ascii "\x1b[93m Score:\x1b[0m "
score_text_len = . - score_text

controls_text: .ascii "\x1b[90m WASD/Arrows=Move | SPACE=Pause | Q=Quit\x1b[0m\n"
controls_text_len = . - controls_text

game_over_text: .ascii "\n\x1b[91m\x1b[1m  ╔═══════════════════════════╗\n  ║       GAME OVER           ║\n  ╚═══════════════════════════╝\x1b[0m\n\n"
game_over_text_len = . - game_over_text

final_score_text: .ascii "\x1b[93m    Final Score: \x1b[0m\x1b[1m"
final_score_text_len = . - final_score_text

food_count_text: .ascii "\x1b[0m\n\x1b[96m    Food Eaten:  \x1b[0m"
food_count_text_len = . - food_count_text

stats_time_text: .ascii "\x1b[95m    Time Alive:  \x1b[0m"
stats_time_text_len = . - stats_time_text

stats_time_unit: .ascii "s\n"
stats_time_unit_len = . - stats_time_unit

stats_len_text: .ascii "\x1b[92m    Max Length:  \x1b[0m"
stats_len_text_len = . - stats_len_text

stats_combo_text: .ascii "\x1b[93m    Best Combo:  \x1b[0mx"
stats_combo_text_len = . - stats_combo_text

pause_text: .ascii "\n\x1b[93m\x1b[1m  ╔═══════════════════════════════════╗\n  ║  PAUSED - Press SPACE to resume  ║\n  ╚═══════════════════════════════════╝\x1b[0m\n"
pause_text_len = . - pause_text

level_display_text: .ascii " \x1b[90m|\x1b[0m\x1b[95m Level:\x1b[0m"
level_display_text_len = . - level_display_text

speed_text: .ascii " \x1b[90m|\x1b[0m\x1b[96m Speed:\x1b[0m"
speed_text_len = . - speed_text

time_text: .ascii " \x1b[90m|\x1b[0m\x1b[90m "
time_text_len = . - time_text

seconds_text: .ascii "s\x1b[0m"
seconds_text_len = . - seconds_text

lives_text: .ascii " \x1b[90m|\x1b[0m\x1b[91m ♥:\x1b[0m"
lives_text_len = . - lives_text

slowmo_prefix: .ascii " \x1b[44m\x1b[1m SLOW "
slowmo_prefix_len = . - slowmo_prefix

slowmo_suffix: .ascii "s \x1b[0m"

combo_prefix: .ascii " \x1b[93m\x1b[1mx"
combo_prefix_len = . - combo_prefix

combo_suffix: .ascii "\x1b[0m"
combo_suffix_len = . - combo_suffix
slowmo_suffix_len = . - slowmo_suffix

slowmo_timer_buffer: .skip 4  // Buffer for timer digits

restart_prompt: .ascii "\n\x1b[90m    [R] Restart  |  [Q] Menu\x1b[0m\n"
restart_prompt_len = . - restart_prompt

new_record_text: .ascii "\n\x1b[93m\x1b[5m  ★★★ NEW HIGH SCORE! ★★★\x1b[0m\n"
new_record_text_len = . - new_record_text

// Welcome screen ASCII art - clean version without box
welcome_title: .ascii "\n\n\x1b[92m\x1b[1m    ███████ ███    ██  █████  ██   ██ ███████\n    ██      ████   ██ ██   ██ ██  ██  ██     \n    ███████ ██ ██  ██ ███████ █████   █████  \n         ██ ██  ██ ██ ██   ██ ██  ██  ██     \n    ███████ ██   ████ ██   ██ ██   ██ ███████\x1b[0m\n\n\x1b[93m           ~ Classic Arcade Game ~\x1b[0m\n\n"
welcome_title_len = . - welcome_title

level_select_text: .ascii "\x1b[1m\x1b[96m    SELECT YOUR CHALLENGE:\x1b[0m\n\n"
level_select_text_len = . - level_select_text

level_1_text: .ascii "\x1b[92m CLASSIC \x1b[0m\x1b[90m- Traditional snake with walls\x1b[0m\n"
level_1_text_len = . - level_1_text

level_2_text: .ascii "\x1b[96m ENDLESS \x1b[0m\x1b[90m- Wrap around screen edges\x1b[0m\n"
level_2_text_len = . - level_2_text

level_3_text: .ascii "\x1b[93m SPEED   \x1b[0m\x1b[90m- Lightning fast challenge\x1b[0m\n"
level_3_text_len = . - level_3_text

level_4_text: .ascii "\x1b[95m MAZE    \x1b[0m\x1b[90m- Navigate around obstacles\x1b[0m\n"
level_4_text_len = . - level_4_text

level_5_text: .ascii "\x1b[91m HYPER   \x1b[0m\x1b[90m- Accelerates with every bite\x1b[0m\n"
level_5_text_len = . - level_5_text

level_6_text: .ascii "\x1b[94m MINES   \x1b[0m\x1b[90m- Wrapping field, growing minefield\x1b[0m\n"
level_6_text_len = . - level_6_text

quit_option_text: .ascii "\x1b[91m EXIT   \x1b[0m\x1b[90m- Quit to terminal\x1b[0m\n\n"
quit_option_text_len = . - quit_option_text

// High score display for menu
high_score_label: .ascii "\n\x1b[90m    ─────────────────────────────────\n\x1b[0m    \x1b[1m\x1b[93m★ HIGH SCORES ★\x1b[0m\n"
high_score_label_len = . - high_score_label

hs_classic_label: .ascii "    \x1b[92mClassic:\x1b[0m "
hs_classic_label_len = . - hs_classic_label

hs_endless_label: .ascii "  \x1b[96mEndless:\x1b[0m "
hs_endless_label_len = . - hs_endless_label

hs_speed_label: .ascii "\n    \x1b[93mSpeed:\x1b[0m   "
hs_speed_label_len = . - hs_speed_label

hs_maze_label: .ascii "  \x1b[95mMaze:\x1b[0m    "
hs_maze_label_len = . - hs_maze_label

hs_hyper_label: .ascii "\n    \x1b[91mHyper:\x1b[0m   "
hs_hyper_label_len = . - hs_hyper_label

hs_mines_label: .ascii "  \x1b[94mMines:\x1b[0m   "
hs_mines_label_len = . - hs_mines_label

hs_divider: .ascii "\n\x1b[90m    ─────────────────────────────────\x1b[0m\n\n"
hs_divider_len = . - hs_divider

level_select_prompt: .ascii "\x1b[90m    ↑/↓ or W/S to select, ENTER to start, Q to quit\x1b[0m\n"
level_select_prompt_len = . - level_select_prompt

// Cursor position to menu start (row 12, column 1) + clear to end of screen
cursor_to_menu: .ascii "\x1b[12;1H\x1b[J"
cursor_to_menu_len = . - cursor_to_menu

level_indicator: .ascii "  \x1b[97m\x1b[1m▶ \x1b[0m"
level_indicator_len = . - level_indicator

no_indicator: .ascii "    "
no_indicator_len = . - no_indicator

clear_line: .ascii "\x1b[2K\r"
clear_line_len = . - clear_line

save_success_text: .ascii "(High score saved to file.txt)\n"
save_success_text_len = . - save_success_text

save_error_text: .ascii "(Error: Could not save high score to file.txt - check permissions)\n"
save_error_text_len = . - save_error_text

save_tmp_success_text: .ascii "(High score saved to /tmp/snake_high_score.txt)\n"
save_tmp_success_text_len = . - save_tmp_success_text

debug_score_text: .ascii "Saving score: "
debug_score_text_len = . - debug_score_text

debug_fd_text: .ascii "File descriptor: "
debug_fd_text_len = . - debug_fd_text

debug_filename_text: .ascii "Trying to create file: "
debug_filename_text_len = . - debug_filename_text

debug_current_score: .ascii "Current: "
debug_current_score_len = . - debug_current_score

debug_vs_high: .ascii " vs High: "
debug_vs_high_len = . - debug_vs_high

debug_w19_text: .ascii "Record flag (w19): "
debug_w19_text_len = . - debug_w19_text

debug_saving_text: .ascii "Actually saving new record!\n"
debug_saving_text_len = . - debug_saving_text

debug_loaded_text: .ascii "Loaded from file: '"
debug_loaded_text_len = . - debug_loaded_text

debug_parsed_text: .ascii "Parsed high score: "
debug_parsed_text_len = . - debug_parsed_text

debug_level2_msg: .ascii "DEBUG Level2 = "
debug_level2_msg_len = . - debug_level2_msg

bell_sound: .ascii "\x07"

// Alternative visual feedback when audio doesn't work
flash_text: .ascii "\x1b[5m*BEEP*\x1b[25m"
flash_text_len = . - flash_text