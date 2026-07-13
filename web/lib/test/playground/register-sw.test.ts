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
  test("no-ops when serviceWorker isn't on navigator", () => {
    setNavigator({});
    expect(() => registerServiceWorker()).not.toThrow();
  });

  test("no-ops over plain http on a non-localhost host", () => {
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
    expect(() => registerServiceWorker()).not.toThrow();
    await Promise.resolve();
  });
});
