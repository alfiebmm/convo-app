import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // CON-238: Follow-up editor moved from Knowledge into Forum config.
      // 308 (permanent, method-preserving) so bookmarks and in-app links
      // continue to work. Cover both the bare path and any deeper subpath.
      {
        source: "/dashboard/knowledge/follow-up",
        destination: "/dashboard/settings/forum-config?tab=follow-up",
        permanent: true,
      },
      {
        source: "/dashboard/knowledge/follow-up/:path*",
        destination: "/dashboard/settings/forum-config?tab=follow-up",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
