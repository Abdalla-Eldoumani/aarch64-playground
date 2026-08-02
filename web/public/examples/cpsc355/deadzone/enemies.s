// Enemies: a fixed pool of zombies, runners and tanks that spawn from the
// screen edges, walk toward the player, and advance the wave when enough die.
// Also holds the linear congruential generator the whole game draws from.

// Enemy structure offsets
ENEMY_ACTIVE = 0                                // Active flag (1 byte)
ENEMY_TYPE = 1                                  // Enemy type (1 byte)
ENEMY_X = 2                                     // X position (2 bytes, signed)
ENEMY_Y = 4                                     // Y position (2 bytes, signed)
ENEMY_HEALTH = 6                                // Health (1 byte)
ENEMY_SPEED = 7                                 // Movement speed (1 byte)
ENEMY_TIMER = 8                                 // Move timer (1 byte)
ENEMY_XP_VALUE = 9                              // XP when killed (1 byte)
ENEMY_PADDING = 10                              // Padding (6 bytes)
ENEMY_STRUCT_SIZE = 16                          // Total struct size

// Enemy types
ENEMY_TYPE_NONE = 0                             // Empty slot
ENEMY_TYPE_ZOMBIE = 1                           // Basic zombie - slow, weak
ENEMY_TYPE_RUNNER = 2                           // Fast zombie - quick, weak
ENEMY_TYPE_TANK = 3                             // Tank zombie - slow, tough

// Enemy stats
// Zombie (basic)
ZOMBIE_HEALTH = 3                               // Takes 3 hits
ZOMBIE_SPEED = 8                                // Move every 8 frames
ZOMBIE_XP = 10                                  // 10 XP when killed
ZOMBIE_CHAR = 'z'                               // Display character

// Runner (fast)
RUNNER_HEALTH = 1                               // Dies in 1 hit
RUNNER_SPEED = 4                                // Move every 4 frames (balanced)
RUNNER_XP = 15                                  // 15 XP when killed
RUNNER_CHAR = 'r'                               // Display character

// Tank (tough)
TANK_HEALTH = 10                                // Takes 10 hits
TANK_SPEED = 12                                 // Move every 12 frames
TANK_XP = 50                                    // 50 XP when killed
TANK_CHAR = 'Z'                                 // Display character

// Spawn settings
SPAWN_TIMER_INIT = 60                           // Frames between spawns (~2 sec)
SPAWN_TIMER_MIN = 15                            // Minimum spawn delay
ENEMIES_PER_WAVE = 5                            // Base enemies per wave

                .data

// Enemy pool (MAX_ENEMIES * ENEMY_STRUCT_SIZE bytes)
                .balign 8
enemy_pool:     .skip   MAX_ENEMIES * ENEMY_STRUCT_SIZE

// Enemy management
enemy_count:    .word   0                       // Active enemy count
spawn_timer:    .word   SPAWN_TIMER_INIT        // Frames until next spawn
current_wave:   .word   1                       // Current wave number
wave_kills:     .word   0                       // Kills in current wave
wave_target:    .word   ENEMIES_PER_WAVE        // Kills needed for next wave

// Simple random state (LCG)
random_state:   .word   12345                   // Random seed

                .text
                .balign 4

// enemies_init - Initialize enemy system
                .global enemies_init
enemies_init:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Clear enemy pool
                adrp    x0, enemy_pool
                add     x0, x0, :lo12:enemy_pool
                mov     x1, MAX_ENEMIES * ENEMY_STRUCT_SIZE
                mov     w2, 0

enemies_init_loop:
                cbz     x1, enemies_init_done
                strb    w2, [x0], 1
                sub     x1, x1, 1
                b       enemies_init_loop

enemies_init_done:
                // Reset counters
                adrp    x0, enemy_count
                add     x0, x0, :lo12:enemy_count
                mov     w1, 0
                str     w1, [x0]

                adrp    x0, spawn_timer
                add     x0, x0, :lo12:spawn_timer
                mov     w1, SPAWN_TIMER_INIT
                str     w1, [x0]

                adrp    x0, current_wave
                add     x0, x0, :lo12:current_wave
                mov     w1, 1
                str     w1, [x0]

                adrp    x0, wave_kills
                add     x0, x0, :lo12:wave_kills
                mov     w1, 0
                str     w1, [x0]

                adrp    x0, wave_target
                add     x0, x0, :lo12:wave_target
                mov     w1, ENEMIES_PER_WAVE
                str     w1, [x0]

                ldp     fp, lr, [sp], 16
                ret

// enemies_get_count - Get active enemy count
// Returns: w0 = enemy count
                .global enemies_get_count
enemies_get_count:
                adrp    x0, enemy_count
                add     x0, x0, :lo12:enemy_count
                ldr     w0, [x0]
                ret

// enemies_get_wave - Get current wave number
// Returns: w0 = wave number
                .global enemies_get_wave
enemies_get_wave:
                adrp    x0, current_wave
                add     x0, x0, :lo12:current_wave
                ldr     w0, [x0]
                ret

// random_next - Get next random number (simple LCG)
// Returns: w0 = random value
random_next:
                adrp    x0, random_state
                add     x0, x0, :lo12:random_state
                ldr     w1, [x0]

                // LCG: next = (a * current + c) mod m
                // Using a=1103515245, c=12345, m=2^31
                // Load a=1103515245 = 0x41C64E6D in two parts
                movz    w2, 0x4E6D              // Low 16 bits
                movk    w2, 0x41C6, lsl 16      // High 16 bits
                mul     w1, w1, w2
                mov     w2, 12345
                add     w1, w1, w2
                // Mod 2^31 = keep the low 31 bits (AArch64 has no BIC immediate)
                and     w1, w1, 0x7fffffff      // Clear bit 31

                str     w1, [x0]
                mov     w0, w1
                ret

// random_range - Get random number in range [0, max)
// Parameters: w0 = max (exclusive)
// Returns: w0 = random value in range
random_range:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                str     x19, [sp, 16]

                mov     w19, w0                 // Save max
                bl      random_next             // Get random
                udiv    w1, w0, w19             // Divide by max
                msub    w0, w1, w19, w0         // Remainder = random mod max

                ldr     x19, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// enemies_find_slot - Find empty slot in enemy pool
// Returns: x0 = pointer to slot, or 0 if full
enemies_find_slot:
                adrp    x0, enemy_pool
                add     x0, x0, :lo12:enemy_pool
                mov     w1, MAX_ENEMIES

find_slot_loop:
                cbz     w1, find_slot_full
                ldrb    w2, [x0, ENEMY_ACTIVE]
                cbz     w2, find_slot_found     // Found empty slot
                add     x0, x0, ENEMY_STRUCT_SIZE
                sub     w1, w1, 1
                b       find_slot_loop

find_slot_full:
                mov     x0, 0                   // No slot available
find_slot_found:
                ret

// enemies_spawn_one - Spawn a single enemy at random edge
// Parameters: w0 = enemy type
// Returns: w0 = 1 if spawned, 0 if pool full
                .global enemies_spawn_one
enemies_spawn_one:
                stp     fp, lr, [sp, -48]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                str     x21, [sp, 32]

                mov     w19, w0

                // Find empty slot
                bl      enemies_find_slot
                cbz     x0, spawn_fail
                mov     x20, x0

                // Set active and type
                mov     w0, 1
                strb    w0, [x20, ENEMY_ACTIVE]
                strb    w19, [x20, ENEMY_TYPE]

                // Choose random edge (0=top, 1=bottom, 2=left, 3=right)
                mov     w0, 4
                bl      random_range
                mov     w21, w0                 // Save edge choice

                // Generate position based on edge
                cmp     w21, 0
                b.eq    spawn_top
                cmp     w21, 1
                b.eq    spawn_bottom
                cmp     w21, 2
                b.eq    spawn_left
                b       spawn_right

spawn_top:
                // Random X, Y = PLAY_TOP
                mov     w0, PLAY_RIGHT
                sub     w0, w0, PLAY_LEFT
                bl      random_range
                add     w0, w0, PLAY_LEFT
                strh    w0, [x20, ENEMY_X]
                mov     w0, PLAY_TOP
                strh    w0, [x20, ENEMY_Y]
                b       spawn_set_stats

spawn_bottom:
                // Random X, Y = PLAY_BOTTOM
                mov     w0, PLAY_RIGHT
                sub     w0, w0, PLAY_LEFT
                bl      random_range
                add     w0, w0, PLAY_LEFT
                strh    w0, [x20, ENEMY_X]
                mov     w0, PLAY_BOTTOM
                strh    w0, [x20, ENEMY_Y]
                b       spawn_set_stats

spawn_left:
                // X = PLAY_LEFT, random Y
                mov     w0, PLAY_LEFT
                strh    w0, [x20, ENEMY_X]
                mov     w0, PLAY_BOTTOM
                sub     w0, w0, PLAY_TOP
                bl      random_range
                add     w0, w0, PLAY_TOP
                strh    w0, [x20, ENEMY_Y]
                b       spawn_set_stats

spawn_right:
                // X = PLAY_RIGHT, random Y
                mov     w0, PLAY_RIGHT
                strh    w0, [x20, ENEMY_X]
                mov     w0, PLAY_BOTTOM
                sub     w0, w0, PLAY_TOP
                bl      random_range
                add     w0, w0, PLAY_TOP
                strh    w0, [x20, ENEMY_Y]

spawn_set_stats:
                // Set stats based on type
                cmp     w19, ENEMY_TYPE_ZOMBIE
                b.eq    spawn_zombie_stats
                cmp     w19, ENEMY_TYPE_RUNNER
                b.eq    spawn_runner_stats
                cmp     w19, ENEMY_TYPE_TANK
                b.eq    spawn_tank_stats
                b       spawn_zombie_stats      // Default to zombie

spawn_zombie_stats:
                mov     w0, ZOMBIE_HEALTH
                strb    w0, [x20, ENEMY_HEALTH]
                mov     w0, ZOMBIE_SPEED
                strb    w0, [x20, ENEMY_SPEED]
                mov     w0, 0
                strb    w0, [x20, ENEMY_TIMER]
                mov     w0, ZOMBIE_XP
                strb    w0, [x20, ENEMY_XP_VALUE]
                b       spawn_success

spawn_runner_stats:
                mov     w0, RUNNER_HEALTH
                strb    w0, [x20, ENEMY_HEALTH]
                mov     w0, RUNNER_SPEED
                strb    w0, [x20, ENEMY_SPEED]
                mov     w0, 0
                strb    w0, [x20, ENEMY_TIMER]
                mov     w0, RUNNER_XP
                strb    w0, [x20, ENEMY_XP_VALUE]
                b       spawn_success

spawn_tank_stats:
                mov     w0, TANK_HEALTH
                strb    w0, [x20, ENEMY_HEALTH]
                mov     w0, TANK_SPEED
                strb    w0, [x20, ENEMY_SPEED]
                mov     w0, 0
                strb    w0, [x20, ENEMY_TIMER]
                mov     w0, TANK_XP
                strb    w0, [x20, ENEMY_XP_VALUE]

spawn_success:
                // Increment enemy count
                adrp    x0, enemy_count
                add     x0, x0, :lo12:enemy_count
                ldr     w1, [x0]
                add     w1, w1, 1
                str     w1, [x0]

                mov     w0, 1
                b       spawn_done

spawn_fail:
                mov     w0, 0

spawn_done:
                ldr     x21, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 48
                ret

// enemies_spawn_at - Spawn enemy at specific position (for boss minions)
// Parameters: w0 = x, w1 = y, w2 = enemy type
// Returns: w0 = 1 if spawned, 0 if pool full
                .global enemies_spawn_at
enemies_spawn_at:
                stp     fp, lr, [sp, -48]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]

                mov     w19, w0
                mov     w20, w1
                mov     w21, w2                 // Save type

                // Find empty slot
                bl      enemies_find_slot
                cbz     x0, spawn_at_fail
                mov     x22, x0

                // Set active and type
                mov     w0, 1
                strb    w0, [x22, ENEMY_ACTIVE]
                strb    w21, [x22, ENEMY_TYPE]

                // Set position
                strh    w19, [x22, ENEMY_X]
                strh    w20, [x22, ENEMY_Y]

                // Set stats based on type
                cmp     w21, ENEMY_TYPE_ZOMBIE
                b.eq    spawn_at_zombie
                cmp     w21, ENEMY_TYPE_RUNNER
                b.eq    spawn_at_runner
                cmp     w21, ENEMY_TYPE_TANK
                b.eq    spawn_at_tank
                b       spawn_at_zombie         // Default

spawn_at_zombie:
                mov     w0, ZOMBIE_HEALTH
                strb    w0, [x22, ENEMY_HEALTH]
                mov     w0, ZOMBIE_SPEED
                strb    w0, [x22, ENEMY_SPEED]
                mov     w0, 0
                strb    w0, [x22, ENEMY_TIMER]
                mov     w0, ZOMBIE_XP
                strb    w0, [x22, ENEMY_XP_VALUE]
                b       spawn_at_success

spawn_at_runner:
                mov     w0, RUNNER_HEALTH
                strb    w0, [x22, ENEMY_HEALTH]
                mov     w0, RUNNER_SPEED
                strb    w0, [x22, ENEMY_SPEED]
                mov     w0, 0
                strb    w0, [x22, ENEMY_TIMER]
                mov     w0, RUNNER_XP
                strb    w0, [x22, ENEMY_XP_VALUE]
                b       spawn_at_success

spawn_at_tank:
                mov     w0, TANK_HEALTH
                strb    w0, [x22, ENEMY_HEALTH]
                mov     w0, TANK_SPEED
                strb    w0, [x22, ENEMY_SPEED]
                mov     w0, 0
                strb    w0, [x22, ENEMY_TIMER]
                mov     w0, TANK_XP
                strb    w0, [x22, ENEMY_XP_VALUE]

spawn_at_success:
                // Increment enemy count
                adrp    x0, enemy_count
                add     x0, x0, :lo12:enemy_count
                ldr     w1, [x0]
                add     w1, w1, 1
                str     w1, [x0]

                mov     w0, 1
                b       spawn_at_done

spawn_at_fail:
                mov     w0, 0

spawn_at_done:
                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 48
                ret

// enemies_update - Update all enemies (movement toward player)
                .global enemies_update
enemies_update:
                stp     fp, lr, [sp, -64]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]
                stp     x23, x24, [sp, 48]

                // Check if freeze is active (enemies don't move)
                bl      abilities_is_frozen
                cbnz    w0, enemies_spawn_only

                // Get player position
                bl      player_get_x
                mov     w22, w0
                bl      player_get_y
                mov     w23, w0

                // Iterate through enemy pool
                adrp    x19, enemy_pool
                add     x19, x19, :lo12:enemy_pool
                mov     w20, MAX_ENEMIES

update_loop:
                cbz     w20, update_done

                // Check if enemy is active
                ldrb    w0, [x19, ENEMY_ACTIVE]
                cbz     w0, update_next

                // Increment timer
                ldrb    w0, [x19, ENEMY_TIMER]
                add     w0, w0, 1
                strb    w0, [x19, ENEMY_TIMER]

                // Check if time to move
                ldrb    w1, [x19, ENEMY_SPEED]
                cmp     w0, w1
                b.lt    update_next             // Not time to move yet

                // Reset timer
                mov     w0, 0
                strb    w0, [x19, ENEMY_TIMER]

                // Move toward player
                ldrsh   w24, [x19, ENEMY_X]     // Enemy X
                ldrsh   w21, [x19, ENEMY_Y]     // Enemy Y

                // Calculate direction
                mov     w0, 0                   // dx
                mov     w1, 0                   // dy

                // X direction
                cmp     w24, w22
                b.eq    update_check_y
                b.lt    update_move_right
                sub     w0, w0, 1               // Move left
                b       update_check_y
update_move_right:
                add     w0, w0, 1               // Move right

update_check_y:
                cmp     w21, w23
                b.eq    update_apply_move
                b.lt    update_move_down
                sub     w1, w1, 1               // Move up
                b       update_apply_move
update_move_down:
                add     w1, w1, 1               // Move down

update_apply_move:
                // Apply movement
                add     w24, w24, w0
                add     w21, w21, w1
                strh    w24, [x19, ENEMY_X]
                strh    w21, [x19, ENEMY_Y]

update_next:
                add     x19, x19, ENEMY_STRUCT_SIZE
                sub     w20, w20, 1
                b       update_loop

enemies_spawn_only:
                // Skip to spawning when enemies are frozen

update_done:
                // Handle spawning
                bl      enemies_try_spawn

                ldp     x23, x24, [sp, 48]
                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 64
                ret

// enemies_try_spawn - Try to spawn new enemies based on timer
enemies_try_spawn:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Decrement spawn timer
                adrp    x0, spawn_timer
                add     x0, x0, :lo12:spawn_timer
                ldr     w1, [x0]
                subs    w1, w1, 1
                str     w1, [x0]
                b.gt    try_spawn_done          // Not time yet

                // Reset timer (faster for higher waves)
                adrp    x0, current_wave
                add     x0, x0, :lo12:current_wave
                ldr     w2, [x0]

                mov     w1, SPAWN_TIMER_INIT
                sub     w1, w1, w2, lsl 1       // Reduce by wave*2 (balanced)
                cmp     w1, SPAWN_TIMER_MIN
                b.ge    try_spawn_set_timer
                mov     w1, SPAWN_TIMER_MIN

try_spawn_set_timer:
                adrp    x0, spawn_timer
                add     x0, x0, :lo12:spawn_timer
                str     w1, [x0]

                // Spawn an enemy (type based on wave)
                adrp    x0, current_wave
                add     x0, x0, :lo12:current_wave
                ldr     w0, [x0]

                // Wave 1-2: only zombies
                // Wave 3-4: zombies and runners
                // Wave 5+: all types
                cmp     w0, 3
                b.lt    spawn_only_zombie

                cmp     w0, 5
                b.lt    spawn_zombie_or_runner

                // All types
                mov     w0, 3
                bl      random_range
                add     w0, w0, 1               // Type 1-3
                b       do_spawn

spawn_zombie_or_runner:
                mov     w0, 2
                bl      random_range
                add     w0, w0, 1               // Type 1-2
                b       do_spawn

spawn_only_zombie:
                mov     w0, ENEMY_TYPE_ZOMBIE

do_spawn:
                bl      enemies_spawn_one

try_spawn_done:
                ldp     fp, lr, [sp], 16
                ret

// enemies_draw - Draw all active enemies
                .global enemies_draw
enemies_draw:
                stp     fp, lr, [sp, -48]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                str     x21, [sp, 32]

                // Iterate through enemy pool
                adrp    x19, enemy_pool
                add     x19, x19, :lo12:enemy_pool
                mov     w20, MAX_ENEMIES

draw_loop:
                cbz     w20, draw_done

                // Check if enemy is active
                ldrb    w0, [x19, ENEMY_ACTIVE]
                cbz     w0, draw_next

                // Get position
                ldrsh   w0, [x19, ENEMY_X]
                ldrsh   w1, [x19, ENEMY_Y]

                // Move cursor
                bl      cursor_move

                // Set color based on type
                ldrb    w21, [x19, ENEMY_TYPE]
                cmp     w21, ENEMY_TYPE_ZOMBIE
                b.eq    draw_zombie_color
                cmp     w21, ENEMY_TYPE_RUNNER
                b.eq    draw_runner_color
                cmp     w21, ENEMY_TYPE_TANK
                b.eq    draw_tank_color
                b       draw_zombie_color       // Default

draw_zombie_color:
                // The tiers run up the heat scale: dull red, hot red, molten
                mov     w0, COLOR_RED
                bl      set_color
                mov     w0, ZOMBIE_CHAR
                b       draw_enemy_char

draw_runner_color:
                mov     w0, COLOR_BRIGHT_RED
                bl      set_color
                mov     w0, RUNNER_CHAR
                b       draw_enemy_char

draw_tank_color:
                mov     w0, COLOR_BRIGHT_YELLOW
                bl      set_color
                mov     w0, TANK_CHAR

draw_enemy_char:
                bl      write_char

draw_next:
                add     x19, x19, ENEMY_STRUCT_SIZE
                sub     w20, w20, 1
                b       draw_loop

draw_done:
                ldr     x21, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 48
                ret

// enemies_check_collision - Check if position hits an enemy
// Parameters: w0 = x, w1 = y
// Returns: w0 = slot index if hit, or -1 if no hit
                .global enemies_check_collision
enemies_check_collision:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]

                mov     w19, w0
                mov     w20, w1

                // Every live projectile runs this scan every frame, so it pays
                // to stop as soon as the pool cannot hold another live enemy.
                // enemy_count is kept in step with ENEMY_ACTIVE at every spawn,
                // kill and bomb, so once that many active slots have been seen
                // the rest of the pool is empty.
                adrp    x3, enemy_count
                add     x3, x3, :lo12:enemy_count
                ldr     w3, [x3]                // Live enemies remaining
                cmp     w3, 0
                b.le    collision_none

                adrp    x0, enemy_pool
                add     x0, x0, :lo12:enemy_pool
                mov     w1, 0

collision_loop:
                cmp     w1, MAX_ENEMIES
                b.ge    collision_none

                // Dead slots are the common case, so reject them first
                ldrb    w2, [x0, ENEMY_ACTIVE]
                cbz     w2, collision_next

                // One live enemy accounted for
                sub     w3, w3, 1

                // Single-axis reject before touching the second coordinate
                ldrsh   w2, [x0, ENEMY_X]
                cmp     w2, w19
                b.ne    collision_seen

                // Check Y
                ldrsh   w2, [x0, ENEMY_Y]
                cmp     w2, w20
                b.ne    collision_seen

                // Hit!
                mov     w0, w1
                b       collision_done

collision_seen:
                cbz     w3, collision_none      // No live enemies left to find

collision_next:
                add     x0, x0, ENEMY_STRUCT_SIZE
                add     w1, w1, 1
                b       collision_loop

collision_none:
                mov     w0, -1                  // No hit

collision_done:
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret
