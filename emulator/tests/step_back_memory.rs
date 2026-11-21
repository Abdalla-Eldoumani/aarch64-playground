//! What the step-back history holds, measured at the allocator: this test
//! binary counts every byte it has allocated and not yet freed, and the
//! high-water mark of that count while a program runs. Each program is
//! run at three sizes, and the memory the run held at its peak, over what
//! it held once loaded, has to stay in proportion to what its steps wrote.

use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering::Relaxed};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::pipeline::assemble_hosted;

struct Counting;

static LIVE: AtomicUsize = AtomicUsize::new(0);
static PEAK: AtomicUsize = AtomicUsize::new(0);

fn grew(size: usize) {
    let now = LIVE.fetch_add(size, Relaxed) + size;
    PEAK.fetch_max(now, Relaxed);
}

unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let p = unsafe { System.alloc(layout) };
        if !p.is_null() {
            grew(layout.size());
        }
        p
    }

    unsafe fn dealloc(&self, p: *mut u8, layout: Layout) {
        unsafe { System.dealloc(p, layout) };
        LIVE.fetch_sub(layout.size(), Relaxed);
    }

    unsafe fn realloc(&self, p: *mut u8, layout: Layout, size: usize) -> *mut u8 {
        let q = unsafe { System.realloc(p, layout, size) };
        if !q.is_null() {
            // Counted as both buffers at once, as a copying realloc holds them.
            grew(size);
            LIVE.fetch_sub(layout.size(), Relaxed);
        }
        q
    }
}

#[global_allocator]
static COUNTING: Counting = Counting;

/// The counters are process-wide, so the tests take turns.
static ONE_AT_A_TIME: Mutex<()> = Mutex::new(());

const KIB: usize = 1024;
const MIB: usize = 1024 * KIB;

/// Load `src`, let `setup` adjust the machine, and run it to its end.
/// Returns the most memory the run held over what the loaded machine held.
fn peak_while_running(src: &str, setup: impl FnOnce(&mut Cpu)) -> usize {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(src, &cpu.host).unwrap_or_else(|e| panic!("assembly failed: {e}"));
    cpu.load_linked_image(&image).expect("load failed");
    setup(&mut cpu);
    let base = LIVE.load(Relaxed);
    PEAK.store(base, Relaxed);
    let started = Instant::now();
    while !cpu.is_halted() {
        let r = cpu.run_until_break(1_000_000).expect("run");
        assert!(r.error.is_none(), "the program ends on its own: {:?}", r.error);
        assert!(started.elapsed() < Duration::from_secs(20), "the run took {:?}", started.elapsed());
    }
    let peak = PEAK.load(Relaxed) - base;
    drop(cpu);
    peak
}

fn mib(bytes: usize) -> String {
    format!("{:.2} MiB", bytes as f64 / MIB as f64)
}

/// `copies` memmoves of `bytes` bytes, each one byte up from where it
/// reads, so the copy walks down from its last byte.
fn backward_copies(copies: usize, bytes: usize) -> String {
    format!(
        r#"
        .bss
buf:    .skip   {room}
        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        stp     x19, x20, [sp, -16]!
        mov     x19, {copies}
copy:
        ldr     x1, =buf
        add     x0, x1, 1
        ldr     x2, ={bytes}
        bl      memmove
        subs    x19, x19, 1
        b.ne    copy
        mov     w0, 0
        ldp     x19, x20, [sp], 16
        ldp     x29, x30, [sp], 16
        ret
"#,
        room = bytes + 16
    )
}

#[test]
fn a_backward_copy_is_kept_at_about_the_size_it_wrote() {
    let _turn = ONE_AT_A_TIME.lock().unwrap_or_else(|e| e.into_inner());
    let bytes = 256 * KIB;
    let points: Vec<(usize, usize)> =
        [1, 2, 4].iter().map(|&n| (n, peak_while_running(&backward_copies(n, bytes), |_| {}))).collect();
    let over: Vec<_> = points.iter().filter(|&&(n, peak)| peak > 2 * n * bytes + MIB).collect();
    assert!(
        over.is_empty(),
        "(copies of 256 KiB, peak) over twice the bytes written plus 1 MiB: {:?}",
        over.iter().map(|&&(n, p)| (n, mib(p))).collect::<Vec<_>>()
    );
}

#[test]
fn a_backward_copy_with_the_ring_paused_holds_no_log_of_its_size() {
    let _turn = ONE_AT_A_TIME.lock().unwrap_or_else(|e| e.into_inner());
    let points: Vec<(usize, usize)> = [128 * KIB, 256 * KIB, 512 * KIB]
        .iter()
        .map(|&bytes| (bytes, peak_while_running(&backward_copies(1, bytes), |cpu| cpu.snapshots_paused = true)))
        .collect();
    // The pages the copy maps are about its size again.
    let over: Vec<_> = points.iter().filter(|&&(bytes, peak)| peak > 2 * bytes).collect();
    assert!(
        over.is_empty(),
        "(bytes copied, peak) over twice the bytes copied with no history kept: {:?}",
        over.iter().map(|&&(b, p)| (mib(b), mib(p))).collect::<Vec<_>>()
    );
}

/// `fills` memsets of one heap buffer of `bytes` bytes, a few steps apart.
fn close_fills(fills: usize, bytes: usize) -> String {
    format!(
        r#"
        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        stp     x19, x20, [sp, -16]!
        ldr     x0, ={bytes}
        bl      malloc
        mov     x19, x0
        mov     x20, {fills}
fill:
        mov     x0, x19
        mov     w1, w20
        ldr     x2, ={bytes}
        bl      memset
        subs    x20, x20, 1
        b.ne    fill
        mov     w0, 0
        ldp     x19, x20, [sp], 16
        ldp     x29, x30, [sp], 16
        ret
"#
    )
}

#[test]
fn fills_close_together_stop_adding_to_the_history_past_its_budget() {
    let _turn = ONE_AT_A_TIME.lock().unwrap_or_else(|e| e.into_inner());
    // Nine fills already hold more than the budget the ring keeps.
    let bytes = 4 * MIB;
    let points: Vec<(usize, usize)> =
        [9, 10, 12].iter().map(|&n| (n, peak_while_running(&close_fills(n, bytes), |_| {}))).collect();
    let first = points[0].1;
    assert!(
        points.iter().all(|&(_, peak)| peak <= first + bytes / 2),
        "(fills of 4 MiB, peak) still growing past 9 fills: {:?}",
        points.iter().map(|&(n, p)| (n, mib(p))).collect::<Vec<_>>()
    );
}

/// `fills` memsets of `bytes` bytes, 200 steps apart, so each fill's frame
/// has left the ring's 128 by the next.
fn spaced_fills(fills: usize, bytes: usize) -> String {
    format!(
        r#"
        .bss
buf:    .skip   {bytes}
        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        stp     x19, x20, [sp, -16]!
        mov     x19, {fills}
fill:
        ldr     x0, =buf
        mov     w1, w19
        ldr     x2, ={bytes}
        bl      memset
        mov     x20, 100
spin:
        subs    x20, x20, 1
        b.ne    spin
        subs    x19, x19, 1
        b.ne    fill
        mov     w0, 0
        ldp     x19, x20, [sp], 16
        ldp     x29, x30, [sp], 16
        ret
"#
    )
}

#[test]
fn fills_far_apart_do_not_pile_up_in_the_history() {
    let _turn = ONE_AT_A_TIME.lock().unwrap_or_else(|e| e.into_inner());
    let bytes = 512 * KIB;
    let points: Vec<(usize, usize)> =
        [4, 8, 16].iter().map(|&n| (n, peak_while_running(&spaced_fills(n, bytes), |_| {}))).collect();
    let over: Vec<_> = points.iter().filter(|&&(_, peak)| peak > 2 * bytes + MIB / 2).collect();
    assert!(
        over.is_empty(),
        "(fills of 512 KiB, peak) over two fills' worth plus 512 KiB: {:?}",
        over.iter().map(|&&(n, p)| (n, mib(p))).collect::<Vec<_>>()
    );
}

/// A comparator that calls qsort again with the arguments it was given,
/// `depth` times, then exits with every call still in flight.
fn nested_sorts(depth: usize) -> String {
    format!(
        r#"
        .data
pair:   .dword  2, 1
        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        ldr     x19, ={depth}
        ldr     x0, =pair
        mov     x1, 2
        mov     x2, 8
        adr     x3, cmp
        bl      qsort
        mov     w0, 1
        bl      exit
cmp:
        subs    x19, x19, 1
        b.eq    stop
        bl      qsort
stop:
        mov     w0, 0
        bl      exit
"#
    )
}

#[test]
fn nested_sorts_do_not_copy_their_calls_into_every_frame() {
    let _turn = ONE_AT_A_TIME.lock().unwrap_or_else(|e| e.into_inner());
    let points: Vec<(usize, usize)> =
        [1000, 2000, 4000].iter().map(|&d| (d, peak_while_running(&nested_sorts(d), |_| {}))).collect();
    let over: Vec<_> = points.iter().filter(|&&(_, peak)| peak > 2 * MIB).collect();
    assert!(
        over.is_empty(),
        "(nested qsort calls, peak) over 2 MiB: {:?}",
        over.iter().map(|&&(d, p)| (d, mib(p))).collect::<Vec<_>>()
    );
}
