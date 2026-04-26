"use client";

import { useCallback, useState } from "react";

interface ExampleLoaderProps {
  onLoad: (source: string, label?: string) => void;
}

interface Example {
  name: string;
  file: string;
}

interface ExampleGroup {
  label: string;
  items: Example[];
}

/**
 * Examples grouped by course topic. The cpsc 355 groups follow the
 * course week progression (stack and locals, records, arrays, floating
 * point, I/O) so students can find the example that maps to the concept
 * they're learning.
 */
const GROUPS: ExampleGroup[] = [
  {
    label: "cpsc 355 — basics",
    items: [
      { name: "week 3 exercise", file: "/examples/cpsc355/week03_exercise.s" },
    ],
  },
  {
    label: "cpsc 355 — stack and locals",
    items: [
      { name: "week 8 scores (scanf + avg)", file: "/examples/cpsc355/week08_scores.asm" },
    ],
  },
  {
    label: "cpsc 355 — records and arrays",
    items: [
      {
        name: "week 9 student record",
        file: "/examples/cpsc355/week09_student_record.asm",
      },
      { name: "week 10 find max", file: "/examples/cpsc355/week10_find_max.asm" },
    ],
  },
  {
    label: "cpsc 355 — subroutines and static data",
    items: [
      {
        name: "week 11 static counter",
        file: "/examples/cpsc355/week11_static_counter.asm",
      },
      { name: "week 11 argv", file: "/examples/cpsc355/week11_argv.asm" },
    ],
  },
  {
    label: "cpsc 355 — floating point",
    items: [
      {
        name: "week 12 circle area (fp)",
        file: "/examples/cpsc355/week12_fp_circle.asm",
      },
      {
        name: "week 12 is_prime",
        file: "/examples/cpsc355/week12_is_prime.asm",
      },
    ],
  },
  {
    label: "cpsc 355 — I/O and syscalls",
    items: [
      { name: "week 13 hello (write)", file: "/examples/cpsc355/week13_hello.asm" },
      { name: "week 13 echo (read)", file: "/examples/cpsc355/week13_echo.asm" },
      {
        name: "week 13 write file",
        file: "/examples/cpsc355/week13_write_file.asm",
      },
      {
        name: "week 13 read file",
        file: "/examples/cpsc355/week13_read_file.asm",
      },
      {
        name: "week 13 copy file",
        file: "/examples/cpsc355/week13_copy_file.asm",
      },
    ],
  },
  {
    label: "starters (A1–A6)",
    items: [
      { name: "A1 min cubic", file: "/examples/cpsc355/starters/A1_min_cubic.asm" },
      {
        name: "A2 multiply via shift-add",
        file: "/examples/cpsc355/starters/A2_mul_shift_add.asm",
      },
      { name: "A3 sort array", file: "/examples/cpsc355/starters/A3_sort_array.asm" },
      {
        name: "A4 struct + subroutines",
        file: "/examples/cpsc355/starters/A4_struct_subroutine.asm",
      },
      {
        name: "A5 global RPN calculator",
        file: "/examples/cpsc355/starters/A5_global_rpn.asm",
      },
      { name: "A6 file I/O + fp", file: "/examples/cpsc355/starters/A6_file_io.asm" },
    ],
  },
  {
    label: "bare-metal classics",
    items: [
      { name: "factorial", file: "/examples/factorial.s" },
      { name: "fibonacci", file: "/examples/fibonacci.s" },
      { name: "string reverse", file: "/examples/string-reverse.s" },
      { name: "bubble sort", file: "/examples/bubble-sort.s" },
      { name: "gcd", file: "/examples/gcd.s" },
    ],
  },
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
        const label = (() => {
          for (const group of GROUPS) {
            for (const item of group.items) {
              if (item.file === file) return item.name;
            }
          }
          return file;
        })();
        onLoad(text, label);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "failed to load example");
      } finally {
        e.target.value = "";
      }
    },
    [onLoad],
  );

  return (
    <div className="flex items-center gap-2">
      <select
        onChange={handleSelect}
        defaultValue=""
        className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] max-w-[14rem]"
        aria-label="Load example program"
      >
        <option value="" disabled>
          load example...
        </option>
        {GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.items.map((ex) => (
              <option key={ex.file} value={ex.file}>
                {ex.name}
              </option>
            ))}
          </optgroup>
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
