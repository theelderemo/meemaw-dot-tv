type ProfileAvatarProps = {
  className?: string;
};

// The classic smiling profile-tile avatar as inline SVG, tinted per the theme
// map: primary-pink tile, canvas-dark features. 4px corner radius.
export default function ProfileAvatar({ className = "" }: ProfileAvatarProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={`overflow-hidden rounded ${className}`}
    >
      <rect width="100" height="100" className="fill-primary" />
      <rect
        x="26.5"
        y="29"
        width="13"
        height="23"
        rx="6.5"
        className="fill-background"
      />
      <rect
        x="60.5"
        y="29"
        width="13"
        height="23"
        rx="6.5"
        className="fill-background"
      />
      <path
        d="M 16 60 Q 50 98 84 60 Q 50 74 16 60 Z"
        className="fill-background"
      />
    </svg>
  );
}
