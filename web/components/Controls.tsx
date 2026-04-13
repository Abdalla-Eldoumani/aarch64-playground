"use client";

import { useEffect } from "react";

interface ControlsProps {
  onAssemble: () => void;
  onStep: () => void;
  onRun: () => void;
  onPause: () => void;
  onReset: () => void;
  isRunning: boolean;
  isHalted: boolean;
  error: string | null;
}

export function Controls({
  onAssemble,
  onStep,
  onRun,
  onPause,
  onReset,
  isRunning,
  isHalted,
  error,
}: ControlsProps) {
  // keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F5" && !e.shiftKey) {
        e.preventDefault();
        if (isRunning) {
          onPause();
        } else {
          onRun();
        }
      } else if (e.key === "F5" && e.shiftKey) {
        e.preventDefault();
        onReset();
      } else if (e.key === "F10") {
        e.preventDefault();
        onStep();
      } else if (e.key === "F6") {
        e.preventDefault();
        onAssemble();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onAssemble, onStep, onRun, onPause, onReset, isRunning]);

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
      <Button onClick={onAssemble} label="assemble" shortcut="F6" />
      <Button
        onClick={isRunning ? onPause : onRun}
        label={isRunning ? "pause" : "run"}
        shortcut="F5"
        disabled={isHalted && !isRunning}
      />
      <Button
        onClick={onStep}
        label="step"
        shortcut="F10"
        disabled={isRunning || isHalted}
      />
      <Button onClick={onReset} label="reset" shortcut="Shift+F5" />

      <div className="flex-1" />

      {isHalted && !error && (
        <span
          className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]"
          role="status"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          halted
        </span>
      )}

      {error && (
        <span
          className="text-red-400 text-xs truncate max-w-md"
          role="alert"
          title={error}
        >
          {error}
        </span>
      )}
    </div>
  );
}

function Button({
  onClick,
  label,
  shortcut,
  disabled,
}: {
  onClick: () => void;
  label: string;
  shortcut?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={shortcut ? `${label} (${shortcut})` : label}
      className={`group inline-flex items-center gap-2 px-3 py-1 text-xs rounded border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
        disabled
          ? "border-[var(--border)] text-[var(--text-secondary)] cursor-not-allowed"
          : "border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-panel)] hover:border-[var(--accent)]"
      }`}
      title={shortcut}
    >
      <span>{label}</span>
      {shortcut && (
        <kbd className="hidden sm:inline text-[10px] text-[var(--text-secondary)] font-mono border border-[var(--border)] rounded px-1 py-[1px] group-hover:border-[var(--accent)]">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}
