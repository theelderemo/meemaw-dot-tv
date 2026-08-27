import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";

// Shared chrome for the signed-in browse pages (/browse, /tv, /movies,
// /my-list, /search). /watch sits outside this group - the player is
// full-bleed, no header/footer. A layout keeps the
// header mounted across the browse↔search navigation - the nav search box must
// hold focus and its text while typing live-routes between the two pages.
// Auth stays in each page's requireUser(); a layout is not the boundary.
export default function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
