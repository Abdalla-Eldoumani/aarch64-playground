// pins the share dialog: the textarea carries a URL whose #p2= hash
// round-trips back to the exact editor state, copy writes that URL to
// the clipboard and confirms with a transient label, and the modal
// closes from button, backdrop, and Escape.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ShareDialog } from "@/components/playground/ShareDialog";
import { readShareHash, type ShareState } from "@/lib/playground/share";

// readShareHash returns a discriminated verdict; these tests only
// care about the ok payload.
function okShareState(hash: string) {
  const r = readShareHash(hash);
  if (r.kind !== "ok") throw new Error(`expected ok, got ${r.kind}`);
  return r.state;
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window.navigator, "clipboard");
});

const STATE: ShareState = {
  source: "mov x0, 1\nret",
  args: "3 4",
  stdin: "7\n",
  cursor: { line: 2, column: 1 },
};

function renderDialog(open = true) {
  const onClose = vi.fn();
  render(<ShareDialog open={open} state={STATE} onClose={onClose} />);
  return onClose;
}

function urlValue(): string {
  return (screen.getByLabelText("shareable url") as HTMLTextAreaElement).value;
}

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}

describe("ShareDialog", () => {
  it("renders nothing while closed", () => {
    renderDialog(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows a same-origin URL whose hash decodes back to the exact state", () => {
    renderDialog();
    const url = urlValue();
    expect(url.startsWith(`${window.location.origin}/`)).toBe(true);
    expect(url).toContain("#p2=");
    const decoded = okShareState(url.slice(url.indexOf("#")));
    expect(decoded).toEqual(STATE);
  });

  it("copies the shown URL and flips the button to copied", async () => {
    const writeText = stubClipboard();
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "copy link" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "copied" })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(urlValue());
  });

  it("falls back to copy when the platform has no navigator.share", async () => {
    const writeText = stubClipboard();
    renderDialog();
    expect("share" in navigator).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "share" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  });

  it("closes from the close button, the backdrop, and Escape, but not inner clicks", () => {
    const onClose = renderDialog();
    fireEvent.click(screen.getByLabelText("shareable url"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "close" }));
    fireEvent.click(screen.getByRole("dialog", { name: "share program" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe("ShareDialog over the fragment cap", () => {
  // A real multi-file workspace does not fit in a URL fragment: the
  // receiver's 12 KB wall rejects it. Offering the link anyway moves the
  // failure to the recipient's screen.
  const BIG: ShareState = {
    source: "mov x0, 1\nret\n",
    files: Array.from({ length: 12 }, (_, i) => ({
      name: `part${i}.s`,
      body: Array.from(
        { length: 400 },
        (_, n) => `        add x${n % 28}, x${(n + 1) % 28}, ${n}   // part ${i} line ${n}`,
      ).join("\n"),
    })),
  };

  it("refuses to offer a link the receiver would reject", () => {
    render(<ShareDialog open state={BIG} onClose={vi.fn()} />);
    expect(screen.queryByLabelText("shareable url")).toBeNull();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("too large to share as a link");
    expect(alert.textContent).toContain(".json");
    expect(screen.getByRole("button", { name: "copy link" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: "share" })).toHaveProperty(
      "disabled",
      true,
    );
    // Closing is still the way out.
    expect(screen.getByRole("button", { name: "close" })).toHaveProperty(
      "disabled",
      false,
    );
  });

  it("leaves a workspace that does fit completely alone", () => {
    render(
      <ShareDialog
        open
        state={{ source: "mov x0, 1\nret\n", files: [{ name: "util.s", body: "ret\n" }] }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("shareable url")).toBeTruthy();
    expect(screen.getByRole("button", { name: "copy link" })).toHaveProperty(
      "disabled",
      false,
    );
  });
});
