"use client";

import { useId, useState } from "react";
import { HEADLESS_STEP_BUDGET } from "@/lib/emulator/headless-run";
import { formatSteps } from "@/lib/emulator/format-steps";
import { machineForChecks, runChecks } from "@/lib/playground/check-runner";
import type { Workspace } from "@/lib/playground/file-map";
import {
  MAX_CHECKS,
  gradeCheck,
  type CheckVerdict,
  type OutputDifference,
  type ProgramCheck,
} from "@/lib/playground/program-checks";
import { MAX_ARGS_CHARS } from "@/lib/playground/upload-guard";

export interface ChecksPanelProps {
  checks: ProgramCheck[];
  onChange: (next: ProgramCheck[]) => void;
  /** The workspace on screen; a run reads it at the moment it starts. */
  workspace: Workspace;
}

type Report =
  | { kind: "assemble-error"; message: string }
  /** `ran` is the list as it stood, so an edited check stops showing a stale result. */
  | { kind: "ran"; ran: ProgramCheck[]; verdicts: CheckVerdict[] };

const FIELD =
  "touch-target w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded px-2 py-1 " +
  "text-[12px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]";
const LABEL = "block mb-0.5 text-[12px] text-[var(--text-secondary)]";
const ACTION =
  "touch-target px-2 py-0.5 text-[12px] rounded bg-[var(--cyan-dim)] text-[var(--text-primary)] " +
  "hover:bg-[var(--cyan)] hover:text-[var(--on-cyan)] disabled:bg-[var(--bg-sunken)] " +
  "disabled:text-[var(--text-tertiary)] disabled:cursor-not-allowed " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]";
const QUIET =
  "touch-target px-1.5 py-0.5 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] " +
  "disabled:text-[var(--text-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]";

function sameCheck(a: ProgramCheck | undefined, b: ProgramCheck): boolean {
  return (
    a !== undefined &&
    a.name === b.name &&
    a.stdin === b.stdin &&
    a.args === b.args &&
    a.stdout === b.stdout &&
    a.exitCode === b.exitCode
  );
}

function checkName(check: ProgramCheck, index: number): string {
  return check.name.trim() || `check ${index + 1}`;
}

function blankCheck(index: number): ProgramCheck {
  return { name: `check ${index + 1}`, stdin: "", args: "", stdout: "" };
}

/** The one line under a check's name that says how its run went. */
function verdictLine(check: ProgramCheck, verdict: CheckVerdict): string {
  switch (verdict.miss) {
    case null:
      return verdict.loose ? "passes, ignoring trailing whitespace" : "passes";
    case "fault":
      return `crashed: ${verdict.error}`;
    case "step-limit":
      return `did not finish within ${formatSteps(HEADLESS_STEP_BUDGET)}`;
    case "waiting":
      return "stopped waiting for input it never got";
    case "stdout":
      return "wrong output";
    case "exit":
      return `exit code ${verdict.exitCode ?? "none"}, expected ${check.exitCode}`;
    default: {
      const exhaustive: never = verdict.miss;
      return exhaustive;
    }
  }
}

/** A line as the reader sees it: quoted, so trailing spaces and empty lines show. */
function shown(line: string | null): string {
  return line === null ? "(no line)" : JSON.stringify(line);
}

function Difference({ difference }: { difference: OutputDifference }) {
  return (
    <div className="mt-1 font-mono text-[12px]">
      <div className="text-[var(--text-secondary)]">first difference, line {difference.line}</div>
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2">
        <span className="text-[var(--text-secondary)]">expected</span>
        <span className="break-all text-[var(--text-primary)]">{shown(difference.expected)}</span>
        <span className="text-[var(--text-secondary)]">actual</span>
        <span className="break-all text-[var(--danger)]">{shown(difference.actual)}</span>
      </div>
    </div>
  );
}

/** The pass/fail square: the glyph for sight, the word for a screen reader. */
function Mark({ pass }: { pass: boolean }) {
  const tone = pass
    ? "border-[var(--success)] text-[var(--success)]"
    : "border-[var(--danger)] text-[var(--danger)]";
  return (
    <span
      className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center border font-mono text-[12px] font-bold leading-none ${tone}`}
    >
      <span aria-hidden="true">{pass ? "✓" : "✗"}</span>
      <span className="sr-only">{pass ? "passed" : "failed"}</span>
    </span>
  );
}

/**
 * The program's own test cases: each one gives stdin and arguments and says
 * what the program must print, and optionally exit with. Every run happens
 * on a separate machine, so the program being debugged is left alone.
 */
export function ChecksPanel({ checks, onChange, workspace }: ChecksPanelProps) {
  const id = useId();
  const [open, setOpen] = useState<number | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState<"checks" | "fill" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const update = (index: number, patch: Partial<ProgramCheck>) => {
    onChange(checks.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const add = () => {
    onChange([...checks, blankCheck(checks.length)]);
    setOpen(checks.length);
  };

  const remove = (index: number) => {
    onChange(checks.filter((_, i) => i !== index));
    // Results are matched to checks by position, so a removal drops them.
    setReport(null);
    setOpen(null);
  };

  const runAll = async () => {
    setBusy("checks");
    setNote(null);
    const ran = checks;
    try {
      const machine = await machineForChecks();
      const result = await runChecks(machine, workspace, ran);
      setReport(
        result.kind === "assemble-error"
          ? result
          : { kind: "ran", ran, verdicts: ran.map((c, i) => gradeCheck(c, result.outcomes[i])) },
      );
    } catch {
      setNote("the emulator did not load, so nothing ran. reload the page and try again");
    } finally {
      setBusy(null);
    }
  };

  const fill = async (index: number) => {
    setBusy("fill");
    setNote(null);
    try {
      const machine = await machineForChecks();
      const result = await runChecks(machine, workspace, [checks[index]]);
      if (result.kind === "assemble-error") {
        setReport(result);
        return;
      }
      const outcome = result.outcomes[0];
      update(index, { stdout: outcome.stdout });
      setNote(
        outcome.error !== null || !outcome.finished
          ? "filled with what the program printed before it stopped early"
          : `filled with the program's output (it exited with ${outcome.exitCode ?? "no code"})`,
      );
    } catch {
      setNote("the emulator did not load, so nothing ran. reload the page and try again");
    } finally {
      setBusy(null);
    }
  };

  const ranCount = report?.kind === "ran" ? report.verdicts.length : 0;
  const passCount = report?.kind === "ran" ? report.verdicts.filter((v) => v.pass).length : 0;
  const status =
    busy === "checks"
      ? `running ${checks.length} ${checks.length === 1 ? "check" : "checks"}`
      : note ??
        (report?.kind === "assemble-error"
          ? "the program does not assemble, so no check ran"
          : report?.kind === "ran"
            ? `${passCount} of ${ranCount} ${ranCount === 1 ? "check passes" : "checks pass"}`
            : "");

  return (
    <div className="p-3 text-xs flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h2 className="text-[var(--text-secondary)] uppercase tracking-wider text-[12px]">checks</h2>
        <span className="text-[12px] text-[var(--text-secondary)]">{checks.length}</span>
        <div className="ml-auto flex gap-1">
          <button type="button" className={QUIET} onClick={add} disabled={checks.length >= MAX_CHECKS}>
            add check
          </button>
          <button
            type="button"
            className={ACTION}
            onClick={() => void runAll()}
            disabled={busy !== null || checks.length === 0}
          >
            run checks
          </button>
        </div>
      </div>

      <p role="status" className="min-h-[1.25rem] mb-1 text-[12px] text-[var(--text-primary)]">
        {status}
      </p>
      {report?.kind === "assemble-error" && (
        <p className="mb-2 border-l-2 border-[var(--danger)] pl-2 font-mono text-[12px] text-[var(--danger)] break-words">
          {report.message}
        </p>
      )}

      <div className="flex-1 overflow-auto">
        {checks.length === 0 && (
          <div className="space-y-1">
            <p className="font-serif text-[12px] text-[var(--text-primary)]">No checks yet.</p>
            <p className="font-sans text-[12px] text-[var(--text-secondary)]">
              A check gives the program some input and says what it should print. Add one,
              then run checks to test the program on all of them at once.
            </p>
          </div>
        )}
        <ul className="space-y-2">
          {checks.map((check, index) => {
            const verdict =
              report?.kind === "ran" && sameCheck(report.ran[index], check)
                ? report.verdicts[index]
                : null;
            const editing = open === index;
            const base = `${id}-${index}`;
            const name = checkName(check, index);
            return (
              <li key={index} className="border border-[var(--border)] bg-[var(--bg-sunken)] p-2">
                <div className="flex items-center gap-2">
                  {verdict && <Mark pass={verdict.pass} />}
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--text-primary)]">
                    {name}
                  </span>
                  <button
                    type="button"
                    className={QUIET}
                    aria-expanded={editing}
                    aria-controls={`${base}-fields`}
                    aria-label={`${editing ? "close" : "edit"} ${name}`}
                    onClick={() => setOpen(editing ? null : index)}
                  >
                    {editing ? "close" : "edit"}
                  </button>
                  <button
                    type="button"
                    className={`${QUIET} hover:text-[var(--danger)]`}
                    aria-label={`remove ${name}`}
                    onClick={() => remove(index)}
                  >
                    remove
                  </button>
                </div>
                {verdict && (
                  <div className="mt-1 text-[12px]">
                    <div className={verdict.pass ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                      {verdictLine(check, verdict)}
                    </div>
                    {verdict.exitCode !== null && verdict.miss !== "exit" && (
                      <div className="text-[var(--text-secondary)]">exit code {verdict.exitCode}</div>
                    )}
                    {verdict.difference && <Difference difference={verdict.difference} />}
                  </div>
                )}
                {editing && (
                  <div id={`${base}-fields`} className="mt-2 grid gap-2">
                    <div>
                      <label htmlFor={`${base}-name`} className={LABEL}>name</label>
                      <input
                        id={`${base}-name`}
                        type="text"
                        value={check.name}
                        maxLength={100}
                        onChange={(e) => update(index, { name: e.target.value })}
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                        className={FIELD}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${base}-args`} className={LABEL}>args (after the program name)</label>
                      <input
                        id={`${base}-args`}
                        type="text"
                        value={check.args}
                        maxLength={MAX_ARGS_CHARS}
                        onChange={(e) => update(index, { args: e.target.value })}
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                        className={FIELD}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${base}-stdin`} className={LABEL}>stdin</label>
                      <textarea
                        id={`${base}-stdin`}
                        value={check.stdin}
                        rows={2}
                        onChange={(e) => update(index, { stdin: e.target.value })}
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                        className={FIELD}
                      />
                    </div>
                    <div>
                      <label htmlFor={`${base}-stdout`} className={LABEL}>expected output</label>
                      <textarea
                        id={`${base}-stdout`}
                        value={check.stdout}
                        rows={3}
                        onChange={(e) => update(index, { stdout: e.target.value })}
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                        className={FIELD}
                      />
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="w-36">
                        <label htmlFor={`${base}-exit`} className={LABEL}>exit code (optional)</label>
                        <input
                          id={`${base}-exit`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={255}
                          value={check.exitCode ?? ""}
                          onChange={(e) => {
                            const text = e.target.value;
                            const code = Number(text);
                            if (text === "") update(index, { exitCode: undefined });
                            else if (Number.isInteger(code) && code >= 0 && code <= 255) {
                              update(index, { exitCode: code });
                            }
                          }}
                          className={FIELD}
                        />
                      </div>
                      <button
                        type="button"
                        className={`${QUIET} ml-auto`}
                        disabled={busy !== null}
                        onClick={() => void fill(index)}
                      >
                        fill expected output from a run
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
