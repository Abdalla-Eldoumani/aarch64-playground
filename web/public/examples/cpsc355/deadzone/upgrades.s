// Level-up upgrades: six kinds over five levels each, the random three-way
// choice offered on level up, and the menu drawn over the paused field.

// Upgrade types
UPGRADE_FIRE_RATE = 0                           // Faster firing
UPGRADE_DAMAGE = 1                              // More damage per hit
UPGRADE_PROJ_SPEED = 2                          // Faster projectiles
UPGRADE_MAX_HEALTH = 3                          // Increase max HP
UPGRADE_MOVE_SPEED = 4                          // Faster movement
UPGRADE_MULTI_SHOT = 5                          // Fire multiple projectiles
UPGRADE_COUNT = 6                               // Total upgrade types

// Upgrade limits
MAX_UPGRADE_LEVEL = 5                           // Max level per upgrade
NUM_CHOICES = 3                                 // Choices shown on level up

// Upgrade base values
// Fire rate: base 10, -2 per level (min 2)
BASE_FIRE_RATE = 10
FIRE_RATE_BONUS = 2

// Damage: base 1, +1 per level
BASE_DAMAGE = 1
DAMAGE_BONUS = 1

// Projectile speed: base 2, -1 per 2 levels (faster = lower)
BASE_PROJ_SPEED = 3
PROJ_SPEED_BONUS = 1

// Max health: +20 per level
HEALTH_BONUS = 20

// Move speed: base handled in player, not implemented yet
MOVE_SPEED_BONUS = 1

// Multi-shot: +1 projectile per level
MULTI_SHOT_BONUS = 1

                .data

// Current upgrade levels (one byte per upgrade type)
                .balign 4
upgrade_levels: .skip   UPGRADE_COUNT           // All start at 0

// Currently offered upgrade choices (3 choices)
                .balign 4
offered_upgrades: .word 0, 0, 0                 // Upgrade types offered

                .text

// Upgrade names for UI display
upgrade_name_fire_rate:   .string "Fire Rate+"
upgrade_name_damage:      .string "Damage+"
upgrade_name_proj_speed:  .string "Bullet Speed+"
upgrade_name_max_health:  .string "Max Health+"
upgrade_name_move_speed:  .string "Move Speed+"
upgrade_name_multi_shot:  .string "Multi-Shot+"

// Upgrade descriptions
upgrade_desc_fire_rate:   .string "Shoot faster"
upgrade_desc_damage:      .string "Deal more damage"
upgrade_desc_proj_speed:  .string "Bullets fly faster"
upgrade_desc_max_health:  .string "Increase max HP by 20"
upgrade_desc_move_speed:  .string "Move faster"
upgrade_desc_multi_shot:  .string "Fire extra bullet"

// Level up UI strings
msg_levelup_title:  .string "LEVEL UP"
msg_levelup_choose: .string "Take one: press 1, 2 or 3"

// The choice panel, centred on the play field
LEVELUP_PANEL_X = 18
LEVELUP_PANEL_Y = 6
LEVELUP_PANEL_W = 44
LEVELUP_PANEL_H = 10
msg_choice_1:       .string "[1] "
msg_choice_2:       .string "[2] "
msg_choice_3:       .string "[3] "
msg_level_indicator: .string " (Lv "
msg_close_paren:    .string ")"

                .balign 4

// upgrades_init - Initialize upgrade system
                .global upgrades_init
upgrades_init:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Clear all upgrade levels
                adrp    x0, upgrade_levels
                add     x0, x0, :lo12:upgrade_levels
                mov     w1, 0
                mov     w2, UPGRADE_COUNT

upgrades_init_loop:
                cbz     w2, upgrades_init_done
                strb    w1, [x0], 1
                sub     w2, w2, 1
                b       upgrades_init_loop

upgrades_init_done:
                ldp     fp, lr, [sp], 16
                ret

// upgrades_generate_choices - Generate 3 random upgrade choices
// Picks upgrades that aren't maxed out
                .global upgrades_generate_choices
upgrades_generate_choices:
                stp     fp, lr, [sp, -48]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]

                // Get offered upgrades array address
                adrp    x19, offered_upgrades
                add     x19, x19, :lo12:offered_upgrades

                mov     w20, 0                  // Choice counter (0, 1, 2)

generate_choice_loop:
                cmp     w20, NUM_CHOICES
                b.ge    generate_done

                // Try to find a valid upgrade
                mov     w21, 10                 // Max attempts to find unique

try_random_upgrade:
                cbz     w21, use_any_upgrade    // Fallback if too many attempts

                // Get random upgrade type
                mov     w0, UPGRADE_COUNT
                bl      random_range
                mov     w22, w0                 // Save chosen type

                // Check if already maxed
                adrp    x0, upgrade_levels
                add     x0, x0, :lo12:upgrade_levels
                ldrb    w1, [x0, w22, uxtw]
                cmp     w1, MAX_UPGRADE_LEVEL
                b.ge    try_another             // Maxed, try again

                // Check if already in offered list
                cbz     w20, upgrade_valid      // First choice, always valid

                ldr     w1, [x19, 0]            // Check choice 0
                cmp     w22, w1
                b.eq    try_another

                cmp     w20, 1
                b.le    upgrade_valid           // Only 1 previous, done checking

                ldr     w1, [x19, 4]            // Check choice 1
                cmp     w22, w1
                b.eq    try_another

upgrade_valid:
                // Store this choice
                str     w22, [x19, w20, uxtw 2]
                add     w20, w20, 1
                b       generate_choice_loop

try_another:
                sub     w21, w21, 1
                b       try_random_upgrade

use_any_upgrade:
                // Fallback: use any upgrade (even if duplicate)
                mov     w0, UPGRADE_COUNT
                bl      random_range
                str     w0, [x19, w20, uxtw 2]
                add     w20, w20, 1
                b       generate_choice_loop

generate_done:
                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 48
                ret

// upgrades_apply - Apply the selected upgrade
// Parameters: w0 = choice index (0, 1, or 2)
                .global upgrades_apply
upgrades_apply:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                str     x19, [sp, 16]

                // Get the upgrade type from offered list
                adrp    x1, offered_upgrades
                add     x1, x1, :lo12:offered_upgrades
                ldr     w19, [x1, w0, uxtw 2]   // w19 = upgrade type

                // Increment upgrade level
                adrp    x0, upgrade_levels
                add     x0, x0, :lo12:upgrade_levels
                ldrb    w1, [x0, w19, uxtw]
                add     w1, w1, 1
                cmp     w1, MAX_UPGRADE_LEVEL
                b.le    apply_store_level
                mov     w1, MAX_UPGRADE_LEVEL   // Cap at max

apply_store_level:
                strb    w1, [x0, w19, uxtw]

                // Apply special effects for certain upgrades
                cmp     w19, UPGRADE_MAX_HEALTH
                b.eq    apply_health_upgrade

                b       apply_done

apply_health_upgrade:
                // Increase max HP and restore health
                adrp    x0, player_data
                add     x0, x0, :lo12:player_data

                ldrb    w1, [x0, PLAYER_MAX_HP]
                add     w1, w1, HEALTH_BONUS
                strb    w1, [x0, PLAYER_MAX_HP]

                // Restore to max health
                strb    w1, [x0, PLAYER_HEALTH]

apply_done:
                ldr     x19, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// upgrades_get_fire_rate - Get current fire rate (lower = faster)
// Returns: w0 = fire rate in frames
                .global upgrades_get_fire_rate
upgrades_get_fire_rate:
                adrp    x0, upgrade_levels
                add     x0, x0, :lo12:upgrade_levels
                ldrb    w0, [x0, UPGRADE_FIRE_RATE]

                // Calculate: BASE - (level * BONUS)
                mov     w1, FIRE_RATE_BONUS
                mul     w0, w0, w1
                mov     w1, BASE_FIRE_RATE
                sub     w0, w1, w0

                // Minimum fire rate of 2
                cmp     w0, 2
                b.ge    fire_rate_done
                mov     w0, 2
fire_rate_done:
                ret

// upgrades_get_damage - Get current damage per projectile
// Returns: w0 = damage amount
                .global upgrades_get_damage
upgrades_get_damage:
                adrp    x0, upgrade_levels
                add     x0, x0, :lo12:upgrade_levels
                ldrb    w0, [x0, UPGRADE_DAMAGE]

                // Calculate: BASE + (level * BONUS)
                mov     w1, DAMAGE_BONUS
                mul     w0, w0, w1
                add     w0, w0, BASE_DAMAGE
                ret

// upgrades_get_proj_speed - Get projectile speed (lower = faster)
// Returns: w0 = speed in frames per move
                .global upgrades_get_proj_speed
upgrades_get_proj_speed:
                adrp    x0, upgrade_levels
                add     x0, x0, :lo12:upgrade_levels
                ldrb    w0, [x0, UPGRADE_PROJ_SPEED]

                // Calculate: BASE - (level / 2)
                lsr     w0, w0, 1               // level / 2
                mov     w1, BASE_PROJ_SPEED
                sub     w0, w1, w0

                // Minimum speed of 1
                cmp     w0, 1
                b.ge    proj_speed_done
                mov     w0, 1
proj_speed_done:
                ret

// upgrades_get_multi_shot - Get number of extra projectiles
// Returns: w0 = extra projectile count
                .global upgrades_get_multi_shot
upgrades_get_multi_shot:
                adrp    x0, upgrade_levels
                add     x0, x0, :lo12:upgrade_levels
                ldrb    w0, [x0, UPGRADE_MULTI_SHOT]
                ret

// upgrades_get_name - Get upgrade name string address
// Parameters: w0 = upgrade type
// Returns: x0 = string address
upgrades_get_name:
                cmp     w0, UPGRADE_FIRE_RATE
                b.eq    name_fire_rate
                cmp     w0, UPGRADE_DAMAGE
                b.eq    name_damage
                cmp     w0, UPGRADE_PROJ_SPEED
                b.eq    name_proj_speed
                cmp     w0, UPGRADE_MAX_HEALTH
                b.eq    name_max_health
                cmp     w0, UPGRADE_MOVE_SPEED
                b.eq    name_move_speed
                cmp     w0, UPGRADE_MULTI_SHOT
                b.eq    name_multi_shot
                // Default
                adrp    x0, upgrade_name_damage
                add     x0, x0, :lo12:upgrade_name_damage
                ret

name_fire_rate:
                adrp    x0, upgrade_name_fire_rate
                add     x0, x0, :lo12:upgrade_name_fire_rate
                ret
name_damage:
                adrp    x0, upgrade_name_damage
                add     x0, x0, :lo12:upgrade_name_damage
                ret
name_proj_speed:
                adrp    x0, upgrade_name_proj_speed
                add     x0, x0, :lo12:upgrade_name_proj_speed
                ret
name_max_health:
                adrp    x0, upgrade_name_max_health
                add     x0, x0, :lo12:upgrade_name_max_health
                ret
name_move_speed:
                adrp    x0, upgrade_name_move_speed
                add     x0, x0, :lo12:upgrade_name_move_speed
                ret
name_multi_shot:
                adrp    x0, upgrade_name_multi_shot
                add     x0, x0, :lo12:upgrade_name_multi_shot
                ret

// upgrades_get_level - Get current level of an upgrade
// Parameters: w0 = upgrade type
// Returns: w0 = level (0-5)
upgrades_get_level:
                adrp    x1, upgrade_levels
                add     x1, x1, :lo12:upgrade_levels
                ldrb    w0, [x1, w0, uxtw]
                ret

// upgrades_draw_menu - Draw the level-up selection UI
                .global upgrades_draw_menu
upgrades_draw_menu:
                stp     fp, lr, [sp, -48]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]

                // A framed box in the middle of the field, so the choice is
                // never read against whatever the field is doing behind it
                mov     w0, LEVELUP_PANEL_X
                mov     w1, LEVELUP_PANEL_Y
                mov     w2, LEVELUP_PANEL_W
                mov     w3, LEVELUP_PANEL_H
                mov     w4, LABEL_COLOR
                bl      fb_panel

                // Draw title
                mov     w0, 36                  // X position (centered)
                mov     w1, LEVELUP_PANEL_Y + 1
                bl      cursor_move

                mov     w0, COLOR_BRIGHT_YELLOW
                bl      set_color

                adrp    x0, msg_levelup_title
                add     x0, x0, :lo12:msg_levelup_title
                bl      write_str

                // Draw instruction
                mov     w0, 25
                mov     w1, LEVELUP_PANEL_Y + 3
                bl      cursor_move

                mov     w0, CHROME_COLOR
                bl      set_color

                adrp    x0, msg_levelup_choose
                add     x0, x0, :lo12:msg_levelup_choose
                bl      write_str

                // Get offered upgrades address
                adrp    x19, offered_upgrades
                add     x19, x19, :lo12:offered_upgrades

                // Draw choice 1
                mov     w0, LEVELUP_PANEL_X + 4
                mov     w1, LEVELUP_PANEL_Y + 5
                bl      cursor_move

                mov     w0, COLOR_BRIGHT_RED
                bl      set_color

                adrp    x0, msg_choice_1
                add     x0, x0, :lo12:msg_choice_1
                bl      write_str

                ldr     w20, [x19, 0]           // Upgrade type 0
                mov     w0, VALUE_COLOR
                bl      set_color
                mov     w0, w20
                bl      upgrades_get_name
                bl      write_str

                // Show level
                mov     w0, w20
                bl      upgrades_draw_level_indicator

                // Draw choice 2
                mov     w0, LEVELUP_PANEL_X + 4
                mov     w1, LEVELUP_PANEL_Y + 6
                bl      cursor_move

                mov     w0, COLOR_BRIGHT_RED
                bl      set_color

                adrp    x0, msg_choice_2
                add     x0, x0, :lo12:msg_choice_2
                bl      write_str

                ldr     w20, [x19, 4]           // Upgrade type 1
                mov     w0, VALUE_COLOR
                bl      set_color
                mov     w0, w20
                bl      upgrades_get_name
                bl      write_str

                mov     w0, w20
                bl      upgrades_draw_level_indicator

                // Draw choice 3
                mov     w0, LEVELUP_PANEL_X + 4
                mov     w1, LEVELUP_PANEL_Y + 7
                bl      cursor_move

                mov     w0, COLOR_BRIGHT_RED
                bl      set_color

                adrp    x0, msg_choice_3
                add     x0, x0, :lo12:msg_choice_3
                bl      write_str

                ldr     w20, [x19, 8]           // Upgrade type 2
                mov     w0, VALUE_COLOR
                bl      set_color
                mov     w0, w20
                bl      upgrades_get_name
                bl      write_str

                mov     w0, w20
                bl      upgrades_draw_level_indicator

                bl      reset_color

                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 48
                ret

// upgrades_draw_level_indicator - Draw " (Lv X)" for upgrade
// Parameters: w0 = upgrade type
upgrades_draw_level_indicator:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                str     x19, [sp, 16]

                mov     w19, w0                 // Save upgrade type

                mov     w0, CHROME_COLOR
                bl      set_color

                adrp    x0, msg_level_indicator
                add     x0, x0, :lo12:msg_level_indicator
                bl      write_str

                mov     w0, w19
                bl      upgrades_get_level
                add     w0, w0, 1               // Show as 1-6 instead of 0-5
                bl      write_num

                adrp    x0, msg_close_paren
                add     x0, x0, :lo12:msg_close_paren
                bl      write_str

                ldr     x19, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

