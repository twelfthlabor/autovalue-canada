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

const ALLOWLIST_REASON = "Only AutoTrader.ca, Kijiji.ca, Carpages.ca and Clutch.ca links are supported.";

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
    return { ok: false, reason: ALLOWLIST_REASON };
  }
  return { ok: true, url };
}

const MAX_REDIRECTS = 3;

export type ListingFetch = (input: URL, init: RequestInit) => Promise<Response>;

/**
 * Fetches one listing page with redirects disabled at the platform level and
 * followed manually: every hop is checked with the same https/host allowlist
 * as the entry URL, so a redirect cannot reach an internal or non-listing host.
 */
export async function fetchListingPage(
  url: URL,
  fetchImpl: ListingFetch = fetch,
  signal?: AbortSignal,
): Promise<{ ok: true; response: Response } | { ok: false; reason: string }> {
  let current = url;
  for (let redirects = 0; ; ) {
    const response = await fetchImpl(current, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "AutoValue-Canada/0.3 listing-import (one page per request; contact: portfolio demo)",
      },
      signal,
      redirect: "manual",
      cache: "no-store",
    });
    const location = response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;
    if (!location) {
      const final = validateListingUrl(response.url || current.href);
      return final.ok ? { ok: true, response } : { ok: false, reason: final.reason };
    }
    if (redirects >= MAX_REDIRECTS) {
      return { ok: false, reason: "That link redirected too many times. Enter the details manually." };
    }
    redirects += 1;
    void response.body?.cancel().catch(() => {});
    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      return { ok: false, reason: ALLOWLIST_REASON };
    }
    const hop = validateListingUrl(next.href);
    if (!hop.ok) return { ok: false, reason: hop.reason };
    current = hop.url;
  }
}

// Only provinces with published market cells (see public/data/manifest.json);
// a code without a selector option would validate but never resolve.
export const PROVINCE_CODES = new Set(["AB", "BC", "MB", "NB", "NL", "NS", "ON", "PE", "QC", "SK"]);

const PROVINCE_NAMES: Record<string, string> = {
  alberta: "AB", "british columbia": "BC", manitoba: "MB", "new brunswick": "NB",
  "newfoundland and labrador": "NL", "nova scotia": "NS", ontario: "ON",
  "prince edward island": "PE", quebec: "QC", québec: "QC", saskatchewan: "SK",
};

// First letter of a postal code. X (territories) has no market cell, so it is
// not mapped.
const POSTAL_PROVINCE: Record<string, string> = {
  A: "NL", B: "NS", C: "PE", E: "NB", G: "QC", H: "QC", J: "QC",
  K: "ON", L: "ON", M: "ON", N: "ON", P: "ON", R: "MB", S: "SK", T: "AB", V: "BC",
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

// One number with EN/FR thousands separators ("31,995", "31 995") and an
// optional decimal tail ("31,995.00"). Concatenating all digits turned
// "31,995.00" into 3199500.
const NUMBER_TEXT = /\d+(?:[,\s]\d{3})*(?:[.,]\d{1,2})?/;

function numberInRange(value: string, min: number, max: number) {
  const match = value.match(NUMBER_TEXT);
  if (!match) return undefined;
  const digits = match[0].replace(/[.,]\d{1,2}$/, "").replace(/[^\d]/g, "");
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

// Linear block scan: the previous lazy regex rescanned to the end of the page
// for every unclosed tag, so a 2 MB page of them took tens of seconds.
const MAX_LD_BLOCKS = 64;

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
  // Case-insensitive regexes over the original text: lowercasing a copy can
  // change its length (İ → i̇), which shifted every later index and dropped
  // JSON-LD blocks.
  const openTag = /<script\b[^>]*>/gi;
  const closeTag = /<\/script/gi;
  let cursor = 0;
  for (let block = 0; block < MAX_LD_BLOCKS; block += 1) {
    openTag.lastIndex = cursor;
    const open = openTag.exec(html);
    if (!open) break;
    const openEnd = open.index + open[0].length;
    if (!/type\s*=\s*["']application\/ld\+json["']/i.test(open[0])) {
      cursor = openEnd;
      continue;
    }
    closeTag.lastIndex = openEnd;
    const close = closeTag.exec(html);
    if (!close) break;
    try {
      visit(JSON.parse(html.slice(openEnd, close.index)));
    } catch {
      // Malformed structured data is skipped; lower layers still run.
    }
    cursor = close.index + 8;
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

// Trim, drivetrain and mileage tokens that commonly follow a model family in
// listing titles ("RAV4 XLE AWD", "F-150 XLT", "Civic LX"). They are not part
// of the model, so a two-token model stops before them.
const NON_MODEL_TOKENS = new Set([
  "awd", "fwd", "rwd", "4wd", "4x4", "quattro", "xdrive", "4matic",
  "xlt", "xl", "lariat", "platinum", "limited", "touring", "premium",
  "se", "sel", "le", "xle", "xse", "sr5", "trd", "lx", "ex", "sx", "gs",
  "glx", "dx", "ce", "es", "ls", "lt", "ltz", "sle", "slt", "sxt", "denali",
  "at4", "hybrid", "phev", "diesel", "turbo",
]);

const MAKE_TOKEN = /^[A-Za-z][A-Za-z-]{1,18}$/;
const MODEL_TOKEN = /^[A-Za-z0-9-]{1,18}$/;

function titleTokens(text: string) {
  return text
    .split(/[\s|,·•/]+/)
    .map((token) => token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9-]+$/g, ""))
    .filter(Boolean);
}

/**
 * Titles put the year before the pair ("2021 Jeep Grand Cherokee") or after it
 * ("Toyota RAV4 2021 AWD, 89 000 km"). Tokens adjacent to the year win, and a
 * model may be two tokens ("Grand Cherokee", "Model 3") as long as the second
 * is not a trim or drivetrain token.
 */
function parseVehicleTitle(text: string): { year?: string; make?: string; model?: string } {
  const match = text.match(/\b(19[89]\d|20[0-3]\d)\b/);
  if (!match || match.index === undefined) return {};
  const before = titleTokens(text.slice(0, match.index));
  const after = titleTokens(text.slice(match.index + match[0].length));
  const usable = (token: string | undefined) => !!token && MODEL_TOKEN.test(token) && !NON_MODEL_TOKENS.has(token.toLowerCase());
  let make: string | undefined;
  let modelTokens: string[] = [];
  const lead = after[1];
  if (after[0] && MAKE_TOKEN.test(after[0]) && !NON_MODEL_TOKENS.has(after[0].toLowerCase())) {
    make = after[0];
    if (lead && usable(lead) && /[A-Za-z]/.test(lead)) {
      const continuation = after[2];
      modelTokens = continuation && usable(continuation) ? [lead, continuation] : [lead];
    }
  }
  if (modelTokens.length === 0) {
    const fallbackMake = before[before.length - 2];
    const fallbackModel = before[before.length - 1];
    if (fallbackMake && fallbackModel && MAKE_TOKEN.test(fallbackMake) && !NON_MODEL_TOKENS.has(fallbackMake.toLowerCase()) && usable(fallbackModel) && /[A-Za-z]/.test(fallbackModel)) {
      make = fallbackMake;
      modelTokens = [fallbackModel];
    }
  }
  return { year: match[0], ...(make ? { make } : {}), ...(modelTokens.length > 0 ? { model: modelTokens.join(" ") } : {}) };
}

// A "km" unit is the odometer label, but the same unit also carries range,
// consumption, warranty and distance copy. The first plausible labelled value
// wins; anything with one of these contexts is skipped.
const ODOMETER_CONTEXT = /(l\s*\/\s*\d*|per\s+100|range|warrant|coverage|battery|electric|radius|towing|payload|clearance)/i;
const ODOMETER_CONTEXT_AFTER = /\b(away|range|left|remaining|to empty)\b/i;

// The label can sit several words before its number ("Electric range
// according to the manufacturer 342 km"), so the context window is 60
// characters; it stops at the previous sentence, separator or number so the
// odometer that follows another kilometric spec ("Range: 342 km. Odometer:
// 89,000 km") does not inherit that spec's label.
function contextBefore(text: string, index: number) {
  const window = text.slice(Math.max(0, index - 60), index);
  const boundary = Math.max(
    window.lastIndexOf("."), window.lastIndexOf(";"), window.lastIndexOf("|"),
    window.lastIndexOf("·"), window.lastIndexOf("\n"), window.search(/\d(?=[^\d]*$)/),
  );
  return boundary < 0 ? window : window.slice(boundary + 1);
}

function textOdometer(html: string) {
  for (const match of html.matchAll(/(\d+(?:[,\s]\d{3})*(?:[.,]\d{1,2})?)\s*(?:km|kilometres|kilometers|kms)\b/gi)) {
    if (match.index === undefined) continue;
    const before = contextBefore(html, match.index);
    const after = html.slice(match.index + match[0].length, match.index + match[0].length + 14);
    if (/[l\d]\s*\/\s*$|\bper\s*$/i.test(before) || ODOMETER_CONTEXT.test(before) || ODOMETER_CONTEXT_AFTER.test(after)) continue;
    const odometer = numberInRange(match[1], 1, 1_000_000);
    if (odometer) return odometer;
  }
  // French pages label the field without a unit ("Kilométrage : 89 000").
  const labelled = html.match(/(?:kilom[ée]trage|odom[èe]tre)\s*:?\s*(\d+(?:[,\s]\d{3})*)/i);
  return labelled ? numberInRange(labelled[1], 1, 1_000_000) : undefined;
}

// Prices carry a label ("Ask", "Now", "Price", "Prix") or an exculpatory
// neighbour ("Save", "Was", "Regular") that says it is not the asking price.
const PRICE_LABEL = /(price|prix|asking|ask|sale|now|listed|cost|pay|buy)/i;
// Only the token right before the amount counts as its context: a struck
// price earlier in the sentence ("Was $34,995 / Now $31,995") must not hide
// the real ask.
const PRICE_CONTEXT = /\b(save[sd]?|was|struck|msrp|rebate|discount|regular|down|deposit|monthly|weekly|bi-?weekly|finance|financing|lease|freight|tax|fees?)\b/i;
const PRICE_CONTEXT_AFTER = /(per\s+(month|week)|monthly|weekly|bi-?weekly|\/\s*(mo|month|wk|week)|down|deposit|save|rebate|tax|fees?)/i;

function textPrice(html: string, requireLabel = false) {
  for (const match of html.matchAll(/\$\s?(\d+(?:[,\s]\d{3})*(?:[.,]\d{1,2})?)/g)) {
    if (match.index === undefined) continue;
    const before = html.slice(Math.max(0, match.index - 30), match.index);
    const adjacent = html.slice(Math.max(0, match.index - 14), match.index);
    const after = html.slice(match.index + match[0].length, match.index + match[0].length + 16);
    if (PRICE_CONTEXT.test(adjacent) || PRICE_CONTEXT_AFTER.test(after)) continue;
    if (requireLabel && !PRICE_LABEL.test(before)) continue;
    const price = numberInRange(match[1], 500, 2_000_000);
    if (price) return price;
  }
  // French listings put the dollar sign after the amount ("31 995 $").
  for (const match of html.matchAll(/(\d+(?:[,\s]\d{3})*(?:[.,]\d{1,2})?)\s*\$/g)) {
    if (match.index === undefined) continue;
    const before = html.slice(Math.max(0, match.index - 30), match.index);
    const adjacent = html.slice(Math.max(0, match.index - 14), match.index);
    if (PRICE_CONTEXT.test(adjacent)) continue;
    if (requireLabel && !PRICE_LABEL.test(before)) continue;
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
  const list = new Intl.ListFormat("en-CA", { style: "long", type: "unit" });
  const parts = [...groups].map(([source, labels]) => `${list.format(labels)} in ${source}`);
  const note = `${parts.join("; ")}.`;
  return note[0].toUpperCase() + note.slice(1);
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
  // Whole-document fallback: a bare amount in page chrome ("Save $1,000",
  // struck prices) is not the asking price; only a labelled one is taken.
  set("askingPrice", textPrice(html, true), "page text");
  set("odometer", textOdometer(html), "page text");

  return { fields, note: buildNote(fields, sources) };
}

const FIELD_MAX_TEXT = 40;

/**
 * Guards the import response before it reaches the form: only strings of the
 * expected shape survive, anything else is dropped rather than cast.
 */
export function readListingFields(value: unknown): ListingFields {
  const fields: ListingFields = {};
  if (!value || typeof value !== "object") return fields;
  const record = value as Record<string, unknown>;
  const read = (field: keyof ListingFields) => (typeof record[field] === "string" ? cleanText(record[field]) : "");
  const province = read("province").toUpperCase();
  if (PROVINCE_CODES.has(province)) fields.province = province;
  const year = read("year");
  if (/^(19[89]\d|20[0-3]\d)$/.test(year)) fields.year = year;
  for (const field of ["make", "model"] as const) {
    const text = read(field);
    if (text && text.length <= FIELD_MAX_TEXT) fields[field] = text;
  }
  for (const field of ["odometer", "askingPrice"] as const) {
    const digits = read(field).replace(/,/g, "");
    if (/^\d{1,7}$/.test(digits)) fields[field] = digits;
  }
  return fields;
}
