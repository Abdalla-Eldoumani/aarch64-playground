use std::collections::HashMap;

use crate::errors::{EmuError, MemAccess};

const PAGE_SIZE: usize = 4096;
const PAGE_MASK: u64 = !(PAGE_SIZE as u64 - 1);

/// Sparse page-based memory.
///
/// Pages are 4 KiB, allocated on first write (auto-map). Reads to unmapped
/// addresses fault. All multi-byte accesses are little-endian and require
/// natural alignment.
pub struct Memory {
    pages: HashMap<u64, Vec<u8>>,
}

fn new_page() -> Vec<u8> {
    vec![0u8; PAGE_SIZE]
}

impl Memory {
    /// Create an empty memory with no mapped pages.
    pub fn new() -> Self {
        Self {
            pages: HashMap::new(),
        }
    }

    /// Explicitly map a page so it can be read before being written.
    pub fn map_page(&mut self, addr: u64) {
        let base = addr & PAGE_MASK;
        self.pages.entry(base).or_insert_with(new_page);
    }

    /// Check whether the page containing `addr` is mapped.
    pub fn is_mapped(&self, addr: u64) -> bool {
        self.pages.contains_key(&(addr & PAGE_MASK))
    }

    /// Zero every mapped page in place, keeping the allocations.
    ///
    /// Dropping and re-allocating 4 KiB page buffers under wasm32's bundled
    /// `dlmalloc` can trigger a free-list corruption that manifests as an
    /// `unreachable` trap inside `__rdl_dealloc`. Zeroing in place avoids
    /// the allocator churn that triggers it.
    pub fn clear(&mut self) {
        for page in self.pages.values_mut() {
            page.fill(0);
        }
    }

    // -- internal helpers --

    fn page_offset(addr: u64) -> usize {
        (addr & (PAGE_SIZE as u64 - 1)) as usize
    }

    fn check_alignment(addr: u64, required: u8) -> Result<(), EmuError> {
        if addr % (required as u64) != 0 {
            return Err(EmuError::UnalignedAccess {
                address: addr,
                required,
            });
        }
        Ok(())
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

    fn get_page_mut(&mut self, addr: u64) -> &mut [u8] {
        let base = addr & PAGE_MASK;
        self.pages.entry(base).or_insert_with(new_page).as_mut_slice()
    }

    // -- public read/write --

    /// Read a single byte.
    pub fn read_u8(&self, addr: u64) -> Result<u8, EmuError> {
        let page = self.get_page(addr)?;
        Ok(page[Self::page_offset(addr)])
    }

    /// Read a 16-bit value (little-endian, 2-byte aligned).
    pub fn read_u16(&self, addr: u64) -> Result<u16, EmuError> {
        Self::check_alignment(addr, 2)?;
        let off = Self::page_offset(addr);
        let page = self.get_page(addr)?;
        Ok(u16::from_le_bytes([page[off], page[off + 1]]))
    }

    /// Read a 32-bit value (little-endian, 4-byte aligned).
    pub fn read_u32(&self, addr: u64) -> Result<u32, EmuError> {
        Self::check_alignment(addr, 4)?;
        let off = Self::page_offset(addr);
        let page = self.get_page(addr)?;
        Ok(u32::from_le_bytes([
            page[off],
            page[off + 1],
            page[off + 2],
            page[off + 3],
        ]))
    }

    /// Read a 64-bit value (little-endian, 8-byte aligned).
    pub fn read_u64(&self, addr: u64) -> Result<u64, EmuError> {
        Self::check_alignment(addr, 8)?;
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
        let page = self.get_page_mut(addr);
        page[off] = val;
        Ok(())
    }

    /// Write a 16-bit value (little-endian, 2-byte aligned, auto-maps).
    pub fn write_u16(&mut self, addr: u64, val: u16) -> Result<(), EmuError> {
        Self::check_alignment(addr, 2)?;
        let off = Self::page_offset(addr);
        let bytes = val.to_le_bytes();
        let page = self.get_page_mut(addr);
        page[off..off + 2].copy_from_slice(&bytes);
        Ok(())
    }

    /// Write a 32-bit value (little-endian, 4-byte aligned, auto-maps).
    pub fn write_u32(&mut self, addr: u64, val: u32) -> Result<(), EmuError> {
        Self::check_alignment(addr, 4)?;
        let off = Self::page_offset(addr);
        let bytes = val.to_le_bytes();
        let page = self.get_page_mut(addr);
        page[off..off + 4].copy_from_slice(&bytes);
        Ok(())
    }

    /// Write a 64-bit value (little-endian, 8-byte aligned, auto-maps).
    pub fn write_u64(&mut self, addr: u64, val: u64) -> Result<(), EmuError> {
        Self::check_alignment(addr, 8)?;
        let off = Self::page_offset(addr);
        let bytes = val.to_le_bytes();
        let page = self.get_page_mut(addr);
        page[off..off + 8].copy_from_slice(&bytes);
        Ok(())
    }

    /// Read a contiguous range of bytes. Unmapped bytes read as zero.
    pub fn read_bytes(&self, addr: u64, len: usize) -> Result<Vec<u8>, EmuError> {
        let mut out = Vec::with_capacity(len);
        for i in 0..len {
            match self.read_u8(addr + i as u64) {
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
            self.write_u8(addr + i as u64, byte)?;
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
    fn unaligned_u32_faults() {
        let mut mem = Memory::new();
        mem.write_u8(0x1001, 0).unwrap();
        let err = mem.read_u32(0x1001).unwrap_err();
        assert!(matches!(err, EmuError::UnalignedAccess { address: 0x1001, required: 4 }));
    }

    #[test]
    fn unaligned_u64_faults() {
        let mut mem = Memory::new();
        mem.write_u8(0x1004, 0).unwrap();
        let err = mem.write_u64(0x1004, 0).unwrap_err();
        assert!(matches!(err, EmuError::UnalignedAccess { address: 0x1004, required: 8 }));
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
}
