"use client";

import { useEffect, useState } from "react";
import type { Title } from "@/lib/tmdb/schemas";
import type { RowEdge } from "./portal-provider";
import VideoItemWithHover from "./video-item-with-hover";

export type PosterTitle = Title & { posterPath: string };

// The poster-row slider, no carousel library:
// page-by-page translate with a 500 ms transition, cards peeking into the
// 30/60 px arrow gutters (the track sits inside the gutters but overflows them;
// the root clips at the viewport edges). Slide counts follow a
// 2/3/4/5/6 ladder mapped onto Tailwind's responsive scale.
const PER_PAGE_BREAKPOINTS = [
  { minWidth: 1536, perPage: 6 },
  { minWidth: 1024, perPage: 5 },
  { minWidth: 768, perPage: 4 },
  { minWidth: 640, perPage: 3 },
] as const;

export const DEFAULT_PER_PAGE = 6;

// Shared with PosterGrid so search-result tiles keep the exact card widths of
// the browse rows at every breakpoint.
export function perPageForWidth(width: number): number {
  for (const { minWidth, perPage } of PER_PAGE_BREAKPOINTS) {
    if (width >= minWidth) return perPage;
  }
  return 2;
}

export default function PosterSlider({
  label,
  titles,
  showProgress = false,
}: {
  label: string;
  titles: PosterTitle[];
  showProgress?: boolean;
}) {
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [startIndex, setStartIndex] = useState(0);

  useEffect(() => {
    const update = () => {
      const next = perPageForWidth(window.innerWidth);
      setPerPage(next);
      setStartIndex((index) =>
        Math.min(index, Math.max(titles.length - next, 0)),
      );
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [titles.length]);

  // Like slick with infinite:false - the last page shifts only by the remainder
  // so the row always ends flush with the final card.
  const lastStartIndex = Math.max(titles.length - perPage, 0);
  const showPrevious = startIndex > 0;
  const showNext = startIndex < lastStartIndex;

  // Visible-window edges, computed from slider state instead of DOM
  // classnames: the window's first/last cards anchor their hover-expand to the
  // row edge, everything else centers.
  const lastVisibleIndex = Math.min(startIndex + perPage, titles.length) - 1;
  const edgeFor = (index: number): RowEdge => {
    if (index === startIndex) return "first";
    if (index === lastVisibleIndex) return "last";
    return "middle";
  };

  const goPrevious = () =>
    setStartIndex((index) => Math.max(index - perPage, 0));
  const goNext = () =>
    setStartIndex((index) => Math.min(index + perPage, lastStartIndex));

  return (
    <div className="group/row relative overflow-hidden">
      <div className="mx-[30px] sm:mx-[60px]">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${(startIndex * 100) / perPage}%)` }}
        >
          {titles.map((title, index) => (
            <div
              key={`${title.mediaType}-${title.id}`}
              className="shrink-0 pr-1 sm:pr-2"
              style={{ flexBasis: `${100 / perPage}%` }}
            >
              <VideoItemWithHover
                title={title}
                edge={edgeFor(index)}
                isVisible={index >= startIndex && index <= lastVisibleIndex}
                showProgress={showProgress}
              />
            </div>
          ))}
        </div>
      </div>
      {showPrevious && (
        <ArrowButton direction="previous" label={label} onClick={goPrevious} />
      )}
      {showNext && (
        <ArrowButton direction="next" label={label} onClick={goNext} />
      )}
    </div>
  );
}

// Hover-reveal edge zones (arrows on demand, never always-visible;
// ui-fidelity.md): chevrons appear when the row is
// hovered or an arrow has keyboard focus, and stay visible below sm where
// there's no hover.
function ArrowButton({
  direction,
  label,
  onClick,
}: {
  direction: "previous" | "next";
  label: string;
  onClick: () => void;
}) {
  const isPrevious = direction === "previous";
  return (
    <button
      type="button"
      aria-label={`${isPrevious ? "Previous" : "Next"} titles in ${label}`}
      onClick={onClick}
      className={`group/arrow hover:bg-background/50 focus-visible:bg-background/50 absolute inset-y-0 z-10 flex w-[30px] cursor-pointer items-center justify-center transition-colors sm:w-[60px] ${
        isPrevious ? "left-0 rounded-r" : "right-0 rounded-l"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-7 w-7 transition-[opacity,transform] duration-200 group-focus-within/row:opacity-100 group-hover/arrow:scale-125 group-hover/row:opacity-100 sm:opacity-0"
      >
        <path d={isPrevious ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </button>
  );
}
