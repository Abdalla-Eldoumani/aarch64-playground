"use client";

import { useCallback, useRef, useState } from "react";

export interface ImportExportProps {
  source: string;
  onImport: (source: string) => void;
  className?: string;
}

/**
 * Import and export buttons in the header. Import supports file-picker
 * and drop-into-editor (the caller wires the drop event on the editor
 * container through `readFile`). Export offers `.asm` and `.s` download
 * plus copy-to-clipboard.
 */
export function ImportExport({ source, onImport, className = "" }: ImportExportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

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
      file.text().then((text) => onImport(text));
      e.target.value = "";
    },
    [onImport],
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
        className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-label="import assembly file"
      >
        import
      </button>
      <button
        type="button"
        onClick={() => download("asm")}
        className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-label="download as .asm"
      >
        .asm
      </button>
      <button
        type="button"
        onClick={() => download("s")}
        className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-label="download as .s"
      >
        .s
      </button>
      <button
        type="button"
        onClick={copy}
        className={`text-[11px] rounded px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
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
