// Round icon button shared by the hover card and modal rows: 2px border in
// gray-700 brightening to gray-200 on hover/focus, white glyph. Sized by the
// caller's children.
export default function IconButton({
  label,
  onClick,
  className = "",
  children,
}: {
  label: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`text-foreground flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-neutral-600 transition-colors hover:border-neutral-200 focus-visible:border-neutral-200 ${className}`}
    >
      {children}
    </button>
  );
}
