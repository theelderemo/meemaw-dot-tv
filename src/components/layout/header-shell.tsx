"use client";

import useOffsetTop from "@/hooks/use-offset-top";

// The bar is 70px tall and turns solid once scrolled past that height.
const HEADER_HEIGHT = 70;

export default function HeaderShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const isOffset = useOffsetTop(HEADER_HEIGHT);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 flex h-[70px] items-center bg-linear-to-b from-black/70 to-transparent px-4 transition-colors duration-[400ms] md:px-[60px] ${
        isOffset ? "bg-background" : "bg-transparent"
      }`}
    >
      {children}
    </header>
  );
}
