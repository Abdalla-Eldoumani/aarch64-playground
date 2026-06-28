import type { JSX } from "react";
import { CodeBlock } from "./CodeBlock";
import { LessonMarkdown } from "./LessonMarkdown";

/**
 * The five recurring CPSC 355 traps, each a card with an original wrong example,
 * an original right example, and a one-line cause. The snippets render through
 * the read-only CodeBlock (text spans only, no injection path) and the cause
 * flows through LessonMarkdown (the single sanitizing Markdown renderer, no
 * second path and no raw-HTML injection). Wrong vs right are distinguished by
 * a text label plus a token accent (--danger / --success), never color alone and
 * never raw red/green. The asm is original and authentic course style:
 * lowercase mnemonics, the stp/ldp fp,lr prologue/epilogue, and the 16-byte
 * alignment discipline. Token-only and reduced-motion safe.
 */

interface Pitfall {
  title: string;
  cause: string;
  wrong: string;
  right: string;
}

const PITFALLS: Pitfall[] = [
  {
    title: "16-byte stack alignment",
    cause: "sp must stay 16-byte aligned at every call boundary.",
    wrong: `main:
        stp     fp, lr, [sp, -8]!
        mov     fp, sp
        bl      work
        ldp     fp, lr, [sp], 8
        ret`,
    right: `main:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      work
        ldp     fp, lr, [sp], 16
        ret`,
  },
  {
    title: "saving and restoring fp and lr",
    cause: "bl overwrites lr, so a function that calls must save and restore fp and lr.",
    wrong: `greet:
        bl      puts
        ret`,
    right: `greet:
        stp     fp, lr, [sp, -16]!
        mov     fp, sp
        bl      puts
        ldp     fp, lr, [sp], 16
        ret`,
  },
  {
    title: "sign extension",
    cause: "a narrow signed value needs sign extension before it is used as a 64-bit value.",
    wrong: `        sub     w0, w1, w2
        ldr     x3, [x4, x0, lsl #3]`,
    right: `        sub     w0, w1, w2
        sxtw    x0, w0
        ldr     x3, [x4, x0, lsl #3]`,
  },
  {
    title: "off-by-one loop bounds",
    cause: "the branch condition decides whether the final index is included.",
    wrong: `        mov     x19, 0
        mov     x0, 0
sum:
        cmp     x19, x20
        b.gt    done
        ldr     x1, [x21, x19, lsl #3]
        add     x0, x0, x1
        add     x19, x19, 1
        b       sum
done:`,
    right: `        mov     x19, 0
        mov     x0, 0
sum:
        cmp     x19, x20
        b.ge    done
        ldr     x1, [x21, x19, lsl #3]
        add     x0, x0, x1
        add     x19, x19, 1
        b       sum
done:`,
  },
  {
    title: "non-16-byte local allocation",
    cause: "local frames must be rounded up to a 16-byte multiple.",
    wrong: `        sub     sp, sp, 24
        str     x0, [sp, 8]
        bl      printf
        add     sp, sp, 24`,
    right: `        sub     sp, sp, 32
        str     x0, [sp, 8]
        bl      printf
        add     sp, sp, 32`,
  },
];

const WRONG_PANEL =
  "flex flex-col gap-1.5 rounded-[var(--radius-card)] border-l-4 border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] p-3";
const RIGHT_PANEL =
  "flex flex-col gap-1.5 rounded-[var(--radius-card)] border-l-4 border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] p-3";
const LABEL_CLASS =
  "text-[12px] font-semibold uppercase tracking-wide text-[var(--text-primary)]";

export function PitfallsCatalog({
  className = "",
}: {
  className?: string;
}): JSX.Element {
  return (
    <section
      aria-label="cpsc 355 pitfalls"
      className={`mx-auto flex max-w-3xl flex-col gap-8 ${className}`}
    >
      {PITFALLS.map((pitfall) => (
        <article key={pitfall.title} className="flex flex-col gap-3">
          <h3 className="text-[19px] font-semibold text-[var(--text-primary)]">
            {pitfall.title}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={WRONG_PANEL}>
              <p className={LABEL_CLASS}>wrong</p>
              <CodeBlock code={pitfall.wrong} />
            </div>
            <div className={RIGHT_PANEL}>
              <p className={LABEL_CLASS}>right</p>
              <CodeBlock code={pitfall.right} />
            </div>
          </div>
          <LessonMarkdown
            markdown={pitfall.cause}
            className="text-[var(--text-secondary)]"
          />
        </article>
      ))}
    </section>
  );
}
