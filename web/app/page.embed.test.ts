import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Page.tsx pulls in Monaco + WASM + Worker; rendering it in jsdom
// blows up before we get to the markup we care about. Instead this
// test pins the contract that the embed-mode CSS rule keys off:
//   - page.tsx marks the source GitHub link with data-embed-hide="1"
//   - globals.css hides any data-embed-hide element when the wrapper
//     carries data-embed="1"
// The visual effect itself is verified in the browser, not here.

describe("embed mode markup contract", () => {
  it("page.tsx marks the source link with data-embed-hide", () => {
    const file = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
    expect(file).toMatch(/data-embed-hide="1"/);
    expect(file).toMatch(/aria-label="View source on GitHub"/);
  });

  it("globals.css hides the source link when the wrapper has data-embed", () => {
    const file = readFileSync(path.join(__dirname, "globals.css"), "utf8");
    // The selector list includes the safe-area header, the share banner,
    // and any descendant carrying data-embed-hide.
    expect(file).toMatch(/\[data-embed="1"\][\s\S]*?data-embed-hide/);
  });
});
