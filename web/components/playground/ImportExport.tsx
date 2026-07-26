"use client";

import { useCallback, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  MAX_BOOKMARK_JSON_BYTES,
  MAX_SOURCE_BYTES,
  MAX_WORKSPACE_FILES,
  checkUploadSize,
  validateSource,
} from "@/lib/playground/upload-guard";
import type { SourceFile } from "@/lib/playground/file-map";
import type { ImportTarget } from "@/lib/hooks/use-import-target";

/** Shape of a `.json` workspace bundle: the whole files strip, main first. */
interface WorkspaceBundle {
  version: 1;
  files: SourceFile[];
}

/**
 * Parse an untrusted workspace bundle field by field. Returns the files or
 * a student-facing reason; never a partially-applied strip.
 */
export function readWorkspaceBundle(
  raw: string,
): { ok: true; files: SourceFile[] } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "that .json file is not a workspace bundle" };
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "that .json file is not a workspace bundle" };
  }
  const o = parsed as Record<string, unknown>;
  if (o.version !== 1 || !Array.isArray(o.files)) {
    return { ok: false, error: "that .json file is not a workspace bundle" };
  }
  if (o.files.length === 0) {
    return { ok: false, error: "that workspace bundle has no files" };
  }
  if (o.files.length > MAX_WORKSPACE_FILES) {
    return {
      ok: false,
      error: `that workspace bundle has too many files (max ${MAX_WORKSPACE_FILES})`,
    };
  }
  const files: SourceFile[] = [];
  for (const entry of o.files) {
    if (entry == null || typeof entry !== "object") {
      return { ok: false, error: "that workspace bundle has a malformed file" };
    }
    const { name, body } = entry as { name?: unknown; body?: unknown };
    if (typeof name !== "string" || name.trim().length === 0 || typeof body !== "string") {
      return { ok: false, error: "that workspace bundle has a malformed file" };
    }
    const bodyError = validateSource(body);
    if (bodyError) return { ok: false, error: `${name}: ${bodyError}` };
    files.push({ name: name.trim(), body });
  }
  return { ok: true, files };
}

export interface ImportExportProps {
  source: string;
  /** The helper files beside main.asm; the workspace bundle carries them. */
  files?: SourceFile[];
  /**
   * Receives the active import target along with the file body. The parent
   * routes the body to main / extras[i] and shows a toast confirming where
   * the import landed.
   */
  onImport: (target: ImportTarget, body: string) => void;
  /** Receives a multi-select import: every picked file with its name, so
   *  the parent can spread a whole program across main and the files
   *  strip in one gesture. */
  onImportMany?: (files: { name: string; body: string }[]) => void;
  /** Where the next import will land. Computed by the parent each render. */
  target: ImportTarget;
  className?: string;
}

/**
 * Import and export buttons in the header. Importing one file sends its
 * body to the active target (main / an extra) so a student editing extras
 * isn't surprised when their import overwrites the wrong buffer; picking
 * several files at once hands the whole set to the parent as named files,
 * and a single `.json` is read as a workspace bundle through the same path.
 * Export offers `.asm` / `.s` download of the buffer, `.json` download of
 * the whole workspace, plus copy-to-clipboard.
 */
export function ImportExport({
  source,
  files = [],
  onImport,
  onImportMany,
  target,
  className = "",
}: ImportExportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const saveBlob = useCallback((body: string, name: string, mime: string) => {
    const blob = new Blob([body], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const download = useCallback(
    (ext: "asm" | "s") => {
      saveBlob(source, `program.${ext}`, "text/plain");
    },
    [source, saveBlob],
  );

  // The whole workspace, not just the buffer on screen. The share link is
  // the only other carrier for a multi-file program and it dies well before
  // a real one fits in a URL fragment, so this is the way a student hands a
  // split program to a TA or moves it between machines.
  const downloadWorkspace = useCallback(() => {
    const bundle: WorkspaceBundle = {
      version: 1,
      files: [{ name: "main.asm", body: source }, ...files],
    };
    saveBlob(JSON.stringify(bundle, null, 2), "workspace.json", "application/json");
  }, [source, files, saveBlob]);

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
      const picked = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (picked.length === 0) return;
      // A single .json is a workspace bundle: it round-trips the whole
      // strip through the same multi-file path a multi-select import uses.
      if (picked.length === 1 && /\.json$/i.test(picked[0].name)) {
        const bundleFile = picked[0];
        const sizeError = checkUploadSize(
          bundleFile.size,
          MAX_BOOKMARK_JSON_BYTES,
          "workspace bundle",
        );
        if (sizeError) {
          toast.error(sizeError);
          return;
        }
        bundleFile
          .text()
          .then((raw) => {
            const result = readWorkspaceBundle(raw);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            if (onImportMany) onImportMany(result.files);
            else onImport(target, result.files[0].body);
          })
          .catch(() => {
            toast.error("could not read that file -- try picking it again");
          });
        return;
      }
      for (const file of picked) {
        const sizeError = checkUploadSize(file.size, MAX_SOURCE_BYTES, "source file");
        if (sizeError) {
          toast.error(`${file.name}: ${sizeError}`);
          return;
        }
      }
      Promise.all(
        picked.map((file) => file.text().then((body) => ({ name: file.name, body }))),
      )
        .then((files) => {
          for (const f of files) {
            // Validate the decoded source content (byte length) before
            // applying; file.size is a fast pre-read guard, this bounds
            // the actual text.
            const contentError = validateSource(f.body);
            if (contentError) {
              toast.error(`${f.name}: ${contentError}`);
              // Intentional security observability: a rejected over-cap
              // import is surfaced to the console alongside the toast, per
              // the input-validation policy. This is the only sanctioned
              // console use here.
              console.warn(`rejected over-cap source import: ${contentError}`);
              return;
            }
          }
          if (files.length === 1 || !onImportMany) {
            onImport(target, files[0].body);
          } else {
            onImportMany(files);
          }
        })
        .catch(() => {
          // A moved or unreadable file rejects file.text(); without this
          // the rejection was silent and the student saw nothing at all.
          toast.error("could not read the files -- try picking them again");
        });
    },
    [onImport, onImportMany, target, toast],
  );

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <input
        ref={fileRef}
        type="file"
        accept=".s,.asm,.txt,.json"
        multiple
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
        onClick={downloadWorkspace}
        className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
        aria-label="download the whole workspace as .json"
      >
        .json
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
