"use client";

import { useCallback, useState } from "react";

interface ExampleLoaderProps {
  onLoad: (source: string) => void;
}

const EXAMPLES = [
  { name: "factorial", file: "/examples/factorial.s" },
  { name: "fibonacci", file: "/examples/fibonacci.s" },
  { name: "string reverse", file: "/examples/string-reverse.s" },
  { name: "bubble sort", file: "/examples/bubble-sort.s" },
  { name: "gcd", file: "/examples/gcd.s" },
];

export function ExampleLoader({ onLoad }: ExampleLoaderProps) {
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleSelect = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const file = e.target.value;
      if (!file) return;

      setLoadError(null);
      try {
        const response = await fetch(file);
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        const text = await response.text();
        onLoad(text);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "failed to load example");
      } finally {
        e.target.value = "";
      }
    },
    [onLoad]
  );

  return (
    <div className="flex items-center gap-2">
      <select
        onChange={handleSelect}
        defaultValue=""
        className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
        aria-label="Load example program"
      >
        <option value="" disabled>
          load example...
        </option>
        {EXAMPLES.map((ex) => (
          <option key={ex.file} value={ex.file}>
            {ex.name}
          </option>
        ))}
      </select>
      {loadError && (
        <span className="text-red-400 text-xs" role="alert">
          {loadError}
        </span>
      )}
    </div>
  );
}
