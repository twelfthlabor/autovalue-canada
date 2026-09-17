"use client";

import { useState } from "react";

export type ProvinceCoverage = { code: string; name: string; vehicles: number; cells: number; makes: number; years: [number, number] };

export function MarketCoverage({ provinces }: { provinces: ProvinceCoverage[] }) {
  const [selected, setSelected] = useState("ON");
  const [metric, setMetric] = useState<"vehicles" | "cells">("vehicles");
  const current = provinces.find(row => row.code === selected) ?? provinces[0];
  const ordered = [...provinces].sort((a, b) => b[metric] - a[metric]);
  const total = provinces.reduce((sum, row) => sum + row.vehicles, 0);
  const max = Math.max(...provinces.map(row => row[metric]));
  return <section className="coverage-explorer" aria-label="Explore provincial coverage">
    <div className="coverage-chart">
      <div className="coverage-toolbar"><h3>Inventory by province</h3><label><span className="sr-only">Coverage measure</span><select aria-label="Coverage measure" value={metric} onChange={event => setMetric(event.target.value as "vehicles" | "cells")}><option value="vehicles">Vehicles</option><option value="cells">Market cells</option></select></label></div>
      <div className="coverage-bars">{ordered.map(row => <button key={row.code} type="button" aria-label={`Inspect ${row.name}`} aria-pressed={current.code === row.code} onClick={() => setSelected(row.code)}><span>{row.code}</span><i><b style={{ width: `${row[metric] / max * 100}%` }} /></i><strong>{row[metric].toLocaleString("en-CA")}</strong></button>)}</div>
      <p>Select a province to inspect its coverage.</p>
    </div>
    <div className="coverage-detail" aria-live="polite"><span className="coverage-code">{current.code}</span><h3>{current.name}</h3><p><strong>{(current.vehicles / total * 100).toFixed(1)}%</strong> of represented inventory</p><dl><div><dt>Vehicles</dt><dd data-testid="province-vehicles">{current.vehicles.toLocaleString("en-CA")}</dd></div><div><dt>Market cells</dt><dd>{current.cells.toLocaleString("en-CA")}</dd></div><div><dt>Makes</dt><dd>{current.makes}</dd></div><div><dt>Model years</dt><dd>{current.years[0]}–{current.years[1]}</dd></div></dl><small>Coverage varies by vehicle. Every cell represents at least 10 dealer listings.</small></div>
  </section>;
}
