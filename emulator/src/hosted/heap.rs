//! malloc/free over a fixed heap window. The allocator is host-side
//! state (no headers in guest memory), so a stray store cannot corrupt
//! it; blocks are 16-byte aligned and the free list coalesces neighbors
//! so a node-churning program does not fragment its way to exhaustion.

use crate::errors::EmuError;
use crate::hosted::{HostContext, HostOutcome};

/// The heap window sits above the argv page and far below the stack.
pub const HEAP_BASE: u64 = 0x0090_0000;
/// One 16 MiB window: big enough for anything a course program allocates
/// (a 1 MiB malloc succeeds the way it does on the servers), and bounded
/// so a runaway allocator hits NULL returns, not the page cap. Pages back
/// lazily, so an untouched allocation costs address space only.
pub const HEAP_LIMIT: u64 = HEAP_BASE + 16 * 1024 * 1024;

const ALIGN: u64 = 16;

/// Allocator state. Lives on the `Cpu` and in every snapshot, like
/// `rand_state`, so step-back and named saves restore the heap exactly.
#[derive(Debug, Clone, PartialEq)]
pub struct HeapState {
    /// Bump frontier: the lowest never-allocated address.
    next: u64,
    /// Freed blocks as (address, size), address-ordered and coalesced.
    free: Vec<(u64, u64)>,
    /// Live allocations by address, so free() can validate its argument.
    live: std::collections::HashMap<u64, u64>,
}

impl Default for HeapState {
    fn default() -> Self {
        HeapState {
            next: HEAP_BASE,
            free: Vec::new(),
            live: std::collections::HashMap::new(),
        }
    }
}

impl HeapState {
    /// Allocate `size` bytes (rounded up to the alignment quantum).
    /// Returns the block address, or None when the window is exhausted.
    pub fn alloc(&mut self, size: u64) -> Option<u64> {
        let size = size.max(1).checked_add(ALIGN - 1)? & !(ALIGN - 1);
        // First fit from the free list; split the remainder back.
        for i in 0..self.free.len() {
            let (addr, block) = self.free[i];
            if block >= size {
                if block == size {
                    self.free.remove(i);
                } else {
                    self.free[i] = (addr + size, block - size);
                }
                self.live.insert(addr, size);
                return Some(addr);
            }
        }
        if self.next.checked_add(size)? > HEAP_LIMIT {
            return None;
        }
        let addr = self.next;
        self.next += size;
        self.live.insert(addr, size);
        Some(addr)
    }

    /// Size of the live block at `addr`, or None when the address is not
    /// one malloc handed out. realloc needs it to know how much of the
    /// old block to carry over.
    pub fn block_size(&self, addr: u64) -> Option<u64> {
        self.live.get(&addr).copied()
    }

    /// Why an address is not a block free/realloc may take, in the words
    /// the halt shows the student.
    pub fn reject_reason(&self, addr: u64) -> &'static str {
        if self.free.iter().any(|&(a, _)| a == addr) {
            "already freed (double free)"
        } else {
            "not an address malloc returned"
        }
    }

    /// Release a live block. Err carries the reason (bad pointer or
    /// double free) for the caller's diagnostic.
    pub fn release(&mut self, addr: u64) -> Result<(), &'static str> {
        let Some(size) = self.live.remove(&addr) else {
            return Err(self.reject_reason(addr));
        };
        let at = self.free.partition_point(|&(a, _)| a < addr);
        self.free.insert(at, (addr, size));
        // Coalesce with the right neighbor, then the left.
        if at + 1 < self.free.len() && self.free[at].0 + self.free[at].1 == self.free[at + 1].0 {
            self.free[at].1 += self.free[at + 1].1;
            self.free.remove(at + 1);
        }
        if at > 0 && self.free[at - 1].0 + self.free[at - 1].1 == self.free[at].0 {
            self.free[at - 1].1 += self.free[at].1;
            self.free.remove(at);
        }
        Ok(())
    }
}

/// malloc(x0 = size) -> x0 = block address, or NULL when the window is
/// exhausted or the request is larger than the window.
pub fn malloc(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let size = ctx.regs.read_gpr(0, true);
    let addr = ctx.heap.alloc(size).unwrap_or(0);
    ctx.regs.write_gpr(0, true, addr);
    Ok(HostOutcome::Continue)
}

/// calloc(x0 = nmemb, x1 = size) -> a ZEROED block, or NULL. The product
/// is checked rather than wrapped: glibc answers NULL for a request that
/// overflows, and a wrapped small allocation would hand the program a
/// buffer far shorter than it asked for.
pub fn calloc(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let nmemb = ctx.regs.read_gpr(0, true);
    let size = ctx.regs.read_gpr(1, true);
    let addr = match nmemb.checked_mul(size).and_then(|total| {
        ctx.heap.alloc(total).map(|addr| (addr, total))
    }) {
        Some((addr, total)) => {
            for i in 0..total {
                ctx.mem.write_u8(addr.wrapping_add(i), 0)?;
            }
            addr
        }
        None => 0,
    };
    ctx.regs.write_gpr(0, true, addr);
    Ok(HostOutcome::Continue)
}

/// realloc(x0 = ptr, x1 = size) -> the resized block, or NULL.
/// The three glibc special cases hold: a NULL pointer is a plain malloc,
/// a zero size frees and answers NULL, and a failed growth leaves the
/// original block alive. A request that fits the block already held is
/// answered in place, the way glibc splits a chunk rather than moving it.
pub fn realloc(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let ptr = ctx.regs.read_gpr(0, true);
    let size = ctx.regs.read_gpr(1, true);
    if ptr == 0 {
        let addr = ctx.heap.alloc(size).unwrap_or(0);
        ctx.regs.write_gpr(0, true, addr);
        return Ok(HostOutcome::Continue);
    }
    if size == 0 {
        release_or_halt(ctx, ptr, "realloc")?;
        ctx.regs.write_gpr(0, true, 0);
        return Ok(HostOutcome::Continue);
    }
    let Some(old_size) = ctx.heap.block_size(ptr) else {
        return Err(wild_pointer(ptr, ctx.heap.reject_reason(ptr), "realloc"));
    };
    if size <= old_size {
        ctx.regs.write_gpr(0, true, ptr);
        return Ok(HostOutcome::Continue);
    }
    let Some(new_addr) = ctx.heap.alloc(size) else {
        // Out of window: C keeps the original block, so the program can
        // still free what it had.
        ctx.regs.write_gpr(0, true, 0);
        return Ok(HostOutcome::Continue);
    };
    for i in 0..old_size {
        let b = ctx.mem.read_u8(ptr.wrapping_add(i))?;
        ctx.mem.write_u8(new_addr.wrapping_add(i), b)?;
    }
    release_or_halt(ctx, ptr, "realloc")?;
    ctx.regs.write_gpr(0, true, new_addr);
    Ok(HostOutcome::Continue)
}

/// free(x0 = address). free(NULL) is a no-op per C; anything that is not
/// a live malloc block halts with a plain-language diagnosis.
pub fn free(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let addr = ctx.regs.read_gpr(0, true);
    if addr == 0 {
        return Ok(HostOutcome::Continue);
    }
    release_or_halt(ctx, addr, "free")?;
    Ok(HostOutcome::Continue)
}

/// The halt for a pointer free/realloc cannot take: which call saw it,
/// what is wrong with it, and the rule that would have avoided it.
fn wild_pointer(addr: u64, why: &str, call: &str) -> EmuError {
    EmuError::RuntimeError {
        message: format!(
            "{call}(0x{addr:x}): {why}. {call} takes exactly the pointer a \
             malloc returned, once"
        ),
    }
}

/// Give a block back, turning the allocator's refusal into `wild_pointer`.
fn release_or_halt(ctx: &mut HostContext<'_>, addr: u64, call: &str) -> Result<(), EmuError> {
    ctx.heap
        .release(addr)
        .map_err(|why| wild_pointer(addr, why, call))
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
        heap: HeapState,
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
                heap: HeapState::default(),
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
        /// Call a stub with x0/x1 set and hand back x0.
        fn call2(&mut self, f: crate::hosted::HostFn, a: u64, b: u64) -> u64 {
            self.regs.write_gpr(0, true, a);
            self.regs.write_gpr(1, true, b);
            f(&mut self.ctx()).unwrap();
            self.regs.read_gpr(0, true)
        }
    }

    #[test]
    fn calloc_zeroes_the_block_and_refuses_an_overflowing_product() {
        let mut h = Host::new();
        // Dirty the window first so the zeroing is visibly the stub's.
        for i in 0..32u64 {
            h.mem.write_u8(HEAP_BASE + i, 0xEE).unwrap();
        }
        let addr = h.call2(calloc, 4, 8);
        assert_eq!(addr, HEAP_BASE);
        for i in 0..32u64 {
            assert_eq!(h.mem.read_u8(addr + i).unwrap(), 0, "byte {i} not cleared");
        }
        // nmemb * size overflowing a u64 is NULL, never a wrapped tiny
        // block the program would then run off the end of.
        assert_eq!(h.call2(calloc, u64::MAX, 2), 0);
        // So is a request the window cannot hold.
        assert_eq!(h.call2(calloc, HEAP_LIMIT - HEAP_BASE, 2), 0);
    }

    #[test]
    fn realloc_handles_the_null_and_zero_cases_like_glibc() {
        let mut h = Host::new();
        // NULL pointer: a plain malloc.
        let first = h.call2(realloc, 0, 32);
        assert_eq!(first, HEAP_BASE);
        // Zero size: frees and answers NULL, and the block comes back.
        assert_eq!(h.call2(realloc, first, 0), 0);
        assert_eq!(h.call2(realloc, 0, 32), first);
    }

    #[test]
    fn realloc_grows_by_moving_and_carries_the_old_bytes_over() {
        let mut h = Host::new();
        let block = h.call2(realloc, 0, 16);
        let pinned = h.call2(realloc, 0, 16); // keeps `block` from growing in place
        for i in 0..16u64 {
            h.mem.write_u8(block + i, (i + 1) as u8).unwrap();
        }
        let grown = h.call2(realloc, block, 64);
        assert_ne!(grown, block, "the block had a live neighbour above it");
        assert_ne!(grown, 0);
        for i in 0..16u64 {
            assert_eq!(h.mem.read_u8(grown + i).unwrap(), (i + 1) as u8);
        }
        // The old block was released, so an exact-size request reuses it.
        assert_eq!(h.call2(realloc, 0, 16), block);
        assert_eq!(pinned, HEAP_BASE + 16);
    }

    #[test]
    fn realloc_down_to_a_smaller_size_keeps_the_pointer() {
        // glibc splits the chunk rather than moving it, and a program
        // that kept the old pointer is common enough that moving here
        // would report a bug the servers never show.
        let mut h = Host::new();
        let block = h.call2(realloc, 0, 64);
        assert_eq!(h.call2(realloc, block, 16), block);
    }

    #[test]
    fn realloc_of_a_wild_pointer_names_realloc() {
        let mut h = Host::new();
        h.regs.write_gpr(0, true, 0xDEAD_0000);
        h.regs.write_gpr(1, true, 16);
        let err = realloc(&mut h.ctx()).unwrap_err().to_string();
        assert!(err.contains("realloc(0xdead0000)"), "message: {err}");
        assert!(err.contains("not an address malloc returned"), "message: {err}");
    }

    #[test]
    fn alloc_bumps_and_aligns() {
        let mut h = HeapState::default();
        let a = h.alloc(1).unwrap();
        let b = h.alloc(24).unwrap();
        assert_eq!(a, HEAP_BASE);
        assert_eq!(b, HEAP_BASE + 16);
        assert_eq!(h.alloc(40).unwrap(), HEAP_BASE + 16 + 32);
    }

    #[test]
    fn freed_blocks_are_reused() {
        let mut h = HeapState::default();
        let a = h.alloc(32).unwrap();
        let _b = h.alloc(32).unwrap();
        h.release(a).unwrap();
        assert_eq!(h.alloc(32).unwrap(), a);
    }

    #[test]
    fn neighbors_coalesce_into_one_block() {
        let mut h = HeapState::default();
        let a = h.alloc(16).unwrap();
        let b = h.alloc(16).unwrap();
        let c = h.alloc(16).unwrap();
        h.release(a).unwrap();
        h.release(c).unwrap();
        h.release(b).unwrap();
        // All three merged: a fresh 48-byte request fits at the start.
        assert_eq!(h.alloc(48).unwrap(), a);
    }

    #[test]
    fn double_free_and_wild_free_are_diagnosed() {
        let mut h = HeapState::default();
        let a = h.alloc(16).unwrap();
        h.release(a).unwrap();
        assert!(h.release(a).unwrap_err().contains("double free"));
        assert!(h.release(0xDEAD_0000).unwrap_err().contains("not an address"));
    }

    #[test]
    fn window_exhaustion_returns_none_not_panic() {
        let mut h = HeapState::default();
        assert!(h.alloc(HEAP_LIMIT - HEAP_BASE).is_some());
        assert!(h.alloc(16).is_none());
        assert!(h.alloc(u64::MAX).is_none());
    }

    #[test]
    fn a_one_mib_allocation_fits_the_window() {
        // The server-parity case: `malloc(1 << 20)` succeeds on the course
        // servers, so it succeeds here.
        let mut h = HeapState::default();
        assert!(h.alloc(1 << 20).is_some());
    }

    #[test]
    fn malloc_zero_returns_a_distinct_non_null_block() {
        // glibc's malloc(0) answers a real, freeable pointer; so does ours.
        let mut h = HeapState::default();
        let a = h.alloc(0).expect("malloc(0) is non-NULL");
        let b = h.alloc(0).expect("second malloc(0) is non-NULL");
        assert_ne!(a, b, "each zero-size block is distinct");
        assert_ne!(a, 0);
    }
}
