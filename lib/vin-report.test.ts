import { describe, expect, it } from "vitest";
import { findPublicListing, findVerifiedVehicle, mapVpicVehicle } from "./vin-report";

describe("VIN report mapping", () => {
  it("maps clean vPIC fields into a compact vehicle report", () => {
    const vehicle = mapVpicVehicle({ ModelYear: "2023", Make: "AUDI", Model: "A4", Trim: "S Line quattro Prestige", BodyClass: "Sedan/Saloon", DriveType: "AWD/All-Wheel Drive", TransmissionStyle: "Automatic", EngineCylinders: "4", DisplacementL: "2.0", FuelTypePrimary: "Gasoline", PlantCountry: "GERMANY", ErrorCode: "0" }, "WAUFAAF43PN018218");
    expect(vehicle).toMatchObject({ year: 2023, make: "Audi", model: "A4", cylinders: 4, displacementL: 2 });
  });

  it("rejects an unsuccessful vPIC decode", () => {
    expect(() => mapVpicVehicle({ ErrorCode: "1", ErrorText: "Check digit failed" }, "BADVIN00000000000")).toThrow("Check digit failed");
  });

  it("returns the verified public listing for the supplied demonstration VIN", () => {
    expect(findPublicListing("WAUFAAF43PN018218")).toMatchObject({ askingPrice: 32990, odometerKm: 76243, province: "ON", listingId: "106685" });
  });

  it("returns the reviewed BMW listing, comparables and resilient decode", () => {
    const listing = findPublicListing("WBA8B7C37HA190314");
    expect(listing).toMatchObject({ askingPrice: 34690, odometerKm: 73677, province: "ON", listingId: "108558", marketModel: "3 Series" });
    expect(listing?.comparableEvidence?.comparables).toHaveLength(6);
    expect(listing?.comparableEvidence?.comparables.some((item) => item.vin === "WBA8B7C37HA190314")).toBe(false);
    expect(findVerifiedVehicle("WBA8B7C37HA190314")).toMatchObject({ year: 2017, make: "BMW", model: "340i", trim: "xDrive" });
  });
});
