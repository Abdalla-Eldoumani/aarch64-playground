import type { JSX } from "react";
import { Kicker } from "@/components/ui/Kicker";
import { LessonMarkdown } from "@/components/learn/LessonMarkdown";
import { DATA_DIRECTIVES, DEBUG_CONTROLS, WATCH_FORMS } from "@/lib/content/directives-reference";

/**
 * The reference for what a program holds besides instructions (sections, data
 * directives, m4 names, equates) and for the playground's debugger. Prose goes
 * through LessonMarkdown, the one sanitizing renderer, so the tables share the
 * lesson tables' styling.
 */

const leadMarkdown =
  "Everything in a program that is not an instruction, and the playground tools that show a program while it runs.";

const sectionsMarkdown = [
  "An assembly file is split into *sections*. `.text` holds the instructions, `.data` holds variables that start with a value, and `.bss` holds variables that start at 0 and take no space in the program file. A section directive applies to the lines below it, up to the next one. A label in front of a data line names the address of its first byte.",
  "",
  "| directive | bytes | example |",
  "|---|---|---|",
  ...DATA_DIRECTIVES.map((d) => `| \`${d.directive}\` | ${d.bytes} | \`${d.example}\` |`),
  "",
  "A `.float` or `.double` value is written with a `0r` prefix. `.balign 4` pads until the address is a multiple of 4, and `.align 4` pads until it is a multiple of 2^4 = 16. Put `.balign 4` before every function and before a `.word` that follows strings. A value wider than a byte is stored little-endian: its lowest byte sits at the lowest address.",
].join("\n");

const namesMarkdown = [
  "- `define(count_r, w19)` tells m4 to replace every later `count_r` with `w19` before the assembler sees the file, and `define(SIZE, 40)` names a constant the same way. m4 replaces a name inside strings too.",
  "- A macro can take arguments, written `$1`, `$2` and so on in its body. After ``define(square, `mul $1, $1, $1')``, the line `square(w9)` becomes `mul w9, w9, w9`. The backquote and the apostrophe around the body keep its commas from splitting it.",
  "- `sum_s = 16` gives the assembler a constant and takes no memory. Frame offsets and frame sizes are written this way, such as `alloc = -(16 + 8) & -16`.",
  "- `.global main` makes a label visible outside its file, so the linker can find it from other files and from the start-up code that calls `main`.",
  "- `ldr x0, =fmt` puts the address of the label `fmt` in `x0`; a second load reads the value stored there.",
].join("\n");

const debuggerMarkdown = [
  "The [debugging lesson](/learn/debugging-in-the-playground) uses these tools on a program with a bug. The keys work in the full playground; inside a lesson, use the buttons.",
  "",
  "| control | key | what it does |",
  "|---|---|---|",
  ...DEBUG_CONTROLS.map((c) => `| ${c.control} | ${c.key} | ${c.does} |`),
  "",
  "A *breakpoint* makes run stop just before a line runs. Click the narrow strip to the left of a line number to set one, or tap it on a touch screen, and click again to clear it. A run that goes 1,000,000 instructions without finishing pauses and says so. `?` lists every key, and Ctrl+K opens a searchable list of every action.",
].join("\n");

const viewsMarkdown = [
  "| view | what it shows |",
  "|---|---|",
  "| registers | `x0` to `x30`, `d0` to `d31`, or `v0` to `v31`, with the NZCV flags; the registers the last instruction changed are marked, and dec or hex picks how values are written |",
  "| memory | raw bytes, 16 to a row (8 on a narrow screen), with their characters; jump to `.text`, `.rodata`, `.data`, `.bss` or the stack, or type an address in hex or decimal |",
  "| stack | 16 rows of 8 bytes from `sp`, with the row `fp` points at marked and the others named by their offset from `fp` (the names and the `fp` mark show on a screen 640 px or wider) |",
  "| watches | the expressions in the table below, in hex, at every stop |",
  "| memwatch | a named strip of bytes at an address you choose, kept from run to run |",
  "| saves | the machine's state under a name, to go back to later |",
  "",
  "On a phone, every view but the registers and the console is under more.",
].join("\n");

const watchMarkdown = [
  "| watch | what it shows |",
  "|---|---|",
  ...WATCH_FORMS.map((w) => `| \`${w.form}\` | ${w.shows} |`),
  "",
  "Watches know register names, the names from `=` lines, and a `.data` label with an index after it. They do not know m4 names from `define`, so watch `w19`, not `count_r`.",
  "",
  "The diagnostic bundle button packs the program, its output, the registers, the flags, the stack, and the `.data` and `.bss` sections into one report to paste into a question. It shows the report first, and nothing is sent anywhere.",
].join("\n");

export function DirectivesAndDebugger({
  className = "",
}: {
  className?: string;
}): JSX.Element {
  return (
    <section
      aria-label="directives and debugger"
      className={`mx-auto flex w-full max-w-2xl flex-col gap-6 ${className}`}
    >
      <div className="[&_p:first-of-type]:[font:var(--type-lead)]">
        <LessonMarkdown markdown={leadMarkdown} />
      </div>

      <Kicker number="01" title="sections and data" className="mt-4" />
      <LessonMarkdown markdown={sectionsMarkdown} />

      <Kicker number="02" title="names and constants" className="mt-4" />
      <LessonMarkdown markdown={namesMarkdown} />

      <Kicker number="03" title="the debugger" className="mt-4" />
      <LessonMarkdown markdown={debuggerMarkdown} />
      <LessonMarkdown markdown={viewsMarkdown} />
      <LessonMarkdown markdown={watchMarkdown} />
    </section>
  );
}
