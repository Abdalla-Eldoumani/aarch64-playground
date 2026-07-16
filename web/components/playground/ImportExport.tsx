"use client";

import { useCallback, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { MAX_SOURCE_BYTES, checkUploadSize, validateSource } from "@/lib/playground/upload-guard";
import type { ImportTarget } from "@/lib/hooks/use-import-target";

export interface ImportExportProps {
  source: string;
  /**
   * Receives the active import target along with the file body. The parent
   * routes the body to main / extras[i] and shows a toast confirming where
   * the import landed.
   */
  onImport: (target: ImportTarget, body: string) => void;
  /** Where the next import will land. Computed by the parent each render. */
  target: ImportTarget;
  className?: string;
}

/**
 * Import and export buttons in the header. Import sends the picked file's
 * body to the active target (main / an extra) so a student editing extras
 * isn't surprised when their import overwrites the wrong buffer. Export
 * offers `.asm` and `.s` download plus copy-to-clipboard.
 */
export function ImportExport({ source, onImport, target, className = "" }: ImportExportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const download = useCallback(
    (ext: "asm" | "s") => {
      const blob = new Blob([source], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `program.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    [source],
  );

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard can fail in insecure contexts; no fallback here.
    }
  }, [source]);

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const sizeError = checkUploadSize(file.size, MAX_SOURCE_BYTES, "source file");
      if (sizeError) {
        toast.error(sizeError);
        e.target.value = "";
        return;
      }
      file.text().then((text) => {
        // Validate the decoded source content (byte length) before applying;
        // file.size is a fast pre-read guard, this bounds the actual text.
        const contentError = validateSource(text);
        if (contentError) {
          toast.error(contentError);
          // Intentional security observability: a rejected over-cap import is
          // surfaced to the console alongside the toast, per the input-
          // validation policy. This is the only sanctioned console use here.
          console.warn(`rejected over-cap source import: ${contentError}`);
          return;
        }
        onImport(target, text);
      }).catch(() => {
        // A moved or unreadable file rejects file.text(); without this
        // the rejection was silent and the student saw nothing at all.
        toast.error("could not read the file -- try picking it again");
      });
      e.target.value = "";
    },
    [onImport, target, toast],
  );

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <input
        ref={fileRef}
        type="file"
        accept=".s,.asm,.txt"
        onChange={onFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
        aria-label="import assembly file"
      >
        import
      </button>
      <button
        type="button"
        onClick={() => download("asm")}
        className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
        aria-label="download as .asm"
      >
        .asm
      </button>
      <button
        type="button"
        onClick={() => download("s")}
        className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
        aria-label="download as .s"
      >
        .s
      </button>
      <button
        type="button"
        onClick={copy}
        className={`text-[11px] rounded px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)] ${
          copied
            ? "text-[var(--success)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}
        aria-label="copy source to clipboard"
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}
