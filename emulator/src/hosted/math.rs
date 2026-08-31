//! The libm subset a numeric cpsc 355 program reaches for. Every stub
//! takes its double argument in `d0` (`pow` and `fmod` take a second in
//! `d1`) and returns its result in `d0` -- the AAPCS64 floating-point
//! convention `atof` already follows.
//!
//! The bodies are Rust's f64 intrinsics, which are the IEEE-754
//! operations glibc's libm computes: `sqrt` of a negative is NaN, `log`
//! of zero is negative infinity, `log` of a negative is NaN. Nothing
//! here sets `errno`, because the emulator has none to set.

use crate::errors::EmuError;
use crate::hosted::{HostContext, HostOutcome};

/// Run a one-argument double function: read `d0`, write `d0`.
fn unary(ctx: &mut HostContext<'_>, f: fn(f64) -> f64) -> Result<HostOutcome, EmuError> {
    let x = ctx.regs.read_fpr_f64(0);
    ctx.regs.write_fpr_f64(0, f(x));
    Ok(HostOutcome::Continue)
}

/// Run a two-argument double function: read `d0` and `d1`, write `d0`.
fn binary(ctx: &mut HostContext<'_>, f: fn(f64, f64) -> f64) -> Result<HostOutcome, EmuError> {
    let x = ctx.regs.read_fpr_f64(0);
    let y = ctx.regs.read_fpr_f64(1);
    ctx.regs.write_fpr_f64(0, f(x, y));
    Ok(HostOutcome::Continue)
}

pub fn sqrt(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    unary(ctx, f64::sqrt)
}

pub fn pow(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    binary(ctx, f64::powf)
}

pub fn sin(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    unary(ctx, f64::sin)
}

pub fn cos(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    unary(ctx, f64::cos)
}

pub fn tan(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    unary(ctx, f64::tan)
}

/// C's `log` is the natural logarithm; Rust spells it `ln`.
pub fn log(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    unary(ctx, f64::ln)
}

pub fn log10(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    unary(ctx, f64::log10)
}

pub fn exp(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    unary(ctx, f64::exp)
}

pub fn floor(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    unary(ctx, f64::floor)
}

pub fn fabs(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    unary(ctx, f64::abs)
}

/// C's `fmod` keeps the sign of the dividend and truncates the quotient,
/// which is exactly what Rust's `%` does on f64.
pub fn fmod(ctx: &mut HostContext<'_>) -> Result<HostOutcome, EmuError> {
    binary(ctx, |x, y| x % y)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hosted::HostFn;
    use crate::memory::Memory;
    use crate::registers::RegisterFile;
    use std::collections::HashMap;
    use std::f64::consts::{E, PI, SQRT_2};

    /// Call a math stub with `d0` and `d1` preloaded and return the
    /// double it leaves in `d0`. These stubs touch nothing but the
    /// register file, so the rest of the host context is scratch.
    fn call2(f: HostFn, x: f64, y: f64) -> f64 {
        let mut regs = RegisterFile::new();
        let mut mem = Memory::new();
        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        let mut stdin = Vec::new();
        let mut vfs = HashMap::new();
        let mut open_files = HashMap::new();
        let mut next_fd = 3u32;
        let mut rand_state = crate::hosted::libc::RandState::default();
        let mut term = crate::cpu::TermState::default();
        let mut heap = crate::hosted::heap::HeapState::default();
        let mut strtok_save = 0u64;
        regs.write_fpr_f64(0, x);
        regs.write_fpr_f64(1, y);
        let mut ctx = HostContext {
            regs: &mut regs,
            mem: &mut mem,
            stdout: &mut stdout,
            stderr: &mut stderr,
            stdin: &mut stdin,
            stdin_closed: false,
            vfs: &mut vfs,
            open_files: &mut open_files,
            next_fd: &mut next_fd,
            rand_state: &mut rand_state,
            term: &mut term,
            heap: &mut heap,
            strtok_save: &mut strtok_save,
        };
        f(&mut ctx).unwrap();
        ctx.regs.read_fpr_f64(0)
    }

    /// One-argument call. `d1` is loaded with a value the stub must
    /// ignore, so a unary stub reaching for a second argument shows up.
    fn call1(f: HostFn, x: f64) -> f64 {
        call2(f, x, f64::NAN)
    }

    fn close(actual: f64, expected: f64) -> bool {
        (actual - expected).abs() < 1e-12
    }

    #[test]
    fn sqrt_returns_the_positive_root() {
        assert_eq!(call1(sqrt, 4.0), 2.0);
        assert!(close(call1(sqrt, 2.0), SQRT_2));
        assert_eq!(call1(sqrt, 0.0), 0.0);
    }

    #[test]
    fn pow_raises_the_first_argument_to_the_second() {
        assert_eq!(call2(pow, 2.0, 10.0), 1024.0);
        assert_eq!(call2(pow, 9.0, 0.5), 3.0);
        assert_eq!(call2(pow, 2.0, -1.0), 0.5);
    }

    #[test]
    fn trig_matches_the_textbook_angles() {
        assert_eq!(call1(sin, 0.0), 0.0);
        assert!(close(call1(sin, PI / 2.0), 1.0));
        assert_eq!(call1(cos, 0.0), 1.0);
        assert!(close(call1(cos, PI), -1.0));
        assert_eq!(call1(tan, 0.0), 0.0);
        assert!(close(call1(tan, PI / 4.0), 1.0));
    }

    #[test]
    fn log_is_natural_and_log10_is_base_ten() {
        assert_eq!(call1(log, 1.0), 0.0);
        assert!(close(call1(log, E), 1.0));
        assert!(close(call1(log10, 1000.0), 3.0));
        assert_eq!(call1(log10, 1.0), 0.0);
    }

    #[test]
    fn exp_inverts_log() {
        assert_eq!(call1(exp, 0.0), 1.0);
        assert!(close(call1(exp, 1.0), E));
        assert!(close(call1(log, call1(exp, 2.5)), 2.5));
    }

    #[test]
    fn floor_rounds_toward_negative_infinity() {
        assert_eq!(call1(floor, 2.7), 2.0);
        assert_eq!(call1(floor, -2.3), -3.0);
        assert_eq!(call1(floor, 3.0), 3.0);
    }

    #[test]
    fn fabs_drops_the_sign() {
        assert_eq!(call1(fabs, -3.5), 3.5);
        assert_eq!(call1(fabs, 3.5), 3.5);
        // -0.0 comes back as +0.0, so the sign bit is really cleared.
        assert!(call1(fabs, -0.0).is_sign_positive());
    }

    #[test]
    fn fmod_keeps_the_sign_of_the_dividend() {
        assert_eq!(call2(fmod, 7.5, 2.0), 1.5);
        assert_eq!(call2(fmod, -7.5, 2.0), -1.5);
        assert_eq!(call2(fmod, 7.5, -2.0), 1.5);
    }

    #[test]
    fn domain_edges_follow_ieee_instead_of_halting() {
        // A program that hands sqrt or log a value outside the domain
        // gets the IEEE answer back and can test it with fcmp; nothing
        // here is an error the emulator should stop on.
        assert!(call1(sqrt, -1.0).is_nan());
        assert_eq!(call1(log, 0.0), f64::NEG_INFINITY);
        assert!(call1(log, -1.0).is_nan());
        assert_eq!(call1(log10, 0.0), f64::NEG_INFINITY);
        assert!(call1(log10, -1.0).is_nan());
        // C defines pow(0, 0) as 1.
        assert_eq!(call2(pow, 0.0, 0.0), 1.0);
        // A zero divisor has no remainder to report.
        assert!(call2(fmod, 1.0, 0.0).is_nan());
    }

    #[test]
    fn a_unary_stub_ignores_d1() {
        // call1 parks a NaN in d1; a unary stub that read it would
        // return NaN instead of the answer.
        assert_eq!(call1(sqrt, 9.0), 3.0);
        assert_eq!(call1(fabs, -1.0), 1.0);
    }
}
