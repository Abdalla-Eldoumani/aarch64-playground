pub mod assembler;
pub mod cpu;
pub mod decoder;
pub mod errors;
pub mod executor;
pub mod memory;
pub mod registers;

use wasm_bindgen::prelude::*;
use serde::Serialize;

use cpu::Cpu;


/// WASM-exposed emulator wrapping the core CPU.
#[wasm_bindgen]
pub struct Emulator {
    cpu: Cpu,
}

#[derive(Serialize)]
struct StepResultJs {
    pc: u64,
    halted: bool,
    error: Option<String>,
}

#[derive(Serialize)]
struct RunResultJs {
    pc: u64,
    halted: bool,
    steps_executed: u32,
    hit_breakpoint: bool,
    error: Option<String>,
}

#[derive(Serialize)]
struct RegistersJs {
    /// X0-X30 as hex strings (BigInt-safe)
    gpr: Vec<String>,
    sp: String,
    pc: String,
    nzcv: u8,
}

#[derive(Serialize)]
struct AssembleResultJs {
    success: bool,
    error: Option<String>,
    error_line: Option<usize>,
    instruction_count: usize,
}

#[wasm_bindgen]
impl Emulator {
    /// Create a fresh emulator with default memory layout.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        // install panic hook so Rust panics surface as readable JS errors
        console_error_panic_hook::set_once();
        Self { cpu: Cpu::new() }
    }

    /// Assemble source text and load the resulting program.
    pub fn assemble_and_load(&mut self, source: &str) -> JsValue {
        match assembler::assemble(source) {
            Ok(code) => {
                let count = code.len();
                self.cpu.reset();
                self.cpu.load_program(&code);
                serde_wasm_bindgen::to_value(&AssembleResultJs {
                    success: true,
                    error: None,
                    error_line: None,
                    instruction_count: count,
                }).unwrap()
            }
            Err(errors::EmuError::AssemblyError { line, message }) => {
                serde_wasm_bindgen::to_value(&AssembleResultJs {
                    success: false,
                    error: Some(message),
                    error_line: Some(line),
                    instruction_count: 0,
                }).unwrap()
            }
            Err(e) => {
                serde_wasm_bindgen::to_value(&AssembleResultJs {
                    success: false,
                    error: Some(e.to_string()),
                    error_line: None,
                    instruction_count: 0,
                }).unwrap()
            }
        }
    }

    /// Execute one instruction.
    pub fn step(&mut self) -> JsValue {
        match self.cpu.step() {
            Ok(result) => serde_wasm_bindgen::to_value(&StepResultJs {
                pc: result.pc,
                halted: result.halted,
                error: result.error,
            }).unwrap(),
            Err(e) => serde_wasm_bindgen::to_value(&StepResultJs {
                pc: self.cpu.regs.read_pc(),
                halted: true,
                error: Some(e.to_string()),
            }).unwrap(),
        }
    }

    /// Run until breakpoint, halt, error, or max_steps reached.
    pub fn run_until_break(&mut self, max_steps: u32) -> JsValue {
        match self.cpu.run_until_break(max_steps) {
            Ok(result) => serde_wasm_bindgen::to_value(&RunResultJs {
                pc: result.pc,
                halted: result.halted,
                steps_executed: result.steps_executed,
                hit_breakpoint: result.hit_breakpoint,
                error: result.error,
            }).unwrap(),
            Err(e) => serde_wasm_bindgen::to_value(&RunResultJs {
                pc: self.cpu.regs.read_pc(),
                halted: true,
                steps_executed: 0,
                hit_breakpoint: false,
                error: Some(e.to_string()),
            }).unwrap(),
        }
    }

    /// Reset CPU to initial state (keeps breakpoints).
    pub fn reset(&mut self) {
        self.cpu.reset();
    }

    /// Read the program counter.
    pub fn get_pc(&self) -> u64 {
        self.cpu.regs.read_pc()
    }

    /// Read a single general-purpose register (0-30). Index 31 returns 0 (XZR).
    pub fn get_register(&self, index: u8) -> u64 {
        self.cpu.regs.read_gpr(index, true)
    }

    /// Read the stack pointer.
    pub fn get_sp(&self) -> u64 {
        self.cpu.regs.read_sp()
    }

    /// Read NZCV flags packed into a u8: N=bit3, Z=bit2, C=bit1, V=bit0.
    pub fn get_nzcv(&self) -> u8 {
        self.cpu.regs.nzcv.pack()
    }

    /// Get all registers as a serialized JS object with hex strings.
    pub fn get_all_registers(&self) -> JsValue {
        let gpr: Vec<String> = (0..31)
            .map(|i| format!("0x{:016x}", self.cpu.regs.read_gpr(i, true)))
            .collect();

        serde_wasm_bindgen::to_value(&RegistersJs {
            gpr,
            sp: format!("0x{:016x}", self.cpu.regs.read_sp()),
            pc: format!("0x{:016x}", self.cpu.regs.read_pc()),
            nzcv: self.cpu.regs.nzcv.pack(),
        }).unwrap()
    }

    /// Read a range of memory as a byte array. Returns empty on fault.
    pub fn get_memory_range(&self, addr: u32, len: u32) -> Vec<u8> {
        self.cpu.mem
            .read_bytes(addr as u64, len as usize)
            .unwrap_or_default()
    }

    /// Indices of registers that changed during the last step (0-31, where 31=SP).
    pub fn get_changed_registers(&self) -> Vec<u8> {
        self.cpu.changed_registers().to_vec()
    }

    /// Set a breakpoint at an address.
    pub fn set_breakpoint(&mut self, address: u32) {
        self.cpu.set_breakpoint(address as u64);
    }

    /// Clear a breakpoint at an address.
    pub fn clear_breakpoint(&mut self, address: u32) {
        self.cpu.clear_breakpoint(address as u64);
    }

    /// Whether the CPU has halted (SVC executed).
    pub fn is_halted(&self) -> bool {
        self.cpu.is_halted()
    }

    /// Get the code base address (where assembled programs are loaded).
    pub fn code_base(&self) -> u32 {
        cpu::CODE_BASE as u32
    }
}
