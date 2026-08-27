"use client";

import { useCallback, useEffect, useState } from "react";
import type { StreamOption } from "@/lib/streaming/stream-options";
import Spinner from "./spinner";
import type { WatchTarget } from "./use-stream-url";

// Switch Streams: the one place the app shows the viewer every copy
// Torrentio has - including everything the picker excludes - so a
// wrong-language or dead file has a manual way out. Plain words only; the
// release name is the one unavoidable piece of jargon.

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  it: "Italian",
  fr: "French",
  es: "Spanish",
  hi: "Hindi",
  ru: "Russian",
  uk: "Ukrainian",
  de: "German",
  pl: "Polish",
  pt: "Portuguese",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  multi: "several languages",
  dual: "two languages",
  dubbed: "dubbed",
};

function languageLabel(hints: string[]): string {
  if (hints.length === 0) return "English";
  return hints
    .map((hint) => LANGUAGE_NAMES[hint] ?? hint.toUpperCase())
    .join(", ");
}

function sizeLabel(bytes: number | null): string | null {
  if (bytes === null) return null;
  const gb = bytes / 1024 ** 3;
  return gb >= 1
    ? `${gb.toFixed(1)} GB`
    : `${Math.round(bytes / 1024 ** 2)} MB`;
}

function metaLine(option: StreamOption): string {
  return [
    option.resolution,
    sizeLabel(option.sizeBytes),
    option.seeders === null ? null : `${option.seeders} seeders`,
    languageLabel(option.languageHints),
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

type ListState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; options: StreamOption[] };

function optionsQuery(target: WatchTarget): string {
  return target.type === "movie"
    ? `type=movie&tmdbId=${target.tmdbId}`
    : `type=tv&tmdbId=${target.tmdbId}&season=${target.season}&episode=${target.episode}`;
}

export default function StreamSwitcher({
  target,
  currentKey,
  onSelect,
  onClose,
}: {
  target: WatchTarget;
  /** Key of the stream playing now, or null when nothing resolved. */
  currentKey: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: ListState;
      try {
        const response = await fetch(
          `/api/stream/options?${optionsQuery(target)}`,
          {
            cache: "no-store",
          },
        );
        const body: unknown = response.ok ? await response.json() : null;
        const options =
          typeof body === "object" && body !== null && "options" in body
            ? (body.options as StreamOption[])
            : null;
        next = options ? { status: "ready", options } : { status: "error" };
      } catch {
        next = { status: "error" };
      }
      if (!cancelled) setList(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [target, attempt]);

  const retry = useCallback(() => {
    setList({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stream-switcher-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background-elevated flex max-h-[85vh] w-full max-w-2xl flex-col rounded shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div>
            <h2 id="stream-switcher-title" className="text-2xl font-bold">
              Switch Streams
            </h2>
            <p className="text-muted mt-1 text-sm">
              Pick another copy of this title if the video or the sound
              isn&apos;t right. The ones marked Recommended are what we&apos;d
              normally play.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-foreground flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-2xl hover:bg-white/10"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {list.status === "loading" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Spinner />
              <p className="text-muted">Finding copies…</p>
            </div>
          )}
          {list.status === "error" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <p className="text-lg">Couldn&apos;t load the list right now.</p>
              <button
                type="button"
                onClick={retry}
                className="rounded bg-white px-6 py-2 font-bold text-black hover:bg-white/75"
              >
                Try again
              </button>
            </div>
          )}
          {list.status === "ready" && list.options.length === 0 && (
            <p className="py-12 text-center text-lg">
              No copies of this title are available right now.
            </p>
          )}
          {list.status === "ready" && list.options.length > 0 && (
            <ul>
              {list.options.map((option) => {
                const current = option.key === currentKey;
                return (
                  <li key={option.key}>
                    <button
                      type="button"
                      disabled={current}
                      onClick={() => onSelect(option.key)}
                      className={`flex w-full cursor-pointer flex-col gap-1 rounded px-4 py-3 text-left hover:bg-white/10 disabled:cursor-default disabled:bg-white/5 ${
                        current ? "ring-primary ring-2" : ""
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {option.releaseName ?? "Unnamed copy"}
                        </span>
                        {current && (
                          <span className="text-primary-soft shrink-0 text-xs font-bold uppercase">
                            Now playing
                          </span>
                        )}
                        {!current && option.recommended && (
                          <span className="bg-primary shrink-0 rounded px-1.5 py-0.5 text-xs font-bold uppercase">
                            Recommended
                          </span>
                        )}
                      </span>
                      <span className="text-muted text-sm">
                        {metaLine(option)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
