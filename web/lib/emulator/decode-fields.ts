/**
 * Slices a 32-bit A64 machine word into its named encoding fields for the
 * live decode strip. This is a presentation-side field mapper, not a second
 * decoder: it recognizes the instruction classes the emulator supports and
 * returns the field layout (label, bit width, the actual bits, and a decoded
 * meaning for the register fields), plus which field the instruction writes
 * so the strip can light the destination amber. Unrecognized words fall back
 * to a single unsplit field, so the strip never lies about structure it does
 * not know.
 *
 * Every layout is validated in decode-fields.test.ts by re-concatenating the
 * sliced bits and comparing against machine words produced by the real
 * assembler, so the boundaries here cannot drift from the emulator silently.
 */

export interface DecodedField {
  /** Field name, e.g. "opcode", "Rd", "imm16". */
  label: string;
  /** Width in bits; all fields sum to 32. */
  bits: number;
  /** The field's actual bits, msb first, as a 0/1 string of length `bits`. */
  value: string;
  /** Decoded meaning where one reads at a glance (registers, immediates). */
  meaning?: string;
  /** Register-operand fields tint like the editor's register token. */
  kind?: "register" | "immediate" | "opcode";
}

export interface DecodedWord {
  fields: DecodedField[];
  /** Index into `fields` of the destination the instruction writes, if any. */
  destIndex: number | null;
}

function bits(word: number, hi: number, lo: number): number {
  // >>> keeps the sign bit out; the mask keeps widths under 32 safe.
  return (word >>> lo) & ((1 << (hi - lo + 1)) - 1) >>> 0;
}

function bitString(word: number, hi: number, lo: number): string {
  let out = "";
  for (let index = hi; index >= lo; index--) {
    out += ((word >>> index) & 1).toString();
  }
  return out;
}

function xreg(sf: number, index: number): string {
  if (index === 31) return sf ? "sp/xzr" : "wsp/wzr";
  return `${sf ? "x" : "w"}${index}`;
}

interface FieldSpec {
  label: string;
  hi: number;
  lo: number;
  kind?: DecodedField["kind"];
  meaning?: (word: number) => string;
}

function slice(word: number, specs: FieldSpec[], destLabel: string | null): DecodedWord {
  const fields = specs.map((spec) => ({
    label: spec.label,
    bits: spec.hi - spec.lo + 1,
    value: bitString(word, spec.hi, spec.lo),
    meaning: spec.meaning?.(word),
    kind: spec.kind,
  }));
  const destIndex = destLabel
    ? fields.findIndex((field) => field.label === destLabel)
    : -1;
  return { fields, destIndex: destIndex >= 0 ? destIndex : null };
}

const COND_NAMES = [
  "eq", "ne", "cs", "cc", "mi", "pl", "vs", "vc",
  "hi", "ls", "ge", "lt", "gt", "le", "al", "nv",
];

/** Slice a machine word into its encoding fields. Never throws. */
export function decodeFields(word: number): DecodedWord {
  const w = word >>> 0;
  const sf = bits(w, 31, 31);

  // Move wide: sf opc(2) 100101 hw(2) imm16 Rd.
  if (bits(w, 28, 23) === 0b100101) {
    return slice(
      w,
      [
        { label: "sf", hi: 31, lo: 31, kind: "opcode" },
        { label: "opc", hi: 30, lo: 29, kind: "opcode" },
        { label: "100101", hi: 28, lo: 23, kind: "opcode" },
        { label: "hw", hi: 22, lo: 21, kind: "immediate", meaning: (x) => `lsl ${bits(x, 22, 21) * 16}` },
        { label: "imm16", hi: 20, lo: 5, kind: "immediate", meaning: (x) => `${bits(x, 20, 5)}` },
        { label: "Rd", hi: 4, lo: 0, kind: "register", meaning: (x) => xreg(sf, bits(x, 4, 0)) },
      ],
      "Rd",
    );
  }

  // Add/sub immediate: sf op S 100010 sh imm12 Rn Rd.
  if (bits(w, 28, 23) === 0b100010) {
    return slice(
      w,
      [
        { label: "sf", hi: 31, lo: 31, kind: "opcode" },
        { label: "op", hi: 30, lo: 30, kind: "opcode", meaning: (x) => (bits(x, 30, 30) ? "sub" : "add") },
        { label: "S", hi: 29, lo: 29, kind: "opcode" },
        { label: "100010", hi: 28, lo: 23, kind: "opcode" },
        { label: "sh", hi: 22, lo: 22, kind: "immediate" },
        { label: "imm12", hi: 21, lo: 10, kind: "immediate", meaning: (x) => `${bits(x, 21, 10)}` },
        { label: "Rn", hi: 9, lo: 5, kind: "register", meaning: (x) => xreg(sf, bits(x, 9, 5)) },
        { label: "Rd", hi: 4, lo: 0, kind: "register", meaning: (x) => xreg(sf, bits(x, 4, 0)) },
      ],
      "Rd",
    );
  }

  // Add/sub shifted register: sf op S 01011 shift(2) 0 Rm imm6 Rn Rd.
  if (bits(w, 28, 24) === 0b01011 && bits(w, 21, 21) === 0) {
    return slice(
      w,
      [
        { label: "sf", hi: 31, lo: 31, kind: "opcode" },
        { label: "op", hi: 30, lo: 30, kind: "opcode", meaning: (x) => (bits(x, 30, 30) ? "sub" : "add") },
        { label: "S", hi: 29, lo: 29, kind: "opcode" },
        { label: "01011", hi: 28, lo: 24, kind: "opcode" },
        { label: "sh", hi: 23, lo: 22, kind: "opcode" },
        { label: "0", hi: 21, lo: 21, kind: "opcode" },
        { label: "Rm", hi: 20, lo: 16, kind: "register", meaning: (x) => xreg(sf, bits(x, 20, 16)) },
        { label: "imm6", hi: 15, lo: 10, kind: "immediate" },
        { label: "Rn", hi: 9, lo: 5, kind: "register", meaning: (x) => xreg(sf, bits(x, 9, 5)) },
        { label: "Rd", hi: 4, lo: 0, kind: "register", meaning: (x) => xreg(sf, bits(x, 4, 0)) },
      ],
      "Rd",
    );
  }

  // Add/sub EXTENDED register (bit 21 = 1): the form that reaches SP.
  // Rn (and Rd for the non-flag-setting ops) read as SP when 31.
  if (bits(w, 28, 24) === 0b01011 && bits(w, 23, 22) === 0b00 && bits(w, 21, 21) === 1) {
    const extendNames = ["uxtb", "uxth", "uxtw", "uxtx", "sxtb", "sxth", "sxtw", "sxtx"];
    const setsFlags = bits(w, 29, 29) === 1;
    const spName = (x: number, hi: number, lo: number) => {
      const idx = bits(x, hi, lo);
      return idx === 31 ? (sf ? "sp" : "wsp") : xreg(sf, idx);
    };
    return slice(
      w,
      [
        { label: "sf", hi: 31, lo: 31, kind: "opcode" },
        { label: "op", hi: 30, lo: 30, kind: "opcode", meaning: (x) => (bits(x, 30, 30) ? "sub" : "add") },
        { label: "S", hi: 29, lo: 29, kind: "opcode" },
        { label: "01011", hi: 28, lo: 24, kind: "opcode" },
        { label: "00", hi: 23, lo: 22, kind: "opcode" },
        { label: "1", hi: 21, lo: 21, kind: "opcode" },
        { label: "Rm", hi: 20, lo: 16, kind: "register", meaning: (x) => xreg(sf, bits(x, 20, 16)) },
        { label: "option", hi: 15, lo: 13, kind: "opcode", meaning: (x) => extendNames[bits(x, 15, 13)] },
        { label: "imm3", hi: 12, lo: 10, kind: "immediate" },
        { label: "Rn", hi: 9, lo: 5, kind: "register", meaning: (x) => spName(x, 9, 5) },
        {
          label: "Rd",
          hi: 4,
          lo: 0,
          kind: "register",
          meaning: (x) => (setsFlags ? xreg(sf, bits(x, 4, 0)) : spName(x, 4, 0)),
        },
      ],
      "Rd",
    );
  }

  // Logical shifted register: sf opc(2) 01010 shift(2) N Rm imm6 Rn Rd.
  if (bits(w, 28, 24) === 0b01010) {
    return slice(
      w,
      [
        { label: "sf", hi: 31, lo: 31, kind: "opcode" },
        { label: "opc", hi: 30, lo: 29, kind: "opcode" },
        { label: "01010", hi: 28, lo: 24, kind: "opcode" },
        { label: "sh", hi: 23, lo: 22, kind: "opcode" },
        { label: "N", hi: 21, lo: 21, kind: "opcode" },
        { label: "Rm", hi: 20, lo: 16, kind: "register", meaning: (x) => xreg(sf, bits(x, 20, 16)) },
        { label: "imm6", hi: 15, lo: 10, kind: "immediate" },
        { label: "Rn", hi: 9, lo: 5, kind: "register", meaning: (x) => xreg(sf, bits(x, 9, 5)) },
        { label: "Rd", hi: 4, lo: 0, kind: "register", meaning: (x) => xreg(sf, bits(x, 4, 0)) },
      ],
      "Rd",
    );
  }

  // Logical immediate: sf opc(2) 100100 N immr imms Rn Rd.
  if (bits(w, 28, 23) === 0b100100) {
    return slice(
      w,
      [
        { label: "sf", hi: 31, lo: 31, kind: "opcode" },
        { label: "opc", hi: 30, lo: 29, kind: "opcode" },
        { label: "100100", hi: 28, lo: 23, kind: "opcode" },
        { label: "N", hi: 22, lo: 22, kind: "opcode" },
        { label: "immr", hi: 21, lo: 16, kind: "immediate" },
        { label: "imms", hi: 15, lo: 10, kind: "immediate" },
        { label: "Rn", hi: 9, lo: 5, kind: "register", meaning: (x) => xreg(sf, bits(x, 9, 5)) },
        { label: "Rd", hi: 4, lo: 0, kind: "register", meaning: (x) => xreg(sf, bits(x, 4, 0)) },
      ],
      "Rd",
    );
  }

  // Data-processing 3-source (madd/msub/mul): sf 00 11011 000 Rm o0 Ra Rn Rd.
  if (bits(w, 28, 24) === 0b11011 && bits(w, 30, 29) === 0) {
    return slice(
      w,
      [
        { label: "sf", hi: 31, lo: 31, kind: "opcode" },
        { label: "00", hi: 30, lo: 29, kind: "opcode" },
        { label: "11011", hi: 28, lo: 24, kind: "opcode" },
        { label: "op31", hi: 23, lo: 21, kind: "opcode" },
        { label: "Rm", hi: 20, lo: 16, kind: "register", meaning: (x) => xreg(sf, bits(x, 20, 16)) },
        { label: "o0", hi: 15, lo: 15, kind: "opcode", meaning: (x) => (bits(x, 15, 15) ? "msub" : "madd") },
        { label: "Ra", hi: 14, lo: 10, kind: "register", meaning: (x) => xreg(sf, bits(x, 14, 10)) },
        { label: "Rn", hi: 9, lo: 5, kind: "register", meaning: (x) => xreg(sf, bits(x, 9, 5)) },
        { label: "Rd", hi: 4, lo: 0, kind: "register", meaning: (x) => xreg(sf, bits(x, 4, 0)) },
      ],
      "Rd",
    );
  }

  // Data-processing 2-source (udiv/sdiv/lslv/...): sf 0 S 11010110 Rm opcode(6) Rn Rd.
  if (bits(w, 28, 21) === 0b11010110 && bits(w, 30, 30) === 0) {
    return slice(
      w,
      [
        { label: "sf", hi: 31, lo: 31, kind: "opcode" },
        { label: "0S", hi: 30, lo: 29, kind: "opcode" },
        { label: "11010110", hi: 28, lo: 21, kind: "opcode" },
        { label: "Rm", hi: 20, lo: 16, kind: "register", meaning: (x) => xreg(sf, bits(x, 20, 16)) },
        { label: "opcode", hi: 15, lo: 10, kind: "opcode" },
        { label: "Rn", hi: 9, lo: 5, kind: "register", meaning: (x) => xreg(sf, bits(x, 9, 5)) },
        { label: "Rd", hi: 4, lo: 0, kind: "register", meaning: (x) => xreg(sf, bits(x, 4, 0)) },
      ],
      "Rd",
    );
  }

  // Load/store register pair: opc(2) 101 V 0 mode(3) L imm7 Rt2 Rn Rt.
  if (bits(w, 29, 27) === 0b101 && bits(w, 25, 25) === 0) {
    const load = bits(w, 22, 22) === 1;
    const wide = bits(w, 31, 31) === 1 || bits(w, 30, 30) === 1;
    return slice(
      w,
      [
        { label: "opc", hi: 31, lo: 30, kind: "opcode" },
        { label: "101", hi: 29, lo: 27, kind: "opcode" },
        { label: "V", hi: 26, lo: 26, kind: "opcode" },
        { label: "0", hi: 25, lo: 25, kind: "opcode" },
        { label: "mode", hi: 24, lo: 23, kind: "opcode" },
        { label: "L", hi: 22, lo: 22, kind: "opcode", meaning: (x) => (bits(x, 22, 22) ? "ldp" : "stp") },
        { label: "imm7", hi: 21, lo: 15, kind: "immediate" },
        { label: "Rt2", hi: 14, lo: 10, kind: "register", meaning: (x) => xreg(wide ? 1 : 0, bits(x, 14, 10)) },
        { label: "Rn", hi: 9, lo: 5, kind: "register", meaning: (x) => xreg(1, bits(x, 9, 5)) },
        { label: "Rt", hi: 4, lo: 0, kind: "register", meaning: (x) => xreg(wide ? 1 : 0, bits(x, 4, 0)) },
      ],
      load ? "Rt" : null,
    );
  }

  // Load/store register (unsigned imm / pre / post): size 111 V 0x opc ...
  if (bits(w, 29, 27) === 0b111 && bits(w, 25, 24) !== 0b10) {
    const unsignedImm = bits(w, 25, 24) === 0b01;
    const load = bits(w, 23, 22) !== 0b00;
    const size = bits(w, 31, 30);
    const regSf = size === 0b11 ? 1 : 0;
    if (unsignedImm) {
      return slice(
        w,
        [
          { label: "size", hi: 31, lo: 30, kind: "opcode" },
          { label: "111", hi: 29, lo: 27, kind: "opcode" },
          { label: "V", hi: 26, lo: 26, kind: "opcode" },
          { label: "01", hi: 25, lo: 24, kind: "opcode" },
          { label: "opc", hi: 23, lo: 22, kind: "opcode", meaning: (x) => (bits(x, 23, 22) ? "ldr" : "str") },
          { label: "imm12", hi: 21, lo: 10, kind: "immediate", meaning: (x) => `${bits(x, 21, 10)}` },
          { label: "Rn", hi: 9, lo: 5, kind: "register", meaning: (x) => xreg(1, bits(x, 9, 5)) },
          { label: "Rt", hi: 4, lo: 0, kind: "register", meaning: (x) => xreg(regSf, bits(x, 4, 0)) },
        ],
        load ? "Rt" : null,
      );
    }
    // Bit 21 splits the 00 family: 1 with idx bits 10 means REGISTER
    // offset (Rm + option + S), everything else is the 9-bit-immediate
    // pre/post-index form. Slicing register-offset words through the
    // imm9 layout fabricated an immediate and hid the index register.
    if (bits(w, 21, 21) === 1 && bits(w, 11, 10) === 0b10) {
      const optionNames: Record<number, string> = {
        0b010: "uxtw",
        0b011: "lsl",
        0b110: "sxtw",
        0b111: "sxtx",
      };
      return slice(
        w,
        [
          { label: "size", hi: 31, lo: 30, kind: "opcode" },
          { label: "111", hi: 29, lo: 27, kind: "opcode" },
          { label: "V", hi: 26, lo: 26, kind: "opcode" },
          { label: "00", hi: 25, lo: 24, kind: "opcode" },
          { label: "opc", hi: 23, lo: 22, kind: "opcode", meaning: (x) => (bits(x, 23, 22) ? "ldr" : "str") },
          { label: "1", hi: 21, lo: 21, kind: "opcode" },
          {
            label: "Rm",
            hi: 20,
            lo: 16,
            kind: "register",
            // UXTW/SXTW take a W index; LSL/UXTX/SXTX take an X index.
            meaning: (x) => xreg(bits(x, 15, 13) === 0b010 || bits(x, 15, 13) === 0b110 ? 0 : 1, bits(x, 20, 16)),
          },
          {
            label: "option",
            hi: 15,
            lo: 13,
            kind: "opcode",
            meaning: (x) => optionNames[bits(x, 15, 13)] ?? "reserved",
          },
          {
            label: "S",
            hi: 12,
            lo: 12,
            kind: "opcode",
            meaning: (x) => (bits(x, 12, 12) ? "scaled by the access size" : "unscaled"),
          },
          { label: "10", hi: 11, lo: 10, kind: "opcode" },
          { label: "Rn", hi: 9, lo: 5, kind: "register", meaning: (x) => xreg(1, bits(x, 9, 5)) },
          { label: "Rt", hi: 4, lo: 0, kind: "register", meaning: (x) => xreg(regSf, bits(x, 4, 0)) },
        ],
        load ? "Rt" : null,
      );
    }
    return slice(
      w,
      [
        { label: "size", hi: 31, lo: 30, kind: "opcode" },
        { label: "111", hi: 29, lo: 27, kind: "opcode" },
        { label: "V", hi: 26, lo: 26, kind: "opcode" },
        { label: "00", hi: 25, lo: 24, kind: "opcode" },
        { label: "opc", hi: 23, lo: 22, kind: "opcode", meaning: (x) => (bits(x, 23, 22) ? "ldr" : "str") },
        { label: "0", hi: 21, lo: 21, kind: "opcode" },
        { label: "imm9", hi: 20, lo: 12, kind: "immediate" },
        { label: "idx", hi: 11, lo: 10, kind: "opcode" },
        { label: "Rn", hi: 9, lo: 5, kind: "register", meaning: (x) => xreg(1, bits(x, 9, 5)) },
        { label: "Rt", hi: 4, lo: 0, kind: "register", meaning: (x) => xreg(regSf, bits(x, 4, 0)) },
      ],
      load ? "Rt" : null,
    );
  }

  // Load register (literal): opc(2) 011 V 00 imm19 Rt — the `ldr xN, =label` pool path.
  if (bits(w, 29, 27) === 0b011 && bits(w, 25, 24) === 0b00) {
    return slice(
      w,
      [
        { label: "opc", hi: 31, lo: 30, kind: "opcode" },
        { label: "011", hi: 29, lo: 27, kind: "opcode" },
        { label: "V", hi: 26, lo: 26, kind: "opcode" },
        { label: "00", hi: 25, lo: 24, kind: "opcode" },
        { label: "imm19", hi: 23, lo: 5, kind: "immediate" },
        { label: "Rt", hi: 4, lo: 0, kind: "register", meaning: (x) => xreg(1, bits(x, 4, 0)) },
      ],
      "Rt",
    );
  }

  // Unconditional branch immediate: op 00101 imm26 (b / bl).
  if (bits(w, 30, 26) === 0b00101) {
    return slice(
      w,
      [
        { label: "op", hi: 31, lo: 31, kind: "opcode", meaning: (x) => (bits(x, 31, 31) ? "bl" : "b") },
        { label: "00101", hi: 30, lo: 26, kind: "opcode" },
        { label: "imm26", hi: 25, lo: 0, kind: "immediate" },
      ],
      null,
    );
  }

  // Conditional branch: 0101010 0 imm19 0 cond.
  if (bits(w, 31, 25) === 0b0101010 && bits(w, 4, 4) === 0) {
    return slice(
      w,
      [
        { label: "0101010", hi: 31, lo: 25, kind: "opcode" },
        { label: "0", hi: 24, lo: 24, kind: "opcode" },
        { label: "imm19", hi: 23, lo: 5, kind: "immediate" },
        { label: "0", hi: 4, lo: 4, kind: "opcode" },
        { label: "cond", hi: 3, lo: 0, kind: "opcode", meaning: (x) => COND_NAMES[bits(x, 3, 0)] },
      ],
      null,
    );
  }

  // Compare and branch: sf 011010 op imm19 Rt.
  if (bits(w, 30, 25) === 0b011010) {
    return slice(
      w,
      [
        { label: "sf", hi: 31, lo: 31, kind: "opcode" },
        { label: "011010", hi: 30, lo: 25, kind: "opcode" },
        { label: "op", hi: 24, lo: 24, kind: "opcode", meaning: (x) => (bits(x, 24, 24) ? "cbnz" : "cbz") },
        { label: "imm19", hi: 23, lo: 5, kind: "immediate" },
        { label: "Rt", hi: 4, lo: 0, kind: "register", meaning: (x) => xreg(sf, bits(x, 4, 0)) },
      ],
      null,
    );
  }

  // Unconditional branch register: 1101011 opc(4) 11111 000000 Rn 00000 (br/blr/ret).
  if (bits(w, 31, 25) === 0b1101011) {
    return slice(
      w,
      [
        { label: "1101011", hi: 31, lo: 25, kind: "opcode" },
        { label: "opc", hi: 24, lo: 21, kind: "opcode" },
        { label: "11111", hi: 20, lo: 16, kind: "opcode" },
        { label: "op3", hi: 15, lo: 10, kind: "opcode" },
        { label: "Rn", hi: 9, lo: 5, kind: "register", meaning: (x) => xreg(1, bits(x, 9, 5)) },
        { label: "00000", hi: 4, lo: 0, kind: "opcode" },
      ],
      null,
    );
  }

  // Exception generation: 11010100 000 imm16 000 01 (svc).
  if (bits(w, 31, 24) === 0b11010100) {
    return slice(
      w,
      [
        { label: "11010100", hi: 31, lo: 24, kind: "opcode" },
        { label: "opc", hi: 23, lo: 21, kind: "opcode" },
        { label: "imm16", hi: 20, lo: 5, kind: "immediate", meaning: (x) => `${bits(x, 20, 5)}` },
        { label: "op2", hi: 4, lo: 2, kind: "opcode" },
        { label: "LL", hi: 1, lo: 0, kind: "opcode" },
      ],
      null,
    );
  }

  // ADR/ADRP: op immlo(2) 10000 immhi(19) Rd.
  if (bits(w, 28, 24) === 0b10000) {
    return slice(
      w,
      [
        { label: "op", hi: 31, lo: 31, kind: "opcode", meaning: (x) => (bits(x, 31, 31) ? "adrp" : "adr") },
        { label: "immlo", hi: 30, lo: 29, kind: "immediate" },
        { label: "10000", hi: 28, lo: 24, kind: "opcode" },
        { label: "immhi", hi: 23, lo: 5, kind: "immediate" },
        { label: "Rd", hi: 4, lo: 0, kind: "register", meaning: (x) => xreg(1, bits(x, 4, 0)) },
      ],
      "Rd",
    );
  }

  // Fallback: one unsplit word, so the strip stays truthful for anything
  // outside the mapped classes (FP data processing, system ops, data words).
  return slice(w, [{ label: "word", hi: 31, lo: 0, kind: "opcode" }], null);
}
