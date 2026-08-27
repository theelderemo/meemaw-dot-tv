"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Title } from "@/lib/tmdb/schemas";

// The hover-portal provider: one context carries the setter, another the current
// hover-card data, so poster items (setter-only) don't re-render on every
// hover change - only VideoPortalContainer subscribes to the data.

/** Where the hovered poster sits in the row's visible window - drives the
 * three expansion anchorings (first->left, last->right, middle->center). */
export type RowEdge = "first" | "middle" | "last";

export type PortalData = {
  anchor: HTMLElement;
  title: Title;
  edge: RowEdge;
};

type SetPortal = (data: PortalData | null) => void;

const PortalSetterContext = createContext<SetPortal | null>(null);
const PortalDataContext = createContext<PortalData | null>(null);

export function usePortal(): SetPortal {
  const setPortal = useContext(PortalSetterContext);
  if (!setPortal) {
    throw new Error("usePortal must be used inside PortalProvider");
  }
  return setPortal;
}

/** null = no hover card open. Only for VideoPortalContainer. */
export function usePortalData(): PortalData | null {
  return useContext(PortalDataContext);
}

export default function PortalProvider({ children }: { children: ReactNode }) {
  const [portalData, setPortalData] = useState<PortalData | null>(null);

  return (
    <PortalSetterContext.Provider value={setPortalData}>
      <PortalDataContext.Provider value={portalData}>
        {children}
      </PortalDataContext.Provider>
    </PortalSetterContext.Provider>
  );
}
