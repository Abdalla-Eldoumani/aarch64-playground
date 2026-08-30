//! FILE*-level stdio over the VFS: fopen, fprintf, fclose.
//!
//! A FILE* here is an opaque handle -- `FILE_HANDLE_BASE + fd * 16` --
//! a pure function of the descriptor open_vfs hands out, so no new
//! machine state exists and snapshots/step-back restore streams for
//! free. The handle page sits above the host-stub table and below
//! nothing mappable, so it can never collide with a section, the heap,
//! the argv page, or the stack; a program that dereferences a FILE*
//! faults calmly on the unmapped page, the honest analog of poking
//! glibc's opaque struct.
//!
//! Course usage (assignment 4 shape): `fopen("assign4.log", "w")`, the
//! FILE* moved between registers, `fprintf(FILE*, fmt, ...)` per cell,
//! one `fclose` at the end. fprintf reuses the printf engine with the
//! vararg cursor starting at x2 (x0 = stream, x1 = format), and the
//! bytes route through the same fd path -- and the same VFS caps -- as
//! the write syscall.

use crate::errors::EmuError;
use crate::hosted::printf::{format_into, read_c_string};
use crate::hosted::syscalls::{open_vfs, write_to_fd};
use crate::hosted::{HostContext, HostOutcome};
use crate::memory::Memory;

/// Base of the synthetic FILE* handle range: one page above the host
/// stub table's end (`HOST_STUB_BASE` 0xFFFF_0000 + 256 * 16 =
/// 0xFFFF_1000), 16-byte stride to mirror the stub spacing.
pub const FILE_HANDLE_BASE: u64 = 0xFFFF_2000;
const FILE_HANDLE_STRIDE: u64 = 16;

/// Base of the loader-written stdio globals: `stdin` at +0, `stdout` at
/// +8, `stderr` at +16, one 8-byte word each holding that descriptor's
/// FILE* handle.
///
/// glibc's `stdout` names a word that HOLDS a FILE*, not the FILE*
/// itself -- gcc-compiled code does `adrp`/`add` to the symbol and then
/// `ldr`s the handle out of memory -- so the three linker symbols have to
/// address real memory for `ldr x0, =stdout` + `ldr x0, [x0]` to answer
/// what it answers on the course servers.
///
/// The page sits immediately above the argv page and below the heap
/// window, in the gap `ARGV_BASE` already left for it, so no section, the
/// stack, or the heap can reach it.
pub const STDIO_GLOBALS_BASE: u64 = 0x0080_1000;

/// The word `__ctype_b_loc` returns the address OF: it holds a pointer
/// to the character-class table. Same page as the stream handles because
/// it is the same kind of thing -- a libc global the loader writes once
/// and the program only ever loads through.
pub const CTYPE_B_PTR: u64 = STDIO_GLOBALS_BASE + 24;
/// First entry (index -128) of the character-class table. 768 bytes of
/// the page, ending well short of its 4 KiB.
pub const CTYPE_B_TABLE: u64 = STDIO_GLOBALS_BASE + 32;

fn handle_of(fd: u32) -> u64 {
    FILE_HANDLE_BASE + fd as u64 * FILE_HANDLE_STRIDE
}

/// Write the `stdin`/`stdout`/`stderr` words and the character-class
/// table `__ctype_b_loc` points into. The loader calls this on every
/// hosted load, beside the argv page, and `Cpu::new`/`Cpu::reset` call it
/// too so the fixed layout is there before any program is.
pub fn write_stdio_globals(mem: &mut Memory) -> Result<(), EmuError> {
    mem.map_page(STDIO_GLOBALS_BASE);
    for fd in 0..3u32 {
        mem.write_u64(STDIO_GLOBALS_BASE + fd as u64 * 8, handle_of(fd))?;
    }
    // The stored pointer aims at the table's index 0, not its start: the
    // table runs from -128 so `(*__ctype_b_loc())[c]` can index it with a
    // signed char, exactly as glibc's does.
    mem.write_u64(CTYPE_B_PTR, CTYPE_B_TABLE + crate::hosted::ctype::TABLE_ZERO_OFFSET)?;
    for (i, bits) in crate::hosted::ctype::table().iter().enumerate() {
        mem.write_u16(CTYPE_B_TABLE + (i as u64) * 2, *bits)?;
    }
    Ok(())
}

/// Decode a handle back to its descriptor. Valid only when the value
/// sits in the handle range on its stride AND the descriptor is live in
/// the fd table -- a closed stream decodes to None, so fclose-twice and
/// use-after-close answer like glibc's EOF instead of writing somewhere.
fn fd_of(ctx: &HostContext<'_>, handle: u64) -> Option<u32> {
    if handle < FILE_HANDLE_BASE {
        return None;
    }
    let rel = handle - FILE_HANDLE_BASE;
    if !rel.is_multiple_of(FILE_HANDLE_STRIDE) {
        return None;
    }
    let fd = u32::try_from(rel / FILE_HANDLE_STRIDE).ok()?;
    // The three standard streams never pass through fopen, so the fd
    // table has no entry to find them by; they are open for the life of
    // the program, exactly as they are under a shell.
    if fd <= 2 {
        return Some(fd);
    }
    if ctx.open_files.contains_key(&fd) {
        Some(fd)
    } else {
        None
    }
}

/// fopen(path, mode) -> FILE* or NULL.
/// Modes follow C: `r` read, `w` write+create+truncate, `a` append
/// (create, offset at end), a `+` anywhere adds the other direction,
/// `b` means nothing here. An unrecognized mode or any refused wall
/// answers NULL, which is the value course code checks.
pub fn fopen(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let path_ptr = ctx.regs.read_gpr(0, true);
    let mode_ptr = ctx.regs.read_gpr(1, true);
    let path_bytes = read_c_string(ctx.mem, path_ptr, "fopen's filename")?;
    let path = String::from_utf8_lossy(&path_bytes).into_owned();
    let mode_bytes = read_c_string(ctx.mem, mode_ptr, "fopen's mode")?;
    let mode = String::from_utf8_lossy(&mode_bytes).into_owned();

    let plus = mode.contains('+');
    let opened = match mode.chars().next() {
        Some('r') => open_vfs(ctx, &path, plus, false, false, false),
        Some('w') => open_vfs(ctx, &path, true, true, true, false),
        Some('a') => open_vfs(ctx, &path, true, true, false, true),
        _ => None,
    };
    match opened {
        Some(fd) => ctx.regs.write_gpr(0, true, handle_of(fd)),
        None => ctx.regs.write_gpr(0, true, 0),
    }
    Ok(HostOutcome::Continue)
}

/// fprintf(stream, fmt, ...) -> chars written, -1 on a refused write.
/// A value that never came from fopen is a calm halt naming the fix,
/// like free() on a wild pointer -- there is no stream to write to and
/// silently dropping the output would hide the bug.
pub fn fprintf(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let handle = ctx.regs.read_gpr(0, true);
    let Some(fd) = fd_of(ctx, handle) else {
        return Err(not_a_stream("fprintf", handle));
    };
    let fmt_ptr = ctx.regs.read_gpr(1, true);
    // x0 = stream and x1 = format are the fixed params; varargs start at x2.
    let out = format_into(ctx, fmt_ptr, 2, "fprintf's format string")?;
    let n = write_to_fd(ctx, fd as u64, &out);
    ctx.regs.write_gpr(0, true, n as u64);
    Ok(HostOutcome::Continue)
}

/// fputs(s, stream) -> the byte count on success, EOF (-1) on a refused
/// write. The string goes out as it stands: no terminator, and no
/// newline added (that is puts, and mixing the two up is a classic bug
/// this must not paper over).
pub fn fputs(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let str_ptr = ctx.regs.read_gpr(0, true);
    let handle = ctx.regs.read_gpr(1, true);
    let Some(fd) = fd_of(ctx, handle) else {
        return Err(not_a_stream("fputs", handle));
    };
    let bytes = read_c_string(ctx.mem, str_ptr, "fputs's string")?;
    let n = write_to_fd(ctx, fd as u64, &bytes);
    ctx.regs.write_gpr(0, true, n as u64);
    Ok(HostOutcome::Continue)
}

/// fgets(buf, n, stream) -> buf, or NULL at end of input.
/// Reads at most `n - 1` bytes, stops just past a newline and KEEPS it,
/// and always terminates what it stored. From stdin it follows scanf's
/// stall contract: a line that has not arrived yet pauses the machine
/// rather than returning a short read, because a student typing at a
/// prompt is mid-line, not at end of file.
pub fn fgets(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let buf = ctx.regs.read_gpr(0, true);
    let n = ctx.regs.read_gpr(1, false) as u32 as i32;
    let handle = ctx.regs.read_gpr(2, true);
    let Some(fd) = fd_of(ctx, handle) else {
        return Err(not_a_stream("fgets", handle));
    };
    // glibc's two size edges: a non-positive size reads nothing and
    // answers NULL, and a size of 1 stores just the terminator without
    // touching the stream at all.
    if n <= 0 {
        ctx.regs.write_gpr(0, true, 0);
        return Ok(HostOutcome::Continue);
    }
    if n == 1 {
        ctx.mem.write_u8(buf, 0)?;
        ctx.regs.write_gpr(0, true, buf);
        return Ok(HostOutcome::Continue);
    }
    let limit = (n - 1) as usize;
    let line = match fd {
        0 => match take_line_from_stdin(ctx, limit) {
            Some(line) => line,
            None => return Ok(HostOutcome::NeedInput),
        },
        1 | 2 => Vec::new(), // an output stream reads as end of file
        _ => take_line_from_file(ctx, fd, limit),
    };
    if line.is_empty() {
        // Nothing left to read: C's end-of-input answer, and the reason
        // `while (fgets(...))` terminates.
        ctx.regs.write_gpr(0, true, 0);
        return Ok(HostOutcome::Continue);
    }
    for (i, b) in line.iter().enumerate() {
        ctx.mem.write_u8(buf.wrapping_add(i as u64), *b)?;
    }
    ctx.mem.write_u8(buf.wrapping_add(line.len() as u64), 0)?;
    ctx.regs.write_gpr(0, true, buf);
    Ok(HostOutcome::Continue)
}

/// The bytes fgets may take from stdin right now, or None when the line
/// is still being typed. Nothing is echoed here: the CPU derives the
/// cooked-tty echo from how much of the queue a dispatch drained, so a
/// stub that echoed as well would print the line twice.
fn take_line_from_stdin(ctx: &mut HostContext<'_>, limit: usize) -> Option<Vec<u8>> {
    let window = limit.min(ctx.stdin.len());
    let take = match ctx.stdin[..window].iter().position(|b| *b == b'\n') {
        Some(at) => at + 1,
        // A full buffer's worth with no newline is a complete answer.
        None if ctx.stdin.len() >= limit => limit,
        // Closed input hands over whatever is left, empty included.
        None if ctx.stdin_closed => ctx.stdin.len(),
        None => return None,
    };
    Some(ctx.stdin.drain(..take).collect())
}

/// The same read against an open virtual file, advancing its cursor.
fn take_line_from_file(ctx: &mut HostContext<'_>, fd: u32, limit: usize) -> Vec<u8> {
    let Some(file) = ctx.open_files.get(&fd) else {
        return Vec::new();
    };
    let offset = file.offset as usize;
    // Borrowed, not cloned: a read loop over a big virtual file would
    // otherwise copy the whole thing once per line.
    let line = match ctx.vfs.get(&file.path) {
        Some(data) => {
            let available = &data[offset.min(data.len())..];
            let window = limit.min(available.len());
            let take = available[..window]
                .iter()
                .position(|b| *b == b'\n')
                .map_or(window, |at| at + 1);
            available[..take].to_vec()
        }
        None => Vec::new(),
    };
    if let Some(file) = ctx.open_files.get_mut(&fd) {
        file.offset += line.len() as u64;
    }
    line
}

/// The calm halt a value that never came from fopen earns, naming the
/// call that was handed it.
fn not_a_stream(call: &str, handle: u64) -> EmuError {
    EmuError::RuntimeError {
        message: format!(
            "{call} was given 0x{handle:x}, which is not a stream fopen \
             returned -- check the fopen return value for NULL (x0 == 0) \
             before using it, and keep the FILE* in a callee-saved register"
        ),
    }
}

/// fclose(stream) -> 0, or EOF (-1) for a handle that is not open.
/// Nothing is buffered in this runtime (fflush is already a documented
/// no-op), so closing is exactly dropping the descriptor.
pub fn fclose(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let handle = ctx.regs.read_gpr(0, true);
    match fd_of(ctx, handle) {
        Some(fd) => {
            // Closing a standard stream succeeds and takes nothing away:
            // there is no descriptor to drop, and making later printf
            // output vanish would punish a habit (fclose everything the
            // function touched) that costs nothing on the servers.
            if fd > 2 {
                ctx.open_files.remove(&fd);
            }
            ctx.regs.write_gpr(0, true, 0);
        }
        None => ctx.regs.write_gpr(0, true, (-1i64) as u64),
    }
    Ok(HostOutcome::Continue)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cpu::OpenFile;
    use crate::registers::RegisterFile;
    use std::collections::HashMap;

    const BUF: u64 = 0x0060_0000;
    const TEXT: u64 = 0x0050_0000;

    struct Host {
        regs: RegisterFile,
        mem: Memory,
        stdout: Vec<u8>,
        stderr: Vec<u8>,
        stdin: Vec<u8>,
        stdin_closed: bool,
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
            let mut mem = Memory::new();
            mem.map_page(BUF);
            mem.map_page(TEXT);
            Host {
                regs: RegisterFile::new(),
                mem,
                stdout: Vec::new(),
                stderr: Vec::new(),
                stdin: Vec::new(),
                stdin_closed: false,
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
                stdin_closed: self.stdin_closed,
                vfs: &mut self.vfs,
                open_files: &mut self.open_files,
                next_fd: &mut self.next_fd,
                rand_state: &mut self.rand_state,
                term: &mut self.term,
                heap: &mut self.heap,
                strtok_save: &mut self.strtok_save,
            }
        }
        fn place_string(&mut self, addr: u64, s: &[u8]) {
            for (i, b) in s.iter().enumerate() {
                self.mem.write_u8(addr + i as u64, *b).unwrap();
            }
            self.mem.write_u8(addr + s.len() as u64, 0).unwrap();
        }
        /// fgets(BUF, n, stream) -> (outcome, what x0 came back as).
        fn fgets(&mut self, n: u64, stream: u64) -> (HostOutcome, u64) {
            self.regs.write_gpr(0, true, BUF);
            self.regs.write_gpr(1, false, n);
            self.regs.write_gpr(2, true, stream);
            let outcome = fgets(&mut self.ctx()).unwrap();
            (outcome, self.regs.read_gpr(0, true))
        }
        /// What fgets left in the buffer, up to its terminator.
        fn buffer(&self) -> String {
            let bytes = read_c_string(&self.mem, BUF, "test").unwrap();
            String::from_utf8_lossy(&bytes).into_owned()
        }
        fn open_file(&mut self, fd: u32, path: &str, contents: &[u8]) -> u64 {
            self.vfs.insert(path.to_string(), contents.to_vec());
            self.open_files.insert(
                fd,
                OpenFile { path: path.to_string(), offset: 0, writable: true },
            );
            handle_of(fd)
        }
    }

    #[test]
    fn fgets_keeps_the_newline_and_consumes_exactly_one_line() {
        let mut h = Host::new();
        h.stdin.extend_from_slice(b"first\nsecond\n");
        let (outcome, ret) = h.fgets(64, handle_of(0));
        assert_eq!(outcome, HostOutcome::Continue);
        assert_eq!(ret, BUF, "fgets answers the buffer it filled");
        assert_eq!(h.buffer(), "first\n");
        assert_eq!(h.stdin, b"second\n", "only the first line was taken");
        // Nothing is echoed by the stub: the CPU derives the echo from
        // the stdin it drained, and a second copy here would double it.
        assert!(h.stdout.is_empty());
    }

    #[test]
    fn fgets_stalls_until_the_line_arrives() {
        let mut h = Host::new();
        h.stdin.extend_from_slice(b"half");
        let (outcome, _) = h.fgets(64, handle_of(0));
        assert_eq!(outcome, HostOutcome::NeedInput);
        assert_eq!(h.stdin, b"half", "a stalled read consumes nothing");
        h.stdin.extend_from_slice(b" a line\n");
        let (outcome, ret) = h.fgets(64, handle_of(0));
        assert_eq!(outcome, HostOutcome::Continue);
        assert_eq!(ret, BUF);
        assert_eq!(h.buffer(), "half a line\n");
    }

    #[test]
    fn fgets_answers_null_at_end_of_input() {
        let mut h = Host::new();
        h.stdin_closed = true;
        let (outcome, ret) = h.fgets(64, handle_of(0));
        assert_eq!(outcome, HostOutcome::Continue);
        assert_eq!(ret, 0, "EOF with nothing read is NULL");
        // A last line with no newline still comes back once input closed.
        h.stdin.extend_from_slice(b"tail");
        let (_, ret) = h.fgets(64, handle_of(0));
        assert_eq!(ret, BUF);
        assert_eq!(h.buffer(), "tail");
        let (_, ret) = h.fgets(64, handle_of(0));
        assert_eq!(ret, 0);
    }

    #[test]
    fn fgets_stops_after_n_minus_one_bytes() {
        let mut h = Host::new();
        h.stdin.extend_from_slice(b"abcdefgh\n");
        let (_, ret) = h.fgets(4, handle_of(0));
        assert_eq!(ret, BUF);
        assert_eq!(h.buffer(), "abc");
        assert_eq!(h.stdin, b"defgh\n");
        // The size edges glibc special-cases.
        let (_, ret) = h.fgets(1, handle_of(0));
        assert_eq!(ret, BUF);
        assert_eq!(h.buffer(), "");
        assert_eq!(h.stdin, b"defgh\n", "a size of 1 reads nothing");
        let (_, ret) = h.fgets(0, handle_of(0));
        assert_eq!(ret, 0);
    }

    #[test]
    fn fgets_walks_an_open_file_line_by_line() {
        let mut h = Host::new();
        let stream = h.open_file(3, "notes.txt", b"one\ntwo\n");
        let (_, ret) = h.fgets(64, stream);
        assert_eq!(ret, BUF);
        assert_eq!(h.buffer(), "one\n");
        let (_, ret) = h.fgets(64, stream);
        assert_eq!(ret, BUF);
        assert_eq!(h.buffer(), "two\n");
        assert_eq!(h.open_files[&3].offset, 8, "the cursor tracks what was read");
        let (_, ret) = h.fgets(64, stream);
        assert_eq!(ret, 0, "past the end of the file is NULL");
    }

    #[test]
    fn fputs_writes_the_string_alone() {
        let mut h = Host::new();
        h.place_string(TEXT, b"no newline here");
        h.regs.write_gpr(0, true, TEXT);
        h.regs.write_gpr(1, true, handle_of(1));
        fputs(&mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, 15);
        assert_eq!(h.stdout, b"no newline here");
        // Into a file it lands at the cursor, like any other write.
        let stream = h.open_file(3, "out.txt", b"");
        h.regs.write_gpr(0, true, TEXT);
        h.regs.write_gpr(1, true, stream);
        fputs(&mut h.ctx()).unwrap();
        assert_eq!(h.vfs["out.txt"], b"no newline here");
    }

    #[test]
    fn a_wild_stream_halts_naming_the_call() {
        let mut h = Host::new();
        h.place_string(TEXT, b"x");
        h.regs.write_gpr(0, true, TEXT);
        h.regs.write_gpr(1, true, 0x1234);
        let err = fputs(&mut h.ctx()).unwrap_err().to_string();
        assert!(err.contains("fputs") && err.contains("fopen"), "message: {err}");
        h.regs.write_gpr(0, true, BUF);
        h.regs.write_gpr(1, false, 8);
        h.regs.write_gpr(2, true, 0x1234);
        let err = fgets(&mut h.ctx()).unwrap_err().to_string();
        assert!(err.contains("fgets") && err.contains("fopen"), "message: {err}");
    }

}
