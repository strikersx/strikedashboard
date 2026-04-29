import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Striker's House — Dashboard",
  description: "Dashboard de controlo operacional",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="bg-bg text-white antialiased min-h-screen" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
