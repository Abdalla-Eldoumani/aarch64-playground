import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ToastHost, useToast } from "@/components/ui/Toast";

type ToastApi = ReturnType<typeof useToast>;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// react-hot-toast keeps a module-level queue; these tests match on the most
// recent message rather than resetting it.

function Trigger({ fire }: { fire: (t: ToastApi) => void }) {
  const t = useToast();
  return (
    <button type="button" onClick={() => fire(t)}>
      fire
    </button>
  );
}

/** Show one toast and return the bar that holds its message and icon. */
async function toastBar(fire: (t: ToastApi) => void, message: string): Promise<HTMLElement> {
  render(
    <ToastHost>
      <Trigger fire={fire} />
    </ToastHost>,
  );
  act(() => {
    screen.getByRole("button").click();
  });
  const text = await waitFor(() => screen.getByText(message));
  return text.parentElement as HTMLElement;
}

// The icon's ink is the only thing that tells the kinds apart at a glance:
// a green check, a red cross, or nothing for a neutral note.
const iconInk = (bar: HTMLElement) => bar.querySelector("[primary]")?.getAttribute("primary") ?? null;

describe("Toast", () => {
  test("show and success draw the check in the success ink", async () => {
    expect(iconInk(await toastBar((t) => t.show("imported main.asm"), "imported main.asm"))).toBe(
      "var(--success)",
    );
    cleanup();
    expect(iconInk(await toastBar((t) => t.success("saved"), "saved"))).toBe("var(--success)");
  });

  test("an error toast draws the cross in the danger ink", async () => {
    expect(iconInk(await toastBar((t) => t.error("boom"), "boom"))).toBe("var(--danger)");
  });

  test("an info toast draws no icon", async () => {
    expect(iconInk(await toastBar((t) => t.info("loading"), "loading"))).toBeNull();
  });
});
