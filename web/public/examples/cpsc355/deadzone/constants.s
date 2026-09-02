// Shared constants for every deadzone module: screen geometry, syscall
// numbers, termios and fcntl values, key codes, ANSI colours, frame timing,
// game states and pool sizes. Included first so the rest can rely on them.

define(fp, x29)
define(lr, x30)

// Screen dimensions
SCREEN_WIDTH = 80                               // Terminal width in columns
SCREEN_HEIGHT = 24                              // Terminal height in rows
SCREEN_SIZE = SCREEN_WIDTH * SCREEN_HEIGHT      // Total screen characters

// Play screen rows
// A marquee on row 0, the arena between the two rules, then the four-row
// status bar along the bottom. The field has to stop at ROW_FIELD_LAST for
// the bar to fit, and player.s bounds the player inside those rows.
ROW_MARQUEE = 0                                 // Game name, dark band
ROW_TOP_BORDER = 1                              // Top rule of the arena
ROW_FIELD_FIRST = 2                             // First playable row
ROW_FIELD_LAST = 17                             // Last playable row
ROW_BOTTOM_BORDER = 18                          // Bottom rule of the arena
ROW_BAR_TOP = 20                                // Status bar upper rule
ROW_BAR_STATS = 21                              // Health, wave, kills, level
ROW_BAR_ABILITIES = 22                          // The two ability charges
ROW_BAR_BOTTOM = 23                             // Status bar lower rule

// File descriptors
STDIN = 0
STDOUT = 1
STDERR = 2

// Linux syscall numbers (AArch64)
SYS_FCNTL = 25                                  // fcntl(fd, cmd, arg)
SYS_IOCTL = 29                                  // ioctl(fd, request, arg)
SYS_OPENAT = 56                                 // openat(dirfd, path, flags, mode)
SYS_CLOSE = 57                                  // close(fd)
SYS_READ = 63                                   // read(fd, buf, count)
SYS_WRITE = 64                                  // write(fd, buf, count)
SYS_EXIT = 93                                   // exit(status)
SYS_NANOSLEEP = 101                             // nanosleep(req, rem)

// Clock ids

// Ioctl requests (termios)
TCGETS = 0x5401                                 // Get terminal attributes
TCSETS = 0x5402                                 // Set terminal attributes

// Termios structure offsets
// struct termios size is 60 bytes on Linux ARM64
TERMIOS_SIZE = 60                               // Size of termios structure
TERMIOS_IFLAG = 0                               // Input flags offset (4 bytes)
TERMIOS_OFLAG = 4                               // Output flags offset (4 bytes)
TERMIOS_CFLAG = 8                               // Control flags offset (4 bytes)
TERMIOS_LFLAG = 12                              // Local flags offset (4 bytes)
TERMIOS_CC = 17                                 // Control characters offset
TERMIOS_CC_VMIN = 6                             // VMIN index in c_cc array
TERMIOS_CC_VTIME = 5                            // VTIME index in c_cc array

// Termios flag values
// Local flags (c_lflag)
ICANON = 0x0002                                 // Canonical mode
ECHO = 0x0008                                   // Echo input
ISIG = 0x0001                                   // Enable signals
IEXTEN = 0x8000                                 // Extended input processing

// Input flags (c_iflag)
ICRNL = 0x0100                                  // Map CR to NL
IXON = 0x0400                                   // Enable XON/XOFF flow control

// Fcntl commands and file status flags
F_GETFL = 3                                     // Read the file status flags
F_SETFL = 4                                     // Write the file status flags
O_NONBLOCK = 0x800                              // Reads return instead of waiting

// Key codes
KEY_NONE = -1                                   // No key pressed
KEY_ESC = 27
KEY_SPACE = 32                                  // Space bar
KEY_ENTER = 10                                  // Enter/Return key (LF)
KEY_CR = 13                                     // Carriage return

// Movement keys
KEY_W = 119                                     // W key (up)
KEY_A = 97                                      // A key (left)
KEY_S = 115                                     // S key (down)
KEY_D = 100                                     // D key (right)

// Control keys
KEY_P = 112                                     // P key (pause)
KEY_p = 112                                     // p key (pause)
KEY_Q = 113                                     // Q key (quit)
KEY_q = 113                                     // q key (quit)

// Number keys (for upgrade selection)
KEY_1 = 49
KEY_2 = 50
KEY_3 = 51

// Arrow key escape sequences (after ESC [)
KEY_ARROW_UP = 65                               // Up arrow (ESC [ A)
KEY_ARROW_DOWN = 66                             // Down arrow (ESC [ B)
KEY_ARROW_RIGHT = 67                            // Right arrow (ESC [ C)
KEY_ARROW_LEFT = 68                             // Left arrow (ESC [ D)

// Ansi color codes
COLOR_RESET = 0
COLOR_BLACK = 30
COLOR_RED = 31
COLOR_GREEN = 32
COLOR_YELLOW = 33
COLOR_BLUE = 34
COLOR_MAGENTA = 35
COLOR_CYAN = 36
COLOR_WHITE = 37

// Bright colors
COLOR_BRIGHT_BLACK = 90
COLOR_BRIGHT_RED = 91
COLOR_BRIGHT_GREEN = 92
COLOR_BRIGHT_YELLOW = 93
COLOR_BRIGHT_BLUE = 94
COLOR_BRIGHT_MAGENTA = 95
COLOR_BRIGHT_CYAN = 96
COLOR_BRIGHT_WHITE = 97

// Roles the colours play on screen. Everything structural is dim grey so the
// enemies, the player and the gauges are the only bright things in the frame.
CHROME_COLOR = COLOR_BRIGHT_BLACK               // Walls, rules, meter tracks
FLOOR_COLOR = COLOR_BRIGHT_BLACK                // Rubble on the deck
LABEL_COLOR = COLOR_RED                         // Status bar field names
VALUE_COLOR = COLOR_BRIGHT_WHITE                // Status bar numbers
WALL_GLYPH = '#'                                // Arena wall and rule

// Background colors (add 10 to foreground)

// Game timing
TARGET_FPS = 30                                 // Target frames per second
FRAME_TIME_NS = 33333333                        // Nanoseconds per frame (1/30 sec)
FRAME_TIME_SEC = 0                              // Seconds component of frame time

// Game states
STATE_INTRO = 0
STATE_MENU = 1
STATE_PLAYING = 2
STATE_PAUSED = 3
STATE_GAMEOVER = 4
STATE_QUIT = 5
STATE_LEVELUP = 6

// Entity limits
MAX_ENEMIES = 100                               // Maximum enemy count
MAX_PROJECTILES = 50                            // Maximum projectile count

// Timespec structure

// Boolean values
FALSE = 0
TRUE = 1
