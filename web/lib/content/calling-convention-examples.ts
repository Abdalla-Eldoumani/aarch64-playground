/**
 * The calling-convention guide's worked examples: each one a whole program
 * that ran on the course server, the part of it the guide shows, and what
 * the server printed. Every program exits 0. A changed program needs a fresh
 * server run before its stdout changes;
 * calling-convention-examples.playground.test.ts holds the playground to it.
 */

export type GuideExampleId =
  | "ten-arguments"
  | "struct-arguments"
  | "large-result"
  | "variadic-printf"
  | "callee-saved"
  | "frame-chain"
  | "factorial";

export interface GuideExample {
  id: GuideExampleId;
  /** Names the program in the run button's accessible label. */
  name: string;
  /** The whole program, m4 defines included. */
  source: string;
  /** The lines the guide shows; pieces of the source joined by "..." lines. */
  excerpt: string;
  /** What the course server printed, byte for byte. */
  stdout: string;
}

export const GUIDE_EXAMPLES: Record<GuideExampleId, GuideExample> = {
  "ten-arguments": {
    id: "ten-arguments",
    name: "the ten-argument call",
    source: `// Joins ten digits into one number. Digits 1 to 8 travel in x0-x7;
// digits 9 and 10 go in 8-byte stack slots that the caller fills.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "joined: %ld\\n"

.text
outgoing_size = 2 * 8                       // a slot each for digits 9 and 10
outgoing_alloc = -outgoing_size & -16       // keeps sp 16-byte aligned
outgoing_dealloc = -outgoing_alloc
arg9_s = 16                                 // just above the callee's record
arg10_s = 24

// join_digits(x0-x7 = digits 1 to 8, [fp, 16] = digit 9, [fp, 24] = digit 10)
//         -> x0 = the ten digits read as one decimal number
        .balign 4
        .global join_digits
join_digits:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x9, 10
        madd    x0, x0, x9, x1              // number = number * 10 + next digit
        madd    x0, x0, x9, x2
        madd    x0, x0, x9, x3
        madd    x0, x0, x9, x4
        madd    x0, x0, x9, x5
        madd    x0, x0, x9, x6
        madd    x0, x0, x9, x7
        ldr     x10, [fp, arg9_s]           // digit 9, from the caller's frame
        madd    x0, x0, x9, x10
        ldr     x10, [fp, arg10_s]          // digit 10, one slot higher
        madd    x0, x0, x9, x10

        ldp     fp, lr, [sp], 16
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 1                       // digits 1 to 8 go in x0-x7
        mov     x1, 2
        mov     x2, 3
        mov     x3, 4
        mov     x4, 5
        mov     x5, 6
        mov     x6, 7
        mov     x7, 8

        add     sp, sp, outgoing_alloc      // open the outgoing area
        mov     x9, 9
        str     x9, [sp]                    // digit 9 at sp: the first slot
        mov     x9, 0
        str     x9, [sp, 8]                 // digit 10 in the next slot up
        bl      join_digits
        add     sp, sp, outgoing_dealloc    // close the outgoing area

        mov     x1, x0
        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
    excerpt: `        add     sp, sp, outgoing_alloc      // open the outgoing area
        mov     x9, 9
        str     x9, [sp]                    // digit 9 at sp: the first slot
        mov     x9, 0
        str     x9, [sp, 8]                 // digit 10 in the next slot up
        bl      join_digits
        add     sp, sp, outgoing_dealloc    // close the outgoing area
...
        ldr     x10, [fp, arg9_s]           // digit 9, from the caller's frame`,
    stdout: "joined: 1234567890\n",
  },
  "struct-arguments": {
    id: "struct-arguments",
    name: "the struct arguments",
    source: `// Passes three structs: 16 bytes by value in x0 and x1, 24 bytes by
// reference to a copy, and three doubles one per register in d0-d2.

define(fp, x29)
define(lr, x30)

.data
pair:       .dword  30, 12                  // two longs: 16 bytes
triple:     .dword  100, 20, 3              // three longs: 24 bytes
vec:        .double 0r2.0, 0r3.0, 0r6.0     // struct vec3 { double x, y, z; }
fmt_pair:   .string "pair: %ld\\n"
fmt_triple: .string "triple: %ld\\n"
fmt_vec:    .string "vec3: %.1f\\n"

.text
// pair_sum(x0 = p.a, x1 = p.b) -> x0 = p.a + p.b
        .balign 4
        .global pair_sum
pair_sum:
        add     x0, x0, x1                  // both fields arrived in registers
        ret

// triple_sum(x0 = address of a copy of t) -> x0 = t.a + t.b + t.c
        .balign 4
        .global triple_sum
triple_sum:
        ldp     x9, x10, [x0]               // the struct arrived as an address
        ldr     x11, [x0, 16]
        add     x0, x9, x10
        add     x0, x0, x11
        ret

// length2(d0 = v.x, d1 = v.y, d2 = v.z) -> d0 = x * x + y * y + z * z
        .balign 4
        .global length2
length2:
        fmul    d0, d0, d0
        fmadd   d0, d1, d1, d0              // add y * y
        fmadd   d0, d2, d2, d0              // add z * z
        ret

copy_s = 16                                 // main's copy of triple
alloc = -(16 + 24) & -16
dealloc = -alloc

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        ldr     x9, =pair
        ldp     x0, x1, [x9]                // 16 bytes: one field per register
        bl      pair_sum
        mov     x1, x0
        ldr     x0, =fmt_pair
        bl      printf

        ldr     x9, =triple                 // 24 bytes: copy it here...
        ldp     x10, x11, [x9]
        stp     x10, x11, [fp, copy_s]
        ldr     x10, [x9, 16]
        str     x10, [fp, copy_s + 16]
        add     x0, fp, copy_s              // ...and pass the copy's address
        bl      triple_sum
        mov     x1, x0
        ldr     x0, =fmt_triple
        bl      printf

        ldr     x9, =vec
        ldp     d0, d1, [x9]                // an HFA: d0, d1, then d2
        ldr     d2, [x9, 16]
        bl      length2
        ldr     x0, =fmt_vec                // the result is already in d0
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
`,
    excerpt: `        ldr     x9, =pair
        ldp     x0, x1, [x9]                // 16 bytes: one field per register
...
        ldr     x9, =triple                 // 24 bytes: copy it here...
        ldp     x10, x11, [x9]
        stp     x10, x11, [fp, copy_s]
        ldr     x10, [x9, 16]
        str     x10, [fp, copy_s + 16]
        add     x0, fp, copy_s              // ...and pass the copy's address
...
        ldr     x9, =vec
        ldp     d0, d1, [x9]                // an HFA: d0, d1, then d2
        ldr     d2, [x9, 16]`,
    stdout: "pair: 42\ntriple: 123\nvec3: 49.0\n",
  },
  "large-result": {
    id: "large-result",
    name: "the large result",
    source: `// Returns a 24-byte struct. It does not fit in x0 and x1, so main reserves
// room in its own frame and passes that address in x8; powers writes there.

define(fp, x29)
define(lr, x30)

.data
fmt_out:    .string "%ld, %ld, %ld\\n"

.text
p1_s = 0                                    // struct powers: three longs
p2_s = 8
p3_s = 16
powers_size = 24

// powers(x0 = n, x8 = address for the result) -> [x8] = { n, n * n, n * n * n }
        .balign 4
        .global powers
powers:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mul     x9, x0, x0                  // n squared
        mul     x10, x9, x0                 // n cubed
        str     x0, [x8, p1_s]              // each field goes through x8
        str     x9, [x8, p2_s]
        str     x10, [x8, p3_s]

        ldp     fp, lr, [sp], 16
        ret

result_s = 16                               // main's struct, above its record
alloc = -(16 + powers_size) & -16
dealloc = -alloc

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp

        mov     x0, 5
        add     x8, fp, result_s            // where powers must put its result
        bl      powers

        ldr     x0, =fmt_out
        ldr     x1, [fp, result_s + p1_s]
        ldr     x2, [fp, result_s + p2_s]
        ldr     x3, [fp, result_s + p3_s]
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
`,
    excerpt: `        add     x8, fp, result_s            // where powers must put its result
        bl      powers
...
        str     x0, [x8, p1_s]              // each field goes through x8
        str     x9, [x8, p2_s]
        str     x10, [x8, p3_s]`,
    stdout: "5, 25, 125\n",
  },
  "variadic-printf": {
    id: "variadic-printf",
    name: "the printf call",
    source: `// One printf call with two ints and two prices. On Linux the ints take
// w1 and w2 and the prices take d0 and d1: the two kinds count separately.
// The second price is a float, and printf only reads doubles, so it is
// widened first.

define(fp, x29)
define(lr, x30)

.data
apple:      .double 0r0.75
pear:       .float  0r1.5
fmt_buy:    .string "%d apples at %.2f, %d pears at %.2f\\n"

.text
        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        ldr     x0, =fmt_buy
        mov     w1, 3                       // first int: w1
        ldr     x9, =apple
        ldr     d0, [x9]                    // first double: d0, not x2
        mov     w2, 5                       // second int: the next one, w2
        ldr     x9, =pear
        ldr     s1, [x9]
        fcvt    d1, s1                      // widen the float into d1
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
    excerpt: `        ldr     x0, =fmt_buy
        mov     w1, 3                       // first int: w1
        ldr     x9, =apple
        ldr     d0, [x9]                    // first double: d0, not x2
        mov     w2, 5                       // second int: the next one, w2
        ldr     x9, =pear
        ldr     s1, [x9]
        fcvt    d1, s1                      // widen the float into d1
        bl      printf`,
    stdout: "3 apples at 0.75, 5 pears at 1.50\n",
  },
  "callee-saved": {
    id: "callee-saved",
    name: "the callee-saved registers",
    source: `// Prints the first few multiples of a double. The counter, the limit and
// the step must survive every printf, so they live in x19, x20 and d8, and
// the function saves the caller's values of those three registers first.

define(fp, x29)
define(lr, x30)
define(i_r, x19)
define(count_r, x20)
define(step_r, d8)

.data
step:       .double 0r1.25
fmt_row:    .string "%ld x %.2f = %.2f\\n"

.text
x19_s = 16                                  // saved above the frame record
x20_s = 24
d8_s = 32
alloc = -(16 + 24) & -16                    // 40 bytes, rounded up to 48
dealloc = -alloc

// print_multiples(x0 = count, d0 = step) -> nothing
        .balign 4
        .global print_multiples
print_multiples:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        stp     x19, x20, [fp, x19_s]       // the caller's x19 and x20
        str     d8, [fp, d8_s]              // and its d8

        mov     count_r, x0                 // copy the arguments out
        fmov    step_r, d0
        mov     i_r, 1
        b       pm_test
pm_loop:
        scvtf   d1, i_r                     // d1 = (double) i
        fmul    d1, d1, step_r
        ldr     x0, =fmt_row
        mov     x1, i_r
        fmov    d0, step_r
        bl      printf                      // may change x0-x18, d0-d7, d16-d31
        add     i_r, i_r, 1
pm_test:
        cmp     i_r, count_r
        b.le    pm_loop

        ldp     x19, x20, [fp, x19_s]       // put the caller's values back
        ldr     d8, [fp, d8_s]
        ldp     fp, lr, [sp], dealloc
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 3
        ldr     x9, =step
        ldr     d0, [x9]
        bl      print_multiples

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
    excerpt: `x19_s = 16                                  // saved above the frame record
x20_s = 24
d8_s = 32
alloc = -(16 + 24) & -16                    // 40 bytes, rounded up to 48
dealloc = -alloc
...
print_multiples:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        stp     x19, x20, [fp, x19_s]       // the caller's x19 and x20
        str     d8, [fp, d8_s]              // and its d8
...
        ldp     x19, x20, [fp, x19_s]       // put the caller's values back
        ldr     d8, [fp, d8_s]
        ldp     fp, lr, [sp], dealloc
        ret`,
    stdout: "1 x 1.25 = 1.25\n2 x 1.25 = 2.50\n3 x 1.25 = 3.75\n",
  },
  "frame-chain": {
    id: "frame-chain",
    name: "the frame chain",
    source: `// main calls outer and outer calls inner. Each function stores its own name
// in its frame; inner then follows the saved fp in each frame record, one
// record per caller, and prints the name it finds in each frame.

define(fp, x29)
define(lr, x30)
define(frame_r, x19)
define(depth_r, x20)

.data
name_main:  .string "main"
name_outer: .string "outer"
name_inner: .string "inner"
fmt_hop:    .string "frame %ld: %s\\n"

.text
name_s = 16                                 // where each frame keeps its name
alloc = -(16 + 8) & -16
dealloc = -alloc
inner_x19_s = 24                            // inner also saves x19 and x20
inner_alloc = -(16 + 8 + 16) & -16
inner_dealloc = -inner_alloc

// inner() -> nothing; walks the frame chain three records deep
        .balign 4
        .global inner
inner:
        stp     fp, lr, [sp, inner_alloc]!
        mov     fp, sp
        stp     x19, x20, [fp, inner_x19_s] // keep the caller's x19 and x20
        ldr     x9, =name_inner
        str     x9, [fp, name_s]

        mov     frame_r, fp                 // start at inner's own frame record
        mov     depth_r, 0
        b       walk_test
walk_loop:
        ldr     x0, =fmt_hop
        mov     x1, depth_r
        ldr     x2, [frame_r, name_s]       // the name stored in that frame
        bl      printf
        ldr     frame_r, [frame_r]          // saved fp: the caller's record
        add     depth_r, depth_r, 1
walk_test:
        cmp     depth_r, 3
        b.lt    walk_loop

        ldp     x19, x20, [fp, inner_x19_s]
        ldp     fp, lr, [sp], inner_dealloc
        ret

// outer() -> nothing; names its frame and calls inner
        .balign 4
        .global outer
outer:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        ldr     x9, =name_outer
        str     x9, [fp, name_s]
        bl      inner
        ldp     fp, lr, [sp], dealloc
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        ldr     x9, =name_main
        str     x9, [fp, name_s]
        bl      outer

        mov     w0, 0
        ldp     fp, lr, [sp], dealloc
        ret
`,
    excerpt: `        mov     frame_r, fp                 // start at inner's own frame record
        mov     depth_r, 0
        b       walk_test
walk_loop:
        ldr     x0, =fmt_hop
        mov     x1, depth_r
        ldr     x2, [frame_r, name_s]       // the name stored in that frame
        bl      printf
        ldr     frame_r, [frame_r]          // saved fp: the caller's record
        add     depth_r, depth_r, 1
walk_test:
        cmp     depth_r, 3
        b.lt    walk_loop`,
    stdout: "frame 0: inner\nframe 1: outer\nframe 2: main\n",
  },
  "factorial": {
    id: "factorial",
    name: "the factorial",
    source: `// Factorial by recursion. Each call keeps its n in x19 across the call it
// makes, so each call first saves the caller's x19 in its own frame.

define(fp, x29)
define(lr, x30)
define(n_r, x19)

.data
fmt_out:    .string "4! = %ld\\n"

.text
x19_s = 16                                  // where the caller's x19 is saved
alloc = -(16 + 8) & -16
dealloc = -alloc

// fact(x0 = n) -> x0 = n!
        .balign 4
        .global fact
fact:
        stp     fp, lr, [sp, alloc]!
        mov     fp, sp
        str     n_r, [fp, x19_s]

        mov     n_r, x0
        mov     x0, 1                       // 1! = 1 ends the recursion
        cmp     n_r, 1
        b.le    fact_done
        sub     x0, n_r, 1
        bl      fact                        // x0 = (n - 1)!
        mul     x0, x0, n_r                 // n survived the call in x19
fact_done:
        ldr     n_r, [fp, x19_s]
        ldp     fp, lr, [sp], dealloc
        ret

        .balign 4
        .global main
main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp

        mov     x0, 4
        bl      fact
        mov     x1, x0
        ldr     x0, =fmt_out
        bl      printf

        mov     w0, 0
        ldp     fp, lr, [sp], 16
        ret
`,
    excerpt: ``,
    stdout: "4! = 24\n",
  },
};
