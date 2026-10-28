//! The call stack behind the stack frames view, through the crate's public
//! surface: the activations a program is inside, the view a snapshot
//! draws, the static layout that names the slots, and the records of a
//! write over a caller's saved fp or lr and of a return that goes astray.
//! Expected numbers come from the course's slides and from frames worked
//! out by hand, never from the tracker's own arithmetic.
//!
//! Cases: every shipped example and ten C programs against the frame chain
//! at every step; the slides' locals frame and hand-worked padded and
//! recursive frames; Back across a call, a return and a corruption, and a
//! named save; overruns onto the nearest caller's and a grand-caller's
//! saved fp and lr, through an array base and through a passed pointer,
//! with the ring recording, paused, and stopped by its side budget; a
//! callee leaving x19 changed; a call out before lr is saved, and one
//! after lr is saved with no fp set; a qsort comparator; hostile programs (fp into .data, misaligned sp, a bl into a
//! function's middle, a computed blr, a return into a stub, an fp record
//! pointing at itself); the frame check, one program per rule, a function
//! off the pattern, a correct frame, and no mark on any shipped example,
//! exercise reference program or C program at -O0.

#[path = "common/frame_walk.rs"]
mod frame_walk;

use std::path::PathBuf;

use aarch64_emulator::cpu::{Cpu, MAX_SNAPSHOT_SIDE_BYTES};
use aarch64_emulator::frames::check::{check_source, ODD_FRAME, ON_RECORD, OUTSIDE, OVERLAP, UNALIGNED};
use aarch64_emulator::frames::layout::{frame_layout, FrameLayout};
use aarch64_emulator::frames::{
    frame_view, view_numbers, Activation, BadReturn, FrameView, Hit, COMPLETE, ENTERED, LEAF, LR_STORED, LR_UNSAVED,
    MAX_ACTIVATIONS, MAX_DRAWN, RESERVED, RUNTIME_CALL,
};
use aarch64_emulator::frontend::pipeline::{assemble_hosted, LinkedImage};
use frame_walk::{walk, Tally};

fn repo_root() -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.pop();
    p
}

fn read(path: &PathBuf) -> String {
    std::fs::read_to_string(path)
        .unwrap_or_else(|e| panic!("read {}: {e}", path.display()))
        .replace("\r\n", "\n")
}

struct Loaded {
    cpu: Cpu,
    image: LinkedImage,
    layout: FrameLayout,
}

fn load(source: &str) -> Loaded {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(source, &cpu.host).unwrap_or_else(|e| panic!("assemble: {e}"));
    cpu.load_linked_image(&image).expect("load");
    let layout = frame_layout(source, &image, &cpu.mem);
    Loaded { cpu, image, layout }
}

impl Loaded {
    /// The address of the first instruction on 1-based editor `line`.
    fn pc_of(&self, line: u32) -> u64 {
        self.image
            .line_map
            .iter()
            .find(|(_, l)| *l == line)
            .unwrap_or_else(|| panic!("no instruction on line {line}"))
            .0
    }

    /// Run until the instruction on `line` is next.
    fn run_to_line(&mut self, line: u32) {
        let pc = self.pc_of(line);
        self.cpu.set_breakpoint(pc);
        let r = self.cpu.run_until_break(1_000_000).expect("run");
        self.cpu.clear_breakpoint(pc);
        assert_eq!(self.cpu.regs.read_pc(), pc, "stopped at {r:?} instead of line {line}");
    }

    fn view(&self) -> FrameView {
        frame_view(&self.cpu, &self.layout)
    }

    fn name(&self, id: Option<u32>) -> &str {
        id.map_or("", |i| self.layout.names[i as usize].as_str())
    }

    fn mem_u32(&self, at: u64) -> u32 {
        self.cpu.mem.read_u32(at).expect("mapped")
    }

    fn mem_u64(&self, at: u64) -> u64 {
        self.cpu.mem.read_u64(at).expect("mapped")
    }

    fn step(&mut self, n: usize) {
        for _ in 0..n {
            self.cpu.step().expect("step");
        }
    }
}

fn assert_agrees(tally: &Tally) {
    assert_eq!(
        tally.disagree, 0,
        "the frame chain disagreed with the call stack:\n  {}",
        tally.examples.join("\n  ")
    );
    assert!(tally.agree > 0, "no step was checked");
}

// ---------------------------------------------------------------------------
// Agreement with the frame chain at every step
// ---------------------------------------------------------------------------

/// Long-running examples (calc, snake, deadzone) idle in a loop for
/// millions of steps; the first stretch covers every call they make.
const EXAMPLE_STEPS: u64 = 300_000;

/// The helper files of the two multi-file examples, in the order the web
/// pastes them, read from the list the web itself uses.
fn example_files(stem: &str) -> Vec<String> {
    let handoff = read(&repo_root().join("web/lib/playground/playground-handoff.ts"));
    let list = handoff.split("export const EXAMPLE_FILES").nth(1).expect("EXAMPLE_FILES");
    let Some(body) = list.split(&format!("{stem}: [")).nth(1) else { return Vec::new() };
    body.split(']')
        .next()
        .unwrap_or("")
        .split('"')
        .skip(1)
        .step_by(2)
        .map(str::to_string)
        .collect()
}

/// Every shipped example as (stem, source), its helper files joined on.
fn shipped_examples() -> Vec<(String, String)> {
    let dir = repo_root().join("web/public/examples/cpsc355");
    let mut stems: Vec<String> = std::fs::read_dir(&dir)
        .expect("examples")
        .filter_map(|e| e.ok()?.file_name().into_string().ok()?.strip_suffix(".s").map(str::to_string))
        .collect();
    stems.sort();
    assert!(stems.len() >= 27, "examples shrank: {}", stems.len());
    stems
        .into_iter()
        .map(|stem| {
            let mut source = read(&dir.join(format!("{stem}.s")));
            for name in example_files(&stem) {
                source.push_str(&format!("\n// ---- {name} ----\n"));
                source.push_str(&read(&dir.join(&stem).join(&name)));
            }
            (stem, source)
        })
        .collect()
}

#[test]
fn every_shipped_example_agrees_with_the_frame_chain_at_every_step() {
    let dir = repo_root().join("web/public/examples/cpsc355");
    let mut total = Tally::default();
    for (stem, source) in &shipped_examples() {
        let mut cpu = Cpu::new();
        let image = assemble_hosted(source, &cpu.host).unwrap_or_else(|e| panic!("{stem}: {e}"));
        let args_line = std::fs::read_to_string(dir.join("fixtures").join(format!("{stem}.args"))).unwrap_or_default();
        let args: Vec<&str> = args_line.split_whitespace().collect();
        cpu.load_linked_image_with_args(&image, &args).expect("load");
        if let Ok(stdin) = std::fs::read_to_string(dir.join("fixtures").join(format!("{stem}.stdin"))) {
            cpu.push_stdin(stdin.replace("\r\n", "\n").as_bytes());
        }
        total.add(walk(&mut cpu, EXAMPLE_STEPS, stem));
    }
    println!("examples: {total:?}");
    assert_agrees(&total);
}

/// Ten C programs at -O0 covering what course code rarely does: deep and
/// mutual recursion, tail calls written as calls, function pointers,
/// qsort and bsearch running the program's comparators, varargs and big
/// frames. The whole corpus runs weekly (c_corpus.rs).
const C_SUBSET: [&str; 10] = [
    "05_functions",
    "26_deep_recursion",
    "38_varargs",
    "40_funcptr_qsort_like",
    "52_mutual_recursion",
    "54_tail_calls",
    "55_big_frames",
    "80_qsort_bsearch",
    "82_callbacks_generic",
    "83_linked_lists",
];

/// Each program's first steps, which reach every kind of call each makes:
/// to the end, the 6,000-deep recursion in 54_tail_calls alone takes
/// seconds. The weekly test walks every corpus program to its end.
const C_SUBSET_STEPS: u64 = 150_000;

#[test]
fn ten_c_programs_agree_with_the_frame_chain_at_every_step() {
    let dir = repo_root().join("emulator/tests/c-corpus");
    let mut total = Tally::default();
    for stem in C_SUBSET {
        let source = read(&dir.join(format!("{stem}.s")));
        let mut cpu = Cpu::new();
        let image = assemble_hosted(&source, &cpu.host).unwrap_or_else(|e| panic!("{stem}: {e}"));
        cpu.load_linked_image(&image).expect("load");
        if let Ok(stdin) = std::fs::read_to_string(dir.join(format!("{stem}.stdin"))) {
            cpu.push_stdin(stdin.replace("\r\n", "\n").as_bytes());
        }
        cpu.close_stdin();
        let tally = walk(&mut cpu, C_SUBSET_STEPS, stem);
        assert_eq!(cpu.call_stack().bad_return(), BadReturn::default(), "{stem}: a return went astray");
        total.add(tally);
    }
    println!("C subset: {total:?}");
    assert_agrees(&total);
    assert!(total.max_depth > 1000, "the subset reaches deep recursion");
}

// ---------------------------------------------------------------------------
// Frames as the course draws them
// ---------------------------------------------------------------------------

#[test]
fn the_locals_example_has_the_frame_on_the_slides() {
    let mut p = load(&read(&repo_root().join("web/public/examples/cpsc355/locals.s")));
    p.cpu.push_stdin(b"7 4\n");
    p.run_to_line(38); // ldr a_r, [fp, a_s]: scanf has stored both
    let v = p.view();
    assert_eq!(v.frames.len(), 1);
    let main = &v.frames[0];
    let fp = p.cpu.regs.snapshot()[29];
    assert_eq!((main.state, main.record), (COMPLETE, fp));
    // The slides: a 32-byte frame, the saved fp at fp + 0 and the saved lr
    // at fp + 8, a_s = 7 at fp + 16 and b_s = 4 at fp + 20.
    assert_eq!(main.activation.sp_entry - main.lo, 32);
    assert_eq!(p.mem_u64(fp), 0, "main has no caller frame");
    assert_eq!(Some(p.mem_u64(fp + 8)), p.cpu.host.lookup("__main_return"));
    let f = p.layout.function_at(main.activation.entry).expect("main's layout");
    assert_eq!((p.name(f.name), f.frame_bytes), ("main", 32));
    let slots: Vec<(i64, u8, &str)> = f.slots.iter().map(|s| (s.offset, s.width, p.name(s.name))).collect();
    assert_eq!(slots, [(16, 4, "a_s"), (20, 4, "b_s")]);
    assert_eq!((p.mem_u32(fp + 16), p.mem_u32(fp + 20)), (7, 4));
    assert!(v.chain_ok);
}

/// Three locals with padding, worked by hand: a 48-byte frame with count
/// at fp + 16, padding at 20 to 23 so the long starts at a multiple of 8,
/// total at fp + 24, flag at fp + 32, and 12 bytes of padding above it.
const PADDED: &str = r#"
// Keeps a count, a long total and a flag in main's frame, with padding
// before the long so it starts at a multiple of 8.

define(fp, x29)
define(lr, x30)

count_s = 16                            // int count: bytes 16 to 19
total_s = 24                            // long total: bytes 24 to 31
flag_s = 32                             // int flag: bytes 32 to 35
alloc = -(16 + 20) & -16                // 20 bytes of locals, rounded up: -48
dealloc = -alloc

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        mov     w9, 3
        str     w9, [fp, count_s]       // count = 3
        mov     x9, 1000
        str     x9, [fp, total_s]       // total = 1000
        mov     w9, 1
        str     w9, [fp, flag_s]        // flag = 1

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
"#;

#[test]
fn a_padded_frame_matches_the_hand_worked_layout() {
    let mut p = load(PADDED);
    let state = |p: &Loaded| p.view().frames[0].state;
    assert_eq!(state(&p), ENTERED, "nothing pushed at main's first instruction");
    p.step(1);
    assert_eq!(state(&p), RESERVED, "record pushed, fp not set yet");
    p.step(1);
    assert_eq!(state(&p), COMPLETE);
    p.run_to_line(28); // mov w0, 0
    let main = &p.view().frames[0];
    let fp = main.record;
    assert_eq!(main.activation.sp_entry - main.lo, 48);
    let f = p.layout.function_at(main.activation.entry).unwrap();
    let slots: Vec<(i64, u8, &str)> = f.slots.iter().map(|s| (s.offset, s.width, p.name(s.name))).collect();
    assert_eq!(slots, [(16, 4, "count_s"), (24, 8, "total_s"), (32, 4, "flag_s")]);
    assert_eq!(f.frame_bytes, 48);
    assert_eq!((p.mem_u32(fp + 16), p.mem_u64(fp + 24), p.mem_u32(fp + 32)), (3, 1000, 1));
    p.step(2); // mov, ldp: the frame is released and ret comes next
    assert_eq!(state(&p), ENTERED);
}

const RECURSION: &str = r#"
// sum_down(n) adds n + (n - 1) + ... + 1 by calling itself; each call
// keeps its own n in its frame.

define(fp, x29)
define(lr, x30)

n_s = 16                                // int n: bytes 16 to 19
alloc = -(16 + 4) & -16                 // 4 bytes of locals, rounded up: -32
dealloc = -alloc

        .data
fmt_out:    .string "sum = %d\n"

        .text
// sum_down(w0 = n) -> w0 = n + (n - 1) + ... + 1
        .balign 4
        .global sum_down
sum_down:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        str     w0, [fp, n_s]           // this call's n
        cbz     w0, sd_done             // sum_down(0) = 0
        sub     w0, w0, 1
        bl      sum_down                // w0 = sum_down(n - 1)
        ldr     w9, [fp, n_s]           // n is still in this call's frame
        add     w0, w0, w9
sd_done:
        ldp     fp, lr, [sp], dealloc
        ret

// add_one(w0 = x) -> w0 = x + 1
// Leaf function: no frame of its own
        .balign 4
        .global add_one
add_one:
        add     w0, w0, 1
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 4
        bl      sum_down                // w0 = 10
        bl      add_one                 // w0 = 11
        mov     w1, w0
        ldr     x0, =fmt_out
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

/// RECURSION's lines (1-based, the source opens with a blank line).
const SUM_DOWN_RECURSES: u32 = 25;
const SUM_DOWN_DONE: u32 = 29;
const SUM_DOWN_RET: u32 = 30;
const MAIN_CALLS_SUM_DOWN: u32 = 46;
const MAIN_CALLS_ADD_ONE: u32 = 47;

#[test]
fn recursion_four_calls_deep_matches_the_hand_worked_frames() {
    let mut p = load(RECURSION);
    p.run_to_line(SUM_DOWN_DONE); // first reached in the call with n = 0
    let v = p.view();
    assert!(v.chain_ok);
    let main = &v.frames[0];
    assert_eq!(main.activation.sp_entry - main.lo, 16);
    let line_of = |pc: u64| p.image.line_map.iter().find(|(at, _)| *at == pc).map(|(_, l)| *l);
    // main, then sum_down(4), (3), (2), (1), (0): 32 bytes each, n at fp + 16.
    let calls = &v.frames[1..];
    assert_eq!(calls.len(), 5);
    for (k, f) in calls.iter().enumerate() {
        assert_eq!(f.state, COMPLETE);
        assert_eq!(f.activation.sp_entry - f.lo, 32, "sum_down frame {k}");
        assert_eq!(f.record, f.lo, "fp sits at the bottom of the frame");
        assert_eq!(p.mem_u32(f.record + 16), 4 - k as u32, "n in frame {k}");
        let from = if k == 0 { MAIN_CALLS_SUM_DOWN } else { SUM_DOWN_RECURSES };
        assert_eq!(line_of(f.activation.call_pc), Some(from));
        assert_eq!(f.activation.ret_addr, f.activation.call_pc + 4);
    }
    // Each saved fp is the caller's frame record.
    for pair in v.frames.windows(2) {
        assert_eq!(p.mem_u64(pair[1].record), pair[0].record);
    }
    p.run_to_line(MAIN_CALLS_ADD_ONE); // every sum_down has returned
    assert_eq!(p.view().frames.len(), 1);
    p.step(1);
    let v = p.view();
    assert_eq!((v.frames.len(), v.frames[1].state), (2, LEAF));
    assert_eq!(v.frames[0].state, COMPLETE, "main called out with its record in place");
}

// ---------------------------------------------------------------------------
// Back restores the frames exactly
// ---------------------------------------------------------------------------

/// Everything the call stack holds, plus the view drawn from it.
fn whole_state(p: &Loaded) -> (Vec<Activation>, u64, BadReturn, FrameView) {
    let stack = p.cpu.call_stack();
    (stack.activations().to_vec(), stack.uncounted(), stack.bad_return(), p.view())
}

/// Step `steps` forward, then back as many, then forward again: back must
/// land on exactly the frames it left, and the replay on exactly the
/// frames the first pass reached.
fn back_restores(p: &mut Loaded, steps: usize, what: &str) {
    let before = whole_state(p);
    p.step(steps);
    let after = whole_state(p);
    assert_ne!(before, after, "{what}: the steps changed the frames");
    for _ in 0..steps {
        p.cpu.step_back();
    }
    assert_eq!(whole_state(p), before, "{what}: back {steps} restores the frames");
    p.step(steps);
    assert_eq!(whole_state(p), after, "{what}: the same steps again land in the same place");
}

#[test]
fn back_across_a_call_and_a_return_restores_the_frames() {
    let mut p = load(RECURSION);
    p.run_to_line(MAIN_CALLS_SUM_DOWN);
    back_restores(&mut p, 3, "a call");
    p.run_to_line(SUM_DOWN_RET); // the n = 0 call's ret
    back_restores(&mut p, 2, "a return");
    p.run_to_line(MAIN_CALLS_ADD_ONE); // after five returns in a row
    back_restores(&mut p, 1, "a call to a leaf");
}

#[test]
fn a_named_save_restores_the_call_stack() {
    let mut p = load(RECURSION);
    p.run_to_line(SUM_DOWN_DONE);
    let saved = whole_state(&p);
    p.cpu.save_state("deep");
    p.run_to_line(MAIN_CALLS_ADD_ONE);
    assert!(p.cpu.load_state("deep"));
    // The step count is the runaway wall's and survives a restore on
    // purpose; everything the call stack holds comes back.
    let mut restored = whole_state(&p);
    restored.3.step = saved.3.step;
    assert_eq!(restored, saved);
}

// ---------------------------------------------------------------------------
// A write over a caller's saved fp and lr, and the return it breaks
// ---------------------------------------------------------------------------

const OVERFLOW: &str = r#"
// fill_marks writes eight marks into a four-int local array: the last
// four land on main's saved fp and lr.

define(fp, x29)
define(lr, x30)

marks_s = 16                            // int marks[4]: bytes 16 to 31
alloc = -(16 + 16) & -16                // 16 bytes of locals: -32
dealloc = -alloc

        .text
// fill_marks() sets marks[i] = i + 1 for i = 0 to 7 (bug: marks holds 4)
        .balign 4
        .global fill_marks
fill_marks:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        add     x9, fp, marks_s         // x9 = &marks[0]
        mov     w10, 0                  // i = 0
        b       fm_test
fm_loop:
        add     w11, w10, 1
        str     w11, [x9, w10, sxtw 2]  // marks[i] = i + 1
        add     w10, w10, 1
fm_test:
        cmp     w10, 8                  // bug: should be 4
        b.lt    fm_loop
        ldp     fp, lr, [sp], dealloc
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        bl      fill_marks
        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
"#;

const FILL_MARKS_STORE: u32 = 24;
const MAIN_RET: u32 = 40;

#[test]
fn an_overflow_onto_mains_record_is_named_and_explains_the_bad_return() {
    let mut p = load(OVERFLOW);
    let store = p.pc_of(FILL_MARKS_STORE);
    let main_ret = p.pc_of(MAIN_RET);
    // By hand: main's frame record sits where fill_marks's frame ends, so
    // marks[4] and marks[5] (step 12 + 5i: steps 32 and 37) cover the saved
    // fp and marks[6] and marks[7] (steps 42 and 47) the saved lr.
    p.step(36);
    // Back across the write that changes the saved fp a second time.
    back_restores(&mut p, 1, "a corruption");
    let v = p.view();
    let main = &v.frames[0];
    // marks[5] is 36 bytes above fill_marks's fp (marks_s + 5 * 4).
    assert_eq!(main.activation.fp_hit, Hit { step: 37, pc: store, fp_offset: 36 });
    assert_eq!(main.fp_hit_element.map(|(i, n)| (i, p.name(n).to_string())), Some((5, "marks_s".to_string())));
    assert_eq!(main.activation.lr_hit.step, 0, "the saved lr is still intact");
    p.step(10);
    let main = &p.view().frames[0];
    assert_eq!((main.activation.lr_hit.step, main.activation.lr_hit.pc), (47, store));
    assert_eq!(main.lr_hit_element.map(|(i, _)| i), Some(7));
    assert_eq!(p.mem_u64(main.record), 0x6_0000_0005, "marks[5] and marks[4]");
    assert_eq!(p.mem_u64(main.record + 8), 0x8_0000_0007, "marks[7] and marks[6]");
    // fill_marks's own record is intact, so it returns to main; main's ret
    // then takes the overwritten lr.
    p.run_to_line(MAIN_RET);
    assert_eq!(p.view().frames.len(), 1);
    p.step(1);
    let bad = p.cpu.call_stack().bad_return();
    assert_eq!((bad.step, bad.pc, bad.target), (55, main_ret, 0x8_0000_0007));
    assert_eq!(p.view().frames.len(), 1, "a return to no caller leaves the stack as it was");
}

const MEMSET_OVERRUN: &str = r#"
// wipe fills its 16-byte buffer with memset but asks for 48 bytes: the
// last 32 land on main's frame record and the 16 bytes above it.

define(fp, x29)
define(lr, x30)

buf_s = 16                              // char buf[16]: fp + 16 to fp + 31
alloc = -(16 + 16) & -16
dealloc = -alloc

        .text
// wipe() fills buf with 'A' (bug: 48 bytes, not 16)
        .balign 4
        .global wipe
wipe:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        add     x0, fp, buf_s           // x0 = &buf[0]
        mov     w1, 65                  // 'A'
        mov     x2, 48                  // bug: buf holds 16
        bl      memset
        ldp     fp, lr, [sp], dealloc
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        bl      wipe
        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
"#;

const WIPE_BL_MEMSET: u32 = 22;
const MAIN_RET_AFTER_WIPE: u32 = 34;

/// The web shows one step per step, so the tracker stamps its events with
/// that count, not with the step budget, which charges a library call's
/// bulk bytes on top.
#[test]
fn a_library_calls_write_is_stamped_with_the_steps_taken_not_the_budget() {
    let mut p = load(MEMSET_OVERRUN);
    let bl = p.pc_of(WIPE_BL_MEMSET);
    // By hand: steps 1 to 3 enter wipe, 4 to 9 reach its bl memset, 10 and
    // 11 are the call's two trampoline words and 12 is memset itself, which
    // moves 48 bytes: 3 more steps of budget at 16 bytes a step.
    p.step(12);
    assert_eq!(p.cpu.steps_total(), 15, "the budget charges memset's bytes");
    let v = p.view();
    assert_eq!(v.step, 12);
    let main = v.frames[0].activation;
    assert_eq!((main.fp_hit.step, main.fp_hit.pc), (12, bl), "main's saved fp, by the bl");
    assert_eq!((main.lr_hit.step, main.lr_hit.pc), (12, bl), "main's saved lr, by the bl");
    p.cpu.step_back();
    assert_eq!(p.view().step, 11, "Back takes back one step");
    assert_eq!(p.view().frames[0].activation.lr_hit.step, 0);
    // 12 again, 13 and 14 return to main, 15 and 16 load the 'A's, 17 is
    // main's ret.
    p.step(6);
    let main_ret = p.pc_of(MAIN_RET_AFTER_WIPE);
    let bad = p.cpu.call_stack().bad_return();
    assert_eq!((bad.step, bad.pc, bad.target), (17, main_ret, 0x4141_4141_4141_4141));
}

const PASS_ARRAY: &str = r#"
// helper keeps four ints and has fill store i into eight of them: the
// last four land on main's frame record, two records above fill's.

define(fp, x29)
define(lr, x30)

nums_s = 16                             // int nums[4]: fp + 16 to fp + 31
alloc = -(16 + 16) & -16                // 16 bytes of locals: -32
dealloc = -alloc

        .text
// fill(x0 = int *arr, w1 = n) sets arr[i] = i for i = 0 to n - 1
        .balign 4
        .global fill
fill:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w9, 0                   // i = 0
        b       fill_test
fill_loop:
        str     w9, [x0, w9, sxtw 2]    // arr[i] = i
        add     w9, w9, 1
fill_test:
        cmp     w9, w1
        b.lt    fill_loop
        ldp     fp, lr, [sp], 16
        ret

// helper() has fill set its nums (bug: asks for 8, nums holds 4)
        .balign 4
        .global helper
helper:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        add     x0, fp, nums_s          // x0 = &nums[0]
        mov     w1, 8                   // bug: should be 4
        bl      fill
        ldp     fp, lr, [sp], dealloc
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      helper
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

const PA_FILL_STORE: u32 = 22;
const PA_FILL_LDP: u32 = 27;
const PA_MAIN_RET: u32 = 50;

/// By hand, with S main's entry sp: main's record sits at S - 16, helper's
/// at S - 48 with nums at S - 32 to S - 17, and fill's x29 is S - 64.
/// fill's loop stores arr[i] at step 15 + 4i: arr[5] (S - 12, fill's fp +
/// 52) last changes main's saved fp, at step 35, and arr[7] (fp + 60) its
/// saved lr, at step 43. main's ret, step 53, takes 7 << 32 | 6.
fn assert_pass_array_end(p: &Loaded, mode: &str) {
    let store = p.pc_of(PA_FILL_STORE);
    let stack = p.cpu.call_stack();
    let main = stack.activations()[0];
    assert_eq!(main.fp_hit, Hit { step: 35, pc: store, fp_offset: 52 }, "{mode}: main's saved fp");
    assert_eq!(main.lr_hit, Hit { step: 43, pc: store, fp_offset: 60 }, "{mode}: main's saved lr");
    let main_ret = p.pc_of(PA_MAIN_RET);
    let bad = stack.bad_return();
    assert_eq!((bad.step, bad.pc, bad.target), (53, main_ret, 0x7_0000_0006), "{mode}");
    // fill reached nums through a pointer, not through an array base of its
    // own, so no element is named.
    let v = p.view();
    assert_eq!((v.frames[0].fp_hit_element, v.frames[0].lr_hit_element), (None, None), "{mode}");
}

#[test]
fn an_overrun_through_a_passed_pointer_is_caught_on_the_grand_callers_record() {
    let mut p = load(PASS_ARRAY);
    // arr[0] (step 15) starts where helper's record ends and arr[3] (step
    // 27) ends where main's starts: writes between two records touch
    // neither.
    p.step(27);
    let acts = p.cpu.call_stack().activations().to_vec();
    assert_eq!(acts.len(), 3, "main, helper and fill");
    let untouched = |a: &Activation| (a.fp_hit, a.lr_hit) == (Hit::default(), Hit::default());
    assert!(acts.iter().all(untouched), "no false hit: {acts:?}");
    p.step(7);
    back_restores(&mut p, 1, "a write over a grand-caller's saved fp");
    p.run_to_line(PA_FILL_LDP);
    assert!(untouched(&p.cpu.call_stack().activations()[1]), "helper's record is intact");
    // fill and helper return, main's ret goes astray, the fetch faults.
    p.step(8);
    assert!(p.cpu.is_halted() && p.cpu.can_step_back());
    assert_pass_array_end(&p, "stepping");
}

#[test]
fn the_grand_callers_record_is_watched_in_every_mode_the_ring_has() {
    let run = |set_up: fn(&mut Cpu)| {
        let mut p = load(PASS_ARRAY);
        set_up(&mut p.cpu);
        assert!(p.cpu.run_until_break(1000).expect("run").halted);
        p
    };
    let p = run(|_| {});
    assert!(p.cpu.can_step_back(), "the ring recorded the run");
    assert_pass_array_end(&p, "run");
    // The web pauses the ring while the terminal pane drives a program.
    let p = run(|cpu| cpu.snapshots_paused = true);
    assert!(!p.cpu.can_step_back(), "the paused ring recorded nothing");
    assert_pass_array_end(&p, "ring paused");
    // Queued stdin past the side budget stops the ring on its own.
    let p = run(|cpu| cpu.push_stdin(&[b'7'; MAX_SNAPSHOT_SIDE_BYTES + 1]));
    assert!(!p.cpu.can_step_back(), "the ring stopped past the side budget");
    assert_pass_array_end(&p, "side state past the budget");
}

const TWO_RECORDS: &str = r#"
// fill_marks writes twelve marks into a four-int local array: the
// overrun covers helper's frame record, then main's.

define(fp, x29)
define(lr, x30)

marks_s = 16                            // int marks[4]: fp + 16 to fp + 31
alloc = -(16 + 16) & -16                // 16 bytes of locals: -32
dealloc = -alloc

        .text
// fill_marks() sets marks[i] = i for i = 0 to 11 (bug: marks holds 4)
        .balign 4
        .global fill_marks
fill_marks:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        add     x9, fp, marks_s         // x9 = &marks[0]
        mov     w10, 0                  // i = 0
        b       fm_test
fm_loop:
        str     w10, [x9, w10, sxtw 2]  // marks[i] = i
        add     w10, w10, 1
fm_test:
        cmp     w10, 12                 // bug: should be 4
        b.lt    fm_loop
        ldp     fp, lr, [sp], dealloc
        ret

// helper() has fill_marks fill its marks
        .balign 4
        .global helper
helper:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      fill_marks
        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      helper
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

const TR_STORE: u32 = 23;
const TR_HELPER_RET: u32 = 39;

#[test]
fn an_overrun_through_an_array_base_names_the_element_on_each_record_it_crosses() {
    let mut p = load(TWO_RECORDS);
    let store = p.pc_of(TR_STORE);
    assert!(p.cpu.run_until_break(1000).expect("run").halted);
    // By hand, with S main's entry sp: main's record sits at S - 16,
    // helper's at S - 32, and fill_marks's x29 is S - 64 with marks at
    // S - 48. marks[i] is stored at step 14 + 4i, fp + 16 + 4i: marks[4]
    // to [7] cover helper's record, marks[8] to [11] main's. helper's ldp
    // then loads 7 << 32 | 6 into lr and its ret (step 65) goes astray,
    // leaving both frames.
    let v = p.view();
    let [main, helper] = &v.frames[..] else { panic!("{} frames, not main and helper", v.frames.len()) };
    let named = |e: Option<(i64, Option<u32>)>| e.map(|(i, n)| (i, p.name(n).to_string()));
    assert_eq!(helper.activation.fp_hit, Hit { step: 34, pc: store, fp_offset: 36 });
    assert_eq!(named(helper.fp_hit_element), Some((5, "marks_s".to_string())));
    assert_eq!(helper.activation.lr_hit, Hit { step: 42, pc: store, fp_offset: 44 });
    assert_eq!(named(helper.lr_hit_element), Some((7, "marks_s".to_string())));
    assert_eq!(main.activation.fp_hit, Hit { step: 50, pc: store, fp_offset: 52 });
    assert_eq!(named(main.fp_hit_element), Some((9, "marks_s".to_string())));
    assert_eq!(main.activation.lr_hit, Hit { step: 58, pc: store, fp_offset: 60 });
    assert_eq!(named(main.lr_hit_element), Some((11, "marks_s".to_string())));
    let helper_ret = p.pc_of(TR_HELPER_RET);
    assert_eq!((v.bad_return.step, v.bad_return.pc, v.bad_return.target), (65, helper_ret, 0x7_0000_0006));
}

// ---------------------------------------------------------------------------
// Callee-saved registers and an lr that was never saved
// ---------------------------------------------------------------------------

const FORGETFUL: &str = r#"
// bump_count changes x19 and never puts it back; main still trusts x19.

define(fp, x29)
define(lr, x30)
define(count_r, w19)

        .data
fmt_out:    .string "count = %d\n"

        .text
// bump_count() -> w0 = 1 (bug: changes x19 without saving it)
        .balign 4
        .global bump_count
bump_count:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w19, 50                 // bug: x19 belongs to the caller
        mov     w0, 1
        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     count_r, 5              // count = 5
        bl      bump_count
        add     w1, count_r, w0         // count + 1, expected 6
        ldr     x0, =fmt_out
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_callee_that_keeps_x19_changed_is_marked_and_the_callers_read_noted() {
    let mut p = load(FORGETFUL);
    let ret = p.pc_of(21);
    let read = p.pc_of(30);
    p.run_to_line(21);
    assert!(p.view().leftovers.is_empty());
    p.step(1);
    assert_eq!(p.view().leftovers, [(19, ret)], "the quiet mark at bump_count's ret");
    assert!(p.cpu.take_clobber_notes().is_empty(), "nothing has read x19 yet");
    p.step(1);
    // [register, read by an instruction, the ret that left it, the reader]
    assert_eq!(p.cpu.take_clobber_notes(), [19, 0, ret as u32, read as u32]);
    let r = p.cpu.run_until_break(1000).unwrap();
    assert!(r.halted);
    assert_eq!(String::from_utf8_lossy(&p.cpu.take_stdout()), "count = 51\n");
    assert!(p.cpu.take_clobber_notes().is_empty(), "main's own x19 is its to change");
}

const NO_SAVED_LR: &str = r#"
// greet prints a line but never saves lr, so its ret comes back to itself.

define(fp, x29)
define(lr, x30)

        .data
fmt_hi:     .string "hi\n"

        .text
// greet() prints "hi" (bug: calls printf without saving lr)
        .balign 4
        .global greet
greet:
        ldr     x0, =fmt_hi
        bl      printf
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      greet
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_call_out_before_lr_is_saved_is_flagged_and_its_return_goes_astray() {
    let mut p = load(NO_SAVED_LR);
    let ret = p.pc_of(17);
    p.step(200);
    let stack = p.cpu.call_stack();
    let acts = stack.activations();
    assert_eq!(acts.len(), 2, "main and greet, however often greet's ret runs");
    assert_ne!(acts[1].flags & LR_UNSAVED, 0);
    assert_eq!(acts[0].flags & LR_UNSAVED, 0, "main saved lr before its call");
    let bad = stack.bad_return();
    assert_eq!((bad.pc, bad.target), (ret, ret), "the ret jumps to itself");
    // greet's last call is the bl printf on line 16, so it returns to the
    // ret: the 19th number of greet's row, after main's row of 19.
    assert_eq!(acts[1].last_ret, ret);
    assert_eq!(view_numbers(&p.view())[17 + 19 + 18], ret as f64);
}

/// keep saves lr with its stp but never sets fp, and pushes x19 it never
/// pops, so its ldp loads lr from x19's slot.
const LR_SAVED_WITHOUT_FP: &str = r#"
// keep saves fp and lr but never sets fp, and leaves x19 pushed.

define(fp, x29)
define(lr, x30)

        .data
fmt_out:    .string "x19 = %ld\n"

        .text
// keep() prints x19 (bugs: fp is never set, and the push is never popped)
        .balign 4
        .global keep
keep:
        stp     fp, lr, [sp, -16]!
        str     x19, [sp, -16]!         // push x19
        ldr     x0, =fmt_out
        mov     x1, x19
        bl      printf
        ldp     fp, lr, [sp], 16        // bug: x19's 16 bytes are still on top
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x19, 3
        bl      keep
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_call_out_after_lr_is_stored_is_not_flagged_whatever_the_frame_shape() {
    let mut p = load(LR_SAVED_WITHOUT_FP);
    p.run_to_line(15); // keep's stp
    back_restores(&mut p, 1, "a store of lr");
    let keep = p.cpu.call_stack().activations()[1];
    assert_eq!((keep.flags & LR_STORED, keep.flags & LR_UNSAVED), (LR_STORED, 0));
    p.run_to_line(19); // bl printf, with no frame record at fp or sp
    back_restores(&mut p, 1, "a call after lr was stored");
    let keep = p.cpu.call_stack().activations()[1];
    assert_eq!(keep.flags & LR_UNSAVED, 0, "keep stored lr before its call");
    assert_eq!(keep.last_ret, p.pc_of(20));
}

/// twice keeps lr in x9 and calls add_one before it stores lr, so its
/// first ret goes back after that call; the second time through it takes
/// lr back from x9, and that ret pops it.
const LR_IN_A_REGISTER: &str = r#"
// twice calls add_one before saving lr, so its ret comes back into it.

define(fp, x29)
define(lr, x30)

        .text
// add_one(w0 = n) -> w0 = n + 1
        .balign 4
        .global add_one
add_one:
        add     w0, w0, 1
        ret

// twice(w0 = n) -> w0 = n + 1 (bug: lr is kept in x9, not stored, before the call)
        .balign 4
        .global twice
twice:
        mov     x9, lr                  // x9 = the way back to main
        mov     w10, 0                  // times through
        bl      add_one
        add     w10, w10, 1
        cmp     w10, 2
        b.lt    twice_end               // first time: lr is add_one's way back
        mov     lr, x9                  // second time: lr back from x9
twice_end:
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 40
        bl      twice
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_bad_return_keeps_the_call_it_came_from_after_a_later_return_pops_it() {
    let mut p = load(LR_IN_A_REGISTER);
    p.run_to_line(27); // twice's ret, the first time through
    back_restores(&mut p, 1, "a return to no caller");
    let twice = p.cpu.call_stack().activations()[1];
    let bad = p.cpu.call_stack().bad_return();
    assert_eq!((bad.pc, bad.target), (p.pc_of(27), p.pc_of(22)));
    assert_eq!(
        (bad.index, bad.entry, bad.ret_addr, bad.flags, bad.last_ret, bad.lr_hit),
        (1, twice.entry, twice.ret_addr, twice.flags, twice.last_ret, twice.lr_hit)
    );
    assert_eq!((bad.entry, bad.ret_addr, bad.last_ret), (p.pc_of(19), p.pc_of(36), p.pc_of(22)));
    assert_ne!(bad.flags & LR_UNSAVED, 0, "twice called out before storing lr");
    p.run_to_line(27); // the second time through, lr back from x9
    back_restores(&mut p, 1, "the return that pops the call");
    assert_eq!(p.cpu.call_stack().activations().len(), 1);
    assert_eq!(p.cpu.call_stack().bad_return(), bad, "the pop leaves the bad return as it was");
    // The header's last seven numbers are the call, which the web words the
    // card from once the call is gone.
    let n = view_numbers(&p.view());
    let call = [1.0, bad.entry as f64, bad.ret_addr as f64, f64::from(bad.flags), bad.last_ret as f64, 0.0, 0.0];
    assert_eq!(n[10..17], call);
}

#[test]
fn a_comparator_run_by_qsort_is_a_call_the_runtime_made() {
    let source = read(&repo_root().join("emulator/tests/c-corpus/80_qsort_bsearch.s"));
    let mut p = load(&source);
    let qsort = p.cpu.host.lookup("qsort").unwrap();
    let mut seen = false;
    for _ in 0..10_000 {
        p.cpu.step().unwrap();
        if let Some(top) = p.cpu.call_stack().activations().last().filter(|a| a.flags & RUNTIME_CALL != 0) {
            assert_eq!((top.call_pc, top.ret_addr), (qsort, qsort));
            seen = true;
            break;
        }
    }
    assert!(seen, "qsort ran a comparator");
}

// ---------------------------------------------------------------------------
// Hostile programs stay bounded
// ---------------------------------------------------------------------------

/// Run `source` for at most `steps` steps, drawing the view after every
/// one, as a stepping student would: nothing may panic, and the call stack
/// stays within its cap.
fn survives(source: &str, steps: usize) -> Loaded {
    let mut p = load(source);
    for _ in 0..steps {
        let r = p.cpu.step().expect("step");
        let v = p.view();
        assert!(v.frames.len() <= MAX_DRAWN);
        assert!(p.cpu.call_stack().activations().len() <= MAX_ACTIVATIONS);
        if r.halted {
            break;
        }
    }
    p
}

#[test]
fn hostile_frames_never_panic_or_loop() {
    // fp pointing into .data when a call is made.
    let p = survives(
        r#"
// Calls helper with fp pointing into .data.
        .data
junk:   .quad   0, 0, 0, 0
        .text
        .balign 4
        .global main
main:
        ldr     x29, =junk              // fp into .data
        bl      helper
        mov     w0, 0
        ret
        .balign 4
        .global helper
helper:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        ldp     x29, x30, [sp], 16
        ret
"#,
        100,
    );
    assert!(!p.view().chain_ok || p.cpu.is_halted());
    // sp off a multiple of 16 at a call.
    survives(
        r#"
// Calls helper with sp off a multiple of 16.
        .text
        .balign 4
        .global main
main:
        sub     sp, sp, 8               // sp misaligned
        bl      helper
        add     sp, sp, 8
        ret
        .balign 4
        .global helper
helper:
        stp     x29, x30, [sp, -16]!
        ldp     x29, x30, [sp], 16
        ret
"#,
        100,
    );
    // A bl into the middle of a function, past its prologue.
    survives(
        r#"
// Enters helper past its prologue, so its epilogue pops main's record.
        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        bl      helper_mid
        ldp     x29, x30, [sp], 16
        ret
        .balign 4
        .global helper
helper:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
helper_mid:
        ldp     x29, x30, [sp], 16
        ret
"#,
        100,
    );
    // A computed blr, once into code and once into data.
    survives(
        r#"
// Calls through computed addresses: into helper and into .data.
        .data
junk:   .quad   0
        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        ldr     x9, =helper
        add     x9, x9, 4               // skip helper's first instruction
        blr     x9
        ldr     x9, =junk
        blr     x9                      // into data
        ldp     x29, x30, [sp], 16
        ret
        .balign 4
        .global helper
helper:
        nop
        ret
"#,
        100,
    );
    // A return to a library stub's address, and an fp whose record points
    // at itself.
    let p = survives(
        r#"
// Returns into puts's stub, after making fp's record point at itself.
        .data
msg:    .string "hi"
        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        str     x29, [x29]              // the record's saved fp is itself
        ldr     x0, =msg
        ldr     x30, =puts
        ret                             // into the stub, not a caller
"#,
        100,
    );
    let bad = p.cpu.call_stack().bad_return();
    assert_eq!(Some(bad.target), p.cpu.host.lookup("puts"));
}

// ---------------------------------------------------------------------------
// The frame check
// ---------------------------------------------------------------------------

/// A finding as (rule, line, function, frame bytes, and its slots as name,
/// offset and width).
type Row = (u8, u32, String, u64, Vec<(String, i64, u8)>);

fn row(rule: u8, line: u32, function: &str, frame: u64, slots: &[(&str, i64, u8)]) -> Row {
    (rule, line, function.into(), frame, slots.iter().map(|&(n, o, w)| (n.into(), o, w)).collect())
}

/// The functions checked and skipped, and each finding as a `Row`.
fn frame_check(source: &str) -> (u32, u32, Vec<Row>) {
    let (check, names) = check_source(source, &Cpu::new().host);
    let name = |i: u32| names[i as usize].clone();
    let rows = check
        .findings
        .iter()
        .map(|f| {
            let slots = [f.first, f.second].into_iter().flatten().map(|s| (name(s.name), s.offset, s.width)).collect();
            (f.rule, f.line, f.function.map_or(String::new(), name), f.frame_bytes, slots)
        })
        .collect();
    (check.checked, check.skipped, rows)
}

/// alloc = -(16 + 8) & -16 = -32. long_s holds bytes 16 to 23 and count_s
/// bytes 20 to 23, so the count's store (line 22) lands inside the long.
const OVERLAPPING: &str = r#"
// Keeps a long and a count in main's frame, with the count's offset
// inside the long's eight bytes.

define(fp, x29)
define(lr, x30)

long_s = 16
count_s = 20
alloc = -(16 + 8) & -16
dealloc = -alloc

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        mov     x9, 100
        str     x9, [fp, long_s]
        mov     w9, 3
        str     w9, [fp, count_s]
        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
"#;

/// Two names for byte 16: second_s's store (line 21) lands on first_s.
const SAME_OFFSET: &str = r#"
// Gives two ints the same offset by mistake.

define(fp, x29)
define(lr, x30)

first_s = 16
second_s = 16
alloc = -(16 + 8) & -16
dealloc = -alloc

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        mov     w9, 1
        str     w9, [fp, first_s]
        mov     w9, 2
        str     w9, [fp, second_s]
        ldr     w0, [fp, first_s]
        ldp     fp, lr, [sp], dealloc
        ret
"#;

#[test]
fn the_frame_check_marks_slots_that_share_bytes() {
    assert_eq!(
        frame_check(OVERLAPPING),
        (1, 0, vec![row(OVERLAP, 22, "main", 32, &[("long_s", 16, 8), ("count_s", 20, 4)])])
    );
    assert_eq!(
        frame_check(SAME_OFFSET),
        (1, 0, vec![row(OVERLAP, 21, "main", 32, &[("first_s", 16, 4), ("second_s", 16, 4)])])
    );
}

/// A 32-byte frame covers fp + 0 to 31: low_s (-8 to -1, line 21) is below
/// it and high_s (32 to 39, line 20) past its end; sum_s (16 to 23) fits.
const OUTSIDE_FRAME: &str = r#"
// Stores one long below fp and one past the end of a 32-byte frame.

define(fp, x29)
define(lr, x30)

low_s = -8
sum_s = 16
high_s = 32
alloc = -(16 + 8) & -16
dealloc = -alloc

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        str     xzr, [fp, sum_s]
        str     xzr, [fp, high_s]
        str     xzr, [fp, low_s]
        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
"#;

/// last9 only reads ninth_s at fp + 16, past the end of its 16-byte frame:
/// that is the caller's slot, where a ninth argument arrives, so it is not
/// marked. main moves sp for that slot, so it is off the pattern.
const STACK_ARGUMENT: &str = r#"
// last9 returns its ninth argument, which arrives on the stack.

define(fp, x29)
define(lr, x30)

ninth_s = 16

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        sub     sp, sp, 16
        mov     x9, 9
        str     x9, [sp]
        bl      last9
        add     sp, sp, 16
        ldp     fp, lr, [sp], 16
        ret

// last9(x0 to x7, the ninth on the stack) -> x0 = the ninth
last9:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x0, [fp, ninth_s]
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn the_frame_check_marks_slots_outside_the_frame() {
    assert_eq!(frame_check(STACK_ARGUMENT), (1, 1, vec![]));
    assert_eq!(
        frame_check(OUTSIDE_FRAME),
        (
            1,
            0,
            vec![
                row(OUTSIDE, 20, "main", 32, &[("high_s", 32, 8)]),
                row(OUTSIDE, 21, "main", 32, &[("low_s", -8, 8)]),
            ]
        )
    );
}

/// The saved fp is fp + 0 to 7 and the saved lr fp + 8 to 15: saved_s (0
/// to 7, line 20) sits on the first and n_s (8 to 11, line 19) on the
/// second.
const ON_THE_RECORD: &str = r#"
// Puts a local on the saved lr and another on the saved fp.

define(fp, x29)
define(lr, x30)

saved_s = 0
n_s = 8
alloc = -(16 + 16) & -16
dealloc = -alloc

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        mov     w9, 5
        str     w9, [fp, n_s]
        str     x9, [fp, saved_s]
        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
"#;

#[test]
fn the_frame_check_marks_slots_on_the_saved_fp_and_lr() {
    assert_eq!(
        frame_check(ON_THE_RECORD),
        (
            1,
            0,
            vec![
                row(ON_RECORD, 19, "main", 32, &[("n_s", 8, 4)]),
                row(ON_RECORD, 20, "main", 32, &[("saved_s", 0, 8)]),
            ]
        )
    );
}

/// alloc = -(16 + 12) & -16 = -32. total_s is 8 bytes at 20, and 20 is not
/// a multiple of 8 (line 22); count_s (16 to 19) ends where it starts.
const UNALIGNED_LONG: &str = r#"
// Keeps a long right after an int, at an offset that is not a multiple
// of 8.

define(fp, x29)
define(lr, x30)

count_s = 16
total_s = 20
alloc = -(16 + 12) & -16
dealloc = -alloc

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        mov     w9, 3
        str     w9, [fp, count_s]
        mov     x9, 1000
        str     x9, [fp, total_s]
        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
"#;

#[test]
fn the_frame_check_marks_a_long_off_a_multiple_of_8() {
    assert_eq!(frame_check(UNALIGNED_LONG), (1, 0, vec![row(UNALIGNED, 22, "main", 32, &[("total_s", 20, 8)])]));
}

/// alloc = -(16 + 8) = -24, never rounded: the push on line 15 leaves sp
/// 24 bytes down, off a multiple of 16. value_s (16 to 23) fits.
const ODD_SIZED: &str = r#"
// Sizes the frame without rounding it up to a multiple of 16.

define(fp, x29)
define(lr, x30)

value_s = 16
alloc = -(16 + 8)
dealloc = -alloc

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        str     xzr, [fp, value_s]
        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
"#;

#[test]
fn the_frame_check_marks_a_frame_that_leaves_sp_off_16() {
    assert_eq!(frame_check(ODD_SIZED), (1, 0, vec![row(ODD_FRAME, 15, "main", 24, &[])]));
}

/// main is on the pattern; grow moves sp again after its record (so its
/// temp_s at fp - 4 is its own space) and bare pushes no record: both are
/// left alone.
const OFF_THE_PATTERN: &str = r#"
// A frame on the pattern, one that grows the stack after its frame
// record, and one with no frame record at all.

define(fp, x29)
define(lr, x30)

temp_s = -4

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      grow
        bl      bare
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret

// grow() zeroes temp_s, an int in the 16 bytes it takes below fp after its frame record
grow:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        sub     sp, sp, 16
        str     wzr, [fp, temp_s]
        add     sp, sp, 16
        ldp     fp, lr, [sp], 16
        ret

// bare() zeroes an int in 16 bytes of stack it takes with no frame record
bare:
        sub     sp, sp, 16
        str     wzr, [sp, 12]
        add     sp, sp, 16
        ret
"#;

#[test]
fn the_frame_check_leaves_functions_off_the_pattern_alone() {
    assert_eq!(frame_check(OFF_THE_PATTERN), (1, 2, vec![]));
}

/// num_m is a .bss label, not an equate: the offset it gives is an address
/// the frame check cannot place, so it names no slot.
const LABEL_AS_OFFSET: &str = r#"
// Reads a long through fp with a .bss label where an equate belongs.

define(fp, x29)
define(lr, x30)

        .data
fmt_in:     .string "%ld"

        .bss
        .align 3
num_m:      .skip   8

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x0, =fmt_in
        add     x1, fp, num_m
        bl      scanf
        ldr     x0, [fp, num_m]
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn the_frame_check_takes_only_equates_as_slot_offsets() {
    assert_eq!(frame_check(LABEL_AS_OFFSET), (1, 0, vec![]));
}

/// main: a_s 16 to 19 and b_s 20 to 23 in 32 bytes; sum: x19_s 16 to 23
/// and total_s 24 to 31 in 32 bytes. Nothing to mark.
const WELL_LAID_OUT: &str = r#"
// main keeps two ints in its frame; sum saves x19 and keeps a long.

define(fp, x29)
define(lr, x30)

a_s = 16
b_s = 20
alloc = -(16 + 8) & -16
dealloc = -alloc
x19_s = 16
total_s = 24
sum_alloc = -(16 + 16) & -16
sum_dealloc = -sum_alloc

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        mov     w9, 7
        str     w9, [fp, a_s]
        mov     w9, 4
        str     w9, [fp, b_s]
        ldr     w0, [fp, a_s]
        ldr     w1, [fp, b_s]
        bl      sum
        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret

// sum(w0 = a, w1 = b) -> x0 = a + b
sum:
        stp     fp, lr, [sp, sum_alloc]!
        mov     fp, sp
        str     x19, [fp, x19_s]
        add     w19, w0, w1
        sxtw    x19, w19
        str     x19, [fp, total_s]
        ldr     x0, [fp, total_s]
        ldr     x19, [fp, x19_s]
        ldp     fp, lr, [sp], sum_dealloc
        ret
"#;

#[test]
fn the_frame_check_is_silent_on_a_correct_frame() {
    assert_eq!(frame_check(WELL_LAID_OUT), (2, 0, vec![]));
}

/// Precision over every program the site ships and the tests hold: each
/// assembles, and no function on the pattern gets a mark.
#[test]
fn the_frame_check_marks_nothing_the_site_ships_or_the_c_corpus_at_o0() {
    let root = repo_root();
    let folder = |dir: &str, keep: fn(&str) -> bool| -> Vec<(String, String)> {
        let mut files: Vec<(String, String)> = std::fs::read_dir(root.join(dir))
            .expect(dir)
            .filter_map(|e| e.ok()?.file_name().into_string().ok())
            .filter(|f| f.ends_with(".s") && keep(f))
            .map(|f| (f.clone(), read(&root.join(dir).join(&f))))
            .collect();
        files.sort();
        files
    };
    let groups = [
        ("shipped examples", shipped_examples()),
        ("exercise reference programs", folder("web/lib/test/content/exercise-solutions", |_| true)),
        ("C corpus at -O0", folder("emulator/tests/c-corpus", |f| !f.contains(".O2"))),
    ];
    let mut marks = Vec::new();
    for (group, programs) in &groups {
        let (mut checked, mut skipped) = (0, 0);
        for (name, source) in programs {
            let (check, _) = check_source(source, &Cpu::new().host);
            assert!(check.checked + check.skipped > 0, "{name} did not assemble");
            (checked, skipped) = (checked + check.checked, skipped + check.skipped);
            marks.extend(check.findings.iter().map(|f| format!("{name}: {f:?}")));
        }
        println!("{group}: {} programs, {checked} functions on the pattern, {skipped} skipped", programs.len());
    }
    assert!(marks.is_empty(), "the frame check marked:\n  {}", marks.join("\n  "));
}
