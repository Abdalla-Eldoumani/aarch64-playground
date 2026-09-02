/**
 * The `.json` workspace bundle: the carrier that moves a whole multi-file
 * program between machines, since a real one compresses far past the share
 * link's fragment cap. The shape and the field-by-field read of an untrusted
 * one live together so the export path and the import path cannot drift; the
 * read returns a student-facing reason instead of a partially-applied strip.
 */

import { MAX_WORKSPACE_FILES, validateSource } from "@/lib/playground/upload-guard";
import { fileNameShapeError, type SourceFile } from "@/lib/playground/file-map";

/** Shape of a `.json` workspace bundle: the whole files strip, main first. */
export interface WorkspaceBundle {
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
    if (typeof name !== "string" || typeof body !== "string") {
      return { ok: false, error: "that workspace bundle has a malformed file" };
    }
    // The name rides into the files strip and into combineSources' boundary
    // comment, so it is checked as strictly as the body. Only the SHAPE rule
    // applies here: a bundle carries the whole workspace, main.asm included,
    // which validateFileName refuses by design. The name-shape reason carries
    // no name; a body error does name the file, because that name already
    // passed the shape check.
    const nameError = fileNameShapeError(name);
    if (nameError) return { ok: false, error: nameError };
    const bodyError = validateSource(body);
    if (bodyError) return { ok: false, error: `${name}: ${bodyError}` };
    files.push({ name: name.trim(), body });
  }
  return { ok: true, files };
}
