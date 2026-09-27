import { describe, expect, it } from "vitest";
import LZString from "lz-string";
import {
  browserFamily,
  bundleShareUrl,
  collectDiagnostic,
  decodeBundle,
  encodeBundle,
  type DiagnosticBundle,
  type DiagnosticMachine,
} from "@/lib/playground/diagnostic-bundle";
import {
  MAX_BUNDLE_DECOMPRESSED_BYTES,
  MAX_SHARE_HASH_BYTES,
  MAX_WORKSPACE_FILES,
} from "@/lib/playground/upload-guard";

const ZERO = "0x0000000000000000";

/** Every field a version 2 bundle carries. */
const full: DiagnosticBundle = {
  source: ".global main\nmain:\n    bl helper\n    ret\n",
  files: [{ name: "util.s", body: "helper:\n    mov x0, 5\n    ret\n" }],
  args: "one two",
  stdin: "42\n",
  stdout: "answer = 5\n",
  stderr: "",
  notes: ["Line 3 reads x9, but the printf call on line 2 overwrote it."],
  exitCode: 0,
  error: null,
  status: "finished after 9 steps with exit code 0",
  errorAt: { file: null, line: 3, text: "    ret" },
  pcAt: { file: "util.s", line: 2, text: "    mov x0, 5" },
  registers: Array.from({ length: 31 }, () => ZERO),
  fpRegisters: Array.from({ length: 32 }, () => ZERO),
  vectorRegisters: Array.from({ length: 32 }, () => `0x${"0".repeat(32)}`),
  sp: "0x000000007ffffff0",
  pc: "0x0000000000400008",
  nzcv: 6,
  disassembly: ["=> 0x00400008  d65f03c0  ret"],
  stack: ["0x7ffffff0  0x0000000000000000  sp"],
  memory: [{ name: ".data", lines: ["0x00600000  2a 00"] }],
  vfs: [{ name: "input.txt", body: "3 4\n" }],
  site: "2.7.0",
  emulator: "2.7.0",
  browser: "Chrome 140 on Windows",
};

/** Built by the version 1 encoder before version 2 existed: the link a
 *  student may still have in an old forum post. */
const V1_LINK =
  "N4IgbiBcCMA0ICMqgM4HsCuAnAxgUyhADMBbAF0gAJrKA6FMrASwDsBzSgHRBQxMoC8lAKQATTpxbdJNWXQQBDADZM2LSgBYZc6rTZK0ipZRILWk06yrUGABzkAPAEwBOWJQcBmAAzuA2ii27gC00ABsALoAhNo6JGhgjq7ugbFy8YmyDtBulJ5psgqioo457tm5Wuo6lEVY9jQOvpSkZAU0RSVZzU3ukAbQTpCt7dQZpeU5o5QIxnK2zCxkRNPjsgDuzd7TSqINjckePv6BEe7h01h4bSwg8ApYbCiEaCx4lGTraHc8ZKKYZEIvH4QgA7JIfngHEwyABhNCiAiQXwgK5sJgMPBYZ6QPwgbxNbxE4kk0k-Amkykk0HkwlUqm0+n0xlMyks1kk9kcolc7m8jn81mCpnC5nwCnc4mihniumS6Vs2WSqVK5XeBVk1WSmla+W6vn6gWGoXGkWmsX4uUGy1q9XmmU2qmgoguvBEPB2x30jTEn0gM48WyECWU50uogqkC2HDBq2kn1EzwaH4MBQ4ADWACEAJ5kPA4kAeyhFkveYtl0vlyhE6tlmv1uuN2vNhstputjvtrttnud3vdvuDgfD-ujhuQrBYNBYKAsDBKJQAX0XQA";

const craft = (payload: unknown) =>
  LZString.compressToEncodedURIComponent(JSON.stringify(payload));

describe("diagnostic bundle codec", () => {
  it("round-trips every version 2 field", () => {
    expect(decodeBundle(encodeBundle(full))).toEqual({ kind: "ok", bundle: full });
  });

  it("still decodes a version 1 link, dropping the stack bytes nothing reads", () => {
    const read = decodeBundle(V1_LINK);
    if (read.kind !== "ok") throw new Error(`expected ok, got ${read.kind}`);
    expect(read.bundle.source).toContain('fmt:    .string "sum = %d\\n"');
    expect(read.bundle.source).toContain("bl      printf");
    expect(read.bundle.args).toBe("one two");
    expect(read.bundle.stdout).toBe("sum = 7\n");
    expect(read.bundle.exitCode).toBe(0);
    expect(read.bundle.registers).toHaveLength(31);
    expect(read.bundle.registers?.[19]).toBe("0x0000000000000007");
    expect(read.bundle.pc).toBe("0x0000000000400034");
    expect(read.bundle).not.toHaveProperty("stackBytes");
  });

  it("reports none for a missing value and corrupt for one that is not a bundle", () => {
    expect(decodeBundle(null)).toEqual({ kind: "none" });
    expect(decodeBundle("")).toEqual({ kind: "none" });
    expect(decodeBundle("not-a-real-payload")).toEqual({ kind: "corrupt" });
  });

  it("rejects a field of the wrong type in either version", () => {
    for (const v of [1, 2]) {
      expect(decodeBundle(craft({ v, b: { source: "ret", args: { toString: "x" } } }))).toEqual({
        kind: "corrupt",
      });
      expect(decodeBundle(craft({ v, b: { source: "ret", notes: ["fine", 7] } }))).toEqual({
        kind: "corrupt",
      });
      expect(decodeBundle(craft({ v, b: { source: "ret", registers: ["0x1", 42] } }))).toEqual({
        kind: "corrupt",
      });
    }
    expect(decodeBundle(craft({ v: 2, b: { source: "ret", pcAt: { file: 3, line: 1, text: "" } } }))).toEqual({
      kind: "corrupt",
    });
    expect(decodeBundle(craft({ v: 2, b: { source: "ret", memory: [{ name: ".data", lines: "x" }] } }))).toEqual({
      kind: "corrupt",
    });
  });

  it("drops fields it does not know", () => {
    const read = decodeBundle(craft({ v: 2, b: { source: "ret", script: "<script>" } }));
    expect(read).toEqual({ kind: "ok", bundle: { source: "ret" } });
  });

  it("refuses helper names that could write lines into the program", () => {
    for (const name of ["bad\nname.s", " util.s", "main.asm", ""]) {
      const read = decodeBundle(craft({ v: 2, b: { source: "ret", files: [{ name, body: "" }] } }));
      expect(read, name).toEqual({ kind: "corrupt" });
    }
    const twice = [
      { name: "a.s", body: "" },
      { name: "a.s", body: "" },
    ];
    expect(decodeBundle(craft({ v: 2, b: { source: "ret", files: twice } }))).toEqual({ kind: "corrupt" });
    const many = Array.from({ length: MAX_WORKSPACE_FILES + 1 }, (_, i) => ({ name: `f${i}.s`, body: "" }));
    expect(decodeBundle(craft({ v: 2, b: { source: "ret", files: many } }))).toEqual({ kind: "corrupt" });
  });

  it("rejects an unknown version", () => {
    expect(decodeBundle(craft({ v: 99, b: { source: "ret" } }))).toEqual({ kind: "corrupt" });
  });

  it("rejects an oversized decompressed payload", () => {
    const huge = "x".repeat(MAX_BUNDLE_DECOMPRESSED_BYTES + 1);
    expect(decodeBundle(craft({ v: 2, b: { source: huge } }))).toEqual({ kind: "too-large" });
  });

  it("holds the raw link cap at exactly its limit", () => {
    // At the cap the value still reaches the decoder (and fails there as
    // garbage); one character past it is refused before lz-string runs.
    expect(decodeBundle("A".repeat(MAX_SHARE_HASH_BYTES)).kind).toBe("corrupt");
    expect(decodeBundle("A".repeat(MAX_SHARE_HASH_BYTES + 1))).toEqual({ kind: "too-large" });
  });

  it("accepts an empty source", () => {
    expect(decodeBundle(encodeBundle({ source: "" }))).toEqual({ kind: "ok", bundle: { source: "" } });
  });
});

/** Hex no compressor can shrink, to push a bundle past the link cap. */
function noise(rows: number): string[] {
  let seed = 7;
  return Array.from({ length: rows }, () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed.toString(16).padStart(8, "0") + (seed * 7).toString(16);
  });
}

describe("diagnostic bundle share url", () => {
  it("carries the whole bundle when it fits, so the link round-trips", () => {
    const url = bundleShareUrl("https://example.com/playground", full);
    if (url === null) throw new Error("expected a link");
    expect(url.startsWith("https://example.com/playground?bundle=")).toBe(true);
    expect(decodeBundle(url.slice(url.indexOf("?bundle=") + 8))).toEqual({ kind: "ok", bundle: full });
  });

  it("falls back to the program and its input when the machine state is past the cap", () => {
    const heavy = { ...full, stack: noise(2000) };
    expect(encodeBundle(heavy).length).toBeGreaterThan(MAX_SHARE_HASH_BYTES);
    const url = bundleShareUrl("https://example.com/playground", heavy);
    if (url === null) throw new Error("expected a link");
    const value = url.slice(url.indexOf("?bundle=") + 8);
    expect(value.length).toBeLessThanOrEqual(MAX_SHARE_HASH_BYTES);
    expect(decodeBundle(value)).toEqual({
      kind: "ok",
      bundle: { source: full.source, files: full.files, args: full.args, stdin: full.stdin },
    });
  });

  it("gives no link when even the program is past the cap", () => {
    expect(bundleShareUrl("https://example.com/p", { source: noise(3000).join("\n") })).toBeNull();
  });
});

describe("browserFamily", () => {
  it("keeps the browser, its major version, and the system, and nothing else", () => {
    const cases: Array<[string, string]> = [
      [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.80 Safari/537.36",
        "Chrome 140 on Windows",
      ],
      [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.3485.54",
        "Edge 140 on Windows",
      ],
      ["Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0", "Firefox 131 on Linux"],
      [
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        "Safari 18 on iOS",
      ],
      [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
        "Safari 17 on macOS",
      ],
      [
        "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
        "Chrome 139 on Android",
      ],
      ["curl/8.4.0", "an unknown browser"],
    ];
    for (const [ua, family] of cases) expect(browserFamily(ua)).toBe(family);
  });
});

const REGIONS = [
  { name: ".text", start: 0x400000, end: 0x500000 },
  { name: ".data", start: 0x600000, end: 0x700000 },
  { name: ".bss", start: 0x700000, end: 0x800000 },
  { name: "stack", start: 0x7f800000, end: 0x80000000 },
];

function word64(value: number): number[] {
  const bytes: number[] = [];
  let v = BigInt(value);
  for (let i = 0; i < 8; i++) {
    bytes.push(Number(v & 0xffn));
    v >>= 8n;
  }
  return bytes;
}

/** A machine paused inside a helper called from main: two frame records on
 *  the stack, a string and a word in .data, an empty .bss. */
function pausedMachine(overrides: Partial<DiagnosticMachine> = {}): DiagnosticMachine {
  const memory = new Map<number, number>();
  const poke = (addr: number, bytes: number[]) => bytes.forEach((b, i) => memory.set(addr + i, b));
  // main's record at 0x7fffffe0 (its caller's fp is 0), the helper's below it.
  poke(0x7fffffd0, [...word64(0x7fffffe0), ...word64(0x400010)]);
  poke(0x7fffffe0, [...word64(0), ...word64(0x400200)]);
  poke(0x7fffffd8 + 8 + 16, word64(99));
  poke(0x600000, [0x68, 0x69, 0]);
  poke(0x600008, [42]);
  const registers = Array.from({ length: 31 }, () => ZERO);
  registers[0] = "0x000000000000002a";
  registers[29] = "0x000000007fffffd0";
  const instructions = Array.from({ length: 12 }, (_, i) => ({
    address: 0x400000 + i * 4,
    hex: `0x${(0xd2800000 + i).toString(16)}`,
    text: `    mov x${i}, ${i}`,
  }));
  return {
    registers,
    fpRegisters: Array.from({ length: 32 }, (_, i) => (i === 1 ? "0x3ff8000000000000" : ZERO)),
    vectorRegisters: Array.from({ length: 32 }, () => `0x${"0".repeat(32)}`),
    sp: "0x000000007fffffd0",
    pc: 0x400014,
    nzcv: 0b0110,
    stdout: "hi\n",
    stderr: "",
    notes: [],
    exitCode: null,
    error: null,
    assemblyErrors: [],
    currentLine: 6,
    externalCall: null,
    instructions,
    memoryRegions: REGIONS,
    vfsFiles: ["input.txt", "blob.bin"],
    programLoaded: true,
    isHalted: false,
    isRunning: false,
    blocked: false,
    stepCount: 5,
    stdinGiven: () => "3 4\n",
    readMemory: async (addr, len) => Uint8Array.from({ length: len }, (_, i) => memory.get(addr + i) ?? 0),
    readVfsFile: async (name) =>
      name === "input.txt" ? new TextEncoder().encode("3 4\n") : Uint8Array.from([0, 159, 146, 150]),
    resolveLabel: async (name) => ({ msg: 0x600000, n: 0x600008, main: 0x400000 })[name] ?? null,
    ...overrides,
  };
}

const MAIN = ".data\nmsg: .string \"hi\"\nn: .dword 42\n.text\n.global main\nmain:\n    bl helper\n    ret\n";
const WORKSPACE = {
  main: MAIN,
  extras: [{ name: "util.s", body: "helper:\n    mov x0, 42\n    ret\n" }],
};

function collect(machine: DiagnosticMachine, workspace = WORKSPACE) {
  return collectDiagnostic({
    machine,
    workspace,
    assembled: workspace,
    args: "one two",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  });
}

describe("collectDiagnostic", () => {
  it("carries every file, the input, the output, and the versions", async () => {
    const bundle = await collect(pausedMachine());
    expect(bundle.source).toBe(MAIN);
    expect(bundle.files).toEqual(WORKSPACE.extras);
    expect(bundle.args).toBe("one two");
    expect(bundle.stdin).toBe("3 4\n");
    expect(bundle.stdout).toBe("hi\n");
    expect(bundle.stderr).toBeUndefined();
    expect(bundle.status).toBe("paused after 5 steps");
    expect(bundle.site).toMatch(/^\d+\.\d+\.\d+$/);
    expect(bundle.emulator).toMatch(/^\d+\.\d+\.\d+$/);
    expect(bundle.browser).toBe("Chrome 140 on Windows");
  });

  it("names the line the pc is on in its own file, with the instructions around it", async () => {
    const bundle = await collect(pausedMachine());
    // Combined line 6 is main's `main:` label: main.asm has 9 lines (the
    // trailing newline counts), so util.s starts at combined line 11.
    expect(bundle.pcAt).toEqual({ file: null, line: 6, text: "main:" });
    const inHelper = await collect(pausedMachine({ currentLine: 12 }));
    expect(inHelper.pcAt).toEqual({ file: "util.s", line: 2, text: "    mov x0, 42" });
    expect(bundle.pc).toBe("0x0000000000400014");
    expect(bundle.disassembly).toHaveLength(9);
    expect(bundle.disassembly?.[4]).toBe("=> 0x00400014  d2800005  mov x5, 5");
    expect(bundle.disassembly?.filter((row) => row.startsWith("=>"))).toHaveLength(1);
  });

  it("labels the frame records on the stack and stops at its top", async () => {
    const { stack } = await collect(pausedMachine());
    expect(stack).toEqual([
      "0x7fffffd0  0x000000007fffffe0  sp, fp, frame 0 record: saved x29, the caller's fp",
      "0x7fffffd8  0x0000000000400010  frame 0 record: saved x30, the return address",
      "0x7fffffe0  0x0000000000000000  frame 1 record: saved x29, the caller's fp",
      "0x7fffffe8  0x0000000000400200  frame 1 record: saved x30, the return address",
      "0x7ffffff0  0x0000000000000063",
      "0x7ffffff8  0x0000000000000000",
    ]);
  });

  it("caps the stack and says so, and flags an sp that is not 16-byte aligned", async () => {
    const { stack } = await collect(pausedMachine({ sp: "0x000000007ffff008" }));
    expect(stack?.[0]).toMatch(/^sp is not a multiple of 16/);
    expect(stack).toHaveLength(1 + 512 / 8 + 1);
    expect(stack?.at(-1)).toBe("(capped at 512 bytes; the stack goes on up to 0x80000000)");
  });

  it("dumps .data up to its last non-zero byte with its labels, and says .bss is zero", async () => {
    const { memory } = await collect(pausedMachine());
    expect(memory).toEqual([
      {
        name: ".data",
        lines: [
          "0x00600000  68 69 00 00 00 00 00 00 2a 00 00 00 00 00 00 00  (msg, n at +8)",
          "(every later byte of the first 4096 is zero)",
        ],
      },
      { name: ".bss", lines: ["every byte of the first 4096 is zero"] },
    ]);
  });

  it("caps a long .data section at 256 bytes and says how far it goes", async () => {
    const busy = pausedMachine({
      readMemory: async (addr, len) =>
        Uint8Array.from({ length: len }, (_, i) => (addr === 0x600000 && i < 300 ? 1 : 0)),
    });
    const { memory } = await collect(busy);
    const data = memory?.find((d) => d.name === ".data");
    expect(data?.lines).toHaveLength(256 / 16 + 1);
    expect(data?.lines.at(-1)).toBe("(capped at 256 bytes; non-zero bytes go on to offset 300)");
  });

  it("keeps the virtual files, text as text and binary as a size", async () => {
    const { vfs } = await collect(pausedMachine());
    expect(vfs).toEqual([
      { name: "input.txt", body: "3 4\n" },
      { name: "blob.bin", body: "(binary, 4 bytes)" },
    ]);
  });

  it("keeps the end of a long output and says the start was cut", async () => {
    const { stdout } = await collect(pausedMachine({ stdout: `${"a".repeat(20_000)}END` }));
    expect(stdout?.startsWith("[output cut: only its last 16000 characters are included]\n")).toBe(true);
    expect(stdout?.endsWith("END")).toBe(true);
  });

  it("points an assemble error at its file and line, with no machine state", async () => {
    const failed = pausedMachine({
      programLoaded: false,
      error: "unknown instruction: mvo",
      assemblyErrors: [{ line: 12, message: "unknown instruction: mvo" }],
    });
    const bundle = await collect(failed);
    expect(bundle.status).toBe("not running: the program did not assemble or link");
    expect(bundle.error).toBe("unknown instruction: mvo");
    expect(bundle.errorAt).toEqual({ file: "util.s", line: 2, text: "    mov x0, 42" });
    expect(bundle.registers).toBeUndefined();
    expect(bundle.stack).toBeUndefined();
  });

  it("says when the source on screen is not what was assembled", async () => {
    const bundle = await collectDiagnostic({
      machine: pausedMachine(),
      workspace: { main: `${MAIN}// edited\n`, extras: WORKSPACE.extras },
      assembled: WORKSPACE,
      args: "",
      userAgent: "",
    });
    expect(bundle.status).toMatch(/^paused after 5 steps\. The source was edited after the last assemble/);
    expect(bundle.source).toBe(`${MAIN}// edited\n`);
  });

  it("describes a finished run and a run waiting on input", async () => {
    const done = await collect(pausedMachine({ isHalted: true, exitCode: 3, stepCount: 1 }));
    expect(done.status).toBe("finished after 1 step with exit code 3");
    const waiting = await collect(pausedMachine({ blocked: true }));
    expect(waiting.status).toBe("waiting for input after 5 steps");
  });

  it("leaves a line saying so when the machine cannot be read", async () => {
    const broken = pausedMachine({
      readMemory: async () => {
        throw new Error("worker gone");
      },
      readVfsFile: async () => {
        throw new Error("worker gone");
      },
    });
    const bundle = await collect(broken);
    expect(bundle.stack).toEqual(["the stack could not be read"]);
    expect(bundle.memory?.map((d) => d.lines)).toEqual([["could not be read"], ["could not be read"]]);
    expect(bundle.vfs?.[0].body).toBe("(could not be read)");
  });
});

// The page-level half (cookies, storage, the address bar) runs against the
// dialog in components/test/playground/DiagnosticBundle.test.tsx.
describe("what a bundle may hold", () => {
  it("keeps only playground fields and none of the raw user agent", async () => {
    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/140.0.0.0 Safari/537.36 Tool/1.0 (C:\\Users\\student\\profile)";
    const bundle = await collectDiagnostic({
      machine: pausedMachine(),
      workspace: WORKSPACE,
      assembled: WORKSPACE,
      args: "",
      userAgent,
    });
    const text = JSON.stringify(bundle);
    for (const leak of ["Users", "student", "profile", "Mozilla", "AppleWebKit", "Tool/1.0"]) {
      expect(text, leak).not.toContain(leak);
    }
    expect(bundle.browser).toBe("Chrome 140 on Windows");
    expect(Object.keys(bundle).sort()).toEqual(
      [
        "args", "browser", "disassembly", "emulator", "error", "errorAt", "exitCode", "files",
        "fpRegisters", "memory", "notes", "nzcv", "pc", "pcAt", "registers", "site", "source",
        "sp", "stack", "status", "stderr", "stdin", "stdout", "vectorRegisters", "vfs",
      ].sort(),
    );
  });
});
