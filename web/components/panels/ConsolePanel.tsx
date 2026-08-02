"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { MAX_VFS_BYTES, checkUploadSize, validateStdin } from "@/lib/playground/upload-guard";

interface ConsolePanelProps {
  stdout: string;
  stderr: string;
  blocked: boolean;
  /** A terminal program owns the pane's input: its reads are answered by
   *  keystrokes in the terminal, so this console's stdin box would send
   *  into a session it cannot see. Disabled, with a pointer to the tab. */
  ownedByTerminal?: boolean;
  /** Where in `stdout` a terminal-owned session began, or null when no
   *  session has taken this program over. The session's own bytes were
   *  written to the pane, which is a real terminal; this scrollback is
   *  plain text, so a full-screen program's escape sequences land here as
   *  literal garbage. Everything up to the watermark printed before the
   *  takeover and stays; the rest is one note pointing at the tab it
   *  happened in. */
  terminalOwnedFrom?: number | null;
  exitCode: number | null;
  vfsFiles: string[];
  pushStdin: (s: string) => void;
  /** Signal end-of-input (wired to ctrl-d in the stdin box). */
  closeStdin: () => void;
  uploadVfsFile: (path: string, data: Uint8Array) => void;
  clearConsole: () => void;
}

/**
 * Console pane: scrollback for stdout/stderr, a stdin input row, a clear
 * button, and a file-upload dropzone that registers bytes into the virtual
 * filesystem. Auto-scrolls to the bottom when new output arrives, but
 * stops auto-scrolling once the user has scrolled up on their own.
 */
export function ConsolePanel({
  ownedByTerminal = false,
  terminalOwnedFrom = null,
  stdout,
  stderr,
  blocked,
  exitCode,
  vfsFiles,
  pushStdin,
  closeStdin,
  uploadVfsFile,
  clearConsole,
}: ConsolePanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);
  const stdinRef = useRef<HTMLInputElement | null>(null);

  // The machine just stalled in scanf/read: put the caret where the answer
  // goes. Focus only on the false->true edge so the student can still click
  // away while the program stays blocked.
  const lastBlockedRef = useRef(false);
  useEffect(() => {
    if (blocked && !lastBlockedRef.current) {
      stdinRef.current?.focus();
    }
    lastBlockedRef.current = blocked;
  }, [blocked]);
  const [stdinValue, setStdinValue] = useState("");
  const toast = useToast();

  // Auto-scroll on new output unless the user has scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !autoScrollRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [stdout, stderr]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 4;
    autoScrollRef.current = atBottom;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // A terminal session owns the program's input; the disabled box is the
    // visible half of that, this is the half a stray submit cannot pass.
    if (ownedByTerminal) return;
    // Validate the stdin ingress before it reaches the emulator as data.
    const error = validateStdin(stdinValue);
    if (error) {
      toast.error(error);
      // Intentional security observability: a rejected over-cap input is
      // surfaced to the console alongside the toast, per the input-
      // validation policy. This is the only sanctioned console use here.
      console.warn(`rejected over-cap stdin: ${error}`);
      return;
    }
    // Always terminate with a newline so scanf / read block releases.
    pushStdin(stdinValue + "\n");
    setStdinValue("");
  };

  // Output from before a terminal session took over; the session's own
  // bytes belong to the pane. stderr is never routed there, so it renders
  // whole -- this scrollback is the only surface that ever shows it.
  const shownStdout =
    terminalOwnedFrom == null ? stdout : stdout.slice(0, terminalOwnedFrom);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeError = checkUploadSize(file.size, MAX_VFS_BYTES, "file");
    if (sizeError) {
      toast.error(sizeError);
      e.target.value = "";
      return;
    }
    const buf = await file.arrayBuffer();
    uploadVfsFile(file.name, new Uint8Array(buf));
    // Clear the input so the same file can be re-uploaded.
    e.target.value = "";
  };

  return (
    <div className="flex flex-col h-full min-h-0 text-xs">
      <div className="flex items-center justify-between px-2 py-1 bg-[var(--bg-sunken)] border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="font-semibold">console</span>
          {blocked && !ownedByTerminal && (
            <span
              role="status"
              className="px-1.5 py-0.5 rounded bg-[var(--cyan)] text-[var(--on-cyan)] text-[10px]"
            >
              waiting for input
            </span>
          )}
          {ownedByTerminal && (
            <span
              role="status"
              className="px-1.5 py-0.5 rounded bg-[var(--bg-raised)] text-[var(--text-secondary)] text-[10px]"
            >
              running in the terminal
            </span>
          )}
          {exitCode != null && (
            <span className="text-[var(--text-secondary)] text-[10px]">
              exit {exitCode}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer text-[var(--cyan)] hover:underline">
            upload file
            <input
              type="file"
              className="hidden"
              onChange={handleFile}
              aria-label="Upload file to virtual filesystem"
            />
          </label>
          <button
            type="button"
            onClick={clearConsole}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            clear
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-auto px-2 py-1 font-mono whitespace-pre-wrap"
      >
        {shownStdout && <span>{shownStdout}</span>}
        {terminalOwnedFrom != null && (
          <p className="font-sans text-[11px] text-[var(--text-secondary)]">
            this run happened in the terminal tab
          </p>
        )}
        {stderr && <span className="text-[var(--danger)]">{stderr}</span>}
        {!shownStdout && !stderr && terminalOwnedFrom == null && (
          <div className="space-y-1">
            <p className="font-serif text-[13px] text-[var(--text-primary)]">
              Output prints here as your program runs.
            </p>
            <p className="font-sans text-[11px] text-[var(--text-secondary)]">
              Step with F10, run with F5, or feed stdin from the box below.
            </p>
          </div>
        )}
      </div>
      {vfsFiles.length > 0 && (
        <div className="px-2 py-1 border-t border-[var(--border)] bg-[var(--bg-sunken)] text-[10px] text-[var(--text-secondary)]">
          vfs: {vfsFiles.join(", ")}
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="flex gap-1 px-2 py-1 border-t border-[var(--border)] bg-[var(--bg-sunken)]"
      >
        <input
          ref={stdinRef}
          type="text"
          value={stdinValue}
          onChange={(e) => setStdinValue(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl-D on an empty line ends input, exactly like a shell:
            // getchar sees EOF and read-until-EOF loops can finish.
            if (e.ctrlKey && (e.key === "d" || e.key === "D") && stdinValue === "") {
              e.preventDefault();
              closeStdin();
            }
          }}
          placeholder={
            ownedByTerminal
              ? "this program reads from the terminal tab -- type there"
              : blocked
                ? "program is waiting for input... (ctrl-d = end of input)"
                : "stdin"
          }
          disabled={ownedByTerminal}
          aria-label="Standard input"
          className="flex-1 bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-0.5 outline-none focus-visible:border-[var(--cyan)] disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={ownedByTerminal}
          className="px-2 py-0.5 rounded bg-[var(--cyan)] text-[var(--on-cyan)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          send
        </button>
      </form>
    </div>
  );
}
