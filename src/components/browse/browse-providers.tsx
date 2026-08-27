"use client";

import type { ReactNode } from "react";
import type { MyListEntry } from "@/lib/db/my-list";
import type { ProgressEntry } from "@/lib/progress/rules";
import DetailModal from "./detail-modal";
import DetailModalProvider from "./detail-modal-provider";
import MyListProvider from "./my-list-provider";
import PortalProvider from "./portal-provider";
import TodayProvider from "./today-provider";
import VideoPortalContainer from "./video-portal-container";
import WatchProgressProvider from "./watch-progress-provider";

// Client shell around the browse tree, providers nested in order: the
// server's "today" outermost (release-date gating in the hover card, modal
// and episode rows), then My List membership (hover card AND modal toggle
// it), saved progress next (hover card, modal and Continue Watching cards
// read it), then the modal provider so the hover card can open the modal.
// The page and rows stay server components - they pass through as children,
// and each page seeds the lookups with its server-fetched rows.
export default function BrowseProviders({
  children,
  today,
  myListEntries,
  progressEntries,
}: {
  children: ReactNode;
  /** UTC YYYY-MM-DD from the server render (release.ts todayIso). */
  today: string;
  myListEntries: MyListEntry[];
  progressEntries: ProgressEntry[];
}) {
  return (
    <TodayProvider today={today}>
      <MyListProvider initialEntries={myListEntries}>
        <WatchProgressProvider initialEntries={progressEntries}>
          <DetailModalProvider>
            <PortalProvider>
              {children}
              <VideoPortalContainer />
            </PortalProvider>
            <DetailModal />
          </DetailModalProvider>
        </WatchProgressProvider>
      </MyListProvider>
    </TodayProvider>
  );
}
