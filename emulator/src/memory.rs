use std::collections::HashMap;
use std::rc::Rc;

use crate::errors::{EmuError, MemAccess};

const PAGE_SIZE: usize = 4096;
const PAGE_MASK: u64 = !(PAGE_SIZE as u64 - 1);

/// Most 4 KiB pages a program may have mapped at once. A write that would
/// map one more faults with `MemoryFault { access: Write }`, so a runaway
/// allocation or recursion stops calmly rather than growing the wasm heap
/// until the tab dies. `map_page`, which maps the fixed baseline, is exempt.
///
/// 8192 pages is 32 MiB: the full 8 MiB stack (the course servers'
/// `ulimit -s`) and the 16 MiB heap together, plus the sections. The stack
/// floor must stay under this cap so runaway recursion gets the
/// stack-overflow message, not this one. Named saves may still hold old
/// copies of pages on top of it.
pub const MAX_MAPPED_PAGES: usize = 8192;

/// Most `(addr, len)` ranges the dirty log holds between drains. The log
/// only drives the UI's changed-byte tint, so it may be approximate; left
/// unbounded, a 24 MB memset once died on a 417 MB allocation. Past the
/// cap, new ranges widen the last entry instead of appending.
const MAX_DIRTY_RANGES: usize = 4096;

/// Sparse memory in 4 KiB pages, mapped on first write. Reads of unmapped
/// addresses fault. Accesses are little-endian, and unaligned ones succeed
/// byte by byte, as in Linux user space (SCTLR.A = 0). The stack-pointer
/// alignment check (SA0) belongs to the executor, since it checks SP, not
/// the address.
///
/// Every write is logged as an `(addr, len)` range that `take_dirty()`
/// drains, so the UI can tint the bytes a step changed.
pub struct Memory {
    /// Page buffers behind `Rc` so a named save's clone shares them instead
    /// of copying every live page. A write goes through `Rc::make_mut`,
    /// which copies only the one page a save is still holding.
    pages: HashMap<u64, Rc<Vec<u8>>>,
    /// Zeroed page buffers recycled by `clear()`. Never freed: dropping
    /// 4 KiB buffers under wasm32's bundled `dlmalloc` can corrupt its
    /// free list (an `unreachable` trap inside `__rdl_dealloc`), so the
    /// buffers are parked here and reused before any new allocation.
    free: Vec<Vec<u8>>,
    dirty: Vec<(u64, usize)>,
    written: u64,
    /// `[start, end)` spans that read as zeros before their first write:
    /// the data sections the loader placed. Linux maps a whole `.bss`, so a
    /// read of an untouched page there answers 0 rather than faulting.
    zero_fill: Vec<(u64, u64)>,
    /// While `recording`, what the running step's writes replaced, so its
    /// step-back frame can put them back; between steps a spare buffer
    /// (see `record_undo`).
    undo: MemUndo,
    recording: bool,
}

/// What a step's writes replaced: each run of written bytes with the bytes
/// that were there before, and each page a write mapped. Copying the page
/// table into every step-back frame made a deep recursion step about 9
/// times slower; this costs about what the step wrote.
#[derive(Default)]
pub struct MemUndo {
    /// `(addr, len)` per run, in write order. A write that starts where the
    /// last run ended extends it, so filling a buffer is one run.
    runs: Vec<(u64, usize)>,
    /// The replaced bytes of every run, end to end.
    old: Vec<u8>,
    /// Pages the writes mapped, to unmap again.
    mapped: Vec<u64>,
}

impl MemUndo {
    fn save(&mut self, addr: u64, replaced: &[u8]) {
        match self.runs.last_mut() {
            Some((start, len)) if start.wrapping_add(*len as u64) == addr => *len += replaced.len(),
            _ => self.runs.push((addr, replaced.len())),
        }
        self.old.extend_from_slice(replaced);
    }
}

/// What an untouched page inside a `zero_fill` span reads as.
static ZERO_PAGE: [u8; PAGE_SIZE] = [0; PAGE_SIZE];

impl Clone for Memory {
    /// A named save needs the live pages, never the recycle pool: cloning
    /// the pool would copy megabytes of zeroed buffers into every save.
    /// The dirty log and the undo log are left behind for the same reason:
    /// they belong to the UI's next drain and to the running step, not to
    /// the machine state a save restores.
    fn clone(&self) -> Self {
        Self {
            pages: self.pages.clone(),
            free: Vec::new(),
            dirty: Vec::new(),
            written: self.written,
            zero_fill: self.zero_fill.clone(),
            undo: MemUndo::default(),
            recording: false,
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
            zero_fill: Vec::new(),
            undo: MemUndo::default(),
            recording: false,
        }
    }

    /// Start logging what writes replace. The log fills `slot`'s buffers
    /// (a recycled frame's), which trade places with this memory's spare
    /// until `finish_undo` trades them back, so a step allocates and frees
    /// nothing for its log.
    pub fn record_undo(&mut self, slot: &mut MemUndo) {
        std::mem::swap(&mut self.undo, slot);
        // A bulk step (a memset over megabytes) leaves a frame's buffers
        // big, and they stay big. Shrinking them would gain nothing: wasm
        // memory never shrinks, so the next big step reuses the space.
        let log = &mut self.undo;
        log.runs.clear();
        log.old.clear();
        log.mapped.clear();
        self.recording = true;
    }

    /// Stop logging and trade the filled log back into `slot`.
    pub fn finish_undo(&mut self, slot: &mut MemUndo) {
        if std::mem::take(&mut self.recording) {
            std::mem::swap(&mut self.undo, slot);
        }
    }

    /// Put back what the logged writes replaced, newest first, then unmap
    /// the pages they mapped. The changed-byte log empties too: the memory
    /// is back where it was before anything changed.
    pub fn undo(&mut self, log: MemUndo) {
        let mut end = log.old.len();
        for &(addr, len) in log.runs.iter().rev() {
            let start = end - len;
            // Back through the write path, 16 bytes at a time. Every page
            // a logged write touched is still mapped, so none can fail.
            for (i, chunk) in log.old[start..end].chunks(16).enumerate() {
                let _ = self.write_le(addr.wrapping_add(16 * i as u64), chunk);
            }
            end = start;
        }
        for base in log.mapped {
            if let Some(page) = self.pages.remove(&base) {
                // Recycled rather than dropped, as in `clear()`.
                if let Ok(mut page) = Rc::try_unwrap(page) {
                    page.fill(0);
                    self.free.push(page);
                }
            }
        }
        self.dirty.clear();
    }

    /// Name the spans that read as zeros until written (the loaded data
    /// sections), replacing any earlier ones.
    pub fn set_zero_fill(&mut self, spans: Vec<(u64, u64)>) {
        self.zero_fill = spans;
    }

    fn in_zero_fill(&self, addr: u64) -> bool {
        self.zero_fill.iter().any(|&(start, end)| addr >= start && addr < end)
    }

    /// Drain the dirty-write buffer accumulated since the last call.
    /// Returns `(addr, len)` ranges in write order (adjacent writes are
    /// merged; duplicates and overlap are still normal: the consumer
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
        self.page_or_map(addr & PAGE_MASK);
    }

    /// The page at `base`, mapped first if it is new (and the mapping
    /// logged, when an undo log is open).
    fn page_or_map(&mut self, base: u64) -> &mut Rc<Vec<u8>> {
        let Self { pages, free, undo, recording, .. } = self;
        pages.entry(base).or_insert_with(|| {
            if *recording {
                undo.mapped.push(base);
            }
            Rc::new(free.pop().unwrap_or_else(new_page))
        })
    }

    /// Check whether the page containing `addr` is mapped.
    pub fn is_mapped(&self, addr: u64) -> bool {
        self.pages.contains_key(&(addr & PAGE_MASK)) || self.in_zero_fill(addr)
    }

    /// Number of 4 KiB pages currently mapped. Used to enforce and observe
    /// `MAX_MAPPED_PAGES`.
    pub fn mapped_page_count(&self) -> usize {
        self.pages.len()
    }

    /// Unmap every page, parking the zeroed buffers in the recycle pool (see
    /// `free`) so the page budget returns to zero. Without this, a program
    /// that hit the cap left the budget spent and the next program was
    /// blamed.
    pub fn clear(&mut self) {
        self.zero_fill.clear();
        let Self { pages, free, .. } = self;
        for (_, page) in pages.drain() {
            // A page a snapshot frame still shares cannot be recycled:
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
        match self.pages.get(&base) {
            Some(page) => Ok(page.as_slice()),
            None if self.in_zero_fill(addr) => Ok(&ZERO_PAGE),
            None => Err(EmuError::MemoryFault {
                address: addr,
                access: MemAccess::Read,
            }),
        }
    }

    /// Write `bytes` (16 at most, all inside `addr`'s page), mapping the
    /// page on first write and logging what they replace when an undo log
    /// is open.
    fn write_in_page(&mut self, addr: u64, bytes: &[u8]) -> Result<(), EmuError> {
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
        let off = Self::page_offset(addr);
        let mut replaced = [0u8; 16];
        // Copy-on-write: a page a named save still shares is copied once,
        // here.
        let slot = &mut Rc::make_mut(self.page_or_map(base))[off..off + bytes.len()];
        replaced[..bytes.len()].copy_from_slice(slot);
        slot.copy_from_slice(bytes);
        if self.recording {
            self.undo.save(addr, &replaced[..bytes.len()]);
        }
        self.note_write(addr, bytes.len());
        Ok(())
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

    /// Read a 128-bit little-endian value; see `read_u16`. Used by the
    /// Q-width SIMD&FP loads.
    pub fn read_u128(&self, addr: u64) -> Result<u128, EmuError> {
        if Self::spans_page(addr, 16) {
            let mut bytes = [0u8; 16];
            for (i, b) in bytes.iter_mut().enumerate() {
                *b = self.read_u8(addr.wrapping_add(i as u64))?;
            }
            return Ok(u128::from_le_bytes(bytes));
        }
        let off = Self::page_offset(addr);
        let page = self.get_page(addr)?;
        let mut bytes = [0u8; 16];
        bytes.copy_from_slice(&page[off..off + 16]);
        Ok(u128::from_le_bytes(bytes))
    }

    /// Write a single byte (auto-maps the page).
    pub fn write_u8(&mut self, addr: u64, val: u8) -> Result<(), EmuError> {
        self.write_in_page(addr, &[val])
    }

    /// Write a 16-bit little-endian value. Tolerates unaligned (and
    /// page-crossing) addresses via byte fallback; auto-maps pages.
    pub fn write_u16(&mut self, addr: u64, val: u16) -> Result<(), EmuError> {
        self.write_le(addr, &val.to_le_bytes())
    }

    /// Write a 32-bit little-endian value; see `write_u16`.
    pub fn write_u32(&mut self, addr: u64, val: u32) -> Result<(), EmuError> {
        self.write_le(addr, &val.to_le_bytes())
    }

    /// Write a 64-bit little-endian value; see `write_u16`.
    pub fn write_u64(&mut self, addr: u64, val: u64) -> Result<(), EmuError> {
        self.write_le(addr, &val.to_le_bytes())
    }

    /// Write a 128-bit little-endian value; see `write_u16`.
    pub fn write_u128(&mut self, addr: u64, val: u128) -> Result<(), EmuError> {
        self.write_le(addr, &val.to_le_bytes())
    }

    /// Write `bytes` (16 at most, already little-endian) at `addr`. One
    /// that crosses into the next page goes byte by byte, so each page is
    /// mapped (or refused at the cap) as it is reached.
    fn write_le(&mut self, addr: u64, bytes: &[u8]) -> Result<(), EmuError> {
        if Self::spans_page(addr, bytes.len()) {
            for (i, b) in bytes.iter().enumerate() {
                self.write_in_page(addr.wrapping_add(i as u64), std::slice::from_ref(b))?;
            }
            return Ok(());
        }
        self.write_in_page(addr, bytes)
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
        // A giant length reaching Vec::with_capacity is a wasm32
        // capacity-overflow panic past 2^31, and a giant HashMap walk
        // wedges the worker for minutes.
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
        // One entry per byte, copied into every snapshot frame: 12 fills
        // of a 64 KiB buffer build a 12 MB log and take 0.4 s of pure
        // bookkeeping.
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
        // a snapshot restores; carrying it makes every frame pay for it.
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

    #[test]
    fn undo_puts_back_every_write_newest_first() {
        // The same bytes written twice, and a write across a page edge:
        // undoing must land on what was there before the first write.
        let mut mem = Memory::new();
        mem.write_u64(0x1000, 0x1111_1111_1111_1111).unwrap();
        mem.write_u64(0x1FF8, 0x2222_2222_2222_2222).unwrap();
        mem.write_u8(0x2000, 0x33).unwrap();
        let mut log = MemUndo::default();
        mem.record_undo(&mut log);
        mem.write_u64(0x1000, 0xAAAA).unwrap();
        mem.write_u8(0x1003, 0xBB).unwrap();
        mem.write_u128(0x1FF8, u128::MAX).unwrap();
        mem.write_bytes(0x1100, &[7; 40]).unwrap();
        mem.finish_undo(&mut log);
        mem.undo(log);
        assert_eq!(mem.read_u64(0x1000).unwrap(), 0x1111_1111_1111_1111);
        assert_eq!(mem.read_u64(0x1FF8).unwrap(), 0x2222_2222_2222_2222);
        assert_eq!(mem.read_u64(0x2000).unwrap(), 0x33);
        assert_eq!(mem.read_bytes(0x1100, 40).unwrap(), vec![0; 40]);
        assert!(mem.take_dirty().is_empty(), "after an undo nothing has changed");
    }

    #[test]
    fn undo_unmaps_the_pages_the_writes_mapped() {
        let mut mem = Memory::new();
        mem.write_u8(0x1000, 1).unwrap();
        let mut log = MemUndo::default();
        mem.record_undo(&mut log);
        mem.write_u32(0x5000, 9).unwrap();
        mem.map_page(0x9000);
        assert_eq!(mem.mapped_page_count(), 3);
        mem.finish_undo(&mut log);
        mem.undo(log);
        assert_eq!(mem.mapped_page_count(), 1);
        assert!(mem.read_u8(0x5000).is_err(), "the page faults again, as before the step");
        assert!(!mem.is_mapped(0x9000));
        mem.map_page(0x5000);
        assert_eq!(mem.read_u32(0x5000).unwrap(), 0, "a recycled page comes back zeroed");
    }

    #[test]
    fn a_buffer_fill_logs_one_run() {
        // One record per byte would make a memset's log several times the
        // size of what it overwrote.
        let mut mem = Memory::new();
        let mut log = MemUndo::default();
        mem.record_undo(&mut log);
        for i in 0..40_000u64 {
            mem.write_u8(0x1000 + i, 0xAB).unwrap();
        }
        mem.finish_undo(&mut log);
        assert_eq!(log.runs, vec![(0x1000, 40_000)]);
        assert_eq!(log.old.len(), 40_000);
    }
}
