// Pins the home-screen tip: shown to Safari on an iPhone, never to other
// browsers or an installed copy, its height published while it shows, and
// gone for good once dismissed.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InstallHint } from "@/components/chrome/InstallHint";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const original = navigator.userAgent;

function asBrowser(ua: string, standalone = false): void {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
  Object.defineProperty(window.navigator, "standalone", { value: standalone, configurable: true });
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  asBrowser(original);
});

const tip = () => screen.queryByRole("complementary", { name: "install tip" });

describe("InstallHint", () => {
  it("tells Safari on an iPhone how to add the site to the home screen", () => {
    asBrowser(IPHONE_SAFARI);
    render(<InstallHint />);
    expect(tip()?.textContent).toContain("Add to Home Screen");
  });

  it("stays away from other iOS browsers, Android, and an installed copy", () => {
    for (const [ua, standalone] of [
      [IPHONE_CHROME, false],
      [ANDROID_CHROME, false],
      [IPHONE_SAFARI, true],
    ] as const) {
      asBrowser(ua, standalone);
      render(<InstallHint />);
      expect(tip()).toBeNull();
      cleanup();
    }
  });

  it("publishes its height while it shows, so a lesson card can sit above it", () => {
    // jsdom has no layout: the observer fires on observe, as the browser's
    // does, and the tip reports the height a four-line wrap gives at 320px.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private readonly fire: () => void) {}
        observe() {
          this.fire();
        }
        disconnect() {}
      },
    );
    const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(107);
    const root = document.documentElement.style;
    try {
      asBrowser(IPHONE_SAFARI);
      render(<InstallHint />);
      expect(root.getPropertyValue("--install-tip-height")).toBe("107px");
      fireEvent.click(screen.getByRole("button", { name: "dismiss the install tip" }));
      expect(root.getPropertyValue("--install-tip-height")).toBe("");
    } finally {
      height.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("goes for good once dismissed", () => {
    asBrowser(IPHONE_SAFARI);
    render(<InstallHint />);
    fireEvent.click(screen.getByRole("button", { name: "dismiss the install tip" }));
    expect(tip()).toBeNull();
    cleanup();
    render(<InstallHint />);
    expect(tip()).toBeNull();
  });
});
