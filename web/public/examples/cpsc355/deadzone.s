// deadzone - a terminal survivor in ARMv8 assembly: waves of enemies, an
// upgrade to pick between them, a Titan at wave 10.  Full project at
// https://github.com/Abdalla-Eldoumani/deadzone
//
// how to run: press assemble, then run -- the game takes over the terminal
// pane and grabs the keyboard.  Or from the term tab:  ./program
//
// how to play: any key past the title, w/s picks a menu item, enter starts.
// wasd moves and the gun aims itself; space bombs, f freezes, 1/2/3 take an
// upgrade, p pauses, q quits, r restarts.  Scores persist in data/deadzone.sav.

// game_state stays in w19 for the whole run. player_died deliberately leaves
// it set on the way out of check_player_enemy_collision instead of restoring
// x19, which is how the game-over state survives the return; both collision
// checks spill their death flag to the stack rather than touch w19.
define(game_state, w19)
define(frame_count, w22)
define(key_pressed, w23)

// Health meter thresholds, in filled segments out of HP_METER_SEGMENTS
HP_METER_SEGMENTS = 20                          // Width of the health bar
HP_METER_HURT = 12                              // Amber at or below 60 percent
HP_METER_CRITICAL = 6                           // Red at or below 30 percent

// Where each field starts on the status bar's upper row
MARQUEE_X = 2                                   // Game name on row 0
BAR_HP_X = 2                                    // HEALTH
BAR_HP_METER_X = 9                              // Its gauge, 22 cells wide
BAR_HP_VALUE_X = 33                             // Its number
BAR_WAVE_X = 39                                 // WAVE
BAR_KILLS_X = 51                                // KILLS
BAR_LEVEL_X = 64                                // LEVEL

// A wave announcement holds the middle of the field for about a second
WAVE_SPLASH_FRAMES = TARGET_FPS

                .data

// Menu state
menu_selection: .word   0                       // Current menu item (0=Start, 1=Scores, 2=Quit)
show_hs_screen: .word   0                       // 1 if showing high scores screen

// Intro animation state
intro_frame:    .word   0                       // Current animation frame
intro_done:     .word   0                       // 1 if intro complete

// Wave announcement. wave_shown starts at 0 so the first wave announces
// itself the moment play begins, the way every later one does.
wave_shown:     .word   0                       // Wave the splash last named
wave_splash:    .word   0                       // Frames the splash has left

// Rubble on the arena floor, one tile per eight columns, staggered every
// other row so it reads as scatter instead of a grid.
                .balign 8
floor_even:     .byte   '.', ' ', ' ', ' ', ' ', ' ', ' ', ' '
                .balign 8
floor_odd:      .byte   ' ', ' ', ' ', ' ', '.', ' ', ' ', ' '

// Frame timing
                .balign 8

// Timing structures (for nanosleep)
                .balign 8
sleep_req:      .dword  0                       // tv_sec
                .dword  FRAME_TIME_NS           // tv_nsec

                .balign 8
sleep_rem:      .dword  0                       // Remaining sec
                .dword  0                       // Remaining nsec

                .text

// Display strings
msg_title:      .string "DEADZONE"
msg_exit:       .string "\nExiting DEADZONE...\n"
msg_goodbye:    .string "Terminal restored. Goodbye!\n"
msg_term_fail:  .string "ERROR: Terminal init failed (no TTY?)\n"
msg_term_ok:    .string ""
msg_wave:       .string "Wave:"
msg_level:      .string "Lv:"
msg_kills:      .string "Kills:"

// Status bar field names
msg_bar_hp:     .string "HEALTH"
msg_bar_wave:   .string "WAVE"
msg_bar_kills:  .string "KILLS"
msg_bar_level:  .string "LEVEL"

// Wave announcement, spaced out so it reads at a glance
msg_splash_wave: .string "W A V E"

// Game over screen strings
msg_go_title:   .string "GAME OVER"
msg_go_score:   .string "Final Score: "
msg_go_wave:    .string "Wave Reached: "
msg_go_kills:   .string "Enemies Killed: "
msg_go_level:   .string "Level Reached: "
msg_go_quit:    .string "Press Q to quit, R to restart, M for menu"
msg_hs_title:   .string "HIGH SCORES"
msg_hs_empty:   .string "No high scores yet"
msg_dot:        .string ". "
msg_space:      .string "  "

// Pause overlay strings
msg_pause:      .string "PAUSED"
msg_pause_hint: .string "p to resume, q to quit"

// Main menu strings
msg_menu_title: .string "DEADZONE"
msg_menu_sub:   .string "Terminal Survivor"
msg_menu_ver:   .string "v1.0 - ARMv8 Assembly"
msg_menu_start: .string "START GAME"
msg_menu_scores: .string "HIGH SCORES"
msg_menu_quit:  .string "QUIT"
msg_menu_arrow: .string "> "
msg_menu_nav:   .string "W/S or Arrows to select, Enter to confirm"
msg_menu_back:  .string "Press ESC or Q to return"

// Intro screen ASCII art logo (simplified block letters, 66 chars wide)
intro_logo_1:   .string "######  #####    ###    ######  ######  #####   ##   ##  ##### "
intro_logo_2:   .string "##   ## ##      ## ##   ##   ##    ##  ##   ##  ###  ##  ##    "
intro_logo_3:   .string "##   ## ####   #######  ##   ##   ##   ##   ##  ## ####  ####  "
intro_logo_4:   .string "######  #####  ##   ##  ######   ####   #####   ##   ##  ##### "

// Intro subtitle and prompt
msg_intro_subtitle: .string ">>> TERMINAL SURVIVOR <<<"
msg_intro_anykey:   .string "- Press any key to continue -"

// Bell character for sound
bell_char:      .string "\007"

// Player character

                .balign 4

// main - Program entry point
                .global main
main:
                stp     fp, lr, [sp, -64]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]
                str     x23, [sp, 48]

                // Initialize terminal (raw mode)
                bl      terminal_init           // Set up terminal
                cmp     x0, 0                   // Check result
                b.lt    main_term_failed        // Exit if failed

                // Print success message
                adrp    x0, msg_term_ok         // Success message
                add     x0, x0, :lo12:msg_term_ok
                bl      printf                  // Print it
                b       main_continue

main_term_failed:
                // Print failure message
                adrp    x0, msg_term_fail       // Failure message
                add     x0, x0, :lo12:msg_term_fail
                bl      printf                  // Print it
                b       main_exit_error         // Exit with error

main_continue:

                // Initialize save system (load high scores)
                bl      save_init               // Load saved data

                // Initialize input
                bl      input_init              // Set up input

                // Start at intro screen
                mov     game_state, STATE_INTRO
                mov     frame_count, 0
                mov     key_pressed, KEY_NONE

                // Reset intro animation
                adrp    x0, intro_frame
                add     x0, x0, :lo12:intro_frame
                str     wzr, [x0]

                // Reset menu selection
                adrp    x0, menu_selection
                add     x0, x0, :lo12:menu_selection
                mov     w1, 0
                str     w1, [x0]

                // Clear high scores screen flag
                adrp    x0, show_hs_screen
                add     x0, x0, :lo12:show_hs_screen
                str     wzr, [x0]

// Main game loop
game_loop:
                // Check if we should quit
                cmp     game_state, STATE_QUIT
                b.eq    main_exit               // Exit if quit state

                // Poll for input
                bl      input_poll              // Get key (non-blocking)
                mov     key_pressed, w0

                // Check intro state first
                cmp     game_state, STATE_INTRO
                b.eq    game_loop_intro

                // Check menu state
                cmp     game_state, STATE_MENU
                b.eq    game_loop_menu

                // Handle input (only for playing states)
                bl      handle_input            // Process key

                // Quitting takes effect here rather than at the top of the
                // next pass, or the loop paints one more frame of the play
                // field over whatever screen the key was pressed on.
                cmp     game_state, STATE_QUIT
                b.eq    main_exit

                // Check game over state
                cmp     game_state, STATE_GAMEOVER
                b.eq    game_loop_gameover

                // Check level up state
                cmp     game_state, STATE_LEVELUP
                b.eq    game_loop_levelup

                // Check paused state
                cmp     game_state, STATE_PAUSED
                b.eq    game_loop_paused

                // Update game state
                bl      update_game             // Update logic
                bl      effects_update          // Update visual effects
                bl      abilities_update        // Update ability cooldowns
                bl      wave_splash_update      // Announce a wave that changed
                bl      achievements_update     // Update achievement notifications
                bl      achievements_check      // Check for new achievements

                // Check if level up occurred during update
                bl      player_check_levelup
                cbz     w0, game_loop_render    // No level up

                // Level up! Generate upgrade choices and switch state
                bl      play_bell               // Sound effect
                bl      upgrades_generate_choices
                bl      screen_invalidate       // Menu covers the field
                mov     game_state, STATE_LEVELUP

game_loop_render:
                // Render frame
                bl      draw_screen             // Draw screen
                bl      effects_draw            // Draw particles and effects
                bl      achievements_draw       // Draw achievement notifications

                // Increment frame counter
                add     frame_count, frame_count, 1

                // Frame timing - sleep for remaining time
                bl      frame_delay             // Sleep to maintain FPS

                // Continue loop
                b       game_loop

game_loop_gameover:
                // In game over state, draw game over screen
                bl      draw_gameover_screen

                // Handle R for restart
                cmp     key_pressed, 'r'
                b.eq    game_restart
                cmp     key_pressed, 'R'
                b.eq    game_restart

                // Handle M for menu
                cmp     key_pressed, 'm'
                b.eq    game_return_menu
                cmp     key_pressed, 'M'
                b.eq    game_return_menu

                // Frame delay and continue
                bl      frame_delay
                b       game_loop

game_return_menu:
                // Reset menu selection and return to menu
                adrp    x0, menu_selection
                add     x0, x0, :lo12:menu_selection
                str     wzr, [x0]
                bl      screen_invalidate       // Whole screen changes here
                mov     game_state, STATE_MENU
                b       game_loop

game_restart:
                // Reinitialize game for new run
                bl      player_init
                bl      enemies_init
                bl      projectiles_init
                bl      upgrades_init
                bl      effects_init
                bl      boss_init
                bl      abilities_init
                bl      achievements_init
                bl      wave_splash_init
                bl      save_start_game
                bl      screen_invalidate       // Whole screen changes here
                mov     game_state, STATE_PLAYING
                mov     frame_count, 0
                b       game_loop

// Intro state
game_loop_intro:
                // Draw intro screen with animation
                bl      draw_intro_screen

                // Increment intro frame
                adrp    x0, intro_frame
                add     x0, x0, :lo12:intro_frame
                ldr     w1, [x0]
                add     w1, w1, 1
                str     w1, [x0]

                // After animation complete, wait for key press
                cmp     w1, 120                 // Animation done?
                b.lt    intro_continue          // Not yet, keep animating

                // Animation complete - wait for any key to continue
                cmp     key_pressed, KEY_NONE
                b.eq    intro_wait              // No key, keep waiting

                // Key pressed - go to menu
                b       intro_finish

intro_wait:
                // Just wait, don't increment frame counter anymore
                bl      frame_delay
                b       game_loop

intro_continue:
                // Still animating
                bl      frame_delay
                b       game_loop

intro_finish:
                // Reset intro frame for next time
                adrp    x0, intro_frame
                add     x0, x0, :lo12:intro_frame
                str     wzr, [x0]

                // Transition to menu
                bl      screen_invalidate       // Whole screen changes here
                mov     game_state, STATE_MENU
                b       game_loop

// Menu state
game_loop_menu:
                // Check if showing high scores screen
                adrp    x0, show_hs_screen
                add     x0, x0, :lo12:show_hs_screen
                ldr     w0, [x0]
                cbnz    w0, menu_show_highscores

                // Draw main menu
                bl      draw_menu

                // Handle menu navigation
                cmp     key_pressed, KEY_W
                b.eq    menu_up
                cmp     key_pressed, KEY_ARROW_UP
                b.eq    menu_up
                cmp     key_pressed, KEY_S
                b.eq    menu_down
                cmp     key_pressed, KEY_ARROW_DOWN
                b.eq    menu_down
                cmp     key_pressed, KEY_ENTER
                b.eq    menu_select
                cmp     key_pressed, KEY_CR
                b.eq    menu_select
                cmp     key_pressed, KEY_ESC
                b.eq    menu_quit_check

                bl      frame_delay
                b       game_loop

menu_up:
                adrp    x0, menu_selection
                add     x0, x0, :lo12:menu_selection
                ldr     w1, [x0]
                cbz     w1, menu_input_done     // Already at top
                sub     w1, w1, 1
                str     w1, [x0]
                b       menu_input_done

menu_down:
                adrp    x0, menu_selection
                add     x0, x0, :lo12:menu_selection
                ldr     w1, [x0]
                cmp     w1, 2
                b.ge    menu_input_done         // Already at bottom
                add     w1, w1, 1
                str     w1, [x0]
                b       menu_input_done

menu_input_done:
                bl      frame_delay
                b       game_loop

menu_select:
                // Get current selection
                adrp    x0, menu_selection
                add     x0, x0, :lo12:menu_selection
                ldr     w0, [x0]

                cmp     w0, 0
                b.eq    menu_start_game
                cmp     w0, 1
                b.eq    menu_view_scores
                cmp     w0, 2
                b.eq    menu_quit

                b       menu_input_done

menu_start_game:
                // Initialize game systems
                bl      player_init
                bl      enemies_init
                bl      projectiles_init
                bl      upgrades_init
                bl      effects_init
                bl      boss_init
                bl      abilities_init
                bl      achievements_init
                bl      wave_splash_init
                bl      save_start_game
                bl      screen_invalidate       // Whole screen changes here
                mov     game_state, STATE_PLAYING
                mov     frame_count, 0
                b       game_loop

menu_view_scores:
                // Set flag to show high scores
                adrp    x0, show_hs_screen
                add     x0, x0, :lo12:show_hs_screen
                mov     w1, 1
                str     w1, [x0]
                b       menu_input_done

menu_quit_check:
                // Check if showing high scores - go back to menu
                adrp    x0, show_hs_screen
                add     x0, x0, :lo12:show_hs_screen
                ldr     w1, [x0]
                cbnz    w1, menu_back_to_menu
                // Fall through to quit

menu_quit:
                mov     game_state, STATE_QUIT
                b       game_loop

menu_back_to_menu:
                // Clear high scores flag
                adrp    x0, show_hs_screen
                add     x0, x0, :lo12:show_hs_screen
                str     wzr, [x0]
                b       menu_input_done

menu_show_highscores:
                // Draw high scores screen
                bl      draw_highscores_screen

                // Handle back input
                cmp     key_pressed, KEY_ESC
                b.eq    menu_back_to_menu
                cmp     key_pressed, KEY_Q
                b.eq    menu_back_to_menu
                cmp     key_pressed, 'q'
                b.eq    menu_back_to_menu

                bl      frame_delay
                b       game_loop

game_loop_levelup:
                // In level up state, draw upgrade menu and wait for choice
                bl      draw_screen             // Draw game screen (background)
                bl      upgrades_draw_menu      // Draw upgrade menu on top

                // Handle upgrade selection (1, 2, 3)
                cmp     key_pressed, KEY_1
                b.eq    select_upgrade_1
                cmp     key_pressed, KEY_2
                b.eq    select_upgrade_2
                cmp     key_pressed, KEY_3
                b.eq    select_upgrade_3

                // No valid selection, continue waiting
                bl      frame_delay
                b       game_loop

select_upgrade_1:
                mov     w0, 0                   // Choice 0
                bl      upgrades_apply
                bl      screen_invalidate       // Menu comes back off
                mov     game_state, STATE_PLAYING
                b       game_loop_render

select_upgrade_2:
                mov     w0, 1                   // Choice 1
                bl      upgrades_apply
                bl      screen_invalidate       // Menu comes back off
                mov     game_state, STATE_PLAYING
                b       game_loop_render

select_upgrade_3:
                mov     w0, 2                   // Choice 2
                bl      upgrades_apply
                bl      screen_invalidate       // Menu comes back off
                mov     game_state, STATE_PLAYING
                b       game_loop_render

// Pause state
game_loop_paused:
                // Repaint only. No update, no spawn, no timer, and the frame
                // counter stays put, so nothing ages while the game is paused.
                bl      draw_screen
                bl      effects_draw
                bl      draw_pause_overlay

                // Quitting already went through handle_input; p resumes
                cmp     key_pressed, KEY_P
                b.eq    game_resume

                bl      frame_delay
                b       game_loop

game_resume:
                bl      screen_invalidate       // Overlay comes back off
                mov     game_state, STATE_PLAYING
                bl      frame_delay
                b       game_loop

// Exit
main_exit:
                // The frame buffer is done with; these go straight out
                bl      screen_end              // Park the cursor, drop colour

                adrp    x0, msg_exit            // Exit message
                add     x0, x0, :lo12:msg_exit
                bl      write_str_raw           // Print message

                // Restore terminal
                bl      terminal_restore        // Restore settings

                // Print goodbye
                adrp    x0, msg_goodbye         // Goodbye message
                add     x0, x0, :lo12:msg_goodbye
                bl      write_str_raw           // Print message

                mov     w0, 0                   // Return code 0
                b       main_cleanup

main_exit_error:
                mov     w0, 1                   // Return code 1

main_cleanup:
                ldr     x23, [sp, 48]
                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 64
                ret

// handle_input - Process keyboard input
handle_input:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Check for no key
                cmp     key_pressed, KEY_NONE
                b.eq    handle_input_done       // No key pressed

                // Check ESC
                cmp     key_pressed, KEY_ESC    // Escape?
                b.eq    handle_quit

                // Check Q for quit
                cmp     key_pressed, KEY_Q
                b.eq    handle_quit

                // Block movement and abilities during level-up state
                cmp     game_state, STATE_LEVELUP
                b.eq    handle_input_done       // Skip movement during level-up

                // Pause toggle, then swallow everything else while paused
                cmp     key_pressed, KEY_P
                b.eq    handle_pause
                cmp     game_state, STATE_PAUSED
                b.eq    handle_input_done

                // Check movement keys
                cmp     key_pressed, KEY_W
                b.eq    handle_up
                cmp     key_pressed, KEY_S
                b.eq    handle_down
                cmp     key_pressed, KEY_A
                b.eq    handle_left
                cmp     key_pressed, KEY_D
                b.eq    handle_right

                // Check for ability keys (spacebar, F)
                mov     w0, key_pressed
                bl      abilities_check_input

                b       handle_input_done

handle_quit:
                mov     game_state, STATE_QUIT  // Set quit state
                b       handle_input_done

handle_pause:
                // Only a live game pauses; the paused loop handles resuming
                cmp     game_state, STATE_PLAYING
                b.ne    handle_input_done
                bl      screen_invalidate       // Overlay covers the field
                mov     game_state, STATE_PAUSED
                mov     key_pressed, KEY_NONE   // Spend the key, or pause ends
                b       handle_input_done       //   on the frame that began it

handle_up:
                mov     w0, 0                   // dx = 0
                mov     w1, -1                  // dy = -1 (up)
                bl      player_move
                b       handle_input_done

handle_down:
                mov     w0, 0                   // dx = 0
                mov     w1, 1                   // dy = 1 (down)
                bl      player_move
                b       handle_input_done

handle_left:
                mov     w0, -1                  // dx = -1 (left)
                mov     w1, 0                   // dy = 0
                bl      player_move
                b       handle_input_done

handle_right:
                mov     w0, 1                   // dx = 1 (right)
                mov     w1, 0                   // dy = 0
                bl      player_move

handle_input_done:
                ldp     fp, lr, [sp], 16
                ret

// update_game - Update game logic
update_game:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Update player (invincibility countdown)
                bl      player_update

                // Update enemies (movement, spawning)
                bl      enemies_update

                // Update projectiles (auto-fire, movement, collision)
                bl      projectiles_update

                // Update boss
                bl      boss_update

                // Check player-enemy collisions
                bl      check_player_enemy_collision

                // Check player-boss collision
                bl      check_player_boss_collision

                ldp     fp, lr, [sp], 16
                ret

// check_player_enemy_collision - Check if player touches any enemy
check_player_enemy_collision:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                str     x19, [sp, 16]

                // Get player position
                bl      player_get_x
                mov     w19, w0
                bl      player_get_y
                mov     w1, w0                  // Y in w1
                mov     w0, w19                 // X in w0

                // Check collision with enemies
                bl      enemies_check_collision
                cmp     w0, -1
                b.eq    no_player_collision

                // Player hit an enemy - take damage
                mov     w0, 5                   // 5 damage (balanced)
                bl      player_damage
                str     w0, [sp, 24]            // Save death status to stack (not w19, that's game_state!)
                bl      play_bell               // Sound effect for damage
                mov     w0, 2                   // Intensity level 2
                bl      effects_trigger_shake   // Screen shake effect!

                // Check if player died
                ldr     w0, [sp, 24]            // Restore death status from stack
                cbnz    w0, player_died

no_player_collision:
                ldr     x19, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

player_died:
                // Game over sound - double bell for emphasis
                bl      play_bell
                bl      play_bell

                // Save game stats and check for high score
                // Need to get score (kills * 10 for now), wave, kills, level
                bl      player_get_kills
                mov     w19, w0                 // Save kills (also use as score)
                mov     w0, w19
                mov     w1, 10
                mul     w0, w0, w1              // Score = kills * 10

                bl      enemies_get_wave
                mov     w1, w0

                mov     w2, w19

                bl      player_get_level
                mov     w3, w0

                mov     w0, w19
                mov     w4, 10
                mul     w0, w0, w4              // Score again for w0
                bl      save_end_game           // Save and get rank

                bl      screen_invalidate       // Whole screen changes here
                mov     game_state, STATE_GAMEOVER
                // NOTE: Don't restore x19 here - we WANT game_state to stay as STATE_GAMEOVER
                ldp     fp, lr, [sp], 32
                ret

// check_player_boss_collision - Check if player touches boss
check_player_boss_collision:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                str     x19, [sp, 16]

                // Get player position
                bl      player_get_x
                mov     w19, w0
                bl      player_get_y
                mov     w1, w0
                mov     w0, w19

                // Check collision with boss
                bl      boss_check_collision
                cbz     w0, no_boss_collision

                // Player hit boss - take more damage!
                mov     w0, 20                  // 20 damage from boss
                bl      player_damage
                str     w0, [sp, 24]            // Save death status to stack (not w19, that's game_state!)
                bl      play_bell
                bl      play_bell               // Extra bell for boss hit
                mov     w0, 3                   // Higher intensity shake
                bl      effects_trigger_shake

                // Check if player died (reuse existing code flow)
                ldr     w0, [sp, 24]            // Restore death status from stack
                cbnz    w0, player_died

no_boss_collision:
                ldr     x19, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// draw_screen - Render the game screen
draw_screen:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Marquee, arena walls, rubble, and the empty status bar
                bl      draw_frame_chrome

                // Draw enemies first (so player appears on top)
                bl      enemies_draw

                // Draw boss (if active)
                bl      boss_draw

                // Draw projectiles
                bl      projectiles_draw

                // Draw player
                bl      player_draw

                // Numbers and gauges go on last, over the blanked bar
                bl      draw_status_bar

                // The wave announcement sits over everything else
                bl      draw_wave_splash

                bl      reset_color

                ldp     fp, lr, [sp], 16
                ret

// draw_frame_chrome - Marquee, arena walls and floor, and the status band
// Whole-row fills: the field costs a few hundred steps instead of the twelve
// hundred single-character writes the sequential version needed.
draw_frame_chrome:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                str     x19, [sp, 16]

                // Marquee: a dark band with the game's name on the left
                mov     w0, ROW_MARQUEE
                mov     w1, ' '
                mov     w2, CHROME_COLOR
                bl      fb_fill_row

                mov     w0, MARQUEE_X
                mov     w1, ROW_MARQUEE
                bl      cursor_move
                mov     w0, COLOR_BRIGHT_RED
                bl      set_color
                adrp    x0, msg_title
                add     x0, x0, :lo12:msg_title
                bl      write_str

                mov     w0, ROW_TOP_BORDER
                bl      draw_border_row

                mov     w19, ROW_FIELD_FIRST
draw_chrome_field:
                cmp     w19, ROW_FIELD_LAST
                b.gt    draw_chrome_bottom

                // Rubble on the deck, staggered every other row
                adrp    x1, floor_even
                add     x1, x1, :lo12:floor_even
                tst     w19, 1
                b.eq    draw_chrome_floor
                adrp    x1, floor_odd
                add     x1, x1, :lo12:floor_odd

draw_chrome_floor:
                ldr     x1, [x1]
                mov     w0, w19
                mov     w2, FLOOR_COLOR
                bl      fb_fill_row_pattern

                // A wall at each end of the row
                mov     w0, CHROME_COLOR
                bl      set_color

                mov     w0, 0
                mov     w1, w19
                bl      cursor_move
                mov     w0, WALL_GLYPH
                bl      write_char

                mov     w0, SCREEN_WIDTH - 1
                mov     w1, w19
                bl      cursor_move
                mov     w0, WALL_GLYPH
                bl      write_char

                add     w19, w19, 1
                b       draw_chrome_field

draw_chrome_bottom:
                mov     w0, ROW_BOTTOM_BORDER
                bl      draw_border_row

                // Gap between the arena and the bar
                mov     w0, ROW_BOTTOM_BORDER + 1
                mov     w1, ' '
                mov     w2, COLOR_RESET
                bl      fb_fill_row

                // The status band: a rule, two blank rows to write into,
                // and a rule to close it
                mov     w0, ROW_BAR_TOP
                bl      draw_border_row

                mov     w0, ROW_BAR_STATS
                mov     w1, ' '
                mov     w2, COLOR_RESET
                bl      fb_fill_row

                mov     w0, ROW_BAR_ABILITIES
                mov     w1, ' '
                mov     w2, COLOR_RESET
                bl      fb_fill_row

                mov     w0, ROW_BAR_BOTTOM
                bl      draw_border_row

                ldr     x19, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// draw_border_row - One horizontal rule across the whole screen
// Parameters: w0 = row
draw_border_row:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                mov     w1, WALL_GLYPH
                mov     w2, CHROME_COLOR
                bl      fb_fill_row

                ldp     fp, lr, [sp], 16
                ret

// draw_status_bar - The bottom band: health gauge and the three counters
// Row ROW_BAR_ABILITIES belongs to abilities.asm, which draws the two
// charge gauges in the same idiom.
draw_status_bar:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]

                // HEALTH, then a twenty-segment gauge and the number
                mov     w0, BAR_HP_X
                mov     w1, ROW_BAR_STATS
                bl      cursor_move
                mov     w0, LABEL_COLOR
                bl      set_color
                adrp    x0, msg_bar_hp
                add     x0, x0, :lo12:msg_bar_hp
                bl      write_str

                bl      player_get_health
                mov     w19, w0
                bl      player_get_max_health
                mov     w20, w0
                cmp     w20, 0
                csinc   w20, w20, wzr, gt       // Never divide by zero

                mov     w0, HP_METER_SEGMENTS
                mul     w0, w19, w0
                udiv    w20, w0, w20            // Segments filled

                // Green while it holds, amber as it goes, red at the end
                mov     w0, COLOR_BRIGHT_GREEN
                cmp     w20, HP_METER_HURT
                b.gt    draw_hp_meter
                mov     w0, COLOR_BRIGHT_YELLOW
                cmp     w20, HP_METER_CRITICAL
                b.gt    draw_hp_meter
                mov     w0, COLOR_BRIGHT_RED

draw_hp_meter:
                mov     w4, w0
                mov     w3, w20
                mov     w2, HP_METER_SEGMENTS
                mov     w0, BAR_HP_METER_X
                mov     w1, ROW_BAR_STATS
                bl      fb_meter

                mov     w0, BAR_HP_VALUE_X
                mov     w1, ROW_BAR_STATS
                bl      cursor_move
                mov     w0, VALUE_COLOR
                bl      set_color
                mov     w0, w19
                bl      write_num

                // WAVE, KILLS and LEVEL as plain bold counters
                mov     w0, BAR_WAVE_X
                mov     w1, ROW_BAR_STATS
                bl      cursor_move
                bl      enemies_get_wave
                mov     w19, w0
                adrp    x0, msg_bar_wave
                add     x0, x0, :lo12:msg_bar_wave
                mov     w1, w19
                bl      draw_bar_counter

                mov     w0, BAR_KILLS_X
                mov     w1, ROW_BAR_STATS
                bl      cursor_move
                bl      player_get_kills
                mov     w19, w0
                adrp    x0, msg_bar_kills
                add     x0, x0, :lo12:msg_bar_kills
                mov     w1, w19
                bl      draw_bar_counter

                mov     w0, BAR_LEVEL_X
                mov     w1, ROW_BAR_STATS
                bl      cursor_move
                bl      player_get_level
                mov     w19, w0
                adrp    x0, msg_bar_level
                add     x0, x0, :lo12:msg_bar_level
                mov     w1, w19
                bl      draw_bar_counter

                // The two ability charges share the row below
                bl      abilities_draw_hud

                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// draw_bar_counter - A status bar field: dim name, space, bright number
// Parameters: x0 = name, w1 = value. Stages at the current position.
draw_bar_counter:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]

                mov     x20, x0                 // Field name
                mov     w19, w1                 // Its value

                mov     w0, LABEL_COLOR
                bl      set_color
                mov     x0, x20
                bl      write_str

                mov     w0, ' '
                bl      write_char
                mov     w0, VALUE_COLOR
                bl      set_color
                mov     w0, w19
                bl      write_num

                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// wave_splash_init - Arm the announcement so a new run names its first wave
wave_splash_init:
                adrp    x0, wave_shown
                add     x0, x0, :lo12:wave_shown
                str     wzr, [x0]               // No wave named yet
                adrp    x0, wave_splash
                add     x0, x0, :lo12:wave_splash
                str     wzr, [x0]
                ret

// wave_splash_update - Notice a new wave and start its announcement
// Only the live game calls this, so a splash that is up when the game pauses
// stays up until play resumes.
wave_splash_update:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                bl      enemies_get_wave
                adrp    x1, wave_shown
                add     x1, x1, :lo12:wave_shown
                ldr     w2, [x1]
                cmp     w0, w2
                b.eq    wave_splash_countdown

                str     w0, [x1]
                adrp    x1, wave_splash
                add     x1, x1, :lo12:wave_splash
                mov     w2, WAVE_SPLASH_FRAMES
                str     w2, [x1]
                b       wave_splash_update_done

wave_splash_countdown:
                adrp    x1, wave_splash
                add     x1, x1, :lo12:wave_splash
                ldr     w2, [x1]
                cbz     w2, wave_splash_update_done
                sub     w2, w2, 1
                str     w2, [x1]

wave_splash_update_done:
                ldp     fp, lr, [sp], 16
                ret

// draw_wave_splash - Announce the wave across the middle of the field
// The panel blanks what it covers, and the next frame stages the floor back,
// so nothing has to be invalidated when it goes away.
draw_wave_splash:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                adrp    x0, wave_splash
                add     x0, x0, :lo12:wave_splash
                ldr     w0, [x0]
                cbz     w0, draw_wave_splash_done

                mov     w0, 30                  // Box across the middle rows
                mov     w1, 8
                mov     w2, 20
                mov     w3, 5
                mov     w4, COLOR_BRIGHT_RED
                bl      fb_panel

                mov     w0, 34
                mov     w1, 10
                bl      cursor_move
                mov     w0, COLOR_BRIGHT_RED
                bl      set_color
                adrp    x0, msg_splash_wave
                add     x0, x0, :lo12:msg_splash_wave
                bl      write_str

                mov     w0, ' '
                bl      write_char
                mov     w0, ' '
                bl      write_char
                mov     w0, VALUE_COLOR
                bl      set_color
                bl      enemies_get_wave
                bl      write_num

draw_wave_splash_done:
                ldp     fp, lr, [sp], 16
                ret

// frame_delay - Sleep to maintain target frame rate
frame_delay:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Every render path reaches the loop through here, so this is
                // the one place the staged frame goes out to the terminal.
                bl      screen_flush

                // Simple fixed delay for now
                // Future: calculate actual sleep based on elapsed time
                adrp    x0, sleep_req           // Sleep request struct
                add     x0, x0, :lo12:sleep_req
                adrp    x1, sleep_rem           // Remainder struct
                add     x1, x1, :lo12:sleep_rem
                mov     x8, SYS_NANOSLEEP
                svc     0

                ldp     fp, lr, [sp], 16
                ret

// draw_pause_overlay - Draw the pause banner over the frozen field
draw_pause_overlay:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // A framed box so the field underneath stops showing through
                mov     w0, 27
                mov     w1, 8
                mov     w2, 26
                mov     w3, 6
                mov     w4, CHROME_COLOR
                bl      fb_panel

                mov     w0, SCREEN_WIDTH / 2 - 3
                mov     w1, 9
                bl      cursor_move

                mov     w0, COLOR_BRIGHT_YELLOW
                bl      set_color

                adrp    x0, msg_pause
                add     x0, x0, :lo12:msg_pause
                bl      write_str

                // Key hint below it
                mov     w0, SCREEN_WIDTH / 2 - 11
                mov     w1, 11
                bl      cursor_move

                mov     w0, CHROME_COLOR
                bl      set_color

                adrp    x0, msg_pause_hint
                add     x0, x0, :lo12:msg_pause_hint
                bl      write_str

                bl      reset_color

                ldp     fp, lr, [sp], 16
                ret

// draw_gameover_screen - Draw the game over screen with stats
draw_gameover_screen:
                stp     fp, lr, [sp, -64]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]

                // Clear screen
                bl      screen_clear
                bl      cursor_home

                // A red band across the top, then the run's numbers under it
                mov     w0, 2
                mov     w1, WALL_GLYPH
                mov     w2, COLOR_RED
                bl      fb_fill_row
                mov     w0, 4
                mov     w1, WALL_GLYPH
                mov     w2, COLOR_RED
                bl      fb_fill_row

                mov     w0, 35                  // X position
                mov     w1, 3                   // Y position
                bl      cursor_move

                mov     w0, COLOR_BRIGHT_RED
                bl      set_color

                adrp    x0, msg_go_title
                add     x0, x0, :lo12:msg_go_title
                bl      write_str

                // Draw final score
                mov     w0, 20
                mov     w1, 6
                bl      cursor_move

                mov     w0, LABEL_COLOR
                bl      set_color

                adrp    x0, msg_go_score
                add     x0, x0, :lo12:msg_go_score
                bl      write_str

                mov     w0, COLOR_BRIGHT_YELLOW
                bl      set_color

                bl      player_get_kills
                mov     w19, w0
                mov     w1, 10
                mul     w0, w0, w1              // Score = kills * 10
                bl      write_num

                // Draw wave reached
                mov     w0, 20
                mov     w1, 7
                bl      cursor_move

                mov     w0, LABEL_COLOR
                bl      set_color

                adrp    x0, msg_go_wave
                add     x0, x0, :lo12:msg_go_wave
                bl      write_str

                mov     w0, COLOR_BRIGHT_CYAN
                bl      set_color

                bl      enemies_get_wave
                bl      write_num

                // Draw kills
                mov     w0, 20
                mov     w1, 8
                bl      cursor_move

                mov     w0, LABEL_COLOR
                bl      set_color

                adrp    x0, msg_go_kills
                add     x0, x0, :lo12:msg_go_kills
                bl      write_str

                mov     w0, COLOR_BRIGHT_GREEN
                bl      set_color

                mov     w0, w19                 // Kills we saved earlier
                bl      write_num

                // Draw level
                mov     w0, 20
                mov     w1, 9
                bl      cursor_move

                mov     w0, LABEL_COLOR
                bl      set_color

                adrp    x0, msg_go_level
                add     x0, x0, :lo12:msg_go_level
                bl      write_str

                mov     w0, COLOR_BRIGHT_MAGENTA
                bl      set_color

                bl      player_get_level
                bl      write_num

                // Draw high scores title
                mov     w0, 34
                mov     w1, 12
                bl      cursor_move

                mov     w0, COLOR_BRIGHT_YELLOW
                bl      set_color

                adrp    x0, msg_hs_title
                add     x0, x0, :lo12:msg_hs_title
                bl      write_str

                // Draw top 5 high scores
                mov     w20, 0                  // Score index

draw_hs_loop:
                cmp     w20, 5
                b.ge    draw_hs_done

                // Get high score entry - use x22 to avoid corruption
                mov     w0, w20
                bl      save_get_high_score
                cbz     x0, draw_hs_next        // No entry

                mov     x22, x0                 // Save entry pointer in x22

                // Check if score is 0 (empty)
                ldr     w0, [x22, HS_SCORE]
                cbz     w0, draw_hs_next

                // Save values to stack before any function calls
                ldr     w21, [x22, HS_SCORE]    // w21 = score
                ldrh    w19, [x22, HS_WAVE]     // w19 = wave (temp)
                str     w19, [sp, 48]           // Save wave to stack
                ldr     w19, [x22, HS_KILLS]    // w19 = kills (temp)
                str     w19, [sp, 52]           // Save kills to stack

                // Position cursor
                mov     w0, 22
                add     w1, w20, 14             // Row 14, 15, 16, 17, 18
                bl      cursor_move

                mov     w0, COLOR_WHITE
                bl      set_color

                // Draw rank number
                add     w0, w20, 1
                bl      write_num

                adrp    x0, msg_dot
                add     x0, x0, :lo12:msg_dot
                bl      write_str

                // Draw score
                mov     w0, COLOR_BRIGHT_YELLOW
                bl      set_color

                mov     w0, w21                 // Use saved score
                bl      write_num

                adrp    x0, msg_space
                add     x0, x0, :lo12:msg_space
                bl      write_str

                // Draw wave
                mov     w0, COLOR_CYAN
                bl      set_color

                adrp    x0, msg_wave
                add     x0, x0, :lo12:msg_wave
                bl      write_str

                ldr     w0, [sp, 48]            // Restore wave from stack
                bl      write_num

                adrp    x0, msg_space
                add     x0, x0, :lo12:msg_space
                bl      write_str

                // Draw kills
                mov     w0, COLOR_GREEN
                bl      set_color

                adrp    x0, msg_kills
                add     x0, x0, :lo12:msg_kills
                bl      write_str

                ldr     w0, [sp, 52]            // Restore kills from stack
                bl      write_num

draw_hs_next:
                add     w20, w20, 1
                b       draw_hs_loop

draw_hs_done:
                // Draw instructions
                mov     w0, 20
                mov     w1, 21
                bl      cursor_move

                mov     w0, CHROME_COLOR
                bl      set_color

                adrp    x0, msg_go_quit
                add     x0, x0, :lo12:msg_go_quit
                bl      write_str

                bl      reset_color

                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 64
                ret

// draw_intro_screen - Draw animated intro/title screen
draw_intro_screen:
                stp     fp, lr, [sp, -48]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                str     x21, [sp, 32]

                // Clear screen
                bl      screen_clear

                // Get intro frame
                adrp    x19, intro_frame
                add     x19, x19, :lo12:intro_frame
                ldr     w19, [x19]              // w19 = frame counter

                // Calculate characters to show (reveal animation)
                // Total chars in logo = ~280, reveal over 90 frames
                mov     w20, w19
                mov     w21, 3
                mul     w20, w20, w21           // chars_to_show = frame * 3

                // Calculate color cycle (for wave effect)
                mov     w21, w19
                and     w21, w21, 0x1F          // Cycle every 32 frames

                // Draw the ASCII art logo line by line
                // Line 1
                mov     w0, 7
                mov     w1, 5
                bl      cursor_move
                mov     w0, w19                 // Frame for color
                bl      intro_set_color
                mov     w0, w20                 // Max chars
                mov     w1, 0                   // Line offset
                bl      intro_draw_logo_line1

                // Line 2
                mov     w0, 7
                mov     w1, 6
                bl      cursor_move
                mov     w0, w19
                add     w0, w0, 4               // Offset color
                bl      intro_set_color
                mov     w0, w20
                sub     w0, w0, 66              // Subtract previous line
                mov     w1, 66                  // Line offset
                bl      intro_draw_logo_line2

                // Line 3
                mov     w0, 7
                mov     w1, 7
                bl      cursor_move
                mov     w0, w19
                add     w0, w0, 8
                bl      intro_set_color
                mov     w0, w20
                sub     w0, w0, 132
                mov     w1, 132
                bl      intro_draw_logo_line3

                // Line 4
                mov     w0, 7
                mov     w1, 8
                bl      cursor_move
                mov     w0, w19
                add     w0, w0, 12
                bl      intro_set_color
                mov     w0, w20
                sub     w0, w0, 198
                mov     w1, 198
                bl      intro_draw_logo_line4

                // Draw subtitle after logo reveal
                cmp     w19, 70
                b.lt    intro_no_subtitle

                mov     w0, 27
                mov     w1, 11
                bl      cursor_move
                mov     w0, COLOR_BRIGHT_YELLOW
                bl      set_color
                adrp    x0, msg_intro_subtitle
                add     x0, x0, :lo12:msg_intro_subtitle
                bl      write_str

                // Draw press any key after more frames
                cmp     w19, 90
                b.lt    intro_no_subtitle

                mov     w0, 25
                mov     w1, 16
                bl      cursor_move
                mov     w0, CHROME_COLOR
                bl      set_color
                adrp    x0, msg_intro_anykey
                add     x0, x0, :lo12:msg_intro_anykey
                bl      write_str

intro_no_subtitle:
                bl      reset_color

                ldr     x21, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 48
                ret

// Helper: Set intro color based on frame (color wave)
intro_set_color:
                and     w0, w0, 0x1F
                cmp     w0, 8
                b.lt    intro_color_red
                cmp     w0, 16
                b.lt    intro_color_yellow
                cmp     w0, 24
                b.lt    intro_color_dim
                mov     w0, COLOR_BRIGHT_RED
                b       intro_do_color

intro_color_red:
                mov     w0, COLOR_BRIGHT_RED
                b       intro_do_color
intro_color_yellow:
                mov     w0, COLOR_BRIGHT_YELLOW
                b       intro_do_color
intro_color_dim:
                mov     w0, COLOR_RED

intro_do_color:
                b       set_color

// Draw logo lines (simplified block letters)
intro_draw_logo_line1:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp
                cmp     w0, 0
                b.le    intro_line_done
                adrp    x0, intro_logo_1
                add     x0, x0, :lo12:intro_logo_1
                bl      write_str
intro_line_done:
                ldp     fp, lr, [sp], 16
                ret

intro_draw_logo_line2:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp
                cmp     w0, 0
                b.le    intro_line2_done
                adrp    x0, intro_logo_2
                add     x0, x0, :lo12:intro_logo_2
                bl      write_str
intro_line2_done:
                ldp     fp, lr, [sp], 16
                ret

intro_draw_logo_line3:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp
                cmp     w0, 0
                b.le    intro_line3_done
                adrp    x0, intro_logo_3
                add     x0, x0, :lo12:intro_logo_3
                bl      write_str
intro_line3_done:
                ldp     fp, lr, [sp], 16
                ret

intro_draw_logo_line4:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp
                cmp     w0, 0
                b.le    intro_line4_done
                adrp    x0, intro_logo_4
                add     x0, x0, :lo12:intro_logo_4
                bl      write_str
intro_line4_done:
                ldp     fp, lr, [sp], 16
                ret

// draw_menu - Draw the main menu screen
draw_menu:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                str     x19, [sp, 16]

                // Clear screen
                bl      screen_clear
                bl      cursor_home

                // Rules top and bottom, the same idiom as the arena
                mov     w0, ROW_TOP_BORDER
                bl      draw_border_row
                mov     w0, ROW_BAR_BOTTOM - 1
                bl      draw_border_row

                // Draw title "DEADZONE"
                mov     w0, 36                  // Center position
                mov     w1, 4
                bl      cursor_move

                mov     w0, COLOR_BRIGHT_RED
                bl      set_color

                adrp    x0, msg_menu_title
                add     x0, x0, :lo12:msg_menu_title
                bl      write_str

                // Draw subtitle
                mov     w0, 32
                mov     w1, 5
                bl      cursor_move

                mov     w0, LABEL_COLOR
                bl      set_color

                adrp    x0, msg_menu_sub
                add     x0, x0, :lo12:msg_menu_sub
                bl      write_str

                // Draw version
                mov     w0, 29
                mov     w1, 6
                bl      cursor_move

                mov     w0, CHROME_COLOR
                bl      set_color

                adrp    x0, msg_menu_ver
                add     x0, x0, :lo12:msg_menu_ver
                bl      write_str

                // Get current selection
                adrp    x19, menu_selection
                add     x19, x19, :lo12:menu_selection
                ldr     w19, [x19]

                // Draw menu options
                // Option 0: START GAME
                mov     w0, 32
                mov     w1, 10
                bl      cursor_move

                cmp     w19, 0
                b.ne    menu_start_not_selected

                mov     w0, COLOR_BRIGHT_RED
                bl      set_color
                adrp    x0, msg_menu_arrow
                add     x0, x0, :lo12:msg_menu_arrow
                bl      write_str
                mov     w0, VALUE_COLOR
                bl      set_color
                b       menu_draw_start

menu_start_not_selected:
                mov     w0, CHROME_COLOR
                bl      set_color
                adrp    x0, msg_space
                add     x0, x0, :lo12:msg_space
                bl      write_str

menu_draw_start:
                adrp    x0, msg_menu_start
                add     x0, x0, :lo12:msg_menu_start
                bl      write_str

                // Option 1: HIGH SCORES
                mov     w0, 32
                mov     w1, 12
                bl      cursor_move

                cmp     w19, 1
                b.ne    menu_scores_not_selected

                mov     w0, COLOR_BRIGHT_RED
                bl      set_color
                adrp    x0, msg_menu_arrow
                add     x0, x0, :lo12:msg_menu_arrow
                bl      write_str
                mov     w0, VALUE_COLOR
                bl      set_color
                b       menu_draw_scores

menu_scores_not_selected:
                mov     w0, CHROME_COLOR
                bl      set_color
                adrp    x0, msg_space
                add     x0, x0, :lo12:msg_space
                bl      write_str

menu_draw_scores:
                adrp    x0, msg_menu_scores
                add     x0, x0, :lo12:msg_menu_scores
                bl      write_str

                // Option 2: QUIT
                mov     w0, 32
                mov     w1, 14
                bl      cursor_move

                cmp     w19, 2
                b.ne    menu_quit_not_selected

                mov     w0, COLOR_BRIGHT_RED
                bl      set_color
                adrp    x0, msg_menu_arrow
                add     x0, x0, :lo12:msg_menu_arrow
                bl      write_str
                mov     w0, VALUE_COLOR
                bl      set_color
                b       menu_draw_quit

menu_quit_not_selected:
                mov     w0, CHROME_COLOR
                bl      set_color
                adrp    x0, msg_space
                add     x0, x0, :lo12:msg_space
                bl      write_str

menu_draw_quit:
                adrp    x0, msg_menu_quit
                add     x0, x0, :lo12:msg_menu_quit
                bl      write_str

                // Draw navigation hint
                mov     w0, 19
                mov     w1, 20
                bl      cursor_move

                mov     w0, CHROME_COLOR
                bl      set_color

                adrp    x0, msg_menu_nav
                add     x0, x0, :lo12:msg_menu_nav
                bl      write_str

                bl      reset_color

                ldr     x19, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// draw_highscores_screen - Draw the high scores screen from menu
draw_highscores_screen:
                stp     fp, lr, [sp, -64]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]

                // Clear screen
                bl      screen_clear
                bl      cursor_home

                // Draw title
                mov     w0, 34
                mov     w1, 3
                bl      cursor_move

                mov     w0, COLOR_BRIGHT_YELLOW
                bl      set_color

                adrp    x0, msg_hs_title
                add     x0, x0, :lo12:msg_hs_title
                bl      write_str

                // Draw high scores
                mov     w20, 0                  // Score index

draw_menu_hs_loop:
                cmp     w20, 5
                b.ge    draw_menu_hs_done

                // Get high score entry - store pointer in x22 (safer)
                mov     w0, w20
                bl      save_get_high_score
                cbz     x0, draw_menu_hs_next

                mov     x22, x0                 // Save entry pointer in x22

                // Check if score is 0 (empty)
                ldr     w0, [x22, HS_SCORE]
                cbz     w0, draw_menu_hs_next

                // Store score and wave on stack for safety
                ldr     w21, [x22, HS_SCORE]    // w21 = score
                ldrh    w19, [x22, HS_WAVE]     // w19 = wave (temp save)
                str     w19, [sp, 48]           // Save wave to stack

                // Position cursor
                mov     w0, 20
                add     w1, w20, 6              // Row 6, 7, 8, 9, 10
                bl      cursor_move

                mov     w0, COLOR_WHITE
                bl      set_color

                // Draw rank number
                add     w0, w20, 1
                bl      write_num

                adrp    x0, msg_dot
                add     x0, x0, :lo12:msg_dot
                bl      write_str

                // Draw score (from saved w21)
                mov     w0, COLOR_BRIGHT_YELLOW
                bl      set_color

                mov     w0, w21                 // Use saved score
                bl      write_num

                adrp    x0, msg_space
                add     x0, x0, :lo12:msg_space
                bl      write_str

                // Draw wave
                mov     w0, COLOR_CYAN
                bl      set_color

                adrp    x0, msg_wave
                add     x0, x0, :lo12:msg_wave
                bl      write_str

                ldr     w0, [sp, 48]            // Restore wave from stack
                bl      write_num

                adrp    x0, msg_space
                add     x0, x0, :lo12:msg_space
                bl      write_str

                // Draw kills - reload pointer from x22
                mov     w0, COLOR_GREEN
                bl      set_color

                adrp    x0, msg_kills
                add     x0, x0, :lo12:msg_kills
                bl      write_str

                ldr     w0, [x22, HS_KILLS]
                bl      write_num

                adrp    x0, msg_space
                add     x0, x0, :lo12:msg_space
                bl      write_str

                // Draw level - reload from x22
                mov     w0, COLOR_MAGENTA
                bl      set_color

                adrp    x0, msg_level
                add     x0, x0, :lo12:msg_level
                bl      write_str

                ldrh    w0, [x22, HS_LEVEL]
                bl      write_num

draw_menu_hs_next:
                add     w20, w20, 1
                b       draw_menu_hs_loop

draw_menu_hs_done:
                // Check if no scores
                mov     w0, 0
                bl      save_get_high_score
                cbz     x0, draw_no_scores
                ldr     w0, [x0, HS_SCORE]
                cbnz    w0, draw_hs_back_msg

draw_no_scores:
                mov     w0, 30
                mov     w1, 10
                bl      cursor_move

                mov     w0, COLOR_WHITE
                bl      set_color

                adrp    x0, msg_hs_empty
                add     x0, x0, :lo12:msg_hs_empty
                bl      write_str

draw_hs_back_msg:
                // Draw back instruction
                mov     w0, 24
                mov     w1, 20
                bl      cursor_move

                mov     w0, CHROME_COLOR
                bl      set_color

                adrp    x0, msg_menu_back
                add     x0, x0, :lo12:msg_menu_back
                bl      write_str

                bl      reset_color

                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 64
                ret

// play_bell - Play terminal bell sound
                .global play_bell
play_bell:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // The bell is a terminal event, not a cell, so it skips the
                // frame buffer and goes out on its own.
                adrp    x0, bell_char
                add     x0, x0, :lo12:bell_char
                bl      write_str_raw

                ldp     fp, lr, [sp], 16
                ret

