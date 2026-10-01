import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { LessonNav } from "@/components/learn/LessonNav";
import { PRACTICE_SIDES } from "@/lib/content/practice-topics";

// The foot of a lesson: practise-this links above a previous button on the
// left and a next button on the right, each naming its target's number and
// title, as the first, a middle, and the last lesson render them.

afterEach(() => cleanup());

const [CODE, THEORY] = PRACTICE_SIDES;

const PREVIOUS = { href: "/learn/registers", number: "4.3", title: "Registers" };
const NEXT = { href: "/learn/printing", number: "4.5", title: "Printing" };
const PRACTICE_PAGE = { href: "/practice", number: "05", title: "Practice" };

function buttons(): HTMLAnchorElement[] {
  const nav = screen.getByRole("navigation", { name: "Previous and next lesson" });
  return within(nav).getAllByRole("link") as HTMLAnchorElement[];
}

describe("LessonNav", () => {
  it("puts previous before next in a middle lesson, each with its number and title", () => {
    render(<LessonNav previous={PREVIOUS} next={NEXT} practice={[]} />);
    const [previous, next] = buttons();
    expect(previous.getAttribute("href")).toBe("/learn/registers");
    expect(previous.textContent).toContain("previous");
    expect(previous.textContent).toContain("4.3");
    expect(previous.textContent).toContain("Registers");
    expect(next.getAttribute("href")).toBe("/learn/printing");
    expect(next.textContent).toContain("next");
    expect(next.textContent).toContain("4.5");
    expect(next.textContent).toContain("Printing");
  });

  it("names each button without the arrow or the dot", () => {
    render(<LessonNav previous={PREVIOUS} next={NEXT} practice={[]} />);
    expect(screen.getByRole("link", { name: "previous 4.3 Registers" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "next 4.5 Printing" })).toBeTruthy();
  });

  it("shows only a next button on the first lesson, still in the right-hand column", () => {
    render(<LessonNav next={NEXT} practice={[]} />);
    const only = buttons();
    expect(only).toHaveLength(1);
    expect(only[0].getAttribute("href")).toBe("/learn/printing");
    expect(only[0].className.split(" ")).toContain("sm:col-start-2");
    cleanup();
    render(<LessonNav previous={PREVIOUS} next={NEXT} practice={[]} />);
    expect(buttons()[0].className.split(" ")).not.toContain("sm:col-start-2");
  });

  it("sends the last lesson's next button to practice", () => {
    render(<LessonNav previous={PREVIOUS} next={PRACTICE_PAGE} practice={[]} />);
    const next = buttons()[1];
    expect(next.getAttribute("href")).toBe("/practice");
    expect(next.textContent).toContain("05");
    expect(next.textContent).toContain("Practice");
  });

  it("lists coding exercises and theory sets above the buttons", () => {
    const { container } = render(
      <LessonNav
        previous={PREVIOUS}
        next={NEXT}
        practice={[
          { side: CODE, links: [{ href: "/practice/sum-it", title: "Sum it", difficulty: "intro" }] },
          {
            side: THEORY,
            links: [
              { href: "/practice/quiz-a", title: "Quiz A", difficulty: "core" },
              { href: "/practice/blanks-b", title: "Blanks B" },
            ],
          },
        ]}
      />,
    );
    const section = screen.getByRole("region", { name: "Practise this" });
    expect(within(section).getByRole("heading", { name: "Coding exercises" })).toBeTruthy();
    expect(within(section).getByRole("heading", { name: "Theory sets" })).toBeTruthy();
    const hrefs = within(section)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(["/practice/sum-it", "/practice/quiz-a", "/practice/blanks-b"]);
    expect(screen.getByRole("link", { name: "Sum it intro" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Blanks B" })).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Previous and next lesson" });
    expect(section.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll("h3")).toHaveLength(2);
  });

  it("leaves out the practise-this block when the lesson links no exercise", () => {
    render(<LessonNav previous={PREVIOUS} next={NEXT} practice={[]} />);
    expect(screen.queryByRole("region", { name: "Practise this" })).toBeNull();
    expect(screen.queryByText("Practise this")).toBeNull();
  });
});
