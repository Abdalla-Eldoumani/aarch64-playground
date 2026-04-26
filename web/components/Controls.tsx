"use client";

import { useEffect } from "react";

interface ControlsProps {
  onAssemble: () => void;
  onStep: () => void;
  onStepBack?: () => void;
  canStepBack?: boolean;
  onRun: () => void;
  onPause: () => void;
  onReset: () => void;
  isRunning: boolean;
  isHalted: boolean;
  error: string | null;
  stepCount?: number;
}

export function Controls({
  onAssemble,
  onStep,
  onStepBack,
  canStepBack,
  onRun,
  onPause,
  onReset,
  isRunning,
  isHalted,
  error,
  stepCount,
}: ControlsProps) {
  // The error span uses `error` itself as its React key so that any
  // change (new error, fixed error, different error) re-mounts the
  // span and re-fires the css shake. Same trick on the step counter
  // below: a key tied to the count restarts the scale-up animation
  // each step without needing extra effects.

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
      } else if (e.key === "F10" && e.shiftKey) {
        e.preventDefault();
        if (onStepBack && canStepBack) onStepBack();
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
  }, [onAssemble, onStep, onStepBack, canStepBack, onRun, onPause, onReset, isRunning]);

  return (
    <div
      style={{ paddingBottom: "calc(0.5rem + var(--safe-bottom))" }}
      className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 border-t border-[var(--border)] bg-[var(--bg-secondary)]"
    >
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
      {onStepBack && (
        <Button
          onClick={onStepBack}
          label="back"
          shortcut="Shift+F10"
          disabled={isRunning || !canStepBack}
        />
      )}
      <Button onClick={onReset} label="reset" shortcut="Shift+F5" />

      <div className="flex-1" />

      {stepCount != null && stepCount > 0 && (
        <span
          key={stepCount}
          className="hidden sm:inline text-[10px] text-[var(--text-secondary)] font-mono anim-step-pop"
          role="status"
          aria-label={`${stepCount} instructions executed`}
        >
          {stepCount.toLocaleString()} steps
        </span>
      )}

      {isHalted && !error && (
        <span
          className="hidden sm:inline-flex items-center gap-2 font-sans text-xs tracking-wide text-[var(--text-secondary)]"
          role="status"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          halted
        </span>
      )}

      {error && (
        <span
          key={error}
          className="font-sans text-red-400 text-xs truncate max-w-md anim-error-shake"
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
      aria-label={label}
      aria-keyshortcuts={shortcut}
      className={`group inline-flex items-center gap-2 px-2 sm:px-3 py-1 min-h-[28px] font-sans text-xs tracking-wide rounded border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
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
