# Instruction reference

Every instruction the playground understands. If it isn't listed here, the assembler will reject it with an `unknown mnemonic` error.

Register operands are `X0`-`X30` (64-bit), `W0`-`W30` (32-bit), `SP`, and `XZR`/`WZR`. Immediates are prefixed with `#` and can be written decimal (`#42`), hex (`#0x2a`), or binary (`#0b101010`). Labels end with a colon.

## Data processing

| Mnemonic | Form                             | Notes                                    |
| -------- | -------------------------------- | ---------------------------------------- |
| `MOV`    | `MOV Xd, Xn` / `MOV Xd, #imm` / `MOV Xd, SP` | Register-to-register or wide immediate. `MOV Xd, SP` / `MOV SP, Xn` lower to `ADD ..., #0`. Immediates that fit in one shifted 16-bit field (e.g. `#0x10000000 = #0x1000 LSL #16`) are auto-encoded as MOVZ with the right shift. |
| `MOVZ`   | `MOVZ Xd, #imm, LSL #shift`      | Zero upper bits, shift is 0/16/32/48.    |
| `MOVK`   | `MOVK Xd, #imm, LSL #shift`      | Keep other halfwords.                    |
| `MOVN`   | `MOVN Xd, #imm, LSL #shift`      | Bitwise NOT, same shifts.                |
| `ADD`    | `ADD Xd, Xn, Xm` / `..., #imm`   | No flags.                                |
| `ADDS`   | same                             | Sets NZCV.                               |
| `SUB`    | `SUB Xd, Xn, Xm` / `..., #imm`   | No flags.                                |
| `SUBS`   | same                             | Sets NZCV.                               |
| `MUL`    | `MUL Xd, Xn, Xm`                 | Low 64 bits of product. Alias for `MADD Xd, Xn, Xm, XZR`. |
| `MADD`   | `MADD Xd, Xn, Xm, Xa`            | Multiply-add: `Xd = Xa + Xn * Xm`.       |
| `MSUB`   | `MSUB Xd, Xn, Xm, Xa`            | Multiply-subtract: `Xd = Xa - Xn * Xm`. |
| `UDIV`   | `UDIV Xd, Xn, Xm`                | Unsigned divide, zero on divide-by-zero. |
| `SDIV`   | `SDIV Xd, Xn, Xm`                | Signed divide.                           |
| `NEG`    | `NEG Xd, Xm`                     | Alias for `SUB Xd, XZR, Xm`.             |
| `AND`    | `AND Xd, Xn, Xm` / `..., #imm`   | Logical AND.                             |
| `ANDS`   | same                             | Sets NZCV.                               |
| `ORR`    | `ORR Xd, Xn, Xm`                 | Logical OR.                              |
| `EOR`    | `EOR Xd, Xn, Xm`                 | Exclusive OR.                            |
| `MVN`    | `MVN Xd, Xm`                     | Bitwise NOT.                             |
| `LSL`    | `LSL Xd, Xn, #imm` / `..., Xm`   | Logical shift left.                      |
| `LSR`    | `LSR Xd, Xn, #imm` / `..., Xm`   | Logical shift right.                     |
| `ASR`    | `ASR Xd, Xn, #imm` / `..., Xm`   | Arithmetic shift right.                  |

## Compare and test

| Mnemonic | Form              | Notes                               |
| -------- | ----------------- | ----------------------------------- |
| `CMP`    | `CMP Xn, Xm/#imm` | `SUBS XZR, ...`; sets NZCV.         |
| `CMN`    | `CMN Xn, Xm/#imm` | `ADDS XZR, ...`.                    |
| `TST`    | `TST Xn, Xm/#imm` | `ANDS XZR, ...`.                    |

## Conditional select

| Mnemonic | Form                            | Notes                               |
| -------- | ------------------------------- | ----------------------------------- |
| `CSEL`   | `CSEL Xd, Xn, Xm, cond`         | Xd = cond ? Xn : Xm.                |
| `CSINC`  | `CSINC Xd, Xn, Xm, cond`        | Xd = cond ? Xn : Xm+1.              |
| `CSET`   | `CSET Xd, cond`                 | Alias for `CSINC Xd, XZR, XZR, !cond`. |

Condition codes: `EQ`, `NE`, `HS`/`CS`, `LO`/`CC`, `MI`, `PL`, `VS`, `VC`, `HI`, `LS`, `GE`, `LT`, `GT`, `LE`.

## Memory

| Mnemonic | Form                                                  | Notes                              |
| -------- | ----------------------------------------------------- | ---------------------------------- |
| `LDR`    | `LDR Xt, [Xn]` / `[Xn, #imm]` / `[Xn, #imm]!` / `[Xn], #imm` | 64-bit load.              |
| `STR`    | same                                                  | 64-bit store.                      |
| `LDRB`   | same addressing forms                                 | Byte load, zero-extends.           |
| `STRB`   | same                                                  | Byte store.                        |
| `LDRH`   | same                                                  | Halfword load.                     |
| `STRH`   | same                                                  | Halfword store.                    |
| `LDP`    | `LDP Xt1, Xt2, [Xn, #imm]` (+ pre/post index)         | Load pair.                         |
| `STP`    | same                                                  | Store pair.                        |

Addressing modes supported:

- **signed offset**: `[Xn, #imm]`
- **pre-index**: `[Xn, #imm]!` (adds the offset *and* writes the new address back into Xn)
- **post-index**: `[Xn], #imm` (reads/writes at the base, then updates Xn)

Addressing modes also include register-offset forms the cpsc 355 corpus
uses:

- **register offset**: `[Xn, Xm]` (LSL by access size) or `[Xn, Wm, SXTW #k]`
- **register offset with extend**: `[Xn, Wm, UXTW]`, `[Xn, Xm, LSL #3]`, `[Xn, Xm, SXTX]`, etc.

Unaligned access succeeds (SCTLR.A = 0), so a student's code that
stumbles onto a misaligned base doesn't fault inside the emulator but
would also not fault on real AArch64 Linux.

Sign-extending loads: `LDRSB Wt` / `LDRSB Xt` / `LDRSH Wt` / `LDRSH Xt` /
`LDRSW Xt`. `LDRSW` requires an `Xt` target per ARM spec.

FP data moves: `LDR Dt, [Xn, #imm]` / `STR Dt, [Xn, #imm]` and the
32-bit `LDR St` / `STR St` equivalents, unsigned-offset form only.

## Branches

| Mnemonic | Form             | Notes                                             |
| -------- | ---------------- | ------------------------------------------------- |
| `B`      | `B label`        | Unconditional.                                    |
| `BL`     | `BL label`       | Branch with link (stores return addr in `X30`).   |
| `BR`     | `BR Xn`          | Branch to register.                               |
| `BLR`    | `BLR Xn`         | Branch to register with link.                     |
| `RET`    | `RET` / `RET Xn` | Default `RET` uses X30.                           |
| `B.cond` | `B.EQ label` etc.| One per condition code listed above.              |
| `Bcond`  | `BEQ label` etc. | GAS-style alias for every `B.cond` form (`BNE`, `BLT`, `BGT`, ...). Emits the same encoding; lets unmodified GCC output assemble unchanged. |
| `CBZ`    | `CBZ Rt, label`  | Compare-and-branch if zero. `Rt` can be W or X.   |
| `CBNZ`   | `CBNZ Rt, label` | Compare-and-branch if non-zero.                   |
| `TBZ`    | `TBZ Rt, #bit, label` | Test-bit-and-branch if zero. `bit` is 0..63. |
| `TBNZ`   | `TBNZ Rt, #bit, label`| Test-bit-and-branch if set.                  |

## System

| Mnemonic | Form     | Notes                                  |
| -------- | -------- | -------------------------------------- |
| `NOP`    | `NOP`    | Does nothing, still advances PC.       |
| `SVC`    | `SVC #0` | Hosted: reads the syscall number from `x8`. `SVC #N` with `N != 0` halts the CPU. |

## Floating point

Double-precision only; D registers live next to the X file in
`registers.rs`.

| Mnemonic | Form                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| `FMOV`   | `FMOV Dd, Dn`                     | Bit-for-bit copy.                       |
| `FADD`   | `FADD Dd, Dn, Dm`                 | `d` is double precision.                |
| `FSUB`   | `FSUB Dd, Dn, Dm`                 |                                         |
| `FMUL`   | `FMUL Dd, Dn, Dm`                 |                                         |
| `FDIV`   | `FDIV Dd, Dn, Dm`                 |                                         |
| `FCMP`   | `FCMP Dn, Dm`                     | Updates NZCV. Unordered sets C and V.   |
| `SCVTF`  | `SCVTF Dd, Xn` / `SCVTF Dd, Wn`   | Signed integer to double.               |
| `FCVTZS` | `FCVTZS Xd, Dn` / `FCVTZS Wd, Dn` | Truncate double to signed integer.      |

## Directives

| Directive     | Notes                                                 |
| ------------- | ----------------------------------------------------- |
| `.text` / `.data` / `.rodata` / `.bss` | Switch current section.      |
| `.section <name>` | Named form; `.rodata` / `.bss` / etc.             |
| `.global` / `.globl` | Mark a symbol as externally visible.           |
| `.balign N`   | Pad to an N-byte boundary (byte count).               |
| `.align N`    | Pad to 2^N bytes (power-of-two form).                 |
| `.skip N` / `.zero N` | Reserve N zero-initialized bytes.             |
| `.byte`       | One byte.                                             |
| `.hword` / `.short` | Two bytes little-endian.                        |
| `.word`       | Four bytes little-endian.                             |
| `.quad`       | Eight bytes little-endian.                            |
| `.double`     | IEEE 754 double (use `0r3.14` literal form).          |
| `.float`      | IEEE 754 float.                                       |
| `.string` / `.asciz` | Null-terminated string.                        |
| `.ascii`      | String, no null terminator.                           |
| `.type` / `.size` | Parsed-and-ignored so GCC output still loads.     |

## Pseudo-instructions

| Pseudo                | Lowers to                           |
| --------------------- | ----------------------------------- |
| `ldr Xt, =<symbol>`   | `LDR (literal)` with a pool slot.   |
| `ldr Xt, =<constant>` | Same, or a MOVZ/MOVK chain for small constants. |
| `tst Rn, #imm`        | `ANDS WZR/XZR, Rn, #imm` (bitmask immediate encoding). |
| `cmp Rn, #imm`        | `SUBS WZR/XZR, Rn, #imm`.           |
| `mov Rd, #imm`        | MOVZ/MOVK/MOVN sequence depending on immediate shape. |

## m4 preprocessing

| Form                     | Notes                                                |
| ------------------------ | ---------------------------------------------------- |
| `define(NAME, BODY)`     | Token-boundary substitution. Use for register aliases. |
| `NAME = EXPRESSION`      | Symbol assignment. `.` is the address at the line where the assignment appears. |

`ifdef`, `ifelse`, `forloop`, `dnl`, and backtick quoting are rejected.

## GCC output compatibility

Unmodified AArch64 GCC `-S` output assembles. The lexer accepts
`@ident` attribute tokens (`.type foo, @function`, `@progbits`), the
parser treats `.L2:` / `.Ltext0:` style dotted names as labels when
they end in `:`, and the GAS-style lowercase `bgt` / `beq` / `blt`
conditional branches route to the same encoding as `B.GT` / `B.EQ` /
`B.LT`. Label lookups are case-preserving so mixed-case `.L<N>`
targets resolve the way GCC emitted them.

## Host stubs (hosted runtime)

Pre-registered at `Cpu::new` time. Available without extra setup:

| Name     | Notes                                                    |
| -------- | -------------------------------------------------------- |
| `printf` | `%d %i %u %x %X %o %s %c %% %p %f %.Nf`; walks `x0..x7` and `d0..d7` independently for mixed int/double args. |
| `scanf`  | `%d %u %x %s %c %f`; returns `WaitingForInput` when stdin runs dry. |
| `puts` / `putchar` / `getchar` | Standard libc semantics.                  |
| `strlen` / `strcmp` / `strcpy` | Standard libc semantics.                  |
| `memset` / `memcpy`            | Standard libc semantics.                  |
| `exit`                         | Halts the CPU with `x0` as exit code.     |
| `atof`                         | Writes result into `d0`.                  |

## Syscalls (`svc 0` with `x8`)

| x8 | Name        | Args                                     |
| -- | ----------- | ---------------------------------------- |
| 56 | openat      | `x0=AT_FDCWD=-100`, `x1=path`, `x2=flags`, `x3=mode` |
| 57 | close       | `x0=fd`                                  |
| 62 | lseek       | `x0=fd`, `x1=offset`, `x2=whence`        |
| 63 | read        | `x0=fd`, `x1=buf`, `x2=count`            |
| 64 | write       | `x0=fd`, `x1=buf`, `x2=count`            |
| 93 | exit        | `x0=status`                              |

## NZCV flags

`ADDS`, `SUBS`, `ANDS`, `CMP`, `CMN`, `TST` update the condition flags. They are visible in the register panel as `N Z C V` and used by `B.cond` / `CSEL` / `CSET` / friends.

## Things that are not implemented

- SIMD vector widths (Q registers, `LDP Dn, Dm, ...`, arrangement
  specifiers)
- System registers (`MRS`, `MSR`)
- Atomics (`LDAR`, `STXR`, `LDXR`, `STLR`)
- `SWP`, `CAS`, load-acquire / store-release
- Crypto, SVE, SME

If you hit one of these and need it, see [`CONTRIBUTING.md`](CONTRIBUTING.md) for how to add it.
