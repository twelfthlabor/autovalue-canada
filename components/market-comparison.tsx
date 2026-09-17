"use client";
import { formatCad, formatNumber, type MarketRow } from "@/lib/market";

const names: Record<string, string> = {ON:"Ontario",QC:"Quebec",BC:"British Columbia",AB:"Alberta",MB:"Manitoba",SK:"Saskatchewan",NS:"Nova Scotia",NB:"New Brunswick",NL:"Newfoundland & Labrador",PE:"Prince Edward Island",NT:"Northwest Territories",YT:"Yukon",NU:"Nunavut"};
export function MarketComparison({ rows, selected, onSelect }: { rows: MarketRow[]; selected: string; onSelect: (row: MarketRow) => void }) {
  const sorted = [...rows].sort((a,b) => a.p50 - b.p50);
  const max = Math.max(...sorted.map(row => row.p50));
  return <section className="market-comparison"><div className="explorer-title"><div><h4>Same vehicle. Different markets.</h4><p>Published medians before condition and mileage adjustments.</p></div><span>{rows.length} provinces</span></div><div className="province-list">{sorted.map(row => <button key={row.p} type="button" aria-pressed={selected === row.p} onClick={() => onSelect(row)}><span className="province-name">{names[row.p] ?? row.p}<small>{formatNumber(row.n)} vehicles</small></span><span className="province-track"><i style={{width: `${row.p50/max*100}%`}} /></span><strong>{formatCad(row.p50)}</strong><span className="province-check" aria-hidden="true">{selected === row.p ? "✓" : "↗"}</span></button>)}</div><p className="market-note">Select a province to use its reference. Differences may reflect inventory mix; these are asking prices, not transaction prices.</p></section>;
}
