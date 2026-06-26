import { ImageResponse } from "next/og";
import { APP_CONFIG } from "@/config/app";

export const runtime = "edge";
export const alt = `${APP_CONFIG.name} - ${APP_CONFIG.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "radial-gradient(circle at 20% 0%, rgba(255,107,44,0.18), rgba(9,9,11,1) 60%), #09090b",
          color: "#ffffff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: "#FF6B2C",
              letterSpacing: "-0.02em",
            }}
          >
            convo
          </div>
          <div
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.55)",
              padding: "6px 14px",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 999,
              fontWeight: 500,
            }}
          >
            Chat + content as one product
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 78,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 1000,
            }}
          >
            Every visitor question becomes the next page that ranks.
          </div>
          <div
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.7)",
              maxWidth: 900,
              lineHeight: 1.35,
            }}
          >
            One AI chat for your website. Every conversation captures a lead
            now and feeds the SEO content your customers were going to search
            for anyway.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          <div style={{ display: "flex", gap: 28 }}>
            <span>WordPress</span>
            <span>Shopify</span>
            <span>Webflow</span>
          </div>
          <div>convoapp.com.au</div>
        </div>
      </div>
    ),
    size,
  );
}
