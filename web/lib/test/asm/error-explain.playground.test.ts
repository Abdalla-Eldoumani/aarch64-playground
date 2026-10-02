// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { explainError } from "@/lib/asm/error-explain";

// The explainer matches on the emulator's wording, so its inputs here come
// from the emulator itself: each broken program runs on the real node build
// and the message it stops with is what the explainer must recognize. A
// reworded Rust message then fails this suite instead of slipping past a
// copied string.
const nodeRequire = createRequire(import.meta.url);
const wasmNodePath = path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js");
const { Emulator } = nodeRequire(wasmNodePath) as typeof import("@/lib/wasm-node/aarch64_emulator");

/** The message a student sees: the assembler's, or the run's stop reason. */
function messageFor(source: string, args: string[] = []): string {
  const emu = new Emulator();
  const asm = emu.assemble_and_load_with_args(source, args) as { error?: string | null };
  if (asm.error) return asm.error;
  const run = emu.run_until_break(1_000_000) as { error?: string | null };
  if (!run.error) throw new Error(`program ran clean:\n${source}`);
  return run.error;
}

function explained(source: string, args: string[] = []) {
  const message = messageFor(source, args);
  const e = explainError(message);
  expect(e, message).not.toBeNull();
  return e!;
}

const HEAD = [
  "        .text",
  "        .global main",
  "main:   stp     x29, x30, [sp, -16]!",
  "        mov     x29, sp",
  "",
].join("\n");
const TAIL = ["        mov     w0, 0", "        ldp     x29, x30, [sp], 16", "        ret", ""].join("\n");
const withBody = (body: string, after = "") => `${HEAD}${body}\n${TAIL}${after}`;

// The same programs the emulator's own parity test runs, each beside what
// gcc and the program printed for it on the course server.
const PARITY_DIR = path.join(process.cwd(), "../emulator/tests/error-parity");

/** The line the server printed that the playground's message must open with. */
function serverKey(transcript: string): string {
  const lines = transcript.replace(/\r\n/g, "\n").split("\n");
  const runAt = lines.indexOf("$ ./program");
  if (runAt < 0) {
    for (const line of lines) {
      const asmError = line.split(": Error: ");
      if (asmError.length === 2) return asmError[1];
      const at = line.indexOf("undefined reference to ");
      if (at >= 0) return line.slice(at);
    }
    throw new Error(`no diagnostic in:\n${transcript}`);
  }
  // The shell's report sits just above the final "[exit N]" line.
  const body = lines.slice(runAt + 1).filter((line) => line !== "");
  return body[body.length - 2].replace(/ \(core dumped\)$/, "");
}

describe("error guidance for the programs the course server rejects", () => {
  const cases = fs
    .readdirSync(PARITY_DIR)
    .filter((name) => name.endsWith(".s"))
    .map((name) => name.slice(0, -2));

  it("finds every recorded case", () => {
    expect(cases.length).toBeGreaterThanOrEqual(11);
  });

  // These carry all their guidance in the message's own second line, which
  // is what the editor shows when the explainer adds nothing.
  const MESSAGE_ONLY = [
    "duplicate-label",
    "missing-ldr-fmt",
    "local-label-no-backward",
    "local-label-no-forward",
    "movi-range",
    "fcmp-immediate",
  ];

  it.each(cases)("%s opens with the server's line and gets guidance", (name) => {
    const source = fs.readFileSync(path.join(PARITY_DIR, `${name}.s`), "utf8");
    const transcript = fs.readFileSync(path.join(PARITY_DIR, `${name}.server.txt`), "utf8");
    const message = messageFor(source);
    const [first, guidance] = message.split("\n");
    expect(first).toBe(serverKey(transcript));
    if (MESSAGE_ONLY.includes(name)) {
      expect(explainError(message)).toBeNull();
      expect(guidance?.trim(), message).toBeTruthy();
    } else {
      expect(explainError(message), message).not.toBeNull();
    }
  });

  it("explains a main that is not global and keeps the student on main", () => {
    const source = fs.readFileSync(path.join(PARITY_DIR, "main-not-global.s"), "utf8");
    const e = explained(source);
    expect(e.why).toContain(".global");
    // A source that defines its own _start links here but not on the servers,
    // where the startup file already has one.
    expect(e.fix).toContain("multiple definition of '_start'");
  });
});

describe("error guidance for the messages the emulator really sends", () => {
  it("explains falling off the end as a missing ret", () => {
    const e = explained("        .text\n        .global main\nmain:   mov     x0, 1\n");
    expect(e.fix).toContain("ret");
    expect(e.fix.toLowerCase()).toContain("epilogue");
  });

  it("explains a jump into data without inventing causes", () => {
    const e = explained(
      withBody("        ldr     x0, =blob\n        br      x0", "        .data\nblob:   .word 0x00600000\n"),
    );
    expect(e.what.toLowerCase()).toContain("decoder");
    // Jumping into data never overwrites the program's own code.
    expect(e.why.toLowerCase()).not.toContain("junk over");
    expect(e.why.toLowerCase()).toContain("data");
  });

  it("names the read in a memory fault", () => {
    const e = explained(withBody("        mov     x1, 0x100000000\n        ldr     x0, [x1]"));
    expect(e.what.toLowerCase()).toContain("read");
    expect(e.styleSection).toBe("addressing modes");
  });

  it("explains a null-page write through the base register", () => {
    const e = explained(withBody("        mov     x1, 0\n        str     x0, [x1]"));
    expect(e.fix).toContain("ldr xN, =label");
  });

  it("recognizes both register-file messages", () => {
    expect(explained(withBody("        mov     x32, 1")).styleSection).toBe("naming conventions");
    expect(explained(withBody("        fmov    d99, 1.0")).styleSection).toBe("naming conventions");
  });

  it("offers the nearest supported mnemonics for a misspelled one", () => {
    expect(explained(withBody("        mvo     w0, 0")).fix).toBe("did you mean `mov` or `mvn`?");
  });

  it("explains the sp-alignment fault without repeating the message's fix", () => {
    const e = explained(withBody("        sub     sp, sp, 8\n        str     x0, [sp]\n        add     sp, sp, 8"));
    // The message already says how to round the frame; the fix only points
    // at the line to change.
    expect(e.fix).toContain("moved sp");
    expect(e.fix).not.toContain("alloc");
    expect(e.fix.toLowerCase()).not.toContain("round");
  });

  it("explains a stack overflow via the recursion base case first", () => {
    // A 4 KiB frame per call reaches the 8 MiB limit in about 2,000 calls.
    const e = explained("        .text\n        .global main\nmain:   sub     sp, sp, 4096\n        bl      main\n");
    expect(e.fix.toLowerCase()).toContain("base case");
  });

  it("recognizes argv overflow", () => {
    expect(explained(withBody(""), ["x".repeat(5000)]).styleSection).toBe("C library and system calls");
  });

  it("recognizes an undefined name in an immediate, and warns about -lm for the math names", () => {
    const e = explained(withBody("        mov     x0, score_1_r + 1"));
    expect(e.styleSection).toBe("naming conventions");
    expect(e.fix).toContain("-lm");
  });

  it("recognizes ld's undefined reference for an ldr =", () => {
    expect(explained(withBody("        ldr     x0, =fmtt")).styleSection).toBe("naming conventions");
  });

  it("recognizes an immediate too wide for one mov", () => {
    expect(explained(withBody("        mov     x0, 70000")).styleSection).toBe("literal pool");
  });

  it("recognizes an unbalanced bracket", () => {
    expect(explained(withBody("        ldr     x0, [sp, 8")).styleSection).toBe("addressing modes");
  });

  it("explains an unterminated string with the same-line rule and the escape fix", () => {
    const e = explained(withBody("", 'msg:    .string "abc\n'));
    expect(e.what).toContain("never closed");
    expect(e.why).toContain("cannot span lines");
    expect(e.fix).toContain("\\n");
  });

  it("points mixed S and D operands at fcvt and a same-width fcvt at fmov", () => {
    const mixed = explained(withBody("        fadd    s0, s1, d2"));
    expect(mixed.why).toContain("precision");
    expect(mixed.fix).toContain("fcvt");
    expect(explained(withBody("        fcvt    d0, d1")).fix).toContain("fmov");
  });

  it("explains an unencodable fmov immediate with the data-section fallback", () => {
    const e = explained(withBody("        fmov    d0, 0.1"));
    expect(e.styleSection).toBe("literal pool");
    expect(e.fix).toContain(".float");
  });

  it("tells an unsupported metadata section to be deleted", () => {
    const e = explained(withBody("", '        .section .note.GNU-stack,"",@progbits\n'));
    expect(e.fix.toLowerCase()).toContain("delete");
    expect(e.styleSection).toBe("section directives");
  });

  it("explains the escapes the lexer rejects", () => {
    expect(explained(withBody("", 'msg:    .string "C:\\dir"\n')).fix.toLowerCase()).toContain("backslash");
    explained(withBody("", 'msg:    .string "abc\\\n'));
  });

  it("explains a backslash with nothing after it, and names the one-letter define trap", () => {
    // The source ends right after the backslash, so it has nothing to escape.
    const e = explained(withBody("", 'msg:    .string "abc\\'));
    expect(e.fix).toContain("write two");
    expect(e.fix).toContain("one-letter name changes the letter after a backslash");
    expect(e.fix).toContain("define(n, w19)");
    expect(`${e.what} ${e.why} ${e.fix}`).not.toMatch(/windows|path|only the standard/i);
  });

  it("says mul takes registers only, without sending the student a line up", () => {
    const e = explained(withBody("        mul     x23, x19, 3"));
    expect(e.fix).toContain("`mul`");
    expect(e.fix).toContain("registers only");
    expect(e.fix).toContain("`mov x9, 3`");
    expect(e.fix).not.toContain("line above");
  });

  it("names the m4 traps: recursion, a backtick, and an unsupported macro", () => {
    const loop = explained(`define(one_r, two_r)\ndefine(two_r, one_r)\n${withBody("        mov     x0, one_r")}`);
    expect(loop.styleSection).toBe("m4 preprocessing");
    expect(loop.why).toContain("define(x29, x29)");
    expect(explained(withBody("        mov     x0, `one'")).fix).toContain("end of file in string");
    expect(explained(`ifelse(a, b, c, d)\n${withBody("")}`).styleSection).toBe("m4 preprocessing");
  });
});
