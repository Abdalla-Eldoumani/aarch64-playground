// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// A phone keyboard capitalises the first letter, "corrects" a mnemonic into
// a word, and underlines a label as a typo. Every field that takes code or a
// name turns all three off. Each entry finds one input by a marker inside its
// opening tag, so a renamed or removed field fails here instead of passing
// unchecked.
const CODE_INPUTS = [
  { what: "the reference filter", file: "components/reference/InstructionReference.tsx", marker: 'placeholder="ldr, multiply, x * y"' },
  { what: "the watch box", file: "components/panels/WatchPanel.tsx", marker: 'aria-label="watch expression"' },
  { what: "the memory address box", file: "components/panels/MemoryPanel.tsx", marker: 'aria-label="memory base address"' },
  { what: "a memory watch's label", file: "components/panels/MemoryWatches.tsx", marker: 'aria-label="watch label"' },
  { what: "a memory watch's address", file: "components/panels/MemoryWatches.tsx", marker: 'aria-label="watch address"' },
  { what: "the playground's arguments", file: "components/playground/ArgsInput.tsx", marker: 'aria-label="args (command-line arguments)"' },
  { what: "an embed's arguments", file: "components/playground/EmbedLayout.tsx", marker: "maxLength={MAX_ARGS_CHARS}" },
  { what: "stdin", file: "components/panels/ConsolePanel.tsx", marker: 'aria-label="Standard input"' },
  { what: "the converter", file: "components/panels/BaseConverter.tsx", marker: "aria-describedby={`${id}-message`}" },
  { what: "a new file's name", file: "components/playground/MultiFileTabs.tsx", marker: 'aria-label="new file name"' },
  { what: "the touch editor", file: "components/playground/TouchEditor.tsx", marker: "ref={taRef}" },
  { what: "a blank's answer", file: "components/practice/BlanksBlock.tsx", marker: "<input" },
  { what: "a prediction's answer", file: "components/practice/PredictionBlock.tsx", marker: "<input" },
];

const REQUIRED = ['spellCheck={false}', 'autoCorrect="off"', 'autoCapitalize="off"'];

/** The opening tag of the input or textarea whose attributes hold `marker`. */
function openingTag(source: string, marker: string): string | null {
  const at = source.indexOf(marker);
  if (at < 0) return null;
  const start = Math.max(source.lastIndexOf("<input", at), source.lastIndexOf("<textarea", at));
  const end = source.indexOf("/>", at);
  if (start < 0 || end < 0 || source.slice(start, at).includes("/>")) return null;
  return source.slice(start, end);
}

describe("fields that take code or names", () => {
  it.each(CODE_INPUTS.map((entry) => [entry.what, entry] as const))(
    "%s turns off spellcheck, autocorrect and autocapitalize",
    (_what, { file, marker }) => {
      const tag = openingTag(fs.readFileSync(path.join(process.cwd(), file), "utf8"), marker);
      expect(tag, `${file}: no input carries ${marker}`).not.toBeNull();
      for (const attribute of REQUIRED) expect(tag, `${file} lacks ${attribute}`).toContain(attribute);
    },
  );
});
