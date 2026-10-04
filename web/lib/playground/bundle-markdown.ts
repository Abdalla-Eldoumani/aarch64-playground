/**
 * The diagnostic report as markdown, kept apart from diagnostic-bundle.ts so
 * the error boundaries can build it without putting lz-string on every page.
 * The type import below is erased at build time.
 */

import type { DiagnosticBundle, Place } from "@/lib/playground/diagnostic-bundle";
import {
  fpRegisterText,
  integerReading,
  laneText,
  parseBits,
} from "@/lib/emulator/register-format";
import { sliceLanes } from "@/lib/emulator/vector-lanes";

// Written for a reader who has never seen the playground, a person or an
// assistant, so it names the toolchain the program was written for.
const PREAMBLE = [
  "This report comes from the AArch64 Playground, a browser-based emulator and debugger " +
    "for a university course in AArch64 (ARMv8) assembly. Programs are written in GNU as " +
    "syntax, may use m4 macros, and call a Linux-like C library (printf, scanf, malloc and " +
    "the like), so they behave the way they would on a Linux ARM server. Everything below " +
    "was captured when the report was made.",
  "",
  "The sections hold how far the run got and any error, every source file, the arguments " +
    "and input the program was given, what it printed, notes the playground showed, and the " +
    "machine state: registers, flags, the instructions around the program counter (pc), the " +
    "stack, and the .data and .bss sections. A section with nothing in it is left out.",
  "",
  "To find the bug, compare what the program printed and what its registers and memory hold " +
    "with what the source means to do, and look for the first place they differ: a wrong " +
    "register, a value a library call overwrote, a wrong offset or size, a missing store, or " +
    "a stack that was not put back. The student says what they expected and what they got " +
    "at the end.",
];

/** A fenced block whose fence is longer than any backtick run inside it, so
 *  a program's own backticks cannot close it early. */
function fenced(body: string, lang = "text"): string[] {
  const longest = Math.max(0, ...(body.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return [`${fence}${lang}`, body.replace(/\r\n/g, "\n").trimEnd(), fence];
}

/** Inline code, with the same guard as `fenced`. */
function inline(text: string): string {
  if (!text.includes("`")) return `\`${text}\``;
  const longest = Math.max(...(text.match(/`+/g) ?? []).map((run) => run.length));
  const ticks = "`".repeat(longest + 1);
  return `${ticks} ${text} ${ticks}`;
}

/** The non-empty parts, a blank line between each. */
function joined(...parts: string[][]): string[] {
  return parts.filter((p) => p.length > 0).flatMap((p, i) => (i === 0 ? p : ["", ...p]));
}

function where(p: Place): string {
  const at = `${p.file ?? "main.asm"} line ${p.line}`;
  const text = p.text.trim();
  return text ? `${at}: ${inline(text)}` : at;
}

function xRows(registers: string[]): string[] {
  return registers.map((hex, i) => {
    const { signed, unsigned } = integerReading(parseBits(hex, 64), 64);
    const role = i === 29 ? " (fp)" : i === 30 ? " (lr)" : "";
    const value = unsigned ? `${signed}, unsigned ${unsigned}` : signed;
    return `${`x${i}`.padEnd(3)} = ${hex}  ${value}${role}`;
  });
}

/** Each run of equal registers shares a row: most hold zero, or the one
 *  pattern a library call leaves, so all 32 fit in a few lines. */
function collapsedRows(prefix: string, registers: string[], decode: (hex: string) => string): string[] {
  const rows: string[] = [];
  for (let first = 0; first < registers.length; ) {
    let last = first;
    while (registers[last + 1] === registers[first]) last++;
    const hex = registers[first];
    const names = last === first ? `${prefix}${first}`.padEnd(3) : `${prefix}${first} to ${prefix}${last}`;
    rows.push(/^0x0*$/i.test(hex.trim()) ? `${names} = 0` : `${names} = ${hex}  ${decode(hex)}`);
    first = last + 1;
  }
  return rows;
}

function vectorText(hex: string): string {
  const lanes = sliceLanes(hex, "s").map(
    (lane) => laneText(lane.hex, { width: "s", float: false }, true).primary,
  );
  return `as 4s lanes 0 to 3: ${lanes.join(", ")}`;
}

function flagRows(nzcv: number): string[] {
  const [n, z, c, v] = [3, 2, 1, 0].map((bit) => ((nzcv >> bit) & 1) === 1);
  const conditions: Array<[string, boolean]> = [
    ["eq", z],
    ["ne", !z],
    ["hs", c],
    ["lo", !c],
    ["mi", n],
    ["pl", !n],
    ["vs", v],
    ["vc", !v],
    ["hi", c && !z],
    ["ls", !c || z],
    ["ge", n === v],
    ["lt", n !== v],
    ["gt", !z && n === v],
    ["le", z || n !== v],
  ];
  const which = (holds: boolean) =>
    conditions.filter(([, h]) => h === holds).map(([name]) => name).join(" ");
  return [
    `N=${Number(n)} Z=${Number(z)} C=${Number(c)} V=${Number(v)}`,
    `a b.cond branch is taken for: ${which(true)}`,
    `and not taken for: ${which(false)}`,
  ];
}

/**
 * `shareUrl` arrives already built (from `bundleShareUrl`) so this module
 * never needs the compressor; without it the report has no reopen link.
 */
export function bundleToMarkdown(bundle: DiagnosticBundle, shareUrl?: string): string {
  const out: string[] = ["# Diagnostic bundle", "", ...PREAMBLE, ""];
  const section = (heading: string, lines: string[]) => {
    if (lines.length > 0) out.push(heading, "", ...lines, "");
  };

  section("## Status", bundle.status ? [bundle.status] : []);
  section(
    "## Error",
    bundle.error
      ? [...fenced(bundle.error), ...(bundle.errorAt ? ["", `At ${where(bundle.errorAt)}`] : [])]
      : [],
  );

  out.push("## Source files", "", "### main.asm", "", ...fenced(bundle.source, "asm"), "");
  for (const file of bundle.files ?? []) {
    out.push(`### ${file.name}`, "", ...fenced(file.body, "asm"), "");
  }

  section(
    "## Input",
    joined(
      bundle.args ? [`Arguments: ${inline(bundle.args)}`] : [],
      bundle.stdin ? ["Standard input:", "", ...fenced(bundle.stdin)] : [],
    ),
  );

  const printed = bundle.stdout || bundle.stderr;
  section(
    "## Output",
    joined(
      bundle.stdout ? ["Standard output:", "", ...fenced(bundle.stdout)] : [],
      bundle.stderr ? ["Standard error:", "", ...fenced(bundle.stderr)] : [],
      // A machine that ran and printed nothing is a finding in itself.
      !printed && bundle.registers ? ["Nothing was printed."] : [],
      bundle.exitCode != null ? [`Exit code: ${bundle.exitCode}`] : [],
    ),
  );

  section("## Notes from the playground", (bundle.notes ?? []).map((note) => `- ${note}`));

  if (bundle.pc || bundle.registers) {
    out.push("## Machine state", "");
    section(
      "### Where the pc is",
      joined(
        [`pc = ${bundle.pc ?? "unknown"}${bundle.pcAt ? `, on ${where(bundle.pcAt)}` : ""}`],
        bundle.disassembly ? fenced(bundle.disassembly.join("\n")) : [],
      ),
    );
    section(
      "### x registers",
      bundle.registers
        ? fenced([...xRows(bundle.registers), ...(bundle.sp ? [`sp  = ${bundle.sp}`] : [])].join("\n"))
        : [],
    );
    section("### Flags (NZCV)", bundle.nzcv != null ? fenced(flagRows(bundle.nzcv).join("\n")) : []);
    section(
      "### d registers",
      bundle.fpRegisters
        ? joined(
            [
              "Each row gives the raw bits, then the value as a double; a value ending in f is a " +
                "single-precision float in the low 32 bits.",
            ],
            fenced(collapsedRows("d", bundle.fpRegisters, (hex) => fpRegisterText(hex)).join("\n")),
          )
        : [],
    );
    section(
      "### v registers",
      bundle.vectorRegisters
        ? fenced(collapsedRows("v", bundle.vectorRegisters, vectorText).join("\n"))
        : [],
    );
    section(
      "### Stack",
      bundle.stack
        ? joined(
            ["One row per 8 bytes, from sp upward: address, value, and what the slot holds."],
            fenced(bundle.stack.join("\n")),
          )
        : [],
    );
    for (const dump of bundle.memory ?? []) {
      section(`### ${dump.name}`, fenced(dump.lines.join("\n")));
    }
  }

  if (bundle.vfs && bundle.vfs.length > 0) {
    out.push("## Virtual files the program can open", "");
    for (const file of bundle.vfs) out.push(`### ${file.name}`, "", ...fenced(file.body), "");
  }

  section(
    "## Versions",
    [
      bundle.site && `- Site: ${bundle.site}`,
      bundle.emulator && `- Emulator: ${bundle.emulator}`,
      bundle.browser && `- Browser: ${bundle.browser}`,
    ].filter((line): line is string => Boolean(line)),
  );

  if (shareUrl) out.push(`[open in the playground](${shareUrl})`, "");

  out.push("## What I expected", "", "", "## What I got", "", "");
  return out.join("\n");
}
