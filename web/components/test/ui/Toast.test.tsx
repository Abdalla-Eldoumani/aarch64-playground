import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ToastHost, useToast } from "@/components/ui/Toast";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// react-hot-toast keeps a module-level queue; these tests match on the most
// recent message rather than resetting it.

function Trigger() {
  const t = useToast();
  return (
    <button type="button" onClick={() => t.show("imported main.asm")}>
      fire
    </button>
  );
}

describe("Toast", () => {
  test("renders the message after a show call", async () => {
    render(
      <ToastHost>
        <Trigger />
      </ToastHost>,
    );
    act(() => {
      screen.getByRole("button").click();
    });
    await waitFor(() => {
      expect(screen.getByText("imported main.asm")).toBeTruthy();
    });
  });

  test("renders an explicit error toast", async () => {
    function ErrFire() {
      const t = useToast();
      return (
        <button type="button" onClick={() => t.error("boom")}>
          err
        </button>
      );
    }
    render(
      <ToastHost>
        <ErrFire />
      </ToastHost>,
    );
    act(() => {
      screen.getByRole("button").click();
    });
    await waitFor(() => {
      expect(screen.getByText("boom")).toBeTruthy();
    });
  });

  test("info toast renders without an icon kind", async () => {
    function InfoFire() {
      const t = useToast();
      return (
        <button type="button" onClick={() => t.info("loading")}>
          info
        </button>
      );
    }
    render(
      <ToastHost>
        <InfoFire />
      </ToastHost>,
    );
    act(() => {
      screen.getByRole("button").click();
    });
    await waitFor(() => {
      expect(screen.getByText("loading")).toBeTruthy();
    });
  });
});
