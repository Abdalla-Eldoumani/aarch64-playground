// Pins which bar the header band draws: the tools in the wide band, and in a
// short window the home link and the site menu in their place, since that
// window drops the site bar and moves the tools to the run row.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/playground",
}));

import { PlaygroundHeaderBand } from "@/components/playground/PlaygroundHeaderBand";

afterEach(() => cleanup());

function band(short: boolean) {
  return render(
    <PlaygroundHeaderBand
      short={short}
      onLoadProgram={vi.fn()}
      source="main: ret"
      files={[]}
      importTarget={{ kind: "main" }}
      onImport={vi.fn()}
      onImportMany={vi.fn()}
      recent={{ entries: [], clear: vi.fn() }}
      args=""
      onArgsChange={vi.fn()}
      runMode={null}
      onShare={vi.fn()}
      onTutorials={vi.fn()}
      onToggleTheme={vi.fn()}
      buildDiagnostic={vi.fn(async () => ({ source: "" }))}
      onOpenCommandPalette={vi.fn()}
      onOpenShortcuts={vi.fn()}
      onWalkthrough={vi.fn()}
    />,
  );
}

describe("PlaygroundHeaderBand", () => {
  it("carries the tools under the site bar", () => {
    band(false);
    expect(screen.getByRole("group", { name: "share and tools" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "open navigation" })).toBeNull();
  });

  it("stands in for the site bar in a short window", () => {
    band(true);
    expect(screen.getByRole("link", { name: /home/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "open navigation" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "share and tools" })).toBeNull();
    // The program controls stay in the band.
    expect(screen.getByRole("textbox", { name: "args (command-line arguments)" })).toBeTruthy();
  });
});
