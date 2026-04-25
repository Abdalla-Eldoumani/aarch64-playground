pub mod argv;
pub mod assembler;
pub mod cpu;
pub mod decoder;
pub mod errors;
pub mod executor;
pub mod fpu;
pub mod frontend;
pub mod hosted;
pub mod memory;
pub mod registers;
pub mod snapshot;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;
#[cfg(target_arch = "wasm32")]
use serde::Serialize;

#[allow(unused_imports)]
use cpu::{Cpu, StepOutcome};

/// Heuristic that decides whether the source uses the hosted cpsc 355
/// feature set (sections, .global main, libc BLs). The bare-metal
/// examples hit none of these so they keep the legacy path.
#[cfg(target_arch = "wasm32")]
fn needs_hosted_pipeline(source: &str) -> bool {
    // Strip // and ; comments so fragments inside them don't trigger.
    let clean: String = source
        .lines()
        .map(|l| {
            let without_line_comment = match l.find("//") {
                Some(p) => &l[..p],
                None => l,
            };
            match without_line_comment.find(';') {
                Some(p) => &without_line_comment[..p],
                None => without_line_comment,
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    let lower = clean.to_lowercase();
    if lower.contains(".text")
        || lower.contains(".data")
        || lower.contains(".bss")
        || lower.contains(".rodata")
        || lower.contains(".global")
        || lower.contains(".globl")
        || lower.contains(".string")
        || lower.contains(".asciz")
        || lower.contains(".ascii")
        || lower.contains(".word")
        || lower.contains(".quad")
        || lower.contains(".hword")
        || lower.contains(".short")
        || lower.contains(".byte")
        || lower.contains(".double")
        || lower.contains(".float")
        || lower.contains(".skip")
        || lower.contains(".zero")
        || lower.contains(".balign")
        || lower.contains(".align")
        || lower.contains("define(")
    {
        return true;
    }
    for libc in [
        "printf", "scanf", "puts", "putchar", "getchar", "strlen", "strcmp", "strcpy",
        "memset", "memcpy", "atof", "exit",
    ] {
        let pat = format!("bl {libc}");
        if lower.contains(&pat) {
            return true;
        }
    }
    false
}

#[cfg(target_arch = "wasm32")]
fn outcome_to_js(outcome: &StepOutcome) -> (&'static str, Option<i64>) {
    match outcome {
        StepOutcome::Advance => ("advance", None),
        StepOutcome::Halted => ("halted", None),
        StepOutcome::WaitingForInput => ("waiting", None),
        StepOutcome::Exited(code) => ("exited", Some(*code)),
    }
}


/// WASM-exposed emulator wrapping the core CPU.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub struct Emulator {
    cpu: Cpu,
}

#[cfg(target_arch = "wasm32")]
#[derive(Serialize)]
struct StepResultJs {
    pc: u64,
    halted: bool,
    error: Option<String>,
    /// "advance" | "halted" | "waiting" | "exited"
    outcome: &'static str,
    /// Populated when outcome == "exited".
    exit_code: Option<i64>,
}

#[cfg(target_arch = "wasm32")]
#[derive(Serialize)]
struct RunResultJs {
    pc: u64,
    halted: bool,
    steps_executed: u32,
    hit_breakpoint: bool,
    error: Option<String>,
}

#[cfg(target_arch = "wasm32")]
#[derive(Serialize)]
struct RegistersJs {
    /// X0-X30 as hex strings (BigInt-safe)
    gpr: Vec<String>,
    sp: String,
    pc: String,
    nzcv: u8,
}

#[cfg(target_arch = "wasm32")]
#[derive(Serialize)]
struct AssembleResultJs {
    success: bool,
    error: Option<String>,
    error_line: Option<usize>,
    instruction_count: usize,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl Emulator {
    /// Create a fresh emulator with default memory layout.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        // install panic hook so Rust panics surface as readable JS errors
        console_error_panic_hook::set_once();
        Self { cpu: Cpu::new() }
    }

    /// Assemble source text and load the resulting program. Sources that
    /// reach for hosted features (`.text`/`.data`/`.bss`/`.rodata`, or
    /// `.global main`, or any `bl <libc>`) go through the section-aware
    /// pipeline; everything else keeps the legacy single-`.text` path so
    /// the bare-metal examples retain their exact byte-for-byte layout.
    pub fn assemble_and_load(&mut self, source: &str) -> JsValue {
        if needs_hosted_pipeline(source) {
            self.cpu.reset();
            match frontend::pipeline::assemble_hosted(source, &self.cpu.host) {
                Ok(image) => {
                    let count = image.instruction_count;
                    match self.cpu.load_linked_image(&image) {
                        Ok(()) => serde_wasm_bindgen::to_value(&AssembleResultJs {
                            success: true,
                            error: None,
                            error_line: None,
                            instruction_count: count,
                        })
                        .unwrap(),
                        Err(e) => serde_wasm_bindgen::to_value(&AssembleResultJs {
                            success: false,
                            error: Some(e.to_string()),
                            error_line: None,
                            instruction_count: 0,
                        })
                        .unwrap(),
                    }
                }
                Err(e) => {
                    let (line, message) = match e {
                        errors::EmuError::AssemblyError { line, message }
                        | errors::EmuError::PreprocError { line, message }
                        | errors::EmuError::ParseError { line, message }
                        | errors::EmuError::LinkError { line, message } => (Some(line), message),
                        other => (None, other.to_string()),
                    };
                    serde_wasm_bindgen::to_value(&AssembleResultJs {
                        success: false,
                        error: Some(message),
                        error_line: line,
                        instruction_count: 0,
                    })
                    .unwrap()
                }
            }
        } else {
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
    }

    /// Same as `assemble_and_load` but additionally writes argc/argv at
    /// `argv::ARGV_BASE` so the program's `main(int argc, char **argv)`
    /// sees the supplied arguments. Bare-metal sources (no hosted
    /// features) ignore args -- argc/argv only have meaning for hosted
    /// programs that read them through w0/x1.
    pub fn assemble_and_load_with_args(
        &mut self,
        source: &str,
        args: Vec<String>,
    ) -> JsValue {
        if needs_hosted_pipeline(source) {
            self.cpu.reset();
            let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
            match frontend::pipeline::assemble_hosted(source, &self.cpu.host) {
                Ok(image) => {
                    let count = image.instruction_count;
                    match self.cpu.load_linked_image_with_args(&image, &arg_refs) {
                        Ok(()) => serde_wasm_bindgen::to_value(&AssembleResultJs {
                            success: true,
                            error: None,
                            error_line: None,
                            instruction_count: count,
                        })
                        .unwrap(),
                        Err(e) => serde_wasm_bindgen::to_value(&AssembleResultJs {
                            success: false,
                            error: Some(e.to_string()),
                            error_line: None,
                            instruction_count: 0,
                        })
                        .unwrap(),
                    }
                }
                Err(e) => {
                    let (line, message) = match e {
                        errors::EmuError::AssemblyError { line, message }
                        | errors::EmuError::PreprocError { line, message }
                        | errors::EmuError::ParseError { line, message }
                        | errors::EmuError::LinkError { line, message } => (Some(line), message),
                        other => (None, other.to_string()),
                    };
                    serde_wasm_bindgen::to_value(&AssembleResultJs {
                        success: false,
                        error: Some(message),
                        error_line: line,
                        instruction_count: 0,
                    })
                    .unwrap()
                }
            }
        } else {
            // Bare-metal path -- args have no caller, just delegate.
            self.assemble_and_load(source)
        }
    }

    /// Execute one instruction.
    pub fn step(&mut self) -> JsValue {
        match self.cpu.step() {
            Ok(result) => {
                let (outcome, exit_code) = outcome_to_js(&result.outcome);
                serde_wasm_bindgen::to_value(&StepResultJs {
                    pc: result.pc,
                    halted: result.halted,
                    error: result.error,
                    outcome,
                    exit_code,
                })
                .unwrap()
            }
            Err(e) => serde_wasm_bindgen::to_value(&StepResultJs {
                pc: self.cpu.regs.read_pc(),
                halted: true,
                error: Some(e.to_string()),
                outcome: "error",
                exit_code: None,
            })
            .unwrap(),
        }
    }

    /// Step one instruction backward using the snapshot ring. Returns
    /// the same tagged result shape as `step` so the JS side can share
    /// its handler; `outcome` is whatever state the CPU landed in after
    /// restoring the previous frame.
    pub fn step_back(&mut self) -> JsValue {
        let outcome = self.cpu.step_back();
        let (outcome_str, exit_code) = outcome_to_js(&outcome);
        serde_wasm_bindgen::to_value(&StepResultJs {
            pc: self.cpu.regs.read_pc(),
            halted: self.cpu.is_halted(),
            error: None,
            outcome: outcome_str,
            exit_code,
        })
        .unwrap()
    }

    /// Whether `step_back` would have a frame to restore.
    pub fn can_step_back(&self) -> bool {
        self.cpu.can_step_back()
    }

    /// Save the current CPU state under `name`. Overwrites any existing
    /// save with the same name; named saves survive `reset()`.
    pub fn save_state(&mut self, name: &str) {
        self.cpu.save_state(name.to_string());
    }

    /// Restore a previously-saved state. Returns `true` on success,
    /// `false` when no save by that name exists.
    pub fn load_state(&mut self, name: &str) -> bool {
        self.cpu.load_state(name)
    }

    /// Delete a named save. Returns `true` when a save existed.
    pub fn delete_state(&mut self, name: &str) -> bool {
        self.cpu.delete_state(name)
    }

    /// Sorted list of every named save currently held.
    pub fn list_states(&self) -> Vec<String> {
        self.cpu.state_names()
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

    // -- hosted runtime (phase B) --

    /// Drain accumulated stdout as a UTF-8 string.
    pub fn take_stdout(&mut self) -> String {
        String::from_utf8_lossy(&self.cpu.take_stdout()).into_owned()
    }

    /// Drain accumulated stderr as a UTF-8 string.
    pub fn take_stderr(&mut self) -> String {
        String::from_utf8_lossy(&self.cpu.take_stderr()).into_owned()
    }

    /// Push bytes onto the stdin buffer. Clears the blocked flag so a
    /// paused read/scanf resumes on the next step.
    pub fn push_stdin(&mut self, s: &str) {
        self.cpu.push_stdin(s.as_bytes());
    }

    /// Whether the CPU is paused waiting for stdin.
    pub fn is_blocked(&self) -> bool {
        self.cpu.is_blocked()
    }

    /// Current exit code, if `exit` ran.
    pub fn get_exit_code(&self) -> Option<i64> {
        self.cpu.exit_code()
    }

    /// Register a virtual file. Subsequent `openat(path, ...)` finds it.
    pub fn upload_vfs_file(&mut self, path: &str, data: &[u8]) {
        self.cpu
            .upload_vfs_file(path.to_string(), data.to_vec());
    }

    /// Names of every file currently in the virtual filesystem.
    pub fn list_vfs_files(&self) -> Vec<String> {
        let mut names: Vec<String> = self.cpu.vfs.keys().cloned().collect();
        names.sort();
        names
    }

    /// Clear stdout/stderr scrollback without resetting CPU state.
    pub fn clear_console(&mut self) {
        self.cpu.clear_console();
    }
}
