// Projectiles: the auto-fire that picks the nearest enemy, projectile
// movement and lifetime, and the collision pass that damages boss or enemy.

// Projectile structure offsets
PROJ_ACTIVE = 0                                 // Active flag (1 byte)
PROJ_X = 2                                      // X position (2 bytes, signed)
PROJ_Y = 4                                      // Y position (2 bytes, signed)
PROJ_DX = 6                                     // X velocity (2 bytes, signed)
PROJ_DY = 8                                     // Y velocity (2 bytes, signed)
PROJ_DAMAGE = 10                                // Damage amount (1 byte)
PROJ_SPEED = 11                                 // Movement speed (1 byte)
PROJ_TIMER = 12                                 // Move timer (1 byte)
PROJ_TYPE = 13                                  // Projectile type (1 byte)
PROJ_PADDING = 14                               // Padding (2 bytes)
PROJ_STRUCT_SIZE = 16                           // Total struct size

// Projectile types
PROJ_TYPE_BULLET = 1                            // Basic bullet
PROJ_TYPE_ARROW = 2                             // Arrow (piercing)
PROJ_TYPE_MAGIC = 3                             // Magic bolt (area)

// Projectile stats
BULLET_DAMAGE = 1                               // Damage per hit
BULLET_SPEED = 2                                // Move every 2 frames (fast)
BULLET_CHAR = '-'                               // Horizontal bullet
BULLET_CHAR_V = '|'                             // Vertical bullet
BULLET_CHAR_D = '\\'                            // Diagonal bullet
BULLET_CHAR_D2 = '/'                            // Other diagonal

// Weapon settings
FIRE_RATE = 10                                  // Frames between shots
MAX_PROJECTILES = 50                            // Maximum projectiles

                .data

// Projectile pool
                .balign 8
projectile_pool: .skip  MAX_PROJECTILES * PROJ_STRUCT_SIZE

// Weapon state
fire_timer:     .word   0                       // Frames until next shot
proj_count:     .word   0                       // Active projectile count

                .text
                .balign 4

// projectiles_init - Initialize projectile system
                .global projectiles_init
projectiles_init:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Clear projectile pool
                adrp    x0, projectile_pool
                add     x0, x0, :lo12:projectile_pool
                mov     x1, MAX_PROJECTILES * PROJ_STRUCT_SIZE
                mov     w2, 0

proj_init_loop:
                cbz     x1, proj_init_done
                strb    w2, [x0], 1
                sub     x1, x1, 1
                b       proj_init_loop

proj_init_done:
                // Reset counters
                adrp    x0, fire_timer
                add     x0, x0, :lo12:fire_timer
                mov     w1, 0
                str     w1, [x0]

                adrp    x0, proj_count
                add     x0, x0, :lo12:proj_count
                str     w1, [x0]

                ldp     fp, lr, [sp], 16
                ret

// projectiles_find_slot - Find empty slot in projectile pool
// Returns: x0 = pointer to slot, or 0 if full
projectiles_find_slot:
                adrp    x0, projectile_pool
                add     x0, x0, :lo12:projectile_pool
                mov     w1, MAX_PROJECTILES

find_proj_slot_loop:
                cbz     w1, find_proj_slot_full
                ldrb    w2, [x0, PROJ_ACTIVE]
                cbz     w2, find_proj_slot_found
                add     x0, x0, PROJ_STRUCT_SIZE
                sub     w1, w1, 1
                b       find_proj_slot_loop

find_proj_slot_full:
                mov     x0, 0
find_proj_slot_found:
                ret

// projectiles_fire - Fire a projectile from player toward target
// Parameters: w0 = target_x, w1 = target_y
// Returns: w0 = 1 if fired, 0 if failed
                .global projectiles_fire
projectiles_fire:
                stp     fp, lr, [sp, -48]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]

                mov     w21, w0                 // Save target X
                mov     w22, w1                 // Save target Y

                // Find empty slot
                bl      projectiles_find_slot
                cbz     x0, proj_fire_fail
                mov     x19, x0

                // Get player position
                bl      player_get_x
                mov     w20, w0
                bl      player_get_y

                // Store player position as projectile start
                strh    w20, [x19, PROJ_X]
                strh    w0, [x19, PROJ_Y]

                // Calculate direction to target
                // dx = sign(target_x - player_x)
                // dy = sign(target_y - player_y)
                sub     w0, w21, w20            // target_x - player_x
                cmp     w0, 0
                b.eq    proj_dx_zero
                b.lt    proj_dx_neg
                mov     w0, 1                   // dx = 1
                b       proj_calc_dy
proj_dx_neg:
                mov     w0, -1                  // dx = -1
                b       proj_calc_dy
proj_dx_zero:
                mov     w0, 0                   // dx = 0

proj_calc_dy:
                strh    w0, [x19, PROJ_DX]      // Store dx

                bl      player_get_y
                sub     w1, w22, w0             // target_y - player_y
                cmp     w1, 0
                b.eq    proj_dy_zero
                b.lt    proj_dy_neg
                mov     w1, 1                   // dy = 1
                b       proj_store_dy
proj_dy_neg:
                mov     w1, -1                  // dy = -1
                b       proj_store_dy
proj_dy_zero:
                mov     w1, 0                   // dy = 0

proj_store_dy:
                strh    w1, [x19, PROJ_DY]      // Store dy

                // If both dx and dy are 0, don't fire
                ldrsh   w0, [x19, PROJ_DX]
                ldrsh   w1, [x19, PROJ_DY]
                orr     w0, w0, w1
                cbz     w0, proj_fire_fail_cleanup

                // Set projectile properties
                mov     w0, 1
                strb    w0, [x19, PROJ_ACTIVE]

                // Get damage from upgrades
                bl      upgrades_get_damage
                strb    w0, [x19, PROJ_DAMAGE]

                // Get speed from upgrades
                bl      upgrades_get_proj_speed
                strb    w0, [x19, PROJ_SPEED]

                mov     w0, 0
                strb    w0, [x19, PROJ_TIMER]
                mov     w0, PROJ_TYPE_BULLET
                strb    w0, [x19, PROJ_TYPE]

                // Increment count
                adrp    x0, proj_count
                add     x0, x0, :lo12:proj_count
                ldr     w1, [x0]
                add     w1, w1, 1
                str     w1, [x0]

                mov     w0, 1
                b       proj_fire_done

proj_fire_fail_cleanup:
                mov     w0, 0
                strb    w0, [x19, PROJ_ACTIVE]

proj_fire_fail:
                mov     w0, 0

proj_fire_done:
                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 48
                ret

// find_nearest_enemy - Find the nearest active enemy to player
// Returns: w0 = enemy X, w1 = enemy Y, w2 = 1 if found, 0 if none
                .global find_nearest_enemy
find_nearest_enemy:
                stp     fp, lr, [sp, -64]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]
                stp     x23, x24, [sp, 48]

                // Get player position
                bl      player_get_x
                mov     w19, w0
                bl      player_get_y
                mov     w20, w0

                // Initialize search
                mov     w21, 0x7FFF             // Best distance (max)
                mov     w22, 0                  // Best enemy X
                mov     w23, 0                  // Best enemy Y
                mov     w24, 0                  // Found flag

                // Iterate through enemy pool
                adrp    x0, enemy_pool
                add     x0, x0, :lo12:enemy_pool
                mov     w1, MAX_ENEMIES

find_enemy_loop:
                cbz     w1, find_enemy_done

                // Check if active
                ldrb    w2, [x0, ENEMY_ACTIVE]
                cbz     w2, find_enemy_next

                // Get enemy position
                ldrsh   w2, [x0, ENEMY_X]       // Enemy X
                ldrsh   w3, [x0, ENEMY_Y]       // Enemy Y

                // Calculate Manhattan distance
                sub     w4, w2, w19             // dx = ex - px
                cmp     w4, 0
                b.ge    find_abs_dx_done
                neg     w4, w4                  // abs(dx)
find_abs_dx_done:
                sub     w5, w3, w20             // dy = ey - py
                cmp     w5, 0
                b.ge    find_abs_dy_done
                neg     w5, w5                  // abs(dy)
find_abs_dy_done:
                add     w4, w4, w5              // distance = |dx| + |dy|

                // Check if better
                cmp     w4, w21
                b.ge    find_enemy_next

                // New best enemy
                mov     w21, w4                 // Best distance
                mov     w22, w2                 // Best X
                mov     w23, w3                 // Best Y
                mov     w24, 1                  // Found

find_enemy_next:
                add     x0, x0, ENEMY_STRUCT_SIZE
                sub     w1, w1, 1
                b       find_enemy_loop

find_enemy_done:
                mov     w0, w22                 // Return X
                mov     w1, w23                 // Return Y
                mov     w2, w24                 // Return found flag

                ldp     x23, x24, [sp, 48]
                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 64
                ret

// projectiles_update - Update all projectiles and auto-fire
                .global projectiles_update
projectiles_update:
                stp     fp, lr, [sp, -80]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]
                stp     x23, x24, [sp, 48]
                str     x25, [sp, 64]

                // Handle auto-fire
                bl      projectiles_try_fire

                // Iterate through projectile pool
                adrp    x19, projectile_pool
                add     x19, x19, :lo12:projectile_pool
                mov     w20, MAX_PROJECTILES

proj_update_loop:
                cbz     w20, proj_update_done

                // Check if active
                ldrb    w0, [x19, PROJ_ACTIVE]
                cbz     w0, proj_update_next

                // Increment timer
                ldrb    w0, [x19, PROJ_TIMER]
                add     w0, w0, 1
                strb    w0, [x19, PROJ_TIMER]

                // Check if time to move
                ldrb    w1, [x19, PROJ_SPEED]
                cmp     w0, w1
                b.lt    proj_check_collision

                // Reset timer and move
                mov     w0, 0
                strb    w0, [x19, PROJ_TIMER]

                // Load position and velocity
                ldrsh   w21, [x19, PROJ_X]
                ldrsh   w22, [x19, PROJ_Y]
                ldrsh   w23, [x19, PROJ_DX]
                ldrsh   w24, [x19, PROJ_DY]

                // Update position
                add     w21, w21, w23
                add     w22, w22, w24
                strh    w21, [x19, PROJ_X]
                strh    w22, [x19, PROJ_Y]

                // Check bounds
                cmp     w21, PLAY_LEFT
                b.lt    proj_deactivate
                cmp     w21, PLAY_RIGHT
                b.gt    proj_deactivate
                cmp     w22, PLAY_TOP
                b.lt    proj_deactivate
                cmp     w22, PLAY_BOTTOM
                b.gt    proj_deactivate

proj_check_collision:
                // Get projectile position
                ldrsh   w0, [x19, PROJ_X]
                ldrsh   w1, [x19, PROJ_Y]
                mov     w23, w0
                mov     w24, w1

                // Check collision with boss first
                bl      boss_check_collision
                cbz     w0, proj_check_enemies  // No boss hit, check enemies

                // Hit the boss!
                ldrb    w22, [x19, PROJ_DAMAGE] // Get projectile damage

                // Spawn floating damage number
                mov     w0, w23
                mov     w1, w24
                mov     w2, w22                 // Damage value
                bl      effects_spawn_damage_num

                // Damage the boss
                mov     w0, w22
                bl      boss_damage

                // Check if boss died (returns XP if dead)
                cbz     w0, proj_deactivate     // Boss alive, just deactivate projectile

                // Boss died! Spawn big explosion
                mov     w0, w23
                mov     w1, w24
                mov     w2, 99                  // Special type for boss explosion
                bl      effects_spawn_explosion

                // Trigger boss kill achievement
                bl      achievements_on_boss_kill

                // Award XP for boss kill (value returned from boss_damage)
                mov     w0, 100                 // Boss XP reward
                bl      player_add_xp

                // Increment kill count
                bl      player_add_kill

                b       proj_deactivate

proj_check_enemies:
                // Check collision with enemies
                mov     w0, w23                 // Restore X
                mov     w1, w24                 // Restore Y
                bl      enemies_check_collision
                cmp     w0, -1
                b.eq    proj_update_next

                // Hit an enemy!
                mov     w21, w0                 // Save enemy slot

                // Get projectile damage
                ldrb    w22, [x19, PROJ_DAMAGE]

                // Spawn floating damage number
                mov     w0, w23
                mov     w1, w24
                mov     w2, w22                 // Damage value
                bl      effects_spawn_damage_num

                // Damage the enemy
                mov     w0, w21
                mov     w1, w22
                bl      enemy_damage

                // Check if enemy died (returns XP if dead)
                cmp     w0, 0
                b.eq    proj_deactivate         // Enemy not dead, just deactivate projectile

                // Save XP value before calling effects (w0 will be clobbered)
                mov     w25, w0                 // w25 = XP value

                // Enemy died - spawn explosion effect!
                mov     w0, w23
                mov     w1, w24
                mov     w2, 0                   // Enemy type (could get from slot)
                bl      effects_spawn_explosion

                // Enemy died - add XP to player
                mov     w0, w25                 // Restore XP value
                bl      player_add_xp

                // Increment player kill count
                bl      player_add_kill

                // Deactivate projectile after hit
                b       proj_deactivate

proj_update_next:
                add     x19, x19, PROJ_STRUCT_SIZE
                sub     w20, w20, 1
                b       proj_update_loop

proj_deactivate:
                // Deactivate this projectile
                mov     w0, 0
                strb    w0, [x19, PROJ_ACTIVE]

                // Decrement count
                adrp    x0, proj_count
                add     x0, x0, :lo12:proj_count
                ldr     w1, [x0]
                sub     w1, w1, 1
                str     w1, [x0]

                b       proj_update_next

proj_update_done:
                ldr     x25, [sp, 64]
                ldp     x23, x24, [sp, 48]
                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 80
                ret

// projectiles_try_fire - Try to auto-fire at nearest enemy
projectiles_try_fire:
                stp     fp, lr, [sp, -48]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]

                // Decrement fire timer
                adrp    x0, fire_timer
                add     x0, x0, :lo12:fire_timer
                ldr     w1, [x0]
                cbz     w1, try_fire_ready
                sub     w1, w1, 1
                str     w1, [x0]
                b       try_fire_done

try_fire_ready:
                // Find nearest enemy
                bl      find_nearest_enemy
                cbz     w2, try_fire_done       // No enemies

                // Save target position
                mov     w19, w0                 // Target X
                mov     w20, w1                 // Target Y

                // Fire main projectile
                mov     w0, w19
                mov     w1, w20
                bl      projectiles_fire

                // Check for multi-shot upgrade
                bl      upgrades_get_multi_shot
                cbz     w0, try_fire_reset      // No extra shots

                // Fire additional projectiles with slight offset
                mov     w21, w0                 // Extra shot count

multi_shot_loop:
                cbz     w21, try_fire_reset

                // Fire with Y offset (spread pattern)
                mov     w0, w19
                add     w1, w20, w21            // Offset Y by shot number
                bl      projectiles_fire

                // Fire with negative Y offset too if more than 1 extra
                cmp     w21, 1
                b.le    multi_shot_next
                mov     w0, w19
                sub     w1, w20, w21            // Negative offset
                bl      projectiles_fire

multi_shot_next:
                sub     w21, w21, 1
                b       multi_shot_loop

try_fire_reset:
                // Reset fire timer using upgrade value
                bl      upgrades_get_fire_rate
                adrp    x1, fire_timer
                add     x1, x1, :lo12:fire_timer
                str     w0, [x1]

try_fire_done:
                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 48
                ret

// projectiles_draw - Draw all active projectiles
                .global projectiles_draw
projectiles_draw:
                stp     fp, lr, [sp, -48]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]

                // Iterate through projectile pool
                adrp    x19, projectile_pool
                add     x19, x19, :lo12:projectile_pool
                mov     w20, MAX_PROJECTILES

proj_draw_loop:
                cbz     w20, proj_draw_done

                // Check if active
                ldrb    w0, [x19, PROJ_ACTIVE]
                cbz     w0, proj_draw_next

                // Get position
                ldrsh   w0, [x19, PROJ_X]
                ldrsh   w1, [x19, PROJ_Y]

                // Move cursor
                bl      cursor_move

                // Set color (bright white for bullets)
                mov     w0, COLOR_BRIGHT_WHITE
                bl      set_color

                // Choose character based on direction
                ldrsh   w21, [x19, PROJ_DX]
                ldrsh   w22, [x19, PROJ_DY]

                // Horizontal movement
                cbz     w22, proj_char_horiz
                // Vertical movement
                cbz     w21, proj_char_vert
                // Diagonal movement
                cmp     w21, w22
                b.eq    proj_char_diag1
                b       proj_char_diag2

proj_char_horiz:
                mov     w0, BULLET_CHAR         // '-'
                b       proj_draw_char

proj_char_vert:
                mov     w0, BULLET_CHAR_V       // '|'
                b       proj_draw_char

proj_char_diag1:
                mov     w0, BULLET_CHAR_D       // '\'
                b       proj_draw_char

proj_char_diag2:
                mov     w0, BULLET_CHAR_D2      // '/'

proj_draw_char:
                bl      write_char

proj_draw_next:
                add     x19, x19, PROJ_STRUCT_SIZE
                sub     w20, w20, 1
                b       proj_draw_loop

proj_draw_done:
                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 48
                ret

// enemy_damage - Damage an enemy
// Parameters: w0 = enemy slot index, w1 = damage amount
// Returns: w0 = XP if enemy died, 0 if still alive
                .global enemy_damage
enemy_damage:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                str     x19, [sp, 16]

                // Get enemy slot pointer
                adrp    x2, enemy_pool
                add     x2, x2, :lo12:enemy_pool
                mov     w3, ENEMY_STRUCT_SIZE
                mul     w3, w0, w3
                add     x19, x2, x3             // x19 = enemy pointer

                // Get current health
                ldrb    w2, [x19, ENEMY_HEALTH]
                subs    w2, w2, w1              // health -= damage

                b.le    enemy_killed

                // Still alive
                strb    w2, [x19, ENEMY_HEALTH]
                mov     w0, 0                   // Return 0 (alive)
                b       enemy_damage_done

enemy_killed:
                // Get XP value before killing
                ldrb    w0, [x19, ENEMY_XP_VALUE]

                // Deactivate enemy
                mov     w1, 0
                strb    w1, [x19, ENEMY_ACTIVE]

                // Decrement enemy count
                adrp    x1, enemy_count
                add     x1, x1, :lo12:enemy_count
                ldr     w2, [x1]
                sub     w2, w2, 1
                str     w2, [x1]

                // Increment wave kills
                adrp    x1, wave_kills
                add     x1, x1, :lo12:wave_kills
                ldr     w2, [x1]
                add     w2, w2, 1
                str     w2, [x1]

                // Check for wave completion
                adrp    x1, wave_target
                add     x1, x1, :lo12:wave_target
                ldr     w3, [x1]
                cmp     w2, w3
                b.lt    enemy_damage_done

                // Wave complete!
                // Trigger wave complete achievement check
                bl      achievements_on_wave_complete

                adrp    x1, current_wave
                add     x1, x1, :lo12:current_wave
                ldr     w2, [x1]
                add     w2, w2, 1
                str     w2, [x1]

                // Check if boss should spawn for this wave
                mov     w0, w2
                bl      boss_check_spawn

                // Reset wave kills
                adrp    x1, wave_kills
                add     x1, x1, :lo12:wave_kills
                mov     w2, 0
                str     w2, [x1]

                // Increase wave target
                adrp    x1, wave_target
                add     x1, x1, :lo12:wave_target
                ldr     w2, [x1]
                add     w2, w2, ENEMIES_PER_WAVE
                str     w2, [x1]

enemy_damage_done:
                ldr     x19, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret
