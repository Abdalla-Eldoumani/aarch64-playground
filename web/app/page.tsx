"use client";

import { useState } from "react";
import { useEmulator } from "@/lib/use-emulator";
import { Editor } from "@/components/Editor";
import { RegisterPanel } from "@/components/RegisterPanel";
import { MemoryPanel } from "@/components/MemoryPanel";
import { StackPanel } from "@/components/StackPanel";
import { Controls } from "@/components/Controls";
import { InstructionView } from "@/components/InstructionView";
import { ExampleLoader } from "@/components/ExampleLoader";

const DEFAULT_SOURCE = `// aarch64 playground
// write ARM64 assembly, hit Assemble, then Step or Run

    MOV X0, #5       // n = 5
    MOV X1, #1       // result = 1
loop:
    MUL X1, X1, X0   // result *= n
    SUBS X0, X0, #1  // n--
    B.GT loop
    SVC #0            // halt
`;

export default function Home() {
  const emu = useEmulator();
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [activeTab, setActiveTab] = useState<"memory" | "stack">("memory");

  if (emu.loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3 px-6 text-center">
        <span className="text-sm text-red-400">failed to load emulator</span>
        <pre className="text-xs text-[var(--text-secondary)] max-w-xl whitespace-pre-wrap">
          {emu.loadError}
        </pre>
        <span className="text-xs text-[var(--text-secondary)]">
          check the browser console for details, then reload the page
        </span>
      </div>
    );
  }

  if (!emu.isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen text-[var(--text-secondary)]">
        loading emulator...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* header bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <span className="text-sm font-bold text-[var(--text-primary)]">aarch64 playground</span>
        <ExampleLoader onLoad={setSource} />
        <div className="flex-1" />
        <a
          href="https://github.com/Abdalla-Eldoumani/aarch64-playground"
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded px-1"
          aria-label="View source on GitHub"
        >
          source
        </a>
      </div>

      {/* main content: stacks on narrow screens, side-by-side from md up */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {/* left: editor + disassembly */}
        <div className="flex flex-col w-full md:w-1/2 border-b md:border-b-0 md:border-r border-[var(--border)] min-h-[50vh] md:min-h-0">
          <div className="flex-1 min-h-0">
            <Editor
              value={source}
              onChange={setSource}
              currentLine={emu.currentLine}
              breakpoints={emu.breakpoints}
              onToggleBreakpoint={emu.toggleBreakpoint}
              assemblyErrors={emu.assemblyErrors}
            />
          </div>
          <div className="h-48 border-t border-[var(--border)] overflow-auto">
            <InstructionView
              instructions={emu.instructions}
              pc={emu.pc}
              codeBase={emu.codeBase}
            />
          </div>
        </div>

        {/* right: registers + memory/stack */}
        <div className="flex flex-col w-full md:w-1/2 min-h-[50vh] md:min-h-0">
          <div className="flex-1 min-h-0 overflow-auto border-b border-[var(--border)]">
            <RegisterPanel
              registers={emu.registers}
              changedRegs={emu.changedRegs}
              sp={emu.sp}
              pc={emu.pc}
              nzcv={emu.nzcv}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="flex border-b border-[var(--border)]" role="tablist" aria-label="memory view">
              <button
                role="tab"
                aria-selected={activeTab === "memory"}
                className={`px-4 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  activeTab === "memory"
                    ? "text-[var(--accent)] border-b border-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
                onClick={() => setActiveTab("memory")}
              >
                memory
              </button>
              <button
                role="tab"
                aria-selected={activeTab === "stack"}
                className={`px-4 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  activeTab === "stack"
                    ? "text-[var(--accent)] border-b border-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
                onClick={() => setActiveTab("stack")}
              >
                stack
              </button>
            </div>
            {activeTab === "memory" ? (
              <MemoryPanel getMemory={emu.getMemory} />
            ) : (
              <StackPanel sp={emu.sp} getMemory={emu.getMemory} />
            )}
          </div>
        </div>
      </div>

      {/* bottom: controls */}
      <Controls
        onAssemble={() => emu.assemble(source)}
        onStep={emu.step}
        onRun={emu.run}
        onPause={emu.pause}
        onReset={emu.reset}
        isRunning={emu.isRunning}
        isHalted={emu.isHalted}
        error={emu.error}
      />
    </div>
  );
}
