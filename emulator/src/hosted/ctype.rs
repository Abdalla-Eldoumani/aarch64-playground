//! The C-locale character classification glibc exposes twice: as the
//! `is*`/`to*` functions a `bl isdigit` reaches, and as the lookup table
//! behind them. gcc lowers the `<ctype.h>` MACROS to
//! `(*__ctype_b_loc())[c] & mask`, so a program compiled from C -- and
//! any student copying that idiom into assembly -- never calls `isdigit`
//! at all; it calls `__ctype_b_loc` once and indexes the table. Both
//! spellings answer from `class_of` here, so they can never disagree.
//!
//! The table itself is written into the loader's stdio globals page (see
//! stdio.rs) on every load, because the pointer `__ctype_b_loc` returns
//! has to address real guest memory the program can load through.

use crate::errors::EmuError;
use crate::hosted::{HostContext, HostOutcome};

/// glibc's `_ISbit` masks. `_ISbit(n)` is `(1 << n) << 8` for the first
/// eight classes and `(1 << n) >> 8` for the rest, which is how the byte
/// order of the 16-bit table entry works out on both endiannesses.
pub const IS_UPPER: u16 = 0x0100;
pub const IS_LOWER: u16 = 0x0200;
pub const IS_ALPHA: u16 = 0x0400;
pub const IS_DIGIT: u16 = 0x0800;
pub const IS_XDIGIT: u16 = 0x1000;
pub const IS_SPACE: u16 = 0x2000;
pub const IS_PRINT: u16 = 0x4000;
pub const IS_GRAPH: u16 = 0x8000;
pub const IS_BLANK: u16 = 0x0001;
pub const IS_CNTRL: u16 = 0x0002;
pub const IS_PUNCT: u16 = 0x0004;
pub const IS_ALNUM: u16 = 0x0008;

/// Lowest index the hosted table answers for. glibc's table starts at
/// -128 so a plain `char` -- signed on some ports, and EOF on every one
/// of them -- can index it without a cast.
pub const TABLE_FIRST_INDEX: i32 = -128;
/// Highest index the hosted table answers for: `unsigned char` max.
pub const TABLE_LAST_INDEX: i32 = 255;
/// Entries in the hosted table, one 16-bit word each.
pub const TABLE_ENTRIES: usize = (TABLE_LAST_INDEX - TABLE_FIRST_INDEX + 1) as usize;
/// Byte offset from the table's start to index 0. The pointer
/// `__ctype_b_loc` hands back aims HERE, not at the start, because the
/// caller indexes it with a signed value.
pub const TABLE_ZERO_OFFSET: u64 = ((-TABLE_FIRST_INDEX) as u64) * 2;
/// The same offset for the two CONVERSION tables, whose entries are
/// 4-byte signed ints instead of the class table's 2-byte masks.
pub const TABLE_ZERO_OFFSET_I32: u64 = ((-TABLE_FIRST_INDEX) as u64) * 4;

/// C's EOF, the one negative index every program really passes.
const EOF: i32 = -1;

/// The class bits of one byte in the C locale. Bytes above 0x7F belong
/// to no class there -- the "C" locale is ASCII and nothing else, which
/// is what the course servers run under.
fn class_of_byte(c: u8) -> u16 {
    if !c.is_ascii() {
        return 0;
    }
    let mut bits = 0u16;
    if c.is_ascii_uppercase() {
        bits |= IS_UPPER | IS_ALPHA;
    }
    if c.is_ascii_lowercase() {
        bits |= IS_LOWER | IS_ALPHA;
    }
    if c.is_ascii_digit() {
        bits |= IS_DIGIT;
    }
    if c.is_ascii_hexdigit() {
        bits |= IS_XDIGIT;
    }
    if c.is_ascii_alphanumeric() {
        bits |= IS_ALNUM;
    }
    // C's isspace set, byte for byte: space, \t, \n, \v, \f, \r.
    if matches!(c, b' ' | b'\t' | b'\n' | 0x0B | 0x0C | b'\r') {
        bits |= IS_SPACE;
    }
    if matches!(c, b' ' | b'\t') {
        bits |= IS_BLANK;
    }
    if c < 0x20 || c == 0x7F {
        bits |= IS_CNTRL;
    }
    if (0x20..0x7F).contains(&c) {
        bits |= IS_PRINT;
    }
    if (0x21..0x7F).contains(&c) {
        bits |= IS_GRAPH;
    }
    if (bits & IS_GRAPH) != 0 && (bits & IS_ALNUM) == 0 {
        bits |= IS_PUNCT;
    }
    bits
}

/// The class bits at table index `c`. The single source of truth for
/// both the hosted table and the `is*` stubs.
pub fn class_of(c: i32) -> u16 {
    if c == EOF || !(TABLE_FIRST_INDEX..=TABLE_LAST_INDEX).contains(&c) {
        // EOF reads as "no class at all", which is what makes
        // `isspace(getchar())` terminate at end of input.
        return 0;
    }
    // The negative half mirrors the high half: index -2 and index 254
    // name the same byte, seen as a signed and an unsigned char.
    class_of_byte((c & 0xFF) as u8)
}

/// The table as the loader writes it, index `TABLE_FIRST_INDEX` first.
pub fn table() -> [u16; TABLE_ENTRIES] {
    let mut out = [0u16; TABLE_ENTRIES];
    for (i, entry) in out.iter_mut().enumerate() {
        *entry = class_of(i as i32 + TABLE_FIRST_INDEX);
    }
    out
}

/// The shared body of `isdigit` and its siblings. glibc's is* functions
/// return the MASKED TABLE ENTRY, not 1: `isdigit('5')` answers 2048 on
/// the servers, because the function is `__isctype(c, _ISdigit)`. Any
/// nonzero reads as true to C, and a program that prints the value
/// prints what the servers print.
fn class_stub(ctx: &mut HostContext<'_>, mask: u16) -> Result<HostOutcome, EmuError> {
    let c = ctx.regs.read_gpr(0, false) as u32 as i32;
    let bits = (class_of(c) & mask) as i32;
    ctx.regs.write_gpr(0, true, bits as i64 as u64);
    Ok(HostOutcome::Continue)
}

pub fn isdigit(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    class_stub(ctx, IS_DIGIT)
}

pub fn isalpha(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    class_stub(ctx, IS_ALPHA)
}

pub fn isspace(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    class_stub(ctx, IS_SPACE)
}

/// The case rule at table index `c`: the 26 letters shift case and every
/// other value passes through. The negative half mirrors the high half
/// the way `class_of` does, so index -2 and index 254 name the same byte
/// and both answer 254; EOF is glibc's one carve-out and answers -1, so
/// `toupper(getchar())` still ends a loop. Single source of truth for
/// both the conversion tables and the `toupper`/`tolower` stubs, which
/// glibc keeps in step and the course servers print in step.
pub fn convert_byte(c: i32, to_upper: bool) -> i32 {
    if c == EOF || !(TABLE_FIRST_INDEX..=TABLE_LAST_INDEX).contains(&c) {
        return c;
    }
    let b = (c & 0xFF) as u8;
    if to_upper && b.is_ascii_lowercase() {
        i32::from(b - 32)
    } else if !to_upper && b.is_ascii_uppercase() {
        i32::from(b + 32)
    } else {
        i32::from(b)
    }
}

/// The 384-entry conversion table glibc's `toupper`/`tolower` macros
/// index, index `TABLE_FIRST_INDEX` first. Entries are 4 bytes signed,
/// unlike the class table's 2, and they come from `convert_byte` so the
/// function and the table cannot disagree.
pub fn conversion_table(to_upper: bool) -> [i32; TABLE_ENTRIES] {
    let mut out = [0i32; TABLE_ENTRIES];
    for (i, entry) in out.iter_mut().enumerate() {
        *entry = convert_byte(i as i32 + TABLE_FIRST_INDEX, to_upper);
    }
    out
}

/// toupper(c) / tolower(c), answering from the same rule the table holds.
fn convert_stub(ctx: &mut HostContext<'_>, to_upper: bool) -> Result<HostOutcome, EmuError> {
    let c = ctx.regs.read_gpr(0, false) as u32 as i32;
    let converted = convert_byte(c, to_upper);
    ctx.regs.write_gpr(0, true, converted as i64 as u64);
    Ok(HostOutcome::Continue)
}

pub fn toupper(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    convert_stub(ctx, true)
}

pub fn tolower(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    convert_stub(ctx, false)
}

/// `__ctype_b_loc()` -> the address of the word holding the table
/// pointer. C dereferences the result before indexing it
/// (`(*__ctype_b_loc())[c]`), so returning the table itself would be one
/// indirection short of what every caller does.
pub fn ctype_b_loc(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    ctx.regs
        .write_gpr(0, true, crate::hosted::stdio::CTYPE_B_PTR);
    Ok(HostOutcome::Continue)
}

/// `__ctype_toupper_loc()` -> the address of the word holding the
/// uppercase table pointer, the same shape `ctype_b_loc` answers with
/// for the class table.
pub fn ctype_toupper_loc(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    ctx.regs
        .write_gpr(0, true, crate::hosted::stdio::CTYPE_TOUPPER_PTR);
    Ok(HostOutcome::Continue)
}

pub fn ctype_tolower_loc(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    ctx.regs
        .write_gpr(0, true, crate::hosted::stdio::CTYPE_TOLOWER_PTR);
    Ok(HostOutcome::Continue)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cpu::OpenFile;
    use crate::memory::Memory;
    use crate::registers::RegisterFile;
    use std::collections::HashMap;

    struct Host {
        regs: RegisterFile,
        mem: Memory,
        stdout: Vec<u8>,
        stderr: Vec<u8>,
        stdin: Vec<u8>,
        vfs: HashMap<String, Vec<u8>>,
        open_files: HashMap<u32, OpenFile>,
        next_fd: u32,
        rand_state: crate::hosted::libc::RandState,
        term: crate::cpu::TermState,
        heap: crate::hosted::heap::HeapState,
        strtok_save: u64,
    }

    impl Host {
        fn new() -> Self {
            Host {
                regs: RegisterFile::new(),
                mem: Memory::new(),
                stdout: Vec::new(),
                stderr: Vec::new(),
                stdin: Vec::new(),
                vfs: HashMap::new(),
                open_files: HashMap::new(),
                next_fd: 3,
                rand_state: crate::hosted::libc::RandState::default(),
                term: crate::cpu::TermState::default(),
                heap: crate::hosted::heap::HeapState::default(),
                strtok_save: 0,
            }
        }
        fn ctx(&mut self) -> HostContext<'_> {
            HostContext {
                regs: &mut self.regs,
                mem: &mut self.mem,
                stdout: &mut self.stdout,
                stderr: &mut self.stderr,
                stdin: &mut self.stdin,
                stdin_closed: false,
                vfs: &mut self.vfs,
                open_files: &mut self.open_files,
                next_fd: &mut self.next_fd,
                rand_state: &mut self.rand_state,
                term: &mut self.term,
                heap: &mut self.heap,
                strtok_save: &mut self.strtok_save,
            }
        }
        fn call(&mut self, f: fn(&mut HostContext<'_>) -> Result<HostOutcome, EmuError>, c: i64) -> i64 {
            self.regs.write_gpr(0, false, c as u64);
            f(&mut self.ctx()).unwrap();
            self.regs.read_gpr(0, true) as i64
        }
    }

    #[test]
    fn table_entries_carry_the_glibc_class_bits() {
        let t = table();
        let at = |c: i32| t[(c - TABLE_FIRST_INDEX) as usize];
        assert_eq!(
            at('A' as i32),
            IS_UPPER | IS_ALPHA | IS_ALNUM | IS_XDIGIT | IS_PRINT | IS_GRAPH
        );
        assert_eq!(
            at('5' as i32),
            IS_DIGIT | IS_ALNUM | IS_XDIGIT | IS_PRINT | IS_GRAPH
        );
        assert_eq!(at(' ' as i32), IS_SPACE | IS_BLANK | IS_PRINT);
        assert_eq!(at('\n' as i32), IS_SPACE | IS_CNTRL);
        assert_eq!(at('_' as i32), IS_PUNCT | IS_PRINT | IS_GRAPH);
        // 'g' is a letter but not a hex digit; 'f' is both.
        assert_eq!(at('f' as i32) & IS_XDIGIT, IS_XDIGIT);
        assert_eq!(at('g' as i32) & IS_XDIGIT, 0);
    }

    #[test]
    fn eof_and_the_high_half_classify_as_nothing() {
        let t = table();
        let at = |c: i32| t[(c - TABLE_FIRST_INDEX) as usize];
        assert_eq!(at(-1), 0, "EOF must read as no class at all");
        assert_eq!(at(200), 0, "the C locale classifies no byte above 0x7f");
        // The negative half mirrors the unsigned view of the same byte,
        // which in the C locale is also nothing.
        assert_eq!(at(-56), at(200));
        assert_eq!(t.len(), TABLE_ENTRIES);
        assert_eq!(TABLE_ZERO_OFFSET, 256);
    }

    #[test]
    fn is_stubs_return_the_mask_bit_like_glibc() {
        let mut h = Host::new();
        assert_eq!(h.call(isdigit, '7' as i64), IS_DIGIT as i64);
        assert_eq!(h.call(isdigit, 'x' as i64), 0);
        assert_eq!(h.call(isalpha, 'x' as i64), IS_ALPHA as i64);
        assert_eq!(h.call(isalpha, '7' as i64), 0);
        assert_eq!(h.call(isspace, ' ' as i64), IS_SPACE as i64);
        assert_eq!(h.call(isspace, '\n' as i64), IS_SPACE as i64);
        assert_eq!(h.call(isspace, 'q' as i64), 0);
        // EOF is the value a getchar loop feeds these.
        assert_eq!(h.call(isdigit, -1), 0);
        assert_eq!(h.call(isspace, -1), 0);
    }

    #[test]
    fn case_conversion_passes_non_letters_and_eof_through() {
        let mut h = Host::new();
        assert_eq!(h.call(toupper, 'a' as i64), 'A' as i64);
        assert_eq!(h.call(toupper, 'A' as i64), 'A' as i64);
        assert_eq!(h.call(toupper, '7' as i64), '7' as i64);
        assert_eq!(h.call(toupper, -1), -1);
        assert_eq!(h.call(tolower, 'Z' as i64), 'z' as i64);
        assert_eq!(h.call(tolower, 'z' as i64), 'z' as i64);
        assert_eq!(h.call(tolower, '@' as i64), '@' as i64);
        assert_eq!(h.call(tolower, -1), -1);
    }

    #[test]
    fn the_loader_writes_a_table_the_guest_can_index() {
        // The whole point of the table: a program loads the pointer and
        // indexes it with a signed character, the way gcc lowers the
        // isdigit macro. Nothing here calls a stub.
        let mut mem = Memory::new();
        crate::hosted::stdio::write_stdio_globals(&mut mem).unwrap();
        let table = mem.read_u64(crate::hosted::stdio::CTYPE_B_PTR).unwrap();
        assert_eq!(
            table,
            crate::hosted::stdio::CTYPE_B_TABLE + TABLE_ZERO_OFFSET,
            "the stored pointer must aim at index 0, not at the start"
        );
        let entry = |c: i64| mem.read_u16((table as i64 + c * 2) as u64).unwrap();
        assert_eq!(entry('7' as i64), class_of('7' as i32));
        assert_ne!(entry('7' as i64) & IS_DIGIT, 0);
        assert_eq!(entry('7' as i64) & IS_ALPHA, 0);
        assert_eq!(entry(-1), 0, "EOF classifies as nothing");
        // The table stays inside the single page the loader mapped.
        let end = crate::hosted::stdio::CTYPE_B_TABLE + (TABLE_ENTRIES as u64) * 2;
        assert!(
            end < crate::hosted::stdio::STDIO_GLOBALS_BASE + 4096,
            "the table overran its page"
        );
    }

    #[test]
    fn conversion_tables_mirror_the_negative_half_and_keep_eof() {
        // csarm's ctype_tables probe read all 384 entries of both tables.
        // The negative half mirrors the unsigned view of the same byte
        // (index -5 answers 251), and EOF is the one carve-out.
        let up = conversion_table(true);
        let down = conversion_table(false);
        let at = |t: &[i32; TABLE_ENTRIES], c: i32| t[(c - TABLE_FIRST_INDEX) as usize];
        assert_eq!(at(&up, 'a' as i32), 'A' as i32);
        assert_eq!(at(&up, 'A' as i32), 'A' as i32);
        assert_eq!(at(&up, '5' as i32), '5' as i32);
        assert_eq!(at(&down, 'A' as i32), 'a' as i32);
        assert_eq!(at(&down, 'a' as i32), 'a' as i32);
        assert_eq!(at(&up, -1), -1, "EOF passes through");
        assert_eq!(at(&down, -1), -1);
        assert_eq!(at(&up, -128), 128);
        assert_eq!(at(&down, -128), 128);
        assert_eq!(at(&up, -5), 251);
        assert_eq!(at(&down, -2), 254);
        assert_eq!(at(&up, 200), 200);
        assert_eq!(at(&up, 255), 255);
        assert_eq!(TABLE_ZERO_OFFSET_I32, 512);
    }

    #[test]
    fn the_conversion_stubs_answer_what_the_tables_hold() {
        // glibc keeps the function and the macro in step over the whole
        // index range, and the probe's whole-range check confirmed it.
        let mut h = Host::new();
        let up = conversion_table(true);
        let down = conversion_table(false);
        for c in TABLE_FIRST_INDEX..=TABLE_LAST_INDEX {
            let i = (c - TABLE_FIRST_INDEX) as usize;
            assert_eq!(h.call(toupper, i64::from(c)), i64::from(up[i]), "toupper({c})");
            assert_eq!(h.call(tolower, i64::from(c)), i64::from(down[i]), "tolower({c})");
        }
    }

    #[test]
    fn the_loader_writes_conversion_tables_the_guest_can_index() {
        let mut mem = Memory::new();
        crate::hosted::stdio::write_stdio_globals(&mut mem).unwrap();
        for (ptr, base, to_upper) in [
            (
                crate::hosted::stdio::CTYPE_TOUPPER_PTR,
                crate::hosted::stdio::CTYPE_TOUPPER_TABLE,
                true,
            ),
            (
                crate::hosted::stdio::CTYPE_TOLOWER_PTR,
                crate::hosted::stdio::CTYPE_TOLOWER_TABLE,
                false,
            ),
        ] {
            let table = mem.read_u64(ptr).unwrap();
            assert_eq!(
                table,
                base + TABLE_ZERO_OFFSET_I32,
                "the stored pointer must aim at index 0, not at the start"
            );
            let entry = |c: i64| mem.read_u32((table as i64 + c * 4) as u64).unwrap() as i32;
            let want = conversion_table(to_upper);
            for c in [-128i64, -5, -1, 0, 'A' as i64, 'a' as i64, '5' as i64, 255] {
                assert_eq!(entry(c), want[(c as i32 - TABLE_FIRST_INDEX) as usize], "index {c}");
            }
        }
        // Both tables stay inside the single page the loader mapped for
        // them: 384 entries of 4 bytes each, twice, is 3072 of its 4096.
        let end = crate::hosted::stdio::CTYPE_TOLOWER_TABLE + (TABLE_ENTRIES as u64) * 4;
        assert!(
            end < crate::hosted::stdio::CTYPE_CONV_BASE + 4096,
            "the conversion tables overran their page"
        );
    }

    #[test]
    fn ctype_conversion_loc_answers_the_pointer_word_not_the_table() {
        let mut h = Host::new();
        ctype_toupper_loc(&mut h.ctx()).unwrap();
        assert_eq!(
            h.regs.read_gpr(0, true),
            crate::hosted::stdio::CTYPE_TOUPPER_PTR
        );
        assert_ne!(
            h.regs.read_gpr(0, true),
            crate::hosted::stdio::CTYPE_TOUPPER_TABLE + TABLE_ZERO_OFFSET_I32
        );
        ctype_tolower_loc(&mut h.ctx()).unwrap();
        assert_eq!(
            h.regs.read_gpr(0, true),
            crate::hosted::stdio::CTYPE_TOLOWER_PTR
        );
    }

    #[test]
    fn ctype_b_loc_answers_the_pointer_word_not_the_table() {
        let mut h = Host::new();
        ctype_b_loc(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), crate::hosted::stdio::CTYPE_B_PTR);
        // One dereference short would hand back the table itself.
        assert_ne!(
            h.regs.read_gpr(0, true),
            crate::hosted::stdio::CTYPE_B_TABLE + TABLE_ZERO_OFFSET
        );
    }
}
