//! The registers each step reports as changed, the sets the register panel
//! flashes: exactly the x registers, sp and v registers whose value differs
//! from before the step, for every way a step writes the register file
//! (integer and 32-bit writes, sp, FP scalars, whole vectors and lanes, a
//! library call's results and leftovers, qsort and bsearch entering the
//! comparator, a system call, a read that waits and then resumes), with the
//! step-back ring recording or paused. Then what a step back, a named restore
//! and a reset leave in the sets, and a step-back round trip over whole
//! programs: each step back puts back the call stack's numbers, the call card
//! and the call context, and stepping forward again reports every step as the
//! first pass did.

use std::fs;
use std::path::Path;

use aarch64_emulator::cpu::{Cpu, StepOutcome, READ_BY_INSTRUCTION};
use aarch64_emulator::frames::layout::{frame_layout, FrameLayout};
use aarch64_emulator::frames::{frame_view, view_numbers};
use aarch64_emulator::frontend::pipeline::{assemble_hosted, LinkedImage};
use aarch64_emulator::{call_card, host_call_context};

struct Prog {
    cpu: Cpu,
    image: LinkedImage,
    layout: FrameLayout,
    line_map: Vec<u32>,
}

fn load(source: &str) -> Prog {
    load_with_args(source, &[])
}

fn load_with_args(source: &str, args: &[&str]) -> Prog {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(source, &cpu.host).unwrap_or_else(|e| panic!("assemble: {e}"));
    cpu.load_linked_image_with_args(&image, args).expect("load");
    let layout = frame_layout(source, &image, &cpu.mem);
    let line_map = image.line_map.iter().flat_map(|(a, l)| [*a as u32, *l]).collect();
    Prog { cpu, image, layout, line_map }
}

/// The two sets a step reported: x0-x30 and sp (31), then v0-v31.
type Sets = (Vec<u8>, Vec<u8>);

/// What the stack frames view, the call card and the call context read.
type Panels = (Vec<f64>, Vec<f64>, Option<(String, u64, Option<u32>)>);

/// Both register files as plain values. Neither read is one the clobber
/// notes track, so taking them between steps changes nothing.
fn registers(cpu: &Cpu) -> ([u64; 32], [u128; 32]) {
    (cpu.regs.snapshot(), std::array::from_fn(|i| cpu.regs.read_fpr_q(i as u8)))
}

fn differing<T: PartialEq>(before: &[T], after: &[T]) -> Vec<u8> {
    (0..before.len()).filter(|&i| before[i] != after[i]).map(|i| i as u8).collect()
}

impl Prog {
    fn label(&self, name: &str) -> u64 {
        self.image.symbols[name]
    }

    fn sets(&self) -> Sets {
        (self.cpu.changed_registers().to_vec(), self.cpu.changed_fp_registers().to_vec())
    }

    fn panels(&self) -> Panels {
        let context = host_call_context(&self.cpu, &self.line_map)
            .map(|c| (c.name, c.call_site_pc, c.call_site_line));
        (view_numbers(&frame_view(&self.cpu, &self.layout)), call_card(&self.cpu), context)
    }

    /// Step once, checking the reported sets against the registers that
    /// really changed, and hand back the sets.
    fn step(&mut self) -> Sets {
        let (gpr, fpr) = registers(&self.cpu);
        self.cpu.step().expect("step");
        let (gpr_after, fpr_after) = registers(&self.cpu);
        let sets = self.sets();
        let pc = self.cpu.regs.read_pc();
        assert_eq!(sets.0, differing(&gpr, &gpr_after), "x and sp set, step {} (pc {pc:#x})", self.cpu.steps_taken());
        assert_eq!(sets.1, differing(&fpr, &fpr_after), "v set, step {} (pc {pc:#x})", self.cpu.steps_taken());
        sets
    }

    /// Step to the end (or `limit` steps), checking every step.
    fn step_all(&mut self, limit: usize) -> usize {
        for n in 0..limit {
            if self.cpu.is_halted() || self.cpu.is_blocked() {
                return n;
            }
            self.step();
        }
        limit
    }
}

/// One instruction for each way a program writes the register file, each
/// with the sets it changes. A write of the value already there is not a
/// change.
const WRITES: &str = r#"
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     x9, 5
        mov     x9, 5
        mov     w10, -1
        sub     sp, sp, 32
        fmov    d0, 1.0
        fmov    d0, 1.0
        fmov    s1, w9
        scvtf   d2, x9
        dup     v3.4s, w9
        ins     v4.s[3], w9
        mov     v5.16b, v3.16b
        str     q3, [sp]
        ldr     q6, [sp]
        add     sp, sp, 32
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
"#;

fn writes_expected() -> Vec<(&'static [u8], &'static [u8])> {
    vec![
        (&[31], &[]),     // stp with writeback: sp only
        (&[29], &[]),     // mov x29, sp
        (&[9], &[]),      // mov x9, 5
        (&[], &[]),       // the same value again
        (&[10], &[]),     // mov w10, -1
        (&[31], &[]),     // sub sp
        (&[], &[0]),      // fmov d0
        (&[], &[]),       // the same value again
        (&[], &[1]),      // fmov s1, w9
        (&[], &[2]),      // scvtf d2
        (&[], &[3]),      // dup: the whole vector
        (&[], &[4]),      // ins: one lane in the high half
        (&[], &[5]),      // mov v5.16b
        (&[], &[]),       // str q3
        (&[], &[6]),      // ldr q6
        (&[31], &[]),     // add sp
        (&[0], &[]),      // mov w0, 0 over argc
        (&[29, 31], &[]), // ldp with writeback: x30 comes back unchanged
        (&[], &[]),       // ret
    ]
}

fn check_writes(paused: bool) {
    let mut p = load(WRITES);
    p.cpu.snapshots_paused = paused;
    for (i, (x, v)) in writes_expected().into_iter().enumerate() {
        assert_eq!(p.step(), (x.to_vec(), v.to_vec()), "instruction {}", i + 1);
    }
    p.step();
    assert_eq!(p.cpu.exit_code(), Some(0));
}

#[test]
fn each_kind_of_register_write_reports_the_registers_it_changed() {
    check_writes(false);
}

#[test]
fn the_sets_are_the_same_with_the_step_back_ring_paused() {
    check_writes(true);
}

#[test]
fn what_the_loader_writes_is_not_the_first_steps_change() {
    let mut p = load_with_args(WRITES, &["one", "two"]);
    assert_eq!(p.cpu.regs.read_gpr(0, true), 3);
    assert_eq!(p.sets(), (vec![], vec![]));
    assert_eq!(p.step(), (vec![31], vec![]));
}

#[test]
fn a_step_back_a_restore_and_a_reset_clear_the_sets_and_a_step_again_reports_the_same() {
    let mut p = load(WRITES);
    for _ in 0..6 {
        p.step();
    }
    assert_eq!(p.step(), (vec![], vec![0]));

    p.cpu.step_back();
    assert_eq!(p.sets(), (vec![], vec![]));
    assert_eq!(p.step(), (vec![], vec![0]));

    p.cpu.step_back();
    p.cpu.step_back();
    assert_eq!(p.sets(), (vec![], vec![]));
    assert_eq!(p.step(), (vec![31], vec![]));
    assert_eq!(p.step(), (vec![], vec![0]));

    p.cpu.save_state("before fmov s1");
    let after_save = (p.step(), p.step(), p.step());
    assert!(p.cpu.load_state("before fmov s1"));
    assert_eq!(p.sets(), (vec![], vec![]));
    assert_eq!((p.step(), p.step(), p.step()), after_save);
    assert_eq!(after_save, ((vec![], vec![]), (vec![], vec![1]), (vec![], vec![2])));

    p.cpu.reset();
    assert_eq!(p.sets(), (vec![], vec![]));
}

/// A library call of each return kind, a read that waits for input, a
/// system call, both comparator calls, and a use of a register a call left.
const LIBRARY: &str = r#"
        .data
num:    .string "42"
fmt:    .string "%d\n"
infmt:  .string "%d"
arr:    .word   3, 1, 2
key:    .word   2
        .bss
n:      .skip   4
buf:    .skip   8
        .text
        .global main
main:   stp     x29, x30, [sp, -16]!
        mov     x29, sp
        ldr     x0, =num
        bl      atoi
        mov     x1, x0
        ldr     x0, =fmt
        bl      printf
after:  add     x9, x9, 1
        fmov    d0, 2.0
        bl      sqrt
        ldr     x0, =infmt
        ldr     x1, =n
        bl      scanf
        mov     x0, 0
        ldr     x1, =buf
        mov     x2, 1
        mov     x8, 63
        svc     0
        ldr     x0, =arr
        mov     x1, 3
        mov     x2, 4
        ldr     x3, =cmp
        bl      qsort
        ldr     x0, =key
        ldr     x1, =arr
        mov     x2, 3
        mov     x3, 4
        ldr     x4, =cmp
        bl      bsearch
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
cmp:    ldr     w0, [x0]
        ldr     w1, [x1]
        sub     w0, w0, w1
        ret
"#;

fn check_library(paused: bool) {
    let mut p = load(LIBRARY);
    p.cpu.snapshots_paused = paused;
    // To the scanf, which finds no input and waits.
    let steps = p.step_all(10_000);
    assert!(p.cpu.is_blocked(), "stopped after {steps} steps without waiting");
    assert_eq!(p.cpu.host_call_name(p.cpu.regs.read_pc()), Some("scanf"));
    assert_eq!(p.step(), (vec![], vec![]));
    p.cpu.push_stdin(b"5\nx");
    // The rest: scanf resumes, the read, qsort and bsearch with their
    // comparator calls, and the return from main.
    p.step_all(10_000);
    assert_eq!(p.cpu.exit_code(), Some(0));
    assert_eq!(p.cpu.stdout, b"42\n");

    // The x9 printf left behind, used at `after`, is noted against its `bl`.
    let after = p.label("after");
    let notes = p.cpu.take_clobber_notes();
    assert_eq!(&notes[..4], &[9, READ_BY_INSTRUCTION, (after - 4) as u32, after as u32]);
}

#[test]
fn library_calls_system_calls_and_callbacks_report_the_registers_they_changed() {
    check_library(false);
}

#[test]
fn library_calls_report_the_same_with_the_step_back_ring_paused() {
    check_library(true);
}

/// Step forward up to the ring's depth, back to the start, and forward again:
/// each step back restores what the panels read before that step and leaves
/// both sets empty, and the second pass reports what the first did.
fn round_trip(source: &str, input: &[u8]) {
    let mut p = load(source);
    p.cpu.push_stdin(input);
    p.cpu.close_stdin();
    let mut seen: Vec<(Sets, Panels)> = vec![(p.sets(), p.panels())];
    for _ in 0..120 {
        if p.cpu.is_halted() {
            break;
        }
        let sets = p.step();
        seen.push((sets, p.panels()));
    }
    let n = seen.len() - 1;
    assert!(n > 20, "only {n} steps");
    for i in (0..n).rev() {
        p.cpu.step_back();
        assert_eq!(p.sets(), (vec![], vec![]), "back to step {i}");
        assert_eq!(p.panels(), seen[i].1, "back to step {i}");
    }
    assert!(!p.cpu.can_step_back());
    for (i, expected) in seen.iter().enumerate().skip(1) {
        let sets = p.step();
        assert_eq!(&(sets, p.panels()), expected, "step {i} again");
    }
}

#[test]
fn a_step_back_round_trip_puts_back_what_the_panels_read() {
    round_trip(LIBRARY, b"5\nx");
    let corpus = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests").join("c-corpus");
    for stem in ["40_funcptr_qsort_like", "51_deep_frames", "15_scanf_io"] {
        let source = fs::read_to_string(corpus.join(format!("{stem}.s"))).unwrap().replace("\r\n", "\n");
        let input = fs::read(corpus.join(format!("{stem}.stdin"))).unwrap_or_default();
        round_trip(&source, &input);
    }
}

/// The first steps of every C corpus program at -O0, with its arguments and
/// input, each step checked against the registers that really changed.
#[test]
fn every_c_corpus_program_reports_exactly_the_registers_each_step_changed() {
    let corpus = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests").join("c-corpus");
    let mut programs = 0;
    let mut steps = 0;
    for entry in fs::read_dir(&corpus).unwrap() {
        let name = entry.unwrap().file_name().into_string().unwrap();
        let Some(stem) = name.strip_suffix(".s").filter(|s| !s.contains('.')) else {
            continue;
        };
        let source = fs::read_to_string(corpus.join(&name)).unwrap().replace("\r\n", "\n");
        let args = fs::read_to_string(corpus.join(format!("{stem}.args"))).unwrap_or_default();
        let args: Vec<&str> = args.split_whitespace().collect();
        let mut p = load_with_args(&source, &args);
        p.cpu.push_stdin(&fs::read(corpus.join(format!("{stem}.stdin"))).unwrap_or_default());
        p.cpu.close_stdin();
        steps += p.step_all(20_000);
        programs += 1;
        assert!(!p.cpu.is_blocked(), "{stem} waits for input");
    }
    assert!(programs >= 101, "found {programs} programs");
    assert!(steps > 500_000, "only {steps} steps");
}

#[test]
fn a_step_that_halts_on_a_fault_leaves_the_sets_as_they_were() {
    let mut p = load(
        r#"
        .text
        .global main
main:   mov     x9, 1
        mov     x0, 0
        ldr     x1, [x0]
        ret
"#,
    );
    assert_eq!(p.step(), (vec![9], vec![]));
    assert_eq!(p.step(), (vec![0], vec![]));
    let r = p.cpu.step().expect("step");
    assert_eq!(r.outcome, StepOutcome::Halted);
    // A halting step leaves the last step's sets in place.
    assert_eq!(p.sets(), (vec![0], vec![]));
}
