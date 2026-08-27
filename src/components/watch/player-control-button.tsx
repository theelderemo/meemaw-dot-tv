// Player control button: bare white icon button whose glyph scales to
// 1.3 on hover (transform .3s). Fixed hit box so the bar doesn't reflow as
// icons swap (play↔pause, mute↔unmute).
export default function PlayerControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="text-foreground group flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center"
    >
      <span className="flex transition-transform duration-300 group-hover:scale-[1.3] group-focus-visible:scale-[1.3]">
        {children}
      </span>
    </button>
  );
}
