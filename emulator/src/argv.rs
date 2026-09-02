//! Command-line argument layout for hosted programs.
//!
//! Programs that read argc/argv (week 11 onward) need a pointer table
//! plus a string pool somewhere the loader controls. We reserve a page
//! above `.bss` and below the stack so the student's working area
//! (stack, heap-style scratch in `.bss`) stays untouched.
//!
//! The loader owns argv[0]: on Linux argc is never 0 -- argv[0] is the
//! program path -- so every load gets `DEFAULT_ARGV0` prepended and the
//! caller's slice is argv[1..], the arguments after the program name.
//! A program that gates on `cmp w0, 3` or prints argv[0] behaves here
//! exactly as it does on the course servers.
//!
//! Page layout at `ARGV_BASE` (one 4 KiB page):
//! ```text
//!   +0:                argv[0] = ARGV_BASE + (argc+1)*8
//!   +8:                argv[1]
//!   ...
//!   +argc*8:           NULL terminator
//!   +(argc+1)*8:       string pool: argv[0] bytes, NUL, argv[1] bytes, NUL, ...
//! ```
//!
//! On entry per AAPCS64: `w0 = argc`, `x1 = argv` (pointer to the table).

use crate::errors::EmuError;
use crate::memory::Memory;
use crate::registers::RegisterFile;

/// Reserved page for the argv pointer table + string pool.
///
/// Sits above `.bss` (`0x0070_0000`) and well below the stack
/// (`0x8000_0000`), with a 1 MiB gap so future allocations (heap, mmap)
/// can claim adjacent space without renumbering.
pub const ARGV_BASE: u64 = 0x0080_0000;

/// Cap on combined pointer-table + string-pool size. One 4 KiB page is
/// plenty for any realistic command-line on this playground.
pub const ARGV_MAX_BYTES: usize = 4096;

/// The program name every load receives as argv[0]. The terminal pane
/// already presents the assembled buffer under this name.
pub const DEFAULT_ARGV0: &str = "./program";

/// Write the pointer table and string pool at `ARGV_BASE` and set the
/// AAPCS64 entry registers (`w0 = argc`, `x1 = argv`). Caller is the
/// program loader; `args` is argv[1..] -- an empty slice still produces
/// argc = 1 with argv[0] = `DEFAULT_ARGV0`, the Linux invariant.
pub fn setup_argv(
    regs: &mut RegisterFile,
    mem: &mut Memory,
    args: &[&str],
) -> Result<(), EmuError> {
    let all: Vec<&str> = std::iter::once(DEFAULT_ARGV0)
        .chain(args.iter().copied())
        .collect();

    let argc = all.len() as u64;
    let pointer_table_bytes = ((argc + 1) * 8) as usize;
    let mut total = pointer_table_bytes;
    for s in &all {
        total += s.len() + 1;
    }
    if total > ARGV_MAX_BYTES {
        return Err(EmuError::ArgvTooLarge { bytes: total });
    }

    mem.map_page(ARGV_BASE);

    let pool_start = ARGV_BASE + pointer_table_bytes as u64;
    let mut str_offset = 0u64;
    for (i, s) in all.iter().enumerate() {
        let str_addr = pool_start + str_offset;
        // pointer table slot
        mem.write_u64(ARGV_BASE + (i as u64) * 8, str_addr)?;
        // string bytes
        let bytes = s.as_bytes();
        mem.write_bytes(str_addr, bytes)?;
        // null terminator
        mem.write_bytes(str_addr + bytes.len() as u64, &[0u8])?;
        str_offset += (bytes.len() + 1) as u64;
    }
    // NULL terminator at argv[argc]
    mem.write_u64(ARGV_BASE + argc * 8, 0)?;

    regs.write_gpr(0, true, argc);
    regs.write_gpr(1, true, ARGV_BASE);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_args_still_supplies_argv0() {
        let mut regs = RegisterFile::new();
        regs.write_gpr(0, true, 0xDEAD);
        regs.write_gpr(1, true, 0xBEEF);
        let mut mem = Memory::new();
        setup_argv(&mut regs, &mut mem, &[]).unwrap();
        assert_eq!(regs.read_gpr(0, true), 1);
        assert_eq!(regs.read_gpr(1, true), ARGV_BASE);
        let argv0 = mem.read_u64(ARGV_BASE).unwrap();
        let bytes = mem
            .read_bytes(argv0, DEFAULT_ARGV0.len() + 1)
            .unwrap();
        assert_eq!(bytes, b"./program\0");
        assert_eq!(mem.read_u64(ARGV_BASE + 8).unwrap(), 0);
    }

    #[test]
    fn writes_pointer_table_and_pool_for_two_args() {
        let mut regs = RegisterFile::new();
        let mut mem = Memory::new();
        setup_argv(&mut regs, &mut mem, &["hello", "world"]).unwrap();

        // w0 = argc (program name + 2), x1 = ARGV_BASE
        assert_eq!(regs.read_gpr(0, true), 3);
        assert_eq!(regs.read_gpr(1, true), ARGV_BASE);

        // Pointer table: argv[0..2] then NULL.
        let argv0 = mem.read_u64(ARGV_BASE).unwrap();
        let argv1 = mem.read_u64(ARGV_BASE + 8).unwrap();
        let argv2 = mem.read_u64(ARGV_BASE + 16).unwrap();
        let argv3 = mem.read_u64(ARGV_BASE + 24).unwrap();
        let pool_start = ARGV_BASE + 4 * 8; // (argc+1) * 8
        assert_eq!(argv0, pool_start);
        let argv0_len = DEFAULT_ARGV0.len() as u64 + 1;
        assert_eq!(argv1, pool_start + argv0_len);
        assert_eq!(argv2, pool_start + argv0_len + 6); // "hello" + NUL
        assert_eq!(argv3, 0);

        // Strings present + NUL-terminated.
        let bytes0 = mem.read_bytes(argv0, argv0_len as usize).unwrap();
        assert_eq!(bytes0, b"./program\0");
        let bytes1 = mem.read_bytes(argv1, 6).unwrap();
        assert_eq!(bytes1, b"hello\0");
        let bytes2 = mem.read_bytes(argv2, 6).unwrap();
        assert_eq!(bytes2, b"world\0");
    }

    #[test]
    fn rejects_payload_over_one_page() {
        let mut regs = RegisterFile::new();
        let mut mem = Memory::new();
        // 4 args, each just under 1 KiB -- pointer table is 40 bytes,
        // strings push past 4 KiB total.
        let big = "x".repeat(1024);
        let args: Vec<&str> = vec![&big, &big, &big, &big];
        let err = setup_argv(&mut regs, &mut mem, &args).unwrap_err();
        // The args box is the only thing a student can shorten, and the web
        // layer keys its teaching block off this wording.
        let rendered = err.to_string();
        assert!(
            rendered.contains("the playground reserves for argv"),
            "message was: {rendered}"
        );
        assert!(rendered.contains("args box"), "message was: {rendered}");
        match err {
            EmuError::ArgvTooLarge { bytes } => {
                assert!(bytes > ARGV_MAX_BYTES);
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }
}
