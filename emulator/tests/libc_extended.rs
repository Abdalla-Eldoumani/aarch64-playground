//! End-to-end contracts for the extended libc set: the string search /
//! copy family, the character classes (called, and indexed through the
//! table gcc lowers the macros to), strtol, calloc/realloc, the
//! buffer-formatting printf family, and fgets/fputs over the standard
//! streams. Everything drives the public pipeline: assemble_hosted ->
//! load -> run_until_break, with stdout asserted byte for byte.

use aarch64_emulator::cpu::Cpu;
use aarch64_emulator::frontend::pipeline::assemble_hosted;

fn load(src: &str) -> Cpu {
    let mut cpu = Cpu::new();
    let image = assemble_hosted(src, &cpu.host).unwrap_or_else(|e| panic!("assembly failed: {e}"));
    cpu.load_linked_image(&image).expect("load failed");
    cpu
}

fn run(cpu: &mut Cpu) -> String {
    let result = cpu.run_until_break(2_000_000).expect("run");
    assert!(
        result.halted,
        "program did not halt: {:?}",
        cpu.abort_message
    );
    assert_eq!(cpu.abort_message, None, "program aborted");
    String::from_utf8_lossy(&cpu.take_stdout()).into_owned()
}

#[test]
fn the_string_and_conversion_set_runs_together() {
    let src = r#"
define(fp, x29)
define(lr, x30)

        .data
tag:            .string "id"
number_text:    .string "  -0x1f rest"
csv:            .string "alpha,beta,,gamma"
comma:          .string ","
letters:        .string "abcdefgh"
needle:         .string "cde"
join_fmt:       .string "%s-%d"
percent_s:      .string "%s"
first_fmt:      .string "[%s] %d\n"
count_fmt:      .string "%d %s\n"
long_fmt:       .string "%ld %s\n"
flags_fmt:      .string "%d %d %d\n"
token_fmt:      .string "<%s>"
built_fmt:      .string "%s %ld\n"

        .bss
buf:            .skip 64
end_ptr:        .skip 8

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -64]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]

        // sprintf: x0 is the buffer and x1 the format, so the varargs
        // start at x2.
        ldr     x0, =buf
        ldr     x1, =join_fmt
        ldr     x2, =tag
        mov     w3, 42
        bl      sprintf
        mov     w19, w0
        ldr     x0, =first_fmt
        ldr     x1, =buf
        mov     w2, w19
        bl      printf

        // snprintf truncates to size - 1 but reports the length it
        // would have needed.
        ldr     x0, =buf
        mov     x1, 6
        ldr     x2, =percent_s
        ldr     x3, =letters
        bl      snprintf
        mov     w19, w0
        ldr     x0, =count_fmt
        mov     w1, w19
        ldr     x2, =buf
        bl      printf

        // strtol infers base 16 from the prefix and parks endptr on the
        // first character it did not use.
        ldr     x0, =number_text
        ldr     x1, =end_ptr
        mov     x2, 0
        bl      strtol
        mov     x19, x0
        ldr     x0, =long_fmt
        mov     x1, x19
        ldr     x2, =end_ptr
        ldr     x2, [x2]
        bl      printf

        // The character classes, both ways a program reaches them: the
        // call, and the table lookup gcc lowers the macro to. 55 is '7'.
        mov     w0, 55
        bl      isdigit
        cmp     w0, 0
        cset    w19, ne
        mov     w0, 55
        bl      isalpha
        cmp     w0, 0
        cset    w20, ne
        bl      __ctype_b_loc
        ldr     x0, [x0]
        mov     x1, 55
        lsl     x1, x1, 1
        add     x0, x0, x1
        ldrh    w1, [x0]
        and     w1, w1, 0x800
        cmp     w1, 0
        cset    w21, ne
        ldr     x0, =flags_fmt
        mov     w1, w19
        mov     w2, w20
        mov     w3, w21
        bl      printf

        // strtok: a run of delimiters counts as one, and the loop ends
        // when the string is spent.
        ldr     x0, =csv
        ldr     x1, =comma
        bl      strtok
next_token:
        cmp     x0, 0
        beq     tokens_done
        mov     x19, x0
        ldr     x0, =token_fmt
        mov     x1, x19
        bl      printf
        mov     x0, 0
        ldr     x1, =comma
        bl      strtok
        b       next_token
tokens_done:
        mov     w0, 10
        bl      putchar

        // strncpy pads the field with NULs, strcat appends at the
        // terminator it left, strstr finds the piece inside.
        ldr     x0, =buf
        ldr     x1, =tag
        mov     x2, 6
        bl      strncpy
        ldr     x0, =buf
        ldr     x1, =letters
        bl      strcat
        ldr     x0, =buf
        ldr     x1, =needle
        bl      strstr
        ldr     x1, =buf
        sub     x19, x0, x1
        ldr     x0, =built_fmt
        ldr     x1, =buf
        mov     x2, x19
        bl      printf

        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        mov     w0, 0
        ldp     fp, lr, [sp], 64
        ret
"#;
    let mut cpu = load(src);
    let out = run(&mut cpu);
    assert_eq!(
        out,
        "[id-42] 5\n\
         8 abcde\n\
         -31  rest\n\
         1 0 1\n\
         <alpha><beta><gamma>\n\
         idabcdefgh 4\n"
    );
    assert_eq!(cpu.exit_code, Some(0));
}

#[test]
fn calloc_zeroes_and_realloc_carries_the_block_over() {
    let src = r#"
define(fp, x29)
define(lr, x30)

        .data
alloc_fmt:      .string "%ld %ld %d\n"

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -48]!
        mov     fp, sp
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]

        mov     x0, 4
        mov     x1, 8
        bl      calloc
        mov     x19, x0
        ldr     x20, [x19, 24]

        mov     x1, 4660
        str     x1, [x19]

        // A live block above it, so the growth has to move.
        mov     x0, 16
        bl      malloc
        mov     x22, x0

        mov     x0, x19
        mov     x1, 256
        bl      realloc
        mov     x21, x0

        ldr     x2, [x21]
        cmp     x21, x19
        cset    w3, ne
        ldr     x0, =alloc_fmt
        mov     x1, x20
        bl      printf

        mov     x0, x21
        bl      free
        mov     x0, x22
        bl      free

        ldp     x19, x20, [sp, 16]
        ldp     x21, x22, [sp, 32]
        mov     w0, 0
        ldp     fp, lr, [sp], 48
        ret
"#;
    let mut cpu = load(src);
    // The zeroed word calloc left, the marker realloc carried over, and
    // the fact that the block really moved.
    assert_eq!(run(&mut cpu), "0 4660 1\n");
}

#[test]
fn fgets_and_fputs_echo_stdin_line_by_line() {
    let src = r#"
define(fp, x29)
define(lr, x30)

        .data
eof_note:       .string "eof\n"

        .bss
line:           .skip 64

        .text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
read_line:
        ldr     x0, =line
        mov     w1, 64
        ldr     x2, =stdin
        ldr     x2, [x2]
        bl      fgets
        cmp     x0, 0
        beq     at_eof
        ldr     x0, =line
        ldr     x1, =stdout
        ldr     x1, [x1]
        bl      fputs
        b       read_line
at_eof:
        ldr     x0, =eof_note
        ldr     x1, =stdout
        ldr     x1, [x1]
        bl      fputs
        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
"#;
    let mut cpu = load(src);
    // Pushed, not typed: no cooked-tty echo, so the output below is
    // exactly what fputs wrote.
    cpu.push_stdin(b"alpha\nbeta\n");
    cpu.close_stdin();
    assert_eq!(run(&mut cpu), "alpha\nbeta\neof\n");
}
