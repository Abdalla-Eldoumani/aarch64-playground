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

fn handle_of(fd: u32) -> u64 {
    FILE_HANDLE_BASE + fd as u64 * FILE_HANDLE_STRIDE
}

/// Write the `stdin`/`stdout`/`stderr` words. The loader calls this on
/// every hosted load, beside the argv page, and `Cpu::new`/`Cpu::reset`
/// call it too so the fixed layout is there before any program is.
pub fn write_stdio_globals(mem: &mut Memory) -> Result<(), EmuError> {
    mem.map_page(STDIO_GLOBALS_BASE);
    for fd in 0..3u32 {
        mem.write_u64(STDIO_GLOBALS_BASE + fd as u64 * 8, handle_of(fd))?;
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
        return Err(EmuError::RuntimeError {
            message: format!(
                "fprintf was given 0x{handle:x}, which is not a stream fopen \
                 returned -- check the fopen return value for NULL (x0 == 0) \
                 before writing, and keep the FILE* in a callee-saved register"
            ),
        });
    };
    let fmt_ptr = ctx.regs.read_gpr(1, true);
    // x0 = stream and x1 = format are the fixed params; varargs start at x2.
    let out = format_into(ctx, fmt_ptr, 2, "fprintf's format string")?;
    let n = write_to_fd(ctx, fd as u64, &out);
    ctx.regs.write_gpr(0, true, n as u64);
    Ok(HostOutcome::Continue)
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
