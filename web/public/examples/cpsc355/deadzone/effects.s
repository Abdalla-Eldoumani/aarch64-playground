// Visual effects: explosion particles, floating damage numbers, and the
// screen shake that offsets everything drawn through effects_cursor_move.

// Particle structure (8 bytes)
PARTICLE_X = 0                                  // X position (2 bytes, signed)
PARTICLE_Y = 2                                  // Y position (2 bytes, signed)
PARTICLE_VX = 4                                 // X velocity (1 byte, signed)
PARTICLE_VY = 5                                 // Y velocity (1 byte, signed)
PARTICLE_LIFE = 6                               // Frames remaining (1 byte)
PARTICLE_CHAR = 7                               // Character to display (1 byte)
PARTICLE_SIZE = 8                               // Total structure size

// Damage number structure (8 bytes)
DMGNUM_X = 0                                    // X position (2 bytes)
DMGNUM_Y = 2                                    // Y position (2 bytes)
DMGNUM_VALUE = 4                                // Damage value (2 bytes)
DMGNUM_LIFE = 6                                 // Frames remaining (1 byte)
DMGNUM_COLOR = 7                                // Color code (1 byte)
DMGNUM_SIZE = 8                                 // Total structure size

// Effect limits
MAX_PARTICLES = 128                             // Maximum particles
MAX_DAMAGE_NUMS = 20                            // Maximum damage numbers

// Particle life/timing
PARTICLE_MAX_LIFE = 12                          // Frames particle lives
DMGNUM_MAX_LIFE = 20                            // Frames damage number shows
SHAKE_DURATION = 8                              // Frames of screen shake

                .data

// Particle pool (128 * 8 = 1024 bytes)
                .balign 8
particle_pool:  .skip   MAX_PARTICLES * PARTICLE_SIZE

// Damage number pool (20 * 8 = 160 bytes)
                .balign 8
dmgnum_pool:    .skip   MAX_DAMAGE_NUMS * DMGNUM_SIZE

// Particle count (for quick checks)
particle_count: .word   0

// Screen shake state
shake_intensity: .word  0                       // Current shake level (0-3)
shake_timer:    .word   0                       // Frames remaining
shake_offset_x: .word   0                       // Current X offset
shake_offset_y: .word   0                       // Current Y offset

// Effect colors by enemy type
effect_color_zombie: .word COLOR_GREEN
effect_color_runner: .word COLOR_CYAN
effect_color_tank:   .word COLOR_RED
effect_color_boss:   .word COLOR_BRIGHT_YELLOW

                .text
                .balign 4

// effects_init - Initialize effects system
// Clears all particle and damage number pools
                .global effects_init
effects_init:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Clear particle pool
                adrp    x0, particle_pool
                add     x0, x0, :lo12:particle_pool
                mov     x1, MAX_PARTICLES * PARTICLE_SIZE
                mov     w2, 0

effects_init_particles:
                cbz     x1, effects_init_dmgnums
                strb    w2, [x0], 1
                sub     x1, x1, 1
                b       effects_init_particles

effects_init_dmgnums:
                // Clear damage number pool
                adrp    x0, dmgnum_pool
                add     x0, x0, :lo12:dmgnum_pool
                mov     x1, MAX_DAMAGE_NUMS * DMGNUM_SIZE

effects_init_dmgnum_loop:
                cbz     x1, effects_init_shake
                strb    w2, [x0], 1
                sub     x1, x1, 1
                b       effects_init_dmgnum_loop

effects_init_shake:
                // Reset shake state
                adrp    x0, shake_intensity
                add     x0, x0, :lo12:shake_intensity
                mov     w1, 0
                str     w1, [x0]                // shake_intensity = 0
                str     w1, [x0, 4]             // shake_timer = 0
                str     w1, [x0, 8]             // shake_offset_x = 0
                str     w1, [x0, 12]            // shake_offset_y = 0

                // Reset particle count
                adrp    x0, particle_count
                add     x0, x0, :lo12:particle_count
                str     wzr, [x0]

                ldp     fp, lr, [sp], 16
                ret

// effects_update - Update all active effects
// Updates particles, damage numbers, and screen shake
                .global effects_update
effects_update:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                bl      effects_update_particles
                bl      effects_update_dmgnums
                bl      effects_update_shake

                ldp     fp, lr, [sp], 16
                ret

// effects_update_particles - Update all particles
// Moves particles and decreases life
effects_update_particles:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                str     x19, [sp, 16]

                adrp    x19, particle_pool
                add     x19, x19, :lo12:particle_pool
                mov     w0, MAX_PARTICLES

update_particle_loop:
                cbz     w0, update_particles_done

                // Check if particle is active (life > 0)
                ldrb    w1, [x19, PARTICLE_LIFE]
                cbz     w1, update_particle_next

                // Decrement life
                sub     w1, w1, 1
                strb    w1, [x19, PARTICLE_LIFE]
                cbz     w1, update_particle_next  // Just died, skip movement

                // Update position based on velocity
                ldrsb   w2, [x19, PARTICLE_VX]    // Signed velocity X
                ldrsb   w3, [x19, PARTICLE_VY]    // Signed velocity Y
                ldrsh   w4, [x19, PARTICLE_X]     // Current X
                ldrsh   w5, [x19, PARTICLE_Y]     // Current Y

                add     w4, w4, w2                // X += VX
                add     w5, w5, w3                // Y += VY

                // Kill particle if out of bounds
                cmp     w4, PLAY_LEFT
                b.lt    particle_kill
                cmp     w4, PLAY_RIGHT
                b.gt    particle_kill
                cmp     w5, PLAY_TOP
                b.lt    particle_kill
                cmp     w5, PLAY_BOTTOM
                b.gt    particle_kill

                // Position is valid, store it
                strh    w4, [x19, PARTICLE_X]
                strh    w5, [x19, PARTICLE_Y]
                b       update_particle_next

particle_kill:
                // Kill particle by setting life to 0
                strb    wzr, [x19, PARTICLE_LIFE]

update_particle_next:
                add     x19, x19, PARTICLE_SIZE
                sub     w0, w0, 1
                b       update_particle_loop

update_particles_done:
                ldr     x19, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// effects_update_dmgnums - Update floating damage numbers
// Moves numbers upward and decreases life
effects_update_dmgnums:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                str     x19, [sp, 16]

                adrp    x19, dmgnum_pool
                add     x19, x19, :lo12:dmgnum_pool
                mov     w0, MAX_DAMAGE_NUMS

update_dmgnum_loop:
                cbz     w0, update_dmgnums_done

                // Check if active (life > 0)
                ldrb    w1, [x19, DMGNUM_LIFE]
                cbz     w1, update_dmgnum_next

                // Decrement life
                sub     w1, w1, 1
                strb    w1, [x19, DMGNUM_LIFE]

                // Float upward every 3 frames
                and     w2, w1, 3
                cbnz    w2, update_dmgnum_next

                ldrsh   w3, [x19, DMGNUM_Y]
                sub     w3, w3, 1                 // Move up
                strh    w3, [x19, DMGNUM_Y]

update_dmgnum_next:
                add     x19, x19, DMGNUM_SIZE
                sub     w0, w0, 1
                b       update_dmgnum_loop

update_dmgnums_done:
                ldr     x19, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// effects_update_shake - Update screen shake
// Generates random offset and decays intensity
effects_update_shake:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                adrp    x0, shake_timer
                add     x0, x0, :lo12:shake_timer
                ldr     w1, [x0]
                cbz     w1, shake_clear_offset

                // Decrement timer
                sub     w1, w1, 1
                str     w1, [x0]

                // Generate random offset based on intensity
                adrp    x0, shake_intensity
                add     x0, x0, :lo12:shake_intensity
                ldr     w2, [x0]                  // Get intensity

                // Random X offset: -intensity to +intensity
                add     w0, w2, 1
                add     w0, w0, w0                // Range = intensity * 2 + 1
                bl      random_range
                sub     w0, w0, w2                // Center around 0
                adrp    x1, shake_offset_x
                add     x1, x1, :lo12:shake_offset_x
                str     w0, [x1]

                // Random Y offset
                adrp    x0, shake_intensity
                add     x0, x0, :lo12:shake_intensity
                ldr     w2, [x0]
                add     w0, w2, 1
                add     w0, w0, w0
                bl      random_range
                sub     w0, w0, w2
                adrp    x1, shake_offset_y
                add     x1, x1, :lo12:shake_offset_y
                str     w0, [x1]

                b       shake_done

shake_clear_offset:
                // Clear offsets when shake is done
                adrp    x0, shake_offset_x
                add     x0, x0, :lo12:shake_offset_x
                str     wzr, [x0]
                str     wzr, [x0, 4]

shake_done:
                ldp     fp, lr, [sp], 16
                ret

// effects_draw - Draw all active effects
                .global effects_draw
effects_draw:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                bl      effects_draw_particles
                bl      effects_draw_dmgnums

                ldp     fp, lr, [sp], 16
                ret

// effects_draw_particles - Draw all active particles
effects_draw_particles:
                stp     fp, lr, [sp, -48]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                str     x21, [sp, 32]

                adrp    x19, particle_pool
                add     x19, x19, :lo12:particle_pool
                mov     w20, MAX_PARTICLES

draw_particle_loop:
                cbz     w20, draw_particles_done

                // Check if active
                ldrb    w0, [x19, PARTICLE_LIFE]
                cbz     w0, draw_particle_next

                // Get position
                ldrsh   w0, [x19, PARTICLE_X]
                ldrsh   w1, [x19, PARTICLE_Y]

                // Bounds check
                cmp     w0, PLAY_LEFT
                b.lt    draw_particle_next
                cmp     w0, PLAY_RIGHT
                b.gt    draw_particle_next
                cmp     w1, PLAY_TOP
                b.lt    draw_particle_next
                cmp     w1, PLAY_BOTTOM
                b.gt    draw_particle_next

                // Move cursor (with shake applied via effects_cursor_move)
                bl      effects_cursor_move

                // Set color based on life remaining (fade effect)
                ldrb    w0, [x19, PARTICLE_LIFE]
                cmp     w0, 8
                b.gt    particle_bright
                cmp     w0, 4
                b.gt    particle_dim
                mov     w0, COLOR_BRIGHT_BLACK    // Very dim
                b       particle_set_color

particle_bright:
                mov     w0, COLOR_BRIGHT_YELLOW   // Bright
                b       particle_set_color

particle_dim:
                mov     w0, COLOR_YELLOW          // Medium

particle_set_color:
                bl      set_color

                // Draw character
                ldrb    w0, [x19, PARTICLE_CHAR]
                bl      write_char

draw_particle_next:
                add     x19, x19, PARTICLE_SIZE
                sub     w20, w20, 1
                b       draw_particle_loop

draw_particles_done:
                ldr     x21, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 48
                ret

// effects_draw_dmgnums - Draw floating damage numbers
effects_draw_dmgnums:
                stp     fp, lr, [sp, -48]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                str     x21, [sp, 32]

                adrp    x19, dmgnum_pool
                add     x19, x19, :lo12:dmgnum_pool
                mov     w20, MAX_DAMAGE_NUMS

draw_dmgnum_loop:
                cbz     w20, draw_dmgnums_done

                // Check if active
                ldrb    w0, [x19, DMGNUM_LIFE]
                cbz     w0, draw_dmgnum_next

                // Get position
                ldrsh   w0, [x19, DMGNUM_X]
                ldrsh   w1, [x19, DMGNUM_Y]

                // Bounds check
                cmp     w1, PLAY_TOP
                b.lt    draw_dmgnum_next
                cmp     w1, PLAY_BOTTOM
                b.gt    draw_dmgnum_next

                // Move cursor
                bl      effects_cursor_move

                // Set color based on life (fade from bright to dim)
                ldrb    w0, [x19, DMGNUM_LIFE]
                cmp     w0, 12
                b.gt    dmgnum_bright
                cmp     w0, 6
                b.gt    dmgnum_yellow
                mov     w0, COLOR_RED             // Fading
                b       dmgnum_set_color

dmgnum_bright:
                mov     w0, COLOR_BRIGHT_WHITE    // Fresh
                b       dmgnum_set_color

dmgnum_yellow:
                mov     w0, COLOR_BRIGHT_YELLOW   // Medium

dmgnum_set_color:
                bl      set_color

                // Draw damage value
                ldrh    w0, [x19, DMGNUM_VALUE]
                bl      write_num

draw_dmgnum_next:
                add     x19, x19, DMGNUM_SIZE
                sub     w20, w20, 1
                b       draw_dmgnum_loop

draw_dmgnums_done:
                ldr     x21, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 48
                ret

// effects_cursor_move - Move cursor with screen shake applied
// Parameters: w0 = x, w1 = y
                .global effects_cursor_move
effects_cursor_move:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]

                mov     w19, w0
                mov     w20, w1

                // Add shake offset
                adrp    x0, shake_offset_x
                add     x0, x0, :lo12:shake_offset_x
                ldr     w2, [x0]                  // X offset
                ldr     w3, [x0, 4]               // Y offset

                add     w19, w19, w2
                add     w20, w20, w3

                // Clamp to screen bounds
                cmp     w19, 0
                csel    w19, wzr, w19, lt
                mov     w0, SCREEN_WIDTH
                sub     w0, w0, 1
                cmp     w19, w0
                csel    w19, w0, w19, gt

                cmp     w20, 0
                csel    w20, wzr, w20, lt
                mov     w0, SCREEN_HEIGHT
                sub     w0, w0, 1
                cmp     w20, w0
                csel    w20, w0, w20, gt

                // Call actual cursor_move
                mov     w0, w19
                mov     w1, w20
                bl      cursor_move

                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// effects_spawn_explosion - Spawn death explosion at position
// Parameters: w0 = x, w1 = y, w2 = enemy_type
                .global effects_spawn_explosion
effects_spawn_explosion:
                stp     fp, lr, [sp, -48]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]

                mov     w19, w0
                mov     w20, w1
                mov     w21, w2                   // Save type

                // Spawn 6-8 particles
                mov     w0, 3
                bl      random_range
                add     w22, w0, 6                // 6-8 particles

spawn_explosion_loop:
                cbz     w22, spawn_explosion_done

                // Find free particle slot
                bl      effects_find_free_particle
                cbz     x0, spawn_explosion_done

                // Set position
                strh    w19, [x0, PARTICLE_X]
                strh    w20, [x0, PARTICLE_Y]

                // Random velocity in 8 directions
                mov     w1, 8
                stp     x0, x1, [sp, -16]!
                mov     w0, 8
                bl      random_range
                mov     w3, w0                    // Direction 0-7
                ldp     x0, x1, [sp], 16

                // Velocity lookup (simple 8-direction)
                // 0=up, 1=up-right, 2=right, etc.
                adrp    x4, velocity_table_x
                add     x4, x4, :lo12:velocity_table_x
                ldrsb   w5, [x4, w3, sxtw]        // VX
                adrp    x4, velocity_table_y
                add     x4, x4, :lo12:velocity_table_y
                ldrsb   w6, [x4, w3, sxtw]        // VY

                strb    w5, [x0, PARTICLE_VX]
                strb    w6, [x0, PARTICLE_VY]

                // Set life
                mov     w1, PARTICLE_MAX_LIFE
                strb    w1, [x0, PARTICLE_LIFE]

                // Random character
                stp     x0, x1, [sp, -16]!
                mov     w0, 8
                bl      random_range
                mov     w3, w0
                ldp     x0, x1, [sp], 16

                adrp    x4, particle_chars_data
                add     x4, x4, :lo12:particle_chars_data
                ldrb    w4, [x4, w3, sxtw]
                strb    w4, [x0, PARTICLE_CHAR]

                sub     w22, w22, 1
                b       spawn_explosion_loop

spawn_explosion_done:
                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 48
                ret

// Velocity tables for 8 directions
                .data
velocity_table_x: .byte  0,  1,  1,  1,  0, -1, -1, -1
velocity_table_y: .byte -1, -1,  0,  1,  1,  1,  0, -1
// Quote and backtick numeric for the same m4 reason as PARTICLE_CHARS.
particle_chars_data: .byte '*', '.', '+', 'o', 'x', 0x27, 0x60, ','

                .text
                .balign 4

// effects_find_free_particle - Find inactive particle slot
// Returns: x0 = pointer to slot, or 0 if full
effects_find_free_particle:
                adrp    x0, particle_pool
                add     x0, x0, :lo12:particle_pool
                mov     w1, MAX_PARTICLES

find_particle_loop:
                cbz     w1, find_particle_full
                ldrb    w2, [x0, PARTICLE_LIFE]
                cbz     w2, find_particle_found   // Life = 0 means free
                add     x0, x0, PARTICLE_SIZE
                sub     w1, w1, 1
                b       find_particle_loop

find_particle_full:
                mov     x0, 0

find_particle_found:
                ret

// effects_spawn_damage_num - Spawn floating damage number
// Parameters: w0 = x, w1 = y, w2 = damage value
                .global effects_spawn_damage_num
effects_spawn_damage_num:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]

                mov     w19, w0
                mov     w20, w1

                // Find free damage number slot
                adrp    x0, dmgnum_pool
                add     x0, x0, :lo12:dmgnum_pool
                mov     w3, MAX_DAMAGE_NUMS

find_dmgnum_slot:
                cbz     w3, spawn_dmgnum_done
                ldrb    w4, [x0, DMGNUM_LIFE]
                cbz     w4, found_dmgnum_slot
                add     x0, x0, DMGNUM_SIZE
                sub     w3, w3, 1
                b       find_dmgnum_slot

found_dmgnum_slot:
                // Set position (slightly above hit point)
                sub     w19, w19, 1               // Offset left a bit
                strh    w19, [x0, DMGNUM_X]
                strh    w20, [x0, DMGNUM_Y]

                // Set damage value
                strh    w2, [x0, DMGNUM_VALUE]

                // Set life
                mov     w1, DMGNUM_MAX_LIFE
                strb    w1, [x0, DMGNUM_LIFE]

                // Set color (white for now)
                mov     w1, COLOR_BRIGHT_WHITE
                strb    w1, [x0, DMGNUM_COLOR]

spawn_dmgnum_done:
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// effects_trigger_shake - Trigger screen shake effect
// Parameters: w0 = intensity (1-3)
                .global effects_trigger_shake
effects_trigger_shake:
                adrp    x1, shake_intensity
                add     x1, x1, :lo12:shake_intensity

                // Set intensity
                str     w0, [x1]

                // Set timer
                mov     w2, SHAKE_DURATION
                str     w2, [x1, 4]

                ret

