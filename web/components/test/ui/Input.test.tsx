import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Input } from "@/components/ui/Input";

afterEach(() => {
  cleanup();
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
});
