import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

// Compiler Explorer compiler id for AArch64 GCC. Re-verified via
// https://godbolt.org/api/compilers/c?fields=id,name on 2026-04-15; the
// ARM64 GCC line is keyed `carm64g<major><minor><patch>`. Update here
// when upstream retires 14.3.0; the route falls through to an error
// response if the upstream returns 4xx/5xx.
const COMPILER_ID = "carm64g1430";

const BASE_FLAGS = [
  "-S",
  "-fno-asynchronous-unwind-tables",
  "-fno-stack-protector",
  "-fno-PIE",
  "-fno-pic",
  "-march=armv8-a",
];

const TTL_MS = 60_000;
const MAX_ENTRIES = 64;

interface CacheEntry {
  expires: number;
  body: string;
}

const cache = new Map<string, CacheEntry>();

function hashKey(source: string, opt: string, extra: string): string {
  return crypto.createHash("sha256").update(`${opt}\0${extra}\0${source}`).digest("hex");
}

function readFromCache(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.body;
}

function writeToCache(key: string, body: string): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { expires: Date.now() + TTL_MS, body });
}

export async function POST(req: NextRequest) {
  let payload: { source?: string; optLevel?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const source = typeof payload.source === "string" ? payload.source : "";
  const optLevel = typeof payload.optLevel === "string" ? payload.optLevel : "-O0";
  if (!source.trim()) {
    return NextResponse.json({ error: "source is empty" }, { status: 400 });
  }
  if (!/^-O[0-3s]$/.test(optLevel)) {
    return NextResponse.json({ error: "invalid opt level" }, { status: 400 });
  }

  const flags = [optLevel, ...BASE_FLAGS].join(" ");
  const key = hashKey(source, optLevel, flags);
  const cached = readFromCache(key);
  if (cached) {
    return NextResponse.json({ asm: cached, cached: true });
  }

  try {
    const upstream = await fetch(
      `https://godbolt.org/api/compiler/${COMPILER_ID}/compile`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          source,
          options: {
            userArguments: flags,
            filters: {
              binary: false,
              commentOnly: true,
              demangle: true,
              directives: false,
              execute: false,
              intel: false,
              labels: true,
              libraryCode: false,
              trim: true,
            },
          },
        }),
      },
    );
    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: `compiler explorer responded ${upstream.status}`,
          status: upstream.status,
        },
        { status: 502 },
      );
    }
    const body = (await upstream.json()) as {
      asm?: Array<{ text?: string; source?: { line?: number } }>;
      stderr?: Array<{ text?: string }>;
      code?: number;
    };
    if (body.code !== 0) {
      const err = (body.stderr ?? [])
        .map((l) => l.text ?? "")
        .filter(Boolean)
        .join("\n");
      return NextResponse.json(
        { error: err || "compile failed" },
        { status: 400 },
      );
    }
    // Assemble the full asm text, plus a per-asm-line -> source-line map
    // Godbolt optionally returns. This is what phase G's C<->asm line
    // linkage needs -- hovering an asm line highlights the corresponding
    // C line and vice versa.
    const lines = body.asm ?? [];
    const asm = lines.map((line) => line.text ?? "").join("\n");
    const sourceMap: (number | null)[] = lines.map(
      (line) => (line.source?.line ?? null) as number | null,
    );
    writeToCache(key, asm);
    return NextResponse.json({ asm, cached: false, sourceMap });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `upstream fetch failed: ${message}` },
      { status: 502 },
    );
  }
}
