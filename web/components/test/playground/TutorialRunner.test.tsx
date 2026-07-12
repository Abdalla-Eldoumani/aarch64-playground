// pins the tutorial runner: a modal that walks fixture steps with
// clamped back/next, persists per-tutorial progress through the real
// localStorage store, fetches the backing source on demand (surfacing
// fetch failures inline), and verifies expected-register checks as
// OK / no / ? against the live getter.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TutorialRunner } from "@/components/playground/TutorialRunner";
import type { Tutorial } from "@/lib/content/tutorials";

const FIX = vi.hoisted(() => {
  const tutorials = [
    {
      id: "fixture-a",
      title: "fixture tutorial",
      summary: "a three step fixture",
      sourcePath: "/examples/cpsc355/fixture.s",
      args: "3 4",
      stdin: "7\n",
      steps: [
        { title: "first step", body: "read the prologue" },
        {
          title: "second step",
          body: "check the register",
          expect: { reg: "x19", value: 47, note: "a = 47" },
        },
        { title: "third step", body: "done" },
      ],
    },
    {
      id: "fixture-b",
      title: "other tutorial",
      summary: "a one step fixture",
      sourcePath: "/examples/cpsc355/other.s",
      steps: [{ title: "only step", body: "solo" }],
    },
  ];
  return { tutorials };
});

// swap in fixture tutorials but keep the real progress store so
// persistence runs through the actual localStorage round-trip
vi.mock("@/lib/content/tutorials", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content/tutorials")>();
  return { ...actual, TUTORIALS: FIX.tutorials as Tutorial[] };
});

const PROGRESS_KEY = "aarch64-playground:tutorial-progress";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

function renderRunner(overrides: Partial<Parameters<typeof TutorialRunner>[0]> = {}) {
  const onClose = vi.fn();
  const onLoadSnippet = vi.fn();
  const utils = render(
    <TutorialRunner
      open={true}
      onClose={onClose}
      onLoadSnippet={onLoadSnippet}
      {...overrides}
    />,
  );
  return { onClose, onLoadSnippet, ...utils };
}

function nextButton() {
  return screen.getByRole("button", { name: "next" });
}
function backButton() {
  return screen.getByRole("button", { name: "back" });
}

describe("TutorialRunner open and close", () => {
  it("renders nothing while closed", () => {
    renderRunner({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens as a modal on the first tutorial's first step", () => {
    renderRunner();
    expect(screen.getByRole("dialog", { name: "guided tutorial" })).toBeTruthy();
    expect(screen.getByText("a three step fixture")).toBeTruthy();
    expect(screen.getByText("step 1 / 3")).toBeTruthy();
    expect(screen.getByText("first step")).toBeTruthy();
  });

  it("closes from the close button, the backdrop, and Escape, but not inner clicks", () => {
    const { onClose } = renderRunner();
    fireEvent.click(screen.getByText("read the prologue"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "close" }));
    fireEvent.click(screen.getByRole("dialog", { name: "guided tutorial" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe("TutorialRunner step navigation", () => {
  it("clamps at both ends: back disabled on the first step, next on the last", () => {
    renderRunner();
    expect(backButton().hasAttribute("disabled")).toBe(true);
    fireEvent.click(nextButton());
    fireEvent.click(nextButton());
    expect(screen.getByText("step 3 / 3")).toBeTruthy();
    expect(nextButton().hasAttribute("disabled")).toBe(true);
    expect(backButton().hasAttribute("disabled")).toBe(false);
    fireEvent.click(backButton());
    expect(screen.getByText("step 2 / 3")).toBeTruthy();
  });

  it("persists progress per tutorial and resumes from the stored step", () => {
    const { unmount } = renderRunner();
    fireEvent.click(nextButton());
    expect(JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? "{}")).toEqual({
      "fixture-a": 1,
    });
    unmount();
    renderRunner();
    expect(screen.getByText("step 2 / 3")).toBeTruthy();
    expect(screen.getByText("second step")).toBeTruthy();
  });

  it("switches tutorials from the select, each keeping its own step slot", () => {
    renderRunner();
    fireEvent.click(nextButton());
    fireEvent.click(screen.getByRole("combobox", { name: "tutorial" }));
    fireEvent.pointerDown(screen.getByText("other tutorial"));
    expect(screen.getByText("step 1 / 1")).toBeTruthy();
    expect(screen.getByText("only step")).toBeTruthy();
    fireEvent.click(screen.getByRole("combobox", { name: "tutorial" }));
    fireEvent.pointerDown(screen.getByText("fixture tutorial"));
    expect(screen.getByText("step 2 / 3")).toBeTruthy();
  });
});

describe("TutorialRunner load source", () => {
  it("fetches the backing file and hands it over with the tutorial's args and stdin", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "mov x0, 1",
    });
    vi.stubGlobal("fetch", fetchMock);
    const { onLoadSnippet } = renderRunner();
    fireEvent.click(screen.getByRole("button", { name: "load source" }));
    await waitFor(() => expect(onLoadSnippet).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/examples/cpsc355/fixture.s");
    expect(onLoadSnippet).toHaveBeenCalledWith("mov x0, 1", "fixture tutorial", "3 4", "7\n");
  });

  it("surfaces an http failure inline and loads nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" }),
    );
    const { onLoadSnippet } = renderRunner();
    fireEvent.click(screen.getByRole("button", { name: "load source" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("404 Not Found");
    expect(onLoadSnippet).not.toHaveBeenCalled();
  });

  it("surfaces a network failure's message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    renderRunner();
    fireEvent.click(screen.getByRole("button", { name: "load source" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("network down");
  });
});

describe("TutorialRunner expected-register check", () => {
  function openOnExpectStep(getRegister?: (name: string) => string | null) {
    // the fixture's second step carries expect: x19 = 47
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ "fixture-a": 1 }));
    return renderRunner({ getRegister });
  }

  it("marks OK when the register holds the expected value (hex accepted)", () => {
    openOnExpectStep(() => "0x2f");
    expect(screen.getByText("[OK, actual 47]")).toBeTruthy();
  });

  it("marks no when the register holds something else", () => {
    openOnExpectStep(() => "5");
    expect(screen.getByText("[no, actual 5]")).toBeTruthy();
  });

  it("marks ? when no live state is available", () => {
    openOnExpectStep(() => null);
    expect(screen.getByText("[?]")).toBeTruthy();
  });

  it("spells out the expectation with its note", () => {
    openOnExpectStep(() => "0x2f");
    expect(screen.getByText("x19")).toBeTruthy();
    expect(screen.getByText("47")).toBeTruthy();
    expect(screen.getByText(/a = 47/)).toBeTruthy();
  });
});
