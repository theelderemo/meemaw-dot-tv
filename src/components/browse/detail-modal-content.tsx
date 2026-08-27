"use client";

import Image from "next/image";
import { comingDate } from "@/lib/tmdb/release";
import type { SeasonSummary, TitleDetails } from "@/lib/tmdb/schemas";
import ComingSoon from "./coming-soon";
import { useDetailModal } from "./detail-modal-provider";
import EpisodesSection from "./episodes-section";
import MyListButton from "./my-list-button";
import PlayButton from "./play-button";
import { formatRuntime } from "./runtime";
import SimilarVideoCard from "./similar-video-card";
import { tmdbImageUrl } from "./tmdb-image";
import { useToday } from "./today-provider";

const CAST_COUNT = 4;

export default function DetailModalContent({
  details,
}: {
  details: TitleDetails;
}) {
  const { openTitle } = useDetailModal();
  const today = useToday();

  const coming = comingDate(details.releaseDate, today);
  const matchPercent = Math.round(details.rating * 10);
  const headerImage = details.backdropPath ?? details.posterPath;
  const cast = details.cast.slice(0, CAST_COUNT);
  const moreLikeThis = details.recommendations.filter(
    (title) => title.backdropPath !== null || title.posterPath !== null,
  );
  const seasonOptions: SeasonSummary[] =
    details.mediaType === "tv"
      ? details.seasons.length > 0
        ? details.seasons
        : // Degenerate TMDB payload (no seasons array): synthesize labels so
          // the episode list still works.
          Array.from({ length: Math.max(details.seasonCount, 1) }, (_, i) => ({
            seasonNumber: i + 1,
            name: `Season ${i + 1}`,
            episodeCount: 0,
            airDate: null,
          }))
      : [];
  // An unstarted show's header Play opens the first listed season's opener;
  // with saved progress PlayButton resumes the in-progress episode instead.
  // The episode rows below keep their explicit targets.
  const firstEpisode = {
    season: seasonOptions[0]?.seasonNumber ?? 1,
    episode: 1,
  };

  return (
    <div>
      <div className="relative aspect-video w-full">
        {headerImage ? (
          <Image
            src={tmdbImageUrl("w1280", headerImage)}
            alt=""
            fill
            sizes="900px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-neutral-800" />
        )}
        {/* Side vignette - same 77deg ramp as the billboard. */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-[26.09%] left-0 bg-linear-[77deg] from-black/60 to-transparent to-85%"
        />
        {/* Bottom fade into the modal surface (#181818 token, not the page
            canvas - fading to #141414 inside a #181818 dialog would leave a
            visible seam; the fade must match the dialog color). */}
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-2/5 w-full"
          style={{
            backgroundImage:
              "linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--color-background-elevated) 15%, transparent) 15%, color-mix(in srgb, var(--color-background-elevated) 35%, transparent) 29%, color-mix(in srgb, var(--color-background-elevated) 58%, transparent) 44%, var(--color-background-elevated) 68%, var(--color-background-elevated) 100%)",
          }}
        />
        <div className="absolute right-4 bottom-6 left-4 sm:left-6 md:left-10">
          <h2 className="mb-4 line-clamp-1 text-2xl font-bold sm:text-4xl">
            {details.title}
          </h2>
          <div className="flex items-center gap-3">
            {/* Not out yet (movie release / show premiere): the date stands
                where Play would; My List still works. */}
            {coming !== null ? (
              <ComingSoon
                date={coming}
                className="flex h-10 items-center text-lg font-medium"
              />
            ) : (
              <PlayButton
                compact
                mediaType={details.mediaType}
                id={details.id}
                firstEpisode={firstEpisode}
              />
            )}
            <MyListButton mediaType={details.mediaType} id={details.id} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-10 px-4 pt-6 pb-10 sm:px-6 md:px-10">
        <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
          <div>
            <div className="flex items-center gap-3 text-base">
              {matchPercent > 0 && (
                <span className="font-medium text-green-400">
                  {matchPercent}% Match
                </span>
              )}
              {details.year !== null && (
                <span className="text-muted">{details.year}</span>
              )}
              {/* Real US certification only (honest data - never an invented
                  rating) - absent when TMDB has none. Chip style: outlined,
                  square corners, 12px text. */}
              {details.certification !== null && (
                <span className="border-foreground/40 border px-1.5 py-0.5 text-xs">
                  {details.certification}
                </span>
              )}
              {details.mediaType === "tv" && details.seasonCount > 0 && (
                <span className="text-muted">
                  {details.seasonCount}{" "}
                  {details.seasonCount === 1 ? "Season" : "Seasons"}
                </span>
              )}
              {details.mediaType === "movie" &&
                details.runtimeMinutes !== null && (
                  <span className="text-muted">
                    {formatRuntime(details.runtimeMinutes)}
                  </span>
                )}
            </div>
            {details.overview !== "" && (
              <p className="mt-4 text-base">{details.overview}</p>
            )}
          </div>
          <div className="flex flex-col gap-3 text-sm">
            {cast.length > 0 && (
              <p>
                <span className="text-muted-dark">Cast: </span>
                {cast.map((member) => member.name).join(", ")}
                {details.cast.length > CAST_COUNT && ", more"}
              </p>
            )}
            {details.genres.length > 0 && (
              <p>
                <span className="text-muted-dark">Genres: </span>
                {details.genres.join(", ")}
              </p>
            )}
          </div>
        </div>

        {details.mediaType === "tv" && (
          <EpisodesSection
            tvId={details.id}
            seasonOptions={seasonOptions}
            fallbackStillPath={details.backdropPath ?? details.posterPath}
          />
        )}

        {moreLikeThis.length > 0 && (
          <section aria-label="More Like This">
            <h3 className="mb-4 text-2xl font-bold">More Like This</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {moreLikeThis.map((title) => (
                <SimilarVideoCard
                  key={`${title.mediaType}-${title.id}`}
                  title={title}
                  onSelect={() => openTitle(title.mediaType, title.id)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
