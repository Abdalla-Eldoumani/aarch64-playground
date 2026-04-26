export type CpscRuleId =
  | "alias-suffix"
  | "missing-global-main"
  | "non-canonical-prologue"
  | "non-16-byte-alloc"
  | "bare-x29-x30";

export interface LintMarker {
  line: number;
  column: number;
  endColumn: number;
  severity: "warning";
  message: string;
  ruleId: CpscRuleId;
}

const REGISTER = /^(x([0-9]|[12][0-9]|30)|w([0-9]|[12][0-9]|30)|sp|xzr|wzr)$/i;
const SUFFIX_OK = /_(r|s|m)$/;
const ALIAS_EXEMPT = new Set(["fp", "lr"]);
const DEFINE_RE = /^\s*define\(\s*([A-Za-z_][\w]*)\s*,\s*([^)]+?)\s*\)\s*$/gm;

function aliasSuffixRule(source: string): LintMarker[] {
  const out: LintMarker[] = [];
  const lines = source.split("\n");
  for (const m of source.matchAll(DEFINE_RE)) {
    const name = m[1];
    const body = m[2].trim();
    if (ALIAS_EXEMPT.has(name)) continue;
    // Bare integer literals are constants, not typed-object aliases.
    if (/^-?(\d+|0x[0-9a-fA-F]+)$/.test(body)) continue;
    // Only flag when the body resolves to a register name. Symbols
    // that resolve later to stack offsets / data labels can't be
    // classified here without a full pipeline pass; the alias-suffix
    // rule covers the common register case which is what students miss
    // most.
    if (!REGISTER.test(body)) continue;
    if (SUFFIX_OK.test(name)) continue;
    const matchIndex = m.index ?? 0;
    const before = source.slice(0, matchIndex);
    const line = before.split("\n").length;
    const lineText = lines[line - 1] ?? "";
    const col = lineText.indexOf(name) + 1;
    out.push({
      line,
      column: col,
      endColumn: col + name.length,
      severity: "warning",
      message: `alias \`${name}\` aliases a register; cpsc 355 convention names register aliases with a \`_r\` suffix (e.g. \`${name}_r\`).`,
      ruleId: "alias-suffix",
    });
  }
  return out;
}

function missingGlobalMainRule(source: string): LintMarker[] {
  const lines = source.split("\n");
  let mainLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*main\s*:/.test(lines[i])) {
      mainLine = i + 1;
      break;
    }
  }
  if (mainLine < 0) return [];
  const hasGlobal = lines.some((l) => /^\s*\.glob(al|l)\s+main\b/.test(l));
  if (hasGlobal) return [];
  return [
    {
      line: mainLine,
      column: 1,
      endColumn: 5,
      severity: "warning",
      message: "label `main` is not declared with `.global main`; the loader needs the global symbol to find the entry point.",
      ruleId: "missing-global-main",
    },
  ];
}

function nonCanonicalPrologueRule(source: string): LintMarker[] {
  const lines = source.split("\n");
  const out: LintMarker[] = [];
  // Collect labels marked as global. The directive may appear anywhere
  // in the file (typically just above the label).
  const globalLabels = new Set<string>();
  for (const l of lines) {
    const m = l.match(/^\s*\.glob(?:al|l)\s+([A-Za-z_][\w.$]*)\s*$/);
    if (m) globalLabels.add(m[1]);
  }
  for (let i = 0; i < lines.length; i++) {
    const labelMatch = lines[i].match(/^\s*([A-Za-z_][\w.$]*)\s*:\s*(?:\/\/.*)?$/);
    if (!labelMatch) continue;
    const name = labelMatch[1];
    if (!globalLabels.has(name)) continue;
    // Walk forward, skipping blank and comment-only lines, to find the
    // first two real instructions.
    const real: string[] = [];
    for (let j = i + 1; j < lines.length && real.length < 2; j++) {
      const raw = lines[j].replace(/\/\/.*$/, "").replace(/;.*$/, "").trim();
      if (!raw) continue;
      // A `.directive` here means we're past the function body or in
      // data; not relevant for prologue check.
      if (raw.startsWith(".")) break;
      // A new label means the function had no instructions of its own.
      if (/^[A-Za-z_][\w.$]*\s*:/.test(raw)) break;
      real.push(raw);
    }
    if (real.length < 2) continue;
    const first = real[0].toLowerCase();
    const second = real[1].toLowerCase();
    const stpOk = /^stp\s+fp\s*,\s*lr\s*,\s*\[\s*sp\s*,/.test(first);
    const movOk = /^mov\s+fp\s*,\s*sp\b/.test(second);
    if (stpOk && movOk) continue;
    out.push({
      line: i + 1,
      column: 1,
      endColumn: name.length + 2,
      severity: "warning",
      message: `function \`${name}\` does not begin with the canonical \`stp fp, lr, [sp, ...]!\` then \`mov fp, sp\` prologue.`,
      ruleId: "non-canonical-prologue",
    });
  }
  return out;
}

export function lintSource(source: string): LintMarker[] {
  return [
    ...aliasSuffixRule(source),
    ...missingGlobalMainRule(source),
    ...nonCanonicalPrologueRule(source),
  ].sort((a, b) => a.line - b.line);
}
