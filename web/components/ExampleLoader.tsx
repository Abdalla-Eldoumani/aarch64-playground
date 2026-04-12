"use client";

import { useCallback } from "react";

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
  const handleSelect = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const file = e.target.value;
      if (!file) return;

      const response = await fetch(file);
      const text = await response.text();
      onLoad(text);
      e.target.value = "";
    },
    [onLoad]
  );

  return (
    <select
      onChange={handleSelect}
      defaultValue=""
      className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
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
  );
}
