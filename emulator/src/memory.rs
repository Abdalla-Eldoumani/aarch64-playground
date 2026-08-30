use std::collections::HashMap;
use std::rc::Rc;

use crate::errors::{EmuError, MemAccess};

const PAGE_SIZE: usize = 4096;
const PAGE_MASK: u64 = !(PAGE_SIZE as u64 - 1);

/// Hard ceiling on how many 4 KiB pages a single program may have mapped
/// at once. A store that would map a NEW page beyond this cap faults with
/// `MemoryFault { access: Write }` instead of allocating, so a runaway
/// allocation -- a memory bomb, or unbounded recursion growing the stack --
/// aborts calmly rather than growing the wasm heap until the tab dies.
///
/// 8192 pages is 32 MiB of live program memory: enough to back the full
/// 8 MiB stack (2048 pages, matching the course servers' `ulimit -s`) and
/// the 16 MiB heap window (4096 pages) touched together, with the section
/// baseline and headroom on top, yet still well under tab exhaustion. The
/// stack floor must stay below this cap in page terms so runaway recursion
/// meets the stack-overflow message, never the memory-cap one. Page
/// buffers are shared copy-on-write with the step-back snapshot ring, so
/// the peak is the live cap plus whatever the ring's frames still hold of
/// pages the program has since rewritten. The pre-mapped stack/code/data
/// baseline and `map_page` are not subject to the cap (they are the fixed
/// baseline).
pub const MAX_MAPPED_PAGES: usize = 8192;

/// Upper bound on how many `(addr, len)` ranges the dirty log holds
/// between drains. The log is a hint for the UI's changed-byte tint, not
/// machine state, so it is allowed to be approximate -- but it used to be
/// unbounded AND copied into every snapshot frame, which turned a
/// buffer-filling loop into quadratic time and hundreds of MiB (a 24 MB
/// memset run died on a 417 MB allocation). Sequential writes coalesce
/// into the previous range, so a whole-buffer fill costs one entry; past
/// the cap further ranges widen the last entry instead of appending.
const MAX_DIRTY_RANGES: usize = 4096;

/// Sparse page-based memory.
///
/// Pages are 4 KiB, allocated on first write (auto-map). Reads to unmapped
/// addresses fault. All multi-byte accesses are little-endian; unaligned
/// accesses fall back to byte-at-a-time and succeed, modeling Linux
/// userspace normal memory (SCTLR.A = 0). The stack-pointer alignment
/// rule (SA0) is the executor's job, not this module's: it checks SP
/// itself, never the effective address.
///
/// Each write also records an `(addr, len)` range in `dirty` so callers
/// (the snapshot layer) can surface a per-step list of changed addresses
/// for the replay scrubber's memory-diff highlighting. The buffer is
/// drained by `take_dirty()` between steps.
pub struct Memory {
    /// Page buffers behind `Rc` so a snapshot clone shares them instead of
    /// copying every live page. A write goes through `Rc::make_mut`, which
    /// copies only the one page a still-referenced frame is holding -- the
    /// step-back ring used to deep-clone the whole address space per step
    /// (~33x the cost of running the instruction).
    pages: HashMap<u64, Rc<Vec<u8>>>,
    /// Zeroed page buffers recycled by `clear()`. Never freed: dropping
    /// 4 KiB buffers under wasm32's bundled `dlmalloc` can corrupt its
    /// free list (an `unreachable` trap inside `__rdl_dealloc`), so the
    /// buffers are parked here and reused before any new allocation.
    free: Vec<Vec<u8>>,
    dirty: Vec<(u64, usize)>,
    written: u64,
}

impl Clone for Memory {
    /// Snapshots need the live pages, never the recycle pool: cloning the
    /// pool would copy megabytes of zeroed buffers into every step-back
    /// frame. The dirty log is left behind for the same reason -- it
    /// belongs to the UI's next drain, not to the machine state a frame
    /// restores.
    fn clone(&self) -> Self {
        Self {
            pages: self.pages.clone(),
            free: Vec::new(),
            dirty: Vec::new(),
            written: self.written,
        }
    }
}

fn new_page() -> Vec<u8> {
    vec![0u8; PAGE_SIZE]
}

impl Memory {
    /// Create an empty memory with no mapped pages.
    pub fn new() -> Self {
        Self {
            pages: HashMap::new(),
            free: Vec::new(),
            dirty: Vec::new(),
            written: 0,
        }
    }

    /// Drain the dirty-write buffer accumulated since the last call.
    /// Returns `(addr, len)` ranges in write order (adjacent writes are
    /// merged; duplicates and overlap are still normal -- the consumer
    /// dedupes if it cares).
    pub fn take_dirty(&mut self) -> Vec<(u64, usize)> {
        std::mem::take(&mut self.dirty)
    }

    /// Running total of bytes written since this memory was created.
    /// `Cpu::step` reads the per-step delta to charge bulk host-stub work
    /// (a `memset` over a mapped buffer moves megabytes in one step)
    /// against the runaway-step budget.
    pub fn bytes_written(&self) -> u64 {
        self.written
    }

    /// Charge bulk READ work against the same counter the write path
    /// feeds, without touching the dirty log (nothing changed for the
    /// UI to tint). memcmp/strncmp walk a guest-chosen length over
    /// mapped memory, and unpriced reads would let one call do
    /// megabytes of work per step the runaway budget never saw.
    pub fn note_bulk_read(&mut self, len: u64) {
        self.written = self.written.saturating_add(len);
    }

    /// Record a write for the UI's changed-byte tint and the bulk-work
    /// counter. Sequential writes extend the previous range instead of
    /// appending, which is what keeps a buffer-filling loop from
    /// producing one entry per byte.
    fn note_write(&mut self, addr: u64, len: usize) {
        self.written = self.written.saturating_add(len as u64);
        let end = addr.saturating_add(len as u64);
        if let Some(last) = self.dirty.last_mut() {
            let last_end = last.0.saturating_add(last.1 as u64);
            if addr >= last.0 && addr <= last_end {
                last.1 = (end.max(last_end) - last.0) as usize;
                return;
            }
        }
        if self.dirty.len() >= MAX_DIRTY_RANGES {
            // Past the cap the tint stops being per-range and becomes a
            // span: scattered writes widen the newest entry rather than
            // growing the log without bound.
            if let Some(last) = self.dirty.last_mut() {
                let low = last.0.min(addr);
                let high = last.0.saturating_add(last.1 as u64).max(end);
                *last = (low, (high - low) as usize);
            }
            return;
        }
        self.dirty.push((addr, len));
    }

    /// Explicitly map a page so it can be read before being written.
    pub fn map_page(&mut self, addr: u64) {
        let base = addr & PAGE_MASK;
        let Self { pages, free, .. } = self;
        pages
            .entry(base)
            .or_insert_with(|| Rc::new(free.pop().unwrap_or_else(new_page)));
    }

    /// Check whether the page containing `addr` is mapped.
    pub fn is_mapped(&self, addr: u64) -> bool {
        self.pages.contains_key(&(addr & PAGE_MASK))
    }

    /// Number of 4 KiB pages currently mapped. Used to enforce and observe
    /// `MAX_MAPPED_PAGES`.
    pub fn mapped_page_count(&self) -> usize {
        self.pages.len()
    }

    /// Unmap every page, parking the zeroed buffers in the recycle pool.
    ///
    /// The buffers are recycled rather than dropped to keep the dlmalloc
    /// workaround (see `free`) closed, while `mapped_page_count()` -- the
    /// `MAX_MAPPED_PAGES` budget -- returns to zero. Without the unmap,
    /// a program that hit the page cap left the budget exhausted forever
    /// and the NEXT program was blamed for it: reset never gave the pages
    /// back.
    pub fn clear(&mut self) {
        let Self { pages, free, .. } = self;
        for (_, page) in pages.drain() {
            // A page a snapshot frame still shares cannot be recycled --
            // zeroing it would rewrite that frame's memory. Those are
            // dropped and the frame keeps the only reference.
            if let Ok(mut page) = Rc::try_unwrap(page) {
                page.fill(0);
                free.push(page);
            }
        }
    }

    // -- internal helpers --

    fn page_offset(addr: u64) -> usize {
        (addr & (PAGE_SIZE as u64 - 1)) as usize
    }

    fn get_page(&self, addr: u64) -> Result<&[u8], EmuError> {
        let base = addr & PAGE_MASK;
        self.pages
            .get(&base)
            .map(|b| b.as_slice())
            .ok_or(EmuError::MemoryFault {
                address: addr,
                access: MemAccess::Read,
            })
    }

    fn get_page_mut(&mut self, addr: u64) -> Result<&mut [u8], EmuError> {
        let base = addr & PAGE_MASK;
        // A write to an already-mapped page always succeeds. A write that
        // would map a NEW page is refused once the cap is reached, so a
        // runaway allocation aborts instead of growing the heap unbounded.
        if !self.pages.contains_key(&base) && self.pages.len() >= MAX_MAPPED_PAGES {
            return Err(EmuError::MemoryFault {
                address: addr,
                access: MemAccess::Write,
            });
        }
        let Self { pages, free, .. } = self;
        let page = pages
            .entry(base)
            .or_insert_with(|| Rc::new(free.pop().unwrap_or_else(new_page)));
        // Copy-on-write: a page a snapshot frame still shares is copied
        // once, here, instead of the whole address space being copied at
        // every step.
        Ok(Rc::make_mut(page).as_mut_slice())
    }

    // -- public read/write --

    /// Read a single byte.
    pub fn read_u8(&self, addr: u64) -> Result<u8, EmuError> {
        let page = self.get_page(addr)?;
        Ok(page[Self::page_offset(addr)])
    }

    /// Read a 16-bit little-endian value. Tolerates unaligned addresses
    /// (including page-crossing ones) by falling back to byte access.
    pub fn read_u16(&self, addr: u64) -> Result<u16, EmuError> {
        if Self::spans_page(addr, 2) {
            let mut bytes = [0u8; 2];
            for (i, b) in bytes.iter_mut().enumerate() {
                *b = self.read_u8(addr.wrapping_add(i as u64))?;
            }
            return Ok(u16::from_le_bytes(bytes));
        }
        let off = Self::page_offset(addr);
        let page = self.get_page(addr)?;
        Ok(u16::from_le_bytes([page[off], page[off + 1]]))
    }

    /// Read a 32-bit little-endian value; see `read_u16`.
    pub fn read_u32(&self, addr: u64) -> Result<u32, EmuError> {
        if Self::spans_page(addr, 4) {
            let mut bytes = [0u8; 4];
            for (i, b) in bytes.iter_mut().enumerate() {
                *b = self.read_u8(addr.wrapping_add(i as u64))?;
            }
            return Ok(u32::from_le_bytes(bytes));
        }
        let off = Self::page_offset(addr);
        let page = self.get_page(addr)?;
        Ok(u32::from_le_bytes([
            page[off],
            page[off + 1],
            page[off + 2],
            page[off + 3],
        ]))
    }

    /// Read a 64-bit little-endian value; see `read_u16`.
    pub fn read_u64(&self, addr: u64) -> Result<u64, EmuError> {
        if Self::spans_page(addr, 8) {
            let mut bytes = [0u8; 8];
            for (i, b) in bytes.iter_mut().enumerate() {
                *b = self.read_u8(addr.wrapping_add(i as u64))?;
            }
            return Ok(u64::from_le_bytes(bytes));
        }
        let off = Self::page_offset(addr);
        let page = self.get_page(addr)?;
        Ok(u64::from_le_bytes([
            page[off],
            page[off + 1],
            page[off + 2],
            page[off + 3],
            page[off + 4],
            page[off + 5],
            page[off + 6],
            page[off + 7],
        ]))
    }

    /// Write a single byte (auto-maps the page).
    pub fn write_u8(&mut self, addr: u64, val: u8) -> Result<(), EmuError> {
        let off = Self::page_offset(addr);
        let page = self.get_page_mut(addr)?;
        page[off] = val;
        self.note_write(addr, 1);
        Ok(())
    }

    /// Write a 16-bit little-endian value. Tolerates unaligned (and
    /// page-crossing) addresses via byte fallback; auto-maps pages.
    pub fn write_u16(&mut self, addr: u64, val: u16) -> Result<(), EmuError> {
        if Self::spans_page(addr, 2) {
            for (i, b) in val.to_le_bytes().iter().enumerate() {
                self.write_u8(addr.wrapping_add(i as u64), *b)?;
            }
            return Ok(());
        }
        let off = Self::page_offset(addr);
        let bytes = val.to_le_bytes();
        let page = self.get_page_mut(addr)?;
        page[off..off + 2].copy_from_slice(&bytes);
        self.note_write(addr, 2);
        Ok(())
    }

    /// Write a 32-bit little-endian value; see `write_u16`.
    pub fn write_u32(&mut self, addr: u64, val: u32) -> Result<(), EmuError> {
        if Self::spans_page(addr, 4) {
            for (i, b) in val.to_le_bytes().iter().enumerate() {
                self.write_u8(addr.wrapping_add(i as u64), *b)?;
            }
            return Ok(());
        }
        let off = Self::page_offset(addr);
        let bytes = val.to_le_bytes();
        let page = self.get_page_mut(addr)?;
        page[off..off + 4].copy_from_slice(&bytes);
        self.note_write(addr, 4);
        Ok(())
    }

    /// Write a 64-bit little-endian value; see `write_u16`.
    pub fn write_u64(&mut self, addr: u64, val: u64) -> Result<(), EmuError> {
        if Self::spans_page(addr, 8) {
            for (i, b) in val.to_le_bytes().iter().enumerate() {
                self.write_u8(addr.wrapping_add(i as u64), *b)?;
            }
            return Ok(());
        }
        let off = Self::page_offset(addr);
        let bytes = val.to_le_bytes();
        let page = self.get_page_mut(addr)?;
        page[off..off + 8].copy_from_slice(&bytes);
        self.note_write(addr, 8);
        Ok(())
    }

    fn spans_page(addr: u64, len: usize) -> bool {
        let start_page = addr & PAGE_MASK;
        let end_page = addr.wrapping_add(len as u64 - 1) & PAGE_MASK;
        start_page != end_page
    }

    /// Read a contiguous range of bytes. Unmapped bytes read as zero. A
    /// length past the whole page budget is refused rather than served:
    /// the cap proves no real request needs it, `Vec::with_capacity` on a
    /// wasm32 boundary value panics with `capacity overflow`, and even a
    /// successful giant read wedges the caller for minutes.
    pub fn read_bytes(&self, addr: u64, len: usize) -> Result<Vec<u8>, EmuError> {
        if len > MAX_MAPPED_PAGES * PAGE_SIZE {
            return Err(EmuError::MemoryFault {
                address: addr,
                access: MemAccess::Read,
            });
        }
        let mut out = Vec::with_capacity(len);
        for i in 0..len {
            match self.read_u8(addr.wrapping_add(i as u64)) {
                Ok(b) => out.push(b),
                Err(EmuError::MemoryFault { .. }) => out.push(0),
                Err(e) => return Err(e),
            }
        }
        Ok(out)
    }

    /// Write a contiguous slice of bytes (auto-maps pages as needed).
    pub fn write_bytes(&mut self, addr: u64, data: &[u8]) -> Result<(), EmuError> {
        for (i, &byte) in data.iter().enumerate() {
            self.write_u8(addr.wrapping_add(i as u64), byte)?;
        }
        Ok(())
    }
}

impl Default for Memory {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_then_read_u8() {
        let mut mem = Memory::new();
        mem.write_u8(0x1000, 0xAB).unwrap();
        assert_eq!(mem.read_u8(0x1000).unwrap(), 0xAB);
    }

    #[test]
    fn write_then_read_u32() {
        let mut mem = Memory::new();
        mem.write_u32(0x2000, 0xDEAD_BEEF).unwrap();
        assert_eq!(mem.read_u32(0x2000).unwrap(), 0xDEAD_BEEF);
    }

    #[test]
    fn write_then_read_u64() {
        let mut mem = Memory::new();
        mem.write_u64(0x3000, 0x0123_4567_89AB_CDEF).unwrap();
        assert_eq!(mem.read_u64(0x3000).unwrap(), 0x0123_4567_89AB_CDEF);
    }

    #[test]
    fn unaligned_u32_round_trips_via_byte_fallback() {
        // ARM64 LDR/STR on Normal memory succeeds at any alignment when
        // SCTLR.A = 0 (the Linux userspace default), so the emulator
        // matches that by falling back to byte-level access.
        let mut mem = Memory::new();
        mem.write_u32(0x1001, 0xDEAD_BEEF).unwrap();
        assert_eq!(mem.read_u32(0x1001).unwrap(), 0xDEAD_BEEF);
    }

    #[test]
    fn unaligned_u32_spanning_page_boundary() {
        // Spans the 0x1000 / 0x2000 page boundary; the byte fallback
        // auto-maps the second page just like a regular byte write would.
        let mut mem = Memory::new();
        mem.write_u32(0x1FFD, 0x1122_3344).unwrap();
        assert_eq!(mem.read_u32(0x1FFD).unwrap(), 0x1122_3344);
    }

    #[test]
    fn unaligned_u64_round_trips_via_byte_fallback() {
        let mut mem = Memory::new();
        mem.write_u64(0x1003, 0x1122_3344_5566_7788).unwrap();
        assert_eq!(mem.read_u64(0x1003).unwrap(), 0x1122_3344_5566_7788);
    }

    #[test]
    fn auto_map_on_write() {
        let mut mem = Memory::new();
        assert!(!mem.is_mapped(0x9000));
        mem.write_u8(0x9000, 0xFF).unwrap();
        assert!(mem.is_mapped(0x9000));
    }

    #[test]
    fn explicit_map_allows_read() {
        let mut mem = Memory::new();
        mem.map_page(0xA000);
        assert_eq!(mem.read_u8(0xA000).unwrap(), 0);
    }

    #[test]
    fn little_endian_byte_order() {
        let mut mem = Memory::new();
        mem.write_u32(0x4000, 0x04030201).unwrap();
        assert_eq!(mem.read_u8(0x4000).unwrap(), 0x01);
        assert_eq!(mem.read_u8(0x4001).unwrap(), 0x02);
        assert_eq!(mem.read_u8(0x4002).unwrap(), 0x03);
        assert_eq!(mem.read_u8(0x4003).unwrap(), 0x04);
    }

    #[test]
    fn write_bytes_and_read_bytes() {
        let mut mem = Memory::new();
        let data = [0x10, 0x20, 0x30, 0x40];
        mem.write_bytes(0x6000, &data).unwrap();
        let out = mem.read_bytes(0x6000, 4).unwrap();
        assert_eq!(out, data);
    }

    #[test]
    fn separate_pages_are_independent() {
        let mut mem = Memory::new();
        mem.write_u8(0x0000, 0xAA).unwrap();
        mem.write_u8(0x1000, 0xBB).unwrap();
        assert_eq!(mem.read_u8(0x0000).unwrap(), 0xAA);
        assert_eq!(mem.read_u8(0x1000).unwrap(), 0xBB);
    }

    #[test]
    fn u16_alignment_and_readback() {
        let mut mem = Memory::new();
        mem.write_u16(0x2000, 0xCAFE).unwrap();
        assert_eq!(mem.read_u16(0x2000).unwrap(), 0xCAFE);
        assert_eq!(mem.read_u8(0x2000).unwrap(), 0xFE);
        assert_eq!(mem.read_u8(0x2001).unwrap(), 0xCA);
    }

    #[test]
    fn write_past_page_cap_faults_but_mapped_writes_still_ok() {
        let mut mem = Memory::new();
        // Map exactly the cap's worth of distinct pages (map_page bypasses
        // the cap; it is the trusted baseline path).
        for i in 0..MAX_MAPPED_PAGES {
            mem.map_page((i as u64) * 4096);
        }
        assert_eq!(mem.mapped_page_count(), MAX_MAPPED_PAGES);
        // A write to an already-mapped page still succeeds.
        assert!(mem.write_u8(0, 0xAB).is_ok());
        // A write that would map a NEW page is refused, with a Write fault.
        let new_page = (MAX_MAPPED_PAGES as u64) * 4096;
        let err = mem.write_u8(new_page, 0xFF).unwrap_err();
        assert_eq!(
            err,
            EmuError::MemoryFault { address: new_page, access: MemAccess::Write }
        );
        // The cap held: no new page was allocated.
        assert_eq!(mem.mapped_page_count(), MAX_MAPPED_PAGES);
    }

    #[test]
    fn read_from_unmapped_page_faults_with_read_access() {
        let mem = Memory::new();
        let err = mem.read_u32(0x5000).unwrap_err();
        assert_eq!(
            err,
            EmuError::MemoryFault { address: 0x5000, access: MemAccess::Read }
        );
    }

    #[test]
    fn read_bytes_refuses_a_length_past_the_page_budget() {
        // A giant length used to reach Vec::with_capacity (a wasm32
        // capacity-overflow panic past 2^31) or wedge the worker for
        // minutes on a HashMap walk.
        let mem = Memory::new();
        assert!(mem.read_bytes(0, MAX_MAPPED_PAGES * 4096).is_ok());
        assert!(mem.read_bytes(0, MAX_MAPPED_PAGES * 4096 + 1).is_err());
    }

    #[test]
    fn clear_returns_the_page_budget() {
        // Exhaust the cap, clear, and confirm the budget is back: the next
        // program must never be blamed for the previous one's allocation.
        let mut mem = Memory::new();
        for i in 0..MAX_MAPPED_PAGES {
            mem.write_u8((i as u64) * 4096, 1).unwrap();
        }
        assert!(mem.write_u8((MAX_MAPPED_PAGES as u64) * 4096, 1).is_err());
        mem.clear();
        assert_eq!(mem.mapped_page_count(), 0);
        assert!(mem.write_u8(0x9000, 0xAB).is_ok());
        assert_eq!(mem.read_u8(0x9000).unwrap(), 0xAB);
    }

    #[test]
    fn recycled_pages_come_back_zeroed() {
        let mut mem = Memory::new();
        mem.write_u64(0x1000, u64::MAX).unwrap();
        mem.clear();
        mem.map_page(0x1000);
        assert_eq!(mem.read_u64(0x1000).unwrap(), 0);
    }

    #[test]
    fn cloning_memory_does_not_carry_the_recycle_pool() {
        // The snapshot ring clones Memory every step; a cloned pool would
        // copy megabytes of parked buffers into each frame.
        let mut mem = Memory::new();
        for i in 0..64 {
            mem.write_u8(i * 4096, 1).unwrap();
        }
        mem.clear();
        let cloned = mem.clone();
        assert_eq!(cloned.mapped_page_count(), 0);
        assert_eq!(cloned.free.len(), 0);
        assert_eq!(mem.free.len(), 64);
    }

    #[test]
    fn cloning_shares_page_buffers_until_one_is_written() {
        // The step-back ring clones Memory on every step. Copying every
        // live page there cost ~33x the price of running the instruction;
        // sharing the buffers and copying one on write is what makes the
        // ring affordable.
        let mut mem = Memory::new();
        for i in 0..64 {
            mem.write_u8(i * 4096, 1).unwrap();
        }
        let frame = mem.clone();
        assert!(
            mem.pages.values().all(|p| Rc::strong_count(p) == 2),
            "a clone must share every page, not copy it"
        );

        mem.write_u8(0, 2).unwrap();
        assert_eq!(frame.read_u8(0).unwrap(), 1, "the frame keeps the old byte");
        assert_eq!(mem.read_u8(0).unwrap(), 2);
        let shared = mem
            .pages
            .values()
            .filter(|p| Rc::strong_count(p) == 2)
            .count();
        assert_eq!(shared, 63, "only the written page is copied");
    }

    #[test]
    fn a_buffer_fill_records_one_dirty_range() {
        // A whole-buffer fill used to append one entry per byte, and every
        // snapshot frame copied the whole log: 12 fills of a 64 KiB buffer
        // built a 12 MB log and took 0.4 s of pure bookkeeping.
        let mut mem = Memory::new();
        for i in 0..40_000u64 {
            mem.write_u8(0x1000 + i, 0xAB).unwrap();
        }
        let dirty = mem.take_dirty();
        assert_eq!(dirty, vec![(0x1000, 40_000)]);
    }

    #[test]
    fn the_dirty_log_stops_growing_at_its_cap() {
        // Scattered writes cannot coalesce, so the log needs a hard stop
        // too. Past the cap the newest entry widens into a span instead of
        // the log growing; the tint is a hint, never machine state.
        let mut mem = Memory::new();
        for i in 0..20_000u64 {
            mem.write_u8(i * 64, 1).unwrap();
        }
        let dirty = mem.take_dirty();
        assert!(
            dirty.len() <= MAX_DIRTY_RANGES,
            "the dirty log must stay bounded, got {}",
            dirty.len()
        );
        assert!(mem.take_dirty().is_empty(), "the drain empties the log");
    }

    #[test]
    fn a_clone_leaves_the_dirty_log_behind() {
        // The log belongs to the UI's next drain, not to the machine state
        // a snapshot restores; carrying it made every frame pay for it.
        let mut mem = Memory::new();
        mem.write_u32(0x1000, 7).unwrap();
        let frame = mem.clone();
        assert!(frame.dirty.is_empty());
        assert_eq!(mem.take_dirty(), vec![(0x1000, 4)]);
    }

    #[test]
    fn bytes_written_counts_the_bulk_work_a_stub_did() {
        // `Cpu::step` charges the step budget with this delta, so a
        // memset-sized fill inside one instruction cannot be free.
        let mut mem = Memory::new();
        let before = mem.bytes_written();
        mem.write_u64(0x1000, 0).unwrap();
        mem.write_bytes(0x2000, &[0u8; 100]).unwrap();
        assert_eq!(mem.bytes_written() - before, 108);
    }

    #[test]
    fn page_crossing_read_faults_on_the_unmapped_second_page() {
        let mut mem = Memory::new();
        mem.map_page(0x1000);
        let err = mem.read_u32(0x1FFE).unwrap_err();
        assert_eq!(
            err,
            EmuError::MemoryFault { address: 0x2000, access: MemAccess::Read }
        );
    }

    #[test]
    fn little_endian_byte_order_u64() {
        let mut mem = Memory::new();
        mem.write_u64(0x4000, 0x0807_0605_0403_0201).unwrap();
        for i in 0..8u64 {
            assert_eq!(mem.read_u8(0x4000 + i).unwrap(), (i + 1) as u8);
        }
    }

    #[test]
    fn unaligned_u16_round_trips_within_a_page() {
        // Same SCTLR.A = 0 stance as the u32/u64 cases: odd addresses
        // succeed instead of faulting.
        let mut mem = Memory::new();
        mem.write_u16(0x1001, 0xBEEF).unwrap();
        assert_eq!(mem.read_u16(0x1001).unwrap(), 0xBEEF);
    }

    #[test]
    fn multi_byte_write_auto_maps_exactly_one_page() {
        let mut mem = Memory::new();
        assert_eq!(mem.mapped_page_count(), 0);
        mem.write_u64(0x8000, 0x1122_3344_5566_7788).unwrap();
        assert!(mem.is_mapped(0x8000));
        assert_eq!(mem.mapped_page_count(), 1);
    }

    #[test]
    fn read_bytes_zero_fills_unmapped_gaps() {
        let mut mem = Memory::new();
        mem.write_u8(0x1000, 0xAA).unwrap();
        let out = mem.read_bytes(0x0FFE, 4).unwrap();
        assert_eq!(out, vec![0, 0, 0xAA, 0]);
    }
}
