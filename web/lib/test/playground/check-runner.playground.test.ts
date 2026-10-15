import path from "node:path";
import { createRequire } from "node:module";
import { afterAll, describe, expect, it, vi } from "vitest";
import { EmulatorInstance } from "@/lib/emulator/emulator";
import { runChecks } from "@/lib/playground/check-runner";
import { gradeCheck, type ProgramCheck } from "@/lib/playground/program-checks";

// The playground's checks on the real emulator: the workspace assembles once
// as a gate (an error names the file and line), and each check runs from a
// fresh load with its own argv and stdin, its end of input closed as
// `./program < input` gives on the servers.

const nodeRequire = createRequire(import.meta.url);
const { Emulator } = nodeRequire(
  path.join(process.cwd(), "lib/wasm-node/aarch64_emulator.js"),
) as typeof import("@/lib/wasm-node/aarch64_emulator");

const emu = new Emulator();
const machine = new EmulatorInstance(emu);
afterAll(() => emu.free());

// The web build of the wasm cannot load under node, so the page's shared
// headless machine is this one.
vi.mock("@/lib/emulator/emulator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/emulator/emulator")>()),
  loadEmulator: async () => machine,
}));

// Reads one number and prints its double; exits with the number's low bits
// when argv[1] is present, so a check's args reach the program.
const DOUBLER = `        .data
in_fmt:     .string "%ld"
out_fmt:    .string "%ld\\n"
            .balign 8
n_m:        .dword 0
        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        mov     x19, x0
        ldr     x0, =in_fmt
        ldr     x1, =n_m
        bl      scanf
        ldr     x1, =n_m
        ldr     x1, [x1]
        add     x1, x1, x1
        ldr     x0, =out_fmt
        bl      printf
        mov     w0, 0
        cmp     x19, 1
        b.eq    done
        ldr     x1, =n_m
        ldr     w0, [x1]
done:
        ldp     x29, x30, [sp], 16
        ret
`;

// Reads one number, spins for several of the runner's slices, then prints it.
const SLOW_ECHO = `        .data
in_fmt:     .string "%ld"
out_fmt:    .string "%ld\\n"
            .balign 8
n_m:        .dword 0
        .text
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp
        ldr     x0, =in_fmt
        ldr     x1, =n_m
        bl      scanf
        ldr     x9, =400000
spin:   subs    x9, x9, 1
        b.ne    spin
        ldr     x1, =n_m
        ldr     x1, [x1]
        ldr     x0, =out_fmt
        bl      printf
        mov     w0, 0
        ldp     x29, x30, [sp], 16
        ret
`;

// Prints input.txt, or says it could not open it.
const CAT_INPUT = `        .text
fname:      .string "input.txt"
fmt_out:    .string "%s"
fmt_err:    .string "no input.txt\\n"
        .balign 4
        .global main
main:
        stp     x29, x30, [sp, -80]!
        mov     x29, sp
        mov     w0, -100
        ldr     x1, =fname
        mov     w2, 0
        mov     w3, 0
        mov     x8, 56
        svc     0
        cmp     w0, 0
        b.lt    error
        add     x1, x29, 16
        mov     x2, 63
        mov     x8, 63
        svc     0
        add     x9, x29, 16
        strb    wzr, [x9, x0]
        ldr     x0, =fmt_out
        add     x1, x29, 16
        bl      printf
        b       done
error:
        ldr     x0, =fmt_err
        bl      printf
done:
        mov     w0, 0
        ldp     x29, x30, [sp], 80
        ret
`;

function check(over: Partial<ProgramCheck>): ProgramCheck {
  return { name: "c", stdin: "", args: "", stdout: "", ...over };
}

describe("runChecks", () => {
  it("runs each check with its own input and argv", async () => {
    const checks = [
      check({ stdin: "21\n", stdout: "42\n", exitCode: 0 }),
      check({ stdin: "7\n", args: "x", stdout: "14\n", exitCode: 7 }),
      check({ stdin: "5\n", stdout: "11\n" }),
    ];
    const result = await runChecks({ main: DOUBLER, extras: [] }, checks, {});
    if (result.kind !== "ran") throw new Error(result.message);
    const verdicts = checks.map((c, i) => gradeCheck(c, result.outcomes[i]));
    expect(verdicts.map((v) => v.pass)).toEqual([true, true, false]);
    expect(verdicts[2].difference).toEqual({ line: 1, column: 1, expected: "11", actual: "10" });
  });

  it("reports an assemble error with its file and line, and runs nothing", async () => {
    const main = "        .text\n        .global main\nmain:\n        bl helper\n        ret\n";
    const extras = [{ name: "helper.asm", body: "helper:\n        movv x0, 1\n        ret\n" }];
    const result = await runChecks({ main, extras }, [check({})], {});
    expect(result.kind).toBe("assemble-error");
    if (result.kind === "assemble-error") expect(result.message).toMatch(/^helper\.asm line 2: /);
  });

  it("stops a program that never ends at the step budget", async () => {
    const loop = "        .text\n        .global main\nmain:\nspin:   b spin\n";
    const result = await runChecks({ main: loop, extras: [] }, [check({})], {});
    if (result.kind !== "ran") throw new Error(result.message);
    expect(gradeCheck(check({}), result.outcomes[0]).miss).toBe("step-limit");
  });

  it("reports a crash as a fault with the machine's message and its line", async () => {
    const crash =
      "        .text\n        .global main\nmain:\n        mov x0, 0\n        ldr x1, [x0]\n        ret\n";
    const result = await runChecks({ main: crash, extras: [] }, [check({})], {});
    if (result.kind !== "ran") throw new Error(result.message);
    const verdict = gradeCheck(check({}), result.outcomes[0]);
    expect(verdict.miss).toBe("fault");
    expect(verdict.error).toMatch(/^line 5: .*segmentation fault/i);
    expect(result.outcomes[0].errorLine).toBe(5);
  });

  it("names a crash in a helper file by that file and its own line", async () => {
    const main = "        .text\n        .global main\nmain:\n        bl helper\n        ret\n";
    const extras = [{ name: "helper.asm", body: "helper:\n        mov x0, 0\n        ldr x1, [x0]\n        ret\n" }];
    const result = await runChecks({ main, extras }, [check({})], {});
    if (result.kind !== "ran") throw new Error(result.message);
    expect(result.outcomes[0].error).toMatch(/^helper\.asm line 3: .*segmentation fault/i);
  });

  it("sees end of input on a read past the check's stdin", async () => {
    // scanf finds nothing, so n stays 0 and the program prints 0.
    const result = await runChecks({ main: DOUBLER, extras: [] }, [check({ stdout: "0\n" })], {});
    if (result.kind !== "ran") throw new Error(result.message);
    expect(gradeCheck(check({ stdout: "0\n" }), result.outcomes[0]).pass).toBe(true);
  });

  it("puts the staged files back for every check, as a normal run does", async () => {
    const files = { "input.txt": "Hello from a file!\n" };
    const result = await runChecks({ main: CAT_INPUT, extras: [] }, [check({}), check({})], files);
    if (result.kind !== "ran") throw new Error(result.message);
    expect(result.outcomes.map((o) => o.stdout)).toEqual(["Hello from a file!\n", "Hello from a file!\n"]);
  });

  it("queues a run started while another is going, so each gets its own output", async () => {
    const workspace = { main: SLOW_ECHO, extras: [] };
    const runs = await Promise.all([
      runChecks(workspace, [check({ stdin: "1\n" })], {}),
      runChecks(workspace, [check({ stdin: "2\n" })], {}),
    ]);
    expect(runs.map((r) => (r.kind === "ran" ? r.outcomes[0].stdout : r.message))).toEqual([
      "1\n",
      "2\n",
    ]);
  });
});
