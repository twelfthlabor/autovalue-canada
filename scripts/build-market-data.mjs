import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "data", "raw", "price_stats_by_model_year.csv");
const OUTPUT_DIR = path.join(ROOT, "public", "data");
const OUTPUT = path.join(OUTPUT_DIR, "market.json");
const MANIFEST = path.join(OUTPUT_DIR, "manifest.json");

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function number(value, field, row) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${field} at CSV row ${row}: ${value}`);
  }
  return parsed;
}

const csv = await readFile(INPUT, "utf8");
const lines = csv.trim().split(/\r?\n/);
const headers = parseCsvLine(lines[0]);
const expectedHeaders = [
  "province", "make", "model", "model_year", "condition", "vehicles",
  "price_p10", "price_p25", "price_median", "price_p75", "price_p90",
  "price_mean", "mileage_median", "days_on_market_median",
];

if (headers.join("|") !== expectedHeaders.join("|")) {
  throw new Error(`Unexpected source schema: ${headers.join(", ")}`);
}

const keys = new Set();
let sourceVehicleTotal = 0;
let usedVehicleTotal = 0;
let newVehicleTotal = 0;
let rejectedRows = 0;

const rows = lines.slice(1).map((line, index) => {
  const csvRow = index + 2;
  const values = parseCsvLine(line);
  if (values.length !== headers.length) {
    throw new Error(`Expected ${headers.length} fields at CSV row ${csvRow}, found ${values.length}`);
  }

  const record = Object.fromEntries(headers.map((header, fieldIndex) => [header, values[fieldIndex]]));
  const row = {
    p: record.province,
    mk: record.make,
    md: record.model,
    y: number(record.model_year, "model_year", csvRow),
    c: record.condition,
    n: number(record.vehicles, "vehicles", csvRow),
    p10: number(record.price_p10, "price_p10", csvRow),
    p25: number(record.price_p25, "price_p25", csvRow),
    p50: number(record.price_median, "price_median", csvRow),
    p75: number(record.price_p75, "price_p75", csvRow),
    p90: number(record.price_p90, "price_p90", csvRow),
    mean: number(record.price_mean, "price_mean", csvRow),
    km: number(record.mileage_median, "mileage_median", csvRow),
    dom: number(record.days_on_market_median, "days_on_market_median", csvRow),
  };

  const prices = [row.p10, row.p25, row.p50, row.p75, row.p90];
  const isMonotonic = prices.every((price, priceIndex) => priceIndex === 0 || price >= prices[priceIndex - 1]);
  if (!isMonotonic || prices.some((price) => price <= 0) || row.n < 10) {
    rejectedRows += 1;
    throw new Error(`Quality gate failed at CSV row ${csvRow}`);
  }

  const key = `${row.p}|${row.mk}|${row.md}|${row.y}|${row.c}`;
  if (keys.has(key)) throw new Error(`Duplicate market cell: ${key}`);
  keys.add(key);

  sourceVehicleTotal += row.n;
  if (row.c === "Used") usedVehicleTotal += row.n;
  if (row.c === "New") newVehicleTotal += row.n;
  return row;
});

const usedRows = rows
  .filter((row) => row.c === "Used")
  .sort((a, b) => a.p.localeCompare(b.p) || a.mk.localeCompare(b.mk) || a.md.localeCompare(b.md) || b.y - a.y);

const sha256 = createHash("sha256").update(csv).digest("hex");
const provinces = [...new Set(usedRows.map((row) => row.p))].sort();
const makes = [...new Set(usedRows.map((row) => row.mk))].sort();
const years = usedRows.map((row) => row.y);

const manifest = {
  schemaVersion: 1,
  sourceRetrievedAt: "2026-08-29",
  sourceUrl: "https://huggingface.co/datasets/OmniaAuto/canadian-vehicle-market-aggregates",
  sourceLicense: "CC BY-NC 4.0",
  sourceSha256: sha256,
  priceBasis: "Dealer asking prices, not transactions",
  scope: "Canadian commercial inventory snapshot",
  usedMarketCells: usedRows.length,
  sourceMarketCells: rows.length,
  usedVehiclesRepresented: usedVehicleTotal,
  newVehiclesRepresented: newVehicleTotal,
  sourceVehiclesRepresented: sourceVehicleTotal,
  provinces,
  makes: makes.length,
  yearRange: [Math.min(...years), Math.max(...years)],
  quality: {
    duplicateKeys: 0,
    rejectedRows,
    percentileOrderViolations: 0,
    minimumCellSize: 10,
  },
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(OUTPUT, JSON.stringify(usedRows));
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Built ${usedRows.length.toLocaleString()} used-market cells from ${usedVehicleTotal.toLocaleString()} vehicles.`);
console.log(`Source SHA-256: ${sha256}`);
