import Image from "next/image";
import type { Title } from "@/lib/tmdb/schemas";
import MoreInfoButton from "./more-info-button";
import PlayButton from "./play-button";
import { tmdbImageUrl } from "./tmdb-image";

export type BillboardTitle = Title & { backdropPath: string };

// Billboard geometry: the flow box reserves 40% of the viewport
// width while the visual spans 56.25vw (16:9), so the rows that follow overlap
// the billboard's bottom fade. z-1 here + z-1 on the rows container (later in
// DOM order) keeps rows painting above the overlapping visual.
export default function Billboard({ title }: { title: BillboardTitle }) {
  return (
    <section aria-label="Featured title" className="relative z-[1]">
      <div className="relative mb-6 pb-[40%]">
        <div className="absolute top-0 left-0 h-[56.25vw] w-full">
          <Image
            src={tmdbImageUrl("original", title.backdropPath)}
            alt={title.title}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          {/* Side vignette - linear-gradient(77deg, rgba(0,0,0,.6), transparent 85%) ending 26.09% short of the right edge. */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-[26.09%] left-0 bg-linear-[77deg] from-black/60 to-transparent to-85%"
          />
          {/* Bottom fade into the page canvas - the hsla(0,0%,8%) reference stops map to our background token. */}
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-[14.7vw] w-full"
            style={{
              backgroundImage:
                "linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--color-background) 15%, transparent) 15%, color-mix(in srgb, var(--color-background) 35%, transparent) 29%, color-mix(in srgb, var(--color-background) 58%, transparent) 44%, var(--color-background) 68%, var(--color-background) 100%)",
            }}
          />
          <div className="absolute top-0 bottom-[35%] left-[4%] z-10 flex w-[36%] flex-col justify-end gap-8 md:left-[60px]">
            <h1 className="line-clamp-1 text-3xl font-bold sm:text-5xl md:text-6xl">
              {title.title}
            </h1>
            <p className="line-clamp-3 text-base sm:text-lg md:text-2xl">
              {title.overview}
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <PlayButton mediaType={title.mediaType} id={title.id} />
              <MoreInfoButton mediaType={title.mediaType} id={title.id} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
