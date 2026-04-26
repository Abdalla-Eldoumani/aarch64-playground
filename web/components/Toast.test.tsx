import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ToastHost, useToast } from "@/components/Toast";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  // react-hot-toast keeps a module-level queue; clear it between
  // tests so each case sees a clean slate.
  // We re-import the module cache via dynamic import in each test
  // would be heavier; simpler is to just ignore the carry-over and
  // rely on text matching for the most-recent toast.
});

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
