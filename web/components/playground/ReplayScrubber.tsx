"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReplayFrame } from "@/lib/emulator/replay";

interface ReplayScrubberProps {
  frames: ReplayFrame[];
  currentStep: number;
  onSeek: (frameIndex: number) => void;
}

/**
 * Slider + play button above the RegisterPanel that lets a student
 * scrub through the last N captured frames. Renders nothing when
 * there are fewer than two frames -- the panel is empty until the
 * student steps a couple of times. Visual-only: scrubbing applies
 * the captured frame to React state without touching the underlying
 * CPU; the next forward `step` resumes from the live PC.
 */
export function ReplayScrubber({ frames, currentStep, onSeek }: ReplayScrubberProps) {
  const [playing, setPlaying] = useState(false);
  const [sliderIdx, setSliderIdx] = useState<number | null>(null);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Match the slider position to whichever captured frame matches the
  // live step count (clamped to the last frame when we've stepped past
  // the ring's capacity).
  const liveIdx = useMemo(() => {
    if (frames.length === 0) return 0;
    let idx = frames.length - 1;
    for (let i = frames.length - 1; i >= 0; i--) {
      if (frames[i].stepCount <= currentStep) { idx = i; break; }
    }
    return idx;
  }, [frames, currentStep]);

  // Stop the playback timer if the frame set shrinks under us
  // (assemble / reset clears the ring).
  useEffect(() => {
    if (frames.length < 2 && playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
      setPlaying(false);
      setSliderIdx(null);
    }
  }, [frames.length]);

  if (frames.length < 2) return null;

  const idx = sliderIdx ?? liveIdx;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    if (!Number.isFinite(v)) return;
    setSliderIdx(v);
    onSeek(v);
  };

  const togglePlay = () => {
    if (playing) {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
      setPlaying(false);
      return;
    }
    // Replay all frames in ~500 ms total. Floor to 30 ms so we don't
    // spam React with sub-frame ticks on a tiny ring.
    const interval = Math.max(30, Math.floor(500 / frames.length));
    let i = 0;
    setSliderIdx(0);
    onSeek(0);
    setPlaying(true);
    playTimerRef.current = setInterval(() => {
      i++;
      if (i >= frames.length) {
        if (playTimerRef.current) {
          clearInterval(playTimerRef.current);
          playTimerRef.current = null;
        }
        setPlaying(false);
        return;
      }
      setSliderIdx(i);
      onSeek(i);
    }, interval);
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-1 border-b border-[var(--border)] bg-[var(--bg-sunken)] text-[11px]"
      aria-label="replay scrubber"
    >
      <button
        type="button"
        onClick={togglePlay}
        className="text-[var(--cyan)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--cyan)] rounded px-1"
        aria-label={playing ? "pause replay" : "play replay"}
      >
        {playing ? "pause" : "play"}
      </button>
      <span className="text-[var(--text-secondary)] font-mono whitespace-nowrap">
        replay
      </span>
      <input
        type="range"
        min={0}
        max={frames.length - 1}
        step={1}
        value={idx}
        onChange={onChange}
        className="flex-1 accent-[var(--amber)]"
        aria-label="replay step slider"
      />
      <span className="text-[var(--text-secondary)] font-mono whitespace-nowrap tabular-nums">
        step {frames[idx]?.stepCount ?? 0} / {frames[frames.length - 1]?.stepCount ?? 0}
      </span>
    </div>
  );
}
