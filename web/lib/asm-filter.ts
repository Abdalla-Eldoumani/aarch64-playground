/**
 * Strip GCC/GAS directives that aren't useful for someone reading the
 * generated assembly: DWARF, CFI, LFB/LFE scaffolding, string-table
 * machinery, alignment pragmas, etc. The remaining lines are real
 * instructions, labels, and `.section` / `.global` / `.string` markers
 * that the cpsc 355 corpus already reads.
 */

const DROPPED_PREFIXES = [
  ".cfi_",
  ".file",
  ".loc",
  ".ident",
  ".debug",
  ".size",
  ".type",
  ".p2align",
  ".align",
  ".balign",
  ".arch",
  ".note",
  ".section .note",
  ".section .rodata.str",
];

// GCC-only function-body bookkeeping labels. `.LC*` (string-table entries)
// and `.L<N>` (real branch targets under -O0) stay -- dropping them would
// break `bgt .L2` and similar branches the compiler actually emitted.
const DROPPED_LABEL_SUBSTRINGS = [".LFB", ".LFE", ".LBB", ".LBE"];

// Sections GCC emits that we never want to assemble. `.section .debug_info`
// is followed by `.4byte 0x62` style data lines that look like instructions
// to a line-by-line filter; tracking section state lets us drop the whole
// block until the next real section switch.
const NOISE_SECTION_PREFIXES = [
  ".debug",
  ".eh_frame",
  ".note",
  ".rodata.str",
  ".gnu",
];
const KEEP_SECTIONS = [".text", ".data", ".rodata", ".bss"];

function isSectionSwitch(trimmed: string): string | null {
  if (/^\.(text|data|rodata|bss)\b/.test(trimmed)) {
    return trimmed.split(/\s+/)[0];
  }
  const m = trimmed.match(/^\.section\s+(\S+)/);
  if (m) return m[1].replace(/[",]+$/, "");
  return null;
}

/**
 * Return the input assembly with noise directives removed. A conservative
 * filter -- keeps everything the user might want to look at (sections,
 * globals, labels, instructions, `.string`/`.word`/`.quad` data emits),
 * drops only the DWARF / CFI / auto-alignment lines the compiler injects.
 * Also tracks section state so any bytes GCC writes into a `.debug_*`
 * or `.eh_frame` section get dropped entirely, not just the header line.
 */
export function filterAssembly(input: string, options: { filterDirectives: boolean }): string {
  if (!options.filterDirectives) return input;
  const lines = input.split("\n");
  const out: string[] = [];
  let inNoiseSection = false;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      if (!inNoiseSection) out.push(raw);
      continue;
    }
    const sectionName = isSectionSwitch(trimmed);
    if (sectionName !== null) {
      const bare = sectionName.replace(/^\.section\s+/, "").replace(/^\./, "");
      const asDotted = "." + bare;
      if (NOISE_SECTION_PREFIXES.some((p) => asDotted.startsWith(p))) {
        inNoiseSection = true;
        continue;
      }
      if (KEEP_SECTIONS.some((p) => asDotted.startsWith(p))) {
        inNoiseSection = false;
        out.push(raw);
        continue;
      }
    }
    if (inNoiseSection) continue;
    if (DROPPED_PREFIXES.some((p) => trimmed.startsWith(p))) continue;
    if (trimmed.endsWith(":") && DROPPED_LABEL_SUBSTRINGS.some((p) => trimmed.startsWith(p))) {
      continue;
    }
    out.push(raw);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

/**
 * True if the assembly looks like it has a real function body in it (at
 * least one instruction, not just scaffolding). Used to decide whether
 * the "load into playground" button should be enabled.
 */
export function looksRunnable(input: string): boolean {
  const lines = input.split("\n");
  let sawInstruction = false;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.startsWith("//") || trimmed.startsWith("#"))
      continue;
    if (trimmed.startsWith(".") || trimmed.endsWith(":")) continue;
    sawInstruction = true;
    break;
  }
  return sawInstruction;
}
