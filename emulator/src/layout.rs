//! The guest address map: every fixed region a load places, in address
//! order. The modules that own a region re-export its constants from here,
//! and the checks at the bottom fail the build if two regions overlap.

/// Base address where assembled code is loaded.
pub const CODE_BASE: u64 = 0x0040_0000;

/// Read-only data section base.
pub const RODATA_BASE: u64 = 0x0050_0000;

/// Initialized read-write data section base.
pub const DATA_BASE: u64 = 0x0060_0000;

/// Uninitialized data section base (zero-filled).
pub const BSS_BASE: u64 = 0x0070_0000;

/// Address space each section owns. The bases above sit exactly one window
/// apart, so the linker bounds every section to it: a data block or `.skip`
/// that outgrew its window would land on the next section's addresses.
pub const SECTION_WINDOW: u64 = 1024 * 1024;

/// Between `.bss` and the heap; the stdio globals take the next page.
pub const ARGV_BASE: u64 = 0x0080_0000;

/// Cap on combined pointer-table + string-pool size. One 4 KiB page is
/// plenty for any realistic command-line on this playground.
pub const ARGV_MAX_BYTES: usize = 4096;

/// The loader maps each libc globals page whole.
const PAGE_BYTES: u64 = 4096;

/// The loader-written `stdin`, `stdout` and `stderr` words (+0, +8, +16),
/// each holding that stream's FILE* handle. glibc's `stdout` is a word that
/// holds a FILE*, which code loads out of memory (`ldr x0, =stdout` then
/// `ldr x0, [x0]`), so the symbols must point at real memory. The page
/// sits right above the argv page, below the heap.
pub const STDIO_GLOBALS_BASE: u64 = ARGV_BASE + ARGV_MAX_BYTES as u64;

/// The ctype conversion tables live on the NEXT page: two 384-entry int32
/// arrays are 3072 bytes and the first globals page is already spoken
/// for by the stream words and the character-class table.
pub const CTYPE_CONV_BASE: u64 = STDIO_GLOBALS_BASE + PAGE_BYTES;

/// The heap window sits above the globals pages and far below the stack.
pub const HEAP_BASE: u64 = 0x0090_0000;
/// One 16 MiB window: big enough for anything a course program allocates
/// (a 1 MiB malloc succeeds the way it does on the servers), and bounded
/// so a runaway allocator hits NULL returns, not the page cap. Pages back
/// lazily, so an untouched allocation costs address space only.
pub const HEAP_LIMIT: u64 = HEAP_BASE + 16 * 1024 * 1024;

/// Initial stack pointer (grows downward).
pub const STACK_BASE: u64 = 0x8000_0000;

/// Lowest address sp may legally reach: 8 MiB of stack, matching
/// `ulimit -s` on the course servers so a deep-but-legal recursion that
/// runs there runs here. Only unbounded recursion (or a garbage sp) gets
/// past it, and that deserves a stack-overflow message, not the
/// memory-cap one, which is why this floor stays well under
/// `memory::MAX_MAPPED_PAGES` in page terms.
pub const STACK_FLOOR: u64 = STACK_BASE - 8 * 1024 * 1024;

/// Base address of the synthetic host-function stubs. `BL` targets inside
/// this range are intercepted by the executor and dispatched to a Rust
/// implementation (printf, scanf, etc.) instead of being executed as real
/// instructions. 256 slots of 16 bytes gives room for every libc symbol
/// the corpus references and leaves space for future additions.
pub const HOST_STUB_BASE: u64 = 0xFFFF_0000;
pub const HOST_STUB_STRIDE: u64 = 16;
pub const HOST_STUB_COUNT: u64 = 256;

/// What the linker counts as a libc address when it decides a `bl` needs a
/// trampoline: the whole 64 KiB above `HOST_STUB_BASE`, wider than the table.
pub const HOST_STUB_WINDOW: u64 = 0x1_0000;

/// Every region as [start, end), in address order.
const REGIONS: [(u64, u64); 10] = [
    (CODE_BASE, CODE_BASE + SECTION_WINDOW),
    (RODATA_BASE, RODATA_BASE + SECTION_WINDOW),
    (DATA_BASE, DATA_BASE + SECTION_WINDOW),
    (BSS_BASE, BSS_BASE + SECTION_WINDOW),
    (ARGV_BASE, ARGV_BASE + ARGV_MAX_BYTES as u64),
    (STDIO_GLOBALS_BASE, STDIO_GLOBALS_BASE + PAGE_BYTES),
    (CTYPE_CONV_BASE, CTYPE_CONV_BASE + PAGE_BYTES),
    (HEAP_BASE, HEAP_LIMIT),
    (STACK_FLOOR, STACK_BASE),
    (HOST_STUB_BASE, HOST_STUB_BASE + HOST_STUB_WINDOW),
];

const _: () = {
    let mut i = 0;
    while i < REGIONS.len() {
        assert!(REGIONS[i].0 < REGIONS[i].1, "a region spans at least one byte");
        assert!(i == 0 || REGIONS[i - 1].1 <= REGIONS[i].0, "regions overlap or are out of order");
        i += 1;
    }
};

const _: () = assert!(
    HOST_STUB_COUNT * HOST_STUB_STRIDE <= HOST_STUB_WINDOW,
    "the stub table outgrew the window the linker tests"
);
