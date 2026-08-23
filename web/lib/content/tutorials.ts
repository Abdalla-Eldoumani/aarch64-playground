/** Interactive tutorial definitions. Each step shows a prose explanation
 *  plus an optional source highlight, watch hint, and expected register
 *  check the runner can verify against the live CPU state.
 *
 *  Sources are kept in `/examples/cpsc355/` so a tutorial loads the same
 *  file the student gets from the example loader -- no parallel copies. */

import { safeGetItem, safeSetItem } from "@/lib/playground/safe-storage";

export interface ExpectedRegister {
  /** Register name -- "w0".."w30", "x0".."x30", "sp", "pc". */
  reg: string;
  /** Decimal integer the register should hold when the step is verified. */
  value: number;
  /** Optional one-line note shown next to the check. */
  note?: string;
}

export interface TutorialStep {
  title: string;
  body: string;
  /** 1-based inclusive line range to highlight in the editor. */
  highlight?: { start: number; end: number };
  /** Suggest the student add this watch to the watch panel. */
  watchReg?: string;
  /** Verify when the user advances to the next step. */
  expect?: ExpectedRegister;
}

export interface Tutorial {
  id: string;
  title: string;
  summary: string;
  /** Path under `/examples/cpsc355/` that backs this tutorial. */
  sourcePath: string;
  /** Optional argv to pre-fill before the student assembles. */
  args?: string;
  /** Optional stdin to pre-fill before the student assembles. */
  stdin?: string;
  steps: TutorialStep[];
}

export const TUTORIALS: Tutorial[] = [
  {
    id: "arithmetic",
    title: "arithmetic operations",
    summary:
      "Walk through ADD, SUB, MUL, UDIV, and remainder via SUB+MUL using the basics example.",
    sourcePath: "/examples/cpsc355/basics.s",
    steps: [
      {
        title: "Aliases and operands",
        body:
          "The m4 defines at the top map readable names (a, b, result) to physical registers. After assemble, watch x19 (a) and x20 (b) take their initial values 47 and 5.",
        highlight: { start: 4, end: 27 },
        watchReg: "x19",
        expect: { reg: "x19", value: 47, note: "a = 47" },
      },
      {
        title: "Add, subtract, multiply",
        body:
          "Each `bl printf` formats one line of output. Step through ADD, SUB, MUL and watch x21 (result) update to 52, 42, then 235.",
        highlight: { start: 28, end: 51 },
        watchReg: "x21",
      },
      {
        title: "Division and remainder",
        body:
          "AArch64 has UDIV but no integer remainder; the program computes `a - (a / b) * b`. After the final printf, x21 should hold 2 (the remainder of 47 / 5).",
        highlight: { start: 52, end: 75 },
        expect: { reg: "x21", value: 2, note: "47 % 5 = 2" },
      },
    ],
  },
  {
    id: "stack-frames",
    title: "stack frames and scanf",
    summary:
      "Allocate locals on the stack, scan three integer scores, average them, and tear down the frame.",
    sourcePath: "/examples/cpsc355/array-scores.s",
    stdin: "85\n92\n78\n",
    steps: [
      {
        title: "Frame prologue",
        body:
          "`stp fp, lr, [sp, alloc]!` saves both registers and reserves 32 bytes in one go. `mov fp, sp` then anchors the frame so `[fp, score1_s]` keeps a stable address even if sp moves later.",
        highlight: { start: 32, end: 33 },
        watchReg: "sp",
      },
      {
        title: "scanf the first score",
        body:
          "`add x1, fp, score1_s` produces the address of the on-stack slot for score 1. `bl scanf` blocks until the runtime feeds the next stdin line; the prefilled fixture sends 85.",
        highlight: { start: 35, end: 41 },
        watchReg: "x1",
      },
      {
        title: "Two more scanfs",
        body:
          "Repeat the same pattern for scores 2 and 3. Step over each scanf and watch the three slots `[fp+16]`, `[fp+20]`, `[fp+24]` fill in via the memory panel.",
        highlight: { start: 43, end: 57 },
      },
      {
        title: "Compute the average",
        body:
          "After loading w19/w20/w21 with the three scores, sum them in w22 and divide by 3 with SDIV. Verify w23 (avg_r) holds 85 -- (85+92+78)/3 = 85.",
        highlight: { start: 79, end: 83 },
        expect: { reg: "w23", value: 85, note: "average rounds toward 0" },
      },
      {
        title: "Frame epilogue",
        body:
          "`ldp fp, lr, [sp], dealloc` is the mirror of the prologue: restore both registers AND release the 32-byte frame in one post-indexed load. RET then jumps to lr, which the loader pre-set to a halt sentinel.",
        highlight: { start: 90, end: 92 },
      },
    ],
  },
  {
    id: "records-and-arrays",
    title: "records on the stack",
    summary:
      "Lay out a Student record (name + id + grade) with explicit offsets, fill it via scanf, set a byte field, and printf the record.",
    sourcePath: "/examples/cpsc355/student-record.s",
    stdin: "Alice\n12345\n",
    steps: [
      {
        title: "Struct slot offsets",
        body:
          "The `stu_name = 16` etc. lines are assembly-time symbol assignments, not runtime instructions. They give the offsets from `fp` for each field of the Student record.",
        highlight: { start: 7, end: 15 },
      },
      {
        title: "scanf %s into the name field",
        body:
          "`add x1, fp, stu_name` is the address of the 20-byte name buffer. scanf with %s reads a whitespace-terminated token from stdin (Alice).",
        highlight: { start: 32, end: 37 },
        watchReg: "x1",
      },
      {
        title: "scanf %d into the id field",
        body:
          "ID is a 4-byte int at offset 36 from fp. After this step, the memory panel at `[fp + 36]` should hold the bytes `39 30 00 00` (12345 little-endian).",
        highlight: { start: 39, end: 45 },
      },
      {
        title: "Set grade = 'A' as a single byte",
        body:
          "`mov w19, 'A'` puts ASCII 65 in w19; `strb w19, [fp, stu_grade]` stores ONE byte at offset 40. After this step, w19 should be 65.",
        highlight: { start: 47, end: 49 },
        expect: { reg: "w19", value: 65, note: "ASCII 'A' is 65" },
      },
      {
        title: "printf the whole record",
        body:
          "x1 is the name address, w2 is the int id loaded from `[fp+36]`, w3 is the byte grade loaded from `[fp+40]`. `bl printf` formats them with the %s/%d/%c format string.",
        highlight: { start: 51, end: 56 },
      },
    ],
  },
  {
    id: "find-max",
    title: "arrays and a find_max function",
    summary:
      "Fill a 10-int array, scan it with a leaf function, return the largest value.",
    sourcePath: "/examples/cpsc355/find-max.s",
    steps: [
      {
        title: "Allocate and fill the array",
        body:
          "`arr` is in `.bss` (zero-initialized). The fill loop writes `(i+1)*7` into `arr[i]` so the values are 7, 14, 21, ... 70. After the fill, watch the memory panel at the .bss base to see the bytes.",
        highlight: { start: 60, end: 73 },
        watchReg: "x19",
      },
      {
        title: "Print each element",
        body:
          "The print loop calls printf 10 times with the index in w1 and the value in w2. After this step, the console tab shows `a[0] = 7` through `a[9] = 70`.",
        highlight: { start: 75, end: 86 },
      },
      {
        title: "Call find_max",
        body:
          "The leaf function gets the array base in x0 and the length 10 in w1. find_max copies them into scratch (x12, w13) so it can return the max in w0 without disturbing them.",
        highlight: { start: 24, end: 35 },
      },
      {
        title: "Verify the result",
        body:
          "After find_max returns, w20 holds the max. The final printf formats it. Step past the printf and check w0 in the register panel -- it should be 70.",
        highlight: { start: 89, end: 96 },
        expect: { reg: "w0", value: 70, note: "max of arr is 70" },
      },
    ],
  },
  {
    id: "static-vs-argv",
    title: "static locals and argv",
    summary:
      "Compare a function with a static counter (file-scope state) against main's argv (per-invocation state).",
    sourcePath: "/examples/cpsc355/static-counter.s",
    steps: [
      {
        title: "Static counter in .data",
        body:
          "`count_m: .word 0` reserves a 4-byte word in `.data`. Every call to `increment` reads it, adds 1, and writes it back -- the value persists across calls.",
        highlight: { start: 11, end: 14 },
        watchReg: "x9",
      },
      {
        title: "Read-modify-write pattern",
        body:
          "`ldr x9, =count_m` puts the address of count_m in x9. Then ldr/add/str does a read-modify-write. After the first call, the byte at count_m should be 1.",
        highlight: { start: 21, end: 32 },
      },
      {
        title: "Calling increment three times",
        body:
          "main loops i_r from 1 to 3, calling increment each time. Step through the third call -- the counter in memory should reach 3.",
        highlight: { start: 36, end: 56 },
        expect: { reg: "w0", value: 3, note: "third return value" },
      },
      {
        title: "Switching to argv",
        body:
          "Now load `/examples/cpsc355/command-line-args.s` and set the args field above to `./myecho hello world`. argc lands in w0 and argv in x1 on entry.",
      },
      {
        title: "Loop over argv",
        body:
          "The loop indexes argv with `[argv_r, i_r, SXTW 3]` -- 8-byte stride because each pointer is a u64. printf %s prints the C string the pointer points at.",
      },
      {
        title: "Static vs argv",
        body:
          "Take a moment: where does each function get its data from? increment from a single fixed address in .data; main from a pointer table the loader laid out at 0x00800000.",
      },
    ],
  },
  {
    id: "floating-point",
    title: "floating-point and the area of a circle",
    summary: "Read an integer radius, convert to double, compute pi*r*r, printf with %f.",
    sourcePath: "/examples/cpsc355/circle-area.s",
    stdin: "5\n",
    steps: [
      {
        title: "Read the radius as int",
        body:
          "scanf with %d reads decimal digits into a 4-byte slot on the stack. After this step, the slot at `[fp + r_s]` should hold 5 (0x05 0x00 0x00 0x00).",
        highlight: { start: 27, end: 33 },
      },
      {
        title: "Convert int to double",
        body:
          "`scvtf d1, w19` is signed-int to floating-point: it produces 5.0 in d1. Watch d1 in the register panel after this step (FP registers may live in their own panel).",
        highlight: { start: 35, end: 36 },
      },
      {
        title: "Multiply by pi",
        body:
          "`pi_m: .double 0r3.14159...` is a literal double in `.data`. Two `fmul` instructions compute r*r then pi*(r*r) into d0. The .double directive uses GAS's 0r prefix for floats.",
        highlight: { start: 38, end: 44 },
      },
      {
        title: "printf %f",
        body:
          "The first floating-point printf argument lands in d0. The format string `Area = %.4f\\n` prints 4 fractional digits. With r=5 you should see `78.5398`.",
        highlight: { start: 46, end: 50 },
      },
    ],
  },
  {
    id: "syscalls",
    title: "raw Linux syscalls",
    summary:
      "Use write (64), read (63), and exit (93) directly via SVC, without going through libc.",
    sourcePath: "/examples/cpsc355/echo.s",
    stdin: "hi there\n",
    steps: [
      {
        title: "write the prompt",
        body:
          "`x8 = 64; svc 0` is the write syscall. x0 is the fd (1 for stdout), x1 is the buffer, x2 is the byte count. The prompt is written before scanf so the user knows what to type.",
        highlight: { start: 27, end: 33 },
      },
      {
        title: "read into a stack buffer",
        body:
          "`x8 = 63; svc 0` is read. With fd 0 (stdin), x1 = buffer, x2 = max bytes, the runtime returns the byte count in x0. `mov n_read_r, x0` saves it.",
        highlight: { start: 35, end: 41 },
        watchReg: "x19",
      },
      {
        title: "null-terminate before printf",
        body:
          "`strb wzr, [x9, n_read_r]` writes a NUL at index n_read_r so printf %s knows where the string ends. Without this step, printf would walk off the end of the buffer.",
        highlight: { start: 43, end: 45 },
      },
      {
        title: "printf the buffer",
        body:
          "Now we go through the libc trampoline -- printf is a host stub at 0xFFFF_*. The `bl printf` instruction is rewritten by the linker to jump through a per-host trampoline so the imm26 offset stays in range.",
        highlight: { start: 47, end: 50 },
      },
      {
        title: "exit cleanly",
        body:
          "The function returns via the standard epilogue. The loader stashed a `__main_return` sentinel in lr so the final `ret` halts the CPU and stamps w0 (which we set to 0) as the exit code.",
        highlight: { start: 52, end: 54 },
        expect: { reg: "w0", value: 0, note: "exit code 0" },
      },
    ],
  },
];

const STORE_KEY = "aarch64-playground:tutorial-progress";

export interface TutorialProgress {
  [tutorialId: string]: number;
}

export function loadProgress(): TutorialProgress {
  const raw = safeGetItem(STORE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as TutorialProgress;
  } catch {
    // ignore
  }
  return {};
}

export function saveProgress(progress: TutorialProgress): void {
  safeSetItem(STORE_KEY, JSON.stringify(progress));
}
