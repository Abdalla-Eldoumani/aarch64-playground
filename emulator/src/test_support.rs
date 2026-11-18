//! Helpers the unit tests share.

use std::fmt::Display;
use std::ops::{Deref, DerefMut};

use crate::cpu::Cpu;
use crate::hosted::HostContext;

/// The refusal `result` carries must name `fragment`: a refusal a student
/// cannot act on is only half a check.
#[track_caller]
pub(crate) fn rejects<T, E: Display>(result: Result<T, E>, fragment: &str) {
    match result {
        Ok(_) => panic!("expected a refusal naming `{fragment}`, got success"),
        Err(e) => {
            let msg = e.to_string();
            assert!(msg.contains(fragment), "the refusal does not name `{fragment}`: {msg}");
        }
    }
}

/// A machine for the libc stubs' unit tests: a fresh `Cpu`, and `ctx()`,
/// the context `step` hands a stub, so a new context field reaches every
/// stub test without a fixture edit.
pub(crate) struct Host(pub(crate) Cpu);

impl Host {
    pub(crate) fn new() -> Self {
        Host(Cpu::new())
    }

    pub(crate) fn ctx(&mut self) -> HostContext<'_> {
        self.0.host_context(false)
    }

    /// Write `s` and its terminating zero at `addr`.
    pub(crate) fn place_string(&mut self, addr: u64, s: &[u8]) {
        for (i, b) in s.iter().enumerate() {
            self.0.mem.write_u8(addr + i as u64, *b).unwrap();
        }
        self.0.mem.write_u8(addr + s.len() as u64, 0).unwrap();
    }
}

impl Deref for Host {
    type Target = Cpu;
    fn deref(&self) -> &Cpu {
        &self.0
    }
}

impl DerefMut for Host {
    fn deref_mut(&mut self) -> &mut Cpu {
        &mut self.0
    }
}
