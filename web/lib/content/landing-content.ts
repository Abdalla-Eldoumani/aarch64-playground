import { NAV_ROUTES } from "@/lib/content/site";

// The landing page's data (features, route links, the hero's program), so a
// new feature or route is one array entry.

export interface Feature {
  /** Short headline for the capability. */
  title: string;
  /** One-line description of what it does today. */
  description: string;
  /** Optional short mono glyph (a mnemonic or symbol), rendered as text. */
  glyph?: string;
}

// Ordered roughly most-to-least headline. Every entry names something that
// ships and that a student could not learn by glancing at the screen; the
// visible chrome (themes, the args box, the embedded lesson machines) speaks
// for itself.
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
      "Registers, the stack, memory, and the console update as each instruction runs.",
    glyph: "x0",
  },
  {
    title: "Step and step back",
    description:
      "Walk forward one instruction at a time, or rewind to see exactly where a value went wrong.",
    glyph: "pc",
  },
  {
    title: "C library and system calls",
    description:
      "printf, scanf, malloc, argv, and Linux system calls answer the way the course servers do, so tutorial programs run unmodified.",
    glyph: "io",
  },
  {
    title: "Course toolchain",
    description:
      "define aliases, sections, and =label literal loads resolve the way GNU m4 and GAS handle them on the course servers.",
    glyph: "m4",
  },
  {
    title: "Runaway programs stop",
    description:
      "A runaway loop or a program that allocates without limit halts cleanly with a plain explanation instead of freezing the tab.",
    glyph: "[]",
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

// Every href comes from NAV_ROUTES so a route address has one source.
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

// An original course-style snippet for the live hero, not copied from any
// course file. It prints through the write system call instead of printf so it
// assembles and steps fast, and the autoplay reaches the svc so output appears
// with no click.
export const HERO_PROGRAM = `// build a small value, print a line with the write syscall, return the value
define(base, x19)
define(total, x20)

        .text
msg:    .string "hello from the playground\\n"
msg_len = . - msg - 1                   // length without the NUL

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
