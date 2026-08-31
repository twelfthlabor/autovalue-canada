import { NextResponse } from "next/server";
import { findPublicListing, findVerifiedVehicle, mapVpicVehicle } from "@/lib/vin-report";
import { normalizeVin, validateNorthAmericanVin } from "@/lib/vin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const vin = normalizeVin(String(body.vin ?? ""));
    if (validateNorthAmericanVin(vin) !== "valid") {
      return NextResponse.json({ error: "Enter a valid 17-character North American VIN." }, { status: 400 });
    }

    const listing = findPublicListing(vin);
    const verifiedFallback = findVerifiedVehicle(vin);
    let vehicle;
    try {
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`, {
        headers: { Accept: "application/json", "User-Agent": "AutoValue-Canada/0.1 portfolio-research" },
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 86400 },
      });
      if (!response.ok) throw new Error("The official VIN decoder is temporarily unavailable.");
      const payload = await response.json();
      vehicle = mapVpicVehicle(payload.Results?.[0] ?? {}, vin);
    } catch (error) {
      vehicle = verifiedFallback;
      if (!vehicle) throw error;
    }
    return NextResponse.json({
      vehicle,
      listing,
      notice: listing
        ? "Exact public listing found in the verified evidence registry. The vehicle decode, seller facts and comparison snapshot are separately attributed and time-stamped."
        : "Vehicle decoded. No exact public listing is registered, so asking price and history must still be supplied or obtained from a licensed feed.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "VIN lookup failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
