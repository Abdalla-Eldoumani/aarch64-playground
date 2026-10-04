/**
 * Everything needed to debug one run, gathered when the student asks. It
 * leaves as a markdown report (bundle-markdown.ts) or a `?bundle=` link that
 * reopens the program, and holds playground state only, plus the site,
 * emulator, and browser versions.
 */

import LZString from "lz-string";
import sitePackage from "@/package.json";
import emulatorPackage from "@/lib/wasm/package.json";
import { place, type Place } from "@/lib/emulator/clobber-note";
import type { EmulatorState } from "@/lib/emulator/emulator-state";
import { labelForOffset, parseFrameSlots, type StackSlot } from "@/lib/emulator/frame-labels";
import { formatByte, formatWord32, formatWord64 } from "@/lib/emulator/format-hex";
import { formatSteps } from "@/lib/emulator/format-steps";
import {
  combineSources,
  sameWorkspace,
  validateFileName,
  type SourceFile,
  type Workspace,
} from "@/lib/playground/file-map";
import {
  MAX_BUNDLE_DECOMPRESSED_BYTES,
  MAX_SHARE_HASH_BYTES,
  MAX_WORKSPACE_FILES,
} from "@/lib/playground/upload-guard";

export type { Place };

/** One section's bytes as hex rows, with a last line saying where it stopped. */
export interface MemoryDump {
  name: string;
  lines: string[];
}

export interface DiagnosticBundle {
  /** main.asm as the editor holds it. */
  source: string;
  /** The helper files beside main.asm, in tab order. */
  files?: SourceFile[];
  args?: string;
  /** What the run was given on stdin. */
  stdin?: string;
  stdout?: string;
  stderr?: string;
  /** The console's notes about the run (a register a library call overwrote). */
  notes?: string[];
  exitCode?: number | null;
  error?: string | null;
  /** How far the run got, as a sentence. */
  status?: string;
  /** The line an assemble, link, or runtime error points at. */
  errorAt?: Place;
  /** The line the pc is on; inside a library call, the line that called it. */
  pcAt?: Place;
  /** x0 to x30, each "0x" + 16 hex digits. */
  registers?: string[];
  /** d0 to d31 as raw bits. */
  fpRegisters?: string[];
  /** v0 to v31, each "0x" + 32 hex digits. */
  vectorRegisters?: string[];
  sp?: string;
  pc?: string;
  /** N at bit 3, Z at bit 2, C at bit 1, V at bit 0. */
  nzcv?: number;
  /** The instructions around the pc, the current one marked "=>". */
  disassembly?: string[];
  /** 8-byte rows from sp upward, frame records and named slots labelled. */
  stack?: string[];
  /** The .data and .bss sections. */
  memory?: MemoryDump[];
  /** The virtual files the program can open. */
  vfs?: SourceFile[];
  site?: string;
  emulator?: string;
  browser?: string;
}

const BUNDLE_VERSION = 2;

/** lz-string compress for the `?bundle=...` query parameter. */
export function encodeBundle(bundle: DiagnosticBundle): string {
  const payload = { v: BUNDLE_VERSION, b: bundle };
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

/**
 * The `?bundle=` link that reopens this program, or null when even the program
 * alone is too long. A reopen reads only the program and its input, so the
 * link falls back to those when the whole bundle does not fit.
 */
export function bundleShareUrl(originUrl: string, bundle: DiagnosticBundle): string | null {
  const { source, files, args, stdin } = bundle;
  for (const payload of [bundle, { source, files, args, stdin }]) {
    const encoded = encodeBundle(payload);
    if (encoded.length <= MAX_SHARE_HASH_BYTES) return `${originUrl}?bundle=${encoded}`;
  }
  return null;
}

type Check = (v: unknown) => boolean;

const isString: Check = (v) => typeof v === "string";
const isNumber: Check = (v) => typeof v === "number" && Number.isFinite(v);
const orNull = (check: Check): Check => (v) => v === null || check(v);
const listOf = (check: Check): Check => (v) => Array.isArray(v) && v.every(check);
const shaped = (fields: Record<string, Check>): Check => (v) =>
  v != null &&
  typeof v === "object" &&
  Object.entries(fields).every(([key, check]) => check((v as Record<string, unknown>)[key]));

const isFile = shaped({ name: isString, body: isString });
const isPlace = shaped({ file: orNull(isString), line: isNumber, text: isString });

// A reopen puts these names on tabs and in the `// ---- name ----` line the
// files are joined with, so they pass the same gate as a tab the student
// names: a newline in one would write its own lines into the program.
const isHelperList: Check = (v) =>
  listOf(isFile)(v) &&
  (v as SourceFile[]).length <= MAX_WORKSPACE_FILES &&
  (v as SourceFile[]).every(
    (f, i, all) => f.name === f.name.trim() && validateFileName(f.name, all, i) === null,
  );

/** Every field a version 2 bundle may carry, in the type it must have. */
const V2_FIELDS: Record<keyof DiagnosticBundle, Check> = {
  source: isString,
  files: isHelperList,
  args: isString,
  stdin: isString,
  stdout: isString,
  stderr: isString,
  notes: listOf(isString),
  exitCode: orNull(isNumber),
  error: orNull(isString),
  status: isString,
  errorAt: isPlace,
  pcAt: isPlace,
  registers: listOf(isString),
  fpRegisters: listOf(isString),
  vectorRegisters: listOf(isString),
  sp: isString,
  pc: isString,
  nzcv: isNumber,
  disassembly: listOf(isString),
  stack: listOf(isString),
  memory: listOf(shaped({ name: isString, lines: listOf(isString) })),
  vfs: listOf(isFile),
  site: isString,
  emulator: isString,
  browser: isString,
};

/** Version 1 links are still out there. Their `stackBytes` (64 bytes above
 *  sp as one hex string) is checked, then dropped: nothing reads it now. */
const V1_FIELDS: Record<string, Check> = {
  source: isString,
  args: isString,
  stdin: isString,
  stdout: isString,
  stderr: isString,
  notes: listOf(isString),
  exitCode: orNull(isNumber),
  registers: listOf(isString),
  sp: isString,
  pc: isString,
  stackBytes: isString,
  error: orNull(isString),
};

/**
 * Strict shape validation on a decoded bundle: a field outside the list is
 * dropped, and a listed field of the wrong type fails the whole bundle, so a
 * crafted `?bundle=` link cannot hand downstream code a non-string `args`.
 */
function readFields(b: unknown, fields: Record<string, Check>): Record<string, unknown> | null {
  if (b == null || typeof b !== "object") return null;
  const o = b as Record<string, unknown>;
  if (typeof o.source !== "string") return null;
  const out: Record<string, unknown> = {};
  for (const [key, check] of Object.entries(fields)) {
    if (o[key] === undefined) continue;
    if (!check(o[key])) return null;
    out[key] = o[key];
  }
  return out;
}

/**
 * The four outcomes of reading a `?bundle=` query, like `ShareReadResult`.
 * They stay apart so a broken or oversized link shows a notice instead of
 * quietly opening the default program.
 */
export type BundleReadResult =
  | { kind: "none" }
  | { kind: "ok"; bundle: DiagnosticBundle }
  | { kind: "corrupt" }
  | { kind: "too-large" };

/** Decode a `?bundle=` value, version 1 or 2. Anything that fails to
 *  decompress, parse, or pass the shape check is `corrupt`. */
export function decodeBundle(value: string | null): BundleReadResult {
  if (!value) return { kind: "none" };
  // Cap the still-compressed value before lz-string runs, so even its
  // quadratic worst case stays small (see MAX_SHARE_HASH_BYTES).
  if (value.length > MAX_SHARE_HASH_BYTES) return { kind: "too-large" };
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(value);
    if (!decompressed) return { kind: "corrupt" };
    if (decompressed.length > MAX_BUNDLE_DECOMPRESSED_BYTES) return { kind: "too-large" };
    const parsed = JSON.parse(decompressed) as unknown;
    if (parsed == null || typeof parsed !== "object") return { kind: "corrupt" };
    const versioned = parsed as { v?: unknown; b?: unknown };
    const fields =
      versioned.v === BUNDLE_VERSION ? V2_FIELDS : versioned.v === 1 ? V1_FIELDS : null;
    const bundle = fields && readFields(versioned.b, fields);
    if (!bundle) return { kind: "corrupt" };
    delete bundle.stackBytes;
    return { kind: "ok", bundle: bundle as unknown as DiagnosticBundle };
  } catch {
    return { kind: "corrupt" };
  }
}

/** The parts of the emulator hub a bundle reads. */
export type DiagnosticMachine = Pick<
  EmulatorState,
  | "registers"
  | "fpRegisters"
  | "vectorRegisters"
  | "sp"
  | "pc"
  | "nzcv"
  | "stdout"
  | "stderr"
  | "notes"
  | "exitCode"
  | "error"
  | "assemblyErrors"
  | "currentLine"
  | "externalCall"
  | "instructions"
  | "memoryRegions"
  | "vfsFiles"
  | "programLoaded"
  | "isHalted"
  | "isRunning"
  | "blocked"
  | "stepCount"
  | "stdinGiven"
  | "readMemory"
  | "readVfsFile"
  | "resolveLabel"
>;

export interface DiagnosticInput {
  machine: DiagnosticMachine;
  /** The buffers on screen: the program the report and the link carry. */
  workspace: Workspace;
  /** What the machine last assembled, which every line it reports counts
   *  in; null before the first assemble. */
  assembled: Workspace | null;
  args: string;
  /** Reduced to the browser's name, version, and system before it is kept. */
  userAgent: string;
}

// The caps keep a report something a person can paste: output and input keep
// their last 16,000 characters (where a run went wrong), the stack 512 bytes
// above sp, each data section 256 bytes, and the virtual files 8 of 2,000
// characters each. Each capped section says so.
const TEXT_CAP = 16_000;
const STACK_CAP = 512;
const SECTION_SCAN = 4096;
const SECTION_CAP = 256;
const VFS_FILES_CAP = 8;
const VFS_TEXT_CAP = 2000;
/** Instructions shown on each side of the pc. */
const WINDOW = 4;

/**
 * Gather the bundle for the run on screen. Every machine read is guarded, so
 * a read that fails leaves a line saying so instead of failing the report.
 */
export async function collectDiagnostic(input: DiagnosticInput): Promise<DiagnosticBundle> {
  const { machine: m, workspace, args, userAgent } = input;
  const ws = input.assembled ?? workspace;
  const errorLine = m.assemblyErrors[0]?.line ?? 0;
  const bundle: DiagnosticBundle = {
    source: workspace.main,
    files: workspace.extras.length > 0 ? workspace.extras.map(({ name, body }) => ({ name, body })) : undefined,
    args: args || undefined,
    stdin: clipTail(m.stdinGiven(), "input") || undefined,
    stdout: clipTail(squeezeRepeats(m.stdout), "output") || undefined,
    stderr: clipTail(squeezeRepeats(m.stderr), "error output") || undefined,
    notes: m.notes.length > 0 ? [...m.notes] : undefined,
    exitCode: m.exitCode,
    error: m.error,
    errorAt: m.error && errorLine > 0 ? place(errorLine, ws) : undefined,
    status: runStatus(m, !sameWorkspace(workspace, ws)),
    vfs: await virtualFiles(m),
    site: sitePackage.version,
    emulator: emulatorPackage.version,
    browser: browserFamily(userAgent),
  };
  if (!m.programLoaded) return bundle;
  const combined = combineSources(ws.main, ws.extras);
  return {
    ...bundle,
    pcAt: m.currentLine != null ? place(m.currentLine, ws) : undefined,
    registers: [...m.registers],
    fpRegisters: m.fpRegisters.length > 0 ? [...m.fpRegisters] : undefined,
    vectorRegisters: m.vectorRegisters.length > 0 ? [...m.vectorRegisters] : undefined,
    sp: m.sp,
    pc: formatWord64(m.pc),
    nzcv: m.nzcv,
    disassembly: disassemblyWindow(m),
    stack: await stackRows(m, parseFrameSlots(combined)),
    memory: await sectionDumps(m, combined),
  };
}

/** The end of a long text from a whole line on, with a first line saying
 *  the start was cut. */
function clipTail(text: string, what: string): string {
  if (text.length <= TEXT_CAP) return text;
  const tail = text.slice(-TEXT_CAP);
  return `[${what} cut: only the end, at most ${TEXT_CAP} characters, is included]\n${tail.slice(tail.indexOf("\n") + 1)}`;
}

/** A line printed over and over, the usual output of a loop that never
 *  ends, kept once with a count. */
function squeezeRepeats(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (let first = 0; first < lines.length; ) {
    let last = first;
    while (last + 1 < lines.length && lines[last + 1] === lines[first]) last++;
    const again = last - first;
    if (again >= 3) out.push(lines[first], `[the line above repeats ${again} more times]`);
    else out.push(...lines.slice(first, last + 1));
    first = last + 1;
  }
  return out.join("\n");
}

function runStatus(m: DiagnosticMachine, edited: boolean): string {
  const steps = formatSteps(m.stepCount);
  let status: string;
  if (!m.programLoaded) {
    status = m.error ? "not running: the program did not assemble or link" : "not assembled yet";
  } else if (m.error) {
    status = `stopped after ${steps} with the error below`;
  } else if (m.isHalted) {
    status = `finished after ${steps}${m.exitCode != null ? ` with exit code ${m.exitCode}` : ""}`;
  } else if (m.blocked) {
    status = `waiting for input after ${steps}`;
  } else if (m.isRunning) {
    status = `running, ${steps} so far`;
  } else if (m.stepCount === 0) {
    status = "assembled, not started";
  } else {
    status = `paused after ${steps}`;
  }
  return edited
    ? `${status}. The source was edited after the last assemble, so the machine state belongs to the version that was assembled`
    : status;
}

function disassemblyWindow(m: DiagnosticMachine): string[] {
  // Inside a library call the pc is a stub the listing does not hold; the
  // `bl` that made the call is the student's instruction.
  const at = m.externalCall?.callSitePc ?? m.pc;
  const i = m.instructions.findIndex((ins) => ins.address === at);
  if (i < 0) {
    return [`the pc (${formatWord64(m.pc)}) is outside the program's own instructions, as it is once main has returned`];
  }
  const rows = m.instructions
    .slice(Math.max(0, i - WINDOW), i + WINDOW + 1)
    .map(
      (ins) =>
        `${ins.address === at ? "=>" : "  "} ${formatWord32(ins.address)}  ${ins.hex.replace(/^0x/, "")}  ${ins.text.trim()}`,
    );
  if (m.externalCall) rows.unshift(`(the pc is inside ${m.externalCall.name}, called by the marked instruction)`);
  return rows;
}

/** A register's "0x..." text as a number; NaN when it does not parse. */
function toNumber(hex: string | undefined): number {
  try {
    return Number(BigInt(hex ?? ""));
  } catch {
    return NaN;
  }
}

/** The little-endian 8-byte word at `offset`, or null past the bytes read. */
function wordAt(bytes: Uint8Array, offset: number): bigint | null {
  if (offset < 0 || offset + 8 > bytes.length) return null;
  let value = 0n;
  for (let i = 7; i >= 0; i--) value = (value << 8n) | BigInt(bytes[offset + i]);
  return value;
}

async function stackRows(m: DiagnosticMachine, slots: StackSlot[]): Promise<string[]> {
  const band = m.memoryRegions.find((r) => r.name === "stack");
  if (!band) return ["the stack's place in memory is unknown to this emulator build"];
  const sp = toNumber(m.sp);
  if (!(sp >= band.start && sp <= band.end)) {
    return [`sp (${m.sp}) is outside the stack, which runs from ${formatWord32(band.start)} to ${formatWord32(band.end)}`];
  }
  if (sp === band.end) return ["the stack is empty: sp is at its top"];
  const end = Math.min(band.end, sp + STACK_CAP);
  let bytes: Uint8Array;
  try {
    bytes = await m.readMemory(sp, end - sp);
  } catch {
    return ["the stack could not be read"];
  }
  // Walk the frame records: each holds the caller's fp at [fp] and the
  // return address at [fp, 8], and the callers' records sit higher up.
  const fp = toNumber(m.registers[29]);
  const frames: number[] = [];
  for (let at = fp; frames.length < 32 && at >= sp && at + 16 <= end && (at - sp) % 8 === 0; ) {
    frames.push(at);
    const next = Number(wordAt(bytes, at - sp) ?? 0n);
    if (!(next > at)) break;
    at = next;
  }
  const records = new Map<number, string>();
  frames.forEach((at, n) => {
    records.set(at, `frame ${n} record: saved x29, the caller's fp`);
    records.set(at + 8, `frame ${n} record: saved x30, the return address`);
  });
  // Only the current frame's slots can be named: the names come from the
  // `name = offset` lines, which say nothing about which function owns them.
  const frameTop = frames[1] ?? end;
  const rows: string[] = [];
  if (sp % 16 !== 0) {
    rows.push("sp is not a multiple of 16: on the real machine a load or store through sp, or a library call, faults");
  }
  for (let a = sp; a + 8 <= end; a += 8) {
    const tags: string[] = [];
    if (a === sp) tags.push("sp");
    if (a === fp) tags.push("fp");
    const record = records.get(a);
    if (record) tags.push(record);
    else if (frames.length > 0 && a > fp && a < frameTop) {
      const name = labelForOffset(slots, a - fp);
      tags.push(name ? `[fp, ${a - fp}] ${name}` : `[fp, ${a - fp}]`);
    }
    const value = wordAt(bytes, a - sp);
    const text = value == null ? "(not read)" : formatWord64(value);
    rows.push(`${formatWord32(a)}  ${text}${tags.length > 0 ? `  ${tags.join(", ")}` : ""}`);
  }
  if (end < band.end) {
    rows.push(`(capped at ${STACK_CAP} bytes; the stack goes on up to ${formatWord32(band.end)})`);
  }
  return rows;
}

/** Where each label in the source landed, for naming the data rows. */
async function labelAddresses(
  m: DiagnosticMachine,
  source: string,
): Promise<Array<{ name: string; address: number }>> {
  const names = new Set<string>();
  for (const match of source.matchAll(/^[ \t]*([A-Za-z_.$][\w.$]*):/gm)) names.add(match[1]);
  const found = await Promise.all(
    [...names].slice(0, 200).map(async (name) => {
      try {
        const address = await m.resolveLabel(name);
        return address == null ? null : { name, address };
      } catch {
        return null;
      }
    }),
  );
  return found.filter((l): l is { name: string; address: number } => l !== null);
}

async function sectionDumps(m: DiagnosticMachine, source: string): Promise<MemoryDump[]> {
  const bands = [".data", ".bss"].flatMap((name) => m.memoryRegions.filter((r) => r.name === name));
  if (bands.length === 0) return [];
  const labels = await labelAddresses(m, source);
  const dumps: MemoryDump[] = [];
  for (const band of bands) {
    let bytes: Uint8Array;
    try {
      bytes = await m.readMemory(band.start, SECTION_SCAN);
    } catch {
      dumps.push({ name: band.name, lines: ["could not be read"] });
      continue;
    }
    // The band is a fixed 1 MiB window, not the section's size, so the dump
    // ends at the last non-zero byte.
    let used = bytes.length;
    while (used > 0 && bytes[used - 1] === 0) used--;
    if (used === 0) {
      dumps.push({ name: band.name, lines: [`every byte of the first ${SECTION_SCAN} is zero`] });
      continue;
    }
    const shown = Math.min(Math.ceil(used / 16) * 16, SECTION_CAP);
    const lines: string[] = [];
    for (let off = 0; off < shown; off += 16) {
      const row = band.start + off;
      const hex = Array.from(bytes.subarray(off, off + 16), formatByte).join(" ");
      const here = labels
        .filter((l) => l.address >= row && l.address < row + 16)
        .map((l) => (l.address === row ? l.name : `${l.name} at +${l.address - row}`));
      lines.push(`${formatWord32(row)}  ${hex}${here.length > 0 ? `  (${here.join(", ")})` : ""}`);
    }
    lines.push(
      used > SECTION_CAP
        ? `(capped at ${SECTION_CAP} bytes; non-zero bytes go on to offset ${used})`
        : `(every later byte of the first ${SECTION_SCAN} is zero)`,
    );
    dumps.push({ name: band.name, lines });
  }
  return dumps;
}

async function virtualFiles(m: DiagnosticMachine): Promise<SourceFile[] | undefined> {
  if (m.vfsFiles.length === 0) return undefined;
  return Promise.all(
    m.vfsFiles.map(async (name, i) => {
      if (i >= VFS_FILES_CAP) {
        return { name, body: `(left out: the report carries the first ${VFS_FILES_CAP} files)` };
      }
      try {
        return { name, body: fileText(await m.readVfsFile(name)) };
      } catch {
        return { name, body: "(could not be read)" };
      }
    }),
  );
}

function fileText(data: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    return `(binary, ${data.length} bytes)`;
  }
  if (text.includes("\0")) return `(binary, ${data.length} bytes)`;
  if (text.length <= VFS_TEXT_CAP) return text;
  return `${text.slice(0, VFS_TEXT_CAP)}\n[cut: the file has ${text.length} characters]`;
}

const BROWSERS: Array<[RegExp, string]> = [
  [/Edg(?:e|A|iOS)?\/(\d+)/, "Edge"],
  [/OPR\/(\d+)/, "Opera"],
  [/(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
  [/(?:Chrome|CriOS)\/(\d+)/, "Chrome"],
  [/Version\/(\d+).*Safari\//, "Safari"],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/CrOS/, "ChromeOS"],
  [/Windows/, "Windows"],
  [/Macintosh|Mac OS X/, "macOS"],
  [/Linux/, "Linux"],
];

/** The browser's name, major version, and system, and nothing else a user
 *  agent string carries. */
export function browserFamily(userAgent: string): string {
  let browser = "an unknown browser";
  for (const [pattern, name] of BROWSERS) {
    const match = pattern.exec(userAgent);
    if (match) {
      browser = `${name} ${match[1]}`;
      break;
    }
  }
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  return system ? `${browser} on ${system}` : browser;
}
