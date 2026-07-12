// pins the service-worker bootstrap: the component renders nothing, the
// guard makes a browser without navigator.serviceWorker mount cleanly,
// and when the api exists it registers /sw.js at the root scope.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { RegisterSW } from "@/components/chrome/RegisterSW";

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window.navigator, "serviceWorker");
});

describe("RegisterSW", () => {
  it("renders nothing and survives a browser without serviceWorker", () => {
    expect("serviceWorker" in navigator).toBe(false);
    const { container } = render(<RegisterSW />);
    expect(container.innerHTML).toBe("");
  });

  it("registers /sw.js at the root scope once the api exists", () => {
    const register = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });
    render(<RegisterSW />);
    // registration may wait for window load when the document is still loading
    window.dispatchEvent(new Event("load"));
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });
});
