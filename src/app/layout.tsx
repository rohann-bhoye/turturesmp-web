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

export const viewport: Viewport = { themeColor: "#06090a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          // Runs before paint: restores the saved theme and marks JS as available (for scroll reveals).
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement;d.classList.add("js");var t=localStorage.getItem("theme");if(t==="light"||t==="dark")d.dataset.theme=t}catch(e){document.documentElement.classList.add("js")}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Outfit:wght@500;650;750;800&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
