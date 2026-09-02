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
| `ADC`    | `ADC Xd, Xn, Xm`                 | Add with carry: `Xd = Xn + Xm + C`, the carry flag as the carry-in. Register form only; AArch64 has no add-with-carry immediate. Chains 64-bit words into wider arithmetic after an `ADDS`. |
| `ADCS`   | same                             | Sets NZCV from `Xn + Xm + C`: C is the carry out of the register width, V the signed overflow. |
| `SBC`    | `SBC Xd, Xn, Xm`                 | Subtract with carry: `Xd = Xn + NOT(Xm) + C`, that is `Xn - Xm - (1 - C)`. Register form only; the carry is the not-borrow an earlier `SUBS` left. |
| `SBCS`   | same                             | Sets NZCV from `Xn + NOT(Xm) + C`. With C set it matches `SUBS`; with C clear it also takes the borrow away. |
| `MUL`    | `MUL Xd, Xn, Xm`                 | Low 64 bits of product. Alias for `MADD Xd, Xn, Xm, XZR`. |
| `MADD`   | `MADD Xd, Xn, Xm, Xa`            | Multiply-add: `Xd = Xa + Xn * Xm`.       |
| `MSUB`   | `MSUB Xd, Xn, Xm, Xa`            | Multiply-subtract: `Xd = Xa - Xn * Xm`. |
| `MNEG`   | `MNEG Xd, Xn, Xm`                | Negated multiply: `Xd = -(Xn * Xm)`, wrapping at the register width. Alias for `MSUB Xd, Xn, Xm, XZR`. |
| `SMULL`  | `SMULL Xd, Wn, Wm`               | Widening multiply: the exact 64-bit product of two signed 32-bit values. |
| `UMULL`  | `UMULL Xd, Wn, Wm`               | Widening multiply, unsigned.             |
| `SMULH`  | `SMULH Xd, Xn, Xm`               | The top 64 bits of the signed 128-bit product. |
| `UMULH`  | `UMULH Xd, Xn, Xm`               | The top 64 bits of the unsigned 128-bit product. |
| `SMADDL` | `SMADDL Xd, Wn, Wm, Xa`          | Widening multiply-add: `Xd = Xa + Wn * Wm`, the 32x32 product taken as signed. The accumulator is a full 64-bit register. `SMULL` is this with `Xa = XZR`. |
| `SMSUBL` | `SMSUBL Xd, Wn, Wm, Xa`          | `Xd = Xa - Wn * Wm`, signed.            |
| `UMADDL` | `UMADDL Xd, Wn, Wm, Xa`          | The unsigned form of `SMADDL`.          |
| `UMSUBL` | `UMSUBL Xd, Wn, Wm, Xa`          | The unsigned form of `SMSUBL`.          |
| `SMNEGL` | `SMNEGL Xd, Wn, Wm`              | `Xd = -(Wn * Wm)`, signed and widening. Alias for `SMSUBL Xd, Wn, Wm, XZR`. |
| `UMNEGL` | `UMNEGL Xd, Wn, Wm`              | The unsigned form.                      |
| `UDIV`   | `UDIV Xd, Xn, Xm`                | Unsigned divide, zero on divide-by-zero. |
| `SDIV`   | `SDIV Xd, Xn, Xm`                | Signed divide.                           |
| `NEG`    | `NEG Xd, Xm`                     | Alias for `SUB Xd, XZR, Xm`.             |
| `NEGS`   | `NEGS Xd, Xm`                    | Alias for `SUBS Xd, XZR, Xm`; sets NZCV. |
| `AND`    | `AND Xd, Xn, Xm` / `..., #imm`   | Logical AND.                             |
| `ANDS`   | same                             | Sets NZCV.                               |
| `ORR`    | `ORR Xd, Xn, Xm`                 | Logical OR.                              |
| `EOR`    | `EOR Xd, Xn, Xm`                 | Exclusive OR.                            |
| `MVN`    | `MVN Xd, Xm` (`, LSL #k` optional) | Bitwise NOT. Alias for `ORN Xd, XZR, Xm`, so the shifted form negates the shifted source. |
| `BIC`    | `BIC Xd, Xn, Xm` (`, LSL #k` optional) | Bit clear: `Xd = Xn & ~Xm`. Register form only; AArch64 has no BIC-immediate. |
| `ORN`    | `ORN Xd, Xn, Xm` (`, LSL #k` optional) | Logical OR with the second source inverted: `Xd = Xn \| ~Xm`. `MVN Xd, Xm` is `ORN Xd, XZR, Xm`. |
| `EON`    | `EON Xd, Xn, Xm` (`, LSL #k` optional) | Exclusive OR with the second source inverted: `Xd = Xn ^ ~Xm`, which is XNOR. |
| `CLZ`    | `CLZ Xd, Xn` / `CLZ Wd, Wn`      | Count leading zeros. Of zero it is the register width (64 or 32), not an error. |
| `CLS`    | `CLS Xd, Xn` / `CLS Wd, Wn`      | Count leading sign bits: the run of bits matching the top one, minus that bit. Of 0 and of -1 alike it is the width minus one (63 or 31). |
| `RBIT`   | `RBIT Xd, Xn` / `RBIT Wd, Wn`    | Reverse the bit order across the whole register. |
| `REV`    | `REV Xd, Xn` / `REV Wd, Wn`      | Reverse the byte order across the register (a byte-swap). The X and W forms are different encodings, not one instruction with a width bit. |
| `REV16`  | `REV16 Xd, Xn` / `REV16 Wd, Wn`  | Reverse the bytes inside each 16-bit halfword. |
| `REV32`  | `REV32 Xd, Xn`                   | Reverse the bytes inside each 32-bit word. X registers only; the W-sized byte-swap is `REV Wd, Wn`. |
| `LSL`    | `LSL Xd, Xn, #imm` / `LSL Xd, Xn, Xm` | Logical shift left by an immediate (0 to width-1) or by a register, modulo the width. |
| `LSR`    | `LSR Xd, Xn, #imm` / `LSR Xd, Xn, Xm` | Logical shift right, immediate or register amount. |
| `ASR`    | `ASR Xd, Xn, #imm` / `ASR Xd, Xn, Xm` | Arithmetic shift right, immediate or register amount. |
| `ROR`    | `ROR Xd, Xn, #imm` / `ROR Xd, Xn, Xm` | Rotate right, immediate or register amount. The immediate form is an alias for `EXTR Xd, Xn, Xn, #imm`; the register form is `RORV`. |
| `UBFX`   | `UBFX Xd, Xn, #lsb, #width`      | Unsigned bitfield extract: pulls `width` bits starting at `lsb` down to bit 0, zeros the rest. Alias for `UBFM`. |
| `SBFX`   | `SBFX Xd, Xn, #lsb, #width`      | Signed bitfield extract: the same field, sign-extended from its top bit instead of zeroed. Alias for `SBFM`. |
| `BFI`    | `BFI Xd, Xn, #lsb, #width`       | Bitfield insert: drops the low `width` bits of `Xn` into `Xd` at `lsb`; every other `Xd` bit survives. Alias for `BFM`. |
| `BFXIL`  | `BFXIL Xd, Xn, #lsb, #width`     | Bitfield extract and insert low: pulls `width` bits from `lsb` in `Xn` down to bit 0 of `Xd` and leaves every other `Xd` bit alone. Same field math as `UBFX`, which zeroes the rest instead. Alias for `BFM`. |
| `UBFIZ`  | `UBFIZ Xd, Xn, #lsb, #width`     | Unsigned bitfield insert in zeros: takes the low `width` bits of `Xn`, places them at `lsb`, zeroes everything else. The inverse shape of `UBFX`. Alias for `UBFM`; GCC emits it for `(long)(unsigned)x * 4`. |
| `SBFIZ`  | `SBFIZ Xd, Xn, #lsb, #width`     | The same placement, sign-extended from the field's top bit upward instead of zeroed. Alias for `SBFM`. |
| `SXTB`   | `SXTB Xd, Wn` / `SXTB Wd, Wn`    | Sign-extend a byte. Alias for `SBFM`.    |
| `SXTH`   | `SXTH Xd, Wn` / `SXTH Wd, Wn`    | Sign-extend a halfword.                  |
| `SXTW`   | `SXTW Xd, Wn`                    | Sign-extend a word to 64 bits.           |
| `UXTB`   | `UXTB Wd, Wn`                    | Zero-extend a byte. Alias for `UBFM`.    |
| `UXTH`   | `UXTH Wd, Wn`                    | Zero-extend a halfword.                  |
| `UXTW`   | `UXTW Xd, Wn` / `UXTW Wd, Wn`    | Zero-extend a word to 64 bits. GAS assembles it as `MOV Wd, Wn`, the same word either spelling produces, because a W-register write clears the top half. The counterpart of `SXTW`; GCC emits it for an `unsigned int` index widened before an address computation. |

## Compare and test

| Mnemonic | Form              | Notes                               |
| -------- | ----------------- | ----------------------------------- |
| `CMP`    | `CMP Xn, Xm/#imm` | `SUBS XZR, ...`; sets NZCV. A negative immediate flips to `CMN` with the positive value, as GAS does (`cmp w1, -1` = `cmn w1, 1`). |
| `CMN`    | `CMN Xn, Xm/#imm` | `ADDS XZR, ...`. Negative immediates flip to `CMP` the same way. |
| `TST`    | `TST Xn, Xm/#imm` | `ANDS XZR, ...`.                    |
| `CCMP`   | `CCMP Xn, Xm, #nzcv, cond` / `CCMP Xn, #imm5, #nzcv, cond` | Conditional compare: when `cond` holds, set NZCV from `Xn - Xm` as `CMP` would; otherwise set NZCV to the 4-bit literal (`N Z C V`, high bit first). The immediate is 0 to 31, unsigned. GCC builds `&&` and `\|\|` chains out of these instead of branching. |
| `CCMN`   | same shapes       | The `CMN` form: the taken path sets NZCV from `Xn + Xm`. |

## Conditional select

| Mnemonic | Form                            | Notes                               |
| -------- | ------------------------------- | ----------------------------------- |
| `CSEL`   | `CSEL Xd, Xn, Xm, cond`         | Xd = cond ? Xn : Xm.                |
| `CSINC`  | `CSINC Xd, Xn, Xm, cond`        | Xd = cond ? Xn : Xm+1.              |
| `CSINV`  | `CSINV Xd, Xn, Xm, cond`        | Xd = cond ? Xn : ~Xm.               |
| `CSNEG`  | `CSNEG Xd, Xn, Xm, cond`        | Xd = cond ? Xn : -Xm.               |
| `CSET`   | `CSET Xd, cond`                 | Alias for `CSINC Xd, XZR, XZR, !cond`. |
| `CSETM`  | `CSETM Xd, cond`                | Xd = cond ? all-ones : 0 (the mask form of `CSET`). Alias for `CSINV Xd, XZR, XZR, !cond`. |
| `CINC`   | `CINC Xd, Xn, cond`             | Xd = cond ? Xn+1 : Xn. Alias for `CSINC Xd, Xn, Xn, !cond`. |
| `CINV`   | `CINV Xd, Xn, cond`             | Xd = cond ? ~Xn : Xn. Alias for `CSINV Xd, Xn, Xn, !cond`. |
| `CNEG`   | `CNEG Xd, Xn, cond`             | Xd = cond ? -Xn : Xn. Alias for `CSNEG Xd, Xn, Xn, !cond`. |

Condition codes: `EQ`, `NE`, `HS`/`CS`, `LO`/`CC`, `MI`, `PL`, `VS`, `VC`, `HI`, `LS`, `GE`, `LT`, `GT`, `LE`.

The five `cset`-family aliases encode the inverse of the condition you write,
which is why none of them accepts `AL` or `NV`.

## Memory

| Mnemonic | Form                                                  | Notes                              |
| -------- | ----------------------------------------------------- | ---------------------------------- |
| `LDR`    | `LDR Xt, [Xn]` / `[Xn, #imm]` / `[Xn, #imm]!` / `[Xn], #imm` | 64-bit load.              |
| `STR`    | same                                                  | 64-bit store.                      |
| `LDRB`   | same addressing forms                                 | Byte load, zero-extends.           |
| `STRB`   | same                                                  | Byte store.                        |
| `LDRH`   | same                                                  | Halfword load.                     |
| `STRH`   | same                                                  | Halfword store.                    |
| `LDP`    | `LDP Xt1, Xt2, [Xn, #imm]` / `LDP Dt1, Dt2, ...` (+ pre/post index) | Load pair, general or FP registers (D pairs scale by 8, S pairs by 4). |
| `STP`    | same                                                  | Store pair. `stp d8, d9, [sp, -16]!` is the AAPCS64 callee-saved FP prologue. |
| `LDRSB`  | `LDRSB Wt, [Xn, #imm]` / `LDRSB Xt, [Xn, #imm]` / `[Xn, #imm]!` / `[Xn], #imm` | Byte load, sign-extended into Wt or Xt. |
| `LDRSH`  | same addressing forms                                 | Halfword load, sign-extended.      |
| `LDRSW`  | `LDRSW Xt, [Xn, #imm]` / `[Xn, #imm]!` / `[Xn], #imm` | Word load, sign-extended to 64 bits. `Xt` target only, per the ARM spec. |

Addressing modes:

- **signed offset**: `[Xn, #imm]`. A negative or unaligned immediate (a struct field like `[fp, 20]` under a 64-bit load, or `[fp, -8]`) has no scaled encoding, so the assembler emits the unscaled (LDUR/STUR) form for it automatically, exactly as GAS does; that form reaches `[-256, 255]`.
- **pre-index**: `[Xn, #imm]!` (writes the new address back into Xn)
- **post-index**: `[Xn], #imm` (uses the base, then updates Xn)
- **register offset**: `[Xn, Xm]` (LSL by access size) or `[Xn, Wm, SXTW #k]`
- **register offset with extend**: `[Xn, Wm, UXTW]`, `[Xn, Xm, LSL #3]`, `[Xn, Xm, SXTX]`, etc.

Unaligned access succeeds (SCTLR.A = 0), as on AArch64 Linux. The sign-extending loads (`LDRSB` / `LDRSH` / `LDRSW`) take every addressing form the plain loads do: the scaled unsigned offset, the unscaled form for a negative or unaligned offset, pre- and post-index writeback, and the register-offset forms. FP data moves (`LDR`/`STR` with a `Dt` or `St` target) accept the same immediate addressing as the integer forms: scaled offsets, negative and unaligned offsets via the unscaled encoding, and pre/post-index writeback. Register-offset addressing stays integer-only.

## PC-relative addressing

| Mnemonic | Form                  | Notes                                          |
| -------- | --------------------- | ---------------------------------------------- |
| `ADR`    | `ADR Xd, label`       | Byte-relative address of `label`.              |
| `ADRP`   | `ADRP Xd, label`      | Address of the 4 KiB page containing `label`.  |

The `adrp` / `add :lo12:` pair forms an address in two steps: `adrp Xd, sym` gives the page base, then `add Xd, Xd, :lo12:sym` adds the low 12 bits. Interchangeable with `ldr Xd, =sym`. Both halves accept a symbol plus a constant offset (`adrp x0, msg+8` / `add x0, x0, :lo12:msg+8`), which is how GCC addresses the middle of a string or a struct field; the offset folds into the address before the page split, so write the same expression in both halves.

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

The `FCVT` conversion family names its rounding mode in the mnemonic: `N` nearest with ties to even, `A` nearest with ties away from zero, `M` toward minus infinity, `P` toward plus infinity, `Z` toward zero. The trailing `S`/`U` picks a signed or unsigned result.

| Mnemonic | Form                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| `FMOV`   | `FMOV Dd, Dn` / `FMOV Dd, Xn` / `FMOV Xd, Dn` / `FMOV Dd, #imm` (and the S/W forms of each) | Bit-for-bit copy: within the FP file, or between the files (`fmov d0, x0` pairs x with d and w with s; no conversion happens). The immediate form takes an 8-bit float immediate (`fmov d9, 5.0`, `fmov s1, 0.5`): a small power-of-two multiple of 1.0-1.9375, so 0.5, 1.0, 2.0, 5.0, 9.0 work and 0.0 or 100.0 do not (load those from a `.double` / `.float`). |
| `FADD`   | `FADD Dd, Dn, Dm` / `FADD Sd, Sn, Sm` | The register width picks the precision. |
| `FSUB`   | `FSUB Dd, Dn, Dm` / `FSUB Sd, Sn, Sm` |                                     |
| `FMUL`   | `FMUL Dd, Dn, Dm` / `FMUL Sd, Sn, Sm` |                                     |
| `FDIV`   | `FDIV Dd, Dn, Dm` / `FDIV Sd, Sn, Sm` |                                     |
| `FNMUL`  | `FNMUL Dd, Dn, Dm` / `FNMUL Sd, Sn, Sm` | `Fd = -(Fn * Fm)`. The sign flips after the multiply, so `fnmul` of `0.0` and `3.0` is `-0.0`, which `fmul` alone never produces. |
| `FMADD`  | `FMADD Dd, Dn, Dm, Da` / `FMADD Sd, Sn, Sm, Sa` | Fused multiply-add: `Fd = Fa + Fn * Fm`. The accumulator is the LAST operand and it is the addend, not a source of the product. Fused means one rounding, so it is not the same as `FMUL` then `FADD`. |
| `FMSUB`  | same shape                        | `Fd = Fa - Fn * Fm` (the product is subtracted FROM the accumulator). |
| `FNMADD` | same shape                        | `Fd = -Fa - Fn * Fm`. |
| `FNMSUB` | same shape                        | `Fd = -Fa + Fn * Fm`. |
| `FMAX`   | `FMAX Dd, Dn, Dm` / S form         | Larger of the two. A NaN operand makes the result NaN. |
| `FMIN`   | `FMIN Dd, Dn, Dm` / S form         | Smaller of the two, same NaN rule.      |
| `FMAXNM` | `FMAXNM Dd, Dn, Dm` / S form       | IEEE `maxNum`: a NaN operand is ignored and the number wins. This is the one C's `fmax()` compiles to. |
| `FMINNM` | `FMINNM Dd, Dn, Dm` / S form       | IEEE `minNum`, same rule.               |
| `FNEG`   | `FNEG Dd, Dn` / `FNEG Sd, Sn`     | Flip the sign: `Fd = -Fn`.              |
| `FABS`   | `FABS Dd, Dn` / `FABS Sd, Sn`     | Absolute value: clears the sign bit.    |
| `FSQRT`  | `FSQRT Dd, Dn` / `FSQRT Sd, Sn`   | Square root. A negative operand gives NaN, not a fault. |
| `FCSEL`  | `FCSEL Dd, Dn, Dm, cond` / S form  | `Fd = cond ? Fn : Fm`. The integer `CSEL` for the FP file; the flags come from an earlier `FCMP` or `CMP`. The chosen register's bits are copied, so a NaN or a signed zero passes through unchanged. Unlike `CSET` and `CINC`, this takes `AL` and `NV`, as GAS does. |
| `FCMP`   | `FCMP Dn, Dm` / `FCMP Sn, Sm`     | Updates NZCV. Unordered sets C and V.   |
| `FCMPE`  | same                              | The signaling form; here it sets the same flags (the emulator raises no FP exceptions). |
| `FCVT`   | `FCVT Dd, Sn` / `FCVT Sd, Dn`     | Precision convert: widening is exact, narrowing rounds. Widen before `printf` (it takes doubles). |
| `SCVTF`  | `SCVTF Dd, Xn` / `SCVTF Sd, Wn` / `SCVTF Dd, Xn, #fbits` / `SCVTF Sd, Sn` / `SCVTF Dd, Dn` | Signed integer to float. The FP-source forms convert integer bits already sitting in the register (how gcc converts an int it loaded with `ldr s31, [...]`). The three-operand form is the fixed-point one: it divides by `2^fbits`, so `scvtf d0, x0, #2` on `6` gives `1.5`. `fbits` runs 1 to 32 for a W source and 1 to 64 for an X one. |
| `UCVTF`  | `UCVTF Dd, Xn` / `UCVTF Sd, Wn` (and the other width pairs) | Unsigned integer to float. `SCVTF` reads the same bits as signed, so the two differ on any value with the top bit set. |
| `FCVTZS` | `FCVTZS Xd, Dn` / `FCVTZS Wd, Sn` / `FCVTZS Xd, Sn, #fbits` | Truncate float to signed integer. The three-operand form is the fixed-point one: it multiplies by `2^fbits` before truncating, so `fcvtzs w0, d0, #2` on `1.5` gives `6`. `fbits` runs 1 to 32 for a W destination and 1 to 64 for an X one. `SCVTF` takes the same third operand and divides instead. |
| `FCVTNS` | `FCVTNS Wd, Dn` / `FCVTNS Xd, Sn` (and the other two width pairs) | Float to signed integer, round to nearest with ties to even. `2.5` and `3.5` both land on the even neighbour (2 and 4), unlike `FCVTZS`, which truncates toward zero. |
| `FCVTNU` | same shapes                       | The unsigned form. A negative input saturates to 0. |
| `FCVTZU` | `FCVTZU Wd, Dn` / `FCVTZU Xd, Sn` (and the other two width pairs) | The unsigned form of `FCVTZS`: truncate toward zero. Negatives saturate to 0. |
| `FCVTAS` | same shapes                       | Round to nearest with ties AWAY from zero: `2.5` gives 3, `-2.5` gives -3. |
| `FCVTAU` | same shapes                       | The unsigned ties-away form. |
| `FCVTMS` | same shapes                       | Round toward minus infinity (floor): `-0.5` gives -1. |
| `FCVTMU` | same shapes                       | The unsigned floor form; a negative input saturates to 0. |
| `FCVTPS` | same shapes                       | Round toward plus infinity (ceiling): `-0.5` gives 0. |
| `FCVTPU` | same shapes                       | The unsigned ceiling form. |

## Directives

| Directive     | Notes                                                 |
| ------------- | ----------------------------------------------------- |
| `.text` / `.data` / `.rodata` / `.bss` | Switch current section.      |
| `.section <name>` | Named form; `.rodata` / `.bss` / etc.             |
| `.global` / `.globl` | Mark a symbol as externally visible.           |
| `.balign N`   | Pad to an N-byte boundary (byte count).               |
| `.align N`    | Pad to 2^N bytes (power-of-two form).                 |
| `.skip N` / `.zero N` / `.space N` | Reserve N zero-initialized bytes. `N` may be a constant expression over equates defined above it (`.skip STACKSIZE * 4`). `.skip` and `.space` take an optional fill byte (`.space 4, 7`), ignored in `.bss` as GAS does; `.zero` takes the size alone. |
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
| `ldr Rt, <label>`     | `LDR (literal)`: loads the value at the label's address. Rt may be X, W, S, or D. Lowered through the literal pool as two words because the data sections sit past imm19's reach here; the S/D forms borrow x16, the same scratch the libc trampolines claim. |
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
| `printf` | `%d %i %u %x %X %o %s %c %% %p %f %e %g %.Nf` plus `*` width and precision; walks `x0..x7` and `d0..d7` independently for mixed int/double args. |
| `sprintf` / `snprintf`         | The printf engine writing into a buffer. `snprintf` truncates to `size - 1` plus the terminator and returns the untruncated length, so `if (n >= size)` detects the overflow. |
| `scanf`  | `%d %u %x %s %c %f`; returns `WaitingForInput` when stdin runs dry. |
| `puts` / `putchar` / `getchar` | Standard libc semantics.                  |
| `fgets` / `fputs`              | Line in, string out, over stdin/stdout/stderr or a virtual file. `fgets` keeps the newline and answers NULL at end of input. |
| `strlen` / `strcmp` / `strcpy` | Standard libc semantics.                  |
| `strncmp` / `strncpy` / `strcat` / `strchr` / `strstr` | glibc-exact where glibc has an opinion: `strncmp` returns the byte difference, `strncpy` NUL-pads the field and omits the terminator when the source fills it, `strchr` can find the terminator itself. |
| `strtok`                       | glibc's static cursor, kept host-side so step-back re-hands the same token. Cuts the string in place. |
| `memset` / `memcpy` / `memcmp` / `memmove` | Standard libc semantics; `memmove` is overlap-safe in both directions. |
| `strtol`                       | glibc's grammar: whitespace, sign, base 0 inferring `0x`/leading-zero/decimal, `endptr` writeback, LONG_MIN/LONG_MAX clamp on overflow. |
| `abs` / `labs`                 | Wrap at the minimum value, like the hardware. |
| `isdigit` / `isalpha` / `isspace` / `toupper` / `tolower` | C locale. The is* stubs return glibc's mask bit (nonzero, not 1), and the `__ctype_b_loc` table the macros index is hosted too. |
| `calloc` / `realloc`           | glibc's edges: `calloc` zeroes and refuses an overflowing product; `realloc` is malloc for NULL, free for size 0, in place when the block already fits. |
| `exit`                         | Halts the CPU with `x0` as exit code.     |
| `atof`                         | Writes result into `d0`.                  |
| `atoi`                         | Standard C semantics (skips whitespace, optional sign, stops at the first non-digit); result in `w0`. The usual partner of argv string handling. |
| `rand` / `srand`               | glibc's TYPE_3 additive generator, `RAND_MAX` 2147483647: the sequence is identical to the course servers', so unseeded draws diff cleanly against sample runs. Unseeded behaves as `srand(1)`. Draws are deterministic and survive step-back, so replay shows the same sequence. |
| `time`                         | Returns a fixed timestamp (and stores it through `x0` when non-null), so `srand(time(0))` seeds the same run every time. Reproducibility over wall-clock realism, by design. |
| `malloc` / `free`              | A fixed 16 MiB heap window at `0x0090_0000`. Allocator state is host-side, so a stray store cannot corrupt the free list; a wild or double free halts with a plain message, and exhaustion returns NULL. |
| `usleep`                       | Pauses the run for the requested time. A real-time runner waits it out; the step budget is refunded at a capped rate so a paced program is not punished for sleeping. |
| `fflush`                       | Accepted and ignored: output is never buffered here. |
| `fopen`                        | Opens a virtual-filesystem file by C mode string (`r`, `w`, `a`, with `+`); returns an opaque FILE* handle, NULL on a missing `r` file or a refused wall. The handle is not a real pointer; dereferencing it faults. |
| `fprintf`                      | The printf engine writing to a FILE* (x0 = stream, x1 = format, varargs from x2). Bytes land in the virtual file under the same caps as the write syscall; the file appears in the console's files view. A stream that never came from fopen is a calm halt naming the fix. |
| `fclose`                       | Drops the stream's descriptor; returns 0, or EOF for a handle that is not open (a second fclose answers EOF, as glibc does). Nothing is buffered, so there is nothing to flush. |
| `sqrt`                         | Argument in `d0`, result in `d0`. Of a negative it is NaN, the IEEE answer rather than an error. |
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

Stepping through one of these costs three steps, and the debugger says
where you are for all three. A `bl printf` lands first on the two words of
the trampoline the linker plants (`ldr x16, =<stub>; br x16`), then on the
stub address itself; none of the three is an instruction you wrote. Through
all three the decode strip drops its bit-field row for a card naming the
call (`printf`, `external call · handled by the runtime`), the editor
holds the marker on your `bl` line in a quieter dashed amber rather than
following the pc somewhere unwritten, and the disassembly stays on the `bl`
row. A `scanf` that runs out of input parks on the stub, and the card says
it is waiting for input in the console; type a line there and the call
finishes on the next step.

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

`ADDS`, `SUBS`, `ADCS`, `SBCS`, `ANDS`, `NEGS`, `CMP`, `CMN`, `CCMP`, `CCMN`, `TST`, and `FCMP` / `FCMPE` update the condition flags. They are visible in the register panel as `N Z C V` and used by `B.cond` / `CSEL` / `CSET` / friends.

## Things that are not implemented

- SIMD vector widths (Q registers and arrangement specifiers)
- FP register-offset addressing (`ldr d0, [x1, x2, lsl #3]`); the integer forms take it
- System registers (`MRS`, `MSR`)
- Atomics (`LDAR`, `STXR`, `LDXR`, `STLR`)
- `SWP`, `CAS`, load-acquire / store-release
- Crypto, SVE, SME

If you hit one of these and need it, see [`CONTRIBUTING.md`](CONTRIBUTING.md) for how to add it.
