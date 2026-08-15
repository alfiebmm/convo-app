import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the blog template-pack assets (template.html, _tokenised.css,
  // brand.schema.json, post.schema.json) are traced into the serverless
  // bundle. Next's default tracer only follows statically-imported files,
  // and template-pack/renderer.js + validate.js read them via fs.readFileSync
  // at runtime. Without this include the article-generation pipeline throws
  // ENOENT on prod. See CON-278 follow-up.
  outputFileTracingIncludes: {
    "/api/cron/blog-idle-trigger": [
      "./src/lib/blog/template-pack/**",
      "./src/lib/blog/schemas/**",
    ],
    "/api/conversations/*/complete": [
      "./src/lib/blog/template-pack/**",
      "./src/lib/blog/schemas/**",
    ],
    "/api/pipeline/*": [
      "./src/lib/blog/template-pack/**",
      "./src/lib/blog/schemas/**",
    ],
  },
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
