// Material Design icon glyphs (Apache 2.0), inlined as paths so no icon
// library ships. Sized by the caller's className.

type IconProps = { className?: string };

function MaterialIcon({
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function PlayIcon({ className }: IconProps) {
  return (
    <MaterialIcon className={className}>
      <path d="M8 5v14l11-7z" />
    </MaterialIcon>
  );
}

export function PauseIcon({ className }: IconProps) {
  return (
    <MaterialIcon className={className}>
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </MaterialIcon>
  );
}

export function Back10Icon({ className }: IconProps) {
  return (
    <MaterialIcon className={className}>
      <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="7" fontWeight="700">
        10
      </text>
    </MaterialIcon>
  );
}

export function Forward10Icon({ className }: IconProps) {
  return (
    <MaterialIcon className={className}>
      <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="7" fontWeight="700">
        10
      </text>
    </MaterialIcon>
  );
}

export function VolumeHighIcon({ className }: IconProps) {
  return (
    <MaterialIcon className={className}>
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </MaterialIcon>
  );
}

export function VolumeLowIcon({ className }: IconProps) {
  return (
    <MaterialIcon className={className}>
      <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
    </MaterialIcon>
  );
}

export function VolumeMutedIcon({ className }: IconProps) {
  return (
    <MaterialIcon className={className}>
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
    </MaterialIcon>
  );
}

export function FullscreenIcon({ className }: IconProps) {
  return (
    <MaterialIcon className={className}>
      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
    </MaterialIcon>
  );
}

export function FullscreenExitIcon({ className }: IconProps) {
  return (
    <MaterialIcon className={className}>
      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
    </MaterialIcon>
  );
}

export function BackArrowIcon({ className }: IconProps) {
  return (
    <MaterialIcon className={className}>
      <path d="M21 11H6.83l3.58-3.59L9 6l-6 6 6 6 1.41-1.41L6.83 13H21z" />
    </MaterialIcon>
  );
}

// The Next Episode glyph (Material skip_next).
export function SkipNextIcon({ className }: IconProps) {
  return (
    <MaterialIcon className={className}>
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
    </MaterialIcon>
  );
}

// Material "video_library" - a stack of reels - for Switch Streams.
export function StreamsIcon({ className }: IconProps) {
  return (
    <MaterialIcon className={className}>
      <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z" />
    </MaterialIcon>
  );
}
