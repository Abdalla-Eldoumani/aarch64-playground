// The two special abilities: the bomb that clears the screen and the freeze
// that stops every enemy, both on cooldowns counted in frames.

// Ability constants
ABILITY_BOMB = 1                                // Screen clear bomb
ABILITY_FREEZE = 2                              // Freeze enemies

// Cooldowns, counted in frames. Deriving them from TARGET_FPS keeps the
// durations here and the seconds the HUD prints tied to the same frame rate.
BOMB_COOLDOWN = 20 * TARGET_FPS                 // 20 seconds
FREEZE_COOLDOWN = 15 * TARGET_FPS               // 15 seconds
FREEZE_DURATION = 3 * TARGET_FPS                // 3 seconds

// Key bindings
KEY_BOMB = ' '                                  // Spacebar
KEY_FREEZE = 'f'                                // F key

                .data
                .balign 4

// Ability cooldowns (0 = ready)
bomb_cooldown:  .word   0                       // Frames until bomb ready
freeze_cooldown: .word  0                       // Frames until freeze ready

// Freeze state
freeze_active:  .word   0                       // Is freeze active (1/0)
freeze_timer:   .word   0                       // Frames remaining in freeze

                .text

// Strings for HUD display
                .balign 4
ability_hud_fmt: .string "[SPACE]"
ability_hud_ready: .string "READY"
ability_hud_freeze_key: .string "[F]"
ability_hud_active: .string "ACTIVE!"

                .balign 4

// abilities_init - Initialize ability system
                .global abilities_init
abilities_init:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Reset cooldowns
                adrp    x0, bomb_cooldown
                add     x0, x0, :lo12:bomb_cooldown
                mov     w1, 0
                str     w1, [x0]

                adrp    x0, freeze_cooldown
                add     x0, x0, :lo12:freeze_cooldown
                str     w1, [x0]

                // Reset freeze state
                adrp    x0, freeze_active
                add     x0, x0, :lo12:freeze_active
                str     w1, [x0]

                adrp    x0, freeze_timer
                add     x0, x0, :lo12:freeze_timer
                str     w1, [x0]

                ldp     fp, lr, [sp], 16
                ret

// abilities_update - Update cooldowns and freeze state
// Called every frame
                .global abilities_update
abilities_update:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Update bomb cooldown
                adrp    x0, bomb_cooldown
                add     x0, x0, :lo12:bomb_cooldown
                ldr     w1, [x0]
                cbz     w1, ability_update_freeze_cd
                sub     w1, w1, 1
                str     w1, [x0]

ability_update_freeze_cd:
                // Update freeze cooldown
                adrp    x0, freeze_cooldown
                add     x0, x0, :lo12:freeze_cooldown
                ldr     w1, [x0]
                cbz     w1, ability_update_freeze_timer
                sub     w1, w1, 1
                str     w1, [x0]

ability_update_freeze_timer:
                // Update freeze effect timer
                adrp    x0, freeze_active
                add     x0, x0, :lo12:freeze_active
                ldr     w1, [x0]
                cbz     w1, abilities_update_done

                // Freeze is active, decrement timer
                adrp    x0, freeze_timer
                add     x0, x0, :lo12:freeze_timer
                ldr     w1, [x0]
                sub     w1, w1, 1
                str     w1, [x0]

                // Check if freeze ended
                cbnz    w1, abilities_update_done

                // Freeze ended
                adrp    x0, freeze_active
                add     x0, x0, :lo12:freeze_active
                mov     w1, 0
                str     w1, [x0]

abilities_update_done:
                ldp     fp, lr, [sp], 16
                ret

// abilities_check_input - Check for ability key presses
// Parameters: w0 = key pressed
                .global abilities_check_input
abilities_check_input:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                str     x19, [sp, 16]

                mov     w19, w0

                // Check for bomb (spacebar)
                cmp     w19, KEY_BOMB
                b.ne    check_freeze_key
                bl      abilities_use_bomb
                b       abilities_input_done

check_freeze_key:
                // Check for freeze (F)
                cmp     w19, KEY_FREEZE
                b.ne    abilities_input_done
                bl      abilities_use_freeze

abilities_input_done:
                ldr     x19, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// abilities_use_bomb - Activate screen clear bomb
// Kills all enemies on screen with massive explosion
                .global abilities_use_bomb
abilities_use_bomb:
                stp     fp, lr, [sp, -64]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]
                str     x23, [sp, 48]

                // Check cooldown
                adrp    x0, bomb_cooldown
                add     x0, x0, :lo12:bomb_cooldown
                ldr     w1, [x0]
                cbnz    w1, bomb_not_ready

                // Bomb is ready! Trigger screen shake
                mov     w0, 15                  // Strong shake
                bl      effects_trigger_shake

                // Kill all enemies and spawn explosions
                adrp    x19, enemy_pool
                add     x19, x19, :lo12:enemy_pool
                mov     w20, MAX_ENEMIES
                mov     w21, 0

bomb_kill_loop:
                cbz     w20, bomb_kill_done

                // Check if enemy is active
                ldrb    w0, [x19, ENEMY_ACTIVE]
                cbz     w0, bomb_next_enemy

                // Get enemy position for explosion
                ldrsh   w22, [x19, ENEMY_X]
                ldrsh   w23, [x19, ENEMY_Y]

                // Spawn explosion at enemy location
                mov     w0, w22
                mov     w1, w23
                mov     w2, 0                   // Type for normal explosion
                bl      effects_spawn_explosion

                // Kill the enemy (deactivate)
                mov     w0, 0
                strb    w0, [x19, ENEMY_ACTIVE]

                // Increment kill count
                add     w21, w21, 1

                // Award XP (small amount per enemy)
                mov     w0, 5
                bl      player_add_xp

                // Add to kill counter
                bl      player_add_kill

bomb_next_enemy:
                add     x19, x19, ENEMY_STRUCT_SIZE
                sub     w20, w20, 1
                b       bomb_kill_loop

bomb_kill_done:
                // Update enemy count to 0
                adrp    x0, enemy_count
                add     x0, x0, :lo12:enemy_count
                mov     w1, 0
                str     w1, [x0]

                // Add kills to wave kills
                adrp    x0, wave_kills
                add     x0, x0, :lo12:wave_kills
                ldr     w1, [x0]
                add     w1, w1, w21
                str     w1, [x0]

                // Set cooldown
                adrp    x0, bomb_cooldown
                add     x0, x0, :lo12:bomb_cooldown
                mov     w1, BOMB_COOLDOWN
                str     w1, [x0]

                // Play sound (bell)
                bl      play_bell

bomb_not_ready:
                ldr     x23, [sp, 48]
                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 64
                ret

// abilities_use_freeze - Activate freeze ability
// Freezes all enemies for FREEZE_DURATION frames
                .global abilities_use_freeze
abilities_use_freeze:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Check cooldown
                adrp    x0, freeze_cooldown
                add     x0, x0, :lo12:freeze_cooldown
                ldr     w1, [x0]
                cbnz    w1, freeze_not_ready

                // Check if already active
                adrp    x0, freeze_active
                add     x0, x0, :lo12:freeze_active
                ldr     w1, [x0]
                cbnz    w1, freeze_not_ready

                // Activate freeze!
                mov     w1, 1
                str     w1, [x0]

                // Set freeze timer
                adrp    x0, freeze_timer
                add     x0, x0, :lo12:freeze_timer
                mov     w1, FREEZE_DURATION
                str     w1, [x0]

                // Set cooldown
                adrp    x0, freeze_cooldown
                add     x0, x0, :lo12:freeze_cooldown
                mov     w1, FREEZE_COOLDOWN
                str     w1, [x0]

                // Play sound (bell)
                bl      play_bell

freeze_not_ready:
                ldp     fp, lr, [sp], 16
                ret

// abilities_is_frozen - Check if freeze is active
// Returns: w0 = 1 if frozen, 0 if not
                .global abilities_is_frozen
abilities_is_frozen:
                adrp    x0, freeze_active
                add     x0, x0, :lo12:freeze_active
                ldr     w0, [x0]
                ret

// abilities_draw_hud - Draw ability status on HUD
// Shows cooldown status for bomb and freeze
                .global abilities_draw_hud
abilities_draw_hud:
                stp     fp, lr, [sp, -48]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]

                // Draw bomb status on last row
                mov     w0, 2
                mov     w1, SCREEN_HEIGHT - 1
                bl      cursor_move

                // Draw [SPACE] label
                mov     w0, COLOR_CYAN
                bl      set_color
                adrp    x0, ability_hud_fmt
                add     x0, x0, :lo12:ability_hud_fmt
                bl      write_str

                // Check bomb cooldown
                adrp    x0, bomb_cooldown
                add     x0, x0, :lo12:bomb_cooldown
                ldr     w19, [x0]

                cbz     w19, bomb_status_ready

                // On cooldown - show seconds remaining
                mov     w0, COLOR_RED
                bl      set_color

                // Calculate seconds (frames / TARGET_FPS)
                mov     w0, w19
                mov     w1, TARGET_FPS
                udiv    w0, w0, w1
                add     w0, w0, 1               // Round up

                // Print cooldown number using write_num
                bl      write_num

                // Print 's' suffix and padding to clear "READY"/"ACTIVE!" leftovers
                mov     w0, 's'
                bl      write_char
                mov     w0, ' '
                bl      write_char
                mov     w0, ' '
                bl      write_char
                mov     w0, ' '
                bl      write_char
                mov     w0, ' '
                bl      write_char
                b       draw_freeze_status

bomb_status_ready:
                // Ready - show READY in green
                mov     w0, COLOR_GREEN
                bl      set_color
                adrp    x0, ability_hud_ready
                add     x0, x0, :lo12:ability_hud_ready
                bl      write_str

draw_freeze_status:
                // Draw freeze status next to bomb
                mov     w0, 22
                mov     w1, SCREEN_HEIGHT - 1
                bl      cursor_move

                // Draw [F] label
                mov     w0, COLOR_CYAN
                bl      set_color
                adrp    x0, ability_hud_freeze_key
                add     x0, x0, :lo12:ability_hud_freeze_key
                bl      write_str

                // Check if freeze is active
                adrp    x0, freeze_active
                add     x0, x0, :lo12:freeze_active
                ldr     w20, [x0]
                cbnz    w20, freeze_status_active

                // Check freeze cooldown
                adrp    x0, freeze_cooldown
                add     x0, x0, :lo12:freeze_cooldown
                ldr     w19, [x0]

                cbz     w19, freeze_status_ready

                // On cooldown
                mov     w0, COLOR_RED
                bl      set_color

                // Calculate seconds (frames / TARGET_FPS)
                mov     w0, w19
                mov     w1, TARGET_FPS
                udiv    w0, w0, w1
                add     w0, w0, 1

                // Print cooldown number using write_num
                bl      write_num

                // Print 's' suffix and padding to clear "READY"/"ACTIVE!" leftovers
                mov     w0, 's'
                bl      write_char
                mov     w0, ' '
                bl      write_char
                mov     w0, ' '
                bl      write_char
                mov     w0, ' '
                bl      write_char
                mov     w0, ' '
                bl      write_char
                b       abilities_hud_done

freeze_status_ready:
                mov     w0, COLOR_GREEN
                bl      set_color
                adrp    x0, ability_hud_ready
                add     x0, x0, :lo12:ability_hud_ready
                bl      write_str
                b       abilities_hud_done

freeze_status_active:
                // Freeze is active - show ACTIVE! in bright cyan
                mov     w0, COLOR_BRIGHT_CYAN
                bl      set_color
                adrp    x0, ability_hud_active
                add     x0, x0, :lo12:ability_hud_active
                bl      write_str

abilities_hud_done:
                // Reset color
                mov     w0, COLOR_RESET
                bl      set_color

                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 48
                ret

