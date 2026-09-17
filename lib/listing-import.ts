// Allowlist and layered parsing for one user-pasted listing page.
// Nothing here is persisted or logged; the route fetches one page per request.

export const LISTING_HOSTS = [
  "autotrader.ca",
  "www.autotrader.ca",
  "kijiji.ca",
  "www.kijiji.ca",
  "carpages.ca",
  "www.carpages.ca",
  "clutch.ca",
  "www.clutch.ca",
];

export type ListingFields = {
  province?: string;
  make?: string;
  model?: string;
  year?: string;
  odometer?: string;
  askingPrice?: string;
};

type ListingSource = "structured data" | "page metadata" | "page text";

export function isAllowedListingHost(hostname: string) {
  return LISTING_HOSTS.includes(hostname.toLowerCase());
}

export function validateListingUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "That does not look like a valid link. Paste the full listing address." };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "Only https listing links are supported." };
  if (url.username || url.password || (url.port && url.port !== "443") || !isAllowedListingHost(url.hostname)) {
    return { ok: false, reason: "Only AutoTrader.ca, Kijiji.ca, Carpages.ca and Clutch.ca links are supported." };
  }
  return { ok: true, url };
}

const PROVINCE_CODES = new Set(["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"]);

const PROVINCE_NAMES: Record<string, string> = {
  alberta: "AB", "british columbia": "BC", manitoba: "MB", "new brunswick": "NB",
  "newfoundland and labrador": "NL", "nova scotia": "NS", "northwest territories": "NT",
  nunavut: "NU", ontario: "ON", "prince edward island": "PE", quebec: "QC", québec: "QC",
  saskatchewan: "SK", yukon: "YT",
};

// First letter of a postal code. X (NT/NU) is ambiguous, so it is not mapped.
const POSTAL_PROVINCE: Record<string, string> = {
  A: "NL", B: "NS", C: "PE", E: "NB", G: "QC", H: "QC", J: "QC",
  K: "ON", L: "ON", M: "ON", N: "ON", P: "ON", R: "MB", S: "SK", T: "AB", V: "BC", Y: "YT",
};

const FIELD_LABEL: Record<keyof ListingFields, string> = {
  year: "year", make: "make", model: "model", odometer: "odometer", askingPrice: "asking price", province: "province",
};

const FIELD_ORDER: Array<keyof ListingFields> = ["year", "make", "model", "odometer", "askingPrice", "province"];

function cleanText(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textValue(value: unknown): string | undefined {
  if (typeof value === "string") return cleanText(value) || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return value.map(textValue).find(Boolean);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return textValue(record.name) ?? textValue(record["@value"]) ?? textValue(record.value);
  }
  return undefined;
}

function numberInRange(value: string, min: number, max: number) {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  const number = Number(digits);
  return number >= min && number <= max ? String(number) : undefined;
}

function readYear(value: string | undefined) {
  return value?.match(/\b(19[89]\d|20[0-3]\d)\b/)?.[0];
}

function provinceFrom(value: string) {
  const code = value.trim().toUpperCase();
  if (PROVINCE_CODES.has(code)) return code;
  return PROVINCE_NAMES[value.trim().toLowerCase()];
}

function collectLdNodes(html: string) {
  const nodes: Record<string, unknown>[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    nodes.push(value as Record<string, unknown>);
    Object.values(value as Record<string, unknown>).forEach(visit);
  };
  for (const block of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(block[1]));
    } catch {
      // Malformed structured data is skipped; lower layers still run.
    }
  }
  return nodes;
}

function ldProvince(nodes: Record<string, unknown>[]) {
  for (const node of nodes) {
    const region = textValue(node.addressRegion);
    const province = region ? provinceFrom(region) : undefined;
    if (province) return province;
  }
  for (const node of nodes) {
    const postalCode = textValue(node.postalCode);
    const match = postalCode?.toUpperCase().match(/^([A-Z])\d[A-Z]/);
    const province = match ? POSTAL_PROVINCE[match[1]] : undefined;
    if (province) return province;
  }
  return undefined;
}

function ldOdometer(node: Record<string, unknown>) {
  const raw = node.mileageFromOdometer;
  if (typeof raw === "number" || typeof raw === "string") return numberInRange(String(raw), 0, 1_000_000);
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const unit = (textValue(record.unitCode) ?? textValue(record.unitText) ?? "").toUpperCase();
    if (unit.includes("MI")) return undefined; // Miles are not converted into kilometres.
    return numberInRange(textValue(record.value) ?? "", 0, 1_000_000);
  }
  return undefined;
}

function ldPrice(node: Record<string, unknown>) {
  const offers: unknown[] = Array.isArray(node.offers) ? node.offers : [node.offers, node];
  for (const offer of offers) {
    if (!offer || typeof offer !== "object") continue;
    const record = offer as Record<string, unknown>;
    const currency = textValue(record.priceCurrency)?.toUpperCase();
    if (currency && currency !== "CAD") continue;
    const price = numberInRange(textValue(record.price) ?? "", 500, 2_000_000);
    if (price) return price;
  }
  return undefined;
}

function parseVehicleTitle(text: string): { year?: string; make?: string; model?: string } {
  const match = text.match(/\b(19[89]\d|20[0-3]\d)\b/);
  if (!match || match.index === undefined) return {};
  const tokens = text
    .slice(match.index + match[0].length)
    .split(/[\s|,·•/]+/)
    .map((token) => token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9-]+$/g, ""))
    .filter(Boolean);
  const make = tokens[0]?.match(/^[A-Za-z][A-Za-z-]{1,18}$/) ? tokens[0] : undefined;
  const model = tokens[1]?.match(/^[A-Za-z0-9-]{1,18}$/) && /[A-Za-z]/.test(tokens[1]) ? tokens[1] : undefined;
  return { year: match[0], ...(make ? { make } : {}), ...(model ? { model } : {}) };
}

function textOdometer(html: string) {
  for (const match of html.matchAll(/([\d][\d,\s]{1,8}?)\s*(?:km|kilometres|kilometers|kms)\b/gi)) {
    const odometer = numberInRange(match[1], 1, 1_000_000);
    if (odometer) return odometer;
  }
  return undefined;
}

function textPrice(html: string) {
  for (const match of html.matchAll(/\$\s?([\d][\d,]{2,9})(?![\d])/g)) {
    const price = numberInRange(match[1], 500, 2_000_000);
    if (price) return price;
  }
  for (const match of html.matchAll(/"(?:price|Price)"\s*:\s*"?(\d{3,9})"?(?![\d])/g)) {
    const price = numberInRange(match[1], 500, 2_000_000);
    if (price) return price;
  }
  return undefined;
}

function metaTags(html: string) {
  const tags = new Map<string, string>();
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes: Record<string, string> = {};
    for (const attribute of tag[0].matchAll(/([a-z:-]+)\s*=\s*["']([^"']*)["']/gi)) attributes[attribute[1].toLowerCase()] = attribute[2];
    const key = (attributes.property ?? attributes.name ?? "").toLowerCase();
    if (key && attributes.content && !tags.has(key)) tags.set(key, cleanText(attributes.content));
  }
  return tags;
}

function buildNote(fields: ListingFields, sources: Partial<Record<keyof ListingFields, ListingSource>>) {
  const groups = new Map<ListingSource, string[]>();
  for (const field of FIELD_ORDER) {
    const source = sources[field];
    if (!fields[field] || !source) continue;
    groups.set(source, [...(groups.get(source) ?? []), FIELD_LABEL[field]]);
  }
  if (groups.size === 0) return "No vehicle details were found on that page. Enter them manually.";
  const list = new Intl.ListFormat("en-CA", { style: "long", type: "conjunction" });
  const parts = [...groups].map(([source, labels]) => `${list.format(labels)} in ${source}`);
  return `Found ${parts.join("; ")}.`;
}

/**
 * Layered best-effort parse: JSON-LD, then og: title/description, then
 * targeted page-text patterns. Each field keeps the first layer that finds
 * it, and a field no layer finds stays absent rather than guessed.
 */
export function parseListingHtml(html: string): { fields: ListingFields; note: string } {
  const fields: ListingFields = {};
  const sources: Partial<Record<keyof ListingFields, ListingSource>> = {};
  const set = <K extends keyof ListingFields>(field: K, value: string | undefined, source: ListingSource) => {
    if (value && fields[field] === undefined) {
      fields[field] = value;
      sources[field] = source;
    }
  };

  const nodes = collectLdNodes(html);
  for (const node of nodes) {
    set("year", readYear(textValue(node.vehicleModelDate) ?? textValue(node.modelDate)), "structured data");
    set("make", textValue(node.brand) ?? textValue(node.manufacturer), "structured data");
    set("model", textValue(node.model), "structured data");
    set("odometer", ldOdometer(node), "structured data");
    set("askingPrice", ldPrice(node), "structured data");
  }
  set("province", ldProvince(nodes), "structured data");
  if (fields.year === undefined || fields.make === undefined || fields.model === undefined) {
    for (const node of nodes) {
      const parsed = parseVehicleTitle(textValue(node.name) ?? "");
      set("year", parsed.year, "structured data");
      set("make", parsed.make, "structured data");
      set("model", parsed.model, "structured data");
    }
  }

  const meta = metaTags(html);
  const parsedTitle = parseVehicleTitle(meta.get("og:title") ?? "");
  set("year", parsedTitle.year, "page metadata");
  set("make", parsedTitle.make, "page metadata");
  set("model", parsedTitle.model, "page metadata");
  const description = meta.get("og:description");
  if (description) {
    set("odometer", textOdometer(description), "page metadata");
    set("askingPrice", textPrice(description), "page metadata");
  }

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) {
    const parsed = parseVehicleTitle(cleanText(title));
    set("year", parsed.year, "page text");
    set("make", parsed.make, "page text");
    set("model", parsed.model, "page text");
  }
  const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (heading) {
    const parsed = parseVehicleTitle(cleanText(heading.replace(/<[^>]+>/g, " ")));
    set("year", parsed.year, "page text");
    set("make", parsed.make, "page text");
    set("model", parsed.model, "page text");
  }
  set("askingPrice", textPrice(html), "page text");
  set("odometer", textOdometer(html), "page text");

  return { fields, note: buildNote(fields, sources) };
}
