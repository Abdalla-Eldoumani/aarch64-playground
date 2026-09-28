//! qsort and bsearch: the libc calls that call back into the program.
//!
//! A comparator is the program's own code, so it runs on the emulated CPU,
//! one step at a time, breakpoints and all. Each call here does one
//! comparison: it points x0 and x1 at two elements, sets the link register
//! to its own stub, and answers `HostOutcome::Call(comparator)`. The
//! comparator's `ret` lands back on the stub, which reads w0 and asks for
//! the next comparison or returns to the caller. The state lives in every
//! snapshot, so step-back can rewind into the middle of a sort.

use crate::errors::EmuError;
use crate::hosted::{HostContext, HostOutcome};

/// The in-flight calls, innermost last (a comparator may itself sort), and
/// the address of the stub being dispatched, which is where a comparator
/// returns to.
#[derive(Debug, Clone, Default)]
pub struct CallbackState {
    pub stub_pc: u64,
    jobs: Vec<Job>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Kind {
    Sort,
    Search,
}

/// One qsort or bsearch in progress. `lo..hi` is the range still being
/// searched: the insertion point for element `next` when sorting, the
/// candidates for `key` when searching.
#[derive(Debug, Clone)]
struct Job {
    kind: Kind,
    base: u64,
    count: u64,
    size: u64,
    compare: u64,
    key: u64,
    caller: u64,
    next: u64,
    lo: u64,
    hi: u64,
}

impl Job {
    fn mid(&self) -> u64 {
        self.lo + (self.hi - self.lo) / 2
    }
}

/// The comparator just returned here if the link register names this stub
/// and the innermost job is ours; anything else is a fresh call.
fn resuming(ctx: &HostContext<'_>, kind: Kind) -> bool {
    ctx.regs.read_gpr(30, true) == ctx.callbacks.stub_pc
        && ctx.callbacks.jobs.last().is_some_and(|job| job.kind == kind)
}

/// Hand the comparator its two arguments and send the CPU there.
fn compare(ctx: &mut HostContext<'_>, left: u64, right: u64) -> HostOutcome {
    let job = ctx.callbacks.jobs.last().expect("a job is in flight");
    let compare = job.compare;
    ctx.regs.write_gpr(0, true, left);
    ctx.regs.write_gpr(1, true, right);
    ctx.regs.write_gpr(30, true, ctx.callbacks.stub_pc);
    HostOutcome::Call(compare)
}

/// Finish the innermost job: the result in x0 and the real caller's
/// return address back in the link register.
fn finish(ctx: &mut HostContext<'_>, result: u64) -> HostOutcome {
    let job = ctx.callbacks.jobs.pop().expect("a job is in flight");
    ctx.regs.write_gpr(0, true, result);
    ctx.regs.write_gpr(30, true, job.caller);
    HostOutcome::Continue
}

/// qsort(base, count, size, compare). A binary insertion sort: each
/// element is placed by a binary search over the sorted run before it, so
/// the comparator runs about n log n times. Equal elements keep their
/// order, which C allows but does not promise.
// The moves are O(n^2) bytes, charged as bulk work; a merge sort would
// need a scratch buffer in guest memory, worth it only for arrays far past
// what a course program sorts.
pub fn qsort(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    if resuming(ctx, Kind::Sort) {
        let order = ctx.regs.read_gpr(0, false) as i32;
        let job = ctx.callbacks.jobs.last_mut().expect("a job is in flight");
        let mid = job.mid();
        if order < 0 {
            job.hi = mid;
        } else {
            job.lo = mid + 1;
        }
    } else {
        let (base, count, size) =
            (ctx.regs.read_gpr(0, true), ctx.regs.read_gpr(1, true), ctx.regs.read_gpr(2, true));
        if count < 2 || size == 0 {
            return Ok(HostOutcome::Continue);
        }
        ctx.callbacks.jobs.push(Job {
            kind: Kind::Sort,
            base,
            count,
            size,
            compare: ctx.regs.read_gpr(3, true),
            key: 0,
            caller: ctx.regs.read_gpr(30, true),
            next: 1,
            lo: 0,
            hi: 1,
        });
    }
    loop {
        let job = ctx.callbacks.jobs.last().expect("a job is in flight").clone();
        if job.lo < job.hi {
            let at = |index: u64| job.base.wrapping_add(index.wrapping_mul(job.size));
            return Ok(compare(ctx, at(job.next), at(job.mid())));
        }
        insert(ctx, &job)?;
        let job = ctx.callbacks.jobs.last_mut().expect("a job is in flight");
        job.next += 1;
        job.lo = 0;
        job.hi = job.next;
        if job.next >= job.count {
            return Ok(finish(ctx, 0));
        }
    }
}

/// Move element `next` down to slot `lo`, sliding the run between them
/// up by one element.
fn insert(ctx: &mut HostContext<'_>, job: &Job) -> Result<(), EmuError> {
    if job.lo == job.next {
        return Ok(());
    }
    let size = job.size;
    let from = job.base.wrapping_add(job.next.wrapping_mul(size));
    let to = job.base.wrapping_add(job.lo.wrapping_mul(size));
    let mut held = Vec::new();
    for i in 0..size {
        held.push(ctx.mem.read_u8(from.wrapping_add(i))?);
    }
    let mut k = from;
    while k > to {
        k -= 1;
        let b = ctx.mem.read_u8(k)?;
        ctx.mem.write_u8(k + size, b)?;
    }
    for (i, b) in held.iter().enumerate() {
        ctx.mem.write_u8(to.wrapping_add(i as u64), *b)?;
    }
    Ok(())
}

/// bsearch(key, base, count, size, compare), probing in glibc's order, so
/// a key that matches several elements finds the one the servers find.
pub fn bsearch(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    if resuming(ctx, Kind::Search) {
        let order = ctx.regs.read_gpr(0, false) as i32;
        let job = ctx.callbacks.jobs.last_mut().expect("a job is in flight");
        let mid = job.mid();
        match order {
            0 => {
                let found = job.base.wrapping_add(mid.wrapping_mul(job.size));
                return Ok(finish(ctx, found));
            }
            _ if order < 0 => job.hi = mid,
            _ => job.lo = mid + 1,
        }
    } else {
        ctx.callbacks.jobs.push(Job {
            kind: Kind::Search,
            base: ctx.regs.read_gpr(1, true),
            count: ctx.regs.read_gpr(2, true),
            size: ctx.regs.read_gpr(3, true),
            compare: ctx.regs.read_gpr(4, true),
            key: ctx.regs.read_gpr(0, true),
            caller: ctx.regs.read_gpr(30, true),
            next: 0,
            lo: 0,
            hi: ctx.regs.read_gpr(2, true),
        });
    }
    let job = ctx.callbacks.jobs.last().expect("a job is in flight").clone();
    if job.lo >= job.hi {
        return Ok(finish(ctx, 0));
    }
    let probe = job.base.wrapping_add(job.mid().wrapping_mul(job.size));
    Ok(compare(ctx, job.key, probe))
}
