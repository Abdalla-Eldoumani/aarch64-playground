import { describe, expect, it } from "vitest";
import type { Action } from "@/lib/playground/commands";

// commands.ts is the shared action registry contract: the palette, the
// shortcuts modal, and the header buttons all consume the same Action shape.
// These tests pin that shape at compile time (a renamed or retyped field
// fails tsc here) and exercise it the way the palette does at runtime.

describe("Action shape", () => {
  it("carries id, label, description, and a runnable handler", () => {
    const ran: string[] = [];
    const action: Action = {
      id: "run",
      label: "Run program",
      description: "Assemble and run to completion",
      shortcut: "F5",
      run: () => {
        ran.push("run");
      },
    };
    expect(action.id).toBe("run");
    expect(action.shortcut).toBe("F5");
    action.run();
    expect(ran).toEqual(["run"]);
  });

  it("treats shortcut as optional, so unbound actions still satisfy the type", () => {
    const action: Action = {
      id: "share",
      label: "Copy share link",
      description: "Copy a link to the current editor state",
      run: () => {},
    };
    expect(action.shortcut).toBeUndefined();
  });

  it("supports palette-style lookup and dispatch over a registry list", () => {
    const fired: string[] = [];
    const make = (id: string): Action => ({
      id,
      label: id,
      description: id,
      run: () => {
        fired.push(id);
      },
    });
    const registry: Action[] = [make("assemble"), make("step"), make("reset")];
    registry.find((a) => a.id === "step")?.run();
    expect(fired).toEqual(["step"]);
  });
});
