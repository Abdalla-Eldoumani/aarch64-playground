//! Floating-point helpers. Double precision only.
//!
//! FCMP sets NZCV the same way a signed integer compare does, with one
//! twist: if either operand is NaN the comparison is "unordered" and NZCV
//! becomes `0b0011` (N=0, Z=0, C=1, V=1). That's the pattern the AArch64
//! manual spells out, and conditional branches after an FCMP assume it.

use crate::registers::NzcvFlags;

/// Compute NZCV for a double-precision comparison of `a` against `b`.
pub fn fcmp_flags(a: f64, b: f64) -> NzcvFlags {
    if a.is_nan() || b.is_nan() {
        // "Unordered" result: N=0 Z=0 C=1 V=1 per the ARM ARM.
        return NzcvFlags {
            n: false,
            z: false,
            c: true,
            v: true,
        };
    }
    if a == b {
        NzcvFlags { n: false, z: true, c: true, v: false }
    } else if a < b {
        NzcvFlags { n: true, z: false, c: false, v: false }
    } else {
        // a > b
        NzcvFlags { n: false, z: false, c: true, v: false }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn equal_sets_zero_and_carry() {
        let f = fcmp_flags(1.5, 1.5);
        assert!(!f.n);
        assert!(f.z);
        assert!(f.c);
        assert!(!f.v);
    }

    #[test]
    fn less_than_sets_negative() {
        let f = fcmp_flags(1.0, 2.0);
        assert!(f.n);
        assert!(!f.z);
        assert!(!f.c);
        assert!(!f.v);
    }

    #[test]
    fn greater_than_sets_carry() {
        let f = fcmp_flags(2.0, 1.0);
        assert!(!f.n);
        assert!(!f.z);
        assert!(f.c);
        assert!(!f.v);
    }

    #[test]
    fn nan_sets_unordered() {
        let f = fcmp_flags(f64::NAN, 1.0);
        assert!(!f.n);
        assert!(!f.z);
        assert!(f.c);
        assert!(f.v);
    }

    #[test]
    fn negative_zero_equal_to_positive_zero() {
        let f = fcmp_flags(-0.0, 0.0);
        assert!(f.z);
    }
}
