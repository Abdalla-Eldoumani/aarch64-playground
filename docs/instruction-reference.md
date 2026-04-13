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
| `MUL`    | `MUL Xd, Xn, Xm`                 | Low 64 bits of product.                  |
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

Alignment is enforced: `LDR`/`STR` needs 8-byte alignment, `LDRH`/`STRH` needs 2-byte, etc. Unaligned accesses raise `UnalignedAccess`.

## Branches

| Mnemonic | Form             | Notes                                             |
| -------- | ---------------- | ------------------------------------------------- |
| `B`      | `B label`        | Unconditional.                                    |
| `BL`     | `BL label`       | Branch with link (stores return addr in `X30`).   |
| `BR`     | `BR Xn`          | Branch to register.                               |
| `BLR`    | `BLR Xn`         | Branch to register with link.                     |
| `RET`    | `RET` / `RET Xn` | Default `RET` uses X30.                           |
| `B.cond` | `B.EQ label` etc.| One per condition code listed above.              |

## System

| Mnemonic | Form     | Notes                                  |
| -------- | -------- | -------------------------------------- |
| `NOP`    | `NOP`    | Does nothing, still advances PC.       |
| `SVC`    | `SVC #0` | Treated as halt; emulator stops.       |

## NZCV flags

`ADDS`, `SUBS`, `ANDS`, `CMP`, `CMN`, `TST` update the condition flags. They are visible in the register panel as `N Z C V` and used by `B.cond` / `CSEL` / `CSET` / friends.

## Things that are not implemented

- FP and SIMD (`FADD`, `FMUL`, `LDP Dn,Dm,...`, etc.)
- System registers (`MRS`, `MSR`)
- Atomics (`LDAR`, `STXR`, etc.)
- `SWP`, `CAS`, load-acquire / store-release
- Crypto, SVE, SME

If you hit one of these and need it, see [`CONTRIBUTING.md`](CONTRIBUTING.md) for how to add it.
