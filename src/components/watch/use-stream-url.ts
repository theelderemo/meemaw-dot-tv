"use client";

import { useCallback, useEffect, useState } from "react";
import type { WatchErrorKind } from "./watch-error";

export type WatchTarget =
  | { type: "movie"; tmdbId: number }
  | { type: "tv"; tmdbId: number; season: number; episode: number };

export type StreamState =
  | { status: "resolving" }
  | { status: "ready"; url: string; key: string | null }
  | { status: "unauthorized" }
  | { status: "error"; kind: WatchErrorKind };

function streamQuery(target: WatchTarget): string {
  return target.type === "movie"
    ? `type=movie&tmdbId=${target.tmdbId}`
    : `type=tv&tmdbId=${target.tmdbId}&season=${target.season}&episode=${target.episode}`;
}

function successBody(
  body: unknown,
): { url: string; key: string | null } | null {
  if (
    typeof body === "object" &&
    body !== null &&
    "url" in body &&
    typeof body.url === "string"
  ) {
    const key = "key" in body && typeof body.key === "string" ? body.key : null;
    return { url: body.url, key };
  }
  return null;
}

function errorCode(body: unknown): string | null {
  const code =
    typeof body === "object" && body !== null && "error" in body
      ? body.error
      : null;
  return typeof code === "string" ? code : null;
}

// NOT_FOUND and NOT_CACHED share a 404 status - only the body code separates
// "we don't have that title" from "nothing resolved this time". A NOT_CACHED
// on a manual Switch Streams pick gets its own copy.
function errorKind(code: string | null, manualPick: boolean): WatchErrorKind {
  switch (code) {
    case "NOT_FOUND":
      return "not-found";
    case "NOT_CACHED":
      return manualPick ? "not-cached-manual" : "not-cached";
    case "PROVIDER_DOWN":
      return "provider-down";
    case "INTERNAL":
      return "internal";
    case "BAD_REQUEST":
      return "bad-request";
    default:
      return "generic";
  }
}

// Client-side /api/stream fetch. The URL is requested on mount and never
// server-rendered: it's short-lived and account-tied (stream-resolution.md),
// so HTML carrying it could serve a dead link. requestFresh() re-resolves
// with fresh=1 - the documented recovery path after a playback error.
export function useStreamUrl(target: WatchTarget): {
  stream: StreamState;
  requestFresh: () => void;
  /** Switch Streams: resolve one explicit stream by its opaque key
   * instead of the picker's choice. Sticks for this sitting - a later
   * fresh=1 retry re-resolves the same pick. */
  selectStream: (streamKey: string) => void;
} {
  const [freshNonce, setFreshNonce] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const query = streamQuery(target);
  const key = `${query}#${selectedKey ?? ""}#${freshNonce}`;

  const [result, setResult] = useState<{ key: string; stream: StreamState }>({
    key,
    stream: { status: "resolving" },
  });
  // Render-time adjustment (detail-modal's `shown` pattern): a new key reads
  // as resolving immediately, without a setState-in-effect round-trip.
  if (result.key !== key) setResult({ key, stream: { status: "resolving" } });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let stream: StreamState;
      let errorLog: string | null = null;
      try {
        const fresh = freshNonce > 0 ? "&fresh=1" : "";
        const pick = selectedKey === null ? "" : `&stream=${selectedKey}`;
        // no-store: the browser HTTP cache re-serving an expired stream URL is
        // exactly the staleness this endpoint's own cache is tuned to avoid.
        const response = await fetch(`/api/stream?${query}${pick}${fresh}`, {
          cache: "no-store",
        });
        if (response.status === 401) {
          stream = { status: "unauthorized" };
        } else {
          const body: unknown = await response.json();
          const success = response.ok ? successBody(body) : null;
          if (success !== null) {
            stream = { status: "ready", url: success.url, key: success.key };
          } else {
            const code = errorCode(body);
            // Code visibility rule: log code + status once, here where the
            // error state is first known - not in the component render.
            errorLog = `[watch] ${code ?? "UNKNOWN"} (${response.status})`;
            stream = {
              status: "error",
              kind: errorKind(code, selectedKey !== null),
            };
          }
        }
      } catch {
        // Network failure or a non-JSON body - same friendly dead end.
        stream = { status: "error", kind: "generic" };
      }
      if (!cancelled) {
        if (errorLog !== null) console.error(errorLog);
        setResult({ key, stream });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, query, freshNonce, selectedKey]);

  const requestFresh = useCallback(() => setFreshNonce((n) => n + 1), []);
  const selectStream = useCallback((streamKey: string) => {
    setSelectedKey(streamKey);
    setFreshNonce((n) => n + 1);
  }, []);

  return { stream: result.stream, requestFresh, selectStream };
}
