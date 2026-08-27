"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getSeasonAction,
  getTitleDetailsAction,
} from "@/app/(app)/(browse)/browse/actions";
import type { MediaType, Season, TitleDetails } from "@/lib/tmdb/schemas";

// The detail modal's provider, with page-lifetime caches (plain Maps
// in state - reopening a title or revisiting a season never refetches) and
// per-key error flags so the modal can show a retry message.

export type DetailTarget = { mediaType: MediaType; id: number };

export function titleKey(target: DetailTarget): string {
  return `${target.mediaType}:${target.id}`;
}

function seasonKey(tvId: number, seasonNumber: number): string {
  return `${tvId}:${seasonNumber}`;
}

type DetailModalContextValue = {
  /** Title the modal should currently show; null = closed. */
  target: DetailTarget | null;
  openTitle: (mediaType: MediaType, id: number) => void;
  close: () => void;
  /** Idempotent ensure-fetched - also the retry path after an error. */
  loadDetails: (target: DetailTarget) => void;
  getDetails: (target: DetailTarget) => TitleDetails | null;
  hasDetailsError: (target: DetailTarget) => boolean;
  /** Idempotent ensure-fetched - also the retry path after an error. */
  requestSeason: (tvId: number, seasonNumber: number) => void;
  getSeason: (tvId: number, seasonNumber: number) => Season | null;
  hasSeasonError: (tvId: number, seasonNumber: number) => boolean;
};

const DetailModalContext = createContext<DetailModalContextValue | null>(null);

export function useDetailModal(): DetailModalContextValue {
  const value = useContext(DetailModalContext);
  if (!value) {
    throw new Error("useDetailModal must be used inside DetailModalProvider");
  }
  return value;
}

function without(set: Set<string>, key: string): Set<string> {
  if (!set.has(key)) return set;
  const next = new Set(set);
  next.delete(key);
  return next;
}

export default function DetailModalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [target, setTarget] = useState<DetailTarget | null>(null);
  const [details, setDetails] = useState<Map<string, TitleDetails>>(new Map());
  const [detailErrors, setDetailErrors] = useState<Set<string>>(new Set());
  const [seasons, setSeasons] = useState<Map<string, Season>>(new Map());
  const [seasonErrors, setSeasonErrors] = useState<Set<string>>(new Set());

  // The ref maps are the callbacks' synchronous view of the caches (written
  // only inside fetch callbacks, never during render); the state maps above
  // mirror them for reactive reads. inflight keys de-dupe concurrent requests.
  const detailsCacheRef = useRef(new Map<string, TitleDetails>());
  const seasonCacheRef = useRef(new Map<string, Season>());
  const inflightRef = useRef(new Set<string>());

  const loadDetails = useCallback((detailTarget: DetailTarget) => {
    const key = titleKey(detailTarget);
    if (detailsCacheRef.current.has(key) || inflightRef.current.has(key)) {
      return;
    }
    inflightRef.current.add(key);
    setDetailErrors((prev) => without(prev, key));

    void getTitleDetailsAction(detailTarget.mediaType, detailTarget.id).then(
      (result) => {
        inflightRef.current.delete(key);
        if (result.ok) {
          detailsCacheRef.current.set(key, result.data);
          setDetails(new Map(detailsCacheRef.current));
        } else {
          setDetailErrors((prev) => new Set(prev).add(key));
        }
      },
    );
  }, []);

  const requestSeason = useCallback((tvId: number, seasonNumber: number) => {
    const key = seasonKey(tvId, seasonNumber);
    if (seasonCacheRef.current.has(key) || inflightRef.current.has(key)) {
      return;
    }
    inflightRef.current.add(key);
    setSeasonErrors((prev) => without(prev, key));

    void getSeasonAction(tvId, seasonNumber).then((result) => {
      inflightRef.current.delete(key);
      if (result.ok) {
        seasonCacheRef.current.set(key, result.data);
        setSeasons(new Map(seasonCacheRef.current));
      } else {
        setSeasonErrors((prev) => new Set(prev).add(key));
      }
    });
  }, []);

  const openTitle = useCallback(
    (mediaType: MediaType, id: number) => {
      const nextTarget: DetailTarget = { mediaType, id };
      setTarget(nextTarget);
      loadDetails(nextTarget);
    },
    [loadDetails],
  );

  const close = useCallback(() => setTarget(null), []);

  const value = useMemo<DetailModalContextValue>(
    () => ({
      target,
      openTitle,
      close,
      loadDetails,
      getDetails: (detailTarget) => details.get(titleKey(detailTarget)) ?? null,
      hasDetailsError: (detailTarget) =>
        detailErrors.has(titleKey(detailTarget)),
      requestSeason,
      getSeason: (tvId, seasonNumber) =>
        seasons.get(seasonKey(tvId, seasonNumber)) ?? null,
      hasSeasonError: (tvId, seasonNumber) =>
        seasonErrors.has(seasonKey(tvId, seasonNumber)),
    }),
    [
      target,
      openTitle,
      close,
      loadDetails,
      requestSeason,
      details,
      detailErrors,
      seasons,
      seasonErrors,
    ],
  );

  return (
    <DetailModalContext.Provider value={value}>
      {children}
    </DetailModalContext.Provider>
  );
}
