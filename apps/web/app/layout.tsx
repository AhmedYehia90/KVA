import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: {
    default: "Kalabsha Airlines",
    template: "%s | Kalabsha Airlines",
  },
  description:
    "Kalabsha Airlines is a modern virtual airline experience for pilots, dispatchers and aviation enthusiasts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Header />

        {children}

        <footer className="footer">
          <div className="container">
            <div className="footerGrid">
              <div>
                <strong>Kalabsha Airlines</strong>
                <p className="muted">
                  A virtual airline built around realistic operations,
                  community and the passion for aviation.
                </p>
              </div>

              <div className="footerLinks" aria-label="Footer navigation">
                <Link href="/fleet">Fleet</Link>
                <Link href="/live-flights">Live Flights</Link>
                <Link href="/pilots">Pilots</Link>
                <Link href="/about">About</Link>
              </div>
            </div>

            <div className="footerBottom">
              <span>© 2026 Kalabsha Airlines</span>
              <span>Fly To Dreams</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
