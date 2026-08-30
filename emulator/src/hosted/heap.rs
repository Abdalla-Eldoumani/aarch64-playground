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

    /// Release a live block. Err carries the reason (bad pointer or
    /// double free) for the caller's diagnostic.
    pub fn release(&mut self, addr: u64) -> Result<(), &'static str> {
        let Some(size) = self.live.remove(&addr) else {
            return Err(if self.free.iter().any(|&(a, _)| a == addr) {
                "already freed (double free)"
            } else {
                "not an address malloc returned"
            });
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
/// exhausted or the request is absurd.
pub fn malloc(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let size = ctx.regs.read_gpr(0, true);
    let addr = ctx.heap.alloc(size).unwrap_or(0);
    ctx.regs.write_gpr(0, true, addr);
    Ok(HostOutcome::Continue)
}

/// free(x0 = address). free(NULL) is a no-op per C; anything that is not
/// a live malloc block halts with a plain-language diagnosis.
pub fn free(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    let addr = ctx.regs.read_gpr(0, true);
    if addr == 0 {
        return Ok(HostOutcome::Continue);
    }
    if let Err(why) = ctx.heap.release(addr) {
        return Err(EmuError::RuntimeError {
            message: format!(
                "free(0x{addr:x}): {why} -- free takes exactly the pointer a \
                 malloc returned, once"
            ),
        });
    }
    Ok(HostOutcome::Continue)
}

#[cfg(test)]
mod tests {
    use super::*;

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
