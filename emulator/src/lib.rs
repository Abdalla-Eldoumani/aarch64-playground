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
use serde::Serialize;

#[allow(unused_imports)]
use cpu::{Cpu, StepOutcome};

/// Every C-callable name the hosted runtime registers, as `bl <name>`
/// spells it. A program that calls one of these needs the hosted
/// pipeline, so the list has to keep pace with the stub table: the unit
/// test `every_registered_stub_is_detected_as_hosted` fails the moment a
/// new stub is registered without being named here.
pub const HOSTED_LIBC_NAMES: &[&str] = &[
    // console and formatted output
    "printf", "scanf", "sprintf", "snprintf", "puts", "putchar", "getchar",
    // strings
    "strlen", "strcmp", "strncmp", "strcpy", "strncpy", "strcat", "strchr",
    "strstr", "strtok", "memset", "memcpy", "memmove", "memcmp",
    // conversion and process control
    "atof", "atoi", "strtol", "abs", "labs", "exit", "rand", "srand", "time",
    // heap and pacing
    "malloc", "calloc", "realloc", "free", "usleep", "fflush",
    // character classes
    "isdigit", "isalpha", "isspace", "toupper", "tolower", "__ctype_b_loc",
    "__ctype_toupper_loc", "__ctype_tolower_loc",
    // FILE*-level stdio
    "fopen", "fprintf", "fgets", "fputs", "fclose",
    // libm
    "sqrt", "pow", "sin", "cos", "tan", "log", "log10", "exp", "floor",
    "fabs", "fmod",
];

/// Decide whether the source uses the hosted cpsc 355 feature set
/// (sections, `.global main`, libc BLs, m4 defines). The bare-metal
/// examples hit none of these so they keep the legacy single-`.text`
/// path. Single source of truth: TypeScript callers go through the
/// wasm-bindgen wrapper rather than maintaining their own list.
pub fn detect_hosted_mode(source: &str) -> bool {
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
    // The directive set is the parser's own table, not a second hand-kept
    // list beside it. A hand-kept second list drifts: `.section`,
    // `.dword`, `.type` and `.size` are directives the parser understands,
    // and a file whose only directive is one of them would take the legacy
    // path. `define(` stays an extra term because m4 runs before the
    // directives are parsed.
    if crate::frontend::parser::DIRECTIVES
        .iter()
        .any(|directive| lower.contains(directive))
        || lower.contains("define(")
    {
        return true;
    }
    // Collapse whitespace runs so `bl   printf` and `bl\tprintf` detect the
    // same as `bl printf`.
    let normalized = lower.split_whitespace().collect::<Vec<_>>().join(" ");
    for libc in HOSTED_LIBC_NAMES {
        let pat = format!("bl {libc}");
        if normalized.contains(&pat) {
            return true;
        }
    }
    false
}

/// Wasm-bindgen wrapper. The TS frontend imports this through the WASM
/// module so it never has to maintain a parallel list of directives or
/// libc names; adding a new hosted feature touches only this file.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = detectHostedMode)]
pub fn detect_hosted_mode_js(source: &str) -> bool {
    detect_hosted_mode(source)
}

/// One band of the emulator's address space as the memory panel labels it.
/// `start` is inclusive and `end` exclusive; both are u32 per the boundary
/// convention `flatten_line_map` documents.
#[derive(Serialize)]
pub struct MemoryRegionJs {
    pub name: &'static str,
    pub start: u32,
    pub end: u32,
}

/// The address bands a cpsc 355 program can touch, in address order. They
/// describe the STATIC layout, not live frontiers: the heap row spans the
/// whole malloc window rather than the current bump pointer, and the stub
/// row the whole table capacity, because a panel labelling an address wants
/// the band it belongs to regardless of what the program has reached. Built
/// outside the wasm boundary so a native test pins every row to the
/// constant it comes from: the panel's labels and jump targets are only
/// trustworthy while they agree with the loader.
pub fn memory_map() -> Vec<MemoryRegionJs> {
    let section = |name, base: u64| MemoryRegionJs {
        name,
        start: base as u32,
        end: (base + cpu::SECTION_WINDOW) as u32,
    };
    vec![
        section(".text", cpu::CODE_BASE),
        section(".rodata", cpu::RODATA_BASE),
        section(".data", cpu::DATA_BASE),
        section(".bss", cpu::BSS_BASE),
        MemoryRegionJs {
            name: "argv",
            start: argv::ARGV_BASE as u32,
            end: (argv::ARGV_BASE + argv::ARGV_MAX_BYTES as u64) as u32,
        },
        MemoryRegionJs {
            name: "heap",
            start: hosted::heap::HEAP_BASE as u32,
            end: hosted::heap::HEAP_LIMIT as u32,
        },
        MemoryRegionJs {
            name: "stack",
            start: cpu::STACK_FLOOR as u32,
            end: cpu::STACK_BASE as u32,
        },
        MemoryRegionJs {
            name: "host stubs",
            start: cpu::HOST_STUB_BASE as u32,
            end: (cpu::HOST_STUB_BASE + cpu::HOST_STUB_COUNT * cpu::HOST_STUB_STRIDE) as u32,
        },
    ]
}

/// Wasm-bindgen wrapper, mirroring `detectHostedMode`: the map is fixed for
/// the life of the module, so the caller reads it once at init and keeps it
/// rather than maintaining a parallel copy of the layout in TypeScript.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = memoryMap)]
pub fn memory_map_js() -> JsValue {
    serde_wasm_bindgen::to_value(&memory_map()).unwrap()
}

/// The external call a paused pc sits inside: which libc function, and the
/// call site it was reached from. A hosted call takes three steps (two
/// trampoline words, then the synthetic stub address), none of which is a
/// line the student wrote, so the stepping UI reads this to name the call
/// and hold the marker on the `bl`.
pub struct HostCallContext {
    pub name: String,
    pub call_site_pc: u64,
    /// Editor line of the call site, when the line map resolves it.
    pub call_site_line: Option<u32>,
}

/// Resolve the external-call context for the cpu's current pc, or `None`
/// when the pc is an instruction the program itself holds. `line_map` is
/// the flat `[addr, line, ...]` map the wasm wrapper carries.
///
/// The call site is LR-4, the same recovery `error_line_for` uses for a
/// fault raised inside a stub: LR holds the address the `bl` will return
/// to, and the instruction before it is the `bl`. It has to be dynamic:
/// one trampoline serves every call site of a function, so nothing static
/// can say which `printf` line the pc belongs to.
pub fn host_call_context(cpu: &Cpu, line_map: &[u32]) -> Option<HostCallContext> {
    let name = cpu.host_call_name(cpu.regs.read_pc())?.to_string();
    let call_site_pc = cpu.regs.read_gpr(30, true).wrapping_sub(4);
    let target = call_site_pc as u32;
    let call_site_line = line_map
        .chunks_exact(2)
        .find(|pair| pair[0] == target)
        .map(|pair| pair[1]);
    Some(HostCallContext { name, call_site_pc, call_site_line })
}

#[cfg(target_arch = "wasm32")]
fn outcome_to_js(outcome: &StepOutcome) -> (&'static str, Option<i64>) {
    match outcome {
        StepOutcome::Advance => ("advance", None),
        StepOutcome::Halted => ("halted", None),
        StepOutcome::WaitingForInput => ("waiting", None),
        StepOutcome::Sleeping(_) => ("sleeping", None),
        StepOutcome::Exited(code) => ("exited", Some(*code)),
    }
}


/// WASM-exposed emulator wrapping the core CPU.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub struct Emulator {
    cpu: Cpu,
    /// Flat `[addr, line, addr, line, ...]` authoritative address ->
    /// editor-source-line map from the most recent hosted assemble.
    /// Empty for the legacy bare-metal path and after a failed assemble;
    /// the web layer treats an empty map as "fall back to the source-text
    /// line-count heuristic". Stored on the wrapper rather than on `cpu`
    /// to keep the cpu module focused on execution state.
    line_map: Vec<u32>,
}

/// Flatten the linker's `(addr, line)` pairs into the flat `[addr, line,
/// ...]` array the TS boundary consumes. Every cpsc 355 address fits in
/// u32 (the host-stub range tops out at `0xFFFF_FFFF`), matching the
/// `take_dirty_addrs` convention.
#[cfg(target_arch = "wasm32")]
fn flatten_line_map(pairs: &[(u64, u32)]) -> Vec<u32> {
    let mut out = Vec::with_capacity(pairs.len() * 2);
    for (addr, line) in pairs {
        out.push(*addr as u32);
        out.push(*line);
    }
    out
}

#[cfg(target_arch = "wasm32")]
#[derive(Serialize)]
struct StepResultJs {
    pc: u64,
    halted: bool,
    error: Option<String>,
    /// Editor line of the instruction the error names, when the line map
    /// can resolve it. None when there is no error or no mapping.
    error_line: Option<u32>,
    /// "advance" | "halted" | "waiting" | "sleeping" | "exited"
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
    /// Editor line of the instruction the error names (see StepResultJs).
    error_line: Option<u32>,
    /// Milliseconds the program's last nanosleep asked to pause, when the
    /// run stopped for one. A real-time runner waits this out then calls
    /// run again; a batch runner just calls run again immediately.
    sleep_ms: Option<f64>,
}

#[cfg(target_arch = "wasm32")]
#[derive(Serialize)]
struct LintWarningJs {
    line: usize,
    message: String,
}

#[cfg(target_arch = "wasm32")]
#[derive(Serialize)]
struct M4ResultJs {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_line: Option<u32>,
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
struct HostCallJs {
    name: String,
    call_site_pc: u32,
    call_site_line: Option<u32>,
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
        Self { cpu: Cpu::new(), line_map: Vec::new() }
    }

    /// Assemble source text and load the resulting program. Sources that
    /// reach for hosted features (`.text`/`.data`/`.bss`/`.rodata`, or
    /// `.global main`, or any `bl <libc>`) go through the section-aware
    /// pipeline; everything else keeps the legacy single-`.text` path so
    /// the bare-metal examples retain their exact byte-for-byte layout.
    pub fn assemble_and_load(&mut self, source: &str) -> JsValue {
        // Each assemble replaces the line map; clear it up front so a
        // failed assemble or the bare-metal path leaves it empty and the
        // web layer falls back to the legacy line-count heuristic.
        self.line_map.clear();
        if detect_hosted_mode(source) {
            self.cpu.reset();
            match frontend::pipeline::assemble_hosted(source, &self.cpu.host) {
                Ok(image) => {
                    let count = image.instruction_count;
                    self.line_map = flatten_line_map(&image.line_map);
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
    /// sees the supplied arguments. `args` is argv[1..]: the loader
    /// owns argv[0] (`./program`), so no caller prepends a program
    /// name. Bare-metal sources (no hosted features) ignore args:
    /// argc/argv only have meaning for hosted programs that read them
    /// through w0/x1.
    pub fn assemble_and_load_with_args(
        &mut self,
        source: &str,
        args: Vec<String>,
    ) -> JsValue {
        // Clear the map up front for the same reason as assemble_and_load.
        self.line_map.clear();
        if detect_hosted_mode(source) {
            self.cpu.reset();
            let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
            match frontend::pipeline::assemble_hosted(source, &self.cpu.host) {
                Ok(image) => {
                    let count = image.instruction_count;
                    self.line_map = flatten_line_map(&image.line_map);
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
            // Bare-metal path: args have no caller, just delegate.
            self.assemble_and_load(source)
        }
    }

    /// Resolve the editor line for a runtime stop. The calm-halt boundary
    /// leaves PC on the faulting instruction; a fault raised inside a host
    /// stub (printf, scanf, a syscall helper) reports the CALL site instead,
    /// recovered from LR-4, because stub addresses are synthetic and never
    /// appear in the line map.
    fn error_line_for(&self, pc: u64) -> Option<u32> {
        // The fell-off-the-end halt stops one word past the image; point
        // the marker at the LAST mapped instruction line, the place the
        // missing ret belongs.
        if self.cpu.text_end() == Some(pc) {
            return self.line_map.chunks_exact(2).last().map(|pair| pair[1]);
        }
        let lookup = if self.cpu.host.contains_address(pc) {
            self.cpu.regs.read_gpr(30, true).wrapping_sub(4)
        } else {
            pc
        };
        let target = lookup as u32;
        self.line_map
            .chunks_exact(2)
            .find(|pair| pair[0] == target)
            .map(|pair| pair[1])
    }

    /// Execute one instruction.
    pub fn step(&mut self) -> JsValue {
        match self.cpu.step() {
            Ok(result) => {
                let (outcome, exit_code) = outcome_to_js(&result.outcome);
                let error_line = result
                    .error
                    .as_ref()
                    .and_then(|_| self.error_line_for(result.pc));
                serde_wasm_bindgen::to_value(&StepResultJs {
                    pc: result.pc,
                    halted: result.halted,
                    error: result.error,
                    error_line,
                    outcome,
                    exit_code,
                })
                .unwrap()
            }
            Err(e) => serde_wasm_bindgen::to_value(&StepResultJs {
                pc: self.cpu.regs.read_pc(),
                halted: true,
                error: Some(e.to_string()),
                error_line: self.error_line_for(self.cpu.regs.read_pc()),
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
            error_line: None,
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
            Ok(result) => {
                let error_line = result
                    .error
                    .as_ref()
                    .and_then(|_| self.error_line_for(result.pc));
                let sleep_ms = self
                    .cpu
                    .take_pending_sleep_ns()
                    .map(|ns| ns as f64 / 1_000_000.0);
                serde_wasm_bindgen::to_value(&RunResultJs {
                    pc: result.pc,
                    halted: result.halted,
                    steps_executed: result.steps_executed,
                    hit_breakpoint: result.hit_breakpoint,
                    error: result.error,
                    error_line,
                    sleep_ms,
                }).unwrap()
            }
            Err(e) => serde_wasm_bindgen::to_value(&RunResultJs {
                pc: self.cpu.regs.read_pc(),
                halted: true,
                steps_executed: 0,
                hit_breakpoint: false,
                error: Some(e.to_string()),
                error_line: self.error_line_for(self.cpu.regs.read_pc()),
                sleep_ms: None,
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

    /// Read a range of memory as a byte array. Unmapped bytes read as
    /// zero; a length past the whole page budget returns empty (the only
    /// error `read_bytes` produces).
    pub fn get_memory_range(&self, addr: u32, len: u32) -> Vec<u8> {
        self.cpu.mem
            .read_bytes(addr as u64, len as usize)
            .unwrap_or_default()
    }

    /// Whether every page in `[addr, addr + len)` is mapped. The watch
    /// panel needs this to tell "reads as zero" from "was never mapped":
    /// `get_memory_range` deliberately zero-fills unmapped bytes for the
    /// hex dump, so the bytes alone cannot express a fault.
    pub fn is_range_mapped(&self, addr: u32, len: u32) -> bool {
        if len == 0 {
            return self.cpu.mem.is_mapped(addr as u64);
        }
        let start = addr as u64;
        let end = start + (len as u64) - 1;
        let mut page = start & !0xFFF;
        while page <= end {
            if !self.cpu.mem.is_mapped(page) {
                return false;
            }
            page += 0x1000;
        }
        true
    }

    /// Indices of registers that changed during the last step (0-31, where 31=SP).
    pub fn get_changed_registers(&self) -> Vec<u8> {
        self.cpu.changed_registers().to_vec()
    }

    /// The 32 FP registers (d0-d31) as raw IEEE-754 bit patterns, hex-encoded
    /// ("0x..."), so the UI can render both the decimal double and the raw bits
    /// without a lossy float round-trip at the boundary.
    pub fn get_fp_registers(&self) -> Vec<String> {
        (0..32)
            .map(|i| format!("0x{:016x}", self.cpu.regs.read_fpr_bits(i)))
            .collect()
    }

    /// Indices of FP registers (0-31 for d0-d31) that changed during the last step.
    pub fn get_changed_fp_registers(&self) -> Vec<u8> {
        self.cpu.changed_fp_registers().to_vec()
    }

    /// Pre-assembly structural lint: advisory warnings, each with a line
    /// and a one-line remedy. Never blocks assembling; serialized as
    /// `[{ line, message }, ...]`.
    pub fn lint_source(&self, source: &str) -> JsValue {
        let warnings: Vec<LintWarningJs> = frontend::lint::lint(source)
            .into_iter()
            .map(|w| LintWarningJs { line: w.line, message: w.message })
            .collect();
        serde_wasm_bindgen::to_value(&warnings).unwrap()
    }

    /// Run the m4 pass alone over a source file, exactly as `assemble_and_load`
    /// would before lexing: block comments blanked, `define()` aliases
    /// substituted (their lines left blank so line numbers hold), `name = expr`
    /// assignments kept inline. Powers the terminal's `m4 file.asm > file.s`
    /// step so the course toolchain replays one command at a time. Returns
    /// `{ success, text?, error?, error_line? }`.
    pub fn m4_expand(&self, source: &str) -> JsValue {
        match frontend::m4::expand(source) {
            Ok(expanded) => serde_wasm_bindgen::to_value(&M4ResultJs {
                success: true,
                text: Some(expanded.text),
                error: None,
                error_line: None,
            })
            .unwrap(),
            Err(err) => {
                let (message, line) = match &err {
                    errors::EmuError::PreprocError { line, message } => {
                        (message.clone(), Some(*line as u32))
                    }
                    other => (other.to_string(), None),
                };
                serde_wasm_bindgen::to_value(&M4ResultJs {
                    success: false,
                    text: None,
                    error: Some(message),
                    error_line: line,
                })
                .unwrap()
            }
        }
    }

    /// The wasm boundary carries addresses as u32: every reachable band
    /// sits below 4 GiB, and JS numbers hand u32 across losslessly where
    /// u64 would arrive as BigInt.
    pub fn set_breakpoint(&mut self, address: u32) {
        self.cpu.set_breakpoint(address as u64);
    }

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

    /// Flat `[addr, line, addr, line, ...]` authoritative address ->
    /// editor-source-line map from the most recent hosted assemble. The
    /// worker threads this to the hook, which keys the current-line
    /// marker, the disassembly text, and breakpoint placement off it
    /// instead of counting source-text lines. Empty for the legacy
    /// bare-metal path; the web layer falls back to the source-text
    /// heuristic when it is empty.
    pub fn get_line_map(&self) -> Vec<u32> {
        self.line_map.clone()
    }

    /// The external call the pc currently sits inside as
    /// `{ name, call_site_pc, call_site_line }`, or JS `null` when the pc is
    /// an instruction the program holds. Answers for each of the three steps
    /// a hosted call takes and for a `scanf` parked waiting on input, always
    /// naming the call site the `bl` came from, so the stepping UI can say
    /// "printf runs inside the runtime" instead of showing a synthetic
    /// address with no source line. Reads state only.
    #[wasm_bindgen(js_name = hostCallContext)]
    pub fn host_call_context(&self) -> JsValue {
        match host_call_context(&self.cpu, &self.line_map) {
            Some(ctx) => serde_wasm_bindgen::to_value(&HostCallJs {
                name: ctx.name,
                call_site_pc: ctx.call_site_pc as u32,
                call_site_line: ctx.call_site_line,
            })
            .unwrap(),
            None => JsValue::NULL,
        }
    }

    // -- hosted runtime --

    /// Drain accumulated stdout as a UTF-8 string.
    pub fn take_stdout(&mut self) -> String {
        String::from_utf8_lossy(&self.cpu.take_stdout()).into_owned()
    }

    /// Drain accumulated stderr as a UTF-8 string.
    pub fn take_stderr(&mut self) -> String {
        String::from_utf8_lossy(&self.cpu.take_stderr()).into_owned()
    }

    /// Push bytes onto the stdin buffer. Clears the blocked flag so a
    /// paused read/scanf resumes on the next step. Nothing is echoed:
    /// this is the redirect path (fixtures, scripted terminal drives, the
    /// exercise checker), and a redirect prints nothing.
    pub fn push_stdin(&mut self, s: &str) {
        self.cpu.push_stdin(s.as_bytes());
    }

    /// Push a line the student typed at a prompt. Same queue as
    /// `push_stdin`, but the first read that touches the line echoes it to
    /// stdout, so the console transcript reads "Enter score 1: 10" like a
    /// cooked-mode terminal, instead of hiding the answer. A program in
    /// raw mode echoes nothing: it owns its own screen.
    pub fn push_stdin_interactive(&mut self, s: &str) {
        self.cpu.push_stdin_interactive(s.as_bytes());
    }

    /// Bytes ever written to stdout, echoed input included. Step-back and
    /// a named restore roll this back to the frame's value, so the host
    /// can unprint what an undone step wrote. Returned as an f64 rather
    /// than a u64 to stay a JS number instead of a BigInt; the output wall
    /// caps the total near 8 MiB, far under 2^53.
    pub fn stdout_seen(&self) -> f64 {
        self.cpu.stdout_seen() as f64
    }

    /// Bytes ever written to stderr. See `stdout_seen`.
    pub fn stderr_seen(&self) -> f64 {
        self.cpu.stderr_seen() as f64
    }

    /// Remove every breakpoint. The UI calls this when a different
    /// program loads or the source is re-assembled, then re-arms the
    /// surviving gutter lines through the fresh line map: the CPU's
    /// address set otherwise outlives the assembly it belonged to.
    pub fn clear_all_breakpoints(&mut self) {
        self.cpu.clear_all_breakpoints();
    }

    /// Signal end-of-input (ctrl-d / a fully-queued `< file` redirect):
    /// getchar answers -1, read answers 0, scanf answers its matched
    /// count or -1, so read-until-EOF loops can terminate.
    pub fn close_stdin(&mut self) {
        self.cpu.close_stdin();
    }

    /// Pause or resume the step-back snapshot ring. The terminal pane's
    /// foreground drive pauses it for live sessions: the per-step clone
    /// costs far more than the step, and stepping back into the middle
    /// of a live session has no meaning. Cleared by load and reset.
    pub fn set_snapshots_paused(&mut self, paused: bool) {
        self.cpu.snapshots_paused = paused;
    }

    /// True once the running program has put the terminal in raw mode
    /// (ioctl TCSETS clearing ICANON/ECHO): the UI treats it as a
    /// terminal program and hands it the terminal pane.
    pub fn wants_terminal(&self) -> bool {
        self.cpu.term.raw_mode
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
    /// Returns false when the upload would breach a VFS wall (per-file,
    /// whole-VFS, or file count); the web guards use matching caps.
    pub fn upload_vfs_file(&mut self, path: &str, data: &[u8]) -> bool {
        self.cpu
            .upload_vfs_file(path.to_string(), data.to_vec())
    }

    /// Names of every file currently in the virtual filesystem.
    pub fn list_vfs_files(&self) -> Vec<String> {
        let mut names: Vec<String> = self.cpu.vfs.keys().cloned().collect();
        names.sort();
        names
    }

    /// Read a VFS file's bytes. Returns an empty array when the path is
    /// absent so the JS side can distinguish "missing" from "empty file"
    /// via `list_vfs_files()` if it cares.
    pub fn read_vfs_file(&self, path: &str) -> Vec<u8> {
        self.cpu.vfs.get(path).cloned().unwrap_or_default()
    }

    /// Remove a VFS file. Returns `true` when an entry actually went
    /// away. No-ops if the path was never registered.
    pub fn delete_vfs_file(&mut self, path: &str) -> bool {
        self.cpu.vfs.remove(path).is_some()
    }

    /// Resolve a label name to its absolute address. Powers
    /// `gdb b <label>` in the terminal pane. Returns the address as a
    /// `u64` (`None` -> JS `undefined`).
    pub fn resolve_label(&self, name: &str) -> Option<u64> {
        self.cpu.resolve_label(name)
    }

    /// Drain the dirty-write buffer (per-write `(addr, len)` ranges)
    /// accumulated since the last call. JS uses these to highlight
    /// changed memory cells during replay scrubbing. Returned as a
    /// flat `Vec<u32>` of `[addr, len, addr, len, ...]`. Every cpsc
    /// 355 address fits in u32 (max is `0xFFFF_FFFF` for the host
    /// stub range) so the high half isn't carried.
    pub fn take_dirty_addrs(&mut self) -> Vec<u32> {
        let mut out = Vec::new();
        for (addr, len) in self.cpu.mem.take_dirty() {
            out.push(addr as u32);
            out.push(len as u32);
        }
        out
    }

    /// Clear stdout/stderr scrollback without resetting CPU state.
    pub fn clear_console(&mut self) {
        self.cpu.clear_console();
    }
}

#[cfg(test)]
mod memory_map_tests {
    use super::{memory_map, MemoryRegionJs};
    use crate::argv::{ARGV_BASE, ARGV_MAX_BYTES};
    use crate::cpu::{
        BSS_BASE, CODE_BASE, DATA_BASE, HOST_STUB_BASE, HOST_STUB_COUNT, HOST_STUB_STRIDE,
        RODATA_BASE, SECTION_WINDOW, STACK_BASE, STACK_FLOOR,
    };
    use crate::hosted::heap::{HEAP_BASE, HEAP_LIMIT};

    fn row<'a>(rows: &'a [MemoryRegionJs], name: &str) -> &'a MemoryRegionJs {
        rows.iter()
            .find(|region| region.name == name)
            .unwrap_or_else(|| panic!("the map has a `{name}` row"))
    }

    #[test]
    fn section_rows_span_their_window_from_the_loader_bases() {
        let rows = memory_map();
        for (name, base) in [
            (".text", CODE_BASE),
            (".rodata", RODATA_BASE),
            (".data", DATA_BASE),
            (".bss", BSS_BASE),
        ] {
            let region = row(&rows, name);
            assert_eq!(region.start, base as u32, "{name} starts at its loader base");
            assert_eq!(
                region.end,
                (base + SECTION_WINDOW) as u32,
                "{name} ends one section window later",
            );
        }
    }

    #[test]
    fn runtime_rows_span_their_owning_constants() {
        let rows = memory_map();

        let argv = row(&rows, "argv");
        assert_eq!(argv.start, ARGV_BASE as u32);
        assert_eq!(argv.end, (ARGV_BASE + ARGV_MAX_BYTES as u64) as u32);

        // The heap row is the whole malloc window, not the live frontier.
        let heap = row(&rows, "heap");
        assert_eq!(heap.start, HEAP_BASE as u32);
        assert_eq!(heap.end, HEAP_LIMIT as u32);

        // The stack grows down from the base toward the floor, so the row
        // reads low-to-high like every other.
        let stack = row(&rows, "stack");
        assert_eq!(stack.start, STACK_FLOOR as u32);
        assert_eq!(stack.end, STACK_BASE as u32);

        // The stub row is the table's capacity, not the registered count:
        // registering another stub must not move the band.
        let stubs = row(&rows, "host stubs");
        assert_eq!(stubs.start, HOST_STUB_BASE as u32);
        assert_eq!(
            stubs.end,
            (HOST_STUB_BASE + HOST_STUB_COUNT * HOST_STUB_STRIDE) as u32,
        );
    }

    #[test]
    fn rows_are_in_address_order_and_never_overlap() {
        let rows = memory_map();
        let names: Vec<&str> = rows.iter().map(|region| region.name).collect();
        assert_eq!(
            names,
            vec![".text", ".rodata", ".data", ".bss", "argv", "heap", "stack", "host stubs"],
            "the map is emitted in address order",
        );
        for pair in rows.windows(2) {
            assert!(
                pair[0].end <= pair[1].start,
                "`{}` (ends {:#x}) must not reach into `{}` (starts {:#x})",
                pair[0].name,
                pair[0].end,
                pair[1].name,
                pair[1].start,
            );
        }
        for region in &rows {
            assert!(
                region.start < region.end,
                "`{}` spans at least one byte",
                region.name,
            );
        }
    }
}

#[cfg(test)]
mod hosted_mode_tests {
    use super::detect_hosted_mode;

    #[test]
    fn detects_hosted_via_section_directive() {
        assert!(detect_hosted_mode(".text\nmain:\n  mov x0, 1\n"));
        assert!(detect_hosted_mode(".data\nmsg: .word 0\n"));
        assert!(detect_hosted_mode(".bss\nbuf: .skip 16\n"));
        assert!(detect_hosted_mode(".rodata\nfmt: .string \"hi\"\n"));
    }

    #[test]
    fn detects_hosted_via_global_main() {
        assert!(detect_hosted_mode(".global main\nmain: mov x0, 0\n"));
        assert!(detect_hosted_mode(".globl main\nmain: mov x0, 0\n"));
    }

    #[test]
    fn detects_hosted_via_libc_call() {
        assert!(detect_hosted_mode("main: bl printf\n"));
        assert!(detect_hosted_mode("main: BL exit\n"));
        assert!(detect_hosted_mode("main: bl strlen\n"));
        assert!(detect_hosted_mode("main: bl atoi\n"));
        assert!(detect_hosted_mode("main: bl srand\n"));
        assert!(detect_hosted_mode("main: bl rand\n"));
        // multiple spaces / tabs between bl and the name still detect.
        assert!(detect_hosted_mode("main:\n    bl   printf\n"));
        assert!(detect_hosted_mode("main:\n\tbl\tputs\n"));
    }

    #[test]
    fn detects_hosted_via_m4_define() {
        assert!(detect_hosted_mode("define(REG, w19)\nmov REG, 1\n"));
    }

    #[test]
    fn bare_metal_program_is_not_hosted() {
        // Five classics should all stay on the legacy path.
        let factorial = "mov x0, 5\nmov x1, 1\nloop: mul x1, x1, x0\nsubs x0, x0, 1\nb.ne loop\nsvc 0\n";
        assert!(!detect_hosted_mode(factorial));
    }

    #[test]
    fn fragments_in_comments_do_not_trigger() {
        // The comment mentions .data but the program is bare-metal.
        let src = "// uses .data section in some other example\nmov x0, 1\nsvc 0\n";
        assert!(!detect_hosted_mode(src));
        let semi = "mov x0, 1 ; .global main is unrelated here\nsvc 0\n";
        assert!(!detect_hosted_mode(semi));
    }

    #[test]
    fn every_registered_stub_is_detected_as_hosted() {
        // A stub registered in `Cpu::new` but missing here leaves
        // `bl <name>` on the bare-metal path, where the call resolves to
        // nothing. The table is the source of truth; the two sentinels are
        // not names a program can call.
        let cpu = crate::cpu::Cpu::new();
        let missing: Vec<String> = cpu
            .host
            .names()
            .filter(|name| !matches!(*name, "__host_noop" | "__main_return"))
            .filter(|name| !super::HOSTED_LIBC_NAMES.contains(name))
            .map(str::to_string)
            .collect();
        assert!(
            missing.is_empty(),
            "these stubs are registered but not in HOSTED_LIBC_NAMES: {missing:?}"
        );
        // And each listed name really does route a `bl` to the hosted
        // pipeline, rather than only sitting in the list.
        for name in super::HOSTED_LIBC_NAMES {
            assert!(
                detect_hosted_mode(&format!("main:\n    bl {name}\n    ret\n")),
                "`bl {name}` must detect as hosted"
            );
        }
    }

    #[test]
    fn detection_covers_every_directive_the_parser_knows() {
        // Detection derives from the parser's table, so a directive the
        // parser understands routes to the hosted path even when it is the
        // only one in the file. These four are the ones a hand-kept list
        // beside the parser is most likely to miss; each case below carries
        // no other directive, so it is the named one doing the work.
        assert!(detect_hosted_mode(".section .rodata\n"));
        assert!(detect_hosted_mode("table: .dword 1, 2, 3\n"));
        assert!(detect_hosted_mode(".type main, %function\n"));
        assert!(detect_hosted_mode(".size main, 4\n"));
        // And the whole table, so a directive added later cannot be
        // recognized by the parser and missed by detection.
        for directive in crate::frontend::parser::DIRECTIVES {
            assert!(
                detect_hosted_mode(&format!("{directive} 1\n")),
                "`{directive}` must detect as hosted"
            );
        }
    }

    #[test]
    fn a_bare_metal_program_still_takes_the_legacy_path() {
        // The widening must not swallow the directive-free programs the
        // legacy single-.text path exists for.
        assert!(!detect_hosted_mode("main:\n    mov x0, 1\n    ret\n"));
        assert!(!detect_hosted_mode("loop:\n    add x0, x0, 1\n    b loop\n"));
    }

    #[test]
    fn fragment_in_string_literal_still_triggers_via_directive() {
        // A `.string ".text"` line still has the literal `.string`
        // directive so detection fires on the directive itself, which
        // is the desired behavior (any program with a string literal
        // is using the hosted pipeline).
        assert!(detect_hosted_mode(".rodata\nmsg: .string \".text\"\n"));
    }
}
