"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePortalData, type PortalData } from "./portal-provider";
import VideoCardPortal from "./video-card-portal";

// Enter timing: the card's children delay 0.1 s, then the zoom
// variant runs 1 s on this bezier. Exit is
// the declared exit variant - same curve, no delay - and the card unmounts
// once the collapse has run.
const ZOOM_EASE = "cubic-bezier(0.43,0.13,0.23,0.96)";
const EXIT_MS = 1000;

export default function VideoPortalContainer() {
  const portal = usePortalData();
  const [rendered, setRendered] = useState<PortalData | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Render-time state adjustment (React's "adjusting state when props change"
  // pattern): keep the last hover target mounted through the exit run, and
  // start collapsing the moment the hover ends. Hovering a new poster while a
  // card is open just re-anchors it without re-zooming (expanded stays true).
  if (portal && portal !== rendered) setRendered(portal);
  if (!portal && expanded) setExpanded(false);

  useEffect(() => {
    if (portal) {
      // Two frames so a freshly mounted card paints once at scale 0 -
      // otherwise the browser never sees a start state and skips the zoom.
      let innerFrame = 0;
      const frame = requestAnimationFrame(() => {
        innerFrame = requestAnimationFrame(() => setExpanded(true));
      });
      return () => {
        cancelAnimationFrame(frame);
        cancelAnimationFrame(innerFrame);
      };
    }
    const timeout = setTimeout(() => setRendered(null), EXIT_MS);
    return () => clearTimeout(timeout);
  }, [portal]);

  if (!rendered) return null;

  // Hover-card geometry: card = 1.5× the poster width; the
  // first visible card pins to its left edge, the last to its right edge,
  // middles center (0.25 width overhang each side). Vertical centering uses
  // translateY(-50%) rather than a hardcoded 0.75×height offset, which
  // would assume 16:9 tiles - our posters are 2:3.
  const rect = rendered.anchor.getBoundingClientRect();
  const horizontal =
    rendered.edge === "last"
      ? { right: document.documentElement.clientWidth - rect.right }
      : {
          left:
            rendered.edge === "first"
              ? rect.left
              : rect.left - rect.width * 0.25,
        };

  return createPortal(
    <div
      style={{
        ...horizontal,
        top: rect.top + window.scrollY + rect.height / 2,
        width: rect.width * 1.5,
        transform: `translateY(-50%) scale(${expanded ? 1 : 0})`,
        opacity: expanded ? 1 : 0,
        transformOrigin:
          rendered.edge === "first"
            ? "left center"
            : rendered.edge === "last"
              ? "right center"
              : "center",
        // A collapsing card must not swallow pointer events over the row.
        pointerEvents: expanded ? undefined : "none",
        transition: `transform 1s ${ZOOM_EASE} ${expanded ? "0.1s" : "0s"}, opacity 1s ${ZOOM_EASE} ${expanded ? "0.1s" : "0s"}`,
      }}
      className="absolute z-40"
    >
      <VideoCardPortal title={rendered.title} />
    </div>,
    document.body,
  );
}
