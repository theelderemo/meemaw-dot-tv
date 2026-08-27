"use client";

import { createContext, useContext, type ReactNode } from "react";

// Today's date (UTC YYYY-MM-DD) as the server render computed it once
// (release.ts todayIso). Client components read it from here instead of
// calling new Date(), so release-date gating renders identically on both
// sides - no hydration mismatch, and no title flipping state at midnight
// mid-session.
const TodayContext = createContext<string | null>(null);

export function useToday(): string {
  const today = useContext(TodayContext);
  if (today === null) {
    throw new Error("useToday must be used inside TodayProvider");
  }
  return today;
}

export default function TodayProvider({
  today,
  children,
}: {
  today: string;
  children: ReactNode;
}) {
  return (
    <TodayContext.Provider value={today}>{children}</TodayContext.Provider>
  );
}
