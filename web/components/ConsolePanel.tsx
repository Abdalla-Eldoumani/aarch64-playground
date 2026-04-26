"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { MAX_VFS_BYTES, checkUploadSize } from "@/lib/upload-guard";

interface ConsolePanelProps {
  stdout: string;
  stderr: string;
  blocked: boolean;
  exitCode: number | null;
  vfsFiles: string[];
  pushStdin: (s: string) => void;
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
  stdout,
  stderr,
  blocked,
  exitCode,
  vfsFiles,
  pushStdin,
  uploadVfsFile,
  clearConsole,
}: ConsolePanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);
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
    // Always terminate with a newline so scanf / read block releases.
    pushStdin(stdinValue + "\n");
    setStdinValue("");
  };

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
      <div className="flex items-center justify-between px-2 py-1 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="font-semibold">console</span>
          {blocked && (
            <span
              role="status"
              className="px-1.5 py-0.5 rounded bg-[var(--accent)] text-black text-[10px]"
            >
              waiting for input
            </span>
          )}
          {exitCode != null && (
            <span className="text-[var(--text-secondary)] text-[10px]">
              exit {exitCode}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer text-[var(--accent)] hover:underline">
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
        {stdout && <span>{stdout}</span>}
        {stderr && <span className="text-red-400">{stderr}</span>}
        {!stdout && !stderr && (
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
        <div className="px-2 py-1 border-t border-[var(--border)] bg-[var(--bg-secondary)] text-[10px] text-[var(--text-secondary)]">
          vfs: {vfsFiles.join(", ")}
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="flex gap-1 px-2 py-1 border-t border-[var(--border)] bg-[var(--bg-secondary)]"
      >
        <input
          type="text"
          value={stdinValue}
          onChange={(e) => setStdinValue(e.target.value)}
          placeholder={blocked ? "program is waiting for input..." : "stdin"}
          aria-label="Standard input"
          className="flex-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-0.5 outline-none focus-visible:border-[var(--accent)]"
        />
        <button
          type="submit"
          className="px-2 py-0.5 rounded bg-[var(--accent)] text-black hover:brightness-110"
        >
          send
        </button>
      </form>
    </div>
  );
}
