import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { BootFlashList } from "@/components/diagrams/BootFlashList";

// The contract: the boot stagger is armed by a class this list adds after
// mount, so the entrance answers hydration and never the landing's first paint.

afterEach(() => cleanup());

describe("BootFlashList", () => {
  it("keeps the arming class out of the server HTML", () => {
    const html = renderToStaticMarkup(
      <BootFlashList className="rail">
        <li>x0</li>
      </BootFlashList>,
    );
    expect(html).toContain('class="rail"');
    expect(html).not.toContain("boot-flash-armed");
  });

  it("arms the stagger once mounted, keeping the caller's classes", () => {
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
