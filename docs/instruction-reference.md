# Instruction reference

Every instruction the playground understands. If it isn't listed here, the assembler will reject it with an `unknown mnemonic` error.

Register operands are `X0`-`X30` (64-bit), `W0`-`W30` (32-bit), `SP`, and `XZR`/`WZR`. Immediates are prefixed with `#` and can be written decimal (`#42`), hex (`#0x2a`), or binary (`#0b101010`). Labels end with a colon.

## Data processing

| Mnemonic | Form                             | Notes                                    |
| -------- | -------------------------------- | ---------------------------------------- |
| `MOV`    | `MOV Xd, Xn` / `MOV Xd, #imm` / `MOV Xd, SP` | Register-to-register or wide immediate. `MOV Xd, SP` / `MOV SP, Xn` lower to `ADD ..., #0`. Immediates that fit in one shifted 16-bit field (e.g. `#0x10000000 = #0x1000 LSL #16`) are auto-encoded as MOVZ with the right shift; a repeating bit pattern that fits no shifted field (e.g. `#0x5555555555555555`) lowers to `ORR Xd, XZR, #imm` instead. |
| `MOVZ`   | `MOVZ Xd, #imm, LSL #shift`      | Zero upper bits, shift is 0/16/32/48.    |
| `MOVK`   | `MOVK Xd, #imm, LSL #shift`      | Keep other halfwords.                    |
| `MOVN`   | `MOVN Xd, #imm, LSL #shift`      | Bitwise NOT, same shifts.                |
| `ADD`    | `ADD Xd, Xn, Xm` / `..., #imm` / `ADD Xd, Xn, Wm, SXTW #s` | No flags. The last form is the extended-register one: the index register is widened (`UXTB`/`UXTH`/`UXTW`/`UXTX`/`SXTB`/`SXTH`/`SXTW`/`SXTX`) and then shifted left by 0 to 4. It is the only register form that reaches `SP`. |
| `ADDS`   | same                             | Sets NZCV.                               |
| `SUB`    | `SUB Xd, Xn, Xm` / `..., #imm` / `SUB Xd, Xn, Wm, SXTW #s` | No flags. Same extended-register form as `ADD`. |
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
| `BIC`    | `BIC Xd, Xn, Xm`                 | Bit clear: `Xd = Xn & ~Xm`. Register form only; AArch64 has no BIC-immediate. |
| `LSL`    | `LSL Xd, Xn, #imm` / `LSL Xd, Xn, Xm` | Logical shift left by an immediate (0 to width-1) or by a register, modulo the width. |
| `LSR`    | `LSR Xd, Xn, #imm` / `LSR Xd, Xn, Xm` | Logical shift right, immediate or register amount. |
| `ASR`    | `ASR Xd, Xn, #imm` / `ASR Xd, Xn, Xm` | Arithmetic shift right, immediate or register amount. |
| `ROR`    | `ROR Xd, Xn, #imm` / `ROR Xd, Xn, Xm` | Rotate right, immediate or register amount. The immediate form is an alias for `EXTR Xd, Xn, Xn, #imm`; the register form is `RORV`. |
| `UBFX`   | `UBFX Xd, Xn, #lsb, #width`      | Unsigned bitfield extract: pulls `width` bits starting at `lsb` down to bit 0, zeros the rest. Alias for `UBFM`. |
| `SBFX`   | `SBFX Xd, Xn, #lsb, #width`      | Signed bitfield extract: the same field, sign-extended from its top bit instead of zeroed. Alias for `SBFM`. |
| `BFI`    | `BFI Xd, Xn, #lsb, #width`       | Bitfield insert: drops the low `width` bits of `Xn` into `Xd` at `lsb`; every other `Xd` bit survives. Alias for `BFM`. |
| `SXTB`   | `SXTB Xd, Wn` / `SXTB Wd, Wn`    | Sign-extend a byte. Alias for `SBFM`.    |
| `SXTH`   | `SXTH Xd, Wn` / `SXTH Wd, Wn`    | Sign-extend a halfword.                  |
| `SXTW`   | `SXTW Xd, Wn`                    | Sign-extend a word to 64 bits.           |
| `UXTB`   | `UXTB Wd, Wn`                    | Zero-extend a byte. Alias for `UBFM`.    |
| `UXTH`   | `UXTH Wd, Wn`                    | Zero-extend a halfword.                  |

## Compare and test

| Mnemonic | Form              | Notes                               |
| -------- | ----------------- | ----------------------------------- |
| `CMP`    | `CMP Xn, Xm/#imm` | `SUBS XZR, ...`; sets NZCV. A negative immediate flips to `CMN` with the positive value, as GAS does (`cmp w1, -1` = `cmn w1, 1`). |
| `CMN`    | `CMN Xn, Xm/#imm` | `ADDS XZR, ...`. Negative immediates flip to `CMP` the same way. |
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
| `LDRSB`  | `LDRSB Wt, [Xn, #imm]` / `LDRSB Xt, [Xn, #imm]`       | Byte load, sign-extended into Wt or Xt. |
| `LDRSH`  | same addressing forms                                 | Halfword load, sign-extended.      |
| `LDRSW`  | `LDRSW Xt, [Xn, #imm]`                                | Word load, sign-extended to 64 bits. `Xt` target only, per the ARM spec. |

Addressing modes:

- **signed offset**: `[Xn, #imm]`. A negative or unaligned immediate (a struct field like `[fp, 20]` under a 64-bit load, or `[fp, -8]`) has no scaled encoding, so the assembler emits the unscaled (LDUR/STUR) form for it automatically, exactly as GAS does; that form reaches `[-256, 255]`.
- **pre-index**: `[Xn, #imm]!` (writes the new address back into Xn)
- **post-index**: `[Xn], #imm` (uses the base, then updates Xn)
- **register offset**: `[Xn, Xm]` (LSL by access size) or `[Xn, Wm, SXTW #k]`
- **register offset with extend**: `[Xn, Wm, UXTW]`, `[Xn, Xm, LSL #3]`, `[Xn, Xm, SXTX]`, etc.

Unaligned access succeeds (SCTLR.A = 0), as on AArch64 Linux. The sign-extending loads (`LDRSB` / `LDRSH` / `LDRSW`) take the unsigned immediate-offset form `[Xn, #imm]` and the register-offset forms, but no pre/post-index writeback. FP data moves (`LDR`/`STR` with a `Dt` or `St` target) accept the same immediate addressing as the integer forms: scaled offsets, negative and unaligned offsets via the unscaled encoding, and pre/post-index writeback. Register-offset addressing stays integer-only.

## PC-relative addressing

| Mnemonic | Form                  | Notes                                          |
| -------- | --------------------- | ---------------------------------------------- |
| `ADR`    | `ADR Xd, label`       | Byte-relative address of `label`.              |
| `ADRP`   | `ADRP Xd, label`      | Address of the 4 KiB page containing `label`.  |

The `adrp` / `add :lo12:` pair forms an address in two steps: `adrp Xd, sym` gives the page base, then `add Xd, Xd, :lo12:sym` adds the low 12 bits. Interchangeable with `ldr Xd, =sym`.

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

Every scalar instruction takes both course views of the register file: the S form (single precision, a C `float`, the register's low 32 bits) and the D form (double precision, a C `double`). Widths never mix inside one instruction; `FCVT` converts between them. Single-precision arithmetic rounds in single precision, exactly like the hardware, and an S write zeroes the upper half of the register.

| Mnemonic | Form                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| `FMOV`   | `FMOV Dd, Dn` / `FMOV Sd, Sn` / `FMOV Dd, #imm` / `FMOV Sd, #imm` | Bit-for-bit copy, or an 8-bit float immediate (`fmov d9, 5.0`, `fmov s1, 0.5`). The immediate must be a small power-of-two multiple of 1.0-1.9375 (so 0.5, 1.0, 2.0, 5.0, 9.0 work; 0.0 and 100.0 do not: load those from a `.double` / `.float`). |
| `FADD`   | `FADD Dd, Dn, Dm` / `FADD Sd, Sn, Sm` | The register width picks the precision. |
| `FSUB`   | `FSUB Dd, Dn, Dm` / `FSUB Sd, Sn, Sm` |                                     |
| `FMUL`   | `FMUL Dd, Dn, Dm` / `FMUL Sd, Sn, Sm` |                                     |
| `FDIV`   | `FDIV Dd, Dn, Dm` / `FDIV Sd, Sn, Sm` |                                     |
| `FNEG`   | `FNEG Dd, Dn` / `FNEG Sd, Sn`     | Flip the sign: `Fd = -Fn`.              |
| `FABS`   | `FABS Dd, Dn` / `FABS Sd, Sn`     | Absolute value: clears the sign bit.    |
| `FSQRT`  | `FSQRT Dd, Dn` / `FSQRT Sd, Sn`   | Square root. A negative operand gives NaN, not a fault. |
| `FCMP`   | `FCMP Dn, Dm` / `FCMP Sn, Sm`     | Updates NZCV. Unordered sets C and V.   |
| `FCVT`   | `FCVT Dd, Sn` / `FCVT Sd, Dn`     | Precision convert: widening is exact, narrowing rounds. Widen before `printf` (it takes doubles). |
| `SCVTF`  | `SCVTF Dd, Xn` / `SCVTF Dd, Wn` / `SCVTF Sd, Wn` | Signed integer to float.  |
| `FCVTZS` | `FCVTZS Xd, Dn` / `FCVTZS Wd, Dn` / `FCVTZS Wd, Sn` | Truncate float to signed integer. |

## Directives

| Directive     | Notes                                                 |
| ------------- | ----------------------------------------------------- |
| `.text` / `.data` / `.rodata` / `.bss` | Switch current section.      |
| `.section <name>` | Named form; `.rodata` / `.bss` / etc.             |
| `.global` / `.globl` | Mark a symbol as externally visible.           |
| `.balign N`   | Pad to an N-byte boundary (byte count).               |
| `.align N`    | Pad to 2^N bytes (power-of-two form).                 |
| `.skip N` / `.zero N` | Reserve N zero-initialized bytes. `N` may be a constant expression over equates defined above it (`.skip STACKSIZE * 4`). |
| `.byte`       | One byte.                                             |
| `.hword` / `.short` | Two bytes little-endian.                        |
| `.word`       | Four bytes little-endian.                             |
| `.quad` / `.dword` | Eight bytes little-endian. Course files write `.dword`; GCC output writes `.quad`. Values may name labels (`table: .dword msg_one, msg_two`): each slot receives the label's absolute address at link time, which is how assignment-style pointer tables are built and then indexed with `ldr Xt, [table, Wi, SXTW 3]`. |
| `.double`     | IEEE 754 double (use `0r3.14` literal form).          |
| `.float`      | IEEE 754 float.                                       |
| `.string` / `.asciz` | Null-terminated string.                        |
| `.ascii`      | String, no null terminator.                           |
| `.type` / `.size` | Parsed-and-ignored so GCC output still loads.     |
| `name .req reg` | Register alias, integer or FP (`fp .req x29`, `sum .req d19`). Takes effect on the lines after it; string literals are never rewritten. |

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

`ifdef`, `ifelse`, `forloop`, and `dnl` are rejected, and so is a backtick anywhere except ``undefine(`NAME')``, whose m4 quotes are legal. Undefining a name ends that define's reach at that line, so an alias can be rebound per function.

## GCC output compatibility

Unmodified AArch64 GCC `-S` output assembles: the lexer accepts `@ident` attribute tokens (`.type foo, @function`, `@progbits`), `.L2:` / `.Ltext0:` dotted names are labels when they end in `:`, lowercase `bgt` / `beq` / `blt` route to the encoding for `B.GT` / `B.EQ` / `B.LT`, and label lookups are case-preserving so mixed-case `.L<N>` targets resolve as GCC emitted them.

## Host stubs (hosted runtime)

Pre-registered and available without setup:

| Name     | Notes                                                    |
| -------- | -------------------------------------------------------- |
| `printf` | `%d %i %u %x %X %o %s %c %% %p %f %.Nf`; walks `x0..x7` and `d0..d7` independently for mixed int/double args. |
| `scanf`  | `%d %u %x %s %c %f`; returns `WaitingForInput` when stdin runs dry. |
| `puts` / `putchar` / `getchar` | Standard libc semantics.                  |
| `strlen` / `strcmp` / `strcpy` | Standard libc semantics.                  |
| `memset` / `memcpy`            | Standard libc semantics.                  |
| `exit`                         | Halts the CPU with `x0` as exit code.     |
| `atof`                         | Writes result into `d0`.                  |
| `atoi`                         | Standard C semantics (skips whitespace, optional sign, stops at the first non-digit); result in `w0`. The usual partner of argv string handling. |
| `rand` / `srand`               | The portable C LCG, `RAND_MAX` 32767. Unseeded behaves as `srand(1)`. Draws are deterministic and survive step-back, so replay shows the same sequence. |
| `time`                         | Returns a fixed timestamp (and stores it through `x0` when non-null), so `srand(time(0))` seeds the same run every time. Reproducibility over wall-clock realism, by design. |
| `malloc` / `free`              | A fixed 1 MiB heap window at `0x0090_0000`. Allocator state is host-side, so a stray store cannot corrupt the free list; a wild or double free halts with a plain message, and exhaustion returns NULL. |
| `usleep`                       | Pauses the run for the requested time. A real-time runner waits it out; the step budget is refunded at a capped rate so a paced program is not punished for sleeping. |
| `fflush`                       | Accepted and ignored: output is never buffered here. |
| `sqrt`                         | Argument in `d0`, result in `d0`. Of a negative it is NaN -- the IEEE answer, not an error. |
| `pow`                          | Base in `d0`, exponent in `d1`, result in `d0`. `pow(0, 0)` is 1, per C. |
| `sin`                          | Radians in `d0`, result in `d0`.          |
| `cos`                          | Radians in `d0`, result in `d0`.          |
| `tan`                          | Radians in `d0`, result in `d0`.          |
| `log`                          | Argument in `d0`, result in `d0`. The natural log; of zero it is `-inf`, of a negative NaN. |
| `log10`                        | Argument in `d0`, result in `d0`. Base ten, same domain edges as `log`. |
| `exp`                          | Argument in `d0`, result in `d0`. `e` raised to the argument. |
| `floor`                        | Argument in `d0`, result in `d0`. Rounds toward negative infinity. |
| `fabs`                         | Argument in `d0`, result in `d0`. Absolute value. |
| `fmod`                         | Dividend in `d0`, divisor in `d1`, result in `d0`. The remainder keeps the sign of the dividend. |

## Syscalls (`svc 0` with `x8`)

| x8 | Name        | Args                                     |
| -- | ----------- | ---------------------------------------- |
| 56 | openat      | `x0=AT_FDCWD=-100`, `x1=path`, `x2=flags`, `x3=mode` |
| 57 | close       | `x0=fd`                                  |
| 62 | lseek       | `x0=fd`, `x1=offset`, `x2=whence`        |
| 63 | read        | `x0=fd`, `x1=buf`, `x2=count`            |
| 64 | write       | `x0=fd`, `x1=buf`, `x2=count`            |
| 93 | exit        | `x0=status`                              |
| 94 | exit_group  | `x0=status` (what glibc's `exit()` issues; same effect as 93) |
| 25 | fcntl       | `x0=fd`, `x1=cmd`, `x2=arg` (F_GETFL / F_SETFL with O_NONBLOCK on stdin) |
| 29 | ioctl       | `x0=fd`, `x1=request`, `x2=argp` (TCGETS / TCSETS termios, the raw-mode handshake) |
| 101 | nanosleep  | `x0=req`, `x1=rem` (pauses the run; the virtual clock advances) |
| 113 | clock_gettime | `x0=clock_id`, `x1=timespec`            |
| 278 | getrandom  | `x0=buf`, `x1=buflen`, `x2=flags` (deterministic, so replay matches) |

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
