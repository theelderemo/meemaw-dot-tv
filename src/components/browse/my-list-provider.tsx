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
  addToMyListAction,
  removeFromMyListAction,
} from "@/app/(app)/(browse)/browse/actions";
import type { MyListEntry } from "@/lib/db/my-list";
import type { MediaType } from "@/lib/tmdb/schemas";

// Membership state for the +/✓ toggles (hover card + modal): a Set of
// "mediaType-id" keys seeded from the server render, flipped optimistically on
// click and restored if the action reports failure. Only the buttons read this
// Set - the My List row/grid re-render server-side via revalidatePath.

function myListKey(mediaType: MediaType, id: number): string {
  return `${mediaType}-${id}`;
}

type MyListContextValue = {
  isInMyList: (mediaType: MediaType, id: number) => boolean;
  toggleMyList: (mediaType: MediaType, id: number) => void;
};

const MyListContext = createContext<MyListContextValue | null>(null);

export function useMyList(): MyListContextValue {
  const value = useContext(MyListContext);
  if (!value) {
    throw new Error("useMyList must be used inside MyListProvider");
  }
  return value;
}

export default function MyListProvider({
  initialEntries,
  children,
}: {
  initialEntries: MyListEntry[];
  children: ReactNode;
}) {
  const [keys, setKeys] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        initialEntries.map((entry) => myListKey(entry.mediaType, entry.tmdbId)),
      ),
  );
  const inflightRef = useRef(new Set<string>());

  const setPresent = useCallback((key: string, present: boolean) => {
    setKeys((prev) => {
      if (prev.has(key) === present) return prev;
      const next = new Set(prev);
      if (present) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const toggleMyList = useCallback(
    (mediaType: MediaType, id: number) => {
      const key = myListKey(mediaType, id);
      // One flight per key - a second click before the server answers is
      // dropped, so a failure's revert target can never interleave.
      if (inflightRef.current.has(key)) return;

      const wasInList = keys.has(key);
      inflightRef.current.add(key);
      setPresent(key, !wasInList);

      const action = wasInList ? removeFromMyListAction : addToMyListAction;
      action({ tmdbId: id, mediaType })
        .then((result) => {
          if (!result.ok) setPresent(key, wasInList);
        })
        .catch((error) => {
          console.error(`[my-list] toggle failed (${key})`, error);
          setPresent(key, wasInList);
        })
        .finally(() => {
          inflightRef.current.delete(key);
        });
    },
    [keys, setPresent],
  );

  const value = useMemo<MyListContextValue>(
    () => ({
      isInMyList: (mediaType, id) => keys.has(myListKey(mediaType, id)),
      toggleMyList,
    }),
    [keys, toggleMyList],
  );

  return (
    <MyListContext.Provider value={value}>{children}</MyListContext.Provider>
  );
}
