/** Interactive tutorial definitions. Each step shows a prose explanation
 *  plus an optional source snippet the student can load with one click.
 *  The tutorial runner keeps position in localStorage so a page reload
 *  doesn't lose progress. */

export interface TutorialStep {
  title: string;
  body: string;
  /** Assembly snippet to load into the editor for this step. */
  snippet?: string;
}

export interface Tutorial {
  id: string;
  title: string;
  summary: string;
  steps: TutorialStep[];
}

export const TUTORIALS: Tutorial[] = [
  {
    id: "hello-syscall",
    title: "Hello via write syscall",
    summary: "Write a string to stdout using Linux's write(2) and halt with exit.",
    steps: [
      {
        title: "Set up the string",
        body:
          "Data lives in the `.data` section. `.string` emits the characters " +
          "plus a trailing null byte. Load the snippet, hit Assemble, then " +
          "look at address `0x00600000` in the memory panel.",
        snippet:
          `.data
msg:    .string "hi\\n"
.text
.global main
main:
    mov     w0, 0
    mov     x8, 93
    svc     0
`,
      },
      {
        title: "Call write(stdout, msg, len)",
        body:
          "The Linux write syscall takes fd in x0, buffer in x1, and length " +
          "in x2, with the syscall number 64 in x8. `ldr x1, =msg` loads " +
          "the address through the literal pool.",
        snippet:
          `.data
msg:    .string "hi\\n"
.text
.global main
main:
    mov     w0, 1
    ldr     x1, =msg
    mov     x2, 3
    mov     x8, 64
    svc     0

    mov     w0, 0
    mov     x8, 93
    svc     0
`,
      },
      {
        title: "Return from main",
        body:
          "After the write, exit(0) halts the program. You should see `hi` " +
          "in the console tab and the status bar should say halted with " +
          "exit 0.",
      },
    ],
  },
  {
    id: "frame-prologue",
    title: "Frame pointer prologue",
    summary: "Save fp/lr on the stack, reserve space, and label slots.",
    steps: [
      {
        title: "Save the frame",
        body:
          "`stp fp, lr, [sp, -16]!` pushes both registers and decrements " +
          "sp. `mov fp, sp` then fixes fp at the new stack top. This is " +
          "the canonical cpsc 355 prologue.",
        snippet:
          `.text
.global main
main:
    stp     fp, lr, [sp, -16]!
    mov     fp, sp

    mov     w0, 0
    ldp     fp, lr, [sp], 16
    ret
`,
      },
      {
        title: "Reserve locals",
        body:
          "`alloc = -(16 + <locals>) & -16` keeps the stack 16-byte aligned. " +
          "Watch `sp` and `fp` in the register panel as you step through.",
        snippet:
          `alloc = -(16 + 16) & -16
dealloc = -alloc

.text
.global main
main:
    stp     fp, lr, [sp, alloc]!
    mov     fp, sp

    mov     w0, 42
    str     w0, [fp, 16]
    ldr     w0, [fp, 16]

    ldp     fp, lr, [sp], dealloc
    ret
`,
      },
    ],
  },
];

const STORE_KEY = "aarch64-playground:tutorial-progress";

export interface TutorialProgress {
  [tutorialId: string]: number;
}

export function loadProgress(): TutorialProgress {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as TutorialProgress;
  } catch {
    // ignore
  }
  return {};
}

export function saveProgress(progress: TutorialProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(progress));
  } catch {
    // ignore
  }
}
