"use client";

import { useRef, useState } from "react";
import PlayerControlButton from "./player-control-button";
import { VolumeHighIcon, VolumeLowIcon, VolumeMutedIcon } from "./player-icons";

// The volume control: the slider only appears on hover/focus, as a vertical
// popover above the speaker button - never an always-visible inline slider.
// ↑/↓ volume keys are handled by the player's global shortcuts.
export default function VolumeControl({
  volume,
  muted,
  onVolumeChange,
  onToggleMute,
}: {
  volume: number;
  muted: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
}) {
  const sliderRef = useRef<HTMLDivElement>(null);
  // Same ref-plus-state split as the seekbar's scrub: pointer handlers read
  // the ref (a quick press fires move/up before React re-renders); the state
  // only keeps the popover visible mid-drag.
  const draggingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  // A muted player renders as an empty slider; dragging it unmutes
  // (the player's volume setter re-derives muted from the new value).
  const shown = muted ? 0 : volume;
  const percent = Math.round(shown * 100);

  const volumeAtPointer = (clientY: number): number | null => {
    const slider = sliderRef.current;
    if (!slider) return null;
    const rect = slider.getBoundingClientRect();
    if (rect.height === 0) return null;
    return Math.min(Math.max((rect.bottom - clientY) / rect.height, 0), 1);
  };

  // `dragging` keeps the popover up when a drag wanders off the hover area
  // (pointer capture still delivers the moves).
  const visible = open || dragging;

  return (
    <div
      className="relative"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <PlayerControlButton
        label={muted ? "Unmute" : "Mute"}
        onClick={onToggleMute}
      >
        {shown === 0 ? (
          <VolumeMutedIcon className="h-8 w-8" />
        ) : shown < 0.5 ? (
          <VolumeLowIcon className="h-8 w-8" />
        ) : (
          <VolumeHighIcon className="h-8 w-8" />
        )}
      </PlayerControlButton>
      <div
        className={`absolute bottom-full left-1/2 -translate-x-1/2 pb-1 transition-opacity duration-150 ${
          visible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="rounded bg-neutral-900/95 px-3 py-4 shadow-lg">
          <div
            ref={sliderRef}
            role="slider"
            tabIndex={0}
            aria-label="Volume"
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            onPointerDown={(event) => {
              const value = volumeAtPointer(event.clientY);
              if (value === null) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              draggingRef.current = true;
              setDragging(true);
              onVolumeChange(value);
            }}
            onPointerMove={(event) => {
              if (!draggingRef.current) return;
              const value = volumeAtPointer(event.clientY);
              if (value !== null) onVolumeChange(value);
            }}
            onPointerUp={() => {
              draggingRef.current = false;
              setDragging(false);
            }}
            onPointerCancel={() => {
              draggingRef.current = false;
              setDragging(false);
            }}
            className="relative flex h-24 w-5 cursor-pointer touch-none justify-center"
          >
            <div className="relative h-full w-1 bg-white/30">
              <div
                aria-hidden="true"
                className="bg-primary absolute inset-x-0 bottom-0"
                style={{ height: `${percent}%` }}
              />
            </div>
            <div
              aria-hidden="true"
              style={{ bottom: `${percent}%` }}
              className="bg-primary absolute left-1/2 h-3.5 w-3.5 -translate-x-1/2 translate-y-1/2 rounded-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
