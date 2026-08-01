// Persistence and achievements. One 120-byte binary file holds the top five
// scores, lifetime statistics and the achievement bitmask; the achievement
// rules and the unlock banner live here too.

// Save file constants
SAVE_VERSION = 1                                // Save file version
MAX_HIGH_SCORES = 5                             // Number of high scores to keep

// High score structure (16 bytes)
HS_SCORE = 0                                    // Score (4 bytes)
HS_WAVE = 4                                     // Wave reached (2 bytes)
HS_KILLS = 6                                    // Kill count (4 bytes)
HS_LEVEL = 10                                   // Player level (2 bytes)
HS_PADDING = 12                                 // Padding (4 bytes)
HS_SIZE = 16                                    // Total size

// Statistics structure (32 bytes)
STAT_GAMES = 0                                  // Total games played (4 bytes)
STAT_KILLS = 4                                  // Total kills (4 bytes)
STAT_TIME = 8                                   // Total time in seconds (4 bytes)
STAT_BEST_WAVE = 12                             // Highest wave reached (4 bytes)
STAT_BEST_LEVEL = 16                            // Highest level reached (4 bytes)
STAT_BEST_KILLS = 20                            // Most kills in one game (4 bytes)
STAT_ACHIEVEMENTS = 24                          // Achievement bitmask (4 bytes)
STAT_PADDING = 28                               // Padding (4 bytes)
STAT_SIZE = 32                                  // Total size

// Save file structure
// Header: 8 bytes (magic + version)
// High Scores: 5 * 16 = 80 bytes
// Statistics: 32 bytes
// Total: 120 bytes
SAVE_HEADER_SIZE = 8
SAVE_SCORES_OFFSET = 8
SAVE_STATS_OFFSET = 88                          // 8 + 80
SAVE_FILE_SIZE = 120

// File flags
O_RDONLY = 0                                    // Open read-only
O_WRONLY = 1                                    // Open write-only
O_RDWR = 2                                      // Open read-write
O_CREAT = 64                                    // Create if not exists
O_TRUNC = 512                                   // Truncate file
AT_FDCWD = -100                                 // Current directory

                .data

// Save file path (in data directory)
save_path:      .string "data/deadzone.sav"
                .balign 4

// High scores array (5 entries * 16 bytes = 80 bytes)
                .balign 8
high_scores:    .skip   MAX_HIGH_SCORES * HS_SIZE

// Statistics
                .balign 4
game_stats:
stat_games:     .word   0                       // Total games played
stat_kills:     .word   0                       // Total kills
stat_time:      .word   0                       // Total time (seconds)
stat_best_wave: .word   0                       // Highest wave
stat_best_level: .word  0                       // Highest level
stat_best_kills: .word  0                       // Most kills in one game
// The bitmask lives in what used to be stats padding, so it rides along with
// the block save_load/save_write already copy. Version 1 files read back zero.
achievements:   .word   0                       // Unlocked achievements bitmask
                .skip   4                       // Padding

// Current game stats (for end-of-game saving)
                .balign 4
current_score:  .word   0                       // Score this game
save_wave:      .word   0                       // Wave reached (renamed to avoid conflict)
save_kills:     .word   0                       // Kills this game
save_level:     .word   0                       // Level reached

// File buffer
                .balign 8
file_buffer:    .skip   SAVE_FILE_SIZE

                .text
                .balign 4

// save_init - Initialize save system (load existing data)
                .global save_init
save_init:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Clear high scores
                adrp    x0, high_scores
                add     x0, x0, :lo12:high_scores
                mov     x1, MAX_HIGH_SCORES * HS_SIZE
                mov     w2, 0
save_init_clear:
                cbz     x1, save_init_load
                strb    w2, [x0], 1
                sub     x1, x1, 1
                b       save_init_clear

save_init_load:
                // Try to load existing save file
                bl      save_load

                ldp     fp, lr, [sp], 16
                ret

// save_load - Load save file from disk
// Returns: w0 = 1 if loaded successfully, 0 if failed/not found
                .global save_load
save_load:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                str     x19, [sp, 16]

                // Open file for reading
                mov     x0, AT_FDCWD            // Current directory
                adrp    x1, save_path
                add     x1, x1, :lo12:save_path
                mov     x2, O_RDONLY
                mov     x3, 0                   // Mode (unused for read)
                mov     x8, SYS_OPENAT
                svc     0

                // Check if open succeeded
                cmp     x0, 0
                b.lt    save_load_fail
                mov     x19, x0

                // Read file into buffer
                mov     x0, x19
                adrp    x1, file_buffer
                add     x1, x1, :lo12:file_buffer
                mov     x2, SAVE_FILE_SIZE
                mov     x8, SYS_READ
                svc     0

                // Close file
                mov     x0, x19
                mov     x8, SYS_CLOSE
                svc     0

                // Verify magic number (SAVE_MAGIC = 0x44414544 "DEAD")
                adrp    x0, file_buffer
                add     x0, x0, :lo12:file_buffer
                ldr     w1, [x0]
                movz    w2, 0x4544              // Lower 16 bits
                movk    w2, 0x4441, lsl 16      // Upper 16 bits
                cmp     w1, w2
                b.ne    save_load_fail

                // Verify version
                ldr     w1, [x0, 4]
                cmp     w1, SAVE_VERSION
                b.ne    save_load_fail

                // Copy high scores from buffer
                add     x0, x0, SAVE_SCORES_OFFSET
                adrp    x1, high_scores
                add     x1, x1, :lo12:high_scores
                mov     x2, MAX_HIGH_SCORES * HS_SIZE
save_load_scores:
                cbz     x2, save_load_stats
                ldrb    w3, [x0], 1
                strb    w3, [x1], 1
                sub     x2, x2, 1
                b       save_load_scores

save_load_stats:
                // Copy statistics from buffer
                adrp    x0, file_buffer
                add     x0, x0, :lo12:file_buffer
                add     x0, x0, SAVE_STATS_OFFSET
                adrp    x1, game_stats
                add     x1, x1, :lo12:game_stats
                mov     x2, STAT_SIZE
save_load_stats_loop:
                cbz     x2, save_load_success
                ldrb    w3, [x0], 1
                strb    w3, [x1], 1
                sub     x2, x2, 1
                b       save_load_stats_loop

save_load_success:
                mov     w0, 1                   // Success
                b       save_load_done

save_load_fail:
                mov     w0, 0                   // Failed

save_load_done:
                ldr     x19, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// save_write - Write save file to disk
// Returns: w0 = 1 if saved successfully, 0 if failed
                .global save_write
save_write:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                str     x19, [sp, 16]

                // Build save file in buffer
                adrp    x0, file_buffer
                add     x0, x0, :lo12:file_buffer

                // Write magic number (0x44414544 "DEAD")
                movz    w1, 0x4544              // Lower 16 bits
                movk    w1, 0x4441, lsl 16      // Upper 16 bits
                str     w1, [x0]

                // Write version
                mov     w1, SAVE_VERSION
                str     w1, [x0, 4]

                // Copy high scores to buffer
                add     x1, x0, SAVE_SCORES_OFFSET
                adrp    x2, high_scores
                add     x2, x2, :lo12:high_scores
                mov     x3, MAX_HIGH_SCORES * HS_SIZE
save_write_scores:
                cbz     x3, save_write_stats
                ldrb    w4, [x2], 1
                strb    w4, [x1], 1
                sub     x3, x3, 1
                b       save_write_scores

save_write_stats:
                // Copy statistics to buffer
                adrp    x0, file_buffer
                add     x0, x0, :lo12:file_buffer
                add     x1, x0, SAVE_STATS_OFFSET
                adrp    x2, game_stats
                add     x2, x2, :lo12:game_stats
                mov     x3, STAT_SIZE
save_write_stats_loop:
                cbz     x3, save_write_file
                ldrb    w4, [x2], 1
                strb    w4, [x1], 1
                sub     x3, x3, 1
                b       save_write_stats_loop

save_write_file:
                // Open file for writing (create/truncate)
                mov     x0, AT_FDCWD
                adrp    x1, save_path
                add     x1, x1, :lo12:save_path
                mov     x2, O_WRONLY
                orr     x2, x2, O_CREAT
                orr     x2, x2, O_TRUNC
                mov     x3, 420                 // File permissions (0644 octal = 420 decimal)
                mov     x8, SYS_OPENAT
                svc     0

                cmp     x0, 0
                b.lt    save_write_fail
                mov     x19, x0

                // Write buffer to file
                mov     x0, x19
                adrp    x1, file_buffer
                add     x1, x1, :lo12:file_buffer
                mov     x2, SAVE_FILE_SIZE
                mov     x8, SYS_WRITE
                svc     0

                // Close file
                mov     x0, x19
                mov     x8, SYS_CLOSE
                svc     0

                mov     w0, 1                   // Success
                b       save_write_done

save_write_fail:
                mov     w0, 0                   // Failed

save_write_done:
                ldr     x19, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

// save_start_game - Call at game start to track time
                .global save_start_game
save_start_game:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Reset current game stats
                adrp    x0, current_score
                add     x0, x0, :lo12:current_score
                mov     w1, 0
                str     w1, [x0]                // current_score = 0
                str     w1, [x0, 4]             // save_wave = 0
                str     w1, [x0, 8]             // save_kills = 0
                str     w1, [x0, 12]            // save_level = 0

                // Increment games played
                adrp    x0, stat_games
                add     x0, x0, :lo12:stat_games
                ldr     w1, [x0]
                add     w1, w1, 1
                str     w1, [x0]

                ldp     fp, lr, [sp], 16
                ret

// save_end_game - Call at game end to save stats and check high score
// Parameters: w0 = final score, w1 = wave, w2 = kills, w3 = level
// Returns: w0 = high score rank (1-5) or 0 if not a high score
                .global save_end_game
save_end_game:
                stp     fp, lr, [sp, -48]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]

                // Save parameters
                mov     w19, w0
                mov     w20, w1
                mov     w21, w2
                mov     w22, w3

                // Store current game stats
                adrp    x0, current_score
                add     x0, x0, :lo12:current_score
                str     w19, [x0]
                str     w20, [x0, 4]
                str     w21, [x0, 8]
                str     w22, [x0, 12]

                // Update total kills
                adrp    x0, stat_kills
                add     x0, x0, :lo12:stat_kills
                ldr     w1, [x0]
                add     w1, w1, w21
                str     w1, [x0]

                // Update best wave if higher
                adrp    x0, stat_best_wave
                add     x0, x0, :lo12:stat_best_wave
                ldr     w1, [x0]
                cmp     w20, w1
                b.le    end_game_check_level
                str     w20, [x0]

end_game_check_level:
                // Update best level if higher
                adrp    x0, stat_best_level
                add     x0, x0, :lo12:stat_best_level
                ldr     w1, [x0]
                cmp     w22, w1
                b.le    end_game_check_kills
                str     w22, [x0]

end_game_check_kills:
                // Update best kills if higher
                adrp    x0, stat_best_kills
                add     x0, x0, :lo12:stat_best_kills
                ldr     w1, [x0]
                cmp     w21, w1
                b.le    end_game_add_score
                str     w21, [x0]

end_game_add_score:
                // Try to add to high scores
                mov     w0, w19
                mov     w1, w20
                mov     w2, w21
                mov     w3, w22
                bl      save_add_high_score
                mov     w19, w0

                // Save to file
                bl      save_write

                mov     w0, w19                 // Return rank

                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 48
                ret

// save_add_high_score - Add score to high score list if qualifies
// Parameters: w0 = score, w1 = wave, w2 = kills, w3 = level
// Returns: w0 = rank (1-5) or 0 if didn't qualify
save_add_high_score:
                stp     fp, lr, [sp, -64]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]
                stp     x23, x24, [sp, 48]

                // Save parameters
                mov     w19, w0
                mov     w20, w1
                mov     w21, w2
                mov     w22, w3

                // Find insertion position
                adrp    x23, high_scores
                add     x23, x23, :lo12:high_scores
                mov     w24, 0

find_position:
                cmp     w24, MAX_HIGH_SCORES
                b.ge    no_high_score           // Didn't qualify

                // Compare with score at this position
                mov     w0, HS_SIZE
                mul     w0, w24, w0
                add     x0, x23, x0, uxtw
                ldr     w1, [x0, HS_SCORE]

                // If our score > this score, insert here
                cmp     w19, w1
                b.gt    insert_score

                add     w24, w24, 1
                b       find_position

insert_score:
                // Shift scores down from position to make room
                mov     w0, MAX_HIGH_SCORES
                sub     w0, w0, 1               // Start from last position

shift_loop:
                cmp     w0, w24
                b.le    do_insert

                // Copy entry[i-1] to entry[i]
                mov     w1, HS_SIZE
                mul     w2, w0, w1              // Dest offset
                sub     w3, w0, 1
                mul     w3, w3, w1              // Src offset

                add     x4, x23, x2, uxtw       // Dest pointer
                add     x5, x23, x3, uxtw       // Src pointer

                // Copy 16 bytes
                ldr     x6, [x5]
                str     x6, [x4]
                ldr     x6, [x5, 8]
                str     x6, [x4, 8]

                sub     w0, w0, 1
                b       shift_loop

do_insert:
                // Insert new score at position w24
                mov     w0, HS_SIZE
                mul     w0, w24, w0
                add     x0, x23, x0, uxtw

                str     w19, [x0, HS_SCORE]
                strh    w20, [x0, HS_WAVE]
                str     w21, [x0, HS_KILLS]
                strh    w22, [x0, HS_LEVEL]

                // Return rank (1-based)
                add     w0, w24, 1
                b       add_score_done

no_high_score:
                mov     w0, 0                   // Didn't qualify

add_score_done:
                ldp     x23, x24, [sp, 48]
                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 64
                ret

// save_get_high_score - Get a high score entry
// Parameters: w0 = rank (0-4)
// Returns: x0 = pointer to high score entry, or 0 if invalid
                .global save_get_high_score
save_get_high_score:
                cmp     w0, MAX_HIGH_SCORES
                b.ge    get_hs_invalid
                cmp     w0, 0
                b.lt    get_hs_invalid

                adrp    x1, high_scores
                add     x1, x1, :lo12:high_scores
                mov     w2, HS_SIZE
                mul     w0, w0, w2
                add     x0, x1, x0, uxtw
                ret

get_hs_invalid:
                mov     x0, 0
                ret

// Achievement bit flags
ACH_FIRST_KILL = 0x0001                         // First enemy killed
ACH_WAVE_5 = 0x0002                             // Reached wave 5
ACH_WAVE_10 = 0x0004                            // Reached wave 10
ACH_WAVE_20 = 0x0008                            // Reached wave 20
ACH_KILLS_100 = 0x0010                          // 100 kills in one game
ACH_BOSS_KILL = 0x0020                          // Killed a boss
ACH_NO_DMG_WAVE = 0x0040                        // Completed wave without damage
ACH_SURVIVOR = 0x0080                           // Survived 5 minutes

// The game keeps no wall clock, so "5 minutes" is counted in played frames
ACH_SURVIVE_FRAMES = 300 * TARGET_FPS           // 5 minutes at the loop rate
ACH_NOTIFY_FRAMES = 3 * TARGET_FPS              // Banner stays up 3 seconds

// Per-run achievement state (the unlocked bitmask lives in game_stats)
                .data
                .balign 4
ach_pending:    .word   0                       // Newly unlocked (for notification)
ach_wave_nodmg: .word   1                       // Tracking no damage this wave
ach_notify_timer: .word 0                       // Notification display timer
ach_survive_frames: .word 0                     // Frames played this run

                .text

// Achievement notification strings
ach_banner:     .string "*** ACHIEVEMENT UNLOCKED ***"
ach_first_kill: .string "First Blood"
ach_wave5:      .string "Getting Started"
ach_wave10:     .string "Survivor"
ach_wave20:     .string "Veteran"
ach_kills100:   .string "Centurion"
ach_boss:       .string "Boss Slayer"
ach_nodmg:      .string "Untouchable"
ach_survivor5:  .string "Endurance"

                .balign 4

// achievements_init - Reset achievements for new game
                .global achievements_init
achievements_init:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Reset pending achievements
                adrp    x0, ach_pending
                add     x0, x0, :lo12:ach_pending
                mov     w1, 0
                str     w1, [x0]

                // Reset no damage tracker
                adrp    x0, ach_wave_nodmg
                add     x0, x0, :lo12:ach_wave_nodmg
                mov     w1, 1
                str     w1, [x0]

                // Reset notification timer
                adrp    x0, ach_notify_timer
                add     x0, x0, :lo12:ach_notify_timer
                mov     w1, 0
                str     w1, [x0]

                // Reset survival counter
                adrp    x0, ach_survive_frames
                add     x0, x0, :lo12:ach_survive_frames
                str     w1, [x0]

                ldp     fp, lr, [sp], 16
                ret

// achievements_unlock - Unlock an achievement
// Parameters: w0 = achievement bit flag
                .global achievements_unlock
achievements_unlock:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Check if already unlocked
                adrp    x1, achievements
                add     x1, x1, :lo12:achievements
                ldr     w2, [x1]
                and     w3, w2, w0
                cbnz    w3, ach_already_unlocked

                // Unlock achievement
                orr     w2, w2, w0
                str     w2, [x1]

                // The banner names one achievement, so the newest unlock
                // replaces whatever was showing rather than joining it
                adrp    x1, ach_pending
                add     x1, x1, :lo12:ach_pending
                str     w0, [x1]

                // Restart the notification timer
                adrp    x1, ach_notify_timer
                add     x1, x1, :lo12:ach_notify_timer
                mov     w2, ACH_NOTIFY_FRAMES
                str     w2, [x1]

                // Play sound
                bl      play_bell
                bl      play_bell

ach_already_unlocked:
                ldp     fp, lr, [sp], 16
                ret

// achievements_check - Check for achievement conditions
// Called each frame during gameplay
                .global achievements_check
achievements_check:
                stp     fp, lr, [sp, -48]!
                mov     fp, sp
                stp     x19, x20, [sp, 16]
                stp     x21, x22, [sp, 32]

                // Get current stats
                bl      player_get_kills
                mov     w19, w0                 // Current kills

                bl      enemies_get_wave
                mov     w20, w0                 // Current wave

                // Check first kill
                cmp     w19, 0
                b.le    ach_check_wave5
                mov     w0, ACH_FIRST_KILL
                bl      achievements_unlock

ach_check_wave5:
                cmp     w20, 5
                b.lt    ach_check_kills
                mov     w0, ACH_WAVE_5
                bl      achievements_unlock

                cmp     w20, 10
                b.lt    ach_check_kills
                mov     w0, ACH_WAVE_10
                bl      achievements_unlock

                cmp     w20, 20
                b.lt    ach_check_kills
                mov     w0, ACH_WAVE_20
                bl      achievements_unlock

ach_check_kills:
                cmp     w19, 100
                b.lt    ach_check_survive
                mov     w0, ACH_KILLS_100
                bl      achievements_unlock

ach_check_survive:
                adrp    x0, ach_survive_frames
                add     x0, x0, :lo12:ach_survive_frames
                ldr     w0, [x0]
                mov     w1, ACH_SURVIVE_FRAMES
                cmp     w0, w1
                b.lt    ach_check_done
                mov     w0, ACH_SURVIVOR
                bl      achievements_unlock

ach_check_done:
                ldp     x21, x22, [sp, 32]
                ldp     x19, x20, [sp, 16]
                ldp     fp, lr, [sp], 48
                ret

// achievements_on_boss_kill - Call when boss is killed
                .global achievements_on_boss_kill
achievements_on_boss_kill:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                mov     w0, ACH_BOSS_KILL
                bl      achievements_unlock

                ldp     fp, lr, [sp], 16
                ret

// achievements_on_damage - Call when player takes damage
                .global achievements_on_damage
achievements_on_damage:
                // Mark that player took damage this wave
                adrp    x0, ach_wave_nodmg
                add     x0, x0, :lo12:ach_wave_nodmg
                mov     w1, 0
                str     w1, [x0]
                ret

// achievements_on_wave_complete - Call when wave is completed
                .global achievements_on_wave_complete
achievements_on_wave_complete:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Check if no damage was taken
                adrp    x0, ach_wave_nodmg
                add     x0, x0, :lo12:ach_wave_nodmg
                ldr     w1, [x0]
                cbz     w1, ach_wave_reset

                // No damage achievement!
                mov     w0, ACH_NO_DMG_WAVE
                bl      achievements_unlock

ach_wave_reset:
                // Reset for next wave
                adrp    x0, ach_wave_nodmg
                add     x0, x0, :lo12:ach_wave_nodmg
                mov     w1, 1
                str     w1, [x0]

                ldp     fp, lr, [sp], 16
                ret

// achievements_update - Update notification timer
                .global achievements_update
achievements_update:
                stp     fp, lr, [sp, -16]!
                mov     fp, sp

                // Count one more frame survived; only the playing loop gets here
                adrp    x0, ach_survive_frames
                add     x0, x0, :lo12:ach_survive_frames
                ldr     w1, [x0]
                add     w1, w1, 1
                str     w1, [x0]

                // Decrement notification timer
                adrp    x0, ach_notify_timer
                add     x0, x0, :lo12:ach_notify_timer
                ldr     w1, [x0]
                cbz     w1, ach_update_done
                sub     w1, w1, 1
                str     w1, [x0]

                // If timer expired, clear pending
                cbnz    w1, ach_update_done
                adrp    x0, ach_pending
                add     x0, x0, :lo12:ach_pending
                mov     w1, 0
                str     w1, [x0]

ach_update_done:
                ldp     fp, lr, [sp], 16
                ret

// achievements_draw - Draw achievement notification if pending
                .global achievements_draw
achievements_draw:
                stp     fp, lr, [sp, -32]!
                mov     fp, sp
                str     x19, [sp, 16]

                // Check if notification active
                adrp    x0, ach_notify_timer
                add     x0, x0, :lo12:ach_notify_timer
                ldr     w1, [x0]
                cbz     w1, ach_draw_done

                // Get pending achievement
                adrp    x0, ach_pending
                add     x0, x0, :lo12:ach_pending
                ldr     w19, [x0]
                cbz     w19, ach_draw_done

                // Draw notification box at top center
                mov     w0, SCREEN_WIDTH / 2 - 15
                mov     w1, 3
                bl      cursor_move

                // Yellow background effect
                mov     w0, COLOR_BRIGHT_YELLOW
                bl      set_color

                // Draw banner
                adrp    x0, ach_banner
                add     x0, x0, :lo12:ach_banner
                bl      write_str

                // Draw achievement name on next line
                mov     w0, SCREEN_WIDTH / 2 - 10
                mov     w1, 4
                bl      cursor_move

                mov     w0, COLOR_WHITE
                bl      set_color

                // Determine which achievement to show (check bits)
                tst     w19, ACH_FIRST_KILL
                b.eq    ach_draw_check_wave5
                adrp    x0, ach_first_kill
                add     x0, x0, :lo12:ach_first_kill
                b       ach_draw_name

ach_draw_check_wave5:
                tst     w19, ACH_WAVE_5
                b.eq    ach_draw_check_wave10
                adrp    x0, ach_wave5
                add     x0, x0, :lo12:ach_wave5
                b       ach_draw_name

ach_draw_check_wave10:
                tst     w19, ACH_WAVE_10
                b.eq    ach_draw_check_wave20
                adrp    x0, ach_wave10
                add     x0, x0, :lo12:ach_wave10
                b       ach_draw_name

ach_draw_check_wave20:
                tst     w19, ACH_WAVE_20
                b.eq    ach_draw_check_kills
                adrp    x0, ach_wave20
                add     x0, x0, :lo12:ach_wave20
                b       ach_draw_name

ach_draw_check_kills:
                tst     w19, ACH_KILLS_100
                b.eq    ach_draw_check_boss
                adrp    x0, ach_kills100
                add     x0, x0, :lo12:ach_kills100
                b       ach_draw_name

ach_draw_check_boss:
                tst     w19, ACH_BOSS_KILL
                b.eq    ach_draw_check_nodmg
                adrp    x0, ach_boss
                add     x0, x0, :lo12:ach_boss
                b       ach_draw_name

ach_draw_check_nodmg:
                tst     w19, ACH_NO_DMG_WAVE
                b.eq    ach_draw_check_survivor
                adrp    x0, ach_nodmg
                add     x0, x0, :lo12:ach_nodmg
                b       ach_draw_name

ach_draw_check_survivor:
                tst     w19, ACH_SURVIVOR
                b.eq    ach_draw_done
                adrp    x0, ach_survivor5
                add     x0, x0, :lo12:ach_survivor5

ach_draw_name:
                bl      write_str
                bl      reset_color

ach_draw_done:
                ldr     x19, [sp, 16]
                ldp     fp, lr, [sp], 32
                ret

