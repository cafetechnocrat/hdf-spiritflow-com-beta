import type { Metadata } from "next";
import "./globals.css";

// Absolute address used for the share image. Vercel provides the production host.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Spirit Flow",
  description: "Spirit Flow",
  openGraph: {
    title: "Spirit Flow",
    description: "Spirit Flow",
    siteName: "Spirit Flow",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
