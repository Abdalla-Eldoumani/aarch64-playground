// The Titan, the wave 10 boss: a five-state AI, two phases, a sprite and a
// health bar across the top rule, and the minions it spawns while attacking.

// Boss structure offsets
BOSS_ACTIVE = 0                                 // Active flag (1 byte)
BOSS_TYPE = 1                                   // Boss type (1 byte)
BOSS_X = 2                                      // X position (2 bytes)
BOSS_Y = 4                                      // Y position (2 bytes)
BOSS_HEALTH = 6                                 // Current HP (2 bytes)
BOSS_MAX_HP = 8                                 // Max HP (2 bytes)
BOSS_PHASE = 10                                 // Current phase (1 byte)
BOSS_STATE = 11                                 // AI state (1 byte)
BOSS_TIMER = 12                                 // State timer (2 bytes)
BOSS_ATTACK_CD = 14                             // Attack cooldown (2 bytes)
BOSS_MOVE_CD = 16                               // Move cooldown (2 bytes)
BOSS_FLAGS = 18                                 // Flags (2 bytes)
BOSS_PADDING = 20                               // Padding (4 bytes)
BOSS_STRUCT_SIZE = 24                           // Total size

// Boss types
BOSS_TYPE_NONE = 0
BOSS_TYPE_TITAN = 1                             // Wave 10 boss

// Boss AI states
BOSS_STATE_IDLE = 0                             // Standing still
BOSS_STATE_MOVING = 1                           // Moving toward player
BOSS_STATE_CHARGING = 2                         // Charging attack
BOSS_STATE_ATTACKING = 3                        // Executing attack
BOSS_STATE_STUNNED = 4                          // Stunned after damage

// Boss phases
BOSS_PHASE_NORMAL = 0                           // Normal phase (>50% HP)
BOSS_PHASE_ENRAGED = 1                          // Enraged phase (<50% HP)

// Titan stats
TITAN_MAX_HP = 500                              // High HP
TITAN_MOVE_SPEED = 20                           // Move every 20 frames
TITAN_ATTACK_CD = 60                            // Attack every 2 seconds
TITAN_DAMAGE = 20                               // Damage on hit
TITAN_XP = 500                                  // XP when killed
TITAN_WIDTH = 5                                 // Sprite width
TITAN_HEIGHT = 3                                // Sprite height

// Spawn settings
BOSS_WAVE_TITAN = 10                            // Spawn Titan at wave 10

                .data

// Boss entity data
                .balign 8
boss_data:      .skip   BOSS_STRUCT_SIZE

// Boss active flag (quick check)
boss_active:    .word   0

// Boss health bar characters

                .text

// Titan ASCII art sprite (5x3)
//  /[O]\
//  |###|
//  /   \
titan_line1:    .string " /[O]\\"
titan_line2:    .string " |###|"
titan_line3:    .string " /   \\"
titan_name:     .string "TITAN"

// Health bar format
boss_hp_label:  .string " ["
boss_hp_end:    .string "] "
boss_hp_slash:  .string "/"

                .balign 4

// boss_init - Initialize boss system
                .global boss_init
boss_init:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Clear boss data
                adrp    x0, boss_data
                add     x0, x0, :lo12:boss_data
                mov     x1, BOSS_STRUCT_SIZE
                mov     w2, 0

boss_init_loop:
                cbz     x1, boss_init_done
                strb    w2, [x0], 1
                sub     x1, x1, 1
                b       boss_init_loop

boss_init_done:
                // Clear active flag
                adrp    x0, boss_active
                add     x0, x0, :lo12:boss_active
                str     wzr, [x0]

                ldp     fp, lr, [sp], 16
                ret

// boss_check_spawn - Check if boss should spawn based on wave
// Parameters: w0 = current wave
                .global boss_check_spawn
boss_check_spawn:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Check if boss already active
                adrp    x1, boss_active
                add     x1, x1, :lo12:boss_active
                ldr     w1, [x1]
                cbnz    w1, boss_check_spawn_done

                // Check wave for Titan
                cmp     w0, BOSS_WAVE_TITAN
                b.ne    boss_check_spawn_done

                // Spawn Titan!
                mov     w0, BOSS_TYPE_TITAN
                bl      boss_spawn

boss_check_spawn_done:
                ldp     fp, lr, [sp], 16
                ret

// boss_spawn - Spawn a boss
// Parameters: w0 = boss type
                .global boss_spawn
boss_spawn:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                str     x19, [sp, 16]

                mov     w19, w0

                // Get boss data address
                adrp    x0, boss_data
                add     x0, x0, :lo12:boss_data

                // Set active
                mov     w1, 1
                strb    w1, [x0, BOSS_ACTIVE]

                // Set type
                strb    w19, [x0, BOSS_TYPE]

                // Set position (top center of screen)
                mov     w1, SCREEN_WIDTH
                lsr     w1, w1, 1               // Center X
                strh    w1, [x0, BOSS_X]
                mov     w1, PLAY_TOP
                add     w1, w1, 2               // Near top
                strh    w1, [x0, BOSS_Y]

                // Set stats based on type
                cmp     w19, BOSS_TYPE_TITAN
                b.ne    boss_spawn_default

                // Titan stats
                mov     w1, TITAN_MAX_HP
                strh    w1, [x0, BOSS_HEALTH]
                strh    w1, [x0, BOSS_MAX_HP]
                b       boss_spawn_common

boss_spawn_default:
                mov     w1, 100
                strh    w1, [x0, BOSS_HEALTH]
                strh    w1, [x0, BOSS_MAX_HP]

boss_spawn_common:
                // Set initial state
                mov     w1, BOSS_PHASE_NORMAL
                strb    w1, [x0, BOSS_PHASE]
                mov     w1, BOSS_STATE_IDLE
                strb    w1, [x0, BOSS_STATE]
                mov     w1, 30                  // Initial idle time
                strh    w1, [x0, BOSS_TIMER]
                mov     w1, TITAN_ATTACK_CD
                strh    w1, [x0, BOSS_ATTACK_CD]
                mov     w1, TITAN_MOVE_SPEED
                strh    w1, [x0, BOSS_MOVE_CD]

                // Set global active flag
                adrp    x1, boss_active
                add     x1, x1, :lo12:boss_active
                mov     w2, 1
                str     w2, [x1]

                // Play bell for boss spawn
                bl      play_bell
                bl      play_bell
                bl      play_bell

                // The health bar takes over the top rule, so repaint in full
                bl      screen_invalidate

                ldr     x19, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// boss_update - Update boss AI and state
                .global boss_update
boss_update:
                stp     fp, lr, [sp, -48]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]

                // Check if boss active
                adrp    x0, boss_active
                add     x0, x0, :lo12:boss_active
                ldr     w0, [x0]
                cbz     w0, boss_update_done

                // Get boss data
                adrp    x19, boss_data
                add     x19, x19, :lo12:boss_data

                // Check phase based on health
                ldrh    w0, [x19, BOSS_HEALTH]
                ldrh    w1, [x19, BOSS_MAX_HP]
                lsr     w1, w1, 1               // 50% HP
                cmp     w0, w1
                b.gt    boss_phase_normal

                // Enrage if below 50%
                mov     w0, BOSS_PHASE_ENRAGED
                strb    w0, [x19, BOSS_PHASE]
                b       boss_update_state

boss_phase_normal:
                mov     w0, BOSS_PHASE_NORMAL
                strb    w0, [x19, BOSS_PHASE]

boss_update_state:
                // Update based on current state
                ldrb    w20, [x19, BOSS_STATE]

                cmp     w20, BOSS_STATE_IDLE
                b.eq    boss_state_idle
                cmp     w20, BOSS_STATE_MOVING
                b.eq    boss_state_moving
                cmp     w20, BOSS_STATE_STUNNED
                b.eq    boss_state_stunned

                b       boss_update_done

boss_state_idle:
                // Decrement timer
                ldrh    w0, [x19, BOSS_TIMER]
                subs    w0, w0, 1
                strh    w0, [x19, BOSS_TIMER]
                b.gt    boss_update_done

                // Timer expired, start moving
                mov     w0, BOSS_STATE_MOVING
                strb    w0, [x19, BOSS_STATE]
                b       boss_update_done

boss_state_moving:
                // Decrement move cooldown
                ldrh    w0, [x19, BOSS_MOVE_CD]
                subs    w0, w0, 1
                strh    w0, [x19, BOSS_MOVE_CD]
                b.gt    boss_check_attack

                // Reset move cooldown
                ldrb    w0, [x19, BOSS_PHASE]
                cmp     w0, BOSS_PHASE_ENRAGED
                b.eq    boss_move_enraged

                mov     w0, TITAN_MOVE_SPEED
                b       boss_do_move

boss_move_enraged:
                mov     w0, TITAN_MOVE_SPEED
                lsr     w0, w0, 1               // Move twice as fast when enraged

boss_do_move:
                strh    w0, [x19, BOSS_MOVE_CD]

                // Move toward player
                bl      player_get_x
                mov     w20, w0
                bl      player_get_y
                mov     w21, w0

                ldrsh   w22, [x19, BOSS_X]      // Boss X

                // Move X toward player
                cmp     w22, w20
                b.eq    boss_move_y
                b.gt    boss_move_left
                // Move right
                add     w22, w22, 1
                b       boss_move_y
boss_move_left:
                sub     w22, w22, 1

boss_move_y:
                // Clamp X to bounds
                cmp     w22, PLAY_LEFT
                csel    w22, w22, w22, gt
                mov     w0, PLAY_LEFT
                csel    w22, w0, w22, le

                mov     w0, PLAY_RIGHT
                sub     w0, w0, TITAN_WIDTH
                cmp     w22, w0
                csel    w22, w0, w22, gt

                strh    w22, [x19, BOSS_X]

                // Move Y toward player (slower)
                ldrsh   w22, [x19, BOSS_Y]
                cmp     w22, w21
                b.eq    boss_check_attack
                b.gt    boss_move_up
                // Move down
                add     w22, w22, 1
                b       boss_clamp_y
boss_move_up:
                sub     w22, w22, 1

boss_clamp_y:
                // Clamp Y
                cmp     w22, PLAY_TOP
                mov     w0, PLAY_TOP
                csel    w22, w0, w22, lt

                mov     w0, PLAY_BOTTOM
                sub     w0, w0, TITAN_HEIGHT
                cmp     w22, w0
                csel    w22, w0, w22, gt

                strh    w22, [x19, BOSS_Y]

boss_check_attack:
                // Decrement attack cooldown
                ldrh    w0, [x19, BOSS_ATTACK_CD]
                subs    w0, w0, 1
                strh    w0, [x19, BOSS_ATTACK_CD]
                b.gt    boss_update_done

                // Reset attack cooldown
                ldrb    w0, [x19, BOSS_PHASE]
                cmp     w0, BOSS_PHASE_ENRAGED
                b.eq    boss_attack_enraged

                mov     w0, TITAN_ATTACK_CD
                b       boss_do_attack

boss_attack_enraged:
                mov     w0, TITAN_ATTACK_CD
                lsr     w0, w0, 1               // Attack twice as fast

boss_do_attack:
                strh    w0, [x19, BOSS_ATTACK_CD]

                // Spawn minion enemies when attacking
                bl      boss_spawn_minions
                bl      play_bell               // Attack sound
                b       boss_update_done

boss_state_stunned:
                // Decrement stun timer
                ldrh    w0, [x19, BOSS_TIMER]
                subs    w0, w0, 1
                strh    w0, [x19, BOSS_TIMER]
                b.gt    boss_update_done

                // Stun over, resume moving
                mov     w0, BOSS_STATE_MOVING
                strb    w0, [x19, BOSS_STATE]

boss_update_done:
                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 48
                ret

// boss_spawn_minions - Spawn minion enemies near boss
boss_spawn_minions:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]

                // Get boss position
                adrp    x19, boss_data
                add     x19, x19, :lo12:boss_data
                ldrsh   w0, [x19, BOSS_X]
                ldrsh   w1, [x19, BOSS_Y]
                add     w1, w1, TITAN_HEIGHT    // Below boss

                mov     w20, 2                  // Spawn 2 minions

spawn_minion_loop:
                cbz     w20, spawn_minions_done

                // Save position
                stp     x0, x1, [sp, -16]!

                // Spawn zombie at position
                mov     w2, ENEMY_TYPE_ZOMBIE
                bl      enemies_spawn_at

                ldp     x0, x1, [sp], 16

                // Offset X for next minion
                add     w0, w0, 3

                sub     w20, w20, 1
                b       spawn_minion_loop

spawn_minions_done:
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// boss_draw - Draw boss and health bar
                .global boss_draw
boss_draw:
                stp     fp, lr, [sp, -48]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]

                // Check if boss active
                adrp    x0, boss_active
                add     x0, x0, :lo12:boss_active
                ldr     w0, [x0]
                cbz     w0, boss_draw_done

                // Get boss data
                adrp    x19, boss_data
                add     x19, x19, :lo12:boss_data

                // Get position
                ldrsh   w20, [x19, BOSS_X]
                ldrsh   w21, [x19, BOSS_Y]

                // Draw boss sprite
                ldrb    w0, [x19, BOSS_TYPE]
                cmp     w0, BOSS_TYPE_TITAN
                b.ne    boss_draw_health

                // Draw Titan sprite with color based on phase
                ldrb    w0, [x19, BOSS_PHASE]
                cmp     w0, BOSS_PHASE_ENRAGED
                b.eq    boss_color_enraged

                mov     w0, COLOR_BRIGHT_RED
                b       boss_draw_sprite

boss_color_enraged:
                // Flash between red and yellow when enraged
                adrp    x0, intro_frame         // Use global frame counter
                add     x0, x0, :lo12:intro_frame
                ldr     w0, [x0]
                and     w0, w0, 4
                cbz     w0, boss_color_red
                mov     w0, COLOR_BRIGHT_YELLOW
                b       boss_draw_sprite

boss_color_red:
                mov     w0, COLOR_BRIGHT_RED

boss_draw_sprite:
                bl      set_color

                // Line 1
                mov     w0, w20
                mov     w1, w21
                bl      cursor_move
                adrp    x0, titan_line1
                add     x0, x0, :lo12:titan_line1
                bl      write_str

                // Line 2
                mov     w0, w20
                add     w1, w21, 1
                bl      cursor_move
                adrp    x0, titan_line2
                add     x0, x0, :lo12:titan_line2
                bl      write_str

                // Line 3
                mov     w0, w20
                add     w1, w21, 2
                bl      cursor_move
                adrp    x0, titan_line3
                add     x0, x0, :lo12:titan_line3
                bl      write_str

boss_draw_health:
                // Draw health bar at top of screen
                mov     w0, 2
                mov     w1, 1
                bl      cursor_move

                // Boss name
                mov     w0, COLOR_BRIGHT_RED
                bl      set_color
                adrp    x0, titan_name
                add     x0, x0, :lo12:titan_name
                bl      write_str

                // Health bar bracket
                mov     w0, COLOR_WHITE
                bl      set_color
                adrp    x0, boss_hp_label
                add     x0, x0, :lo12:boss_hp_label
                bl      write_str

                // Calculate health bar fill (20 chars wide)
                ldrh    w20, [x19, BOSS_HEALTH]
                ldrh    w21, [x19, BOSS_MAX_HP]

                // filled = (health * 20) / max_hp
                mov     w0, 20
                mul     w0, w20, w0
                udiv    w22, w0, w21            // w22 = filled bars

                // Draw filled portion
                ldrb    w0, [x19, BOSS_PHASE]
                cmp     w0, BOSS_PHASE_ENRAGED
                b.eq    boss_hp_red
                mov     w0, COLOR_BRIGHT_GREEN
                b       boss_hp_color_set
boss_hp_red:
                mov     w0, COLOR_BRIGHT_RED
boss_hp_color_set:
                bl      set_color

                mov     w20, w22                // Counter

boss_hp_fill_loop:
                cbz     w20, boss_hp_empty_loop
                mov     w0, '#'
                bl      write_char
                sub     w20, w20, 1
                b       boss_hp_fill_loop

boss_hp_empty_loop:
                // Draw empty portion
                mov     w0, COLOR_BRIGHT_BLACK
                bl      set_color

                mov     w0, 20
                sub     w20, w0, w22            // Empty bars

boss_hp_empty_draw:
                cbz     w20, boss_hp_numbers
                mov     w0, '-'
                bl      write_char
                sub     w20, w20, 1
                b       boss_hp_empty_draw

boss_hp_numbers:
                // Close bracket and show numbers
                mov     w0, COLOR_WHITE
                bl      set_color
                adrp    x0, boss_hp_end
                add     x0, x0, :lo12:boss_hp_end
                bl      write_str

                // Current HP
                ldrh    w0, [x19, BOSS_HEALTH]
                bl      write_num
                adrp    x0, boss_hp_slash
                add     x0, x0, :lo12:boss_hp_slash
                bl      write_str
                ldrh    w0, [x19, BOSS_MAX_HP]
                bl      write_num

                bl      reset_color

boss_draw_done:
                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 48
                ret

// boss_damage - Apply damage to boss
// Parameters: w0 = damage amount
// Returns: w0 = XP if killed, 0 otherwise
                .global boss_damage
boss_damage:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                str     x19, [sp, 16]

                mov     w19, w0

                // Check if boss active
                adrp    x0, boss_active
                add     x0, x0, :lo12:boss_active
                ldr     w0, [x0]
                cbz     w0, boss_damage_no_hit

                // Get boss data
                adrp    x0, boss_data
                add     x0, x0, :lo12:boss_data

                // Apply damage
                ldrh    w1, [x0, BOSS_HEALTH]
                subs    w1, w1, w19
                b.le    boss_killed

                // Store new health
                strh    w1, [x0, BOSS_HEALTH]

                // Stun briefly on hit
                mov     w1, BOSS_STATE_STUNNED
                strb    w1, [x0, BOSS_STATE]
                mov     w1, 5
                strh    w1, [x0, BOSS_TIMER]

                mov     w0, 0
                b       boss_damage_done

boss_killed:
                // Boss died!
                adrp    x0, boss_data
                add     x0, x0, :lo12:boss_data
                mov     w1, 0
                strb    w1, [x0, BOSS_ACTIVE]
                strh    w1, [x0, BOSS_HEALTH]

                // Clear active flag
                adrp    x0, boss_active
                add     x0, x0, :lo12:boss_active
                str     wzr, [x0]

                // Three explosions at the boss centre. effects_spawn_explosion
                // takes its coordinates in w0-w2 and is free to clobber them,
                // so every call reloads them. The struct pointer sits in x2,
                // which the type argument overwrites only after both loads.
                // w19 held the damage; the epilogue restores it from the frame.
                mov     w19, 3                  // Explosions left to spawn

boss_death_boom:
                adrp    x2, boss_data
                add     x2, x2, :lo12:boss_data
                ldrsh   w0, [x2, BOSS_X]
                add     w0, w0, 2
                ldrsh   w1, [x2, BOSS_Y]
                add     w1, w1, 1
                mov     w2, 0
                bl      effects_spawn_explosion
                subs    w19, w19, 1
                b.ne    boss_death_boom

                // Multiple bells for epic death
                bl      play_bell
                bl      play_bell
                bl      play_bell

                mov     w0, TITAN_XP            // Return XP
                b       boss_damage_done

boss_damage_no_hit:
                mov     w0, 0

boss_damage_done:
                ldr     x19, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// boss_check_collision - Check if position collides with boss
// Parameters: w0 = x, w1 = y
// Returns: w0 = 1 if collision, 0 otherwise
                .global boss_check_collision
boss_check_collision:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                mov     w2, w0
                mov     w3, w1

                // Check if boss active
                adrp    x0, boss_active
                add     x0, x0, :lo12:boss_active
                ldr     w0, [x0]
                cbz     w0, boss_no_collision

                // Get boss bounds
                adrp    x0, boss_data
                add     x0, x0, :lo12:boss_data
                ldrsh   w4, [x0, BOSS_X]        // Boss left
                ldrsh   w5, [x0, BOSS_Y]        // Boss top

                // Check X bounds
                cmp     w2, w4
                b.lt    boss_no_collision
                add     w4, w4, TITAN_WIDTH
                cmp     w2, w4
                b.ge    boss_no_collision

                // Check Y bounds
                cmp     w3, w5
                b.lt    boss_no_collision
                add     w5, w5, TITAN_HEIGHT
                cmp     w3, w5
                b.ge    boss_no_collision

                // Collision!
                mov     w0, 1
                b       boss_collision_done

boss_no_collision:
                mov     w0, 0

boss_collision_done:
                ldp     fp, lr, [sp], 16
                ret

