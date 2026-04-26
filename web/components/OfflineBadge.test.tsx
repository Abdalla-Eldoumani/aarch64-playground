import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { OfflineBadge } from "./OfflineBadge";

afterEach(() => cleanup());

describe("OfflineBadge", () => {
  it("renders nothing when navigator.onLine is true", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    const { container } = render(<OfflineBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a status node when navigator.onLine is false", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const { container } = render(<OfflineBadge />);
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.textContent).toMatch(/offline/i);
  });
});
