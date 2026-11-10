import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spirit Flow",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
