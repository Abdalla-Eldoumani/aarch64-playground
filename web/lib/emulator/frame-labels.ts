/**
 * Reads `name = <integer>` lines so the stack panel can label `[fp, offset]`
 * slots with the names the student wrote (`name_s = 16`). Only positive
 * values count: slots sit above fp, and a negative value is a frame size.
 */
export interface StackSlot {
  /** Byte offset from FP. */
  offset: number;
  /** Symbol name the source used. */
  name: string;
}

const ASSIGN_RE =
  /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(-?(?:0x[0-9a-fA-F]+|\d+))\s*(?:\/\/|;|$)/;

/** Walk the source, return the slot list sorted by ascending offset. */
export function parseFrameSlots(source: string): StackSlot[] {
  const slots: StackSlot[] = [];
  const lines = source.split("\n");
  for (const raw of lines) {
    const match = ASSIGN_RE.exec(raw);
    if (!match) continue;
    const name = match[1];
    const body = match[2];
    const value = parseIntLiteral(body);
    if (value === null) continue;
    // Above 512 the assignment is a program constant, not a frame slot:
    // course frames stay well under it.
    if (value <= 0 || value > 512) continue;
    slots.push({ offset: value, name });
  }
  slots.sort((a, b) => a.offset - b.offset);
  return slots;
}

function parseIntLiteral(s: string): number | null {
  const trimmed = s.trim();
  const negative = trimmed.startsWith("-");
  const body = negative ? trimmed.slice(1) : trimmed;
  let value: number;
  if (body.startsWith("0x") || body.startsWith("0X")) {
    value = parseInt(body.slice(2), 16);
  } else {
    value = parseInt(body, 10);
  }
  if (Number.isNaN(value)) return null;
  return negative ? -value : value;
}

/** Look up a label for a specific offset, or null if none matches. */
export function labelForOffset(slots: StackSlot[], offset: number): string | null {
  for (const s of slots) if (s.offset === offset) return s.name;
  return null;
}
