import Link from "next/link";
import market from "@/public/data/market.json";
import manifest from "@/public/data/manifest.json";
import { conditionModelMetadata } from "@/lib/condition-model";
import { formatCad, formatNumber, formatRetrievedDate, type MarketRow } from "@/lib/market";
import { GlobeStage } from "@/components/ambient-stage";
import { CountUp, Reveal, Spotlight } from "@/components/motion";
import { ArrowRightIcon, CodeIcon, CpuIcon, CurveIcon, LockIcon, PlugIcon, ShieldCheckIcon } from "@/components/icons";

const rows = market as MarketRow[];

/** Percentile curve of the busiest cell, drawn as a smooth SVG path (0–100 box). */
function distributionPath(row: MarketRow) {
  const values = [row.p10, row.p25, row.p50, row.p75, row.p90];
  const x = (value: number) => ((value - row.p10) / (row.p90 - row.p10)) * 76 + 12;
  const heights = [16, 52, 82, 52, 16];
  const points = values.map((value, index) => [x(value), 92 - heights[index]] as const);
  const start = `M0 92 C6 92 ${points[0][0] - 6} ${points[0][1]} ${points[0][0]} ${points[0][1]}`;
  const middle = points.slice(1).map(([px, py], index) => { const [qx, qy] = points[index]; const handle = (px - qx) / 2; return `C${qx + handle} ${qy} ${px - handle} ${py} ${px} ${py}`; }).join(" ");
  const [lx, ly] = points[points.length - 1];
  return `${start} ${middle} C${lx + 6} ${ly} 94 92 100 92`;
}

export function Showcase() {
  const provinceTotals = manifest.provinces.map((code) => ({ code, vehicles: rows.filter((row) => row.p === code).reduce((sum, row) => sum + row.n, 0) }));
  const maxProvince = Math.max(...provinceTotals.map((province) => province.vehicles));
  const globeProvinces = provinceTotals.map((province) => ({ code: province.code, share: province.vehicles / manifest.usedVehiclesRepresented }));
  const makeTotals = [...rows.reduce((totals, row) => totals.set(row.mk, (totals.get(row.mk) ?? 0) + row.n), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const busiest = rows.reduce((best, row) => (row.n > best.n ? row : best), rows[0]);
  const sha = manifest.sourceSha256;

  return (
    <section className="showcase" aria-labelledby="showcase-title">
      <div className="showcase-hero">
        <Reveal className="showcase-copy">
          <p className="showcase-eyebrow" data-reveal><span className="live-dot" aria-hidden="true" /> Release {formatRetrievedDate(manifest.sourceRetrievedAt)}</p>
          <h2 id="showcase-title" data-reveal>Canada-wide evidence behind <span>every single check.</span></h2>
          <p data-reveal>Dealer inventory from {manifest.provinces.length} provinces, audited into published price cells, then adjusted by a condition model trained on real wholesale sale outcomes.</p>
          <div className="showcase-actions" data-reveal>
            <a className="cta-primary" href="#check">Check a listing <ArrowRightIcon size={15} /></a>
            <Link className="cta-ghost" href="/market-lab">Open the market lab</Link>
          </div>
        </Reveal>
        <div className="globe-wrap">
          <GlobeStage provinces={globeProvinces} />
          <ul className="province-rail" aria-label="Used vehicles represented by province">
            {provinceTotals.map((province) => <li key={province.code}><span>{province.code}</span><i><b style={{ width: `${(province.vehicles / maxProvince) * 100}%` }} /></i><em>{formatNumber(province.vehicles)}</em></li>)}
          </ul>
        </div>
      </div>

      <Reveal as="dl" className="showcase-stats">
        <div data-reveal><dt>Used vehicles represented</dt><dd><CountUp value={manifest.usedVehiclesRepresented} /></dd></div>
        <div data-reveal><dt>Published price cells</dt><dd><CountUp value={manifest.usedMarketCells} /></dd></div>
        <div data-reveal><dt>Wholesale sales behind the condition model</dt><dd><CountUp value={conditionModelMetadata.outcomes} /></dd></div>
        <div data-reveal><dt>Temporal-test WAPE</dt><dd><CountUp value={conditionModelMetadata.wapePct} decimals={1} suffix="%" /></dd></div>
      </Reveal>

      <Spotlight className="bento-wrap">
        <Reveal className="bento">
          <article className="spotlight-card bento-wide" data-reveal>
            <header><i><CpuIcon /></i><h3>Condition-aware ML, not a lookup table</h3></header>
            <p>Gradient-boosted trees move the Canadian median for condition tier and odometer. The band shows the spread you should expect.</p>
            <figure className="bento-curve">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path className="curve-fill" d={`${distributionPath(busiest)} L100 100 L0 100 Z`} /><path className="curve-stroke" d={distributionPath(busiest)} pathLength={1} /></svg>
              <figcaption><span>{busiest.y} {busiest.mk} {busiest.md} · {busiest.p}</span><b>{formatCad(busiest.p10)} – {formatCad(busiest.p90)}</b></figcaption>
            </figure>
          </article>
          <article className="spotlight-card" data-reveal>
            <header><i><CodeIcon /></i><h3>Official VIN decode</h3></header>
            <p>Specs come from the NHTSA vPIC decoder, only when you ask. A VIN never invents a price.</p>
            <code className="bento-code">POST /api/vin-decode</code>
          </article>
          <article className="spotlight-card" data-reveal>
            <header><i><PlugIcon /></i><h3>Paste a listing</h3></header>
            <p>Import year, make, model, mileage and ask from a public listing page, then check it.</p>
            <code className="bento-code">AutoTrader · Kijiji · Clutch</code>
          </article>
          <article className="spotlight-card" data-reveal>
            <header><i><CurveIcon size={18} /></i><h3>Across Canada</h3></header>
            <p>Compare the same vehicle&apos;s published median in every province that lists it.</p>
            <code className="bento-code">{manifest.provinces.join(" ")}</code>
          </article>
          <article className="spotlight-card" data-reveal>
            <header><i><LockIcon /></i><h3>Save &amp; share checks</h3></header>
            <p>Scenarios stay in your browser. Share a link that rebuilds the exact inputs.</p>
            <code className="bento-code">?scenario=…</code>
          </article>
          <article className="spotlight-card bento-wide" data-reveal>
            <header><i><ShieldCheckIcon size={18} /></i><h3>Every number has a source</h3></header>
            <p>The release is schema-checked, deduplicated and hashed before it ships. Nothing on screen is typed in by hand.</p>
            <pre className="bento-terminal" aria-label="Release audit summary"><span>$ build:data --verify</span>{"\n"}<span className="ok">✓</span> {formatNumber(manifest.usedMarketCells)} cells · {formatNumber(manifest.quality.duplicateKeys)} duplicate keys{"\n"}<span className="ok">✓</span> min sample ≥ {manifest.quality.minimumCellSize} · percentiles ordered{"\n"}<span className="dim">sha256 {sha.slice(0, 12)}…{sha.slice(-6)}</span></pre>
            <Link className="bento-link" href="/market-lab#source-audit">Inspect the audit <ArrowRightIcon size={13} /></Link>
          </article>
        </Reveal>
      </Spotlight>

      <div className="marquee" aria-label={`${manifest.makes} makes in this release`}>
        {[0, 1].map((copy) => (
          <ul key={copy} className="marquee-track" aria-hidden={copy === 1 ? true : undefined}>
            {makeTotals.map(([make, vehicles]) => <li key={make}>{make}<small>{formatNumber(vehicles)}</small></li>)}
          </ul>
        ))}
      </div>
    </section>
  );
}
