// pins the wasm wrapper's defensive seam with a FAKE module in place of the
// build: 64-bit values arrive as BigInt and leave as padded hex strings or
// plain numbers, a step result's absent fields normalize to null/"advance"
// (exit code 0 stays 0, it is not "no exit code"), and every optional export
// is feature-detected: a wasm build without it degrades to an empty
// array/null/true instead of throwing. lib/test/emulator/wasm-contract.test.ts
// pins the real build's own behavior; this suite pins only the marshalling and
// the absence paths, which a shipped build cannot exercise.
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmulatorInstance } from "@/lib/emulator/emulator";

type Inner = ConstructorParameters<typeof EmulatorInstance>[0];

/** Only the exports the wrapper declares REQUIRED: an instance built from
 *  this alone is the oldest wasm build the web layer still has to survive. */
function baseInner() {
  return {
    assemble_and_load: () => ({ success: true, error: null, error_line: null, instruction_count: 0 }),
    assemble_and_load_with_args: () => ({
      success: true,
      error: null,
      error_line: null,
      instruction_count: 0,
    }),
    step: () => ({ pc: 0n, halted: false }),
    step_back: () => ({ pc: 0n, halted: false }),
    can_step_back: () => false,
    save_state: () => {},
    load_state: () => true,
    delete_state: () => true,
    list_states: () => [],
    run_until_break: () => ({ pc: 0n, halted: false, steps_executed: 0, hit_breakpoint: false }),
    reset: () => {},
    get_pc: () => 0n,
    get_register: () => 0n,
    get_sp: () => 0n,
    get_nzcv: () => 0,
    get_all_registers: () => ({ gpr: [], sp: "0x0", pc: "0x0", nzcv: 0 }),
    get_memory_range: () => new Uint8Array(0),
    get_changed_registers: () => new Uint8Array(0),
    set_breakpoint: () => {},
    clear_breakpoint: () => {},
    is_halted: () => false,
    code_base: () => 0x400000,
    get_line_map: () => new Uint32Array(0),
    take_stdout: () => "",
    take_stderr: () => "",
    push_stdin: () => {},
    is_blocked: () => false,
    get_exit_code: () => null,
    upload_vfs_file: () => {},
    list_vfs_files: () => [],
    read_vfs_file: () => new Uint8Array(0),
    delete_vfs_file: () => true,
    resolve_label: () => null,
    take_dirty_addrs: () => new Uint32Array(0),
    clear_console: () => {},
  };
}

function wrap(overrides: Record<string, unknown> = {}): EmulatorInstance {
  return new EmulatorInstance({ ...baseInner(), ...overrides } as unknown as Inner);
}

describe("EmulatorInstance register marshalling", () => {
  it("renders a 64-bit register as a zero-padded 16-digit hex string", () => {
    expect(wrap({ get_register: () => 0xdeadbeefn }).getRegister(0)).toBe(
      "0x00000000deadbeef",
    );
    expect(wrap({ get_register: () => 0n }).getRegister(3)).toBe(
      "0x0000000000000000",
    );
    // The all-ones word: no sign, no truncation, all sixteen digits.
    expect(wrap({ get_register: () => 0xffffffffffffffffn }).getRegister(1)).toBe(
      "0xffffffffffffffff",
    );
  });

  it("accepts a plain number where a BigInt was expected", () => {
    expect(wrap({ get_register: () => 5 as unknown as bigint }).getRegister(0)).toBe(
      "0x0000000000000005",
    );
  });

  it("renders sp the same way and forwards the requested index", () => {
    const asked: number[] = [];
    const emu = wrap({
      get_sp: () => 0x7ffffff000n,
      get_register: (i: number) => {
        asked.push(i);
        return 0n;
      },
    });
    expect(emu.getSp()).toBe("0x0000007ffffff000");
    emu.getRegister(30);
    expect(asked).toEqual([30]);
  });

  it("hands the pc back as a number, not a BigInt", () => {
    // 0x400008 = 4194304 + 8.
    expect(wrap({ get_pc: () => 0x400008n }).getPc()).toBe(4194312);
    expect(typeof wrap({ get_pc: () => 0x400008n }).getPc()).toBe("number");
  });

  it("passes nzcv and the whole-file snapshot through untouched", () => {
    const snapshot = { gpr: ["0x1"], sp: "0x2", pc: "0x3", nzcv: 4 };
    expect(wrap({ get_nzcv: () => 4 }).getNzcv()).toBe(4);
    expect(wrap({ get_all_registers: () => snapshot }).getAllRegisters()).toBe(snapshot);
  });

  it("turns the typed-array readbacks into plain arrays", () => {
    const emu = wrap({
      take_dirty_addrs: () => new Uint32Array([16, 20]),
      get_line_map: () => new Uint32Array([4194304, 3, 4194308, 4]),
    });
    expect(Array.isArray(emu.takeDirtyAddrs())).toBe(true);
    expect(emu.takeDirtyAddrs()).toEqual([16, 20]);
    expect(emu.getLineMap()).toEqual([4194304, 3, 4194308, 4]);
  });
});

describe("EmulatorInstance nullable numbers", () => {
  it("keeps exit code 0 as 0 and reports a missing one as null", () => {
    // A program that exits 0 is the common case; reading it as "no exit
    // code" would hide every clean exit.
    expect(wrap({ get_exit_code: () => 0n }).getExitCode()).toBe(0);
    expect(wrap({ get_exit_code: () => 42 }).getExitCode()).toBe(42);
    expect(wrap({ get_exit_code: () => null }).getExitCode()).toBeNull();
    expect(wrap({ get_exit_code: () => undefined }).getExitCode()).toBeNull();
  });

  it("resolves a label to a number and an unknown label to null", () => {
    // 0x420000 = 4194304 + 0x20000.
    expect(wrap({ resolve_label: () => 0x420000n }).resolveLabel("main")).toBe(4325376);
    expect(wrap({ resolve_label: () => 4 }).resolveLabel("main")).toBe(4);
    expect(wrap({ resolve_label: () => null }).resolveLabel("nope")).toBeNull();
    expect(wrap({ resolve_label: () => undefined }).resolveLabel("nope")).toBeNull();
  });
});

describe("EmulatorInstance step-result normalization", () => {
  it("fills in the fields a bare advance leaves out", () => {
    const result = wrap({ step: () => ({ pc: 0x400004n, halted: false }) }).step();
    expect(result).toEqual({
      pc: 4194308,
      halted: false,
      error: null,
      error_line: null,
      outcome: "advance",
      exitCode: null,
    });
  });

  it("carries a fault's message, line, outcome, and exit code across", () => {
    const result = wrap({
      step: () => ({
        pc: 0x40000cn,
        halted: true,
        error: "segmentation fault",
        error_line: 12,
        outcome: "error",
        exit_code: 139,
      }),
    }).step();
    expect(result).toEqual({
      pc: 4194316,
      halted: true,
      error: "segmentation fault",
      error_line: 12,
      outcome: "error",
      exitCode: 139,
    });
  });

  it("reads a clean exit as exit code 0, not as no exit", () => {
    const result = wrap({
      step: () => ({ pc: 0x400010n, halted: true, outcome: "exited", exit_code: 0n }),
    }).step();
    expect(result.outcome).toBe("exited");
    expect(result.exitCode).toBe(0);
  });

  it("normalizes a step back the same way", () => {
    const result = wrap({ step_back: () => ({ pc: 0x400000n, halted: false }) }).stepBack();
    expect(result).toEqual({
      pc: 4194304,
      halted: false,
      error: null,
      error_line: null,
      outcome: "advance",
      exitCode: null,
    });
  });

  it("normalizes a run result and forwards the step cap", () => {
    const caps: number[] = [];
    const emu = wrap({
      run_until_break: (max: number) => {
        caps.push(max);
        return { pc: 0x400010n, halted: false, steps_executed: 250, hit_breakpoint: true };
      },
    });
    expect(emu.runUntilBreak(250)).toEqual({
      pc: 4194320,
      halted: false,
      steps_executed: 250,
      hit_breakpoint: true,
      error: null,
      error_line: null,
      sleep_ms: null,
    });
    expect(caps).toEqual([250]);
  });

  it("carries a run's requested sleep across when the build reports one", () => {
    const emu = wrap({
      run_until_break: () => ({
        pc: 0x400010n,
        halted: false,
        steps_executed: 1,
        hit_breakpoint: false,
        sleep_ms: 100,
      }),
    });
    expect(emu.runUntilBreak(1).sleep_ms).toBe(100);
  });
});

describe("EmulatorInstance external-call context", () => {
  it("hides the feature when the build predates the export", () => {
    expect(wrap().hostCallContext()).toBeNull();
  });

  it("reports null when the pc is on one of the program's own instructions", () => {
    expect(wrap({ hostCallContext: () => null }).hostCallContext()).toBeNull();
    expect(wrap({ hostCallContext: () => undefined }).hostCallContext()).toBeNull();
  });

  it("renames the snake_case payload and numbers the call site", () => {
    // 0x400020 = 4194304 + 32.
    const call = wrap({
      hostCallContext: () => ({ name: "printf", call_site_pc: 0x400020n, call_site_line: 7 }),
    }).hostCallContext();
    expect(call).toEqual({ name: "printf", callSitePc: 4194336, callSiteLine: 7 });
  });

  it("accepts a payload with no line at all", () => {
    const call = wrap({
      hostCallContext: () => ({ name: "scanf", call_site_pc: 4194340 }),
    }).hostCallContext();
    expect(call).toEqual({ name: "scanf", callSitePc: 4194340, callSiteLine: null });
  });
});

describe("EmulatorInstance feature detection", () => {
  it("degrades every optional read on a build that has none of them", () => {
    const emu = wrap();
    expect(emu.getFpRegisters()).toEqual([]);
    expect(emu.getChangedFpRegisters()).toEqual(new Uint8Array(0));
    expect(emu.lintSource(".text")).toEqual([]);
    expect(emu.m4Expand(".text")).toBeNull();
    expect(emu.wantsTerminal()).toBe(false);
    // No mapping oracle means "assume mapped": the panel falls back to the
    // zero-fill read it did before the export existed.
    expect(emu.isRangeMapped(0x400000, 64)).toBe(true);
  });

  it("never throws on an optional command the build does not have", () => {
    const emu = wrap();
    expect(() => emu.closeStdin()).not.toThrow();
    expect(() => emu.setSnapshotsPaused(true)).not.toThrow();
    expect(() => emu.clearAllBreakpoints()).not.toThrow();
  });

  it("reads the optional surfaces when the build does have them", () => {
    const warnings = [{ line: 4, message: "no prologue" }];
    const expansion = { success: true, text: ".text\n" };
    const emu = wrap({
      get_fp_registers: () => ["0x3ff0000000000000"],
      get_changed_fp_registers: () => new Uint8Array([0]),
      lint_source: () => warnings,
      m4_expand: () => expansion,
      wants_terminal: () => true,
      is_range_mapped: () => false,
    });
    expect(emu.getFpRegisters()).toEqual(["0x3ff0000000000000"]);
    expect(emu.getChangedFpRegisters()).toEqual(new Uint8Array([0]));
    expect(emu.lintSource(".text")).toBe(warnings);
    expect(emu.m4Expand(".text")).toBe(expansion);
    expect(emu.wantsTerminal()).toBe(true);
    expect(emu.isRangeMapped(0, 4)).toBe(false);
  });

  it("calls an optional export on the wasm instance itself, with its argument", () => {
    // The probes read the export off the instance and then call it, so they
    // have to re-bind `this`: an unbound wasm-bindgen method throws on its
    // own pointer check.
    const receivers: unknown[] = [];
    const paused: boolean[] = [];
    const args: Array<[number, number]> = [];
    const inner = {
      ...baseInner(),
      close_stdin() {
        receivers.push(this);
      },
      set_snapshots_paused(p: boolean) {
        receivers.push(this);
        paused.push(p);
      },
      clear_all_breakpoints() {
        receivers.push(this);
      },
      is_range_mapped(addr: number, len: number) {
        args.push([addr, len]);
        return true;
      },
      lint_source(source: string) {
        return [{ line: source.length, message: "seen" }];
      },
    };
    const emu = new EmulatorInstance(inner as unknown as Inner);
    emu.closeStdin();
    emu.setSnapshotsPaused(true);
    emu.clearAllBreakpoints();
    emu.isRangeMapped(0x400000, 16);
    expect(receivers).toEqual([inner, inner, inner]);
    expect(paused).toEqual([true]);
    expect(args).toEqual([[4194304, 16]]);
    expect(emu.lintSource("abcd")).toEqual([{ line: 4, message: "seen" }]);
  });
});

// The module-level exports reach the wasm module itself, so these load the
// wrapper fresh against a fake one. resetModules also clears the cached
// module promise ensureWasmModule keeps.
async function loadWrapperWith(wasm: Record<string, unknown>) {
  vi.resetModules();
  vi.doMock("@/lib/wasm/aarch64_emulator", () => wasm);
  return import("@/lib/emulator/emulator");
}

afterEach(() => {
  vi.doUnmock("@/lib/wasm/aarch64_emulator");
  vi.resetModules();
});

describe("the module-level wasm surface", () => {
  it("initializes the module once and wraps a fresh Emulator per call", async () => {
    let inits = 0;
    let built = 0;
    const mod = await loadWrapperWith({
      default: async () => {
        inits += 1;
      },
      Emulator: class {
        constructor() {
          built += 1;
        }
        get_pc() {
          return 0x400000n;
        }
      },
    });
    const first = await mod.loadEmulator();
    const second = await mod.loadEmulator();
    expect(first.getPc()).toBe(4194304);
    expect(second).not.toBe(first);
    expect(built).toBe(2);
    // The init promise is cached: a second load does not re-download.
    expect(inits).toBe(1);
  });

  it("asks the wasm module whether a program is hosted", async () => {
    const seen: string[] = [];
    const mod = await loadWrapperWith({
      default: async () => {},
      Emulator: class {},
      detectHostedMode: (source: string) => {
        seen.push(source);
        return true;
      },
    });
    expect(await mod.detectHostedMode(".text\nmain:\n")).toBe(true);
    expect(seen).toEqual([".text\nmain:\n"]);
  });

  it("reports an empty memory map when the build predates the export", async () => {
    // The absence is spelled as an undefined export because vitest's mocked
    // namespace throws on a key the factory left out; undefined is what the
    // wrapper's `typeof probe !== "function"` check reads either way.
    const mod = await loadWrapperWith({
      default: async () => {},
      Emulator: class {},
      memoryMap: undefined,
    });
    // Empty is the memory panel's cue to fall back to its own section list
    // instead of labelling addresses it cannot verify.
    expect(await mod.loadMemoryMap()).toEqual([]);
  });

  it("normalizes the exported bands and drops a malformed row", async () => {
    const mod = await loadWrapperWith({
      default: async () => {},
      Emulator: class {},
      memoryMap: () => [
        { name: ".text", start: 4194304, end: 5242880 },
        { name: ".data", start: "not an address", end: 6291456 },
        { start: 7340032, end: 7405568 },
        { name: "stack", start: 8388608, end: 8454144 },
      ],
    });
    expect(await mod.loadMemoryMap()).toEqual([
      { name: ".text", start: 4194304, end: 5242880 },
      { name: "stack", start: 8388608, end: 8454144 },
    ]);
  });
});
