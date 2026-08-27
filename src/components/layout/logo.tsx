type LogoProps = {
  size?: "nav" | "large";
};

export default function Logo({ size = "nav" }: LogoProps) {
  return (
    <span
      className={`font-display text-primary tracking-tight select-none ${
        size === "large" ? "text-7xl" : "text-3xl"
      }`}
    >
      MEEMAW.TV
    </span>
  );
}
