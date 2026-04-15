"use client";

/**
 * Typed client for the local `/api/c-to-asm` route. Keeps network noise
 * out of the component and gives the view a small surface to mock in
 * tests later.
 */
export interface CompileResponse {
  asm: string;
  cached: boolean;
  /** Per-asm-line mapping back to the 1-based C source line, or null. */
  sourceMap?: (number | null)[];
}

export interface CompileError {
  error: string;
  status?: number;
}

export async function compileCToAsm(
  source: string,
  optLevel: string,
): Promise<CompileResponse> {
  const res = await fetch("/api/c-to-asm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source, optLevel }),
  });
  const body = (await res.json()) as CompileResponse & CompileError;
  if (!res.ok) {
    throw new Error(body.error || `compile failed with status ${res.status}`);
  }
  return { asm: body.asm, cached: body.cached, sourceMap: body.sourceMap };
}
