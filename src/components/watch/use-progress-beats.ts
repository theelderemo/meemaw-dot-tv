"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  isFinished,
  type EpisodeRef,
  type ProgressBeat,
} from "@/lib/progress/rules";
import type { WatchTarget } from "./use-stream-url";

// One beat per ~15 s of actual playback; pause and leave beats go at once.
export const BEAT_INTERVAL_MS = 15_000;
// Leaving waits for the in-flight beat so the next page reads fresh rows -
// but never longer than this: a slow network must not trap the viewer here.
export const LEAVE_FLUSH_TIMEOUT_MS = 1500;

type Snapshot = { position: number; duration: number };

function snapshotOf(video: HTMLVideoElement): Snapshot {
  return {
    position: video.currentTime,
    duration: Number.isFinite(video.duration) ? video.duration : 0,
  };
}

// Fire-and-forget: a lost beat costs at most 15 s of position and the next
// one replaces it. keepalive lets the leave beat outlive a closing tab
// (architecture doc §Progress).
function postBeat(beat: ProgressBeat): Promise<void> {
  return fetch("/api/progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(beat),
    keepalive: true,
  })
    .then((response) => {
      if (!response.ok) {
        console.error(`[progress] beat rejected (${response.status})`);
      }
    })
    .catch((error) => console.error("[progress] beat failed", error));
}

function settledWithin(promise: Promise<void>, ms: number): Promise<void> {
  return Promise.race([
    promise,
    new Promise<void>((resolve) => window.setTimeout(resolve, ms)),
  ]);
}

export type ProgressBeats = {
  onTimeUpdate: (video: HTMLVideoElement) => void;
  onPause: (video: HTMLVideoElement) => void;
  /** Immediate beat from the last known position; resolves once the latest
   * beat has landed (or LEAVE_FLUSH_TIMEOUT_MS has passed), so a navigation
   * that awaits it renders the saved position, not the previous one. */
  flush: () => Promise<void>;
};

// Position beats for the watch page. Interval beats ride timeupdate and only
// while playing; every beat is skipped while the duration is still unknown or
// the position hasn't moved since the last one (so pause + ended + pagehide
// at the same spot send once). The first beat past FINISHED_FRACTION carries
// advanceTo - the route then queues the next episode automatically.
export function useProgressBeats(
  target: WatchTarget,
  nextEpisode: EpisodeRef | null,
): ProgressBeats {
  const mediaType = target.type;
  const tmdbId = target.tmdbId;
  const season = target.type === "tv" ? target.season : 0;
  const episode = target.type === "tv" ? target.episode : 0;
  const nextSeason = nextEpisode?.season;
  const nextEpisodeNumber = nextEpisode?.episode;

  const latestRef = useRef<Snapshot>({ position: 0, duration: 0 });
  // Position 0 counts as already sent: opening a title and leaving before it
  // starts must not write a zero-second entry.
  const lastSentPositionRef = useRef(0);
  const lastSentAtRef = useRef(0);
  const advancedRef = useRef(false);
  const inflightRef = useRef<Promise<void> | null>(null);

  const beat = useCallback(
    (kind: "interval" | "immediate") => {
      const { position, duration } = latestRef.current;
      if (duration <= 0) return;
      const positionSeconds = Math.floor(position);
      const durationSeconds = Math.round(duration);
      const now = Date.now();
      if (
        kind === "interval" &&
        now - lastSentAtRef.current < BEAT_INTERVAL_MS
      ) {
        return;
      }

      const advanceTo =
        nextSeason !== undefined &&
        nextEpisodeNumber !== undefined &&
        !advancedRef.current &&
        isFinished(positionSeconds, durationSeconds)
          ? { season: nextSeason, episode: nextEpisodeNumber }
          : undefined;
      if (positionSeconds === lastSentPositionRef.current && !advanceTo) {
        return;
      }

      lastSentPositionRef.current = positionSeconds;
      lastSentAtRef.current = now;
      if (advanceTo) advancedRef.current = true;
      inflightRef.current = postBeat({
        mediaType,
        tmdbId,
        season,
        episode,
        positionSeconds,
        durationSeconds,
        ...(advanceTo ? { advanceTo } : {}),
      });
    },
    [mediaType, tmdbId, season, episode, nextSeason, nextEpisodeNumber],
  );

  const onTimeUpdate = useCallback(
    (video: HTMLVideoElement) => {
      latestRef.current = snapshotOf(video);
      if (!video.paused) beat("interval");
    },
    [beat],
  );

  const onPause = useCallback(
    (video: HTMLVideoElement) => {
      latestRef.current = snapshotOf(video);
      beat("immediate");
    },
    [beat],
  );

  const flush = useCallback((): Promise<void> => {
    beat("immediate");
    const inflight = inflightRef.current;
    return inflight
      ? settledWithin(inflight, LEAVE_FLUSH_TIMEOUT_MS)
      : Promise.resolve();
  }, [beat]);

  // A new target starts from nothing sent; the outgoing target's last position
  // is flushed on the way out (also the unmount path - client-side navigation
  // fires no pagehide).
  useEffect(() => {
    lastSentPositionRef.current = 0;
    lastSentAtRef.current = 0;
    advancedRef.current = false;
    return () => beat("immediate");
  }, [beat]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onPageHide = () => void flush();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [flush]);

  return useMemo(
    () => ({ onTimeUpdate, onPause, flush }),
    [onTimeUpdate, onPause, flush],
  );
}
