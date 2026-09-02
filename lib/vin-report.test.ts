import { describe, expect, it } from "vitest";
import { mapVpicVehicle } from "./vin-report";

describe("VIN report mapping", () => {
  it("maps clean vPIC fields into a compact vehicle report", () => {
    const vehicle = mapVpicVehicle({ ModelYear: "2023", Make: "AUDI", Model: "A4", Trim: "S Line quattro Prestige", BodyClass: "Sedan/Saloon", DriveType: "AWD/All-Wheel Drive", TransmissionStyle: "Automatic", EngineCylinders: "4", DisplacementL: "2.0", FuelTypePrimary: "Gasoline", PlantCountry: "GERMANY", ErrorCode: "0" }, "WAUFAAF43PN018218");
    expect(vehicle).toMatchObject({ year: 2023, make: "Audi", model: "A4", cylinders: 4, displacementL: 2 });
  });

  it("rejects an unsuccessful vPIC decode", () => {
    expect(() => mapVpicVehicle({ ErrorCode: "1", ErrorText: "Check digit failed" }, "BADVIN00000000000")).toThrow("Check digit failed");
  });

});
