import { NextResponse } from "next/server";
import { mapVpicVehicle } from "@/lib/vin-report";
import { normalizeVin, validateNorthAmericanVin } from "@/lib/vin";

export const dynamic = "force-dynamic";

// Light fixed-window limiter: the route proxies the free NHTSA service and
// must not become an open relay. State is per server instance, which is
// sufficient for a single-region non-commercial demo.
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(clientKey: string) {
  const now = Date.now();
  const entry = hits.get(clientKey);
  if (!entry || entry.resetAt <= now) {
    hits.set(clientKey, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (hits.size > 10_000) for (const [key, value] of hits) if (value.resetAt <= now) hits.delete(key);
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

export async function POST(request: Request) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  if (isRateLimited(clientIp)) {
    return NextResponse.json({ error: "Too many VIN lookups from this address. Please wait a minute and try again." }, { status: 429 });
  }

  try {
    const body = await request.json();
    const vin = normalizeVin(String(body.vin ?? ""));
    if (validateNorthAmericanVin(vin) !== "valid") {
      return NextResponse.json({ error: "Enter a valid 17-character North American VIN." }, { status: 400 });
    }

    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`, {
      headers: { Accept: "application/json", "User-Agent": "AutoValue-Canada/0.3 portfolio-research" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("The official VIN decoder is temporarily unavailable.");
    const payload = await response.json();
    const vehicle = mapVpicVehicle(payload.Results?.[0] ?? {}, vin);
    return NextResponse.json({
      vehicle,
      notice: "Vehicle decoded live through the official NHTSA vPIC service. Asking price, odometer and listing condition are not encoded in a VIN; enter them manually or connect a licensed inventory feed.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "VIN lookup failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
