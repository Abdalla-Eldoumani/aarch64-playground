import { NAV_ROUTES } from "@/lib/content/site";

// The single data source for the landing sections: the feature catalog, the
// routes-as-register-file block, and the live hero's program. The later landing
// waves render this, so adding a capability or a route is one array entry and
// the hero's program stays out of inline magic.

export interface Feature {
  /** Short headline for the capability. */
  title: string;
  /** One-line, truthful description of what it does today. */
  description: string;
  /** Optional short mono glyph (a mnemonic or symbol), rendered as text. */
  glyph?: string;
}

// Ordered roughly most-to-least headline. Every entry is truthful to what ships.
export const FEATURES: Feature[] = [
  {
    title: "Hand-written interpreter",
    description:
      "Readable Rust compiled to WebAssembly runs the whole machine in the tab: no server, no QEMU, no install.",
    glyph: "wasm",
  },
  {
    title: "Visual debugger",
    description:
      "Watch registers, the stack, memory, and the console update as each instruction runs.",
    glyph: "x0",
  },
  {
    title: "Step and step back",
    description:
      "Walk forward one instruction at a time, or rewind to see exactly where a value went wrong.",
    glyph: "pc",
  },
  {
    title: "Hosted runtime",
    description:
      "printf, scanf, malloc, and Linux syscalls answer the way the course servers do, so tutorial programs run unmodified.",
    glyph: "io",
  },
  {
    title: "Course toolchain",
    description:
      "define aliases, sections, and =label literal loads resolve the way GNU m4 and GAS handle them on the course servers.",
    glyph: "m4",
  },
  {
    title: "Command-line arguments",
    description:
      "Type arguments in the args box and the program receives a real argc and argv, argv[0] included.",
    glyph: "argv",
  },
  {
    title: "Embeddable surface",
    description:
      "Lessons and exercises embed the same live machine, so the examples in the reading are runnable, not screenshots.",
    glyph: "</>",
  },
  {
    title: "Bounded sandbox",
    description:
      "A runaway loop or memory bomb halts calmly with a plain explanation instead of freezing the tab.",
    glyph: "[]",
  },
  {
    title: "Three themes",
    description:
      "Dark, light, and high-contrast themes, all driven by design tokens.",
    glyph: "rgb",
  },
  {
    title: "Installable and offline",
    description:
      "Install it as an app; after the first load the whole debugger works with no connection.",
    glyph: "pwa",
  },
];

export interface RouteRegister {
  /** Register/address-style label for the register-file motif. */
  reg: string;
  /** Visible destination label. */
  label: string;
  /** Destination href (reused from NAV_ROUTES so the addresses never drift). */
  href: string;
  /** The primary destination (the playground), styled as the cyan call to action. */
  primary?: boolean;
}

// The playground is the primary call to action; it and Learn / Practice /
// Reference all take their href from NAV_ROUTES so every route address has one
// source and cannot drift. The playground row finds its entry by label, so the
// filter and the primary row read the same canonical href. Each row carries an
// x-register-style label, rendered later as a register file (not generic cards).
const PLAYGROUND_HREF =
  NAV_ROUTES.find((route) => route.label === "Playground")?.href ?? "/playground";

const SECONDARY_ROUTES = NAV_ROUTES.filter(
  (route) => route.href !== PLAYGROUND_HREF,
);

export const ROUTE_REGISTERS: RouteRegister[] = [
  { reg: "x0", label: "Open the playground", href: PLAYGROUND_HREF, primary: true },
  ...SECONDARY_ROUTES.map((route, index) => ({
    reg: `x${index + 1}`,
    label: route.label,
    href: route.href,
  })),
];

// A tiny original CPSC 355-style snippet for the live hero: a short register
// walk with decimal immediates, then one line printed through the bare write
// system call. No libc, so it still assembles instantly and steps fast, while
// the autoplay walk reaches the svc and real stdout appears in the embed
// console with no user action. It follows the in-repo convention (m4 define
// aliases, .text/.global main, the stp/ldp frame prologue and epilogue);
// it is not copied from any course file.
export const HERO_PROGRAM = `// build a small value, print a line with the write syscall, return the value
define(base, x19)
define(total, x20)

        .text
msg:    .string "hello from the playground\\n"
msg_len = . - msg - 1

        .balign 4
        .global main

main:
        stp     x29, x30, [sp, -16]!
        mov     x29, sp

        mov     base, 7
        add     total, base, 3

        // write(stdout, msg, msg_len)
        mov     w0, 1
        ldr     x1, =msg
        mov     x2, msg_len
        mov     x8, 64
        svc     0

        mov     x0, total
        ldp     x29, x30, [sp], 16
        ret
`;
