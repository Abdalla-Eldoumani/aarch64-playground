import { loader, type OnMount } from "@monaco-editor/react";
import { docKeyAt, INSTRUCTION_DOCS } from "@/lib/asm/instruction-docs";
import {
  MNEMONIC_ALTERNATION,
  REGISTER_PATTERN,
} from "@/lib/asm/highlight-arm64";
import { buildSuggestions, type Suggestion } from "@/lib/asm/asm-completion";
import { LINE_COMMENT } from "@/lib/asm/line-comment";
import { yieldToEventLoop } from "@/lib/emulator/run-loop";
import { MONACO_FEATURES } from "@/components/playground/monaco-features";
import { isThemeId, THEMES } from "@/lib/theme/themes";
import { monacoTheme } from "@/lib/theme/editor-themes";

// Monaco comes from the monaco-editor dependency, not the loader's default
// CDN: the installed app must work offline, and a campus network that blocks
// CDNs would leave an empty editor. Only the editor core and its widgets load,
// since the language services are megabytes this editor never uses. The import
// is dynamic because monaco is browser-only and a reader who never types
// should not download it.
let monacoLoad: Promise<void> | null = null;

export function loadMonaco(): Promise<void> {
  monacoLoad ??= (async () => {
    // Monaco reads this global lazily, when it first needs a worker. The
    // base editor worker is the only one to wire up (no language services),
    // and it is bundled from the package for the same offline reason.
    self.MonacoEnvironment = {
      getWorker: () =>
        new Worker(
          new URL("monaco-editor/editor/editor.worker.js", import.meta.url),
          // The worker name is also the bundler's chunk name, which is what
          // lets the bundle budget in package.json glob the editor's assets
          // by name instead of by a hashed webpack id that moves with any
          // change to the module graph.
          { name: "monaco-worker" },
        ),
    };
    // The widgets register themselves on import and the API entry registers
    // nothing, so both load, widgets first as monaco's own entry orders them,
    // under one chunk name so the size budget sees one file. Each feature runs
    // in its own task, since one big import blocks input for a quarter second
    // or more. The list's test keeps it in step with monaco's register.all,
    // which is not imported: it would bring back the feature the list leaves out.
    for (const load of MONACO_FEATURES) {
      await load();
      await yieldToEventLoop();
    }
    const monaco = await import(/* webpackChunkName: "monaco" */ "monaco-editor/editor");
    // Every colour the editor can draw, from Monaco's own registry, so the
    // themes give each one a token instead of leaving Monaco's stock ones.
    const [{ Registry }, { Extensions }] = await Promise.all([
      import(/* webpackChunkName: "monaco" */ "monaco-editor/platform/registry/common/platform"),
      import(/* webpackChunkName: "monaco" */ "monaco-editor/platform/theme/common/colorUtils"),
    ]);
    const colourIds = Registry.as(Extensions.ColorContribution).getColors().map((colour) => colour.id);
    await yieldToEventLoop();
    // The first language or theme call starts every editor service. Made
    // here, that start-up is a task of its own instead of part of the
    // editor's creation.
    ensureArm64Registered(monaco, colourIds);
    loader.config({ monaco });
  })();
  return monacoLoad;
}

let arm64Registered = false;

// Monaco takes `fontFamily` as a literal font list and cannot read a CSS
// variable, so this resolves --font-mono (set in app/layout.tsx) rather than
// restating it. That keeps next/font's metric-matched fallback face in front:
// Monaco measures one glyph at creation, and an editor made during the font
// swap kept Consolas's column width.
const MONO_FALLBACKS = "'JetBrains Mono', 'Fira Code', Consolas, monospace";
let monoFontFamily: string | null = null;

export function resolveMonoFontFamily(): string {
  if (monoFontFamily) return monoFontFamily;
  if (typeof document === "undefined") return MONO_FALLBACKS;
  const resolved = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-mono")
    .trim();
  // An empty read means the font stylesheet has not landed yet; answer with
  // the fallbacks and leave the cache unset so a later mount can still catch
  // the real family instead of pinning the miss for the whole session.
  if (!resolved) return MONO_FALLBACKS;
  monoFontFamily = `${resolved}, ${MONO_FALLBACKS}`;
  return monoFontFamily;
}

/** Set Monaco's global theme from the document's data-theme. Called per
 *  mount (the MonacoEditor `theme` prop re-asserts arm64-dark on every
 *  mount) and by the module-level attribute observer on theme switches. */
export function applyDocumentTheme(monaco: Parameters<OnMount>[1]): void {
  const t = document.documentElement.getAttribute("data-theme");
  monaco.editor.setTheme(`arm64-${isThemeId(t) ? t : "dark"}`);
}

/**
 * One-time global setup: the arm64 language, themes, and providers. Monaco's
 * registries are tab-wide and add up, so registering per mount stacked a copy
 * of every hover card and completion on each remount.
 */
function ensureArm64Registered(monaco: Parameters<OnMount>[1], colourIds: readonly string[]): void {
  if (arm64Registered) return;
  arm64Registered = true;

  monaco.languages.register({ id: "arm64" });
  // Comment tokens drive Monaco's built-in toggles: Ctrl+/ (Cmd+/) line-
  // toggles with `//`, Shift+Alt+A block-toggles with the GAS `/* */` pair
  // the m4 pass strips. The commands read this config live, so registering
  // it here (once, before first keypress) is enough.
  monaco.languages.setLanguageConfiguration("arm64", {
    comments: { lineComment: LINE_COMMENT, blockComment: ["/*", "*/"] },
  });
  monaco.languages.setMonarchTokensProvider("arm64", {
    ignoreCase: true,
    tokenizer: {
      root: [
        [/\/\*/, "comment", "@blockComment"],
        [/\/\/.*$/, "comment"],
        [/;.*$/, "comment"],
        // The keyword set is the highlighter's, which is the hover-card
        // table's, which the drift guards pin to the assembler's own
        // SUPPORTED_MNEMONICS: one list, three surfaces. Only the conditional
        // branches are added here, because that table folds the whole family
        // onto a single placeholder entry.
        [
          new RegExp(
            `\\b(${[MNEMONIC_ALTERNATION, ...COND_BRANCHES].join("|")})\\b`,
            "i",
          ),
          "keyword",
        ],
        // The register file, from the same alternation the reading surfaces
        // test against, so the two cannot drift. Its trailing lookahead is
        // what stops Monarch colouring a prefix of a name that is not one:
        // `x31` and `v3.3s` stay plain.
        [new RegExp(REGISTER_PATTERN, "i"), "variable"],
        [/#-?0x[0-9a-fA-F]+/, "number.hex"],
        [/#-?[0-9]+/, "number"],
        [/\w+:/, "type.identifier"],
      ],
      blockComment: [
        [/[^/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[/*]/, "comment"],
      ],
    },
  });

  // One editor theme per site theme, built from the same tokens as the page
  // (Monaco takes literal colours, not CSS variables).
  for (const { id } of THEMES) monaco.editor.defineTheme(`arm64-${id}`, monacoTheme(id, colourIds));

  const observer = new MutationObserver(() => applyDocumentTheme(monaco));
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  // Completion provider: builds context-aware suggestions from the
  // current line + the full source (for labels and m4 aliases).
  type CompletionModel = Parameters<
    Parameters<typeof monaco["languages"]["registerCompletionItemProvider"]>[1]["provideCompletionItems"]
  >[0];
  type CompletionPos = Parameters<
    Parameters<typeof monaco["languages"]["registerCompletionItemProvider"]>[1]["provideCompletionItems"]
  >[1];
  monaco.languages.registerCompletionItemProvider("arm64", {
    triggerCharacters: [".", " ", ",", "[", "$", "_"],
    provideCompletionItems(model: CompletionModel, position: CompletionPos) {
      const line = model.getLineContent(position.lineNumber);
      const source = model.getValue();
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn,
      );
      const suggestions = buildSuggestions({
        source,
        line,
        position: position.column,
      });
      return {
        suggestions: suggestions.map((s) => mapSuggestion(s, monaco, range)),
      };
    },
  });

  // Hover provider: surface a short course-voice summary of the
  // mnemonic under the cursor. Falls back to no-hover when the
  // token under the cursor isn't one we recognize.
  type MonacoModule = typeof monaco;
  type TextModel = Parameters<
    Parameters<MonacoModule["languages"]["registerHoverProvider"]>[1]["provideHover"]
  >[0];
  type MonacoPosition = Parameters<
    Parameters<MonacoModule["languages"]["registerHoverProvider"]>[1]["provideHover"]
  >[1];
  monaco.languages.registerHoverProvider("arm64", {
    async provideHover(model: TextModel, position: MonacoPosition) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      // The lookup rule (including the dotted conditional form) lives beside
      // the table in lib/asm/instruction-docs, so this provider holds none of
      // it and the whole path is pinned without Monaco.
      const line = model.getLineContent(position.lineNumber);
      const key = docKeyAt(line, word.word, word.startColumn);
      if (key === undefined) return null;
      const doc = INSTRUCTION_DOCS[key];
      const lines: string[] = [
        `**${word.word.toLowerCase()}** · ${doc.summary}`,
      ];
      if (doc.details) {
        lines.push("", ...doc.details);
      }
      if (doc.example) {
        lines.push("", "```", doc.example, "```");
      }
      // The C table is 80 KB that only this line reads, so it loads on the
      // first hover instead of with the editor.
      try {
        const { hoverCLine } = await import("@/lib/asm/c-equivalents");
        const c = hoverCLine(key, window.location.origin);
        if (c) lines.push("", c);
      } catch {
        // Offline with an older cache: the card goes out without its C line.
      }
      return {
        range: new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn,
        ),
        contents: [{ value: lines.join("\n") }],
      };
    },
  });
}

const COND_BRANCHES = [
  "B.EQ", "B.NE", "B.HS", "B.LO", "B.MI", "B.PL",
  "B.VS", "B.VC", "B.HI", "B.LS", "B.GE", "B.LT", "B.GT", "B.LE",
  "B.CS", "B.CC",
];


type MonacoForCompletion = Parameters<OnMount>[1];

function mapSuggestion(
  s: Suggestion,
  monaco: MonacoForCompletion,
  range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number },
) {
  const KIND = monaco.languages.CompletionItemKind;
  const kindMap: Record<Suggestion["kind"], number> = {
    directive: KIND.Keyword,
    instruction: KIND.Function,
    register: KIND.Variable,
    alias: KIND.Variable,
    label: KIND.Reference,
    libc: KIND.Function,
  };
  return {
    label: s.label,
    kind: kindMap[s.kind],
    detail: s.detail,
    insertText: s.insertText ?? s.label,
    range,
  };
}
