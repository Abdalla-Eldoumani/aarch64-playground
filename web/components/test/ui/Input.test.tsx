import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Input } from "@/components/ui/Input";

const THEMES = ["dark", "light", "high-contrast"] as const;

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

function Harness({ mono = false }: { mono?: boolean }) {
  const [value, setValue] = useState("");
  return (
    <Input
      mono={mono}
      aria-label="field"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

describe("Input", () => {
  it("sits on bg-raised with a border and the focus-ring affordance", () => {
    render(<Input aria-label="field" />);
    const input = screen.getByLabelText("field");
    expect(input.className).toContain("bg-[var(--bg-raised)]");
    expect(input.className).toContain("border-[var(--border)]");
    expect(input.className).toContain("focus-visible:[box-shadow:var(--ring)]");
  });

  it("renders mono when the value carries data, sans otherwise", () => {
    render(<Input aria-label="hex" mono />);
    expect(screen.getByLabelText("hex").className).toContain("font-mono");
    cleanup();
    render(<Input aria-label="name" />);
    const sans = screen.getByLabelText("name");
    expect(sans.className).toContain("font-sans");
    expect(sans.className).not.toContain("font-mono");
  });

  it("defaults type to text and forwards native attributes", () => {
    render(<Input aria-label="field" placeholder="argv..." />);
    const input = screen.getByLabelText("field") as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.placeholder).toBe("argv...");
  });

  it("is controllable through native value/onChange", () => {
    render(<Harness />);
    const input = screen.getByLabelText("field") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "x0" } });
    expect(input.value).toBe("x0");
  });

  it("renders under every theme without crashing", () => {
    for (const theme of THEMES) {
      document.documentElement.setAttribute("data-theme", theme);
      const { unmount } = render(<Input aria-label="themed" />);
      expect(screen.getByLabelText("themed")).toBeTruthy();
      unmount();
    }
  });
});
