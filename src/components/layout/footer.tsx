// The usual streaming-footer link grid (FAQ/Terms/Privacy/…) is deliberately
// absent: dead links are a "nothing happens when I click" trap for the viewer
// (ui-fidelity.md §Deliberate departures).
export default function Footer() {
  return (
    <footer className="mx-auto w-full max-w-[1000px] px-[30px] py-[70px] min-[1000px]:px-0">
      <p className="text-muted-dark mb-5 text-base">
        Legally distinct. Emotionally fulfilling.
      </p>
      <p className="text-muted-dark text-[13px]">Meemaw.tv</p>
      <p className="text-muted-dark mt-2 text-xs">
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
    </footer>
  );
}
