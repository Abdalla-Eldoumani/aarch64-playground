//! The call tree behind the stack frames view's list of calls: every call
//! a program makes, returned ones included, with runs of one function
//! folded past their first four, at most 200 nodes and 12 deep, counted
//! past that. Read through the crate's public surface (the call stack's
//! tree, the frame layout, the frames view's numbers). Every expected tree
//! is worked out by hand from the program's text; the C programs' values
//! come from their printed output and from the stack's own arithmetic.
//!
//! Each kind of return is also pinned at the frames view's numbers as the
//! wasm exports them, with the clobber notes and Back: a leaf's, nested,
//! recursive and tail-called returns, and two known defects, a ret that
//! skips its caller and a stray ret three calls deep. Beside them, what a
//! skip (across two bl sites and under one), a stray ret and a tail call
//! to printf should leave, by the sp, fp and pc each return leaves.

use std::path::PathBuf;

use aarch64_emulator::cpu::{Cpu, STACK_BASE, STACK_FLOOR};
use aarch64_emulator::frames::layout::{frame_layout, FrameLayout};
use aarch64_emulator::frames::tree::{CallTree, MAX_TREE_DEPTH, MAX_TREE_NODES, RUN_SHOWN};
use aarch64_emulator::frames::{frame_view, view_numbers, FrameView, MAX_ACTIVATIONS, RUNTIME_CALL};
use aarch64_emulator::frontend::pipeline::{assemble_hosted, LinkedImage};

fn repo_root() -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.pop();
    p
}

fn read(path: &str) -> String {
    let path = repo_root().join(path);
    std::fs::read_to_string(&path)
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
    fn tree(&self) -> &CallTree {
        self.cpu.call_stack().tree()
    }

    fn label(&self, name: &str) -> u64 {
        self.image.symbols[name]
    }

    /// Run until the instruction at `pc` is next, `times` times over.
    fn run_to(&mut self, pc: u64, times: usize) {
        self.cpu.set_breakpoint(pc);
        for _ in 0..times {
            // Off the breakpoint first, or the run stops where it is.
            self.cpu.step().expect("step");
            self.cpu.run_until_break(10_000_000).expect("run");
            assert_eq!(self.cpu.regs.read_pc(), pc, "stopped short of {pc:#x}");
        }
        self.cpu.clear_breakpoint(pc);
    }

    fn run_to_end(&mut self) {
        self.cpu.run_until_break(200_000_000).expect("run");
        assert!(self.cpu.is_halted(), "the program finished");
    }

    fn name(&self, entry: u64) -> String {
        let f = self.layout.functions.iter().find(|f| f.entry == entry).expect("a function starts there");
        self.layout.names[f.name.expect("named") as usize].clone()
    }

    /// The tree as lines: two spaces a level, `name(arg)` where the
    /// function reads x0 (`name × count` for a fold), then `-> value` once
    /// every call it stands for returned (as w0 after a 32-bit write of x0,
    /// else as x0), `*` on the current call and `...` on one still waiting
    /// for a callee.
    fn outline(&self) -> Vec<String> {
        let tree = self.tree();
        let nodes = tree.nodes();
        let mut depth = vec![0usize; nodes.len()];
        nodes
            .iter()
            .enumerate()
            .map(|(i, n)| {
                if let Some(p) = n.parent.checked_sub(1) {
                    depth[i] = depth[p] + 1;
                }
                let name = self.name(n.entry);
                let width = self.layout.functions.iter().find(|f| f.entry == n.entry).map_or(0, |f| f.arg_width);
                let call = match width {
                    _ if n.folds() => format!("{name} × {}", n.calls),
                    0 => name,
                    4 => format!("{name}({})", n.arg as u32 as i32),
                    _ => format!("{name}({})", n.arg as i64),
                };
                let state = match () {
                    _ if tree.current() == Some(i) => " *".to_string(),
                    _ if n.open > 0 => " ...".to_string(),
                    _ if n.ret_width == 4 => format!(" -> {}", n.ret as u32 as i32),
                    _ => format!(" -> {}", n.ret as i64),
                };
                format!("{}{call}{state}", "  ".repeat(depth[i]))
            })
            .collect()
    }
}

const FIXTURE: &str = "web/lib/test/emulator/fixtures/call-tree.s";
/// call-tree.s, line 30: `mov w0, 1`, fact's base case.
const FACT_BASE: u32 = 30;

fn pc_of(p: &Loaded, line: u32) -> u64 {
    p.image.line_map.iter().find(|(_, l)| *l == line).unwrap_or_else(|| panic!("no instruction on line {line}")).0
}

#[test]
fn the_fixture_draws_fact_down_to_its_base_case_with_each_call_its_own_node() {
    let mut p = load(&read(FIXTURE));
    let base = pc_of(&p, FACT_BASE);
    p.run_to(base, 1);
    // main called fact(4), which called itself with 3, 2 and 1; fact(1)
    // is at its base case and nothing has returned yet.
    assert_eq!(
        p.outline(),
        ["main ...", "  fact(4) ...", "    fact(3) ...", "      fact(2) ...", "        fact(1) *"]
    );
}

#[test]
fn the_fixture_ends_with_every_call_returned_and_the_cube_run_folded_after_four() {
    let mut p = load(&read(FIXTURE));
    p.run_to_end();
    assert_eq!(String::from_utf8_lossy(&p.cpu.take_stdout()).lines().next(), Some("4! = 24"));
    // fact(1) = 1, fact(2) = 2 * 1, fact(3) = 3 * 2, fact(4) = 4 * 6; then
    // cube(i) = i * i * i for i = 1 to 7: the first four of that run keep
    // a node each, and cube(5), cube(6) and cube(7) fold into one, whose
    // latest return is 7 * 7 * 7 = 343. main returns 0.
    assert_eq!(
        p.outline(),
        [
            "main -> 0",
            "  fact(4) -> 24",
            "    fact(3) -> 6",
            "      fact(2) -> 2",
            "        fact(1) -> 1",
            "  cube(1) -> 1",
            "  cube(2) -> 8",
            "  cube(3) -> 27",
            "  cube(4) -> 64",
            "  cube × 3 -> 343",
        ]
    );
    assert_eq!((p.tree().current(), p.tree().outside(), p.tree().dropped()), (None, 0, 0));
}

#[test]
fn the_deepest_c_recursion_folds_into_one_node_that_counts_every_call_past_the_fourth() {
    let mut p = load(&read("emulator/tests/c-corpus/46_stack_overflow.s"));
    // main's sp once its frame is pushed, at the `bl rec`: each rec call
    // takes 1,056 bytes (`sub sp, sp, #1056`) and stores at its new sp, so
    // the calls whose sp stays at or above the stack's floor run, and the
    // one after them faults on its first store, after its `bl` entered it.
    let rec = p.label("rec");
    p.run_to(rec, 1);
    let main_sp = p.cpu.regs.snapshot()[31];
    let entered = (main_sp - STACK_FLOOR) / 1056 + 1;
    p.run_to_end();
    // 7,945 calls deep with main, as the C corpus's deepest program goes.
    assert_eq!(entered, 7_944, "the stack's arithmetic");
    let folded = entered - u64::from(RUN_SHOWN);
    assert_eq!(
        p.outline(),
        [
            "main ...".to_string(),
            "  rec(0) ...".into(),
            "    rec(1) ...".into(),
            "      rec(2) ...".into(),
            "        rec(3) ...".into(),
            format!("          rec × {folded} *"),
        ]
    );
    assert_eq!(folded, 7_940);
    let fold = p.tree().nodes()[5];
    assert_eq!((fold.calls, fold.open), (7_940, 7_940), "every folded call is still open at the fault");
    // The call stack, kept apart from the tree, agrees: main and every rec.
    assert_eq!(p.cpu.call_stack().activations().len() as u64, 1 + entered);
}

const SUMTO: &str = "web/lib/test/emulator/fixtures/sumto.s";
const NO_BASE_CASE: &str = "web/lib/test/emulator/fixtures/no-base-case.s";

#[test]
fn a_recursion_deeper_than_the_call_stack_keeps_counting_every_call_in_its_fold() {
    let mut p = load(&read(SUMTO));
    p.run_to_end();
    assert_eq!(String::from_utf8_lossy(&p.cpu.take_stdout()), "sum = 200010000\n");
    // sumto(n) = n * (n + 1) / 2, so sumto(20000) = 200,010,000. Its
    // 20,001 calls run sumto(20000) down to sumto(0): four with a node of
    // their own, then sumto(19996) to sumto(0), 19,997 calls, in the fold,
    // whose outermost call returns 19996 * 19997 / 2.
    assert_eq!(
        p.outline(),
        [
            "main -> 0",
            "  sumto(20000) -> 200010000",
            "    sumto(19999) -> 199990000",
            "      sumto(19998) -> 199970001",
            "        sumto(19997) -> 199950003",
            "          sumto × 19997 -> 199930006",
        ]
    );
    assert_eq!((p.tree().dropped(), p.tree().outside()), (0, 0));
}

#[test]
fn a_recursion_with_no_base_case_counts_every_call_up_to_the_overflow() {
    let mut p = load(&read(NO_BASE_CASE));
    // Each count call pushes 16 bytes as its first instruction, so the
    // calls whose record fits at or above the stack's floor run, and the
    // one after them faults on that push, after its `bl` entered it.
    let count = p.label("count");
    p.run_to(count, 1);
    let main_sp = p.cpu.regs.snapshot()[31];
    let entered = (main_sp - STACK_FLOOR) / 16 + 1;
    p.run_to_end();
    assert_eq!(entered, 524_288, "the stack's arithmetic: 8 MiB of 16-byte records");
    let folded = entered - u64::from(RUN_SHOWN);
    assert_eq!(
        p.outline(),
        [
            "main ...".to_string(),
            "  count(0) ...".into(),
            "    count(1) ...".into(),
            "      count(2) ...".into(),
            "        count(3) ...".into(),
            format!("          count × {folded} *"),
        ]
    );
    // The frames view agrees: the calls it records and the deeper ones it
    // only counts ("507,905 deeper frames not recorded") add up to the same.
    let view = frame_view(&p.cpu, &p.layout);
    let recorded = p.cpu.call_stack().activations().len() as u64 - 1;
    assert_eq!((recorded, view.uncounted), (MAX_ACTIVATIONS as u64 - 1, 507_905));
    assert_eq!(recorded + view.uncounted, entered);
}

#[test]
fn fifty_one_deep_frames_folds_each_recursion_and_keeps_its_printed_results() {
    let mut p = load(&read("emulator/tests/c-corpus/51_deep_frames.s"));
    p.run_to_end();
    let out = String::from_utf8_lossy(&p.cpu.take_stdout()).into_owned();
    let printed = |key: &str| out.lines().find_map(|l| l.strip_prefix(key)).expect("printed").to_string();
    // walk(3000) recurses down to walk(0): 3,001 calls, four with a node of
    // their own and 2,997 folded; ten(600) makes 601, keep(1500) 1,501.
    let outline = p.outline();
    let expected_shape = [
        "main -> 0",
        "  walk(3000) -> ",
        "    walk(2999) -> ",
        "      walk(2998) -> ",
        "        walk(2997) -> ",
        "          walk × 2997 -> ",
        "  ten(600) -> ",
        "    ten(599) -> ",
        "      ten(598) -> ",
        "        ten(597) -> ",
        "          ten × 597 -> ",
        "  keep(1500) -> ",
        "    keep(1499) -> ",
        "      keep(1498) -> ",
        "        keep(1497) -> ",
        "          keep × 1497 -> ",
    ];
    assert_eq!(outline.len(), expected_shape.len());
    for (line, start) in outline.iter().zip(expected_shape) {
        assert!(line.starts_with(start), "{line:?} starts {start:?}");
    }
    // What each outermost call returned is what main printed.
    let nodes = p.tree().nodes();
    assert_eq!(format!("{:016x}", nodes[1].ret), printed("walk="));
    assert_eq!((nodes[6].ret as i64).to_string(), printed("ten="));
    assert_eq!(format!("{:016x}", nodes[11].ret), printed("keep="));
    assert_eq!((p.tree().dropped(), p.tree().outside()), (0, 0));
}

/// Calls tick, then tock, 150 times over: 300 calls with no run to fold.
const TICK_TOCK: &str = "\
define(fp, x29)
define(lr, x30)
define(i_r, w19)

.text
// tick() -> w0 = 1
        .balign 4
        .global tick
tick:
        mov     w0, 1
        ret

// tock() -> w0 = 2
        .balign 4
        .global tock
tock:
        mov     w0, 2
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     i_r, 0
        b       tt_test
tt_loop:
        bl      tick
        bl      tock
        add     i_r, i_r, 1
tt_test:
        cmp     i_r, 150
        b.lt    tt_loop
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
";

#[test]
fn the_tree_keeps_two_hundred_nodes_and_counts_the_calls_past_them() {
    let mut p = load(TICK_TOCK);
    // main, then tick and tock in turn: 199 calls fill the 200 nodes (100
    // ticks, 99 tocks), so the 100th tock is the first call with no node.
    let tock = p.label("tock");
    p.run_to(tock, 100);
    let tree = p.tree();
    assert_eq!(tree.nodes().len(), MAX_TREE_NODES);
    assert_eq!((tree.current(), tree.outside(), tree.dropped()), (Some(0), 1, 1));
    p.run_to_end();
    let tree = p.tree();
    assert_eq!(tree.nodes().len(), 200);
    assert_eq!(tree.dropped(), 300 - 199);
    assert_eq!((tree.current(), tree.outside()), (None, 0));
    assert_eq!(p.outline()[199], "  tick -> 1", "the 199th call, a tick, has the last node");
}

/// down(n) calls over(n), which calls down(n - 1), until n is 0: two
/// functions in turn, 21 calls deep from down(10), with no run to fold.
const DOWN_OVER: &str = "\
define(fp, x29)
define(lr, x30)

.text
// down(w0 = n) -> w0 = 0
        .balign 4
        .global down
down:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        cmp     w0, 0
        b.le    down_done
        bl      over
down_done:
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret

// over(w0 = n) -> w0 = 0
        .balign 4
        .global over
over:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        sub     w0, w0, 1
        bl      down
        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 10
        bl      down
        ldp     fp, lr, [sp], 16
        ret
";

#[test]
fn calls_nested_past_twelve_levels_are_counted_not_kept() {
    let mut p = load(DOWN_OVER);
    // down(0) is the 21st call, at `mov w0, 0` with no call left to make:
    // down(10), over(10), down(9), ... down(5) fill levels 2 to 12 under
    // main; over(5) down to down(0), ten calls, have no node.
    let done = p.label("down_done");
    p.run_to(done, 1);
    let tree = p.tree();
    assert_eq!(tree.nodes().len(), 12);
    assert_eq!(p.outline().last().map(String::as_str), Some(&*format!("{}down(5) *", "  ".repeat(MAX_TREE_DEPTH as usize - 1))));
    assert_eq!((tree.current(), tree.outside(), tree.dropped()), (Some(11), 10, 10));
    p.run_to_end();
    assert_eq!((p.tree().current(), p.tree().outside(), p.tree().dropped()), (None, 0, 10));
}

/// skip() pops jump's frame record and returns straight to main: one
/// `ret` that leaves two calls.
const SKIP: &str = "\
define(fp, x29)
define(lr, x30)

.text
// jump() -> w0 = 7, through skip
        .balign 4
        .global jump
jump:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      skip
        mov     w0, 1                   // never runs
        ldp     fp, lr, [sp], 16
        ret

// skip() -> w0 = 7, returning for jump as well
        .balign 4
        .global skip
skip:
        mov     w0, 7
        ldp     fp, lr, [sp], 16        // jump's record: back into main
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      jump
        ldp     fp, lr, [sp], 16
        ret
";

#[test]
fn a_return_that_leaves_two_calls_returns_both() {
    let mut p = load(SKIP);
    p.run_to_end();
    assert_eq!(p.outline(), ["main -> 7", "  jump -> 7", "    skip -> 7"]);
}

#[test]
fn the_argument_is_x0_only_where_the_function_reads_it_before_anything_else() {
    let source = "\
.text
        .balign 4
        .global compares
compares:
        cmp     w0, 3
        ret
        .balign 4
        .global copies
copies:
        mov     x9, x0
        ret
        .balign 4
        .global stores_byte
stores_byte:
        sub     sp, sp, 16
        strb    w0, [sp]
        add     sp, sp, 16
        ret
        .balign 4
        .global loads_through
loads_through:
        ldr     w9, [x0]
        ret
        .balign 4
        .global sets
sets:
        mov     w0, 1
        ret
        .balign 4
        .global branches
branches:
        b       branches_go
branches_go:
        add     w0, w0, 1
        ret
        .balign 4
        .global indexes
indexes:
        ldr     w9, [x1, w0, sxtw 2]
        ret
        .balign 4
        .global main
main:
        mov     w0, 0
        ret
";
    let p = load(source);
    let width = |name: &str| {
        let f = p.layout.functions.iter().find(|f| p.layout.names[f.name.unwrap() as usize] == name).expect(name);
        f.arg_width
    };
    // A compare of w0 reads an int, a copy of x0 a long, a byte store a
    // char, and a load through x0 a pointer; writing w0 first, a branch
    // first, and an index register leave no argument to show.
    assert_eq!(
        ["compares", "copies", "stores_byte", "loads_through", "sets", "branches", "indexes", "main"].map(width),
        [4, 8, 1, 8, 0, 0, 0, 0]
    );
}

#[test]
fn a_cbz_or_tbz_on_x0_reads_the_argument_it_tests() {
    let source = "\
.text
        .balign 4
        .global null_check
null_check:
        cbz     x0, null_check_done
        ldr     x0, [x0]
null_check_done:
        ret
        .balign 4
        .global zero_check
zero_check:
        cbnz    w0, zero_check_done
        mov     w0, 1
zero_check_done:
        ret
        .balign 4
        .global odd_check
odd_check:
        tbnz    w0, 0, odd_check_done
        add     w0, w0, 1
odd_check_done:
        ret
        .balign 4
        .global sign_check
sign_check:
        tbz     x0, 63, sign_check_done
        neg     x0, x0
sign_check_done:
        ret
        .balign 4
        .global other_check
other_check:
        cbz     x1, other_check_done
        add     w0, w0, 1
other_check_done:
        ret
        .balign 4
        .global main
main:
        mov     w0, 0
        ret
";
    let p = load(source);
    let width = |name: &str| {
        let f = p.layout.functions.iter().find(|f| p.layout.names[f.name.unwrap() as usize] == name).expect(name);
        f.arg_width
    };
    // cbz x0 reads a long or a pointer, cbnz w0 and tbnz w0 an int, and
    // tbz on bit 63 names x0; a cbz on another register is a branch like
    // any other and leaves no argument to show.
    assert_eq!(["null_check", "zero_check", "odd_check", "sign_check", "other_check"].map(width), [8, 4, 4, 8, 0]);
}

const RETURNS: &str = "web/lib/test/emulator/fixtures/call-returns.s";

#[test]
fn a_returned_value_keeps_the_width_x0_was_last_written_at() {
    let mut p = load(&read(RETURNS));
    p.run_to_end();
    assert_eq!(String::from_utf8_lossy(&p.cpu.take_stdout()), "2147483648 -2147483648 hi\n");
    // as_long's last write is lsl x0 and as_int's lsl w0: the same bits
    // 0x80000000 as a long 2^31 and as an int with its sign bit set.
    // greeting loads x0 with msg's address; main ends on mov w0, 0.
    let msg = p.label("msg");
    let returned: Vec<_> = p.tree().nodes().iter().map(|n| (n.ret, n.ret_width)).collect();
    assert_eq!(returned, [(0, 4), (0x8000_0000, 8), (0x8000_0000, 4), (msg, 8)]);
    assert_eq!(&p.outline()[1..3], ["  as_long -> 2147483648", "  as_int -> -2147483648"]);
}

#[test]
fn an_int_loaded_into_w0_returns_as_an_int() {
    let source = "\
define(fp, x29)
define(lr, x30)

.data
neg_five:   .word -5

.text
// loaded() -> w0 = -5, read from memory
// Leaf function: no frame of its own
        .balign 4
        .global loaded
loaded:
        ldr     x9, =neg_five
        ldr     w0, [x9]
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      loaded
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
";
    let mut p = load(source);
    p.run_to_end();
    // ldr w0 writes w0, so the word -5 comes back as the int -5, not as
    // the long 4294967291 its zero-extended bits would read as in x0.
    let loaded = p.tree().nodes()[1];
    assert_eq!((loaded.ret, loaded.ret_width), (0xFFFF_FFFB, 4));
    assert_eq!(p.outline()[1], "  loaded -> -5");
}

#[test]
fn back_and_a_named_save_keep_the_width_x0_was_last_written_at() {
    let mut p = load(&read(RETURNS));
    let x0_width = |p: &Loaded| frame_view(&p.cpu, &p.layout).x0_width;
    // as_int: mov x0, 1, then lsl w0, w0, 31, then ret.
    let lsl = p.label("as_int") + 4;
    p.run_to(lsl, 1);
    assert_eq!(x0_width(&p), 8, "mov x0, 1 wrote x0");
    p.cpu.step().expect("lsl");
    assert_eq!(x0_width(&p), 4, "lsl w0 wrote w0");
    p.cpu.save_state("at the ret");
    p.cpu.step_back();
    assert_eq!(x0_width(&p), 8, "Back puts mov x0's width back");
    assert!(p.cpu.load_state("at the ret"));
    assert_eq!(x0_width(&p), 4, "the save keeps lsl w0's width");
    p.cpu.step().expect("ret");
    assert_eq!(p.tree().nodes()[2].ret_width, 4);
    // Every step from main's first call to printf's, back and forth.
    let mut p = load(&read(RETURNS));
    let as_long = p.label("as_long");
    p.run_to(as_long, 1);
    back_retraces(&mut p, 16, "the three returns");
}

/// Every step's frames view, the tree in it, for `steps` steps.
fn trail(p: &mut Loaded, steps: usize) -> Vec<FrameView> {
    (0..steps)
        .map(|_| {
            p.cpu.step().expect("step");
            frame_view(&p.cpu, &p.layout)
        })
        .collect()
}

/// Step `steps` forward, back one at a time to the start, then forward
/// again: each Back lands on exactly the tree the step before it left, and
/// the replay retraces the first pass.
fn back_retraces(p: &mut Loaded, steps: usize, what: &str) {
    let start = frame_view(&p.cpu, &p.layout);
    let first = trail(p, steps);
    assert!(!p.cpu.is_halted(), "{what}: the window ends before the program does");
    assert_ne!(start.tree, first[steps - 1].tree, "{what}: the steps change the tree");
    for k in (0..steps).rev() {
        p.cpu.step_back();
        let expected = if k == 0 { &start } else { &first[k - 1] };
        assert_eq!(&frame_view(&p.cpu, &p.layout), expected, "{what}: back to step {k}");
    }
    assert_eq!(trail(p, steps), first, "{what}: the replay");
}

#[test]
fn back_restores_the_tree_exactly_across_calls_returns_folds_and_the_caps() {
    // The fourth cube call to main's return: cube(4) returns, cube(5)
    // makes the fold, cube(6) and cube(7) join it.
    let mut p = load(&read(FIXTURE));
    let cube = p.label("cube");
    p.run_to(cube, 4);
    back_retraces(&mut p, 60, "the cube run");
    assert_eq!(p.tree().nodes()[9].calls, 3, "the window reached cube(7), the fold's third call");
    // fact's returns, from its base case: four returns in a row.
    let mut p = load(&read(FIXTURE));
    let base = pc_of(&p, FACT_BASE);
    p.run_to(base, 1);
    back_retraces(&mut p, 30, "fact's returns");
    // rec(3) calls rec, making the fold, and the next calls deepen it.
    let mut p = load(&read("emulator/tests/c-corpus/46_stack_overflow.s"));
    let rec = p.label("rec");
    p.run_to(rec, 4);
    back_retraces(&mut p, 120, "the recursion's fold");
    assert!(p.tree().nodes()[5].calls > 1, "the window went inside the fold");
    // The last node, then calls with none.
    let mut p = load(TICK_TOCK);
    let tick = p.label("tick");
    p.run_to(tick, 100);
    back_retraces(&mut p, 40, "the node cap");
    assert!(p.tree().dropped() > 0, "the window went past the last node");
    // Past twelve levels and back up.
    let mut p = load(DOWN_OVER);
    let over = p.label("over");
    p.run_to(over, 5);
    back_retraces(&mut p, 70, "the depth cap");
    assert!(p.tree().dropped() > 0, "the window went past twelve levels");
    // One ret leaving two calls.
    let mut p = load(SKIP);
    let skip = p.label("skip");
    p.run_to(skip, 1);
    back_retraces(&mut p, 4, "a return past two calls");
    // qsort entering the program's comparator, a call no bl made: from
    // three steps before it.
    let mut p = load(&read("emulator/tests/c-corpus/80_qsort_bsearch.s"));
    for _ in 0..100_000 {
        if p.cpu.call_stack().activations().last().is_some_and(|a| a.flags & RUNTIME_CALL != 0) {
            break;
        }
        p.cpu.step().expect("step");
    }
    for _ in 0..3 {
        p.cpu.step_back();
    }
    back_retraces(&mut p, 10, "a comparator qsort calls");
}

#[test]
fn back_restores_the_tree_exactly_past_the_call_stacks_cap() {
    let mut p = load(&read(SUMTO));
    let stack = |p: &Loaded| (p.cpu.call_stack().activations().len(), p.cpu.call_stack().uncounted());
    // From the last call the stack records into calls it only counts.
    while stack(&p).0 < MAX_ACTIVATIONS {
        p.cpu.step().expect("step");
    }
    back_retraces(&mut p, 40, "into the cap");
    assert!(stack(&p).1 > 0, "the window went past the cap");
    // sumto(0)'s return and those after it, every one past the cap.
    let base = p.label("sumto_base");
    p.run_to(base, 1);
    back_retraces(&mut p, 40, "returns past the cap");
    // The last counted call's return, then recorded ones again.
    while stack(&p).1 > 1 {
        p.cpu.step().expect("step");
    }
    back_retraces(&mut p, 40, "out of the cap");
    assert_eq!(stack(&p).1, 0, "the window came back under the cap");
}

#[test]
fn a_named_save_and_a_reset_put_the_tree_back() {
    let mut p = load(&read(FIXTURE));
    let cube = p.label("cube");
    p.run_to(cube, 6);
    let saved = p.tree().clone();
    p.cpu.save_state("cubes");
    p.run_to_end();
    assert_ne!(*p.tree(), saved);
    assert!(p.cpu.load_state("cubes"));
    assert_eq!(*p.tree(), saved);
    p.cpu.reset();
    assert!(p.tree().nodes().is_empty(), "a reset clears the calls");
}

// ---------------------------------------------------------------------------
// What each kind of return leaves in the frames view's numbers
// ---------------------------------------------------------------------------

impl Loaded {
    /// The frames view's numbers as the wasm hands them to the web
    /// (`view_numbers`), a line per part, with each address named: a
    /// symbol by its name, an instruction as `label+offset`, a stack
    /// address as `top-N` below `STACK_BASE`.
    /// - header: step, uncounted, hidden, hidden entry, chain ok; the bad
    ///   return's step, pc and target; frames, leftovers; then the call it
    ///   left (index, entry, return address, flags, last return, lr hit's
    ///   step and pc);
    /// - a frame: index, entry, call pc, return address, entry sp, lo,
    ///   entry fp, record, state, flags, then the fp and lr hits (step, pc,
    ///   element, array name);
    /// - a leftover: register, the ret that left it;
    /// - the tree: nodes, current, outside, dropped, x0's width; a node:
    ///   caller, entry, calls, open, argument width, x0 at the call and at
    ///   the latest return (high and low halves), the return's width.
    fn numbers(&self) -> Vec<String> {
        let n = view_numbers(&frame_view(&self.cpu, &self.layout));
        let text = self.image.text_base..self.image.text_end;
        let mut symbols: Vec<(u64, &str)> = self.image.symbols.iter().map(|(s, &v)| (v, s.as_str())).collect();
        symbols.sort();
        let named = |x: f64| -> String {
            let at = x as u64;
            if x < 0.0 || at as f64 != x {
                return x.to_string();
            }
            if let Some((_, s)) = symbols.iter().find(|(v, _)| *v == at) {
                return s.to_string();
            }
            match symbols.iter().rev().find(|(v, _)| *v <= at) {
                Some((v, s)) if text.contains(&at) && text.contains(v) => format!("{s}+{}", at - v),
                _ if (STACK_FLOOR..=STACK_BASE).contains(&at) => format!("top-{}", STACK_BASE - at),
                _ => at.to_string(),
            }
        };
        let line = |part: &[f64]| part.iter().map(|&x| named(x)).collect::<Vec<_>>().join(" ");
        let (frames, leftovers) = (n[8] as usize, n[9] as usize);
        let (rows, tree) = n[17..].split_at(18 * frames + 2 * leftovers);
        let (rows, left) = rows.split_at(18 * frames);
        let mut out = vec![line(&n[..17])];
        out.extend(rows.chunks(18).map(line));
        out.extend(left.chunks(2).map(line));
        out.push(line(&tree[..5]));
        out.extend(tree[5..].chunks(10).map(line));
        out
    }

    /// Run to the `times`th time the instruction at `pc` is next, step it,
    /// and read the numbers.
    fn numbers_after(&mut self, pc: u64, times: usize) -> Vec<String> {
        self.run_to(pc, times);
        self.cpu.step().expect("step");
        self.numbers()
    }
}

/// A leaf call and its return.
const SQUARE: &str = r#"
// main squares 3 with a call to a leaf.

define(fp, x29)
define(lr, x30)

        .text
// square(w0 = n) -> w0 = n * n
        .balign 4
        .global square
square:
        mul     w0, w0, w0
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 3
        bl      square                  // w0 = 9
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_leaf_calls_return_pops_it_and_mains_return_ends_the_program() {
    let mut p = load(SQUARE);
    let square = p.label("square");
    // square's ret pops square: main is drawn alone, square(3) -> 9.
    assert_eq!(
        p.numbers_after(square + 4, 1),
        [
            "6 0 0 0 1 0 0 0 1 0 0 0 0 0 0 0 0",
            "0 main 0 __main_return top-0 top-16 0 top-16 0 4 0 0 -1 -1 0 0 -1 -1",
            "2 1 0 0 4",
            "0 main 1 1 0 0 1 0 0 0",
            "1 square 1 0 4 0 3 0 9 4",
        ]
    );
    // main's ret pops main and leaves the stack empty.
    p.run_to_end();
    assert_eq!(
        p.numbers(),
        ["10 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0", "2 0 0 0 4", "0 main 1 0 0 0 1 0 0 4", "1 square 1 0 4 0 3 0 9 4"]
    );
    assert!(p.cpu.take_clobber_notes().is_empty());
    back_retraces(&mut load(SQUARE), 8, "a leaf's call and return");
}

/// Two calls deep; the inner one leaves x19 changed and the outer one
/// reads it, then hands it back to main changed as well.
const NESTED: &str = r#"
// main -> outer -> inner; inner leaves x19 changed, and outer reads it.

define(fp, x29)
define(lr, x30)

        .text
// inner() -> w0 = 5 (bug: x19 belongs to the caller)
        .balign 4
        .global inner
inner:
        mov     x19, 5
        mov     w0, 5
        ret

// outer() -> w0 = inner() + x19
        .balign 4
        .global outer
outer:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      inner
        add     w0, w0, w19             // reads what inner left in x19
        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x19, 1
        bl      outer                   // w0 = 10
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn nested_returns_pop_one_call_each_and_mark_what_each_left_in_x19() {
    let mut p = load(NESTED);
    let (inner, outer) = (p.label("inner"), p.label("outer"));
    // inner's ret pops inner and marks x19, which it left 5, not 1.
    assert_eq!(
        p.numbers_after(inner + 8, 1),
        [
            "10 0 0 0 1 0 0 0 2 1 0 0 0 0 0 0 0",
            "0 main 0 __main_return top-0 top-16 0 top-16 0 4 0 0 -1 -1 0 0 -1 -1",
            "1 outer main+12 main+16 top-16 top-32 top-16 top-32 0 4 0 0 -1 -1 0 0 -1 -1",
            "19 inner+8",
            "3 2 0 0 4",
            "0 main 1 1 0 0 1 0 0 0",
            "1 outer 1 1 0 0 1 0 0 0",
            "2 inner 1 0 0 0 1 0 5 4",
        ]
    );
    // outer's add reads x19, and outer's ret marks it again for itself.
    assert_eq!(
        p.numbers_after(outer + 20, 1),
        [
            "13 0 0 0 1 0 0 0 1 1 0 0 0 0 0 0 0",
            "0 main 0 __main_return top-0 top-16 0 top-16 0 4 0 0 -1 -1 0 0 -1 -1",
            "19 outer+20",
            "3 1 0 0 4",
            "0 main 1 1 0 0 1 0 0 0",
            "1 outer 1 0 0 0 1 0 10 4",
            "2 inner 1 0 0 0 1 0 5 4",
        ]
    );
    // [register, read by an instruction, the ret that left it, the reader]
    assert_eq!(p.cpu.take_clobber_notes(), [19, 0, inner as u32 + 8, outer as u32 + 12]);
    // main's x19 is its own: its ret checks nothing, and outer's mark stays.
    p.run_to_end();
    assert_eq!(
        p.numbers(),
        [
            "17 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0",
            "19 outer+20",
            "3 0 0 0 4",
            "0 main 1 0 0 0 1 0 0 4",
            "1 outer 1 0 0 0 1 0 10 4",
            "2 inner 1 0 0 0 1 0 5 4",
        ]
    );
    assert!(p.cpu.take_clobber_notes().is_empty());
    back_retraces(&mut load(NESTED), 15, "two nested returns");
}

/// sum(2) recursing to sum(0), each call keeping its n in x19 and putting
/// the caller's back.
const SUM: &str = r#"
// main prints sum(2) = 2 + 1 + 0.

define(fp, x29)
define(lr, x30)
define(n_r, x19)

        .data
fmt_out:    .string "sum = %ld\n"

        .text
// sum(x0 = n) -> x0 = n + (n - 1) + ... + 0
        .balign 4
        .global sum
sum:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     n_r, [fp, 16]           // keep the caller's x19
        mov     n_r, x0                 // x19 = n
        mov     x0, 0
        cbz     n_r, sum_out            // sum(0) = 0
        sub     x0, n_r, 1
        bl      sum                     // x0 = sum(n - 1)
        add     x0, x0, n_r             // x0 += n
sum_out:
        ldr     n_r, [fp, 16]           // put the caller's x19 back
        ldp     fp, lr, [sp], 32
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x0, 2
        bl      sum
        mov     x1, x0
        ldr     x0, =fmt_out
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_recursions_returns_pop_one_call_each() {
    let mut p = load(SUM);
    let ret = p.label("sum_out") + 8;
    // sum(0)'s ret: sum(1) is innermost again, its record at fp.
    assert_eq!(
        p.numbers_after(ret, 1),
        [
            "29 0 0 0 1 0 0 0 3 0 0 0 0 0 0 0 0",
            "0 main 0 __main_return top-0 top-16 0 top-16 0 4 0 0 -1 -1 0 0 -1 -1",
            "1 sum main+12 main+16 top-16 top-48 top-16 top-48 0 4 0 0 -1 -1 0 0 -1 -1",
            "2 sum sum+28 sum+32 top-48 top-80 top-48 top-80 0 4 0 0 -1 -1 0 0 -1 -1",
            "4 3 0 0 8",
            "0 main 1 1 0 0 1 0 0 0",
            "1 sum 1 1 8 0 2 0 0 0",
            "2 sum 1 1 8 0 1 0 0 0",
            "3 sum 1 0 8 0 0 0 0 8",
        ]
    );
    // sum(1)'s ret: 0 + 1.
    assert_eq!(
        p.numbers_after(ret, 1),
        [
            "33 0 0 0 1 0 0 0 2 0 0 0 0 0 0 0 0",
            "0 main 0 __main_return top-0 top-16 0 top-16 0 4 0 0 -1 -1 0 0 -1 -1",
            "1 sum main+12 main+16 top-16 top-48 top-16 top-48 0 4 0 0 -1 -1 0 0 -1 -1",
            "4 2 0 0 8",
            "0 main 1 1 0 0 1 0 0 0",
            "1 sum 1 1 8 0 2 0 0 0",
            "2 sum 1 0 8 0 1 0 1 8",
            "3 sum 1 0 8 0 0 0 0 8",
        ]
    );
    // sum(2)'s ret: 1 + 2. Each call put x19 back, so none is marked.
    assert_eq!(
        p.numbers_after(ret, 1),
        [
            "37 0 0 0 1 0 0 0 1 0 0 0 0 0 0 0 0",
            "0 main 0 __main_return top-0 top-16 0 top-16 0 4 0 0 -1 -1 0 0 -1 -1",
            "4 1 0 0 8",
            "0 main 1 1 0 0 1 0 0 0",
            "1 sum 1 0 8 0 2 0 3 8",
            "2 sum 1 0 8 0 1 0 1 8",
            "3 sum 1 0 8 0 0 0 0 8",
        ]
    );
    p.run_to_end();
    assert_eq!(String::from_utf8_lossy(&p.cpu.take_stdout()), "sum = 3\n");
    assert_eq!(p.outline(), ["main -> 0", "  sum(2) -> 3", "    sum(1) -> 1", "      sum(0) -> 0"]);
    assert!(p.cpu.take_clobber_notes().is_empty());
    back_retraces(&mut load(SUM), 40, "a recursion's returns");
}

/// Tail calls: a `b` to the program's own function and a `b printf`.
const TAIL: &str = r#"
// twice tail-calls add_self and show tail-calls printf, so each callee
// returns straight to main.

define(fp, x29)
define(lr, x30)

        .data
fmt_out:    .string "%d\n"

        .text
// add_self(w0 = n, w1 = n) -> w0 = 2n
        .balign 4
        .global add_self
add_self:
        add     w0, w0, w1
        ret

// twice(w0 = n) -> w0 = 2n, by a tail call
        .balign 4
        .global twice
twice:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w1, w0
        ldp     fp, lr, [sp], 16
        b       add_self                // add_self returns to twice's caller

// show(w1 = value) prints it, by a tail call
        .balign 4
        .global show
show:
        ldr     x0, =fmt_out
        b       printf                  // printf returns to show's caller

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 21
        bl      twice                   // w0 = 42
        mov     w1, w0
        bl      show
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn tail_calls_return_for_the_caller_that_made_them() {
    let mut p = load(TAIL);
    let (add_self, main) = (p.label("add_self"), p.label("main"));
    // add_self's ret goes to twice's return address, so it pops twice,
    // which returns 42; add_self, entered by a b, has no node.
    assert_eq!(
        p.numbers_after(add_self + 4, 1),
        [
            "11 0 0 0 1 0 0 0 1 0 0 0 0 0 0 0 0",
            "0 main 0 __main_return top-0 top-16 0 top-16 0 4 0 0 -1 -1 0 0 -1 -1",
            "2 1 0 0 4",
            "0 main 1 1 0 0 1 0 0 0",
            "1 twice 1 0 4 0 21 0 42 4",
        ]
    );
    // printf comes back to main with no ret the tracker sees, so show is
    // still drawn as the innermost call, a leaf, while main runs.
    p.run_to(main + 24, 1);
    assert_eq!(
        p.numbers(),
        [
            "18 0 0 0 1 0 0 0 2 0 0 0 0 0 0 0 0",
            "0 main 0 __main_return top-0 top-16 0 top-16 0 4 0 0 -1 -1 0 0 -1 -1",
            "1 show main+20 main+24 top-16 top-16 top-16 0 3 0 0 0 -1 -1 0 0 -1 -1",
            "3 3 0 0 8",
            "0 main 1 1 0 0 1 0 0 0",
            "1 twice 1 0 4 0 21 0 42 4",
            "1 show 1 1 0 0 42 0 0 0",
        ]
    );
    // main's ret matches main below show and ends both: show returns main's 0.
    assert_eq!(
        p.numbers_after(main + 32, 1),
        [
            "21 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0",
            "3 0 0 0 4",
            "0 main 1 0 0 0 1 0 0 4",
            "1 twice 1 0 4 0 21 0 42 4",
            "1 show 1 0 0 0 42 0 0 4",
        ]
    );
    p.run_to_end();
    assert_eq!(String::from_utf8_lossy(&p.cpu.take_stdout()), "42\n");
    assert!(p.cpu.take_clobber_notes().is_empty());
    back_retraces(&mut load(TAIL), 20, "tail calls");
}

/// skip pops jump's frame record on top of returning, so its ret skips
/// jump and lands in main; it also leaves x19 changed, which main reads.
const SKIP_CHANGING_X19: &str = r#"
// jump calls skip, whose ldp pops jump's record, so skip's ret goes
// straight back into main; skip also leaves x19 changed.

define(fp, x29)
define(lr, x30)

        .data
fmt_out:    .string "%ld\n"

        .text
// jump() -> w0 = 7, through skip
        .balign 4
        .global jump
jump:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      skip
        mov     w0, 1                   // never runs
        ldp     fp, lr, [sp], 16
        ret

// skip() -> w0 = 7 (bugs: x19 belongs to the caller; the ldp pops jump's record)
        .balign 4
        .global skip
skip:
        mov     x19, 99
        mov     w0, 7
        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x19, 5
        bl      jump                    // w0 = 7
        add     x1, x19, x0             // reads what skip left in x19: 99 + 7
        ldr     x0, =fmt_out
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

/// Pins a known defect: the skip goes uncaught, and a return that ends two
/// calls checks neither one's x19 to x28, so main's read of the 99 skip
/// left in x19 is not noted (a one-call return is: the nested test above).
#[test]
fn known_defect_a_ret_that_skips_its_caller_is_not_caught_and_leaves_no_x19_note() {
    let mut p = load(SKIP_CHANGING_X19);
    let skip = p.label("skip");
    // skip's ret matches jump's return address: both calls end, no bad
    // return, both nodes return skip's 7, and x19 is not marked.
    assert_eq!(
        p.numbers_after(skip + 12, 1),
        [
            "11 0 0 0 1 0 0 0 1 0 0 0 0 0 0 0 0",
            "0 main 0 __main_return top-0 top-16 0 top-16 0 4 0 0 -1 -1 0 0 -1 -1",
            "3 1 0 0 4",
            "0 main 1 1 0 0 1 0 0 0",
            "1 jump 1 0 0 0 1 0 7 4",
            "2 skip 1 0 0 0 1 0 7 4",
        ]
    );
    p.run_to_end();
    assert_eq!(String::from_utf8_lossy(&p.cpu.take_stdout()), "106\n");
    assert!(p.cpu.take_clobber_notes().is_empty(), "main's add reads x19 unnoted");
    assert_eq!(p.outline(), ["main -> 0", "  jump -> 7", "    skip -> 7"]);
    back_retraces(&mut load(SKIP_CHANGING_X19), 19, "a ret that skips its caller");
}

/// SUM with a bug in its base case: sum(0), three calls deep, aims lr at
/// the epilogue, so its ret lands on sum(1)'s epilogue and goes to no
/// caller's return address.
const STRAY_SUM: &str = r#"
// main prints sum(2), but sum(0) returns into sum's epilogue instead of
// to its caller, so sum(1) never adds its n.

define(fp, x29)
define(lr, x30)
define(n_r, x19)

        .data
fmt_out:    .string "sum = %ld\n"

        .text
// sum(x0 = n) -> x0 = n + (n - 1) + ... + 0
        .balign 4
        .global sum
sum:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     n_r, [fp, 16]           // keep the caller's x19
        mov     n_r, x0                 // x19 = n
        cbz     n_r, sum_base
        sub     x0, n_r, 1
        bl      sum                     // x0 = sum(n - 1)
        add     x0, x0, n_r             // x0 += n
sum_out:
        ldr     n_r, [fp, 16]           // put the caller's x19 back
        ldp     fp, lr, [sp], 32
        ret
sum_base:                               // sum(0) = 0
        mov     x0, 0
        ldr     n_r, [fp, 16]
        ldp     fp, lr, [sp], 32
        ldr     lr, =sum_out            // bug: lr aimed at the epilogue, not the caller
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x0, 2
        bl      sum
        mov     x1, x0
        ldr     x0, =fmt_out
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

/// Pins a known defect: the stray ret leaves sum(0) on the stack, so the
/// next ret, sum(1)'s, pops sum(0) instead and marks x19 as not put back
/// (sum(1) did put it back), and sum(2)'s read of x19 is noted. The ret
/// after that ends sum(1) and sum(2) together, checking neither.
#[test]
fn known_defect_a_stray_ret_three_calls_deep_leaves_a_stale_call_and_a_false_x19_mark() {
    let mut p = load(STRAY_SUM);
    let (sum, epilogue_ret) = (p.label("sum"), p.label("sum_out") + 8);
    // sum(0)'s ret goes to no caller: recorded, the stack and tree kept.
    assert_eq!(
        p.numbers_after(p.label("sum_base") + 16, 1),
        [
            "28 0 0 0 1 28 sum_base+16 sum_out 4 0 3 sum sum+28 4 0 0 0",
            "0 main 0 __main_return top-0 top-16 0 top-16 0 4 0 0 -1 -1 0 0 -1 -1",
            "1 sum main+12 main+16 top-16 top-48 top-16 top-48 0 4 0 0 -1 -1 0 0 -1 -1",
            "2 sum sum+24 sum+28 top-48 top-80 top-48 top-80 0 4 0 0 -1 -1 0 0 -1 -1",
            "3 sum sum+24 sum+28 top-80 top-80 top-80 0 1 4 0 0 -1 -1 0 0 -1 -1",
            "4 4 0 0 8",
            "0 main 1 1 0 0 1 0 0 0",
            "1 sum 1 1 8 0 2 0 0 0",
            "2 sum 1 1 8 0 1 0 0 0",
            "3 sum 1 1 8 0 0 0 0 0",
        ]
    );
    // sum(1)'s ret matches the top, sum(0): sum(0) is popped and x19,
    // back to sum(2)'s 2, differs from the 1 sum(0) was entered with.
    // sum(1) is drawn as just entered while sum(2) runs.
    assert_eq!(
        p.numbers_after(epilogue_ret, 1),
        [
            "31 0 0 0 1 28 sum_base+16 sum_out 3 1 3 sum sum+28 4 0 0 0",
            "0 main 0 __main_return top-0 top-16 0 top-16 0 4 0 0 -1 -1 0 0 -1 -1",
            "1 sum main+12 main+16 top-16 top-48 top-16 top-48 0 4 0 0 -1 -1 0 0 -1 -1",
            "2 sum sum+24 sum+28 top-48 top-48 top-48 0 1 4 0 0 -1 -1 0 0 -1 -1",
            "19 sum_out+8",
            "4 3 0 0 8",
            "0 main 1 1 0 0 1 0 0 0",
            "1 sum 1 1 8 0 2 0 0 0",
            "2 sum 1 1 8 0 1 0 0 0",
            "3 sum 1 0 8 0 0 0 0 8",
        ]
    );
    // sum(2)'s ret matches sum(2) below sum(1) and ends both, each
    // returning sum(2)'s 0 + 2.
    assert_eq!(
        p.numbers_after(epilogue_ret, 1),
        [
            "35 0 0 0 1 28 sum_base+16 sum_out 1 0 3 sum sum+28 4 0 0 0",
            "0 main 0 __main_return top-0 top-16 0 top-16 0 4 0 0 -1 -1 0 0 -1 -1",
            "4 1 0 0 8",
            "0 main 1 1 0 0 1 0 0 0",
            "1 sum 1 0 8 0 2 0 2 8",
            "2 sum 1 0 8 0 1 0 2 8",
            "3 sum 1 0 8 0 0 0 0 8",
        ]
    );
    // [register, read by an instruction, the ret that left it, the reader]:
    // sum(2)'s add.
    assert_eq!(p.cpu.take_clobber_notes(), [19, 0, epilogue_ret as u32, sum as u32 + 28]);
    p.run_to_end();
    assert_eq!(String::from_utf8_lossy(&p.cpu.take_stdout()), "sum = 2\n");
    assert_eq!(p.outline(), ["main -> 0", "  sum(2) -> 2", "    sum(1) -> 2", "      sum(0) -> 0"]);
    back_retraces(&mut load(STRAY_SUM), 43, "a stray ret three calls deep");
}

// ---------------------------------------------------------------------------
// What a broken return should leave: a ret ends the call whose caller's sp,
// fp and return address it leaves in sp, x29 and pc, as AAPCS64 has every
// return do. Each test fails until the unwind follows that rule.
// ---------------------------------------------------------------------------

/// skip's ldp loads jump's record, so its ret leaves sp, fp and pc as main
/// had them at `bl jump`: it ends jump too. A ret that ends more than its
/// own call is a bad return, and main is owed the x19 it had when it
/// called jump.
#[test]
fn a_ret_that_skips_its_caller_is_a_bad_return_and_marks_the_x19_its_caller_is_owed() {
    let mut p = load(SKIP_CHANGING_X19);
    let (skip, main) = (p.label("skip"), p.label("main"));
    assert_eq!(
        p.numbers_after(skip + 12, 1),
        [
            "11 0 0 0 1 11 skip+12 main+16 1 1 2 skip jump+12 0 0 0 0",
            "0 main 0 __main_return top-0 top-16 0 top-16 0 4 0 0 -1 -1 0 0 -1 -1",
            "19 skip+12",
            "3 1 0 0 4",
            "0 main 1 1 0 0 1 0 0 0",
            "1 jump 1 0 0 0 1 0 7 4",
            "2 skip 1 0 0 0 1 0 7 4",
        ]
    );
    p.run_to_end();
    assert_eq!(String::from_utf8_lossy(&p.cpu.take_stdout()), "106\n");
    // [register, read by an instruction, the ret that left it, the reader]:
    // main's add reads the 99.
    assert_eq!(p.cpu.take_clobber_notes(), [19, 0, skip as u32 + 12, main as u32 + 16]);
    assert_eq!(p.outline(), ["main -> 0", "  jump -> 7", "    skip -> 7"]);
    back_retraces(&mut load(SKIP_CHANGING_X19), 19, "a ret that skips its caller");
}

/// SUM whose base case pops sum(1)'s frame as well as its own. Every sum
/// call returns to the same address, so only sp and fp tell that the ret
/// came back to sum(2) and ended sum(1) too.
const SKIP_IN_A_RECURSION: &str = r#"
// main prints sum(2), but sum(0) pops its caller's frame as well as its
// own, so its ret ends sum(1) too and sum(2) adds the n sum(0) put back.

define(fp, x29)
define(lr, x30)
define(n_r, x19)

        .data
fmt_out:    .string "sum = %ld\n"

        .text
// sum(x0 = n) -> x0 = n + (n - 1) + ... + 0
        .balign 4
        .global sum
sum:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     n_r, [fp, 16]           // keep the caller's x19
        mov     n_r, x0                 // x19 = n
        cbz     n_r, sum_base
        sub     x0, n_r, 1
        bl      sum                     // x0 = sum(n - 1)
        add     x0, x0, n_r             // x0 += n
sum_out:
        ldr     n_r, [fp, 16]           // put the caller's x19 back
        ldp     fp, lr, [sp], 32
        ret
sum_base:                               // sum(0) = 0
        mov     x0, 0
        ldr     n_r, [fp, 16]
        ldp     fp, lr, [sp], 32
        ldp     fp, lr, [sp], 32        // bug: pops the caller's frame too
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x0, 2
        bl      sum
        mov     x1, x0
        ldr     x0, =fmt_out
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_ret_that_skips_its_caller_under_one_bl_site_is_caught_by_sp_and_fp() {
    let mut p = load(SKIP_IN_A_RECURSION);
    let sum = p.label("sum");
    // sum(0)'s ret leaves sp and fp as sum(2) had them at its bl: sum(0)
    // and sum(1) both end, and x19 holds the 1 sum(0) put back, not the 2
    // sum(1) owed sum(2).
    assert_eq!(
        p.numbers_after(p.label("sum_base") + 16, 1),
        [
            "28 0 0 0 1 28 sum_base+16 sum+28 2 1 3 sum sum+28 4 0 0 0",
            "0 main 0 __main_return top-0 top-16 0 top-16 0 4 0 0 -1 -1 0 0 -1 -1",
            "1 sum main+12 main+16 top-16 top-48 top-16 top-48 0 4 0 0 -1 -1 0 0 -1 -1",
            "19 sum_base+16",
            "4 2 0 0 8",
            "0 main 1 1 0 0 1 0 0 0",
            "1 sum 1 1 8 0 2 0 0 0",
            "2 sum 1 0 8 0 1 0 0 8",
            "3 sum 1 0 8 0 0 0 0 8",
        ]
    );
    p.run_to_end();
    assert_eq!(String::from_utf8_lossy(&p.cpu.take_stdout()), "sum = 1\n");
    // sum(2)'s add reads the 1.
    assert_eq!(p.cpu.take_clobber_notes(), [19, 0, p.label("sum_base") as u32 + 16, sum as u32 + 28]);
    assert_eq!(p.outline(), ["main -> 0", "  sum(2) -> 1", "    sum(1) -> 0", "      sum(0) -> 0"]);
    back_retraces(&mut load(SKIP_IN_A_RECURSION), 40, "a ret that skips its caller under one bl site");
}

/// sum(0)'s ret goes to no return address, but it leaves sp and fp as
/// sum(1) had them at its bl: sum(0) is over and sum(1) runs on, from its
/// epilogue. Each later ret then ends its own call and checks it.
#[test]
fn a_stray_ret_ends_the_call_it_came_from_and_leaves_no_false_mark() {
    let mut p = load(STRAY_SUM);
    let epilogue_ret = p.label("sum_out") + 8;
    assert_eq!(
        p.numbers_after(p.label("sum_base") + 16, 1),
        [
            "28 0 0 0 1 28 sum_base+16 sum_out 3 0 3 sum sum+28 4 0 0 0",
            "0 main 0 __main_return top-0 top-16 0 top-16 0 4 0 0 -1 -1 0 0 -1 -1",
            "1 sum main+12 main+16 top-16 top-48 top-16 top-48 0 4 0 0 -1 -1 0 0 -1 -1",
            "2 sum sum+24 sum+28 top-48 top-80 top-48 top-80 0 4 0 0 -1 -1 0 0 -1 -1",
            "4 3 0 0 8",
            "0 main 1 1 0 0 1 0 0 0",
            "1 sum 1 1 8 0 2 0 0 0",
            "2 sum 1 1 8 0 1 0 0 0",
            "3 sum 1 0 8 0 0 0 0 8",
        ]
    );
    // sum(1)'s ret ends sum(1), which put x19 back: no mark. It returns the
    // 0 sum(0) left, since the stray ret skipped sum(1)'s add.
    assert_eq!(
        p.numbers_after(epilogue_ret, 1),
        [
            "31 0 0 0 1 28 sum_base+16 sum_out 2 0 3 sum sum+28 4 0 0 0",
            "0 main 0 __main_return top-0 top-16 0 top-16 0 4 0 0 -1 -1 0 0 -1 -1",
            "1 sum main+12 main+16 top-16 top-48 top-16 top-48 0 4 0 0 -1 -1 0 0 -1 -1",
            "4 2 0 0 8",
            "0 main 1 1 0 0 1 0 0 0",
            "1 sum 1 1 8 0 2 0 0 0",
            "2 sum 1 0 8 0 1 0 0 8",
            "3 sum 1 0 8 0 0 0 0 8",
        ]
    );
    // sum(2)'s ret ends sum(2) alone: 0 + 2.
    assert_eq!(
        p.numbers_after(epilogue_ret, 1),
        [
            "35 0 0 0 1 28 sum_base+16 sum_out 1 0 3 sum sum+28 4 0 0 0",
            "0 main 0 __main_return top-0 top-16 0 top-16 0 4 0 0 -1 -1 0 0 -1 -1",
            "4 1 0 0 8",
            "0 main 1 1 0 0 1 0 0 0",
            "1 sum 1 0 8 0 2 0 2 8",
            "2 sum 1 0 8 0 1 0 0 8",
            "3 sum 1 0 8 0 0 0 0 8",
        ]
    );
    assert!(p.cpu.take_clobber_notes().is_empty(), "every call put x19 back");
    p.run_to_end();
    assert_eq!(String::from_utf8_lossy(&p.cpu.take_stdout()), "sum = 2\n");
    assert_eq!(p.outline(), ["main -> 0", "  sum(2) -> 2", "    sum(1) -> 0", "      sum(0) -> 0"]);
    back_retraces(&mut load(STRAY_SUM), 43, "a stray ret three calls deep");
}

/// show's `b printf` leaves lr as main's `bl show` set it, so printf's
/// return to lr is show's return: it leaves sp, fp and pc as main had them
/// at the call, and show returns what printf returned.
#[test]
fn a_tail_call_to_a_library_function_ends_when_the_library_returns() {
    let mut p = load(TAIL);
    let main = p.label("main");
    p.run_to(main + 24, 1);
    assert_eq!(
        p.numbers(),
        [
            "18 0 0 0 1 0 0 0 1 0 0 0 0 0 0 0 0",
            "0 main 0 __main_return top-0 top-16 0 top-16 0 4 0 0 -1 -1 0 0 -1 -1",
            "3 1 0 0 8",
            "0 main 1 1 0 0 1 0 0 0",
            "1 twice 1 0 4 0 21 0 42 4",
            "1 show 1 0 0 0 42 0 3 8",
        ]
    );
    // main's ret ends main alone.
    assert_eq!(
        p.numbers_after(main + 32, 1),
        [
            "21 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0",
            "3 0 0 0 4",
            "0 main 1 0 0 0 1 0 0 4",
            "1 twice 1 0 4 0 21 0 42 4",
            "1 show 1 0 0 0 42 0 3 8",
        ]
    );
    p.run_to_end();
    assert_eq!(String::from_utf8_lossy(&p.cpu.take_stdout()), "42\n");
    assert!(p.cpu.take_clobber_notes().is_empty());
    back_retraces(&mut load(TAIL), 21, "a tail call to printf");
}

/// bump pops a frame record it never pushed: main's. Its ret then leaves
/// sp, fp and pc as the C runtime had them at main's start, so it ends
/// main too, and the program exits with bump's w0 before its printf.
const SKIP_PAST_MAIN: &str = r#"
// main calls bump, whose stray ldp pops main's frame record, so bump's
// ret ends main too and the program exits before its printf.

define(fp, x29)
define(lr, x30)

        .data
fmt_out:    .string "n = %d\n"

        .text
// bump(w0 = n) -> w0 = n + 1 (bug: pops a frame it never pushed)
        .balign 4
        .global bump
bump:
        add     w0, w0, 1
        ldp     fp, lr, [sp], 16        // bug: bump pushed nothing
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 10
        bl      bump
        mov     w1, w0
        ldr     x0, =fmt_out
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_ret_that_skips_main_is_a_bad_return_though_the_program_then_exits() {
    let mut p = load(SKIP_PAST_MAIN);
    let bump = p.label("bump");
    assert_eq!(
        p.numbers_after(bump + 8, 1),
        [
            "7 0 0 0 1 7 bump+8 __main_return 0 0 1 bump main+16 0 0 0 0",
            "2 0 0 0 4",
            "0 main 1 0 0 0 1 0 11 4",
            "1 bump 1 0 4 0 10 0 11 4",
        ]
    );
    p.run_to_end();
    assert_eq!(p.cpu.take_stdout(), b"", "printf never runs");
    assert_eq!(p.cpu.exit_code(), Some(11), "main's exit status is bump's w0");
    back_retraces(&mut load(SKIP_PAST_MAIN), 7, "a ret that skips main");
}

// ---------------------------------------------------------------------------
// Returns no `ret` makes: each ends its call or leaves the stack as it is,
// and none is a bad return.
// ---------------------------------------------------------------------------

/// read_n tail-calls scanf and read_c tail-calls getchar, so each library
/// function returns straight to main, whether or not it waited for input.
const TAIL_READS: &str = r#"
// read_n and read_c read by tail calls, so scanf and getchar return
// straight to main.

define(fp, x29)
define(lr, x30)

        .data
n_m:        .word 0
fmt_in:     .string "%d"
fmt_out:    .string "%d %d\n"

        .text
// read_n() reads an int into n_m, by a tail call
        .balign 4
        .global read_n
read_n:
        ldr     x0, =fmt_in
        ldr     x1, =n_m
        b       scanf                   // scanf returns to read_n's caller

// read_c() -> w0 = the next character, by a tail call
        .balign 4
        .global read_c
read_c:
        b       getchar                 // getchar returns to read_c's caller

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      read_n
        bl      read_c                  // w0 = the newline after the number
        mov     w2, w0
        ldr     x0, =n_m
        ldr     w1, [x0]
        ldr     x0, =fmt_out
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_tail_call_to_scanf_or_getchar_ends_when_it_returns_even_after_waiting_for_input() {
    let mut p = load(TAIL_READS);
    let main = p.label("main");
    p.cpu.push_stdin(b"42\n");
    p.cpu.close_stdin();
    p.run_to(main + 12, 1);
    assert_eq!(p.cpu.call_stack().depth(), 1, "scanf's return ended read_n");
    p.run_to(main + 16, 1);
    assert_eq!(p.cpu.call_stack().depth(), 1, "getchar's return ended read_c");
    p.run_to_end();
    assert!(String::from_utf8_lossy(&p.cpu.take_stdout()).ends_with("42 10\n"));
    assert_eq!(p.outline(), ["main -> 0", "  read_n -> 1", "  read_c -> 10"]);
    assert_eq!(p.cpu.call_stack().bad_return().step, 0);
    // No input yet: scanf waits, and its return still ends read_n.
    let mut p = load(TAIL_READS);
    p.cpu.run_until_break(1_000).expect("run");
    assert!(p.cpu.is_blocked(), "scanf waits for input");
    p.cpu.push_stdin(b"42\n");
    p.cpu.close_stdin();
    p.cpu.step().expect("scanf again, now with input");
    assert_eq!(p.cpu.regs.read_pc(), main + 12, "scanf returned to main");
    assert_eq!(p.cpu.call_stack().depth(), 1, "scanf's return after the wait ended read_n");
    let mut p = load(TAIL_READS);
    p.cpu.push_stdin(b"42\n");
    p.cpu.close_stdin();
    back_retraces(&mut p, 20, "two tail calls into library reads");
}

/// sort3 tail-calls qsort, which runs the program's comparator and then
/// returns straight to main.
const TAIL_QSORT: &str = r#"
// sort3 sorts main's three longs by a tail call to qsort, which returns
// straight to main once its comparisons are done.

define(fp, x29)
define(lr, x30)

        .data
nums_m:     .dword 30, 10, 20
fmt_out:    .string "%ld %ld %ld\n"

        .text
// cmp_long(x0 = &a, x1 = &b) -> w0 = -1, 0 or 1
        .balign 4
        .global cmp_long
cmp_long:
        ldr     x2, [x0]
        ldr     x3, [x1]
        cmp     x2, x3
        cset    w0, gt                  // 1 when a > b
        csinv   w0, w0, wzr, ge         // -1 when a < b
        ret

// sort3(x0 = array of three longs), by a tail call
        .balign 4
        .global sort3
sort3:
        mov     x1, 3
        mov     x2, 8
        ldr     x3, =cmp_long
        b       qsort                   // qsort returns to sort3's caller

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        ldr     x0, =nums_m
        bl      sort3
        ldr     x9, =nums_m
        ldr     x1, [x9]
        ldr     x2, [x9, 8]
        ldr     x3, [x9, 16]
        ldr     x0, =fmt_out
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_tail_call_to_qsort_ends_when_qsort_returns_after_its_comparisons() {
    let mut p = load(TAIL_QSORT);
    let main = p.label("main");
    p.run_to(main + 16, 1);
    assert_eq!(p.cpu.call_stack().depth(), 1, "qsort's return ended sort3");
    assert_eq!(p.cpu.call_stack().bad_return().step, 0);
    let steps = p.cpu.steps_taken() as usize + 2;
    p.run_to_end();
    assert_eq!(String::from_utf8_lossy(&p.cpu.take_stdout()), "10 20 30\n");
    assert_eq!(p.cpu.call_stack().bad_return().step, 0);
    back_retraces(&mut load(TAIL_QSORT), steps, "a tail call into qsort");
}

/// minus21 returns through x16, which `br x16` jumps to as `ret` would.
const RETURN_THROUGH_X16: &str = r#"
// minus21 returns through x16 instead of x30.

define(fp, x29)
define(lr, x30)

        .data
fmt_out:    .string "%d\n"

        .text
// minus21(w0 = n) -> w0 = n - 21, returning through x16
        .balign 4
        .global minus21
minus21:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        sub     w0, w0, 21
        ldp     fp, x16, [sp], 16       // the way back into x16
        br      x16                     // back to the caller, as ret would

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 42
        bl      minus21
        mov     w1, w0
        ldr     x0, =fmt_out
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_return_through_x16_ends_its_call() {
    let mut p = load(RETURN_THROUGH_X16);
    let main = p.label("main");
    p.run_to(main + 16, 1);
    assert_eq!(p.cpu.call_stack().depth(), 1, "br x16 ended minus21");
    p.run_to_end();
    assert_eq!(String::from_utf8_lossy(&p.cpu.take_stdout()), "21\n");
    assert_eq!(p.cpu.call_stack().bad_return().step, 0, "no return went astray");
    assert_eq!(p.outline(), ["main -> 0", "  minus21(42) -> 21"]);
    back_retraces(&mut load(RETURN_THROUGH_X16), 12, "a return through x16");
}

/// twice keeps main's way back in x9 and calls add_one by hand: `adr lr`,
/// then `b`. add_one's ret goes to no return address the stack knows, as
/// today; twice has no frame, so nothing shows that twice is over.
const HAND_MADE_CALL: &str = r#"
// twice calls add_one by hand (adr lr, then b), keeping main's way back
// in x9.

define(fp, x29)
define(lr, x30)

        .data
fmt_out:    .string "%d\n"

        .text
// add_one(w0 = n) -> w0 = n + 1
        .balign 4
        .global add_one
add_one:
        add     w0, w0, 1
        ret

// twice(w0 = n) -> w0 = (n + 1) * 2
        .balign 4
        .global twice
twice:
        mov     x9, lr                  // keep the way back to main
        adr     lr, twice_back          // a call made by hand
        b       add_one
twice_back:
        add     w0, w0, w0
        mov     lr, x9
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 20
        bl      twice
        mov     w1, w0
        ldr     x0, =fmt_out
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_hand_made_call_is_one_bad_return_as_today_and_never_ends_its_caller_early() {
    let mut p = load(HAND_MADE_CALL);
    let (add_one, main) = (p.label("add_one"), p.label("main"));
    // add_one's ret reaches no return address the stack holds: recorded,
    // and twice stays the call running.
    p.run_to(add_one + 4, 1);
    p.cpu.step().expect("add_one's ret");
    let bad = p.cpu.call_stack().bad_return();
    assert_eq!((bad.pc, bad.target), (add_one + 4, p.label("twice_back")));
    assert_eq!(p.cpu.call_stack().depth(), 2, "twice is still running");
    // twice's own ret ends twice, with no second bad return.
    p.run_to(main + 16, 1);
    assert_eq!(p.cpu.call_stack().depth(), 1);
    p.run_to_end();
    assert_eq!(String::from_utf8_lossy(&p.cpu.take_stdout()), "42\n");
    assert_eq!(p.cpu.call_stack().bad_return(), bad, "one bad return only");
}

/// leaf has no frame and aims lr past outer's next instruction, so its ret
/// goes to no return address; sp and fp cannot show whether leaf is over.
const FRAMELESS_STRAY: &str = r#"
// leaf returns into outer's epilogue instead of to its caller, and has
// no frame of its own.

define(fp, x29)
define(lr, x30)

        .text
// leaf() -> w0 = 5 (bug: lr aimed at outer's epilogue)
        .balign 4
        .global leaf
leaf:
        mov     w0, 5
        ldr     lr, =outer_out
        ret

// outer() -> w0 = leaf() + 1, but leaf skips the add
        .balign 4
        .global outer
outer:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      leaf
        add     w0, w0, 1               // never runs
outer_out:
        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      outer
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_stray_ret_from_a_function_with_no_frame_is_one_bad_return() {
    let mut p = load(FRAMELESS_STRAY);
    let (leaf, main) = (p.label("leaf"), p.label("main"));
    p.run_to(leaf + 8, 1);
    p.cpu.step().expect("leaf's ret");
    let bad = p.cpu.call_stack().bad_return();
    assert_eq!((bad.pc, bad.target), (leaf + 8, p.label("outer_out")));
    // outer's ret ends outer, and leaf with it, with no second bad return.
    p.run_to(main + 12, 1);
    assert_eq!(p.cpu.call_stack().depth(), 1);
    assert_eq!(p.cpu.call_stack().bad_return(), bad, "one bad return only");
    p.run_to_end();
    assert_eq!(p.outline(), ["main -> 5", "  outer -> 5", "    leaf -> 5"]);
    back_retraces(&mut load(FRAMELESS_STRAY), 12, "a stray ret from a function with no frame");
}

/// minus21 returns with `ret x16`: a ret through another register is still
/// a ret.
const RET_THROUGH_X16: &str = r#"
// minus21 returns with ret x16 instead of a plain ret.

define(fp, x29)
define(lr, x30)

        .data
fmt_out:    .string "%d\n"

        .text
// minus21(w0 = n) -> w0 = n - 21, returning with ret x16
        .balign 4
        .global minus21
minus21:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        sub     w0, w0, 21
        ldp     fp, x16, [sp], 16       // the way back into x16
        ret     x16

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     w0, 42
        bl      minus21
        mov     w1, w0
        ldr     x0, =fmt_out
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_ret_through_x16_ends_its_call() {
    let mut p = load(RET_THROUGH_X16);
    let main = p.label("main");
    p.run_to(main + 16, 1);
    assert_eq!(p.cpu.call_stack().depth(), 1, "ret x16 ended minus21");
    p.run_to_end();
    assert_eq!(String::from_utf8_lossy(&p.cpu.take_stdout()), "21\n");
    assert_eq!(p.cpu.call_stack().bad_return().step, 0);
    assert_eq!(p.outline(), ["main -> 0", "  minus21(42) -> 21"]);
}

/// walk(2), back from walk(1), jumps with `br` to the label right after
/// its own `bl walk`: the address every walk call returns to, but reached
/// with walk(2)'s frame still pushed, so it is a jump, not a return.
const BR_TO_A_RETURN_ADDRESS: &str = r#"
// walk(n) counts its calls; walk(2) jumps back to the label after its bl
// once, with a br, which adds one more.

define(fp, x29)
define(lr, x30)
define(n_r, x19)

        .data
fmt_out:    .string "%ld\n"

        .text
// walk(x0 = n) -> x0 = n, plus one for the jump in walk(2)
        .balign 4
        .global walk
walk:
        stp     fp, lr, [sp, -32]!
        mov     fp, sp
        str     n_r, [fp, 16]           // keep the caller's x19
        mov     n_r, x0                 // x19 = n
        mov     x0, 0
        cbz     n_r, walk_done          // walk(0) = 0
        sub     x0, n_r, 1
        bl      walk                    // x0 = walk(n - 1)
walk_back:                              // where every walk call returns
        add     x0, x0, 1
        cmp     n_r, 2
        b.ne    walk_done
        mov     n_r, 20                 // only once
        adr     x9, walk_back
        br      x9                      // a jump to walk_back, not a return
walk_done:
        ldr     n_r, [fp, 16]           // put the caller's x19 back
        ldp     fp, lr, [sp], 32
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        mov     x0, 3
        bl      walk
        mov     x1, x0
        ldr     x0, =fmt_out
        bl      printf
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;

#[test]
fn a_br_to_the_label_after_a_recursive_bl_ends_no_call() {
    let mut p = load(BR_TO_A_RETURN_ADDRESS);
    let jump = p.label("walk_done") - 4;
    // walk(3) -> walk(2) -> walk(1) -> walk(0); walk(1) has returned, so
    // the stack is main, walk(3) and walk(2) at the br.
    p.run_to(jump, 1);
    assert_eq!(p.cpu.call_stack().depth(), 3);
    p.cpu.step().expect("br x9");
    assert_eq!(p.cpu.regs.read_pc(), p.label("walk_back"));
    assert_eq!(p.cpu.call_stack().depth(), 3, "the br ended no call");
    p.run_to_end();
    assert_eq!(String::from_utf8_lossy(&p.cpu.take_stdout()), "4\n");
    assert_eq!(p.cpu.call_stack().bad_return().step, 0);
    assert_eq!(p.outline(), ["main -> 0", "  walk(3) -> 4", "    walk(2) -> 3", "      walk(1) -> 1", "        walk(0) -> 0"]);
}

/// Every library call goes through its trampoline, `ldr x16, <slot>` then
/// `br x16` into the stub. That br ends no call, whatever the stack holds:
/// a comparator's record holds a stub address as its return address.
#[test]
fn a_library_calls_trampoline_branch_ends_no_call() {
    for name in ["80_qsort_bsearch.s", "80_qsort_bsearch.O2.s", "82_callbacks_generic.s", "82_callbacks_generic.O2plain.s"] {
        let mut p = load(&read(&format!("emulator/tests/c-corpus/{name}")));
        p.cpu.close_stdin();
        let trampolines = p.image.trampoline_base..p.image.trampoline_base + 8 * p.image.trampoline_names.len() as u64;
        let mut branches = 0;
        while !p.cpu.is_halted() {
            let pc = p.cpu.regs.read_pc();
            let before = (p.cpu.call_stack().depth(), p.cpu.call_stack().bad_return().step);
            p.cpu.step().expect("step");
            if trampolines.contains(&pc) && (pc - trampolines.start) % 8 == 4 {
                branches += 1;
                let after = (p.cpu.call_stack().depth(), p.cpu.call_stack().bad_return().step);
                assert_eq!(after, before, "{name}: the trampoline's br at {pc:#x}");
            }
        }
        assert!(branches > 10, "{name}: {branches} library calls");
    }
}
