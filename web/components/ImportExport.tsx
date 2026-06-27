"use client";

import { useCallback, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { MAX_SOURCE_BYTES, checkUploadSize } from "@/lib/upload-guard";
import type { ImportTarget } from "@/lib/use-import-target";

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
      file.text().then((text) => onImport(target, text));
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
