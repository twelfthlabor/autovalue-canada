import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource-variable/archivo";
import "@fontsource-variable/newsreader";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "AutoValue Canada — See the market behind the asking price",
  description: "A transparent Canadian used-vehicle deal checker with VIN decode, matched comparables, mileage modeling and visible uncertainty.",
  openGraph: {
    title: "AutoValue Canada",
    description: "Check a Canadian used-vehicle asking price against matched comparables and a visible mileage model.",
    type: "website",
  },
};

function Wordmark() {
  return (
    <Link className="wordmark" href="/" aria-label="AutoValue Canada home">
      <span className="wordmark-mark" aria-hidden="true">
        <span />
        <span />
        <span />
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
          <nav aria-label="Primary navigation">
            <Link href="/#check">Check a price</Link>
            <Link href="/market-lab">Market lab</Link>
            <Link href="/methodology">Methodology</Link>
            <Link href="/calculation">How we calculate</Link>
          </nav>
          <a className="source-pill" href="https://huggingface.co/datasets/OmniaAuto/canadian-vehicle-market-aggregates" target="_blank" rel="noreferrer">
            Open data <span aria-hidden="true">↗</span>
          </a>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div>
            <Wordmark />
            <p>Evidence for a better conversation—not an appraisal.</p>
          </div>
          <div className="footer-links">
            <Link href="/methodology">Methods & limitations</Link>
            <Link href="/calculation">How price works</Link>
            <a href="https://open.canada.ca/data/en/dataset/1ec92326-47ef-4110-b7ca-959fab03f96d" target="_blank" rel="noreferrer">Transport Canada recalls</a>
            <a href="https://open.canada.ca/data/en/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64" target="_blank" rel="noreferrer">NRCan fuel data</a>
          </div>
          <p className="footer-note">Non-commercial research demo · Prices in CAD · Source retrieved Aug 29, 2026</p>
        </footer>
      </body>
    </html>
  );
}
