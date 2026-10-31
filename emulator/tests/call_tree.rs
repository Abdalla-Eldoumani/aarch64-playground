//! The call tree behind the stack frames view's list of calls: every call
//! a program makes, returned ones included, with runs of one function
//! folded past their first four, at most 200 nodes and 12 deep, counted
//! past that. Read through the crate's public surface (the call stack's
//! tree, the frame layout, the frames view's numbers). Every expected tree
//! is worked out by hand from the program's text; the C programs' values
//! come from their printed output and from the stack's own arithmetic.

use std::path::PathBuf;

use aarch64_emulator::cpu::{Cpu, STACK_FLOOR};
use aarch64_emulator::frames::layout::{frame_layout, FrameLayout};
use aarch64_emulator::frames::tree::{CallTree, MAX_TREE_DEPTH, MAX_TREE_NODES, RUN_SHOWN};
use aarch64_emulator::frames::{frame_view, FrameView, MAX_ACTIVATIONS, RUNTIME_CALL};
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
    // only counts ("507,905 deeper calls not shown") add up to the same.
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
