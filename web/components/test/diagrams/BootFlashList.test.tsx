import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { BootFlashList } from "@/components/diagrams/BootFlashList";

// The entrance animation class is added only after mount, so it never slows
// the landing's first paint on a slow phone.

afterEach(() => cleanup());

describe("BootFlashList", () => {
  it("keeps the animation class out of the server HTML", () => {
    const html = renderToStaticMarkup(
      <BootFlashList className="rail">
        <li>x0</li>
      </BootFlashList>,
    );
    expect(html).toContain('class="rail"');
    expect(html).not.toContain("boot-flash-armed");
  });

  it("adds the animation class once mounted, keeping the caller's classes", () => {
    const { container } = render(
      <BootFlashList className="rail">
        <li>x0</li>
      </BootFlashList>,
    );
    const list = container.querySelector("ul");
    expect(list).not.toBeNull();
    expect(list!.className).toBe("rail boot-flash-armed");
    expect(list!.textContent).toBe("x0");
  });
});
