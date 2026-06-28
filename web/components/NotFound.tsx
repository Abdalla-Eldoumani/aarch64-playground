import Link from "next/link";

interface NotFoundProps {
  title?: string;
  message?: string;
  returnHref?: string;
  returnLabel?: string;
}

export function NotFound({
  title = "page not found",
  message = "the address you requested isn't mapped.",
  returnHref = "/",
  returnLabel = "return to playground",
}: NotFoundProps) {
  return (
    <main
      className="flex flex-col items-center justify-center flex-1 min-h-0 gap-6 px-6 text-center"
      role="main"
    >
      <div className="flex items-baseline gap-3 text-[var(--text-secondary)]">
        <span className="text-5xl font-bold text-[var(--danger)]">404</span>
        <span className="text-xs uppercase tracking-wider">signal 11</span>
      </div>

      <h1 className="font-serif text-2xl text-[var(--text-primary)]">{title}</h1>

      <p className="font-sans text-sm text-[var(--text-secondary)] max-w-md">{message}</p>

      <pre className="text-xs text-[var(--text-secondary)] bg-[var(--bg-sunken)] border border-[var(--border)] rounded px-4 py-3 whitespace-pre">
{`MOV X0, #0x404
SVC #0`}
      </pre>

      <Link
        href={returnHref}
        className="text-xs text-[var(--cyan)] hover:underline"
      >
        {returnLabel}
      </Link>
    </main>
  );
}
