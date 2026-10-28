//! The call stack checked against memory, one step at a time: after every
//! step, walk the frame records from x29 (each record's saved fp leads to
//! the next, its saved lr says where that call returns) and compare the
//! saved lrs with the return addresses of the calls the call stack says the
//! program is inside. The two come from different places, the call stack
//! from the control flow and the chain from what the program stored, so
//! agreement is evidence for both.

use aarch64_emulator::cpu::{Cpu, StepOutcome, STACK_BASE};
use aarch64_emulator::frames::Activation;

/// What a walk saw.
#[derive(Debug, Default)]
pub struct Tally {
    pub steps: u64,
    /// Steps where the chain held exactly the expected return addresses.
    pub agree: u64,
    /// Steps in the middle of a prologue or epilogue, where the innermost
    /// record is half built and the chain may lag a step.
    pub transition: u64,
    /// Steps past the call stack's cap, which it counts without recording.
    pub past_cap: u64,
    /// Any other step, where the two disagreed.
    pub disagree: u64,
    /// The first few of those, described.
    pub examples: Vec<String>,
    pub max_depth: u64,
}

impl Tally {
    pub fn add(&mut self, other: Tally) {
        self.steps += other.steps;
        self.agree += other.agree;
        self.transition += other.transition;
        self.past_cap += other.past_cap;
        self.disagree += other.disagree;
        self.examples.extend(other.examples.into_iter().take(3));
        self.max_depth = self.max_depth.max(other.max_depth);
    }
}

#[derive(Debug, PartialEq)]
enum Top {
    /// sp and fp as the call left them.
    Bare,
    /// The record is pushed at sp, fp not yet moved to it.
    Pushed,
    /// fp points at a record holding the caller's fp and this call's lr.
    Complete,
    Other,
}

fn read(cpu: &Cpu, at: u64) -> Option<u64> {
    cpu.mem.read_u64(at).ok()
}

/// The innermost call's frame, judged from registers and memory alone.
fn top(cpu: &Cpu, a: &Activation, sp: u64, fp: u64) -> Top {
    let record_at = |at: u64| read(cpu, at) == Some(a.fp_entry) && read(cpu, at + 8) == Some(a.ret_addr);
    if sp == a.sp_entry && fp == a.fp_entry {
        Top::Bare
    } else if fp != a.fp_entry && fp < a.sp_entry && record_at(fp) {
        Top::Complete
    } else if sp < a.sp_entry && fp == a.fp_entry && record_at(sp) {
        Top::Pushed
    } else {
        Top::Other
    }
}

/// One frame record on the chain: where it sits, its saved fp, its saved lr.
type Record = (u64, u64, u64);

/// The chain from x29, kept from step to step: memory only changes where
/// the dirty log says, so the part of the chain no write touched since the
/// last step is still exactly what it was, and the walk stops where it
/// meets that part. Deep recursion is then checked at every step without
/// rereading thousands of records each time.
#[derive(Default)]
struct Chain {
    /// main's record first; empty when the last walk broke.
    records: Vec<Record>,
}

impl Chain {
    /// The chain as memory holds it now, main's record first, or None when
    /// it breaks: an fp outside the live stack, misaligned, or not above
    /// the one before it, or a chain longer than `limit`.
    fn walk(&mut self, cpu: &mut Cpu, limit: usize) -> Option<&[Record]> {
        // Records a write since the last walk may have touched are stale,
        // and so is every record above them in the list.
        let mut intact = self.records.len();
        for (addr, len) in cpu.mem.take_dirty() {
            // The first record below the write's end is the highest one it
            // can reach; if it misses that one, it misses every lower one.
            let i = self.records.partition_point(|r| r.0 >= addr + len as u64);
            if self.records.get(i).is_some_and(|r| addr < r.0 + 16) {
                intact = intact.min(i);
            }
        }
        let sp = cpu.regs.read_sp();
        let mut at = cpu.regs.snapshot()[29];
        let mut fresh: Vec<Record> = Vec::new();
        let joined = loop {
            if at == 0 {
                break 0;
            }
            // The kept records sit in descending address order.
            if let Ok(i) = self.records[..intact].binary_search_by(|r| at.cmp(&r.0)) {
                break i + 1;
            }
            if fresh.len() > limit || at < sp || at >= STACK_BASE || !at.is_multiple_of(8) {
                self.records.clear();
                return None;
            }
            let (saved_fp, saved_lr) = (read(cpu, at)?, read(cpu, at + 8)?);
            fresh.push((at, saved_fp, saved_lr));
            if saved_fp != 0 && saved_fp <= at {
                self.records.clear();
                return None;
            }
            at = saved_fp;
        };
        self.records.truncate(joined);
        self.records.extend(fresh.into_iter().rev());
        (self.records.len() <= limit + 1).then_some(&self.records[..])
    }
}

/// Step-by-step checker for one program.
#[derive(Default)]
struct Checker {
    chain: Chain,
    tally: Tally,
}

impl Checker {
    fn check(&mut self, cpu: &mut Cpu, label: &str) {
        let n = cpu.call_stack().activations().len();
        let chain = self.chain.walk(cpu, n);
        let tally = &mut self.tally;
        let stack = cpu.call_stack();
        tally.max_depth = tally.max_depth.max(stack.depth());
        if stack.uncounted() > 0 {
            tally.past_cap += 1;
            return;
        }
        let regs = cpu.regs.snapshot();
        let acts = stack.activations();
        let innermost = acts.last().map(|a| top(cpu, a, regs[31], regs[29]));
        // The return addresses the chain must hold, main's first: every
        // caller that called out with a record, then the innermost call
        // once its own record is complete.
        let expected = acts
            .iter()
            .take(n.saturating_sub(1))
            .filter(|a| a.record != 0)
            .chain(acts.last().filter(|_| innermost == Some(Top::Complete)))
            .map(|a| a.ret_addr);
        let agrees = chain.is_some_and(|c| c.len() == expected.clone().count() && c.iter().map(|r| r.2).eq(expected.clone()));
        if agrees {
            tally.agree += 1;
        } else if matches!(innermost, Some(Top::Bare | Top::Pushed)) {
            tally.transition += 1;
        } else {
            tally.disagree += 1;
            if tally.examples.len() < 3 {
                let lrs: Option<Vec<u64>> = chain.map(|c| c.iter().map(|r| r.2).collect());
                tally.examples.push(format!(
                    "{label} step {}: chain {lrs:x?} vs call stack {:x?} (innermost {innermost:?})",
                    tally.steps,
                    expected.collect::<Vec<_>>()
                ));
            }
        }
    }
}

/// Step `cpu` until it halts, waits for input, or spends `max_steps`,
/// checking the chain after every step.
pub fn walk(cpu: &mut Cpu, max_steps: u64, label: &str) -> Tally {
    let mut checker = Checker::default();
    let _ = cpu.mem.take_dirty();
    checker.check(cpu, label);
    while checker.tally.steps < max_steps {
        let r = cpu.step().unwrap_or_else(|e| panic!("{label}: step failed: {e}"));
        checker.tally.steps += 1;
        checker.check(cpu, label);
        if r.halted || matches!(r.outcome, StepOutcome::WaitingForInput) {
            break;
        }
    }
    checker.tally
}
