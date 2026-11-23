//! gdb's next and step on a program built with -g: `Cpu::run_until` with a
//! line range. Each range is the run of addresses around the pc that the
//! line map gives one editor line, as the web hub works it out. The stops
//! are gdb-multiarch's against qemu-aarch64 on the same program, built with
//! `gcc -g` (addresses as main+N and add2+N; GAS lays it out the same way).

use aarch64_emulator::cpu::{Cpu, RunResult, Until};
use aarch64_emulator::frontend::pipeline::assemble_hosted;
use aarch64_emulator::hosted::MAIN_RETURN_ADDR;

/// A call to a local function, a call to printf, a loop, and one m4 line
/// that becomes two instructions (line 31). add2 is lines 16 to 20, main is
/// lines 24 to 42.
const STEPS: &str = r#"// Small program for gdb's next and step: straight-line code, a call to a
// local function, a call to printf, a loop, and one m4 line that becomes
// two instructions.
define(fp, x29)
define(lr, x30)
define(sum_r, w19)
define(i_r, w20)
define(clear2, `mov     w21, 0
        mov     w22, 0')

        .data
fmt:    .string "sum %d\n"

        .text
        .balign 4
add2:   stp     fp, lr, [sp, -16]!
        mov     fp, sp
        add     w0, w0, w1
        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:   stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     sum_r, 0
        mov     w0, 3
        mov     w1, 4
        bl      add2
        mov     sum_r, w0
        clear2
        mov     i_r, 0
loop:   add     sum_r, sum_r, i_r
        add     i_r, i_r, 1
        cmp     i_r, 3
        b.lt    loop
        ldr     x0, =fmt
        mov     w1, sum_r
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

/// `ldr reg, label` loads the word at the label: GAS's one LDR (literal) is
/// two words here, both on line 14.
const LOAD_BY_LABEL: &str = r#"// Loads a word by its label on one line.
define(fp, x29)
define(lr, x30)
define(limit_r, w19)

        .data
limit_m:    .word 3

        .text
        .balign 4
        .global main
main:   stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     limit_r, limit_m
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

struct Program {
    cpu: Cpu,
    lines: Vec<(u64, u32)>,
}

impl Program {
    fn load(src: &str) -> Self {
        let mut cpu = Cpu::new();
        let image = assemble_hosted(src, &cpu.host).expect("assembles");
        cpu.load_linked_image(&image).expect("loads");
        Program { cpu, lines: image.line_map }
    }

    fn label(&self, name: &str) -> u64 {
        self.cpu.resolve_label(name).expect("label exists")
    }

    fn pc(&self) -> u64 {
        self.cpu.regs.read_pc()
    }

    fn line_of(&self, pc: u64) -> Option<u32> {
        self.lines.iter().find(|&&(addr, _)| addr == pc).map(|&(_, line)| line)
    }

    /// The pc's editor line as [first, past the last instruction); one
    /// word for a pc no line holds.
    fn range(&self) -> (u64, u64) {
        let pc = self.pc();
        let Some(line) = self.line_of(pc) else { return (pc, pc + 4) };
        let (mut lo, mut hi) = (pc, pc + 4);
        while lo >= 4 && self.line_of(lo - 4) == Some(line) {
            lo -= 4;
        }
        while self.line_of(hi) == Some(line) {
            hi += 4;
        }
        (lo, hi)
    }

    fn depth(&self) -> u64 {
        self.cpu.call_stack().depth()
    }

    /// Single steps to `pc` the first time it comes up.
    fn step_to(&mut self, pc: u64) {
        for _ in 0..10_000 {
            if self.pc() == pc {
                return;
            }
            self.cpu.step().expect("steps");
        }
        panic!("never reached {pc:#x}");
    }

    /// gdb's next: off this line at this depth or shallower.
    fn next(&mut self) -> RunResult {
        let goal = Until { depth: Some(self.depth()), pc: None, range: Some(self.range()) };
        self.cpu.run_until(1_000_000, goal).expect("runs")
    }

    /// gdb's step: off this line at any depth.
    fn step(&mut self) -> RunResult {
        let goal = Until { depth: None, pc: None, range: Some(self.range()) };
        self.cpu.run_until(1_000_000, goal).expect("runs")
    }
}

#[test]
fn next_runs_a_local_call_and_stops_on_the_line_after_it() {
    let mut p = Program::load(STEPS);
    let main = p.label("main");
    p.step_to(main + 20);
    let r = p.next();
    assert!(r.reached && !r.hit_breakpoint && !r.halted, "{r:?}");
    assert_eq!(r.pc, main + 24);
    assert_eq!(p.line_of(r.pc), Some(30));
    assert_eq!(p.depth(), 1);
    assert_eq!(p.cpu.regs.read_gpr(0, false), 7);
    // The bl and add2's five.
    assert_eq!(r.steps_executed, 6);
}

#[test]
fn step_goes_into_a_local_call_at_its_first_instruction() {
    let mut p = Program::load(STEPS);
    let (main, add2) = (p.label("main"), p.label("add2"));
    p.step_to(main + 20);
    let r = p.step();
    assert!(r.reached, "{r:?}");
    assert_eq!(r.pc, add2);
    assert_eq!(p.line_of(r.pc), Some(16));
    assert_eq!(p.depth(), 2);
    assert_eq!(r.steps_executed, 1);
}

#[test]
fn step_runs_a_library_call_whole() {
    let mut p = Program::load(STEPS);
    let main = p.label("main");
    p.step_to(main + 64);
    let r = p.step();
    assert!(r.reached, "{r:?}");
    assert_eq!(r.pc, main + 68);
    assert_eq!(p.line_of(r.pc), Some(40));
    // The bl, the trampoline's two words and printf's stub.
    assert_eq!(r.steps_executed, 4);
    assert_eq!(p.cpu.take_stdout(), b"sum 10\n");
}

#[test]
fn a_breakpoint_inside_the_callee_stops_next_there() {
    let mut p = Program::load(STEPS);
    let (main, add2) = (p.label("main"), p.label("add2"));
    p.step_to(main + 20);
    p.cpu.set_breakpoint(add2 + 8);
    let r = p.next();
    assert!(r.hit_breakpoint && !r.reached, "{r:?}");
    assert_eq!(r.pc, add2 + 8);
    assert_eq!(p.depth(), 2);
}

#[test]
fn a_breakpoint_on_the_line_next_lands_on_is_a_stop_at_it() {
    let mut p = Program::load(STEPS);
    let main = p.label("main");
    p.step_to(main + 8);
    p.cpu.set_breakpoint(main + 16);
    let r = p.next();
    assert!(r.reached && !r.hit_breakpoint, "{r:?}");
    assert_eq!(r.pc, main + 12);
    let r = p.next();
    assert!(r.hit_breakpoint && !r.reached, "{r:?}");
    assert_eq!(r.pc, main + 16);
    // A breakpoint the pc starts on is the one the next line steps off.
    let r = p.next();
    assert!(r.reached && !r.hit_breakpoint, "{r:?}");
    assert_eq!(r.pc, main + 20);
}

#[test]
fn next_at_mains_ret_stops_at_its_return_and_the_next_one_exits() {
    let mut p = Program::load(STEPS);
    let main = p.label("main");
    p.step_to(main + 76);
    let r = p.next();
    assert!(r.reached && !r.halted, "{r:?}");
    assert_eq!(r.pc, MAIN_RETURN_ADDR);
    assert_eq!(p.depth(), 0);
    let r = p.next();
    assert!(r.halted && !r.reached && r.error.is_none(), "{r:?}");
    assert_eq!(p.cpu.exit_code(), Some(0));
}

#[test]
fn step_at_mains_ret_stops_at_its_return_too() {
    let mut p = Program::load(STEPS);
    let main = p.label("main");
    p.step_to(main + 76);
    let r = p.step();
    assert!(r.reached && !r.halted, "{r:?}");
    assert_eq!(r.pc, MAIN_RETURN_ADDR);
}

#[test]
fn next_at_a_callees_ret_lands_in_the_caller() {
    let mut p = Program::load(STEPS);
    let (main, add2) = (p.label("main"), p.label("add2"));
    p.step_to(add2 + 16);
    let r = p.next();
    assert!(r.reached, "{r:?}");
    assert_eq!(r.pc, main + 24);
    assert_eq!(p.depth(), 1);
}

#[test]
fn next_on_a_taken_back_edge_goes_to_the_loop_top() {
    let mut p = Program::load(STEPS);
    let main = p.label("main");
    p.step_to(main + 52);
    assert_eq!(p.cpu.regs.read_gpr(20, false), 1);
    let r = p.next();
    assert!(r.reached, "{r:?}");
    assert_eq!(r.pc, main + 40);
    assert_eq!(p.line_of(r.pc), Some(33));
    assert_eq!(r.steps_executed, 1);
}

#[test]
fn an_m4_line_of_two_instructions_is_one_next() {
    let mut p = Program::load(STEPS);
    let main = p.label("main");
    p.step_to(main + 24);
    let r = p.next();
    assert_eq!((r.pc, p.line_of(r.pc)), (main + 28, Some(31)));
    let r = p.next();
    assert!(r.reached, "{r:?}");
    assert_eq!((r.pc, p.line_of(r.pc)), (main + 36, Some(32)));
    assert_eq!(r.steps_executed, 2);
}

#[test]
fn an_ldr_by_label_is_one_next() {
    let mut p = Program::load(LOAD_BY_LABEL);
    let main = p.label("main");
    p.step_to(main + 8);
    assert_eq!(p.range(), (main + 8, main + 16));
    let r = p.next();
    assert!(r.reached, "{r:?}");
    assert_eq!((r.pc, p.line_of(r.pc)), (main + 16, Some(15)));
    assert_eq!(r.steps_executed, 2);
    assert_eq!(p.cpu.regs.read_gpr(19, false), 3);
}

#[test]
fn step_over_at_mains_ret_still_runs_to_the_exit() {
    let mut p = Program::load(STEPS);
    let main = p.label("main");
    p.step_to(main + 76);
    let goal = Until { depth: Some(p.depth()), pc: None, range: None };
    let r = p.cpu.run_until(1_000_000, goal).expect("runs");
    assert!(r.halted && !r.reached, "{r:?}");
    assert_eq!(p.cpu.exit_code(), Some(0));
}
