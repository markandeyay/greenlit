import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Posters and headshots are served from TMDB's CDN, never rehosted (Section 15).
    remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" }],
  },
  poweredByHeader: false,
};

export default nextConfig;
