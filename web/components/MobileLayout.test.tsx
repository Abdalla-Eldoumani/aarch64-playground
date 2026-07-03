import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { MobileLayout } from "@/components/MobileLayout";

afterEach(() => cleanup());

const allBlocks = {
  editor: <div data-testid="ed" />,
  disassembly: <div data-testid="disasm" />,
  registers: <div data-testid="regs" />,
  memory: <div data-testid="mem" />,
  stack: <div data-testid="stack" />,
  console: <div data-testid="con" />,
  terminal: <div data-testid="term" />,
  watches: <div data-testid="watch" />,
  converter: <div data-testid="conv" />,
  memwatch: <div data-testid="memwatch" />,
  saves: <div data-testid="saves" />,
};

/** A tablist scoped by its aria-label (re-queried so it survives re-renders). */
function tablist(container: HTMLElement, label: string): HTMLElement {
  return container.querySelector(
    `[role="tablist"][aria-label="${label}"]`,
  ) as HTMLElement;
}

const strip = (container: HTMLElement) => tablist(container, "view switcher");

describe("MobileLayout", () => {
  test("the group strip is the last child of the root", () => {
    const { container } = render(<MobileLayout {...allBlocks} />);
    const root = container.firstChild as HTMLElement;
    const last = root.lastChild as HTMLElement;
    expect(last.getAttribute("role")).toBe("tablist");
    expect(last.getAttribute("aria-label")).toBe("view switcher");
  });

  test("condenses the eleven panes into five use-case groups in order", () => {
    const { container } = render(<MobileLayout {...allBlocks} />);
    const labels = within(strip(container))
      .getAllByRole("tab")
      .map((t) => t.textContent?.trim());
    expect(labels).toEqual(["view", "state", "inspect", "tools", "save"]);
  });

  test("group targets are 44px and the strip does not scroll horizontally", () => {
    const { container } = render(<MobileLayout {...allBlocks} />);
    const s = strip(container);
    expect(s.className).not.toContain("overflow-x-auto");
    for (const tab of within(s).getAllByRole("tab")) {
      expect(tab.className).toContain("h-11");
    }
  });

  test("a multi-member group shows an in-pane sub-switch; a single-member group hides it", () => {
    const { container, queryByRole } = render(<MobileLayout {...allBlocks} />);
    // The default "view" group carries two panes -> a sub-switch.
    expect(
      within(tablist(container, "view panes"))
        .getAllByRole("tab")
        .map((t) => t.textContent?.trim()),
    ).toEqual(["code", "disasm"]);

    // "state" is registers alone -> no sub-switch.
    fireEvent.click(within(strip(container)).getByRole("tab", { name: "state" }));
    expect(queryByRole("tablist", { name: "state panes" })).toBeNull();

    // "inspect" carries memory + stack + console.
    fireEvent.click(
      within(strip(container)).getByRole("tab", { name: "inspect" }),
    );
    expect(
      within(tablist(container, "inspect panes"))
        .getAllByRole("tab")
        .map((t) => t.textContent?.trim()),
    ).toEqual(["memory", "stack", "console"]);

    // "tools" carries terminal + watches + the base converter.
    fireEvent.click(within(strip(container)).getByRole("tab", { name: "tools" }));
    expect(
      within(tablist(container, "tools panes"))
        .getAllByRole("tab")
        .map((t) => t.textContent?.trim()),
    ).toEqual(["terminal", "watches", "convert"]);
  });

  test("a host pane request selects the named pane and its group", () => {
    const { container, getByTestId, queryByTestId, rerender } = render(
      <MobileLayout {...allBlocks} />,
    );
    expect(queryByTestId("conv")).toBeNull();
    rerender(
      <MobileLayout {...allBlocks} paneRequest={{ pane: "convert", nonce: 1 }} />,
    );
    expect(getByTestId("conv")).toBeTruthy();
    expect(
      within(strip(container))
        .getByRole("tab", { name: "tools" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    // The strip still works by hand after a request.
    fireEvent.click(within(strip(container)).getByRole("tab", { name: "view" }));
    expect(getByTestId("ed")).toBeTruthy();
  });

  test("the in-pane sub-switch reaches a non-default member", () => {
    const { container, getByTestId, queryByTestId } = render(
      <MobileLayout {...allBlocks} />,
    );
    // view -> code is on screen by default; disasm is not yet mounted.
    expect(getByTestId("ed")).toBeTruthy();
    expect(queryByTestId("disasm")).toBeNull();
    fireEvent.click(
      within(tablist(container, "view panes")).getByRole("tab", {
        name: "disasm",
      }),
    );
    expect(getByTestId("disasm")).toBeTruthy();
  });

  test("the console-blocked dot sits on the inspect group", () => {
    const { container } = render(<MobileLayout {...allBlocks} consoleBlocked />);
    const inspectTab = within(strip(container)).getByRole("tab", {
      name: "inspect",
    });
    expect(inspectTab.querySelector('span[aria-hidden="true"]')).not.toBeNull();
  });
});
