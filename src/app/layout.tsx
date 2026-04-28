import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Striker's House — Dashboard",
  description: "Dashboard de controlo operacional",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className="dark">
      <body className="bg-black text-white font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
