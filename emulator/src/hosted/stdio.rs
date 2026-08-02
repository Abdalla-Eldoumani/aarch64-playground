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

/// Base of the synthetic FILE* handle range: one page above the host
/// stub table's end (`HOST_STUB_BASE` 0xFFFF_0000 + 256 * 16 =
/// 0xFFFF_1000), 16-byte stride to mirror the stub spacing.
pub const FILE_HANDLE_BASE: u64 = 0xFFFF_2000;
const FILE_HANDLE_STRIDE: u64 = 16;

fn handle_of(fd: u32) -> u64 {
    FILE_HANDLE_BASE + fd as u64 * FILE_HANDLE_STRIDE
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
    if rel % FILE_HANDLE_STRIDE != 0 {
        return None;
    }
    let fd = u32::try_from(rel / FILE_HANDLE_STRIDE).ok()?;
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
            ctx.open_files.remove(&fd);
            ctx.regs.write_gpr(0, true, 0);
        }
        None => ctx.regs.write_gpr(0, true, (-1i64) as u64),
    }
    Ok(HostOutcome::Continue)
}
