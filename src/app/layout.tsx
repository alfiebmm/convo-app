import type { Metadata } from "next";
import { Fredoka, Inter, Outfit } from "next/font/google";
import { APP_CONFIG } from "@/config/app";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka" });

export const metadata: Metadata = {
  title: {
    default: `${APP_CONFIG.name} - Conversations that grow your business`,
    template: `%s | ${APP_CONFIG.name}`,
  },
  description: APP_CONFIG.description,
  metadataBase: new URL(APP_CONFIG.url),
  applicationName: APP_CONFIG.name,
  openGraph: {
    siteName: APP_CONFIG.name,
    type: "website",
    locale: "en_AU",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU">
      <body
        className={`${inter.variable} ${outfit.variable} ${fredoka.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
