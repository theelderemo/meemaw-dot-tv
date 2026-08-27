import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // TMDB artwork host (tmdb.md §Images) - posters, backdrops, avatars.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
};

export default nextConfig;
