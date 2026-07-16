//! Linux AArch64 syscall dispatcher for `svc #0`. The handler reads the
//! syscall number from `x8`, the arguments from `x0..x5`, and writes the
//! result back into `x0`.
//!
//! Phase B.6 covers the minimum the corpus needs for weeks 13 onward:
//! `write` (64), `read` (63), `exit` (93). The VFS-backed set (openat,
//! close, lseek) arrives in phase B.7.

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
        _ => Err(EmuError::RuntimeError {
            message: format!(
                "syscall {number} (x8) is not supported -- this emulator implements \
                 openat(56), close(57), lseek(62), read(63), write(64), and \
                 exit(93/94); use `mov x8, 93` then `svc 0` to exit"
            ),
        }),
    }
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
        bytes.push(ctx.mem.read_u8(buf + i)?);
    }
    match fd {
        1 => ctx.stdout.extend_from_slice(&bytes),
        2 => ctx.stderr.extend_from_slice(&bytes),
        _ => {
            // Unknown fd: Linux returns -1/EBADF and the program keeps
            // running, letting the student's own openat error check fire.
            // (The low-32-bit truncation matches the kernel, which reads
            // an int fd, so a stored -1 looks up as 4294967295 and misses.)
            let Some(file) = ctx.open_files.get_mut(&(fd as u32)) else {
                ctx.regs.write_gpr(0, true, (-1i64) as u64);
                return Ok(HostOutcome::Continue);
            };
            if !file.writable {
                ctx.regs.write_gpr(0, true, (-1i64) as u64);
                return Ok(HostOutcome::Continue);
            }
            let path = file.path.clone();
            let offset = file.offset as usize;
            // Reject a write that would grow the file past the cap rather than
            // resizing the backing Vec to a guest-chosen (possibly huge) size.
            if offset.saturating_add(bytes.len()) > MAX_VFS_FILE_BYTES {
                ctx.regs.write_gpr(0, true, (-1i64) as u64);
                return Ok(HostOutcome::Continue);
            }
            // The whole-VFS bound: growth in this file counts against the
            // total, so several files cannot multiply the per-file cap.
            let current_len = ctx.vfs.get(&path).map_or(0, Vec::len);
            let growth = offset.saturating_add(bytes.len()).saturating_sub(current_len);
            let total: usize = ctx.vfs.values().map(Vec::len).sum();
            if total.saturating_add(growth) > MAX_VFS_TOTAL_BYTES {
                ctx.regs.write_gpr(0, true, (-1i64) as u64);
                return Ok(HostOutcome::Continue);
            }
            let data = ctx
                .vfs
                .entry(path)
                .or_default();
            if offset + bytes.len() > data.len() {
                data.resize(offset + bytes.len(), 0);
            }
            data[offset..offset + bytes.len()].copy_from_slice(&bytes);
            let file = ctx
                .open_files
                .get_mut(&(fd as u32))
                .expect("fd existed moments ago");
            file.offset += bytes.len() as u64;
        }
    }
    ctx.regs.write_gpr(0, true, count);
    Ok(HostOutcome::Continue)
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
            return Ok(HostOutcome::NeedInput);
        }
        let n = (count as usize).min(ctx.stdin.len());
        for i in 0..n {
            ctx.mem.write_u8(buf + i as u64, ctx.stdin[i])?;
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
        ctx.mem.write_u8(buf + i as u64, data[offset + i])?;
    }
    file.offset += n as u64;
    ctx.regs.write_gpr(0, true, n as u64);
    Ok(HostOutcome::Continue)
}

/// exit(status). Set exit code and halt the CPU.
pub fn sys_exit(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let code = ctx.regs.read_gpr(0, true) as i64;
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
    let bytes = read_c_string(ctx.mem, path_ptr)?;
    let path = String::from_utf8_lossy(&bytes).into_owned();

    let writable = (flags & O_WRONLY) != 0 || (flags & O_RDWR) != 0;
    let create = (flags & O_CREAT) != 0;
    let truncate = (flags & O_TRUNC) != 0;

    if !ctx.vfs.contains_key(&path) {
        if !create {
            ctx.regs.write_gpr(0, true, (-1i64) as u64);
            return Ok(HostOutcome::Continue);
        }
        // File-count wall: a create loop could otherwise insert entries
        // without bound, each eligible for its own per-file growth.
        if ctx.vfs.len() >= MAX_VFS_FILES {
            ctx.regs.write_gpr(0, true, (-1i64) as u64);
            return Ok(HostOutcome::Continue);
        }
        ctx.vfs.insert(path.clone(), Vec::new());
    } else if truncate {
        if let Some(data) = ctx.vfs.get_mut(&path) {
            data.clear();
        }
    }

    let fd = *ctx.next_fd;
    *ctx.next_fd += 1;
    ctx.open_files.insert(
        fd,
        OpenFile {
            path,
            offset: 0,
            writable,
        },
    );
    ctx.regs.write_gpr(0, true, fd as u64);
    Ok(HostOutcome::Continue)
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
