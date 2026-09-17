import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fetchListingPage, parseListingHtml, readListingFields, validateListingUrl } from "./listing-import";

const ALLOWLIST_REASON = "Only AutoTrader.ca, Kijiji.ca, Carpages.ca and Clutch.ca links are supported.";

function entry(raw: string) {
  const check = validateListingUrl(raw);
  if (!check.ok) throw new Error(check.reason);
  return check.url;
}

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { location } });
}

function page(url = "") {
  const response = new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } });
  if (url) Object.defineProperty(response, "url", { value: url });
  return response;
}

function fixture(name: string) {
  return readFileSync(new URL(`../tests/fixtures/${name}`, import.meta.url), "utf8");
}

describe("validateListingUrl", () => {
  it("accepts every allowlisted host over https", () => {
    const hosts = ["autotrader.ca", "www.autotrader.ca", "kijiji.ca", "www.kijiji.ca", "carpages.ca", "www.carpages.ca", "clutch.ca", "www.clutch.ca"];
    for (const host of hosts) {
      expect(validateListingUrl(`https://${host}/a/listing/123`).ok, host).toBe(true);
    }
  });

  it("accepts an uppercase host and paths that merely mention another site", () => {
    expect(validateListingUrl("https://WWW.KIJIJI.CA/v-cars-trucks/ottawa/123").ok).toBe(true);
    expect(validateListingUrl("https://www.autotrader.ca/redirect?to=https://evil.com").ok).toBe(true);
  });

  it("rejects non-https and malformed links", () => {
    const rejected = ["", "not a url", "http://www.autotrader.ca/a/1", "ftp://www.kijiji.ca/x", "javascript:alert(1)", "data:text/html,<b>hi</b>"];
    for (const raw of rejected) {
      expect(validateListingUrl(raw).ok, raw).toBe(false);
    }
  });

  it("rejects hosts that only resemble an allowlisted site", () => {
    const rejected = [
      "https://evil.com/https://www.autotrader.ca",
      "https://www.autotrader.ca.evil.com/a/1",
      "https://notautotrader.ca/a/1",
      "https://autotrader.ca@evil.com/a/1",
      "https://evil.com#https://autotrader.ca",
      "https://\u0430utotrader.ca/a/1",
      "https://www.kijiji.ca:8443/a/1",
    ];
    for (const raw of rejected) {
      expect(validateListingUrl(raw).ok, raw).toBe(false);
    }
  });

  it("returns a short reason with every rejection", () => {
    const result = validateListingUrl("http://www.autotrader.ca/a/1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(10);
  });
});

describe("parseListingHtml", () => {
  it("reads a JSON-LD Vehicle page, including the province", () => {
    const { fields, note } = parseListingHtml(fixture("listing-autotrader.html"));
    expect(fields).toEqual({ year: "2021", make: "Toyota", model: "RAV4", odometer: "89000", askingPrice: "31995", province: "ON" });
    expect(note).toBe("Found year, make, model, odometer, asking price and province in structured data.");
  });

  it("reads a meta-only page and names where every field came from", () => {
    const { fields, note } = parseListingHtml(fixture("listing-kijiji.html"));
    expect(fields).toEqual({ year: "2019", make: "Honda", model: "Civic", odometer: "112000", askingPrice: "18500" });
    expect(note).toBe("Found year, make, model, odometer and asking price in page metadata.");
  });

  it("returns a partial result without inventing fields", () => {
    const { fields, note } = parseListingHtml('<script type="application/ld+json">{"@type":"Product","offers":{"price":"24900","priceCurrency":"CAD"}}</script>');
    expect(fields).toEqual({ askingPrice: "24900" });
    expect(note).toBe("Found asking price in structured data.");
  });

  it("falls back to a Product name for year, make and model", () => {
    const { fields } = parseListingHtml('<script type="application/ld+json">{"@type":"Product","name":"2022 Mazda CX-5 GS","offers":{"price":28995,"priceCurrency":"CAD"}}</script>');
    expect(fields).toEqual({ year: "2022", make: "Mazda", model: "CX-5", askingPrice: "28995" });
  });

  it("skips malformed structured data and still parses lower layers", () => {
    const { fields } = parseListingHtml('<script type="application/ld+json">{not json}</script><meta property="og:title" content="2020 Subaru Outback Touring">');
    expect(fields).toEqual({ year: "2020", make: "Subaru", model: "Outback" });
  });

  it("keeps a parsed make without inventing a model", () => {
    const { fields } = parseListingHtml('<meta property="og:title" content="2023 Honda">');
    expect(fields).toEqual({ year: "2023", make: "Honda" });
  });

  it("ignores odometer values reported in miles", () => {
    const { fields } = parseListingHtml('<script type="application/ld+json">{"@type":"Car","mileageFromOdometer":{"value":55000,"unitCode":"SMI"}}</script>');
    expect(fields.odometer).toBeUndefined();
  });

  it("finds labelled page-text values when no structured data or og tags exist", () => {
    const { fields } = parseListingHtml("<html><body><h1>2017 Ford F-150 XLT</h1><p>Asking $27,500</p><p>133,000 km</p></body></html>");
    expect(fields).toEqual({ year: "2017", make: "Ford", model: "F-150", odometer: "133000", askingPrice: "27500" });
  });

  it("reads a two-token model and prefers tokens adjacent to the year", () => {
    expect(parseListingHtml("<h1>2021 Jeep Grand Cherokee</h1>").fields).toEqual({ year: "2021", make: "Jeep", model: "Grand Cherokee" });
    expect(parseListingHtml("<h1>2022 Tesla Model 3</h1>").fields).toEqual({ year: "2022", make: "Tesla", model: "Model 3" });
    expect(parseListingHtml("<h1>Toyota RAV4 2021 AWD, 89 000 km</h1>").fields).toEqual({ year: "2021", make: "Toyota", model: "RAV4", odometer: "89000" });
  });

  it("does not read range, consumption, warranty or distance copy as an odometer", () => {
    for (const text of [
      "8.2 L/100 km",
      "Range 342 km",
      "Battery warranty 160,000 km",
      "1 km away",
      "Electric range according to the manufacturer 342 km",
      "Full warranty coverage for the electric components 160,000 km",
    ]) {
      const { fields } = parseListingHtml(`<html><body><p>${text}</p></body></html>`);
      expect(fields.odometer, text).toBeUndefined();
    }
  });

  it("keeps the odometer that follows another kilometric spec", () => {
    const { fields } = parseListingHtml("<html><body><p>Range: 342 km. Odometer: 89,000 km</p></body></html>");
    expect(fields.odometer).toBe("89000");
  });

  it("reads French odometer labels with and without a unit", () => {
    expect(parseListingHtml("<html><body><p>Kilométrage : 89 000</p></body></html>").fields.odometer).toBe("89000");
    expect(parseListingHtml("<html><body><p>Odomètre : 112 000 km</p></body></html>").fields.odometer).toBe("112000");
  });

  it("does not read savings as the asking price", () => {
    const { fields } = parseListingHtml("<html><body><p>Save $1,000</p></body></html>");
    expect(fields).toEqual({});
  });

  it("skips a struck price and keeps the labelled current price", () => {
    const { fields } = parseListingHtml("<html><body><p>Was $34,995 / Now $31,995</p></body></html>");
    expect(fields.askingPrice).toBe("31995");
  });

  it("keeps the sale price when a regular price is also shown", () => {
    const { fields } = parseListingHtml("<html><body><p>Regular price $41,995, sale $31,995</p></body></html>");
    expect(fields.askingPrice).toBe("31995");
  });

  it("reads a French labelled price", () => {
    expect(parseListingHtml("<html><body><p>Prix : 31 995 $</p></body></html>").fields.askingPrice).toBe("31995");
  });

  it("reads decimal-tail JSON-LD and French formatted prices", () => {
    const jsonLd = parseListingHtml('<script type="application/ld+json">{"@type":"Product","offers":{"price":"31,995.00","priceCurrency":"CAD"}}</script>');
    expect(jsonLd.fields.askingPrice).toBe("31995");
    const french = parseListingHtml('<meta property="og:description" content="31 995 $ · 89 000 km">');
    expect(french.fields).toEqual({ askingPrice: "31995", odometer: "89000" });
  });

  it("keeps scanning JSON-LD after a length-changing case mapping (İ)", () => {
    const { fields } = parseListingHtml('<p>İstanbul dealer</p><script type="application/ld+json">{"@type":"Product","name":"2022 Mazda CX-5 GS","offers":{"price":28995,"priceCurrency":"CAD"}}</script>');
    expect(fields).toEqual({ year: "2022", make: "Mazda", model: "CX-5", askingPrice: "28995" });
  });

  it("detects the province from a postal code when no region is present", () => {
    const { fields } = parseListingHtml('<script type="application/ld+json">{"@type":"Vehicle","brand":"Kia","model":"Sorento","address":{"postalCode":"T2P 1J9"}}</script>');
    expect(fields.province).toBe("AB");
  });

  it("reports no fields for a page without vehicle details", () => {
    const { fields, note } = parseListingHtml("<html><head><title>403 Forbidden</title></head></html>");
    expect(fields).toEqual({});
    expect(note).toBe("No vehicle details were found on that page. Enter them manually.");
  });

  it("parses a 2 MB page of unclosed JSON-LD tags in well under a second", () => {
    const html = '<script type="application/ld+json">'.repeat(53_000);
    const started = performance.now();
    const { fields } = parseListingHtml(html);
    const elapsed = performance.now() - started;
    expect(fields).toEqual({});
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("fetchListingPage", () => {
  it("rejects a redirect to a non-allowlisted host without fetching it", async () => {
    const fetched: string[] = [];
    const result = await fetchListingPage(entry("https://www.autotrader.ca/a/1"), async (url) => {
      fetched.push(url.href);
      return redirect("https://evil.example/steal");
    });
    expect(fetched).toEqual(["https://www.autotrader.ca/a/1"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe(ALLOWLIST_REASON);
  });

  it("follows a redirect chain between allowlisted hosts and resolves relative Locations", async () => {
    const fetched: string[] = [];
    const result = await fetchListingPage(entry("https://www.autotrader.ca/a/1"), async (url) => {
      fetched.push(url.href);
      if (url.href === "https://www.autotrader.ca/a/1") return redirect("https://www.kijiji.ca/v-cars/ottawa/2");
      if (url.href === "https://www.kijiji.ca/v-cars/ottawa/2") return redirect("/v-cars/ottawa/3");
      return page(url.href);
    });
    expect(fetched).toEqual([
      "https://www.autotrader.ca/a/1",
      "https://www.kijiji.ca/v-cars/ottawa/2",
      "https://www.kijiji.ca/v-cars/ottawa/3",
    ]);
    expect(result.ok).toBe(true);
  });

  it("rejects a chain of four redirects", async () => {
    const fetched: string[] = [];
    const result = await fetchListingPage(entry("https://www.autotrader.ca/a/1"), async (url) => {
      fetched.push(url.href);
      return redirect("https://www.autotrader.ca/a/next");
    });
    expect(fetched).toHaveLength(4);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("redirected too many times");
  });

  it("rejects a non-https redirect target and a non-https final URL", async () => {
    const hop = await fetchListingPage(entry("https://www.kijiji.ca/a/1"), async () => redirect("http://www.kijiji.ca/b/2"));
    expect(hop.ok).toBe(false);
    if (!hop.ok) expect(hop.reason).toBe("Only https listing links are supported.");

    const final = await fetchListingPage(entry("https://www.kijiji.ca/a/1"), async () => page("http://www.kijiji.ca/final"));
    expect(final.ok).toBe(false);
  });

  it("requests every hop with manual redirects", async () => {
    const inits: RequestInit[] = [];
    await fetchListingPage(entry("https://www.kijiji.ca/a/1"), async (url, init) => {
      inits.push(init);
      return url.href === "https://www.kijiji.ca/a/1" ? redirect("/b/2") : page(url.href);
    });
    expect(inits).toHaveLength(2);
    expect(inits.every((init) => init.redirect === "manual")).toBe(true);
  });
});

describe("readListingFields", () => {
  it("normalizes valid fields and drops unknown keys", () => {
    expect(readListingFields({
      province: "bc", make: " Honda ", model: "Civic", year: "2022", odometer: "42,000", askingPrice: "24900", extra: "ignored",
    })).toEqual({ province: "BC", make: "Honda", model: "Civic", year: "2022", odometer: "42000", askingPrice: "24900" });
  });

  it("ignores wrong types and out-of-range values", () => {
    expect(readListingFields({
      province: "ZZ",
      make: 7,
      model: "x".repeat(41),
      year: "abcd",
      odometer: "12.5",
      askingPrice: "-100",
    })).toEqual({});
  });

  it("treats non-object payloads as empty", () => {
    expect(readListingFields(null)).toEqual({});
    expect(readListingFields("not-an-object")).toEqual({});
    expect(readListingFields(undefined)).toEqual({});
  });
});
