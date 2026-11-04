import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Turture SMP — Minecraft Survival Server",
  description:
    "Join Turture SMP: a friendly Minecraft survival server. Java & Bedrock. Play now at play.turturesmp.dpdns.org and join our Discord community.",
  openGraph: {
    title: "Turture SMP — Minecraft Survival Server",
    description: "Join the adventure at play.turturesmp.dpdns.org",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#0b1210", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
