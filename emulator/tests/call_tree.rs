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
use aarch64_emulator::frames::{frame_view, FrameView, RUNTIME_CALL};
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
    /// every call it stands for returned, `*` on the current call and
    /// `...` on one still waiting for a callee.
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
