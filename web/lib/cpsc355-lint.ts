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

export function lintSource(source: string): LintMarker[] {
  return [
    ...aliasSuffixRule(source),
    ...missingGlobalMainRule(source),
  ].sort((a, b) => a.line - b.line);
}
