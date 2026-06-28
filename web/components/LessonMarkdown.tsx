"use client";

/**
 * The single sanitizing renderer for author-supplied Markdown across the whole
 * site: lesson prose and callout bodies both render through here, and nothing
 * else turns author Markdown into DOM. Author Markdown is untrusted, so it runs
 * through react-markdown + remark-gfm + rehype-sanitize, with no raw-HTML
 * injection path at all. The sanitize schema is the library
 * default widened by a single attribute (heading `id`); every other custom
 * attribute (the hover-define aria/tabindex) is added here, in the React
 * `components` layer, AFTER sanitization runs over the HTML AST.
 */

import { isValidElement, type JSX, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Components } from "react-markdown";
import { slugify } from "@/lib/lesson-toc";
import { lookupDoc } from "@/lib/instruction-docs";

/**
 * The default sanitize schema, widened by exactly one allowance: an `id`
 * attribute on `h2`/`h3`. Nothing else is widened; the hover-define attributes
 * are applied by the React components below, post-sanitize, never as raw HTML.
 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    h2: [...(defaultSchema.attributes?.h2 ?? []), "id"],
    h3: [...(defaultSchema.attributes?.h3 ?? []), "id"],
  },
};

/**
 * Short ABI-role summaries for the general-purpose registers, by role. The
 * hover-define resolves a register token to one of these so a reader can hover
 * any register the author mentions in prose, not only instructions.
 */
const REGISTER_ROLES = {
  arg: "argument and return register (x0-x7): carries the first eight arguments and the return value.",
  indirectResult:
    "indirect-result register (x8): also holds the syscall number for svc.",
  temp: "caller-saved temporary (x9-x15): a called routine may overwrite it.",
  ip: "intra-procedure-call scratch register (ip0/ip1, x16/x17).",
  platform: "platform register (x18): reserved by the platform abi.",
  calleeSaved:
    "callee-saved register (x19-x28): a routine must restore it before it returns.",
  framePointer: "frame pointer (x29 / fp): anchors the current stack frame.",
  linkRegister: "link register (x30 / lr): holds the return address set by bl.",
  stackPointer:
    "stack pointer (sp): keep it 16-byte aligned at a public boundary.",
  zero: "zero register (xzr / wzr): reads as zero, writes are discarded.",
} as const;

/**
 * Resolve a register token (x0-x30 and their w-views, sp, xzr/wzr, the fp/lr
 * aliases) to a role summary, or `undefined` when the token is not a register.
 */
function registerRole(raw: string): string | undefined {
  const t = raw.trim().toLowerCase();
  if (t === "sp" || t === "wsp") return REGISTER_ROLES.stackPointer;
  if (t === "xzr" || t === "wzr") return REGISTER_ROLES.zero;
  if (t === "fp") return REGISTER_ROLES.framePointer;
  if (t === "lr") return REGISTER_ROLES.linkRegister;
  const m = /^[xw](\d{1,2})$/.exec(t);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (n <= 7) return REGISTER_ROLES.arg;
  if (n === 8) return REGISTER_ROLES.indirectResult;
  if (n <= 15) return REGISTER_ROLES.temp;
  if (n <= 17) return REGISTER_ROLES.ip;
  if (n === 18) return REGISTER_ROLES.platform;
  if (n <= 28) return REGISTER_ROLES.calleeSaved;
  if (n === 29) return REGISTER_ROLES.framePointer;
  if (n === 30) return REGISTER_ROLES.linkRegister;
  return undefined; // x31 and up are not general-purpose register names
}

/**
 * Recursively flatten a React node to its visible text, keeping the text inside
 * nested `code`/`em`/`strong` so a formatted heading's id matches `extractToc`.
 * Decorative subtrees (the hover-define tooltip, marked aria-hidden / role
 * tooltip) are skipped so they never leak into the heading anchor.
 */
function flattenText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (isValidElement(node)) {
    const props = node.props as {
      children?: ReactNode;
      role?: string;
      ["aria-hidden"]?: boolean | string;
    };
    if (
      props.role === "tooltip" ||
      props["aria-hidden"] === true ||
      props["aria-hidden"] === "true"
    ) {
      return "";
    }
    return flattenText(props.children);
  }
  return "";
}

const H2_CLASS =
  "mb-3 mt-8 scroll-mt-24 text-[var(--text-primary)] [font:var(--type-h2)]";
const H3_CLASS =
  "mb-2 mt-6 scroll-mt-24 text-[var(--text-primary)] [font:var(--type-h3)]";
const P_CLASS = "my-4 text-[var(--text-primary)] [font:var(--type-body)]";
const UL_CLASS =
  "my-4 list-disc pl-6 text-[var(--text-primary)] [font:var(--type-body)]";
const OL_CLASS =
  "my-4 list-decimal pl-6 text-[var(--text-primary)] [font:var(--type-body)]";
const LI_CLASS = "my-1";
const LINK_CLASS =
  "rounded-[2px] text-[var(--cyan)] underline underline-offset-2 outline-none hover:opacity-80 focus-visible:shadow-[var(--ring)]";
const PRE_CLASS =
  "my-4 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-sunken)] px-4 py-3 font-mono text-[13px] leading-relaxed text-[var(--text-primary)]";
const INLINE_CODE_CLASS =
  "rounded-[var(--radius-control)] bg-[var(--bg-sunken)] px-1.5 py-0.5 font-mono text-[0.9em] text-[var(--syntax-keyword)]";
const HOVER_WRAP_CLASS =
  "group relative inline-flex rounded-[var(--radius-control)] align-baseline outline-none focus-visible:shadow-[var(--ring)]";
const TOOLTIP_CLASS =
  "pointer-events-none absolute left-0 top-full z-10 mt-1 hidden w-max max-w-[18rem] rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-[var(--text-secondary)] shadow-[var(--shadow-overlay)] [font:var(--type-small)] group-hover:block group-focus:block group-focus-within:block";

const components: Components = {
  h2(props) {
    return (
      <h2 id={slugify(flattenText(props.children))} className={H2_CLASS}>
        {props.children}
      </h2>
    );
  },
  h3(props) {
    return (
      <h3 id={slugify(flattenText(props.children))} className={H3_CLASS}>
        {props.children}
      </h3>
    );
  },
  p(props) {
    return <p className={P_CLASS}>{props.children}</p>;
  },
  ul(props) {
    return <ul className={UL_CLASS}>{props.children}</ul>;
  },
  ol(props) {
    return <ol className={OL_CLASS}>{props.children}</ol>;
  },
  li(props) {
    return <li className={LI_CLASS}>{props.children}</li>;
  },
  a(props) {
    return (
      <a href={props.href} rel="noreferrer noopener" className={LINK_CLASS}>
        {props.children}
      </a>
    );
  },
  pre(props) {
    return <pre className={PRE_CLASS}>{props.children}</pre>;
  },
  code(props) {
    const { className, children } = props;
    // react-markdown v10 dropped the `inline` prop. Fenced code is block code:
    // a labeled fence carries a `language-*` class, and an unlabeled fence
    // still arrives as multi-line text (mdast appends a trailing newline to a
    // fenced block). Only single-line, unlabeled code is genuine inline code,
    // so the hover-define is reserved for it and never fires inside a <pre>.
    const text = flattenText(children);
    const isBlock = /\blanguage-/.test(className ?? "") || text.includes("\n");
    if (isBlock) {
      return <code className="font-mono">{children}</code>;
    }

    const token = text.trim();
    // Resolve a hover summary from two sources: instruction docs and the
    // register roles. A token in neither renders as a plain inline code.
    const summary = lookupDoc(token)?.summary ?? registerRole(token);
    if (!summary) {
      return <code className={INLINE_CODE_CLASS}>{children}</code>;
    }

    return (
      <span
        tabIndex={0}
        role="note"
        aria-label={summary}
        title={summary}
        className={HOVER_WRAP_CLASS}
      >
        <code className={INLINE_CODE_CLASS}>{children}</code>
        <span role="tooltip" aria-hidden="true" className={TOOLTIP_CLASS}>
          {summary}
        </span>
      </span>
    );
  },
};

/**
 * Render trusted-after-sanitization author Markdown. The single author-Markdown
 * entry point for the site: prose blocks and callout bodies both call this.
 */
export function LessonMarkdown({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}): JSX.Element {
  return (
    <div className={className}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={components}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
