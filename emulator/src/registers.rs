use crate::errors::EmuError;

/// ARM64 condition codes used by B.cond and conditional select.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Condition {
    EQ = 0b0000,
    NE = 0b0001,
    HS = 0b0010, // CS
    LO = 0b0011, // CC
    MI = 0b0100,
    PL = 0b0101,
    VS = 0b0110,
    VC = 0b0111,
    HI = 0b1000,
    LS = 0b1001,
    GE = 0b1010,
    LT = 0b1011,
    GT = 0b1100,
    LE = 0b1101,
    AL = 0b1110,
}

impl Condition {
    /// Decode a 4-bit condition field. Returns `Err` for the reserved 0b1111.
    pub fn from_u8(val: u8) -> Result<Self, EmuError> {
        match val & 0xF {
            0b0000 => Ok(Self::EQ),
            0b0001 => Ok(Self::NE),
            0b0010 => Ok(Self::HS),
            0b0011 => Ok(Self::LO),
            0b0100 => Ok(Self::MI),
            0b0101 => Ok(Self::PL),
            0b0110 => Ok(Self::VS),
            0b0111 => Ok(Self::VC),
            0b1000 => Ok(Self::HI),
            0b1001 => Ok(Self::LS),
            0b1010 => Ok(Self::GE),
            0b1011 => Ok(Self::LT),
            0b1100 => Ok(Self::GT),
            0b1101 => Ok(Self::LE),
            0b1110 | 0b1111 => Ok(Self::AL),
            _ => unreachable!(),
        }
    }

    /// Invert a condition (flip the low bit). Used by CSET encoding.
    pub fn invert(self) -> Self {
        let bits = self as u8;
        // AL inverted is still AL
        if bits >= 0b1110 {
            return Self::AL;
        }
        Self::from_u8(bits ^ 1).expect("invert always produces a valid condition")
    }
}

/// Barrel shifter type used in data-processing and addressing.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShiftType {
    LSL = 0,
    LSR = 1,
    ASR = 2,
    ROR = 3,
}

impl ShiftType {
    /// Decode from the 2-bit shift field in instruction encodings.
    pub fn from_u8(val: u8) -> Self {
        match val & 0x3 {
            0 => Self::LSL,
            1 => Self::LSR,
            2 => Self::ASR,
            3 => Self::ROR,
            _ => unreachable!(),
        }
    }
}

/// Apply a shift operation. `sf` controls 32-bit vs 64-bit semantics.
pub fn apply_shift(value: u64, shift: ShiftType, amount: u8, sf: bool) -> u64 {
    let bits: u32 = if sf { 64 } else { 32 };
    let amount = (amount as u32) % bits;
    let mask: u64 = if sf { u64::MAX } else { 0xFFFF_FFFF };

    let val = value & mask;
    let result = match shift {
        ShiftType::LSL => val << amount,
        ShiftType::LSR => val >> amount,
        ShiftType::ASR => {
            // arithmetic right shift: sign-extend based on operand width
            if sf {
                ((val as i64) >> amount) as u64
            } else {
                ((val as u32 as i32) >> amount) as u32 as u64
            }
        }
        ShiftType::ROR => {
            if amount == 0 {
                val
            } else if sf {
                val.rotate_right(amount)
            } else {
                (val as u32).rotate_right(amount) as u64
            }
        }
    };
    result & mask
}

/// NZCV condition flags.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct NzcvFlags {
    pub n: bool,
    pub z: bool,
    pub c: bool,
    pub v: bool,
}

impl NzcvFlags {
    /// Pack into a 4-bit value: N=bit3, Z=bit2, C=bit1, V=bit0.
    pub fn pack(&self) -> u8 {
        ((self.n as u8) << 3) | ((self.z as u8) << 2) | ((self.c as u8) << 1) | (self.v as u8)
    }

    /// Evaluate a condition code against the current flags.
    pub fn check(&self, cond: Condition) -> bool {
        match cond {
            Condition::EQ => self.z,
            Condition::NE => !self.z,
            Condition::HS => self.c,
            Condition::LO => !self.c,
            Condition::MI => self.n,
            Condition::PL => !self.n,
            Condition::VS => self.v,
            Condition::VC => !self.v,
            Condition::HI => self.c && !self.z,
            Condition::LS => !self.c || self.z,
            Condition::GE => self.n == self.v,
            Condition::LT => self.n != self.v,
            Condition::GT => !self.z && (self.n == self.v),
            Condition::LE => self.z || (self.n != self.v),
            Condition::AL => true,
        }
    }
}

/// The 64-bit ARM register file.
///
/// Contains X0-X30, SP, PC, and the NZCV condition flags.
/// W-register access (32-bit) is handled by the `sf` parameter on
/// read/write methods -- internally everything is stored as 64-bit.
#[derive(Debug, Clone)]
pub struct RegisterFile {
    gpr: [u64; 31],
    sp: u64,
    pc: u64,
    pub nzcv: NzcvFlags,
}

impl RegisterFile {
    /// Fresh register file: all zeros, PC at zero.
    pub fn new() -> Self {
        Self {
            gpr: [0u64; 31],
            sp: 0,
            pc: 0,
            nzcv: NzcvFlags::default(),
        }
    }

    /// Read a general-purpose register. Index 31 returns zero (XZR/WZR).
    /// When `sf` is false the upper 32 bits are masked off.
    pub fn read_gpr(&self, index: u8, sf: bool) -> u64 {
        let val = if index >= 31 { 0 } else { self.gpr[index as usize] };
        if sf { val } else { val & 0xFFFF_FFFF }
    }

    /// Write a general-purpose register. Index 31 is a no-op (write to XZR).
    /// When `sf` is false the value is zero-extended from 32 bits.
    pub fn write_gpr(&mut self, index: u8, sf: bool, value: u64) {
        if index >= 31 {
            return;
        }
        self.gpr[index as usize] = if sf { value } else { value & 0xFFFF_FFFF };
    }

    /// Read the stack pointer.
    pub fn read_sp(&self) -> u64 {
        self.sp
    }

    /// Write the stack pointer.
    pub fn write_sp(&mut self, value: u64) {
        self.sp = value;
    }

    /// Read a register where index 31 means SP instead of XZR.
    pub fn read_gpr_or_sp(&self, index: u8, sf: bool) -> u64 {
        let val = if index >= 31 { self.sp } else { self.gpr[index as usize] };
        if sf { val } else { val & 0xFFFF_FFFF }
    }

    /// Write a register where index 31 means SP instead of XZR.
    pub fn write_gpr_or_sp(&mut self, index: u8, sf: bool, value: u64) {
        let value = if sf { value } else { value & 0xFFFF_FFFF };
        if index >= 31 {
            self.sp = value;
        } else {
            self.gpr[index as usize] = value;
        }
    }

    /// Read the program counter.
    pub fn read_pc(&self) -> u64 {
        self.pc
    }

    /// Write the program counter.
    pub fn write_pc(&mut self, value: u64) {
        self.pc = value;
    }

    /// Snapshot all 31 GPRs + SP as a flat array (for change detection).
    pub fn snapshot(&self) -> [u64; 32] {
        let mut out = [0u64; 32];
        out[..31].copy_from_slice(&self.gpr);
        out[31] = self.sp;
        out
    }
}

impl Default for RegisterFile {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn xzr_reads_zero() {
        let rf = RegisterFile::new();
        assert_eq!(rf.read_gpr(31, true), 0);
        assert_eq!(rf.read_gpr(31, false), 0);
    }

    #[test]
    fn xzr_write_is_noop() {
        let mut rf = RegisterFile::new();
        rf.write_gpr(31, true, 0xDEAD);
        assert_eq!(rf.read_gpr(31, true), 0);
    }

    #[test]
    fn w_register_truncates() {
        let mut rf = RegisterFile::new();
        rf.write_gpr(0, true, 0xFFFF_FFFF_1234_5678);
        // reading as W0 should mask upper 32 bits
        assert_eq!(rf.read_gpr(0, false), 0x1234_5678);
    }

    #[test]
    fn w_register_write_zeros_upper() {
        let mut rf = RegisterFile::new();
        rf.write_gpr(0, true, 0xFFFF_FFFF_FFFF_FFFF);
        rf.write_gpr(0, false, 0x42);
        // full 64-bit read should show only lower 32 bits
        assert_eq!(rf.read_gpr(0, true), 0x42);
    }

    #[test]
    fn sp_via_index_31() {
        let mut rf = RegisterFile::new();
        rf.write_sp(0x8000_0000);
        assert_eq!(rf.read_gpr_or_sp(31, true), 0x8000_0000);
        rf.write_gpr_or_sp(31, true, 0x7FFF_FFF0);
        assert_eq!(rf.read_sp(), 0x7FFF_FFF0);
    }

    #[test]
    fn nzcv_pack() {
        let flags = NzcvFlags { n: true, z: false, c: true, v: false };
        assert_eq!(flags.pack(), 0b1010);
    }

    #[test]
    fn condition_eq_ne() {
        let z_set = NzcvFlags { n: false, z: true, c: false, v: false };
        assert!(z_set.check(Condition::EQ));
        assert!(!z_set.check(Condition::NE));
    }

    #[test]
    fn condition_signed_comparisons() {
        // n=1, v=1 -> n==v -> GE true, LT false
        let nv = NzcvFlags { n: true, z: false, c: false, v: true };
        assert!(nv.check(Condition::GE));
        assert!(!nv.check(Condition::LT));

        // n=1, v=0 -> n!=v -> GE false, LT true
        let n_only = NzcvFlags { n: true, z: false, c: false, v: false };
        assert!(!n_only.check(Condition::GE));
        assert!(n_only.check(Condition::LT));
    }

    #[test]
    fn condition_gt_le() {
        // GT: !z && (n==v)
        let flags = NzcvFlags { n: false, z: false, c: false, v: false };
        assert!(flags.check(Condition::GT));
        assert!(!flags.check(Condition::LE));

        // LE: z || (n!=v)
        let z_set = NzcvFlags { n: false, z: true, c: false, v: false };
        assert!(!z_set.check(Condition::GT));
        assert!(z_set.check(Condition::LE));
    }

    #[test]
    fn condition_hi_ls() {
        // HI: c && !z
        let c_set = NzcvFlags { n: false, z: false, c: true, v: false };
        assert!(c_set.check(Condition::HI));
        assert!(!c_set.check(Condition::LS));
    }

    #[test]
    fn condition_al_always() {
        let any = NzcvFlags { n: true, z: true, c: true, v: true };
        assert!(any.check(Condition::AL));
        let none = NzcvFlags::default();
        assert!(none.check(Condition::AL));
    }

    #[test]
    fn condition_invert() {
        assert_eq!(Condition::EQ.invert(), Condition::NE);
        assert_eq!(Condition::NE.invert(), Condition::EQ);
        assert_eq!(Condition::GE.invert(), Condition::LT);
        assert_eq!(Condition::LT.invert(), Condition::GE);
        assert_eq!(Condition::AL.invert(), Condition::AL);
    }

    #[test]
    fn shift_lsl() {
        assert_eq!(apply_shift(1, ShiftType::LSL, 4, true), 16);
        assert_eq!(apply_shift(1, ShiftType::LSL, 31, false), 0x8000_0000);
    }

    #[test]
    fn shift_lsr() {
        assert_eq!(apply_shift(0x80, ShiftType::LSR, 4, true), 0x8);
        assert_eq!(apply_shift(0x8000_0000, ShiftType::LSR, 31, false), 1);
    }

    #[test]
    fn shift_asr_sign_extends() {
        // 64-bit: high bit set, ASR should sign-extend
        let val: u64 = 0x8000_0000_0000_0000;
        let result = apply_shift(val, ShiftType::ASR, 4, true);
        assert_eq!(result, 0xF800_0000_0000_0000);

        // 32-bit: bit 31 set, ASR should sign-extend within 32 bits
        let val32: u64 = 0x8000_0000;
        let result32 = apply_shift(val32, ShiftType::ASR, 4, false);
        assert_eq!(result32, 0x0000_0000_F800_0000);
    }

    #[test]
    fn shift_ror() {
        assert_eq!(apply_shift(1, ShiftType::ROR, 1, true), 0x8000_0000_0000_0000);
        assert_eq!(apply_shift(1, ShiftType::ROR, 1, false), 0x8000_0000);
    }

    #[test]
    fn snapshot_captures_sp() {
        let mut rf = RegisterFile::new();
        rf.write_gpr(0, true, 100);
        rf.write_sp(200);
        let snap = rf.snapshot();
        assert_eq!(snap[0], 100);
        assert_eq!(snap[31], 200);
    }
}
