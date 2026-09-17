import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseListingHtml, validateListingUrl } from "./listing-import";

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

  it("finds page-text values when no structured data or og tags exist", () => {
    const { fields } = parseListingHtml("<html><body><h1>2017 Ford F-150 XLT</h1><p>$27,500</p><p>133,000 km</p></body></html>");
    expect(fields).toEqual({ year: "2017", make: "Ford", model: "F-150", odometer: "133000", askingPrice: "27500" });
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
});
