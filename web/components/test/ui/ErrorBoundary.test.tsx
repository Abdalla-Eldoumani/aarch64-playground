// The boundary's whole contract: children render untouched until one throws,
// then the fallback names the failed surface and the throw never escapes to
// the test's own error boundary, which is how a panel crash would unmount
// the whole playground.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

afterEach(cleanup);

function Bomb(): never {
  throw new Error("panel exploded");
}

describe("ErrorBoundary", () => {
  it("renders its children when nothing throws", () => {
    render(
      <ErrorBoundary label="memory">
        <div>rows</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("rows")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("replaces a throwing child with a fallback naming the surface", () => {
    // React logs the caught error to console.error; silence it so the suite
    // output stays readable without weakening the assertion.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary label="memory">
        <Bomb />
      </ErrorBoundary>,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("memory view hit an error");
    spy.mockRestore();
  });

  it("contains the failure to the boundary that wrapped it", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <div>
        <ErrorBoundary label="stack">
          <Bomb />
        </ErrorBoundary>
        <div>the neighbour panel</div>
      </div>,
    );
    expect(screen.getByText("the neighbour panel")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    spy.mockRestore();
  });
});
