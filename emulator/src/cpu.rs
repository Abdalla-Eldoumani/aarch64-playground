use std::collections::HashSet;

use crate::decoder;
use crate::errors::EmuError;
use crate::executor::{self, ExecResult};
use crate::memory::Memory;
use crate::registers::RegisterFile;

/// Base address where assembled code is loaded.
pub const CODE_BASE: u64 = 0x0040_0000;

/// Initial stack pointer (grows downward).
pub const STACK_BASE: u64 = 0x8000_0000;

/// Result of a single step.
#[derive(Debug, Clone)]
pub struct StepResult {
    pub pc: u64,
    pub halted: bool,
    pub error: Option<String>,
}

/// Result of a run (multiple steps).
#[derive(Debug, Clone)]
pub struct RunResult {
    pub pc: u64,
    pub halted: bool,
    pub steps_executed: u32,
    pub hit_breakpoint: bool,
    pub error: Option<String>,
}

/// Top-level CPU wrapping register file, memory, and breakpoints.
pub struct Cpu {
    pub regs: RegisterFile,
    pub mem: Memory,
    breakpoints: HashSet<u64>,
    changed_regs: Vec<u8>,
    halted: bool,
}

impl Cpu {
    /// Create a fresh CPU with default memory layout.
    pub fn new() -> Self {
        let mut cpu = Self {
            regs: RegisterFile::new(),
            mem: Memory::new(),
            breakpoints: HashSet::new(),
            changed_regs: Vec::new(),
            halted: false,
        };
        cpu.regs.write_sp(STACK_BASE);
        cpu.regs.write_pc(CODE_BASE);

        // pre-map some stack pages so initial pushes don't need auto-map
        for i in 0..4 {
            cpu.mem.map_page(STACK_BASE - (i + 1) * 4096);
        }
        cpu
    }

    /// Load encoded instructions into memory at CODE_BASE and reset PC.
    pub fn load_program(&mut self, code: &[u32]) {
        let mut addr = CODE_BASE;
        for &word in code {
            // auto-maps pages on write
            self.mem.write_u32(addr, word).expect("code write should not fail on aligned addresses");
            addr += 4;
        }
        self.regs.write_pc(CODE_BASE);
        self.halted = false;
    }

    /// Execute one instruction at the current PC.
    pub fn step(&mut self) -> Result<StepResult, EmuError> {
        if self.halted {
            return Ok(StepResult {
                pc: self.regs.read_pc(),
                halted: true,
                error: None,
            });
        }

        let snapshot = self.regs.snapshot();
        let pc = self.regs.read_pc();

        let word = self.mem.read_u32(pc)?;
        let instr = decoder::decode(word)?;
        let result = executor::execute(&instr, &mut self.regs, &mut self.mem)?;

        // advance PC if the instruction didn't branch
        if result == ExecResult::Advance {
            self.regs.write_pc(pc + 4);
        }

        if result == ExecResult::Halted {
            self.halted = true;
        }

        // detect which registers changed
        let current = self.regs.snapshot();
        self.changed_regs.clear();
        for i in 0..32 {
            if snapshot[i] != current[i] {
                self.changed_regs.push(i as u8);
            }
        }

        Ok(StepResult {
            pc: self.regs.read_pc(),
            halted: self.halted,
            error: None,
        })
    }

    /// Run until breakpoint, halt, error, or max_steps reached.
    pub fn run_until_break(&mut self, max_steps: u32) -> Result<RunResult, EmuError> {
        let mut steps: u32 = 0;

        while steps < max_steps && !self.halted {
            let pc = self.regs.read_pc();

            // check breakpoint before executing (but not on the very first step
            // so we can resume past a breakpoint)
            if steps > 0 && self.breakpoints.contains(&pc) {
                return Ok(RunResult {
                    pc,
                    halted: false,
                    steps_executed: steps,
                    hit_breakpoint: true,
                    error: None,
                });
            }

            self.step()?;
            steps += 1;
        }

        Ok(RunResult {
            pc: self.regs.read_pc(),
            halted: self.halted,
            steps_executed: steps,
            hit_breakpoint: false,
            error: None,
        })
    }

    /// Set a breakpoint at an address.
    pub fn set_breakpoint(&mut self, addr: u64) {
        self.breakpoints.insert(addr);
    }

    /// Clear a breakpoint.
    pub fn clear_breakpoint(&mut self, addr: u64) {
        self.breakpoints.remove(&addr);
    }

    /// Clear all breakpoints.
    pub fn clear_all_breakpoints(&mut self) {
        self.breakpoints.clear();
    }

    /// Reset to initial state, keeping breakpoints.
    pub fn reset(&mut self) {
        self.regs = RegisterFile::new();
        self.regs.write_sp(STACK_BASE);
        self.regs.write_pc(CODE_BASE);
        self.mem = Memory::new();
        for i in 0..4 {
            self.mem.map_page(STACK_BASE - (i + 1) * 4096);
        }
        self.changed_regs.clear();
        self.halted = false;
    }

    /// Indices of registers that changed during the last step.
    pub fn changed_registers(&self) -> &[u8] {
        &self.changed_regs
    }

    /// Whether the CPU has halted (SVC executed).
    pub fn is_halted(&self) -> bool {
        self.halted
    }
}

impl Default for Cpu {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // hand-encode a few instructions for integration tests

    fn encode_movz(rd: u8, imm16: u16, hw: u8) -> u32 {
        // MOVZ Xd, #imm16, LSL #(hw*16)
        // 1_10_100101_hw_imm16_rd
        0xD280_0000 | ((hw as u32) << 21) | ((imm16 as u32) << 5) | (rd as u32)
    }

    fn encode_add_imm(rd: u8, rn: u8, imm12: u16) -> u32 {
        // ADD Xd, Xn, #imm12
        // 1_0_0_10001_00_imm12_rn_rd
        0x9100_0000 | ((imm12 as u32) << 10) | ((rn as u32) << 5) | (rd as u32)
    }

    fn encode_subs_imm(rd: u8, rn: u8, imm12: u16) -> u32 {
        // SUBS Xd, Xn, #imm12
        // 1_1_1_10001_00_imm12_rn_rd
        0xF100_0000 | ((imm12 as u32) << 10) | ((rn as u32) << 5) | (rd as u32)
    }

    fn encode_b_cond(cond: u8, offset_instr: i32) -> u32 {
        // B.cond offset (in instructions, will be *4)
        let imm19 = ((offset_instr as u32) & 0x7FFFF) << 5;
        0x5400_0000 | imm19 | (cond as u32)
    }

    fn encode_svc(imm16: u16) -> u32 {
        0xD400_0001 | ((imm16 as u32) << 5)
    }

    #[test]
    fn simple_mov_and_add() {
        let mut cpu = Cpu::new();
        let code = vec![
            encode_movz(0, 10, 0),   // MOV X0, #10
            encode_movz(1, 20, 0),   // MOV X1, #20
            encode_add_imm(2, 0, 0), // ADD X2, X0, #0 (copy)
            encode_svc(0),           // halt
        ];
        cpu.load_program(&code);

        // step through all four
        for _ in 0..4 {
            cpu.step().unwrap();
        }

        assert_eq!(cpu.regs.read_gpr(0, true), 10);
        assert_eq!(cpu.regs.read_gpr(1, true), 20);
        assert_eq!(cpu.regs.read_gpr(2, true), 10);
        assert!(cpu.is_halted());
    }

    #[test]
    fn countdown_loop() {
        // X0 = 5; while (X0 != 0) { X0 -= 1; } halt
        let mut cpu = Cpu::new();
        let code = vec![
            encode_movz(0, 5, 0),         // MOV X0, #5
            encode_subs_imm(0, 0, 1),     // loop: SUBS X0, X0, #1
            encode_b_cond(0b0001, -1),     // B.NE loop (offset -1 instruction = -4 bytes)
            encode_svc(0),                 // halt
        ];
        cpu.load_program(&code);

        let result = cpu.run_until_break(100).unwrap();
        assert!(result.halted);
        assert_eq!(cpu.regs.read_gpr(0, true), 0);
    }

    #[test]
    fn changed_regs_tracked() {
        let mut cpu = Cpu::new();
        let code = vec![
            encode_movz(5, 42, 0),
            encode_svc(0),
        ];
        cpu.load_program(&code);

        cpu.step().unwrap();
        assert!(cpu.changed_registers().contains(&5));
    }

    #[test]
    fn breakpoint_stops_execution() {
        let mut cpu = Cpu::new();
        let code = vec![
            encode_movz(0, 1, 0),
            encode_movz(1, 2, 0),
            encode_movz(2, 3, 0),
            encode_svc(0),
        ];
        cpu.load_program(&code);

        // break at the third instruction
        cpu.set_breakpoint(CODE_BASE + 8);
        let result = cpu.run_until_break(100).unwrap();

        assert!(result.hit_breakpoint);
        assert!(!result.halted);
        assert_eq!(cpu.regs.read_pc(), CODE_BASE + 8);
        // first two instructions executed
        assert_eq!(cpu.regs.read_gpr(0, true), 1);
        assert_eq!(cpu.regs.read_gpr(1, true), 2);
        // third not yet
        assert_eq!(cpu.regs.read_gpr(2, true), 0);
    }

    #[test]
    fn reset_clears_state() {
        let mut cpu = Cpu::new();
        cpu.regs.write_gpr(0, true, 999);
        cpu.reset();
        assert_eq!(cpu.regs.read_gpr(0, true), 0);
        assert_eq!(cpu.regs.read_sp(), STACK_BASE);
        assert_eq!(cpu.regs.read_pc(), CODE_BASE);
    }
}
