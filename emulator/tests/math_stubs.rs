//! End-to-end contracts for the libm host stubs. One program calls every
//! one of the eleven through `bl` and prints what came back in `d0`;
//! a second checks that a domain edge (`sqrt` of a negative) arrives as a
//! NaN the program can test with `fcmp`. Everything drives the public
//! pipeline: assemble_hosted -> load -> run_until_break.

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::pipeline::assemble_hosted;

fn load(src: &str) -> Cpu {
    let mut cpu = Cpu::new();
    let image =
        assemble_hosted(src, &cpu.host).unwrap_or_else(|e| panic!("assembly failed: {e}"));
    cpu.load_linked_image(&image).expect("load failed");
    cpu
}

fn stdout_of(cpu: &mut Cpu) -> String {
    String::from_utf8_lossy(&cpu.take_stdout()).into_owned()
}

#[test]
fn every_libm_stub_returns_its_value_in_d0() {
    let src = r#"
define(fp, x29)
define(lr, x30)

        .data
        .balign 8
two_m:      .double 0r2.0
ten_m:      .double 0r10.0
half_pi_m:  .double 0r1.5707963267948966
zero_m:     .double 0r0.0
qtr_pi_m:   .double 0r0.7853981633974483
e_m:        .double 0r2.718281828459045
thou_m:     .double 0r1000.0
one_m:      .double 0r1.0
up_m:       .double 0r2.7
down_m:     .double -0r2.3
neg_m:      .double -0r3.5
seven_m:    .double 0r7.5

fmt:        .string "%s = %.6f\n"
n_sqrt:     .string "sqrt(2)"
n_pow:      .string "pow(2,10)"
n_sin:      .string "sin(pi/2)"
n_cos:      .string "cos(0)"
n_tan:      .string "tan(pi/4)"
n_log:      .string "log(e)"
n_log10:    .string "log10(1000)"
n_exp:      .string "exp(1)"
n_floor_up: .string "floor(2.7)"
n_floor_dn: .string "floor(-2.3)"
n_fabs:     .string "fabs(-3.5)"
n_fmod:     .string "fmod(7.5,2)"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =two_m
        ldr     d0, [x9]
        bl      sqrt
        ldr     x0, =fmt
        ldr     x1, =n_sqrt
        bl      printf

        ldr     x9, =two_m
        ldr     d0, [x9]
        ldr     x9, =ten_m
        ldr     d1, [x9]                // pow takes its exponent in d1
        bl      pow
        ldr     x0, =fmt
        ldr     x1, =n_pow
        bl      printf

        ldr     x9, =half_pi_m
        ldr     d0, [x9]
        bl      sin
        ldr     x0, =fmt
        ldr     x1, =n_sin
        bl      printf

        ldr     x9, =zero_m
        ldr     d0, [x9]
        bl      cos
        ldr     x0, =fmt
        ldr     x1, =n_cos
        bl      printf

        ldr     x9, =qtr_pi_m
        ldr     d0, [x9]
        bl      tan
        ldr     x0, =fmt
        ldr     x1, =n_tan
        bl      printf

        ldr     x9, =e_m
        ldr     d0, [x9]
        bl      log
        ldr     x0, =fmt
        ldr     x1, =n_log
        bl      printf

        ldr     x9, =thou_m
        ldr     d0, [x9]
        bl      log10
        ldr     x0, =fmt
        ldr     x1, =n_log10
        bl      printf

        ldr     x9, =one_m
        ldr     d0, [x9]
        bl      exp
        ldr     x0, =fmt
        ldr     x1, =n_exp
        bl      printf

        ldr     x9, =up_m
        ldr     d0, [x9]
        bl      floor
        ldr     x0, =fmt
        ldr     x1, =n_floor_up
        bl      printf

        ldr     x9, =down_m
        ldr     d0, [x9]
        bl      floor
        ldr     x0, =fmt
        ldr     x1, =n_floor_dn
        bl      printf

        ldr     x9, =neg_m
        ldr     d0, [x9]
        bl      fabs
        ldr     x0, =fmt
        ldr     x1, =n_fabs
        bl      printf

        ldr     x9, =seven_m
        ldr     d0, [x9]
        ldr     x9, =two_m
        ldr     d1, [x9]                // fmod takes its divisor in d1
        bl      fmod
        ldr     x0, =fmt
        ldr     x1, =n_fmod
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let mut cpu = load(src);
    let r = cpu.run_until_break(1_000_000).expect("run");
    assert!(r.halted, "program should finish");
    assert_eq!(cpu.exit_code, Some(0));
    assert_eq!(
        stdout_of(&mut cpu),
        "sqrt(2) = 1.414214\n\
         pow(2,10) = 1024.000000\n\
         sin(pi/2) = 1.000000\n\
         cos(0) = 1.000000\n\
         tan(pi/4) = 1.000000\n\
         log(e) = 1.000000\n\
         log10(1000) = 3.000000\n\
         exp(1) = 2.718282\n\
         floor(2.7) = 2.000000\n\
         floor(-2.3) = -3.000000\n\
         fabs(-3.5) = 3.500000\n\
         fmod(7.5,2) = 1.500000\n"
    );
}

#[test]
fn sqrt_of_a_negative_comes_back_as_a_nan_the_program_can_test() {
    let src = r#"
define(fp, x29)
define(lr, x30)

        .data
        .balign 8
neg_one_m:  .double -0r1.0
nan_msg:    .string "not a number"
num_msg:    .string "a number"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x9, =neg_one_m
        ldr     d0, [x9]
        bl      sqrt

        fcmp    d0, d0                  // a NaN compares unordered: V set
        b.vs    is_nan
        ldr     x0, =num_msg
        b       report
is_nan:
        ldr     x0, =nan_msg
report:
        bl      puts

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let mut cpu = load(src);
    let r = cpu.run_until_break(1_000_000).expect("run");
    assert!(r.halted, "the domain edge must not halt the program early");
    assert_eq!(cpu.exit_code, Some(0));
    assert_eq!(stdout_of(&mut cpu), "not a number\n");
}
