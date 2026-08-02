//! Linux AArch64 syscall dispatcher for `svc #0`. The handler reads the
//! syscall number from `x8`, the arguments from `x0..x5`, and writes the
//! result back into `x0`.
//!
//! Covers the set the corpus needs: `write` (64), `read` (63), `exit` (93),
//! and the VFS-backed file syscalls (openat, close, lseek).

use crate::cpu::OpenFile;
use crate::errors::EmuError;
use crate::hosted::printf::read_c_string;
use crate::hosted::{HostContext, HostOutcome};

pub const SYS_READ: u64 = 63;
pub const SYS_WRITE: u64 = 64;
pub const SYS_EXIT: u64 = 93;
/// glibc's exit() issues exit_group on AArch64 Linux, and most online
/// tutorials teach 94, so both numbers terminate the program.
pub const SYS_EXIT_GROUP: u64 = 94;
pub const SYS_OPENAT: u64 = 56;
pub const SYS_CLOSE: u64 = 57;
pub const SYS_LSEEK: u64 = 62;
/// The interactive set: terminal-mode programs (games, raw-input
/// tools) configure the terminal with ioctl/fcntl, pace themselves
/// with nanosleep, read the clock, and pull entropy.
pub const SYS_IOCTL: u64 = 29;
pub const SYS_FCNTL: u64 = 25;
pub const SYS_NANOSLEEP: u64 = 101;
pub const SYS_CLOCK_GETTIME: u64 = 113;
pub const SYS_GETRANDOM: u64 = 278;

/// Linux -EAGAIN, returned by a non-blocking read on empty stdin.
const EAGAIN: i64 = -11;

/// termios request numbers (AArch64 Linux ABI). TCSETSW/TCSETSF drain
/// or flush first on real hardware; here all three just apply.
const TCGETS: u64 = 0x5401;
const TCSETS: u64 = 0x5402;
const TCSETSW: u64 = 0x5403;
const TCSETSF: u64 = 0x5404;

/// termios c_lflag bits the raw-mode handshake cares about.
const ICANON: u32 = 0o0002;
const ECHO: u32 = 0o0010;
/// A cooked terminal's typical c_lflag (ISIG|ICANON|ECHO|ECHOE|ECHOK|
/// IEXTEN), what TCGETS reports before a program goes raw.
const COOKED_LFLAG: u32 = 0o105073;

/// fcntl commands and the flag bit the games use.
const F_GETFL: u64 = 3;
const F_SETFL: u64 = 4;
const O_NONBLOCK: u64 = 0o4000;

/// Byte size of the struct termios the kernel copies for TCGETS /
/// TCSETS (4 u32 flag words, c_line, then c_cc). Programs typically
/// reserve 60 bytes; only the four flag words matter here.
const TERMIOS_BYTES: u64 = 36;

/// getrandom fills at most this many bytes per call. Course-sized
/// programs draw a byte or two; the cap keeps a huge len argument from
/// stalling the tab filling gigabytes.
const MAX_GETRANDOM_BYTES: u64 = 1024;

/// Upper bound on a virtual-filesystem file size. `lseek` lets a guest pick
/// the offset a later `write` lands at, so without a cap a one-byte write at
/// a huge offset would resize the backing `Vec` to gigabytes and abort the
/// host allocator. Sized against the step-back snapshot ring, which clones
/// the whole VFS every step (~129x amplification, the same budget math as
/// `memory::MAX_MAPPED_PAGES`): 4 MiB keeps the worst-case ring cost near
/// half a GiB while staying far above anything the corpus needs.
pub const MAX_VFS_FILE_BYTES: usize = 4 * 1024 * 1024;

/// Upper bound on the VFS as a whole. The per-file cap alone would let N
/// files multiply the ring amplification N times over; the total holds the
/// worst case to one cap's worth regardless of file count.
pub const MAX_VFS_TOTAL_BYTES: usize = 4 * 1024 * 1024;

/// Upper bound on how many files `openat` may create. Entries were
/// previously inserted unbounded; course programs open one or two.
pub const MAX_VFS_FILES: usize = 16;

/// Upper bound on how many descriptors may be open at once. The file
/// count caps the VFS, not the fd table: re-opening one existing file in
/// a loop still grew `open_files` without limit, and each entry carries
/// its own copy of the path (200 re-opens of a 60 KiB path held 11 MiB,
/// cloned again into every snapshot frame). Linux answers EMFILE past
/// its own limit; course programs open one or two files at a time.
pub const MAX_OPEN_FILES: usize = 16;

/// Linux `O_*` flag bits we care about. Matches the AArch64 Linux ABI.
const O_WRONLY: u32 = 0o1;
const O_RDWR: u32 = 0o2;
const O_CREAT: u32 = 0o100;
const O_TRUNC: u32 = 0o1000;

/// Dispatch a syscall. `number` is the value of `x8`.
pub fn dispatch(number: u64, ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    match number {
        SYS_WRITE => sys_write(ctx),
        SYS_READ => sys_read(ctx),
        SYS_EXIT | SYS_EXIT_GROUP => sys_exit(ctx),
        SYS_OPENAT => sys_openat(ctx),
        SYS_CLOSE => sys_close(ctx),
        SYS_LSEEK => sys_lseek(ctx),
        SYS_IOCTL => sys_ioctl(ctx),
        SYS_FCNTL => sys_fcntl(ctx),
        SYS_NANOSLEEP => sys_nanosleep(ctx),
        SYS_CLOCK_GETTIME => sys_clock_gettime(ctx),
        SYS_GETRANDOM => sys_getrandom(ctx),
        _ => Err(EmuError::RuntimeError {
            message: format!(
                "syscall {number} (x8) is not supported -- this emulator implements \
                 fcntl(25), ioctl(29), openat(56), close(57), lseek(62), read(63), \
                 write(64), exit(93/94), nanosleep(101), clock_gettime(113), and \
                 getrandom(278); use `mov x8, 93` then `svc 0` to exit"
            ),
        }),
    }
}

/// ioctl(fd, request, argp). Supports the termios pair a raw-mode
/// program needs: TCGETS reports a cooked terminal, and any TCSETS
/// variant applies the caller's c_lflag -- clearing ICANON is the
/// raw-mode handshake that marks this program as a terminal program.
/// Unknown requests return -1 without halting, like the kernel's
/// EINVAL, so a stray ioctl stays a program-visible error.
pub fn sys_ioctl(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let request = ctx.regs.read_gpr(1, true);
    let argp = ctx.regs.read_gpr(2, true);
    match request {
        TCGETS => {
            for off in 0..TERMIOS_BYTES {
                ctx.mem.write_u8(argp.wrapping_add(off), 0)?;
            }
            // c_iflag ICRNL|IXON, c_oflag OPOST|ONLCR, c_cflag CS8,
            // c_lflag cooked: enough structure that the usual
            // save/modify/restore dance behaves like a real terminal.
            write_u32(ctx, argp, 0o2400)?;
            write_u32(ctx, argp.wrapping_add(4), 0o5)?;
            write_u32(ctx, argp.wrapping_add(8), 0o277)?;
            write_u32(ctx, argp.wrapping_add(12), COOKED_LFLAG)?;
            ctx.regs.write_gpr(0, true, 0);
        }
        TCSETS | TCSETSW | TCSETSF => {
            let lflag = read_u32(ctx, argp.wrapping_add(12))?;
            ctx.term.raw_mode = (lflag & ICANON) == 0 || (lflag & ECHO) == 0;
            ctx.regs.write_gpr(0, true, 0);
        }
        _ => {
            ctx.regs.write_gpr(0, true, (-1i64) as u64);
        }
    }
    Ok(HostOutcome::Continue)
}

/// fcntl(fd, cmd, arg). F_GETFL reports fd 0's flags; F_SETFL applies
/// O_NONBLOCK to fd 0, after which an empty read returns -EAGAIN
/// instead of pausing the machine. Other commands return -1.
pub fn sys_fcntl(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let fd = ctx.regs.read_gpr(0, true);
    let cmd = ctx.regs.read_gpr(1, true);
    let arg = ctx.regs.read_gpr(2, true);
    match cmd {
        F_GETFL => {
            let flags = if fd == 0 && ctx.term.stdin_nonblock { O_NONBLOCK } else { 0 };
            ctx.regs.write_gpr(0, true, flags);
        }
        F_SETFL => {
            if fd == 0 {
                ctx.term.stdin_nonblock = (arg & O_NONBLOCK) != 0;
            }
            ctx.regs.write_gpr(0, true, 0);
        }
        _ => {
            ctx.regs.write_gpr(0, true, (-1i64) as u64);
        }
    }
    Ok(HostOutcome::Continue)
}

/// nanosleep(req, rem). Reads the timespec, returns success, and hands
/// the duration up as `Sleep` -- the CPU advances its virtual clock and
/// credits the pacing budgets, and a real-time runner waits it out.
pub fn sys_nanosleep(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let req = ctx.regs.read_gpr(0, true);
    let sec = ctx.mem.read_u64(req)?;
    let nsec = ctx.mem.read_u64(req + 8)?;
    let ns = sec
        .saturating_mul(1_000_000_000)
        .saturating_add(nsec.min(999_999_999));
    ctx.regs.write_gpr(0, true, 0);
    Ok(HostOutcome::Sleep(ns))
}

/// clock_gettime(clkid, tp). Every clock id reads the same virtual
/// monotonic clock, which only nanosleep advances -- deterministic for
/// replay, yet it tracks real pacing whenever the runner honors sleeps.
pub fn sys_clock_gettime(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let tp = ctx.regs.read_gpr(1, true);
    let ns = ctx.term.virtual_ns;
    ctx.mem.write_u64(tp, ns / 1_000_000_000)?;
    ctx.mem.write_u64(tp + 8, ns % 1_000_000_000)?;
    ctx.regs.write_gpr(0, true, 0);
    Ok(HostOutcome::Continue)
}

/// getrandom(buf, len, flags). Fills from the same deterministic
/// generator behind rand/srand, so draws snapshot and replay exactly
/// like every other machine state. Capped so a giant len cannot stall
/// the tab.
pub fn sys_getrandom(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let buf = ctx.regs.read_gpr(0, true);
    let len = ctx.regs.read_gpr(1, true).min(MAX_GETRANDOM_BYTES);
    for i in 0..len {
        // Same LCG as the libc rand stub, taking the useful high bits.
        *ctx.rand_state = ctx
            .rand_state
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        let byte = (*ctx.rand_state >> 33) as u8;
        ctx.mem.write_u8(buf.wrapping_add(i), byte)?;
    }
    ctx.regs.write_gpr(0, true, len);
    Ok(HostOutcome::Continue)
}

fn read_u32(ctx: &mut HostContext<'_>, addr: u64) -> Result<u32, EmuError> {
    ctx.mem.read_u32(addr)
}

fn write_u32(ctx: &mut HostContext<'_>, addr: u64, value: u32) -> Result<(), EmuError> {
    ctx.mem.write_u32(addr, value)
}

/// write(fd, buf, count) -> bytes written.
/// fd == 1 goes to stdout; fd == 2 goes to stderr. Other fds require the
/// VFS (phase B.7).
pub fn sys_write(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let fd = ctx.regs.read_gpr(0, true);
    let buf = ctx.regs.read_gpr(1, true);
    let count = ctx.regs.read_gpr(2, true);
    // `count` is guest-controlled (x2); never pre-reserve from it. The loop
    // grows `bytes` only as far as mapped memory allows and faults calmly past
    // it, so a huge count cannot trigger a host allocation abort.
    let mut bytes: Vec<u8> = Vec::new();
    for i in 0..count {
        bytes.push(ctx.mem.read_u8(buf.wrapping_add(i))?);
    }
    let n = write_to_fd(ctx, fd, &bytes);
    ctx.regs.write_gpr(0, true, n as u64);
    Ok(HostOutcome::Continue)
}

/// The fd half of write(2), shared with fprintf: bytes to fd 1/2 land on
/// stdout/stderr; other fds write into the VFS at the current offset,
/// under the per-file and whole-VFS caps. Returns bytes written, or -1
/// where Linux answers EBADF or where a cap refuses the growth.
pub(crate) fn write_to_fd(ctx: &mut HostContext<'_>, fd: u64, bytes: &[u8]) -> i64 {
    match fd {
        1 => ctx.stdout.extend_from_slice(bytes),
        2 => ctx.stderr.extend_from_slice(bytes),
        _ => {
            // Unknown fd: Linux returns -1/EBADF and the program keeps
            // running, letting the student's own openat error check fire.
            // (The low-32-bit truncation matches the kernel, which reads
            // an int fd, so a stored -1 looks up as 4294967295 and misses.)
            let Some(file) = ctx.open_files.get_mut(&(fd as u32)) else {
                return -1;
            };
            if !file.writable {
                return -1;
            }
            let path = file.path.clone();
            let offset = file.offset as usize;
            // Reject a write that would grow the file past the cap rather than
            // resizing the backing Vec to a guest-chosen (possibly huge) size.
            if offset.saturating_add(bytes.len()) > MAX_VFS_FILE_BYTES {
                return -1;
            }
            // The whole-VFS bound: growth in this file counts against the
            // total, so several files cannot multiply the per-file cap.
            let current_len = ctx.vfs.get(&path).map_or(0, Vec::len);
            let growth = offset.saturating_add(bytes.len()).saturating_sub(current_len);
            let total: usize = ctx.vfs.values().map(Vec::len).sum();
            if total.saturating_add(growth) > MAX_VFS_TOTAL_BYTES {
                return -1;
            }
            let data = ctx
                .vfs
                .entry(path)
                .or_default();
            if offset + bytes.len() > data.len() {
                data.resize(offset + bytes.len(), 0);
            }
            data[offset..offset + bytes.len()].copy_from_slice(bytes);
            let file = ctx
                .open_files
                .get_mut(&(fd as u32))
                .expect("fd existed moments ago");
            file.offset += bytes.len() as u64;
        }
    }
    bytes.len() as i64
}

/// read(fd, buf, count) -> bytes read.
/// fd == 0 pulls from stdin; blocks (NeedInput) when stdin is empty.
/// Other fds read from the VFS at the current offset.
pub fn sys_read(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let fd = ctx.regs.read_gpr(0, true);
    let buf = ctx.regs.read_gpr(1, true);
    let count = ctx.regs.read_gpr(2, true);
    if fd == 0 {
        if ctx.stdin.is_empty() {
            // Closed stdin: read() reports EOF with a 0 return.
            if ctx.stdin_closed {
                ctx.regs.write_gpr(0, true, 0);
                return Ok(HostOutcome::Continue);
            }
            // O_NONBLOCK polling: report -EAGAIN instead of pausing,
            // so a game loop can poll the keyboard between frames.
            if ctx.term.stdin_nonblock {
                ctx.regs.write_gpr(0, true, EAGAIN as u64);
                return Ok(HostOutcome::Continue);
            }
            return Ok(HostOutcome::NeedInput);
        }
        let n = (count as usize).min(ctx.stdin.len());
        for i in 0..n {
            ctx.mem.write_u8(buf.wrapping_add(i as u64), ctx.stdin[i])?;
        }
        ctx.stdin.drain(..n);
        ctx.regs.write_gpr(0, true, n as u64);
        return Ok(HostOutcome::Continue);
    }
    // VFS-backed fd. Unknown means -1/EBADF, same as write: the program
    // keeps running and the student's own error check can fire.
    let Some(file) = ctx.open_files.get_mut(&(fd as u32)) else {
        ctx.regs.write_gpr(0, true, (-1i64) as u64);
        return Ok(HostOutcome::Continue);
    };
    let path = file.path.clone();
    let offset = file.offset as usize;
    let data = ctx.vfs.get(&path).cloned().unwrap_or_default();
    let available = data.len().saturating_sub(offset);
    let n = (count as usize).min(available);
    for i in 0..n {
        ctx.mem.write_u8(buf.wrapping_add(i as u64), data[offset + i])?;
    }
    file.offset += n as u64;
    ctx.regs.write_gpr(0, true, n as u64);
    Ok(HostOutcome::Continue)
}

/// exit(status). Set exit code and halt the CPU.
pub fn sys_exit(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let code = crate::hosted::exit_status(ctx.regs);
    Ok(HostOutcome::Exited(code))
}

/// openat(dirfd, pathname, flags, mode) -> fd or -1.
/// `dirfd` is ignored (AT_FDCWD or any value; VFS paths are absolute-ish
/// keys). `flags` picks writable vs read-only and whether to create or
/// truncate the file in the VFS. `mode` is ignored because the VFS
/// doesn't model permissions.
pub fn sys_openat(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    // x0 = dirfd (ignored), x1 = pathname, x2 = flags, x3 = mode.
    let path_ptr = ctx.regs.read_gpr(1, true);
    let flags = ctx.regs.read_gpr(2, true) as u32;
    let bytes = read_c_string(ctx.mem, path_ptr, "the openat path")?;
    let path = String::from_utf8_lossy(&bytes).into_owned();

    let writable = (flags & O_WRONLY) != 0 || (flags & O_RDWR) != 0;
    let create = (flags & O_CREAT) != 0;
    let truncate = (flags & O_TRUNC) != 0;

    match open_vfs(ctx, &path, writable, create, truncate, false) {
        Some(fd) => ctx.regs.write_gpr(0, true, fd as u64),
        None => ctx.regs.write_gpr(0, true, (-1i64) as u64),
    }
    Ok(HostOutcome::Continue)
}

/// The wall-checked open half of openat, shared with fopen: every cap
/// (open descriptors, VFS file count, missing-without-create) refuses
/// with None before anything is created, so an open loop cannot grow
/// the fd table or the VFS. `append` starts the offset at the current
/// end of file instead of 0.
pub(crate) fn open_vfs(
    ctx: &mut HostContext<'_>,
    path: &str,
    writable: bool,
    create: bool,
    truncate: bool,
    append: bool,
) -> Option<u32> {
    if path.is_empty() {
        // Linux returns -1/ENOENT for an empty path. The usual cause here
        // is a filename buffer that was reserved (.skip) but never filled.
        return None;
    }

    // Descriptor wall: refuse before creating anything, so an open loop
    // that never closes cannot grow the fd table (or the VFS behind it).
    if ctx.open_files.len() >= MAX_OPEN_FILES {
        return None;
    }

    if !ctx.vfs.contains_key(path) {
        if !create {
            return None;
        }
        // File-count wall: a create loop could otherwise insert entries
        // without bound, each eligible for its own per-file growth.
        if ctx.vfs.len() >= MAX_VFS_FILES {
            return None;
        }
        ctx.vfs.insert(path.to_string(), Vec::new());
    } else if truncate {
        if let Some(data) = ctx.vfs.get_mut(path) {
            data.clear();
        }
    }

    let offset = if append {
        ctx.vfs.get(path).map_or(0, |d| d.len() as u64)
    } else {
        0
    };
    let fd = *ctx.next_fd;
    *ctx.next_fd += 1;
    ctx.open_files.insert(
        fd,
        OpenFile {
            path: path.to_string(),
            offset,
            writable,
        },
    );
    Some(fd)
}

/// close(fd) -> 0 on success, -1 on unknown fd.
pub fn sys_close(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let fd = ctx.regs.read_gpr(0, true) as u32;
    if ctx.open_files.remove(&fd).is_some() {
        ctx.regs.write_gpr(0, true, 0);
    } else {
        ctx.regs.write_gpr(0, true, (-1i64) as u64);
    }
    Ok(HostOutcome::Continue)
}

/// lseek(fd, offset, whence) -> new offset or -1. `whence` is 0 (SEEK_SET),
/// 1 (SEEK_CUR), or 2 (SEEK_END).
pub fn sys_lseek(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let fd = ctx.regs.read_gpr(0, true) as u32;
    let offset = ctx.regs.read_gpr(1, true) as i64;
    let whence = ctx.regs.read_gpr(2, true) as u32;
    let Some(file) = ctx.open_files.get_mut(&fd) else {
        ctx.regs.write_gpr(0, true, (-1i64) as u64);
        return Ok(HostOutcome::Continue);
    };
    let size = ctx
        .vfs
        .get(&file.path)
        .map(|d| d.len() as i64)
        .unwrap_or(0);
    let new_offset = match whence {
        0 => offset,
        1 => file.offset as i64 + offset,
        2 => size + offset,
        _ => {
            ctx.regs.write_gpr(0, true, (-1i64) as u64);
            return Ok(HostOutcome::Continue);
        }
    };
    if new_offset < 0 || new_offset as u64 > MAX_VFS_FILE_BYTES as u64 {
        ctx.regs.write_gpr(0, true, (-1i64) as u64);
        return Ok(HostOutcome::Continue);
    }
    file.offset = new_offset as u64;
    ctx.regs.write_gpr(0, true, new_offset as u64);
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
        rand_state: u64,
        term: crate::cpu::TermState,
        heap: crate::hosted::heap::HeapState,
    }

    impl Host {
        fn new() -> Self {
            let mut mem = Memory::new();
            mem.map_page(0x0060_0000);
            Host {
                regs: RegisterFile::new(),
                mem,
                stdout: Vec::new(),
                stderr: Vec::new(),
                stdin: Vec::new(),
                vfs: HashMap::new(),
                open_files: HashMap::new(),
                next_fd: 3,
                rand_state: 1,
                term: crate::cpu::TermState::default(),
                heap: crate::hosted::heap::HeapState::default(),
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
            }
        }
    }

    #[test]
    fn write_fd_one_goes_to_stdout() {
        let mut h = Host::new();
        for (i, b) in b"hello".iter().enumerate() {
            h.mem.write_u8(0x0060_0000 + i as u64, *b).unwrap();
        }
        h.regs.write_gpr(0, true, 1);
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 5);
        dispatch(SYS_WRITE, &mut h.ctx()).unwrap();
        assert_eq!(h.stdout, b"hello");
        assert_eq!(h.regs.read_gpr(0, true), 5);
    }

    #[test]
    fn write_fd_two_goes_to_stderr() {
        let mut h = Host::new();
        for (i, b) in b"err".iter().enumerate() {
            h.mem.write_u8(0x0060_0000 + i as u64, *b).unwrap();
        }
        h.regs.write_gpr(0, true, 2);
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 3);
        dispatch(SYS_WRITE, &mut h.ctx()).unwrap();
        assert_eq!(h.stderr, b"err");
    }

    #[test]
    fn read_fd_zero_drains_stdin() {
        let mut h = Host::new();
        h.stdin.extend_from_slice(b"hi\n");
        h.regs.write_gpr(0, true, 0);
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 10);
        dispatch(SYS_READ, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 3);
        let mut got = Vec::new();
        for i in 0..3 {
            got.push(h.mem.read_u8(0x0060_0000 + i).unwrap());
        }
        assert_eq!(got, b"hi\n");
        assert!(h.stdin.is_empty());
    }

    #[test]
    fn read_empty_stdin_returns_need_input() {
        let mut h = Host::new();
        h.regs.write_gpr(0, true, 0);
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 10);
        assert_eq!(
            dispatch(SYS_READ, &mut h.ctx()).unwrap(),
            HostOutcome::NeedInput
        );
    }

    #[test]
    fn exit_returns_outcome_with_code() {
        let mut h = Host::new();
        h.regs.write_gpr(0, true, 42);
        assert_eq!(
            dispatch(SYS_EXIT, &mut h.ctx()).unwrap(),
            HostOutcome::Exited(42)
        );
    }

    #[test]
    fn unsupported_syscall_errors() {
        let mut h = Host::new();
        assert!(dispatch(999, &mut h.ctx()).is_err());
    }

    // -- VFS syscalls --

    fn place_path(h: &mut Host, addr: u64, path: &str) {
        for (i, b) in path.as_bytes().iter().enumerate() {
            h.mem.write_u8(addr + i as u64, *b).unwrap();
        }
        h.mem.write_u8(addr + path.len() as u64, 0).unwrap();
    }

    #[test]
    fn sys_exit_reads_a_signed_int() {
        // The raw-syscall path (mov w0, #-1; mov x8, #93; svc 0) must
        // report the same -1 the libc exit path does.
        let mut h = Host::new();
        h.regs.write_gpr(0, false, 0xFFFF_FFFF);
        let out = dispatch(SYS_EXIT, &mut h.ctx()).unwrap();
        assert_eq!(out, HostOutcome::Exited(-1));
    }

    #[test]
    fn openat_empty_path_returns_minus_one_and_creates_nothing() {
        // Linux answers "" with ENOENT; accepting it minted a phantom ""
        // file every write then landed in. The usual cause is a filename
        // buffer that was reserved but never filled.
        let mut h = Host::new();
        place_path(&mut h, 0x0060_0000, "");
        h.regs.write_gpr(0, true, (-100i64) as u64);
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, (O_WRONLY | O_CREAT) as u64);
        dispatch(SYS_OPENAT, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, -1);
        assert!(h.vfs.is_empty());
        assert!(h.open_files.is_empty());
    }

    #[test]
    fn openat_existing_file_returns_fd() {
        let mut h = Host::new();
        h.vfs.insert("hello.txt".into(), b"data".to_vec());
        place_path(&mut h, 0x0060_0000, "hello.txt");
        h.regs.write_gpr(0, true, (-100i64) as u64); // AT_FDCWD
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 0); // O_RDONLY
        dispatch(SYS_OPENAT, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 3);
    }

    #[test]
    fn openat_missing_file_without_o_creat_returns_minus_one() {
        let mut h = Host::new();
        place_path(&mut h, 0x0060_0000, "does_not_exist.txt");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 0);
        dispatch(SYS_OPENAT, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, -1);
    }

    #[test]
    fn openat_with_o_creat_creates_empty_file() {
        let mut h = Host::new();
        place_path(&mut h, 0x0060_0000, "new.txt");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, (O_WRONLY | O_CREAT) as u64);
        dispatch(SYS_OPENAT, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 3);
        assert_eq!(h.vfs.get("new.txt").map(|v| v.as_slice()), Some(b"".as_slice()));
    }

    #[test]
    fn openat_with_o_trunc_clears_existing_contents() {
        let mut h = Host::new();
        h.vfs.insert("log.txt".into(), b"old".to_vec());
        place_path(&mut h, 0x0060_0000, "log.txt");
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, (O_WRONLY | O_TRUNC) as u64);
        dispatch(SYS_OPENAT, &mut h.ctx()).unwrap();
        assert!(h.vfs.get("log.txt").unwrap().is_empty());
    }

    #[test]
    fn close_removes_fd() {
        let mut h = Host::new();
        h.open_files.insert(
            3,
            crate::cpu::OpenFile { path: "x".into(), offset: 0, writable: false },
        );
        h.regs.write_gpr(0, true, 3);
        dispatch(SYS_CLOSE, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 0);
        assert!(!h.open_files.contains_key(&3));
    }

    #[test]
    fn close_unknown_fd_returns_minus_one() {
        let mut h = Host::new();
        h.regs.write_gpr(0, true, 42);
        dispatch(SYS_CLOSE, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, -1);
    }

    #[test]
    fn lseek_set_moves_offset_to_absolute_value() {
        let mut h = Host::new();
        h.vfs.insert("file".into(), b"abcdefgh".to_vec());
        h.open_files.insert(
            3,
            crate::cpu::OpenFile { path: "file".into(), offset: 0, writable: false },
        );
        h.regs.write_gpr(0, true, 3);
        h.regs.write_gpr(1, true, 4);
        h.regs.write_gpr(2, true, 0); // SEEK_SET
        dispatch(SYS_LSEEK, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 4);
        assert_eq!(h.open_files[&3].offset, 4);
    }

    #[test]
    fn lseek_end_lands_at_file_size() {
        let mut h = Host::new();
        h.vfs.insert("file".into(), b"abcdefgh".to_vec());
        h.open_files.insert(
            3,
            crate::cpu::OpenFile { path: "file".into(), offset: 0, writable: false },
        );
        h.regs.write_gpr(0, true, 3);
        h.regs.write_gpr(1, true, 0);
        h.regs.write_gpr(2, true, 2); // SEEK_END
        dispatch(SYS_LSEEK, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 8);
    }

    #[test]
    fn read_from_vfs_fd_advances_offset() {
        let mut h = Host::new();
        h.vfs.insert("file".into(), b"ABCDE".to_vec());
        h.open_files.insert(
            3,
            crate::cpu::OpenFile { path: "file".into(), offset: 0, writable: false },
        );
        h.regs.write_gpr(0, true, 3);
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 3);
        dispatch(SYS_READ, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 3);
        assert_eq!(h.mem.read_u8(0x0060_0000).unwrap(), b'A');
        assert_eq!(h.mem.read_u8(0x0060_0001).unwrap(), b'B');
        assert_eq!(h.mem.read_u8(0x0060_0002).unwrap(), b'C');
        assert_eq!(h.open_files[&3].offset, 3);
    }

    #[test]
    fn write_to_vfs_fd_grows_file() {
        let mut h = Host::new();
        h.vfs.insert("out.txt".into(), Vec::new());
        h.open_files.insert(
            3,
            crate::cpu::OpenFile { path: "out.txt".into(), offset: 0, writable: true },
        );
        for (i, b) in b"Hi!".iter().enumerate() {
            h.mem.write_u8(0x0060_0000 + i as u64, *b).unwrap();
        }
        h.regs.write_gpr(0, true, 3);
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 3);
        dispatch(SYS_WRITE, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 3);
        assert_eq!(h.vfs["out.txt"], b"Hi!");
    }

    #[test]
    fn write_with_huge_count_faults_calmly() {
        // A guest-controlled count must not pre-reserve host memory; reading
        // past mapped memory returns an error, never a host allocation abort.
        let mut h = Host::new();
        h.regs.write_gpr(0, true, 1); // stdout
        h.regs.write_gpr(1, true, 0x0060_0000); // one mapped page
        h.regs.write_gpr(2, true, u32::MAX as u64); // huge count
        assert!(dispatch(SYS_WRITE, &mut h.ctx()).is_err());
    }

    #[test]
    fn lseek_past_the_file_cap_returns_minus_one() {
        let mut h = Host::new();
        h.vfs.insert("f".into(), Vec::new());
        h.open_files.insert(
            3,
            crate::cpu::OpenFile { path: "f".into(), offset: 0, writable: true },
        );
        h.regs.write_gpr(0, true, 3);
        h.regs.write_gpr(1, true, MAX_VFS_FILE_BYTES as u64 + 1);
        h.regs.write_gpr(2, true, 0); // SEEK_SET
        dispatch(SYS_LSEEK, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, -1);
    }

    #[test]
    fn write_past_the_file_cap_fails_without_a_huge_resize() {
        let mut h = Host::new();
        h.vfs.insert("f".into(), Vec::new());
        h.open_files.insert(
            3,
            crate::cpu::OpenFile {
                path: "f".into(),
                offset: MAX_VFS_FILE_BYTES as u64,
                writable: true,
            },
        );
        h.mem.write_u8(0x0060_0000, b'x').unwrap();
        h.regs.write_gpr(0, true, 3);
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 1);
        dispatch(SYS_WRITE, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, -1);
        assert!(h.vfs["f"].len() <= MAX_VFS_FILE_BYTES);
    }

    #[test]
    fn unknown_fd_write_and_read_return_minus_one() {
        // Storing openat's -1 and calling write is the universal beginner
        // slip; Linux answers EBADF, never terminates the program.
        let mut h = Host::new();
        h.mem.write_u8(0x0060_0000, b'x').unwrap();
        h.regs.write_gpr(0, true, 0xFFFF_FFFF); // w-register -1
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 1);
        dispatch(SYS_WRITE, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, -1);
        h.regs.write_gpr(0, true, 0xFFFF_FFFF);
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 1);
        dispatch(SYS_READ, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, -1);
    }

    #[test]
    fn write_past_the_total_vfs_cap_fails_even_across_files() {
        // The per-file cap alone let N files multiply the snapshot-ring
        // amplification N times over; the total must hold regardless of
        // how the bytes are spread.
        let mut h = Host::new();
        h.vfs.insert("a".into(), vec![0u8; MAX_VFS_TOTAL_BYTES - 1]);
        h.vfs.insert("b".into(), Vec::new());
        h.open_files.insert(
            3,
            crate::cpu::OpenFile { path: "b".into(), offset: 0, writable: true },
        );
        h.mem.write_u8(0x0060_0000, b'x').unwrap();
        h.mem.write_u8(0x0060_0001, b'y').unwrap();
        h.regs.write_gpr(0, true, 3);
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 2);
        dispatch(SYS_WRITE, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, -1);
        assert!(h.vfs["b"].is_empty());
    }

    #[test]
    fn rewriting_existing_bytes_at_the_total_cap_still_succeeds() {
        // Overwrites grow nothing, so a full VFS must still accept them.
        let mut h = Host::new();
        h.vfs.insert("a".into(), vec![0u8; MAX_VFS_TOTAL_BYTES]);
        h.open_files.insert(
            3,
            crate::cpu::OpenFile { path: "a".into(), offset: 0, writable: true },
        );
        h.mem.write_u8(0x0060_0000, b'x').unwrap();
        h.regs.write_gpr(0, true, 3);
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 1);
        dispatch(SYS_WRITE, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 1);
        assert_eq!(h.vfs["a"][0], b'x');
    }

    #[test]
    fn openat_refuses_to_create_past_the_file_count_cap() {
        let mut h = Host::new();
        for i in 0..MAX_VFS_FILES {
            h.vfs.insert(format!("f{i}"), Vec::new());
        }
        place_path(&mut h, 0x0060_0000, "one_more.txt");
        h.regs.write_gpr(0, true, (-100i64) as u64);
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, (0o1 | 0o100) as u64); // O_WRONLY|O_CREAT
        dispatch(SYS_OPENAT, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true) as i64, -1);
        assert_eq!(h.vfs.len(), MAX_VFS_FILES);
        // An EXISTING file still opens at the cap.
        place_path(&mut h, 0x0060_0000, "f0");
        h.regs.write_gpr(0, true, (-100i64) as u64);
        h.regs.write_gpr(1, true, 0x0060_0000);
        h.regs.write_gpr(2, true, 0);
        dispatch(SYS_OPENAT, &mut h.ctx()).unwrap();
        assert_eq!(h.regs.read_gpr(0, true), 3);
    }
}
