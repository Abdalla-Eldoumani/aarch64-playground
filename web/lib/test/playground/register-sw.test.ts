import { afterEach, describe, expect, test, vi } from "vitest";
import { registerServiceWorker } from "@/lib/playground/register-sw";

const originalNavigator = global.navigator;
const originalIsSecureContext = (window as { isSecureContext?: boolean }).isSecureContext;

afterEach(() => {
  Object.defineProperty(global, "navigator", {
    value: originalNavigator,
    configurable: true,
  });
  Object.defineProperty(window, "isSecureContext", {
    value: originalIsSecureContext,
    configurable: true,
  });
  vi.restoreAllMocks();
});

function setNavigator(value: unknown): void {
  Object.defineProperty(global, "navigator", {
    value,
    configurable: true,
    writable: true,
  });
}

function setSecureContext(secure: boolean): void {
  Object.defineProperty(window, "isSecureContext", {
    value: secure,
    configurable: true,
  });
}

describe("registerServiceWorker", () => {
  test("does nothing when navigator has no serviceWorker", () => {
    setNavigator({});
    expect(() => registerServiceWorker()).not.toThrow();
  });

  test("does nothing over plain http on a host other than localhost", () => {
    const register = vi.fn();
    setNavigator({ serviceWorker: { register } });
    setSecureContext(false);
    const original = window.location.hostname;
    Object.defineProperty(window, "location", {
      value: { ...window.location, hostname: "example.com" },
      configurable: true,
    });
    registerServiceWorker();
    expect(register).not.toHaveBeenCalled();
    Object.defineProperty(window, "location", {
      value: { ...window.location, hostname: original },
      configurable: true,
    });
  });

  test("registers when context is secure", () => {
    const register = vi.fn().mockResolvedValue({});
    setNavigator({ serviceWorker: { register } });
    setSecureContext(true);
    Object.defineProperty(document, "readyState", {
      value: "complete",
      configurable: true,
    });
    registerServiceWorker();
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  test("swallows registration rejections silently", async () => {
    const register = vi.fn().mockRejectedValue(new Error("nope"));
    setNavigator({ serviceWorker: { register } });
    setSecureContext(true);
    Object.defineProperty(document, "readyState", {
      value: "complete",
      configurable: true,
    });
    // The rejection lands after registerServiceWorker returns, so what counts
    // is that nothing reaches the process as an unhandled rejection.
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      registerServiceWorker();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(register).toHaveBeenCalledTimes(1);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });
});
