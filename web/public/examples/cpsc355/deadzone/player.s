// The player: position and bounded movement, health with invincibility
// frames after a hit, experience and levelling, and the glyph on screen.

// Player structure offsets
PLAYER_X = 0                                    // X position (2 bytes, signed)
PLAYER_Y = 2                                    // Y position (2 bytes, signed)
PLAYER_HEALTH = 4                               // Current health (1 byte)
PLAYER_MAX_HP = 5                               // Maximum health (1 byte)
PLAYER_XP = 8                                   // Current XP (4 bytes)
PLAYER_LEVEL = 12                               // Current level (2 bytes)
PLAYER_SPEED = 14                               // Movement speed (1 byte)
PLAYER_IFRAMES = 15                             // Invincibility frames (1 byte)
PLAYER_KILLS = 16                               // Kill count (4 bytes)
PLAYER_STRUCT_SIZE = 24                         // 20 bytes of fields, rounded to an 8-byte multiple

// Player constants
PLAYER_DEFAULT_HP = 100                         // Starting health
PLAYER_DEFAULT_SPEED = 1                        // Starting speed
PLAYER_CHAR = '@'                               // Player character
PLAYER_IFRAMES_TOTAL = TARGET_FPS               // A second of invincibility
HURT_FLASH_FRAMES = 3                           // Red frames on the way in

// Play area bounds
PLAY_LEFT = 1                                   // Left boundary (after border)
PLAY_RIGHT = SCREEN_WIDTH - 2                   // Right boundary (before border)
PLAY_TOP = 2                                    // Top boundary (after title and top border)
PLAY_BOTTOM = ROW_FIELD_LAST                    // Last playable row, above the status bar

                .data

// Player data structure (24 bytes)
                .balign 8
player_data:
                .hword  0
                .hword  0
                .byte   0
                .byte   0
                .byte   0, 0
                .word   0
                .hword  0
                .byte   0
                .byte   0
                .word   0

// Level up pending flag (checked by main loop)
level_up_pending: .word  0                      // 1 if level up needs handling

                .text
                .balign 4

// player_init - Initialize player state
// Sets starting position, health, and stats
                .global player_init
player_init:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                adrp    x0, player_data
                add     x0, x0, :lo12:player_data

                // Set starting position (center of play area)
                mov     w1, SCREEN_WIDTH
                lsr     w1, w1, 1               // X = width / 2
                strh    w1, [x0, PLAYER_X]

                mov     w1, SCREEN_HEIGHT
                lsr     w1, w1, 1               // Y = height / 2
                strh    w1, [x0, PLAYER_Y]

                mov     w1, PLAYER_DEFAULT_HP
                strb    w1, [x0, PLAYER_HEALTH]
                strb    w1, [x0, PLAYER_MAX_HP]

                mov     w1, 0
                str     w1, [x0, PLAYER_XP]
                strh    w1, [x0, PLAYER_LEVEL]  // Level 0 until the first 50 XP
                mov     w1, PLAYER_DEFAULT_SPEED
                strb    w1, [x0, PLAYER_SPEED]
                mov     w1, 0
                strb    w1, [x0, PLAYER_IFRAMES]
                str     w1, [x0, PLAYER_KILLS]

                ldp     fp, lr, [sp], 16
                ret

// player_get_x - Get player X position
// Returns: w0 = X position
                .global player_get_x
player_get_x:
                adrp    x0, player_data
                add     x0, x0, :lo12:player_data
                ldrsh   w0, [x0, PLAYER_X]
                ret

// player_get_y - Get player Y position
// Returns: w0 = Y position
                .global player_get_y
player_get_y:
                adrp    x0, player_data
                add     x0, x0, :lo12:player_data
                ldrsh   w0, [x0, PLAYER_Y]
                ret

// player_get_health - Get player current health
// Returns: w0 = health
                .global player_get_health
player_get_health:
                adrp    x0, player_data
                add     x0, x0, :lo12:player_data
                ldrb    w0, [x0, PLAYER_HEALTH]
                ret

// player_get_max_health - Get player maximum health
// Returns: w0 = max health. The health gauge needs both ends of the range,
// and max HP climbs ten a level.
                .global player_get_max_health
player_get_max_health:
                adrp    x0, player_data
                add     x0, x0, :lo12:player_data
                ldrb    w0, [x0, PLAYER_MAX_HP]
                ret

// player_get_level - Get player level
// Returns: w0 = level
                .global player_get_level
player_get_level:
                adrp    x0, player_data
                add     x0, x0, :lo12:player_data
                ldrh    w0, [x0, PLAYER_LEVEL]
                ret

// player_get_xp - Get player XP
// Returns: w0 = XP
                .global player_get_xp
player_get_xp:
                adrp    x0, player_data
                add     x0, x0, :lo12:player_data
                ldr     w0, [x0, PLAYER_XP]
                ret

// player_get_kills - Get player kill count
// Returns: w0 = kills
                .global player_get_kills
player_get_kills:
                adrp    x0, player_data
                add     x0, x0, :lo12:player_data
                ldr     w0, [x0, PLAYER_KILLS]
                ret

// player_move - Move player in direction
// Parameters: w0 = dx (-1, 0, or 1), w1 = dy (-1, 0, or 1)
// Returns: w0 = 1 if moved, 0 if blocked
                .global player_move
player_move:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]

                mov     w19, w0                 // Save dx
                mov     w20, w1                 // Save dy

                adrp    x0, player_data
                add     x0, x0, :lo12:player_data

                ldrsh   w1, [x0, PLAYER_X]      // Current X
                ldrsh   w2, [x0, PLAYER_Y]      // Current Y

                add     w1, w1, w19             // New X = X + dx
                add     w2, w2, w20             // New Y = Y + dy

                cmp     w1, PLAY_LEFT
                b.lt    player_move_blocked
                cmp     w1, PLAY_RIGHT
                b.gt    player_move_blocked

                cmp     w2, PLAY_TOP
                b.lt    player_move_blocked
                cmp     w2, PLAY_BOTTOM
                b.gt    player_move_blocked

                strh    w1, [x0, PLAYER_X]
                strh    w2, [x0, PLAYER_Y]

                mov     w0, 1
                b       player_move_done

player_move_blocked:
                mov     w0, 0

player_move_done:
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// player_damage - Apply damage to player
// Parameters: w0 = damage amount
// Returns: w0 = 1 if dead, 0 if alive
                .global player_damage
player_damage:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                adrp    x1, player_data
                add     x1, x1, :lo12:player_data

                ldrb    w2, [x1, PLAYER_IFRAMES]
                cbnz    w2, player_damage_immune

                ldrb    w2, [x1, PLAYER_HEALTH]
                subs    w2, w2, w0
                b.le    player_damage_dead

                strb    w2, [x1, PLAYER_HEALTH]

                bl      achievements_on_damage

                mov     w0, 8                   // Shake intensity
                bl      effects_trigger_shake

                // The two calls above clobber x1
                adrp    x1, player_data
                add     x1, x1, :lo12:player_data

                mov     w2, PLAYER_IFRAMES_TOTAL
                strb    w2, [x1, PLAYER_IFRAMES]

                mov     w0, 0
                b       player_damage_done

player_damage_immune:
                mov     w0, 0
                b       player_damage_done

player_damage_dead:
                mov     w2, 0
                strb    w2, [x1, PLAYER_HEALTH]
                mov     w0, 1

player_damage_done:
                ldp     fp, lr, [sp], 16
                ret

// player_add_xp - Add XP to player
// Parameters: w0 = XP amount
// Returns: w0 = 1 if leveled up, 0 otherwise
                .global player_add_xp
player_add_xp:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                adrp    x1, player_data
                add     x1, x1, :lo12:player_data

                ldr     w2, [x1, PLAYER_XP]
                add     w2, w2, w0
                str     w2, [x1, PLAYER_XP]

                // Check for level up: (level+1) * 50 XP per level
                ldrh    w3, [x1, PLAYER_LEVEL]
                add     w4, w3, 1               // Next level
                mov     w5, 50
                mul     w4, w4, w5              // XP needed = (level+1) * 50

                cmp     w2, w4
                b.lt    player_no_levelup

                add     w3, w3, 1
                strh    w3, [x1, PLAYER_LEVEL]

                ldrb    w4, [x1, PLAYER_MAX_HP]
                add     w4, w4, 10
                strb    w4, [x1, PLAYER_MAX_HP]

                strb    w4, [x1, PLAYER_HEALTH]

                adrp    x4, level_up_pending
                add     x4, x4, :lo12:level_up_pending
                mov     w5, 1
                str     w5, [x4]

                mov     w0, 1
                b       player_xp_done

player_no_levelup:
                mov     w0, 0

player_xp_done:
                ldp     fp, lr, [sp], 16
                ret

// player_add_kill - Increment kill counter
                .global player_add_kill
player_add_kill:
                adrp    x0, player_data
                add     x0, x0, :lo12:player_data
                ldr     w1, [x0, PLAYER_KILLS]
                add     w1, w1, 1
                str     w1, [x0, PLAYER_KILLS]
                ret

// player_update - Update player state each frame
// Handles invincibility countdown
                .global player_update
player_update:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                adrp    x0, player_data
                add     x0, x0, :lo12:player_data

                ldrb    w1, [x0, PLAYER_IFRAMES]
                cbz     w1, player_update_done
                sub     w1, w1, 1
                strb    w1, [x0, PLAYER_IFRAMES]

player_update_done:
                ldp     fp, lr, [sp], 16
                ret

// player_draw - Draw player at current position
                .global player_draw
player_draw:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                str     x19, [sp, 16]

                adrp    x19, player_data
                add     x19, x19, :lo12:player_data

                ldrsh   w0, [x19, PLAYER_X]
                ldrsh   w1, [x19, PLAYER_Y]

                bl      cursor_move

                // A hit reads as one red frame, then the invincibility window
                // strobes amber against the normal white.
                ldrb    w0, [x19, PLAYER_IFRAMES]
                cbz     w0, player_draw_normal

                cmp     w0, PLAYER_IFRAMES_TOTAL - HURT_FLASH_FRAMES
                b.le    player_draw_strobe
                mov     w0, COLOR_BRIGHT_RED    // Just hit
                b       player_draw_color

player_draw_strobe:
                and     w0, w0, 2               // Two frames on, two off
                cbz     w0, player_draw_normal
                mov     w0, COLOR_BRIGHT_YELLOW
                b       player_draw_color

player_draw_normal:
                mov     w0, COLOR_BRIGHT_WHITE

player_draw_color:
                bl      set_color

                mov     w0, PLAYER_CHAR
                bl      write_char

                ldr     x19, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// player_is_alive - Check if player is alive
// Returns: w0 = 1 if alive, 0 if dead
                .global player_is_alive
player_is_alive:
                adrp    x0, player_data
                add     x0, x0, :lo12:player_data
                ldrb    w0, [x0, PLAYER_HEALTH]
                cmp     w0, 0
                cset    w0, gt
                ret

// player_check_levelup - Check if level up is pending and clear flag
// Returns: w0 = 1 if level up pending, 0 otherwise
                .global player_check_levelup
player_check_levelup:
                adrp    x0, level_up_pending
                add     x0, x0, :lo12:level_up_pending
                ldr     w1, [x0]
                cbz     w1, levelup_not_pending

                mov     w2, 0
                str     w2, [x0]
                mov     w0, 1
                ret

levelup_not_pending:
                mov     w0, 0
                ret
