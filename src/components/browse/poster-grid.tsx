"use client";

import { useEffect, useState } from "react";
import type { RowEdge } from "./portal-provider";
import {
  DEFAULT_PER_PAGE,
  perPageForWidth,
  type PosterTitle,
} from "./poster-slider";
import VideoItemWithHover from "./video-item-with-hover";

// The poster grid (search and My List results), tiled with
// our hover-portal cards. Column count reuses the slider ladder so grid
// tiles match the browse-row card widths exactly; tracking it in JS (not CSS
// grid classes alone) also tells each tile which column edge it sits on, so
// the hover card anchors inward at the viewport edges like the rows do.
export default function PosterGrid({ titles }: { titles: PosterTitle[] }) {
  const [columns, setColumns] = useState(DEFAULT_PER_PAGE);

  useEffect(() => {
    const update = () => setColumns(perPageForWidth(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const edgeFor = (index: number): RowEdge => {
    const column = index % columns;
    if (column === 0) return "first";
    if (column === columns - 1) return "last";
    return "middle";
  };

  return (
    <ul
      className="grid gap-x-1 gap-y-4 sm:gap-x-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {titles.map((title, index) => (
        <li key={`${title.mediaType}-${title.id}`}>
          <VideoItemWithHover title={title} edge={edgeFor(index)} isVisible />
        </li>
      ))}
    </ul>
  );
}
