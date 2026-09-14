# Instruction reference

Every instruction the playground understands. If it isn't listed here, the assembler will reject it with an `unknown mnemonic` error.

Register operands are `X0`-`X30` (64-bit), `W0`-`W30` (32-bit), `SP`, and `XZR`/`WZR`. Immediates can be written decimal (`#42`), hex (`#0x2a`), or binary (`#0b101010`). The `#` is conventional and optional: `add x0, x1, 8` and `movk x4, 0x10, lsl 16` assemble exactly like their hashed forms, which is why unmodified GCC output, where the hash never appears, works unchanged. Labels end with a colon.

## Data processing

| Mnemonic | Form                             | Notes                                    |
| -------- | -------------------------------- | ---------------------------------------- |
| `MOV`    | `MOV Xd, Xn` / `MOV Xd, #imm` / `MOV Xd, SP` | Register-to-register or wide immediate. `MOV Xd, SP` / `MOV SP, Xn` lower to `ADD ..., #0`. Immediates that fit in one shifted 16-bit field (e.g. `#0x10000000 = #0x1000 LSL #16`) are auto-encoded as MOVZ with the right shift; a repeating bit pattern that fits no shifted field (e.g. `#0x5555555555555555`) lowers to `ORR Xd, XZR, #imm` instead. A negative immediate lowers to `MOVN`, so `mov x0, #-5` and `movn x0, #4` produce the identical word. |
| `MOVZ`   | `MOVZ Xd, #imm, LSL #shift`      | Zero upper bits, shift is 0/16/32/48.    |
| `MOVK`   | `MOVK Xd, #imm, LSL #shift`      | Keep other halfwords.                    |
| `MOVN`   | `MOVN Xd, #imm, LSL #shift`      | Bitwise NOT, same shifts.                |
| `ADD`    | `ADD Xd, Xn, Xm` / `..., #imm` / `ADD Xd, Xn, Xm, LSL #k` / `ADD Xd, Xn, Wm, SXTW #s` | No flags. The plain register form is the shifted-register one: an optional `LSL`/`LSR`/`ASR` amount of 0 to 63 (31 for a W destination) rides the second source, and `add x0, x1, x2` is that form with an amount of zero. The last form is the extended-register one: the index register is widened (`UXTB`/`UXTH`/`UXTW`/`UXTX`/`SXTB`/`SXTH`/`SXTW`/`SXTX`) and then shifted left by 0 to 4. It is the only register form that reaches `SP`. GAS also accepts the bare `add x0, sp, x1` spelling, which is the same extended form with `UXTX #0`. |
| `ADDS`   | same                             | Sets NZCV.                               |
| `SUB`    | `SUB Xd, Xn, Xm` / `..., #imm` / `SUB Xd, Xn, Xm, LSL #k` / `SUB Xd, Xn, Wm, SXTW #s` | No flags. Same shifted- and extended-register forms as `ADD`. |
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
| `AND`    | `AND Xd, Xn, Xm` / `..., #imm` / `AND Xd, Xn, Xm, LSR #k` | Logical AND. |
| `ANDS`   | same                             | Sets NZCV.                               |
| `ORR`    | `ORR Xd, Xn, Xm` / `ORR Xd, Xn, #imm` / `ORR Xd, Xn, Xm, LSL #k` | Logical OR. The immediate is an ARM64 bitmask immediate (a repeating run of ones), not any 12-bit value. |
| `EOR`    | `EOR Xd, Xn, Xm` / `EOR Xd, Xn, #imm` / `EOR Xd, Xn, Xm, LSL #k` | Exclusive OR. The immediate is the same bitmask form `ORR` takes. |
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
| `CMP`    | `CMP Xn, Xm/#imm` / `CMP Xn, Xm, LSL #k` / `CMP Xn, Wm, SXTW` | `SUBS XZR, ...`; sets NZCV. Takes the same shifted- and extended-register second operands `SUBS` does. A negative immediate flips to `CMN` with the positive value, as GAS does (`cmp w1, -1` = `cmn w1, 1`). |
| `CMN`    | `CMN Xn, Xm/#imm` / `CMN Xn, Xm, LSL #k` / `CMN Xn, Wm, SXTW` | `ADDS XZR, ...`. Takes the same shifted- and extended-register second operands `ADDS` does. Negative immediates flip to `CMP` the same way. |
| `TST`    | `TST Xn, Xm/#imm` / `TST Xn, Xm, LSL #k` | `ANDS XZR, ...`. |
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

Condition codes: `EQ`, `NE`, `HS`/`CS`, `LO`/`CC`, `MI`, `PL`, `VS`, `VC`, `HI`, `LS`, `GE`, `LT`, `GT`, `LE`, and `AL`.
`NV` is taken only where GAS takes it, on `ccmp`, `ccmn`, and `fcsel`; GAS refuses `bnv`, so there is no `NV` branch here either.

The five `cset`-family aliases encode the inverse of the condition you write,
which is why none of them accepts `AL` or `NV`.

## Memory

| Mnemonic | Form                                                  | Notes                              |
| -------- | ----------------------------------------------------- | ---------------------------------- |
| `LDR`    | `LDR Xt, [Xn]` / `[Xn, #imm]` / `[Xn, #imm]!` / `[Xn], #imm` / `[Xn, Xm]` | 64-bit load. A `Bt`, `Ht`, `St`, `Dt` or `Qt` target loads 1, 2, 4, 8 or 16 bytes into the SIMD&FP file, in every one of these forms. |
| `STR`    | same                                                  | 64-bit store. The `Bt`/`Ht` FP forms store the register's low byte or halfword. |
| `LDRB`   | same addressing forms                                 | Byte load, zero-extends.           |
| `STRB`   | same                                                  | Byte store.                        |
| `LDRH`   | same                                                  | Halfword load.                     |
| `STRH`   | same                                                  | Halfword store.                    |
| `LDP`    | `LDP Xt1, Xt2, [Xn, #imm]` / `LDP Wt1, Wt2, ...` / `LDP Dt1, Dt2, ...` / `LDP Qt1, Qt2, ...` (+ pre/post index) | Load pair, general or SIMD&FP registers. X and D pairs scale by 8, W and S pairs by 4, Q pairs by 16. |
| `STP`    | same                                                  | Store pair. `stp d8, d9, [sp, -16]!` is the AAPCS64 callee-saved FP prologue. |
| `LDRSB`  | `LDRSB Wt, [Xn, #imm]` / `LDRSB Xt, [Xn, #imm]` / `[Xn, #imm]!` / `[Xn], #imm` | Byte load, sign-extended into Wt or Xt. |
| `LDRSH`  | same addressing forms                                 | Halfword load, sign-extended.      |
| `LDRSW`  | `LDRSW Xt, [Xn, #imm]` / `[Xn, #imm]!` / `[Xn], #imm` | Word load, sign-extended to 64 bits. `Xt` target only, per the ARM spec. |
| `LDUR`   | `LDUR Bt/Ht/St/Dt/Qt, [Xn, #imm]`                     | The unscaled signed-offset load, spelled out. SIMD&FP targets only; `imm` runs [-256, 255] and is never scaled. `LDR` picks this encoding on its own for a negative or unaligned offset. |
| `STUR`   | same                                                  | The unscaled store.                |
| `LDNP`   | `LDNP St1, St2, [Xn, #imm]` / `Dt1, Dt2` / `Qt1, Qt2` | The no-allocate pair load: a plain signed offset, no writeback. Identical here to `LDP`; on hardware it only differs in a cache hint. |
| `STNP`   | same                                                  | The no-allocate pair store.        |

Addressing modes:

- **signed offset**: `[Xn, #imm]`. A negative or unaligned immediate (a struct field like `[fp, 20]` under a 64-bit load, or `[fp, -8]`) has no scaled encoding, so the assembler emits the unscaled (LDUR/STUR) form for it automatically, exactly as GAS does; that form reaches `[-256, 255]`.
- **pre-index**: `[Xn, #imm]!` (writes the new address back into Xn)
- **post-index**: `[Xn], #imm` (uses the base, then updates Xn)
- **register offset**: `[Xn, Xm]` (LSL by access size) or `[Xn, Wm, SXTW #k]`
- **register offset with extend**: `[Xn, Wm, UXTW]`, `[Xn, Xm, LSL #3]`, `[Xn, Xm, SXTX]`, etc.

Unaligned access succeeds (SCTLR.A = 0), as on AArch64 Linux. The sign-extending loads (`LDRSB` / `LDRSH` / `LDRSW`) take every addressing form the plain loads do: the scaled unsigned offset, the unscaled form for a negative or unaligned offset, pre- and post-index writeback, and the register-offset forms. So do the SIMD&FP data moves (`LDR`/`STR` with a `Bt`, `Ht`, `St`, `Dt` or `Qt` target), register offset included, with the same extend keywords and the same "scale by the access width" rule.

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

The register file is 128 bits wide: 32 entries named `V0`-`V31`, or `Q0`-`Q31` when a whole one is moved. `B`, `H`, `S` and `D` are views of the low 8, 16, 32 and 64 bits of the same entry, so `d3` and `q3` are the same register at two widths. Writing a scalar view zeroes every bit above it, exactly as the hardware does: an `S` write clears bits 127:32, a `D` write clears 127:64. Loads and stores reach all five widths; the arithmetic below is scalar `S` and `D` only. The `V` view and its arrangements have their own sections under [Vector moves and immediates](#vector-moves-and-immediates) and [Vector floating point](#vector-floating-point), where most of the mnemonics below gain a lane arrangement.

Every scalar instruction takes both course views: the S form (single precision, a C `float`) and the D form (double precision, a C `double`). Widths never mix inside one instruction; `FCVT` converts between them. Single-precision arithmetic rounds in single precision, exactly like the hardware.

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

## Vector moves and immediates

The `V` view of the register file writes an arrangement after the register name: `v3.16b` is sixteen byte lanes, `v3.8h` eight halfwords, `v3.4s` four words, `v3.2d` two doublewords, and the `8b`/`4h`/`2s`/`1d` forms are the same shapes over the low 64 bits alone, with the upper half zeroed by every write. One lane is `v3.b[15]`, `v3.h[7]`, `v3.s[3]` or `v3.d[1]`.

Only the moves and immediates are here; the lane arithmetic over the same arrangements is in [Vector integer arithmetic](#vector-integer-arithmetic) and [Vector floating point](#vector-floating-point).

A whole-register write zeroes what it does not set, and a 64-bit arrangement clears bits 127:64. A lane write is the exception: `ins`, the `mov` spellings of it, and `fmov v0.d[1], x1` leave every other lane exactly as it was.

| Mnemonic | Form                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| `MOVI`   | `MOVI Vd.T, #imm8{, LSL #amount}` / `MOVI Vd.2S, #imm8, MSL #amount` / `MOVI Vd.2D, #imm64` / `MOVI Dd, #imm64` | Put an immediate in every lane. `imm8` is 0-255; `LSL` takes 0, 8, 16 or 24 for an `S` arrangement and 0 or 8 for an `H` one. `MSL` (8 or 16) shifts ones in below the byte. The `2D` and `Dd` forms take a 64-bit immediate whose every byte is `0x00` or `0xff`, which is what makes `movi d31, #0` the way gcc zeroes a double. |
| `MVNI`   | `MVNI Vd.T, #imm8{, LSL #amount}` / `MVNI Vd.2S, #imm8, MSL #amount` | The same immediate, inverted. There is no byte or 64-bit form. |
| `ORR`    | `ORR Vd.T, #imm8{, LSL #amount}` / `ORR Vd.T, Vn.T, Vm.T` | The vector readings of `ORR`. The immediate form ORs the immediate into the destination and takes the `H` and `S` arrangements; the register form takes `8B` or `16B`. |
| `BIC`    | `BIC Vd.T, #imm8{, LSL #amount}` / `BIC Vd.T, Vn.T, Vm.T` | `Vd = Vd AND NOT imm` and `Vd = Vn AND NOT Vm`, the same shapes as the vector `ORR`. Unlike the general-register `BIC`, this one does have an immediate form. |
| `MOV`    | `MOV Vd.T, Vn.T` / `MOV Vd.Ts[i], Wn` / `MOV Vd.Ts[i], Vn.Ts[j]` / `MOV Wd, Vn.S[i]` / `MOV Bd, Vn.B[i]` | The aliases GAS prints for the four below: register to register is `ORR Vd, Vn, Vn`, into a lane is `INS`, out of a full-width lane is `UMOV`, and into a scalar register is `DUP`. |
| `DUP`    | `DUP Vd.T, Wn` / `DUP Vd.2D, Xn` / `DUP Vd.T, Vn.Ts[i]` / `DUP Bd, Vn.B[i]` | One value into every lane, from a general register or from one lane. The scalar destination (`dup b3, v7.b[15]`, printed `mov`) copies the one lane and zeroes everything above it. |
| `INS`    | `INS Vd.Ts[i], Wn` / `INS Vd.D[i], Xn` / `INS Vd.Ts[i], Vn.Ts[j]` | Write one lane and leave the others alone. The only vector write that does. |
| `UMOV`   | `UMOV Wd, Vn.Ts[i]` (B, H or S) / `UMOV Xd, Vn.D[i]` | One lane out into a general register, zero-extended. At the destination's own width GAS prints it `mov`. |
| `SMOV`   | `SMOV Wd, Vn.Ts[i]` (B or H) / `SMOV Xd, Vn.Ts[i]` (B, H or S) | The same, sign-extended, so the lane has to be narrower than the register. |
| `FMOV`   | `FMOV Vd.D[1], Xn` / `FMOV Xd, Vn.D[1]` | The upper 64-bit lane to or from an x register. The write leaves the low lane in place; it is how a 128-bit value is assembled half at a time. |

## Vector integer arithmetic

Five encoding classes cover the integer lane families, and every form here is one of them: three-same (`Vd.T, Vn.T, Vm.T`, all three the same shape), two-register misc (`Vd.T, Vn.T`, plus the compares against `#0`), across lanes (a whole vector folded into one scalar), three-different (the widening and narrowing forms, whose operands are not all one width), and shift by immediate. Most also have a SIMD-scalar form, which runs the same operation on a single `B`, `H`, `S` or `D` register; where a family has one the table says so.

Lane arithmetic wraps at the lane's own width unless the mnemonic says otherwise: the `SQ`/`UQ` prefixes saturate, the `H`/`RH` infixes compute in one extra bit, and the doubling multiplies keep the high half of a double-width product. A 64-bit arrangement (`8B`, `4H`, `2S`) zeroes bits 127:64 of its destination, exactly as the moves do.

| Mnemonic | Form                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| `ADD`    | `ADD Vd.T, Vn.T, Vm.T` / `ADD Dd, Dn, Dm` | Lane by lane, wrapping. `T` is `8B`, `16B`, `4H`, `8H`, `2S`, `4S` or `2D`; a single 64-bit lane is spelled with `D` registers, not `1D`. |
| `SUB`    | the same shapes                   | Lane by lane, wrapping.                 |
| `MUL`    | `MUL Vd.T, Vn.T, Vm.T` (`B`, `H`, `S` lanes) | Low half of the product, wrapping. No `D` lanes and no scalar form. |
| `MLA`    | `MLA Vd.T, Vn.T, Vm.T`            | `Vd = Vd + Vn * Vm`: the destination is read as well as written. |
| `MLS`    | the same shapes                   | `Vd = Vd - Vn * Vm`.                    |
| `PMUL`   | `PMUL Vd.T, Vn.T, Vm.T` (`8B` / `16B`) | Carry-less (polynomial) multiply of bytes: the partial products are XORed, not added, so there is no carry between bit positions. |
| `AND`    | `AND Vd.T, Vn.T, Vm.T` (`8B` / `16B`) | Bit by bit over 8 or 16 bytes. The size field picks the operation for the whole bitwise group, so `8B` and `16B` are the only arrangements any of them takes. |
| `ORR`    | `ORR Vd.T, Vn.T, Vm.T`            | See also the immediate form under [Vector moves and immediates](#vector-moves-and-immediates). |
| `ORN`    | `ORN Vd.T, Vn.T, Vm.T`            | `Vd = Vn OR NOT Vm`.                    |
| `EOR`    | `EOR Vd.T, Vn.T, Vm.T`            | Exclusive or.                           |
| `BIC`    | `BIC Vd.T, Vn.T, Vm.T`            | `Vd = Vn AND NOT Vm`.                   |
| `BSL`    | `BSL Vd.T, Vn.T, Vm.T`            | Bitwise select, and the DESTINATION is the mask: each bit takes `Vn` where `Vd` holds 1 and `Vm` where it holds 0. |
| `BIT`    | `BIT Vd.T, Vn.T, Vm.T`            | Insert if true: the destination keeps its bit where `Vm` is 0 and takes `Vn`'s where `Vm` is 1. |
| `BIF`    | `BIF Vd.T, Vn.T, Vm.T`            | Insert if false: the same with the mask inverted. |
| `MVN`    | `MVN Vd.T, Vn.T` (`8B` / `16B`)   | Bitwise complement.                     |
| `NOT`    | `NOT Vd.T, Vn.T` (`8B` / `16B`)   | The same word as `MVN`; objdump prints it back as `MVN`. |

The compares write all-ones in a lane where the test holds and all-zeros where it does not, so the result feeds straight into a `BSL` mask or a `BIC`.

| Mnemonic | Form                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| `CMEQ`   | `CMEQ Vd.T, Vn.T, Vm.T` / `CMEQ Vd.T, Vn.T, #0` / `CMEQ Dd, Dn, Dm` / `CMEQ Dd, Dn, #0` | Equal. Every compare here takes the `2D` arrangement and the `D` scalar as well as the narrower lanes. |
| `CMGT`   | the same four shapes              | SIGNED greater than.                    |
| `CMGE`   | the same four shapes              | SIGNED greater or equal.                |
| `CMHI`   | register form only (`Vm` or `Dm`) | UNSIGNED greater than. The `S`/`U` pair to watch: `CMGT` and `CMHI` differ only in how the lane is read. |
| `CMHS`   | register form only                | UNSIGNED greater or equal.              |
| `CMLE`   | `#0` form only                    | Signed, against zero. There is no register form: swap the operands and use `CMGE`. |
| `CMLT`   | `#0` form only                    | Signed, against zero; swap and use `CMGT`. |
| `CMTST`  | `CMTST Vd.T, Vn.T, Vm.T` / `CMTST Dd, Dn, Dm` | Not a magnitude test at all: the lane holds ones when `Vn AND Vm` is non-zero. |

Saturating and halving. Saturation clamps at the lane's own limits rather than wrapping, and every halving form computes the sum or difference in one extra bit before shifting, so the carry out is never lost.

| Mnemonic | Form                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| `SQADD`  | `SQADD Vd.T, Vn.T, Vm.T` / `SQADD Bd, Bn, Bm` (and `H`, `S`, `D`) | Signed saturating add: clamps to the lane's signed range. |
| `UQADD`  | the same shapes                   | Unsigned saturating add.                |
| `SQSUB`  | the same shapes                   | Signed saturating subtract.             |
| `UQSUB`  | the same shapes                   | Unsigned saturating subtract; a negative result clamps to zero. |
| `SUQADD` | `SUQADD Vd.T, Vn.T` / `SUQADD Bd, Bn` (and `H`, `S`, `D`) | Accumulate an UNSIGNED source into a SIGNED destination and saturate as signed. Two operands, three inputs: the destination is read. |
| `USQADD` | the same shapes                   | The other way round: a signed source into an unsigned destination, saturating as unsigned, so a negative source clamps at zero. |
| `SQABS`  | `SQABS Vd.T, Vn.T` / `SQABS Bd, Bn` (and `H`, `S`, `D`) | Saturating absolute value: `sqabs` of the minimum lane value gives the maximum (`-128` becomes `127`), where plain `ABS` wraps back to `-128`. |
| `SQNEG`  | the same shapes                   | Saturating negate, with the same edge.  |
| `SHADD`  | `SHADD Vd.T, Vn.T, Vm.T` (`B`, `H`, `S` lanes) | Signed halving add: `(Vn + Vm) >> 1` computed at `esize + 1` bits. |
| `UHADD`  | the same shapes                   | Unsigned halving add.                   |
| `SRHADD` | the same shapes                   | Rounding halving add: 1 is added before the shift. |
| `URHADD` | the same shapes                   | The unsigned rounding halving add.      |
| `SHSUB`  | the same shapes                   | Signed halving subtract, the same extra bit. |
| `UHSUB`  | the same shapes                   | Unsigned halving subtract.              |
| `SQDMULH` | `SQDMULH Vd.T, Vn.T, Vm.T` (`H`, `S` lanes) / `SQDMULH Hd, Hn, Hm` / `SQDMULH Sd, Sn, Sm` | Saturating doubling multiply, high half: `(2 * Vn * Vm) >> esize`. The one input pair that saturates is the two minimum values, where `0x8000 * 0x8000` doubled lands one past the top and gives `0x7fff`. |
| `SQRDMULH` | the same shapes                 | The rounding form: half an ulp is added before the shift. |

Max, min, absolute differences, and the reductions. A pairwise form reads `Vn`'s lanes and then `Vm`'s as one long vector and folds neighbours two at a time, so the low half of the result comes from `Vn` and the high half from `Vm`.

| Mnemonic | Form                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| `SMAX`   | `SMAX Vd.T, Vn.T, Vm.T` (`B`, `H`, `S` lanes) | Signed larger of each lane pair.        |
| `SMIN`   | the same shapes                   | Signed smaller.                         |
| `UMAX`   | the same shapes                   | Unsigned larger.                        |
| `UMIN`   | the same shapes                   | Unsigned smaller.                       |
| `SMAXP`  | the same shapes                   | The pairwise `SMAX`.                    |
| `SMINP`  | the same shapes                   | The pairwise `SMIN`.                    |
| `UMAXP`  | the same shapes                   | The pairwise `UMAX`.                    |
| `UMINP`  | the same shapes                   | The pairwise `UMIN`.                    |
| `SABD`   | the same shapes                   | Absolute difference, both lanes read as signed. |
| `UABD`   | the same shapes                   | Absolute difference, both read as unsigned. |
| `SABA`   | the same shapes                   | The signed absolute difference ACCUMULATED into the destination. |
| `UABA`   | the same shapes                   | The unsigned one, accumulated.          |
| `ADDP`   | `ADDP Vd.T, Vn.T, Vm.T` / `ADDP Dd, Vn.2D` | The pairwise add. The scalar form folds the two `D` lanes of one register into a `D` register. |
| `ADDV`   | `ADDV Bd, Vn.8B` / `ADDV Bd, Vn.16B` / `ADDV Hd, Vn.4H` / `ADDV Hd, Vn.8H` / `ADDV Sd, Vn.4S` | Sum of every lane, truncated to the lane's own width. `2S` is not accepted: the widest lane only comes in the 128-bit arrangement. |
| `SADDLV` | `SADDLV Hd, Vn.8B` / `SADDLV Sd, Vn.4H` / `SADDLV Dd, Vn.4S` (and the `16B`/`8H` forms) | Widen each lane to twice its width, THEN sum, so the total cannot overflow the source lane. The destination is the wider register. |
| `UADDLV` | the same shapes                   | The unsigned widening sum.              |
| `SMAXV`  | `SMAXV Bd, Vn.8B` (and the `16B`, `4H`, `8H`, `4S` forms) | Largest signed lane of the whole vector. |
| `SMINV`  | the same shapes                   | Smallest signed lane.                   |
| `UMAXV`  | the same shapes                   | Largest unsigned lane.                  |
| `UMINV`  | the same shapes                   | Smallest unsigned lane.                 |
| `SADDLP` | `SADDLP Vd.4H, Vn.8B` / `Vd.8H, Vn.16B` / `Vd.2S, Vn.4H` / `Vd.4S, Vn.8H` / `Vd.1D, Vn.2S` / `Vd.2D, Vn.4S` | Pairwise widening add: each pair of source lanes becomes one destination lane of twice the width, signed. |
| `UADDLP` | the same shapes                   | The unsigned pairwise widening add.     |
| `SADALP` | the same shapes                   | The same sum ACCUMULATED into what the destination already holds. |
| `UADALP` | the same shapes                   | The unsigned accumulating form.         |

The remaining two-register misc forms take one source and one destination of the same shape.

| Mnemonic | Form                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| `ABS`    | `ABS Vd.T, Vn.T` / `ABS Dd, Dn`   | Absolute value, WRAPPING at the lane's width: the minimum value is its own absolute value. `SQABS` is the saturating twin. |
| `NEG`    | `NEG Vd.T, Vn.T` / `NEG Dd, Dn`   | Negate, wrapping the same way; `SQNEG` saturates. |
| `CLZ`    | `CLZ Vd.T, Vn.T` (`B`, `H`, `S` lanes) | Leading zeros per lane; a zero lane answers the lane's width. |
| `CLS`    | the same shapes                   | Leading SIGN bits, the sign bit itself excluded, so a lane of all zeros or all ones answers `esize - 1`. |
| `CNT`    | `CNT Vd.T, Vn.T` (`8B` / `16B`)   | Population count, per BYTE.             |
| `RBIT`   | `RBIT Vd.T, Vn.T` (`8B` / `16B`)  | Bits reversed within each BYTE, not across the register. It is spelled in byte lanes but encodes size `01`, which is the one place the size field is not the lane width. |
| `REV16`  | `REV16 Vd.T, Vn.T` (`8B` / `16B`) | Reverse the ORDER of the lanes inside each 16-bit container; the lanes themselves are untouched. |
| `REV32`  | `REV32 Vd.T, Vn.T` (`B` and `H` lanes) | The same inside each 32-bit container.  |
| `REV64`  | `REV64 Vd.T, Vn.T` (`B`, `H`, `S` lanes) | The same inside each 64-bit container. The lane has to be narrower than the container, which is why each of the three takes a different set. |
| `URECPE` | `URECPE Vd.T, Vn.T` (`2S` / `4S`) | The unsigned fixed-point reciprocal ESTIMATE, read out of the architecture's table rather than computed. An operand below 0.5 (top bit clear) has no representable reciprocal and answers all ones. |
| `URSQRTE` | `URSQRTE Vd.T, Vn.T` (`2S` / `4S`) | The reciprocal square-root estimate from the same kind of table, with the cut at 0.25 (top two bits clear). |

Widening, narrowing and doubling: the three-different class, where the two sources and the destination are not all the same width. The size the encoding carries is always the NARROW one. The `2` suffix is the Q bit and nothing else: it reads the narrow operands out of the UPPER half of their register (lanes 8-15 of a `16B`, 4-7 of an `8H`, 2-3 of a `4S`) and, on the narrowing rows, writes the upper half of the destination while leaving the low half exactly as it was. Without it the narrow operands come from the low half, and a narrowing result zeroes bits 127:64.

| Mnemonic | Form                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| `SADDL`  | `SADDL Vd.8H, Vn.8B, Vm.8B` (and `4S`/`4H`, `2D`/`2S`) | Sign-extend both lanes to twice their width, THEN add, so the sum cannot overflow the destination. |
| `SADDL2` | `SADDL2 Vd.8H, Vn.16B, Vm.16B` (and `4S`/`8H`, `2D`/`4S`) | The same over the upper half of the sources. Every `2` form in this table is its base form reading those lanes instead of the low ones. |
| `UADDL`  | the same shapes                   | Zero-extend instead: the `S`/`U` pair differ in nothing else. |
| `UADDL2` | the same shapes                   | The unsigned upper-half form.           |
| `SSUBL`  | the same shapes                   | Extend, then subtract.                  |
| `SSUBL2` | the same shapes                   | The upper-half form.                    |
| `USUBL`  | the same shapes                   | The unsigned widening subtract.         |
| `USUBL2` | the same shapes                   | The unsigned upper-half form.           |
| `SADDW`  | `SADDW Vd.8H, Vn.8H, Vm.8B` (and `4S`/`4S`/`4H`, `2D`/`2D`/`2S`) | Only the SECOND source is narrow: it is extended and added to a first source already at the destination's width. |
| `SADDW2` | `SADDW2 Vd.8H, Vn.8H, Vm.16B`     | The upper half of the narrow source.    |
| `UADDW`  | the same shapes                   | Zero-extending.                         |
| `UADDW2` | the same shapes                   | The unsigned upper-half form.           |
| `SSUBW`  | the same shapes                   | Extend the narrow source, then subtract it. |
| `SSUBW2` | the same shapes                   | The upper-half form.                    |
| `USUBW`  | the same shapes                   | The unsigned widening subtract.         |
| `USUBW2` | the same shapes                   | The unsigned upper-half form.           |
| `SMULL2` | `SMULL2 Vd.8H, Vn.16B, Vm.16B` (and `4S`/`8H`, `2D`/`4S`) | The widening product over the upper half. Plain `SMULL` is the same mnemonic as the general-register widening multiply in [Data processing](#data-processing); a `V` first operand is what picks this reading. |
| `UMULL2` | the same shapes                   | The unsigned one; plain `UMULL` shares its arm the same way. |
| `SMLAL`  | `SMLAL Vd.8H, Vn.8B, Vm.8B` (and `4S`/`4H`, `2D`/`2S`) | The widening product ACCUMULATED: the destination is read as well as written. |
| `SMLAL2` | `SMLAL2 Vd.8H, Vn.16B, Vm.16B`    | The upper-half form.                    |
| `UMLAL`  | the same shapes                   | The unsigned accumulating product.      |
| `UMLAL2` | the same shapes                   | The unsigned upper-half form.           |
| `SMLSL`  | the same shapes                   | The widening product SUBTRACTED from the destination. |
| `SMLSL2` | the same shapes                   | The upper-half form.                    |
| `UMLSL`  | the same shapes                   | The unsigned subtracting form.          |
| `UMLSL2` | the same shapes                   | The unsigned upper-half form.           |
| `SABDL`  | the same shapes                   | Widening absolute difference: extend both lanes, subtract, take the magnitude, so nothing wraps the way the same-width `SABD` can. |
| `SABDL2` | the same shapes                   | The upper-half form.                    |
| `UABDL`  | the same shapes                   | Both lanes read unsigned.               |
| `UABDL2` | the same shapes                   | The unsigned upper-half form.           |
| `SABAL`  | the same shapes                   | The same difference accumulated into the destination. |
| `SABAL2` | the same shapes                   | The upper-half form.                    |
| `UABAL`  | the same shapes                   | The unsigned accumulating difference.   |
| `UABAL2` | the same shapes                   | The unsigned upper-half form.           |
| `ADDHN`  | `ADDHN Vd.8B, Vn.8H, Vm.8H` (and `4H`/`4S`, `2S`/`2D`) | Add at the SOURCE width and keep the HIGH half of each sum; the low half is discarded. The result zeroes bits 127:64. |
| `ADDHN2` | `ADDHN2 Vd.16B, Vn.8H, Vm.8H`     | The same sums written into the UPPER half of the destination, the low half untouched. |
| `RADDHN` | the same shapes                   | Rounding: half an ulp of the kept half (bit `esize - 1` of the sum) is added before the top half is taken. |
| `RADDHN2` | the same shapes                  | The rounding upper-half form.           |
| `SUBHN`  | the same shapes                   | The difference's high half.             |
| `SUBHN2` | the same shapes                   | The upper-half form.                    |
| `RSUBHN` | the same shapes                   | The rounding difference.                |
| `RSUBHN2` | the same shapes                  | The rounding upper-half form.           |
| `SQDMULL` | `SQDMULL Vd.4S, Vn.4H, Vm.4H` / `Vd.2D, Vn.2S, Vm.2S` / `SQDMULL Sd, Hn, Hm` / `SQDMULL Dd, Sn, Sm` | Doubled widening product, saturating. `H` and `S` lanes only. The one input pair that saturates is the two minimum values: `0x8000 * 0x8000` doubled lands one past the top of a word. |
| `SQDMULL2` | `SQDMULL2 Vd.4S, Vn.8H, Vm.8H` / `Vd.2D, Vn.4S, Vm.4S` | The upper-half form; no scalar spelling, since a scalar has no halves. |
| `SQDMLAL` | the same shapes as `SQDMULL`     | The doubled product accumulated. It saturates TWICE, once on the product and once on the sum, so a product already at the limit cannot wrap on the way in. |
| `SQDMLAL2` | the upper-half shapes            | The upper-half accumulating form.       |
| `SQDMLSL` | the same shapes as `SQDMULL`     | The doubled product subtracted, saturating at both steps. |
| `SQDMLSL2` | the upper-half shapes            | The upper-half subtracting form.        |
| `PMULL`  | `PMULL Vd.8H, Vn.8B, Vm.8B`       | Carry-less (polynomial) widening multiply of bytes: the partial products are XORed rather than added, so nothing carries between bit positions and the whole product fits the halfword. Byte lanes only. |
| `PMULL2` | `PMULL2 Vd.8H, Vn.16B, Vm.16B`    | The same over the upper eight bytes.    |

The narrowing extracts and the lengthening shift are two-register misc rows with the same `2` rule: `XTN` writes the low half of the destination and zeroes the rest, `XTN2` writes the high half and leaves the low one alone.

| Mnemonic | Form                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| `XTN`    | `XTN Vd.8B, Vn.8H` (and `4H`/`4S`, `2S`/`2D`) | Truncate each lane to half its width; whatever does not fit is discarded. |
| `XTN2`   | `XTN2 Vd.16B, Vn.8H`              | The same results in the UPPER half of the destination. |
| `SQXTN`  | `SQXTN Vd.8B, Vn.8H` / `SQXTN Bd, Hn` (and `H`/`S`, `S`/`D`) | Signed saturating narrow: a lane past the narrow signed range clamps to it instead of losing its top bits. |
| `SQXTN2` | `SQXTN2 Vd.16B, Vn.8H`            | The upper-half form. No `2` form has a scalar spelling. |
| `UQXTN`  | the same shapes                   | Unsigned saturating narrow.             |
| `UQXTN2` | the same shapes                   | The unsigned upper-half form.           |
| `SQXTUN` | the same shapes                   | The mixed one: the source is read SIGNED and saturated into an UNSIGNED lane, so a negative source clamps at zero and a large positive one at all ones. |
| `SQXTUN2` | the same shapes                  | The mixed upper-half form.              |
| `SHLL`   | `SHLL Vd.8H, Vn.8B, #8` / `Vd.4S, Vn.4H, #16` / `Vd.2D, Vn.2S, #32` | Shift each lane left by exactly its own width into a lane of twice that, so the source lands in the top half of the result with zeros below it. The amount is not a choice: it has to be the source lane's width. |
| `SHLL2`  | `SHLL2 Vd.8H, Vn.16B, #8` (and `4S`/`8H`, `2D`/`4S`) | The same over the upper half of the source. |

Shift by immediate. The amount is not an operand field of its own: it is packed into `immh:immb` beside the lane width, a left shift counting UP from the width and a right shift counting DOWN from twice it. That is why a left shift takes `#0` to `#esize - 1` and a right shift `#1` to `#esize`, and why `SSHR Vd.16B, Vn.16B, #8` and `USHR Vd.2D, Vn.2D, #64` are both legal. A 64-bit lane is spelled with `D` registers, not `1D`, exactly as in the three-same group.

| Mnemonic | Form                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| `SHL`    | `SHL Vd.T, Vn.T, #shift` / `SHL Dd, Dn, #shift` | Shift left, discarding what leaves the lane. `#0` is a real encoding, not an error. |
| `SSHR`   | `SSHR Vd.T, Vn.T, #shift` / `SSHR Dd, Dn, #shift` | Arithmetic (sign-filling) shift right; at `#esize` every lane is all zeros or all ones. |
| `USHR`   | the same shapes                   | Logical shift right; at `#esize` the lane is zero. |
| `SSRA`   | the same shapes                   | The signed shift ACCUMULATED: `Vd = Vd + (Vn >> shift)`, wrapping at the lane. |
| `USRA`   | the same shapes                   | The unsigned shift, accumulated.        |
| `SRSHR`  | the same shapes                   | Rounding signed shift: `1 << (shift - 1)` is added before the shift. |
| `URSHR`  | the same shapes                   | The unsigned rounding shift.            |
| `SRSRA`  | the same shapes                   | The rounding signed shift, accumulated. |
| `URSRA`  | the same shapes                   | The rounding unsigned shift, accumulated. |
| `SLI`    | `SLI Vd.T, Vn.T, #shift` / `SLI Dd, Dn, #shift` | Shift left and INSERT: the destination's low `shift` bits survive instead of being shifted in as zeros. |
| `SRI`    | the same shapes                   | Shift right and insert: the destination's high `shift` bits survive. It is a right shift, so `#1` to `#esize`. |
| `SQSHL`  | `SQSHL Vd.T, Vn.T, #shift` / `SQSHL Bd, Bn, #shift` (and `H`, `S`, `D`) | Signed saturating shift left: what would leave the lane clamps to the lane's limit instead. See also the register form below, which shares the mnemonic. |
| `UQSHL`  | the same shapes                   | Unsigned saturating shift left.         |
| `SQSHLU` | the same shapes                   | The mixed one: the lane is read SIGNED and saturated into an UNSIGNED result, so a negative lane answers zero. |
| `SSHLL`  | `SSHLL Vd.8H, Vn.8B, #shift` (and `4S`/`4H`, `2D`/`2S`) | Sign-extend to twice the width, THEN shift left, so nothing can leave the result lane. The amount is `#0` to `#esize - 1` of the SOURCE lane. |
| `SSHLL2` | `SSHLL2 Vd.8H, Vn.16B, #shift`    | The same over the upper half of the source. |
| `USHLL`  | the same shapes                   | Zero-extending.                         |
| `USHLL2` | the same shapes                   | The unsigned upper-half form.           |
| `SXTL`   | `SXTL Vd.8H, Vn.8B` (and `4S`/`4H`, `2D`/`2S`) | The alias for `SSHLL ..., #0`: the same word, and the spelling objdump prints back for it. Sign-extend, no shift. |
| `SXTL2`  | `SXTL2 Vd.8H, Vn.16B`             | The upper-half form, alias of `SSHLL2 ..., #0`. |
| `UXTL`   | the same shapes                   | The zero-extending alias of `USHLL ..., #0`. |
| `UXTL2`  | the same shapes                   | The upper-half zero-extending alias.    |
| `SHRN`   | `SHRN Vd.8B, Vn.8H, #shift` (and `4H`/`4S`, `2S`/`2D`) | Shift each source lane right, then truncate into a lane of half the width. `#1` to `#esize` of the DESTINATION lane. |
| `SHRN2`  | `SHRN2 Vd.16B, Vn.8H, #shift`     | The results in the UPPER half of the destination, the low half untouched. |
| `RSHRN`  | the same shapes                   | Rounding: half an ulp is added before the shift. |
| `RSHRN2` | the same shapes                   | The rounding upper-half form.           |
| `SQSHRN` | `SQSHRN Vd.8B, Vn.8H, #shift` / `SQSHRN Bd, Hn, #shift` | Signed saturating narrowing shift: the shift happens at the source width and the clamp at the destination's. |
| `SQSHRN2` | `SQSHRN2 Vd.16B, Vn.8H, #shift`  | The upper-half form; no `2` form has a scalar spelling. |
| `UQSHRN` | the same shapes                   | Unsigned saturating narrowing shift.    |
| `UQSHRN2` | the same shapes                  | The unsigned upper-half form.           |
| `SQRSHRN` | the same shapes                  | The signed rounding one: half an ulp before the shift, then the clamp. |
| `SQRSHRN2` | the same shapes                 | The rounding upper-half form.           |
| `UQRSHRN` | the same shapes                  | The unsigned rounding narrowing shift.  |
| `UQRSHRN2` | the same shapes                 | The unsigned rounding upper-half form.  |
| `SQSHRUN` | the same shapes                  | Signed source, UNSIGNED saturating result: a negative source clamps at zero. |
| `SQSHRUN2` | the same shapes                 | The upper-half form.                    |
| `SQRSHRUN` | the same shapes                 | The rounding mixed form.                |
| `SQRSHRUN2` | the same shapes                | The rounding mixed upper-half form.     |

Shift by register. The count comes from the LOW BYTE of each `Vm` lane, read as a signed 8-bit number: positive shifts that lane left, negative shifts it right by the magnitude. The rest of the `Vm` lane is ignored, and each lane can shift by a different amount. Only the LEFT direction can saturate.

| Mnemonic | Form                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| `SSHL`   | `SSHL Vd.T, Vn.T, Vm.T` / `SSHL Dd, Dn, Dm` | Signed shift by the per-lane count; a right shift fills with the sign bit. |
| `USHL`   | the same shapes                   | Unsigned: a right shift fills with zeros. |
| `SRSHL`  | the same shapes                   | Rounding: on a right shift, half an ulp of the discarded bits is added first. |
| `URSHL`  | the same shapes                   | The unsigned rounding form.             |
| `SQRSHL` | `SQRSHL Vd.T, Vn.T, Vm.T` / `SQRSHL Bd, Bn, Bm` (and `H`, `S`, `D`) | Signed saturating rounding shift. `SQSHL` and `UQSHL` take this same register form, listed with their immediate rows above. |
| `UQRSHL` | the same shapes                   | The unsigned saturating rounding shift. |

Permutes and table lookups. These move lanes rather than compute on them: nothing here saturates or wraps, and the lane width only says how big the pieces being moved are.

| Mnemonic | Form                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| `EXT`    | `EXT Vd.16B, Vn.16B, Vm.16B, #index` (and `8B`) | `Vn` and `Vm` laid end to end, read from byte `#index` on for as many bytes as the arrangement holds. The `8B` form concatenates the two LOW halves, so its index stops at 7; the `16B` form's at 15. |
| `TBL`    | `TBL Vd.16B, {Vn.16B}, Vm.16B` (and `8B`, and tables of 2, 3 or 4 registers) | Each byte of `Vm` indexes a byte table made of consecutive registers from `Vn` on. The table is always spelled `16B` whatever the destination is, the list wraps past `v31` (`{v30.16b-v1.16b}`), and an index at or past `16 x n` gives ZERO. |
| `TBX`    | the same shapes                   | The same lookup, except an out-of-range index LEAVES the destination byte alone instead of zeroing it. That is the whole difference between the two. |
| `ZIP1`   | `ZIP1 Vd.T, Vn.T, Vm.T` (`8B`/`16B`, `4H`/`8H`, `2S`/`4S`, `2D`) | Interleave the LOW halves of the two sources, `Vn` lane first. |
| `ZIP2`   | the same shapes                   | The same over the UPPER halves.         |
| `UZP1`   | the same shapes                   | Every EVEN lane of `Vn` then `Vm`, laid end to end: the de-interleave `ZIP1` undoes. |
| `UZP2`   | the same shapes                   | Every ODD lane of the two.              |
| `TRN1`   | the same shapes                   | The even lanes of both, alternating: `Vd[2i] = Vn[2i]`, `Vd[2i+1] = Vm[2i]`. |
| `TRN2`   | the same shapes                   | The odd lanes of both, the other half of a 2x2 transpose. |

By element. Every multiply and multiply-accumulate above also takes ONE lane of `Vm` in place of the whole second source, written `Vm.H[index]` or `Vm.S[index]`. The lane arithmetic is exactly the whole-register row's; only where the second operand comes from changes. An `H` element reads `v0`-`v15` only, because the encoding spends the register's high bit on the index.

| Mnemonic | Form                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| `MUL`    | `MUL Vd.4H, Vn.4H, Vm.H[index]` (and `8H`, `2S`/`4S` with `Vm.S[index]`) | The three-same product with one lane broadcast; wraps in the lane like the register form. |
| `MLA`    | the same shapes                   | Accumulate the product into `Vd`.       |
| `MLS`    | the same shapes                   | Subtract the product from `Vd`.         |
| `SMULL`  | `SMULL Vd.4S, Vn.4H, Vm.H[index]` (and `2D`/`2S` with `Vm.S[index]`) | Signed widening product into lanes of twice the source width. |
| `SMULL2` | `SMULL2 Vd.4S, Vn.8H, Vm.H[index]` | The same reading the UPPER half of `Vn`; the `2` is the Q bit and nothing else. |
| `UMULL`  | the same shapes as `SMULL`        | The unsigned pair: the operands are zero-extended instead of sign-extended. |
| `UMULL2` | the same shapes as `SMULL2`       | The unsigned upper-half form.           |
| `SMLAL`  | the same shapes as `SMULL`        | Accumulate the widened product into `Vd`. |
| `SMLAL2` | the same shapes as `SMULL2`       | The upper-half form.                    |
| `UMLAL`  | the same shapes                   | The unsigned accumulate.                |
| `UMLAL2` | the same shapes                   | The unsigned upper-half accumulate.     |
| `SMLSL`  | the same shapes                   | Subtract the widened product from `Vd`. |
| `SMLSL2` | the same shapes                   | The upper-half form.                    |
| `UMLSL`  | the same shapes                   | The unsigned subtract.                  |
| `UMLSL2` | the same shapes                   | The unsigned upper-half subtract.       |
| `SQDMULL` | `SQDMULL Vd.4S, Vn.4H, Vm.H[index]` / `SQDMULL Sd, Hn, Vm.H[index]` (and `2D`/`2S`, `Dd, Sn`) | Doubled signed widening product, saturated at the wide lane. Only the two minimum values saturate: `-32768 x -32768 x 2` is one past `0x7fffffff`. |
| `SQDMULL2` | `SQDMULL2 Vd.4S, Vn.8H, Vm.H[index]` | The upper-half form; no `2` form has a scalar spelling. |
| `SQDMLAL` | the same shapes as `SQDMULL`     | The doubled product saturated, then the sum with `Vd` saturated again, so a product already at the limit cannot wrap on the way in. |
| `SQDMLAL2` | the same shapes as `SQDMULL2`   | The upper-half form.                    |
| `SQDMLSL` | the same shapes as `SQDMULL`     | The saturating doubling subtract.       |
| `SQDMLSL2` | the same shapes as `SQDMULL2`   | The upper-half form.                    |
| `SQDMULH` | `SQDMULH Vd.4H, Vn.4H, Vm.H[index]` / `SQDMULH Hd, Hn, Vm.H[index]` (and `2S`/`4S`, `Sd, Sn`) | The doubled product's HIGH half, saturating only at the two minimum values. |
| `SQRDMULH` | the same shapes                 | The rounding one: half an ulp of the kept half is added before the high half is taken. |

## Vector floating point

The float lanes are `2S`, `4S` and `2D`: four bytes or eight, never one or two. There is no `1D` arrangement (a single 64-bit lane is the SIMD-scalar form, written `d3`), and no half-precision arithmetic at all, because that is `FEAT_FP16`; the only place `4H` and `8H` appear is `FCVTN` and `FCVTL`, which convert to and from IEEE binary16 and are base ARMv8.

Most of these mnemonics also name a scalar FP instruction, and only the operands say which reading a line is: `fadd s3, s7, s21` is the scalar class and `fadd v3.2s, v7.2s, v21.2s` this one. `FADD`, `FSUB`, `FMUL`, `FDIV`, `FMAX`, `FMIN`, `FMAXNM`, `FMINNM`, `FABS`, `FNEG`, `FSQRT`, `FMOV`, `SCVTF`, `UCVTF` and every `FCVT` rounding mode are listed under [Floating point](#floating-point) and gain a vector arrangement here. Where a family has a SIMD-scalar form of its own (`fmulx s3, s7, s21`, `fcvtzs s3, s7`) the table says so.

Every rule below is per lane. A NaN that arrives in an operand comes back out of that lane with its sign and payload intact, quieted if it was signalling; a NaN the operation itself makes is the positive default NaN (`0x7FC00000` for `S`, `0x7FF8000000000000` for `D`). The compares write a lane of all ones or all zeros, and every one of them is false against a NaN. A 64-bit arrangement zeroes bits 127:64 of its destination.

| Mnemonic  | Form                             | Notes                                   |
| --------- | -------------------------------- | --------------------------------------- |
| `FMLA`    | `FMLA Vd.T, Vn.T, Vm.T` / `FMLA Vd.T, Vn.T, Vm.Ts[i]` / `FMLA Sd, Sn, Vm.S[i]` | Fused multiply-add into the destination: `Vd = Vd + Vn * Vm`, one rounding over the whole thing. The destination lane is an operand, so it is also the first NaN the lane can propagate. |
| `FMLS`    | the same shapes                  | `Vd = Vd - Vn * Vm`. The pseudocode negates `Vn`'s lane before the fused multiply-add, never the result, so a NaN arriving in `Vn` comes back with its sign flipped. |
| `FMULX`   | `FMULX Vd.T, Vn.T, Vm.T` / `FMULX Sd, Sn, Sm` / by element | The product, except that an infinity against a zero answers exactly `2.0` with the sign of the product, where `FMUL` answers with the default NaN. |
| `FABD`    | `FABD Vd.T, Vn.T, Vm.T` / `FABD Sd, Sn, Sm` | `\|Vn - Vm\|`. The absolute value is a bit clear applied after the subtract, so it strips the sign off a propagated NaN too. |
| `FRECPS`  | `FRECPS Vd.T, Vn.T, Vm.T` / `FRECPS Sd, Sn, Sm` | The Newton-Raphson step for a reciprocal: `2.0 - Vn * Vm`, fused. An infinity against a zero gives exactly `2.0`. `Vn` is negated before the NaN rule looks at it. |
| `FRSQRTS` | the same shapes                  | The step for a reciprocal square root: `(3.0 - Vn * Vm) / 2`. An infinity against a zero gives `1.5`. |
| `FADDP`   | `FADDP Vd.T, Vn.T, Vm.T` / `FADDP Sd, Vn.2S` / `FADDP Dd, Vn.2D` | Pairwise: `Vn`'s lanes then `Vm`'s, folded two at a time, so the low half of the destination comes from `Vn`. The two-operand form folds the pair it has into one scalar. |
| `FMAXP`   | the same shapes                  | The pairwise maximum, with `FMAX`'s NaN rule. |
| `FMINP`   | the same shapes                  | The pairwise minimum.                   |
| `FMAXNMP` | the same shapes                  | The pairwise `FMAXNM`.                  |
| `FMINNMP` | the same shapes                  | The pairwise `FMINNM`.                  |
| `FMAXV`   | `FMAXV Sd, Vn.4S`                | The whole vector folded to one scalar. Only the `4S` arrangement exists: folding two lanes is what the pairwise forms are for. The fold is a tree (halves, then their answers), which is what decides WHICH NaN comes out when there is more than one. |
| `FMINV`   | `FMINV Sd, Vn.4S`                | The minimum fold.                       |
| `FMAXNMV` | `FMAXNMV Sd, Vn.4S`              | The fold that ignores quiet NaNs.       |
| `FMINNMV` | `FMINNMV Sd, Vn.4S`              | The same for the minimum.               |
| `FCMEQ`   | `FCMEQ Vd.T, Vn.T, Vm.T` / `FCMEQ Vd.T, Vn.T, #0.0` / `FCMEQ Sd, Sn, Sm` / `FCMEQ Sd, Sn, #0.0` | All ones where the lanes are equal, all zeros where they are not. `+0.0` equals `-0.0`, and a NaN is equal to nothing, itself included. |
| `FCMGE`   | the same shapes                  | Greater than or equal.                  |
| `FCMGT`   | the same shapes                  | Strictly greater than.                  |
| `FCMLE`   | `FCMLE Vd.T, Vn.T, #0.0` / `FCMLE Sd, Sn, #0.0` | Less than or equal to zero. There is no register form: swap the operands and use `FCMGE`. |
| `FCMLT`   | `FCMLT Vd.T, Vn.T, #0.0` / `FCMLT Sd, Sn, #0.0` | Strictly less than zero, same story.    |
| `FACGE`   | `FACGE Vd.T, Vn.T, Vm.T` / `FACGE Sd, Sn, Sm` | `FCMGE` on the absolute values, so the signs are ignored and `-3.0` beats `2.0`. |
| `FACGT`   | the same shapes                  | The strict absolute compare.            |
| `FRECPE`  | `FRECPE Vd.T, Vn.T` / `FRECPE Sd, Sn` | A reciprocal ESTIMATE, eight significant bits from the architecture's own table (the same table `URECPE` reads). A zero gives an infinity of the same sign, an infinity gives a zero, and anything below `2^-(bias+1)` overflows to an infinity. |
| `FRSQRTE` | `FRSQRTE Vd.T, Vn.T` / `FRSQRTE Sd, Sn` | A reciprocal-square-root estimate from the matching table. A zero gives an infinity, a negative gives the default NaN, and `+inf` gives `+0.0`. |
| `FRECPX`  | `FRECPX Sd, Sn` / `FRECPX Dd, Dn` | Scalar only: the sign kept, the exponent complemented, the mantissa zeroed, which is the exact power of two a reciprocal lands on. A zero or subnormal answers the largest exponent short of the one infinities claim. |
| `FRINTN`  | `FRINTN Vd.T, Vn.T`              | Round to an integral float, nearest with ties to EVEN: `2.5` gives `2.0`. |
| `FRINTA`  | `FRINTA Vd.T, Vn.T`              | Nearest with ties AWAY from zero: `2.5` gives `3.0`. The `.5` cases are the only place it differs from `FRINTN`, exactly as `FCVTAS` differs from `FCVTNS`. |
| `FRINTM`  | `FRINTM Vd.T, Vn.T`              | Toward minus infinity (floor).          |
| `FRINTP`  | `FRINTP Vd.T, Vn.T`              | Toward plus infinity (ceiling).         |
| `FRINTZ`  | `FRINTZ Vd.T, Vn.T`              | Toward zero (truncate).                 |
| `FRINTX`  | `FRINTX Vd.T, Vn.T`              | The current rounding mode, which here is nearest-even. It differs from `FRINTI` only in raising the inexact exception, and this emulator raises none. |
| `FRINTI`  | `FRINTI Vd.T, Vn.T`              | The current rounding mode, quietly.     |
| `FCVTN`   | `FCVTN Vd.4H, Vn.4S` / `FCVTN Vd.2S, Vn.2D` | Narrow each lane to half its width, round to nearest even, into the LOW half of the destination (the upper half is zeroed). The `4H` form is IEEE binary16. |
| `FCVTN2`  | `FCVTN2 Vd.8H, Vn.4S` / `FCVTN2 Vd.4S, Vn.2D` | The same, into the UPPER half, leaving the low half alone. |
| `FCVTL`   | `FCVTL Vd.4S, Vn.4H` / `FCVTL Vd.2D, Vn.2S` | Widen each lane, which is exact. The plain form reads the LOW half of the source. |
| `FCVTL2`  | `FCVTL2 Vd.4S, Vn.8H` / `FCVTL2 Vd.2D, Vn.4S` | The same, reading the UPPER half.       |
| `FCVTXN`  | `FCVTXN Vd.2S, Vn.2D` / `FCVTXN Sd, Dn` | Narrow `D` to `S` with round to ODD: toward zero, but an inexact result takes the neighbour with an odd significand, so a later widening can still tell the two halves of a tie apart. `2D` only. |
| `FCVTXN2` | `FCVTXN2 Vd.4S, Vn.2D`           | The upper-half form.                    |

The conversions between a float lane and an integer lane are the scalar mnemonics over an arrangement: `SCVTF Vd.T, Vn.T` and `UCVTF Vd.T, Vn.T` read each lane as a signed or unsigned integer of the lane's own width, and `FCVTZS`/`FCVTZU`/`FCVTAS`/`FCVTAU`/`FCVTMS`/`FCVTMU`/`FCVTNS`/`FCVTNU`/`FCVTPS`/`FCVTPU` go the other way, saturating at the LANE's rails and answering zero for a NaN. All four directions also take the SIMD-scalar spelling (`fcvtzs s3, s7`, whose result lands in the FP file rather than a general register) and the fixed-point `#fbits` form (`scvtf v3.2s, v7.2s, #17` divides by `2^fbits`; `fcvtzs` multiplies before rounding), where `fbits` runs 1 to 32 on an `S` lane and 1 to 64 on a `D` one.

`FMOV Vd.T, #imm` fills every lane with the same 8-bit float immediate the scalar `fmov s0, #1.0` takes, in the `2S`, `4S` and `2D` arrangements. `FMUL`, `FMLA`, `FMLS` and `FMULX` also take a by-element second source (`fmul v3.2s, v7.2s, v21.s[3]`, `fmul d3, d7, v21.d[1]`): one lane of `Vm` against every lane of `Vn`, with the index packed into the encoding's `H:L` bits for an `S` element and `H` alone for a `D` one, which has only two lanes.

## Vector structure loads and stores

`LD1`-`LD4` and `ST1`-`ST4` move a brace list of one to four vector
registers between memory and the register file. The list is written
either with commas (`{v3.16b, v4.16b}`) or as a range
(`{v3.16b-v4.16b}`), it wraps past `v31` (`{v30.16b-v1.16b}` is v30,
v31, v0, v1), and GAS prints a list of more than one register back as a
range whichever way it was written.

Each of them takes three addressing forms and nothing else: the bare
`[Xn]`, the immediate post-index `[Xn], #imm` where `#imm` is always the
total bytes the instruction moved (the word has no field for any other
value), and the register post-index `[Xn], Xm`. There is no offset, no
pre-index and no scaling.

The digit is the interleave factor. `LD2`/`LD3`/`LD4` de-interleave as
they read: `ld2 {v3.8b, v4.8b}, [x7]` over the bytes `00 01 02 ...`
leaves v3 holding `00 02 04 06 ...` and v4 holding `01 03 05 07 ...`.
The matching store interleaves the same way, writing one element from
each register in turn. `LD1`/`ST1` interleave nothing, which is why they
alone reach two, three and four registers: the list is filled a register
at a time.

| Mnemonic | Form                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| `LD1`    | `LD1 {Vt.T}, [Xn]` / `{Vt.T, Vt2.T}` / three / four (`8B`/`16B`, `4H`/`8H`, `2S`/`4S`, `1D`/`2D`), plus `[Xn], #imm` and `[Xn], Xm` | Contiguous load, no interleaving. The only family that spells `1D`, and the only one whose list can be longer than its digit. A 64-bit arrangement (`8B`, `4H`, `2S`, `1D`) zeroes bits 127:64 of every destination. |
| `ST1`    | the same shapes                   | The contiguous store. Nothing outside the bytes the list covers is written. |
| `LD2`    | `LD2 {Vt.T, Vt2.T}, [Xn]` (`8B`/`16B`, `4H`/`8H`, `2S`/`4S`, `2D`), plus the two post-index forms | Two-way de-interleave: element 0 to the first register, element 1 to the second, alternating on. No `1D` form, because a one-element list has nothing to interleave. |
| `ST2`    | the same shapes                   | The two-way interleave, the exact inverse. |
| `LD3`    | `LD3 {Vt.T, Vt2.T, Vt3.T}, [Xn]` (the same arrangements as `LD2`) | Three-way de-interleave, for `xyz` triples. |
| `ST3`    | the same shapes                   | The three-way interleave.               |
| `LD4`    | `LD4 {Vt.T, Vt2.T, Vt3.T, Vt4.T}, [Xn]` (the same arrangements) | Four-way de-interleave, for `rgba` quads. |
| `ST4`    | the same shapes                   | The four-way interleave.                |

Single structure, one lane at a time. The list names an element width
rather than an arrangement and carries the lane index outside the
braces: `ld1 {v3.b}[15], [x7]`, `ld4 {v3.s-v6.s}[3], [x7]`. These touch
ONE lane of each register and leave every other bit of it alone, which
is the difference that matters: nothing above the lane is zeroed. A `B`
index runs 0-15, an `H` index 0-7, an `S` index 0-3 and a `D` index
0-1. The index is not a field of its own; it is spread across the Q
bit, the S bit and the size field, which is why `ld1 {v3.b}[15]`
(`0x4d401ce3`) and `ld1 {v3.b}[0]` (`0x0d4000e3`) differ in three
places at once.

| Mnemonic | Form                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| `LD1`    | `LD1 {Vt.B}[index], [Xn]` (and `H`, `S`, `D`), plus `[Xn], #imm` and `[Xn], Xm` | Load one element into one lane. The post-index immediate is the element's own width: 1, 2, 4 or 8. |
| `ST1`    | the same shapes                   | Store that one lane and nothing else.   |
| `LD2`    | `LD2 {Vt.B, Vt2.B}[index], [Xn]` (and `H`, `S`, `D`) | Two consecutive elements into the same lane of two registers; the post-index immediate is twice the element width. |
| `ST2`    | the same shapes                   | The matching store.                     |
| `LD3`    | `LD3 {Vt.B, Vt2.B, Vt3.B}[index], [Xn]` (and `H`, `S`, `D`) | Three elements into the same lane of three registers. |
| `ST3`    | the same shapes                   | The matching store.                     |
| `LD4`    | `LD4 {Vt.B, Vt2.B, Vt3.B, Vt4.B}[index], [Xn]` (and `H`, `S`, `D`) | Four elements into the same lane of four registers. |
| `ST4`    | the same shapes                   | The matching store.                     |

Replicate. `LD1R`-`LD4R` read one element per register and copy it into
EVERY lane of that register, which is how a scalar is broadcast straight
out of memory. They are loads only; there is no `ST1R`.

| Mnemonic | Form                              | Notes                                   |
| -------- | --------------------------------- | --------------------------------------- |
| `LD1R`   | `LD1R {Vt.T}, [Xn]` (`8B`/`16B`, `4H`/`8H`, `2S`/`4S`, `1D`/`2D`), plus `[Xn], #imm` and `[Xn], Xm` | One element filling every lane. A 64-bit arrangement zeroes bits 127:64. The post-index immediate is the ELEMENT width, not the register width: `ld1r {v3.16b}, [x7], #1`. |
| `LD2R`   | `LD2R {Vt.T, Vt2.T}, [Xn]` (the same arrangements, `1D` included) | Two consecutive elements, one broadcast into each register. |
| `LD3R`   | `LD3R {Vt.T, Vt2.T, Vt3.T}, [Xn]` | Three elements, one per register.       |
| `LD4R`   | `LD4R {Vt.T, Vt2.T, Vt3.T, Vt4.T}, [Xn]` | Four elements, one per register. `ld4r {v3.2s-v6.2s}, [x7], #16` walks four words. |

An address in the unmapped first page faults here exactly as it does for
`LDR` and `STR`: the run halts with the null-pointer diagnosis, and an
`SP` base off the 16-byte boundary halts with the bus-error one.

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

Unmodified AArch64 GCC `-S` output assembles: the lexer accepts `@ident` attribute tokens (`.type foo, @function`, `@progbits`), `.L2:` / `.Ltext0:` dotted names are labels when they end in `:`, lowercase `bgt` / `beq` / `blt` route to the encoding for `B.GT` / `B.EQ` / `B.LT`, immediates assemble with or without the `#` prefix, and label lookups are case-preserving so mixed-case `.L<N>` targets resolve as GCC emitted them.

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
| `isdigit` / `isalpha` / `isspace` / `toupper` / `tolower` | C locale. The is* stubs return glibc's mask bit (nonzero, not 1), and the three tables the macros index (`__ctype_b_loc`, `__ctype_toupper_loc`, `__ctype_tolower_loc`) are hosted too, so GCC output that never calls the function still works. |
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

- The Advanced SIMD EXTENSION families. The base set is in; what is out is
  every family GNU `as` on the course servers refuses without an
  architecture directive, named here by its ARM extension so a rejection
  can be looked up, with the spellings each one was measured with:
  - `FEAT_AES`: `aese v0.16b, v1.16b`
  - `FEAT_SHA1`: `sha1c q0, s1, v2.4s`
  - `FEAT_SHA256`: `sha256h q0, q1, v2.4s`
  - `FEAT_SHA512`: `sha512h q0, q1, v2.2d`
  - `FEAT_SHA3`: `eor3`, `rax1`, `xar`, `bcax`
  - `FEAT_SM3`: `sm3ss1`. `FEAT_SM4`: `sm4e`
  - `FEAT_PMULL`: the `1Q` form alone, `pmull v0.1q, v1.1d, v2.1d`. The `8H` polynomial multiply and its `PMULL2` are base and are in.
  - `FEAT_DotProd`: `sdot v0.4s, v1.16b, v2.16b` and the by-element `udot`
  - `FEAT_I8MM`: `usdot`, `sudot`, `smmla`, `ummla`, `usmmla`
  - `FEAT_FP16`: half-precision ARITHMETIC on `4H`/`8H` lanes: `fadd v0.4h, v1.4h, v2.4h`, `fmaxv h0, v1.4h`, `fcmeq v0.8h, v1.8h, #0.0`, `scvtf v0.4h, v1.4h`, the by-element `fmul v0.4h, v1.4h, v2.h[3]`, and `fmov v0.4h, #1.0`. The CONVERSIONS to and from `4H` (`FCVTN`, `FCVTN2`, `FCVTL`, `FCVTL2`) are base v8.0 and are in.
  - `FEAT_RDM`: `sqrdmlah` and the by-element `sqrdmlsh`
  - `FEAT_FCMA`: `fcadd v0.4s, v1.4s, v2.4s, #90`, `fcmla`
  - `FEAT_JSCVT`: `fjcvtzs w0, d1`
  - `FEAT_FRINTTS`: `frint32x v0.4s, v1.4s`, `frint64z d0, d1`
  - `FEAT_FHM`: `fmlal v0.4s, v1.4h, v2.4h`, `fmlsl2`
  - `FEAT_BF16`: `bfdot`, `bfmlalb`, `bfcvtn`, `bfmmla`
  - `FEAT_FAMINMAX`: `famax v0.4s, v1.4s, v2.4s`
  - `FEAT_FP8`: `fscale`, `f1cvtl`, and the `8B` `fcvtn v0.8b, v1.4h`; `FP8DOT4` (`fdot`) and `FP8FMA` (`fmlalb`) sit under it
  - `FEAT_LUT`: `luti2`, `luti4`
  - `FEAT_LRCPC3`: `ldap1`, `stl1`, `ldapur`, `stlur`
  - `FEAT_LSFE`: `ldfadd`, `ldbfmax`, `stfmin`
  - `FEAT_LSUI`: `ldtp`, `ldtnp`, `sttp`
- System registers (`MRS`, `MSR`)
- Atomics (`LDAR`, `STXR`, `LDXR`, `STLR`)
- `SWP`, `CAS`, load-acquire / store-release
- SVE and SME

If you hit one of these and need it, see [`CONTRIBUTING.md`](CONTRIBUTING.md) for how to add it.
