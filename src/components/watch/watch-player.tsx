"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EpisodeRef } from "@/lib/progress/rules";
import { formatTime } from "./format-time";
import NextEpisodeOverlay, {
  NEXT_EPISODE_COUNTDOWN_MS,
} from "./next-episode-overlay";
import PlayerControlButton from "./player-control-button";
import {
  Back10Icon,
  BackArrowIcon,
  Forward10Icon,
  FullscreenExitIcon,
  FullscreenIcon,
  PauseIcon,
  PlayIcon,
  SkipNextIcon,
  StreamsIcon,
} from "./player-icons";
import PlayerSeekbar from "./player-seekbar";
import Spinner from "./spinner";
import StreamSwitcher from "./stream-switcher";
import { useProgressBeats } from "./use-progress-beats";
import { useStreamUrl, type WatchTarget } from "./use-stream-url";
import VolumeControl from "./volume-control";
import WatchError, {
  WATCH_ERROR_CODES,
  WATCH_ERROR_INSTRUCTIONS,
  WATCH_ERROR_MESSAGES,
} from "./watch-error";
import { watchHref } from "./watch-route";

const CONTROLS_HIDE_MS = 3000;
const SEEK_STEP_SECONDS = 10;
const VOLUME_STEP = 0.1;

type PlaybackState = {
  paused: boolean;
  muted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  buffering: boolean;
};

// The buffered range around the playhead (what the seekbar shades); falls
// back to the furthest range so a fresh seek target still shows progress.
function bufferedEndFor(video: HTMLVideoElement): number {
  const { buffered, currentTime } = video;
  let furthest = 0;
  for (let i = 0; i < buffered.length; i += 1) {
    if (buffered.start(i) <= currentTime && currentTime <= buffered.end(i)) {
      return buffered.end(i);
    }
    furthest = Math.max(furthest, buffered.end(i));
  }
  return furthest;
}

// The watch page over a native <video>: full-viewport black, a custom
// control bar, no `controls` attribute. Controls auto-hide
// after 3s of stillness (cursor with them) and never hide while paused or
// mid-drag.
export default function WatchPlayer({
  target,
  title,
  subtitle,
  startAt = 0,
  nextEpisode = null,
}: {
  target: WatchTarget;
  title: string;
  /** "S5:E14 Episode Name" for TV; absent for movies. */
  subtitle?: string;
  /** Saved position to resume from, in seconds; 0 starts from the top. */
  startAt?: number;
  /** TV only: the episode after this one; null at the end of the show. */
  nextEpisode?: EpisodeRef | null;
}) {
  const router = useRouter();
  const { stream, requestFresh, selectStream } = useStreamUrl(target);
  const beats = useProgressBeats(target, nextEpisode);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const pointerHeldRef = useRef(false);
  const retriedFreshRef = useRef(false);
  // Seeded with the saved position; also carries the viewer's place across
  // the fresh-URL remount after a playback error.
  const resumeAtRef = useRef(startAt);
  const autoAdvanceTimerRef = useRef<number | null>(null);

  const [playback, setPlayback] = useState<PlaybackState>({
    paused: true,
    muted: false,
    volume: 1,
    currentTime: 0,
    duration: 0,
    bufferedEnd: 0,
    buffering: false,
  });
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [failedAfterRetry, setFailedAfterRetry] = useState(false);
  const [autoAdvancing, setAutoAdvancing] = useState(false);
  // Switch Streams. Mirrored into a ref so the hide timer and the
  // keyboard handler see it without re-subscribing.
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherOpenRef = useRef(false);
  useEffect(() => {
    switcherOpenRef.current = switcherOpen;
  }, [switcherOpen]);

  const armHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      const video = videoRef.current;
      // The bar stays up while paused; a held pointer (mid-scrub)
      // must not lose its slider. Both exits re-arm this timer: the `play`
      // event and the global pointerup handler each call showControls().
      if (
        !video ||
        video.paused ||
        pointerHeldRef.current ||
        switcherOpenRef.current
      )
        return;
      setControlsVisible(false);
    }, CONTROLS_HIDE_MS);
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    armHideTimer();
  }, [armHideTimer]);

  // Controls start visible; mount only needs the countdown running.
  useEffect(() => {
    armHideTimer();
    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, [armHideTimer]);

  useEffect(() => {
    const onPointerUp = () => {
      pointerHeldRef.current = false;
      showControls();
    };
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, [showControls]);

  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // /api/stream 401 means no/expired session - same destination the server
  // gate would have picked.
  useEffect(() => {
    if (stream.status === "unauthorized") router.replace("/login");
  }, [stream.status, router]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      // An autoplay-policy rejection just leaves the paused UI showing -
      // that's the recovery, not an error.
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const clamped = Math.min(Math.max(seconds, 0), video.duration);
    video.currentTime = clamped;
    // Optimistic: the next timeupdate lags the seek, and the seekbar would
    // briefly snap back without this.
    setPlayback((prev) => ({ ...prev, currentTime: clamped }));
  }, []);

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (video) seekTo(video.currentTime + delta);
    },
    [seekTo],
  );

  const setVolume = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.min(Math.max(value, 0), 1);
    video.volume = clamped;
    // Dragging to zero mutes, raising any volume unmutes.
    video.muted = clamped === 0;
  }, []);

  const adjustVolume = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (video) setVolume((video.muted ? 0 : video.volume) + delta);
    },
    [setVolume],
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (video) video.muted = !video.muted;
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement !== null) {
      void document.exitFullscreen().catch(() => {});
    } else {
      // Denial (missing user activation) just leaves the page windowed.
      void containerRef.current?.requestFullscreen().catch(() => {});
    }
  }, []);

  // The countdown timer is a ref, cleared directly: a back-arrow click must
  // never race a pending auto-advance into navigating out from under the
  // viewer.
  const cancelAutoAdvance = useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setAutoAdvancing(false);
  }, []);

  useEffect(
    () => () => {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }
    },
    [],
  );

  const nextEpisodeHref =
    target.type === "tv" && nextEpisode
      ? watchHref("tv", target.tmdbId, nextEpisode.season, nextEpisode.episode)
      : null;

  // Both exits stop the video first (its pause beat carries the final
  // position - client-side navigation fires no pagehide) and wait for that
  // beat to land before navigating, so the next page renders the fresh row
  // rather than racing the write. flush() bounds the wait.
  const goToNextEpisode = useCallback(() => {
    if (nextEpisodeHref === null) return;
    cancelAutoAdvance();
    videoRef.current?.pause();
    void beats.flush().then(() => router.push(nextEpisodeHref));
  }, [nextEpisodeHref, cancelAutoAdvance, beats, router]);

  const leaveToBrowse = useCallback(() => {
    cancelAutoAdvance();
    videoRef.current?.pause();
    void beats.flush().then(() => router.push("/browse"));
  }, [cancelAutoAdvance, beats, router]);

  // Standard player keyboard shortcuts. Global on purpose: space/arrows work without
  // first clicking the player. Never hijacks typing (no inputs exist on this
  // page today, but the guard is the a11y contract) or browser chords.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      // The switcher owns the keyboard while open: Esc closes it, nothing
      // else reaches the player (space must not toggle playback under it).
      if (switcherOpenRef.current) {
        if (event.key === "Escape") {
          event.preventDefault();
          setSwitcherOpen(false);
        }
        return;
      }
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      let handled = true;
      switch (key) {
        case " ":
        case "k":
          togglePlay();
          break;
        case "ArrowLeft":
          seekBy(-SEEK_STEP_SECONDS);
          break;
        case "ArrowRight":
          seekBy(SEEK_STEP_SECONDS);
          break;
        case "ArrowUp":
          adjustVolume(VOLUME_STEP);
          break;
        case "ArrowDown":
          adjustVolume(-VOLUME_STEP);
          break;
        case "m":
          toggleMute();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "Escape":
          if (document.fullscreenElement !== null) {
            void document.exitFullscreen().catch(() => {});
          } else {
            handled = false;
          }
          break;
        default:
          handled = false;
      }
      if (handled) {
        event.preventDefault();
        showControls();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    togglePlay,
    seekBy,
    adjustVolume,
    toggleMute,
    toggleFullscreen,
    showControls,
  ]);

  const handleVideoError = () => {
    // A resolved RD URL is short-lived and account-tied - it can expire even
    // though resolution succeeded (stream-resolution.md). Re-request once with
    // fresh=1, the documented recovery path, keeping the viewer's place;
    // retrying more than once would loop forever on a genuinely dead stream.
    if (!retriedFreshRef.current) {
      retriedFreshRef.current = true;
      resumeAtRef.current = videoRef.current?.currentTime ?? 0;
      requestFresh();
      return;
    }
    setFailedAfterRetry(true);
  };

  const openSwitcher = () => {
    setSwitcherOpen(true);
    showControls();
  };
  // A manual pick keeps the viewer's place and gets a clean retry budget: the
  // fresh=1 retry after a video error re-resolves the same pick (use-stream-url).
  const chooseStream = (streamKey: string) => {
    resumeAtRef.current = videoRef.current?.currentTime ?? resumeAtRef.current;
    retriedFreshRef.current = false;
    setFailedAfterRetry(false);
    setSwitcherOpen(false);
    selectStream(streamKey);
  };
  const switcher = switcherOpen ? (
    <StreamSwitcher
      target={target}
      currentKey={stream.status === "ready" ? stream.key : null}
      onSelect={chooseStream}
      onClose={() => setSwitcherOpen(false)}
    />
  ) : null;
  // The failure screens offer the switcher too, except when the title itself
  // is unknown.
  const switchAction = (
    <button
      type="button"
      onClick={openSwitcher}
      className="rounded border-2 border-white px-10 py-4 text-xl font-bold text-white transition-colors hover:bg-white/20"
    >
      Switch Streams
    </button>
  );

  if (failedAfterRetry) {
    return (
      <>
        <WatchError
          message={WATCH_ERROR_MESSAGES.generic}
          action={switchAction}
        />
        {switcher}
      </>
    );
  }
  if (stream.status === "error") {
    return (
      <>
        <WatchError
          message={WATCH_ERROR_MESSAGES[stream.kind]}
          instruction={WATCH_ERROR_INSTRUCTIONS[stream.kind]}
          code={WATCH_ERROR_CODES[stream.kind]}
          action={stream.kind === "not-found" ? undefined : switchAction}
        />
        {switcher}
      </>
    );
  }
  if (stream.status === "unauthorized") {
    return null;
  }
  if (stream.status === "resolving") {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <div className="absolute top-5 left-4 sm:left-8">
          <PlayerControlButton label="Back to Browse" onClick={leaveToBrowse}>
            <BackArrowIcon className="h-9 w-9" />
          </PlayerControlButton>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
          <Spinner />
          <p className="text-muted">Meemaw is untangling the yarn…</p>
        </div>
      </div>
    );
  }

  const interactive = controlsVisible ? "pointer-events-auto" : "";
  const remaining = Math.max(playback.duration - playback.currentTime, 0);

  return (
    <div
      ref={containerRef}
      onPointerMove={showControls}
      onPointerDown={() => {
        pointerHeldRef.current = true;
        showControls();
      }}
      className={`fixed inset-0 z-50 bg-black ${controlsVisible ? "" : "cursor-none"}`}
    >
      {/* key: after a fresh re-resolve the element remounts clean, replaying
          autoplay + metadata (which restores the place via resumeAtRef). */}
      <video
        key={stream.url}
        ref={videoRef}
        src={stream.url}
        autoPlay
        onClick={togglePlay}
        onPlay={() => {
          setPlayback((prev) => ({ ...prev, paused: false }));
          cancelAutoAdvance();
          showControls();
        }}
        onPause={(event) => {
          setPlayback((prev) => ({ ...prev, paused: true }));
          beats.onPause(event.currentTarget);
          showControls();
        }}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          setPlayback((prev) => ({
            ...prev,
            currentTime: video.currentTime,
            bufferedEnd: bufferedEndFor(video),
          }));
          beats.onTimeUpdate(video);
        }}
        onDurationChange={(event) => {
          const { duration } = event.currentTarget;
          setPlayback((prev) => ({
            ...prev,
            duration: Number.isFinite(duration) ? duration : 0,
          }));
        }}
        onVolumeChange={(event) => {
          const video = event.currentTarget;
          setPlayback((prev) => ({
            ...prev,
            volume: video.volume,
            muted: video.muted,
          }));
        }}
        onProgress={(event) => {
          const video = event.currentTarget;
          setPlayback((prev) => ({
            ...prev,
            bufferedEnd: bufferedEndFor(video),
          }));
        }}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          const resumeAt = resumeAtRef.current;
          resumeAtRef.current = 0;
          // A different release of the same title can run shorter than the
          // one the progress was saved against - never seek past what this
          // file has.
          if (resumeAt > 0 && resumeAt < video.duration) {
            video.currentTime = resumeAt;
          }
        }}
        onWaiting={() => setPlayback((prev) => ({ ...prev, buffering: true }))}
        onPlaying={() => setPlayback((prev) => ({ ...prev, buffering: false }))}
        onEnded={() => {
          showControls();
          void beats.flush();
          // The end-of-episode countdown; a finale just leaves the
          // controls up.
          if (nextEpisodeHref !== null) {
            setAutoAdvancing(true);
            autoAdvanceTimerRef.current = window.setTimeout(
              goToNextEpisode,
              NEXT_EPISODE_COUNTDOWN_MS,
            );
          }
        }}
        onSeeking={cancelAutoAdvance}
        onError={handleVideoError}
        className="h-full w-full object-contain"
      />

      {playback.buffering && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Spinner />
        </div>
      )}

      {/* Controls overlay. Root ignores the pointer so the video stays
          clickable; only the two control clusters re-enable it while shown. */}
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
          controlsVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-black/70 to-transparent"
        />
        <div className={`absolute top-5 left-4 sm:left-8 ${interactive}`}>
          <PlayerControlButton label="Back to Browse" onClick={leaveToBrowse}>
            <BackArrowIcon className="h-9 w-9" />
          </PlayerControlButton>
        </div>

        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-44 bg-linear-to-t from-black/80 to-transparent"
        />
        <div
          className={`absolute inset-x-0 bottom-0 flex flex-col gap-2 px-4 pb-4 sm:px-8 ${interactive}`}
        >
          <div className="flex items-center gap-4">
            <PlayerSeekbar
              currentTime={playback.currentTime}
              duration={playback.duration}
              bufferedEnd={playback.bufferedEnd}
              onSeek={seekTo}
            />
            <span className="shrink-0 text-sm font-medium tabular-nums">
              {formatTime(remaining)}
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <PlayerControlButton
              label={playback.paused ? "Play" : "Pause"}
              onClick={togglePlay}
            >
              {playback.paused ? (
                <PlayIcon className="h-9 w-9" />
              ) : (
                <PauseIcon className="h-9 w-9" />
              )}
            </PlayerControlButton>
            <PlayerControlButton
              label="Back 10 seconds"
              onClick={() => seekBy(-SEEK_STEP_SECONDS)}
            >
              <Back10Icon className="h-8 w-8" />
            </PlayerControlButton>
            <PlayerControlButton
              label="Forward 10 seconds"
              onClick={() => seekBy(SEEK_STEP_SECONDS)}
            >
              <Forward10Icon className="h-8 w-8" />
            </PlayerControlButton>
            <VolumeControl
              volume={playback.volume}
              muted={playback.muted}
              onVolumeChange={setVolume}
              onToggleMute={toggleMute}
            />
            <div className="pointer-events-none min-w-0 flex-1 px-2 text-center">
              <p className="truncate text-base sm:text-lg">
                <span className="font-bold">{title}</span>
                {subtitle && (
                  <span className="text-muted ml-3">{subtitle}</span>
                )}
              </p>
            </div>
            {nextEpisodeHref !== null && (
              <PlayerControlButton
                label="Next Episode"
                onClick={goToNextEpisode}
              >
                <SkipNextIcon className="h-9 w-9" />
              </PlayerControlButton>
            )}
            <button
              type="button"
              onClick={openSwitcher}
              className="text-foreground flex h-12 shrink-0 cursor-pointer items-center gap-2 px-2 text-base font-medium hover:underline"
            >
              <StreamsIcon className="h-8 w-8" />
              <span className="hidden sm:inline">Switch Streams</span>
              <span className="sr-only sm:hidden">Switch Streams</span>
            </button>
            <PlayerControlButton
              label={isFullscreen ? "Exit full screen" : "Full screen"}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <FullscreenExitIcon className="h-8 w-8" />
              ) : (
                <FullscreenIcon className="h-8 w-8" />
              )}
            </PlayerControlButton>
          </div>
        </div>
      </div>

      {autoAdvancing && <NextEpisodeOverlay onNext={goToNextEpisode} />}
      {switcher}
    </div>
  );
}
