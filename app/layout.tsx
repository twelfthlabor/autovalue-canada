import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource-variable/inter";
import "@fontsource-variable/archivo";
import "@fontsource-variable/newsreader";
import "./globals.css";
import manifest from "@/public/data/manifest.json";
import { formatRetrievedDate } from "@/lib/market";
import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "AutoValue Canada — See the market behind the asking price",
  description: "A transparent Canadian used-vehicle deal checker with VIN decode, current market anchors, condition-aware ML and visible uncertainty.",
  openGraph: {
    title: "AutoValue Canada",
    description: "Check a Canadian used-vehicle asking price with current market evidence and transaction-trained condition-aware ML.",
    type: "website",
  },
};

function Wordmark() {
  return (
    <Link className="wordmark" href="/" aria-label="AutoValue Canada home">
      <span className="wordmark-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
          <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
        </svg>
      </span>
      <span>AutoValue</span>
      <small>CANADA</small>
    </Link>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Wordmark />
          <SiteNav />
          <a className="nav-external" href="https://huggingface.co/datasets/OmniaAuto/canadian-vehicle-market-aggregates" target="_blank" rel="noreferrer">
            Open data <span aria-hidden="true">↗</span>
          </a>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <p><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.4-3 8.4-7 10-4-1.6-7-5.6-7-10V6l7-3z" /><path d="M9.2 12.2l2 2 3.6-4" /></svg> Evidence for a better conversation—not an appraisal.</p>
          <p className="footer-meta">Inputs reflect today&rsquo;s market as of {formatRetrievedDate(manifest.sourceRetrievedAt)} · Prices in CAD</p>
        </footer>
      </body>
    </html>
  );
}
