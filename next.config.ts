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
  async rewrites() {
    // Route /blog/* to the Convo Blog WordPress install on WP Engine.
    // Subdirectory topology: users see one domain (convoapp.com.au), Google
    // indexes one domain, SEO authority consolidates on the marketing site.
    // Origin is convoblog.wpenginepowered.com; the WP install serves a
    // branded landing at / and articles at /:slug.
    const wpOrigin = "https://convoblog.wpenginepowered.com";
    return [
      { source: "/blog", destination: `${wpOrigin}/` },
      { source: "/blog/:path*", destination: `${wpOrigin}/:path*` },
      // WP REST API — public discovery + block editor + Yoast sitemap etc.
      { source: "/wp-json/:path*", destination: `${wpOrigin}/wp-json/:path*` },
      // WP core + theme + uploaded media assets — must proxy through so
      // relative asset URLs from the WP HTML resolve under our origin.
      { source: "/wp-content/:path*", destination: `${wpOrigin}/wp-content/:path*` },
      { source: "/wp-includes/:path*", destination: `${wpOrigin}/wp-includes/:path*` },
    ];
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
