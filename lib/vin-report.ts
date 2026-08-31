import type { ComparableObservation } from "./market";

export type VinVehicle = {
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  bodyClass: string;
  driveType: string;
  transmission: string;
  cylinders?: number;
  displacementL?: number;
  fuelType: string;
  plantCountry: string;
  source: "NHTSA vPIC";
};

export type ComparableEvidence = {
  source: string;
  sourceUrl: string;
  capturedAt: string;
  scope: string;
  comparables: ComparableObservation[];
};

export type ListingEvidence = {
  source: string;
  sourceUrl: string;
  listingId: string;
  verifiedAt: string;
  seller?: string;
  sellerTrim: string;
  marketModel?: string;
  province: string;
  askingPrice: number;
  previousPrice?: number;
  odometerKm: number;
  transmission: string;
  fuel: string;
  highlights: Array<{ label: string; attribution: string }>;
  comparableEvidence?: ComparableEvidence;
};

export type VinLookupResponse = {
  vehicle: VinVehicle;
  listing?: ListingEvidence;
  notice: string;
};

type VpicRow = Record<string, string>;

export function mapVpicVehicle(row: VpicRow, vin: string): VinVehicle {
  const year = Number(row.ModelYear);
  if (!year || !row.Make || !row.Model || (row.ErrorCode && row.ErrorCode !== "0")) {
    throw new Error(row.ErrorText || "The VIN could not be decoded cleanly.");
  }

  return {
    vin,
    year,
    make: row.Make.toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase()).replace(/\bBmw\b/, "BMW"),
    model: row.Model,
    trim: row.Trim || row.Series || "Not encoded",
    bodyClass: row.BodyClass || "Not encoded",
    driveType: row.DriveType || "Not encoded",
    transmission: row.TransmissionStyle || "Not encoded",
    cylinders: Number(row.EngineCylinders) || undefined,
    displacementL: Number(row.DisplacementL) || undefined,
    fuelType: row.FuelTypePrimary || "Not encoded",
    plantCountry: row.PlantCountry || "Not encoded",
    source: "NHTSA vPIC",
  };
}

const LISTINGS: Record<string, ListingEvidence> = {
  WAUFAAF43PN018218: {
    source: "Clutch",
    sourceUrl: "https://www.clutch.ca/vehicles/106685",
    listingId: "106685",
    verifiedAt: "2026-08-30",
    sellerTrim: "Technik 45",
    province: "ON",
    askingPrice: 32990,
    previousPrice: 35690,
    odometerKm: 76243,
    transmission: "Automatic AWD",
    fuel: "Gasoline / mild hybrid",
    highlights: [
      { label: "No accidents reported", attribution: "CARFAX summary shown by seller" },
      { label: "Single owner reported", attribution: "CARFAX summary shown by seller" },
      { label: "0 open recalls found", attribution: "Clutch inspection page" },
      { label: "Last registered in Ontario", attribution: "Clutch inspection page" },
      { label: "Not previously stolen", attribution: "Clutch inspection page" },
      { label: "210-point inspection", attribution: "Clutch certification claim" },
    ],
  },
  WBA8B7C37HA190314: {
    source: "CarGurus marketplace snapshot",
    sourceUrl: "https://www.cargurus.ca/Cars/l-Used-2017-BMW-3-Series-340i-xDrive-Sedan-AWD-t69355",
    listingId: "108558",
    verifiedAt: "2026-08-31",
    seller: "Clutch",
    sellerTrim: "340i xDrive Sedan",
    marketModel: "3 Series",
    province: "ON",
    askingPrice: 34690,
    previousPrice: 36090,
    odometerKm: 73677,
    transmission: "Automatic AWD",
    fuel: "Gasoline",
    highlights: [
      { label: "Safety Certified", attribution: "Carpages seller listing" },
      { label: "Full inspection report advertised", attribution: "Clutch seller description" },
      { label: "Free CARFAX report advertised", attribution: "Clutch seller description" },
      { label: "Ontario registration disclosed", attribution: "Carpages seller listing" },
      { label: "Price changed across snapshots", attribution: "$36,090 → $35,190 → $34,690 observed" },
    ],
    comparableEvidence: {
      source: "CarGurus public inventory snapshots",
      sourceUrl: "https://www.cargurus.ca/Cars/l-Used-2017-BMW-3-Series-340i-xDrive-Sedan-AWD-t69355",
      capturedAt: "2026-08-31",
      scope: "2017 BMW 340i xDrive Sedan AWD, automatic, Canada; subject listing excluded",
      comparables: [
        { vin: "WBA8B7C34HA190304", askingPrice: 32488, odometerKm: 70000, location: "Mississauga, ON", transmission: "Automatic", observedAt: "2026-08-25" },
        { vin: "WBA8B7C53HK858282", askingPrice: 25888, odometerKm: 158557, location: "Wetaskiwin, AB", transmission: "Automatic", observedAt: "2026-08-31" },
        { vin: "WBA8B7C39HA190041", askingPrice: 20990, odometerKm: 167000, location: "Lower Sackville, NS", transmission: "Automatic", observedAt: "2026-08-31" },
        { vin: "WBA8B7C35HA189968", askingPrice: 24999, odometerKm: 143962, location: "Kitchener, ON", transmission: "Automatic", observedAt: "2026-08-31" },
        { vin: "WBA8B7C35HK858427", askingPrice: 28995, odometerKm: 147537, location: "Cambridge, ON", transmission: "Automatic", observedAt: "2026-08-31" },
        { vin: "WBA8B7C57HK703878", askingPrice: 30690, odometerKm: 108893, location: "Canada", transmission: "Automatic", observedAt: "2026-08-31" },
      ],
    },
  },
};

const VERIFIED_VEHICLES: Record<string, VinVehicle> = {
  WAUFAAF43PN018218: {
    vin: "WAUFAAF43PN018218",
    year: 2023,
    make: "Audi",
    model: "A4",
    trim: "S Line quattro Prestige",
    bodyClass: "Sedan/Saloon",
    driveType: "AWD/All-Wheel Drive",
    transmission: "Automatic",
    cylinders: 4,
    displacementL: 2,
    fuelType: "Gasoline",
    plantCountry: "Germany",
    source: "NHTSA vPIC",
  },
  WBA8B7C37HA190314: {
    vin: "WBA8B7C37HA190314",
    year: 2017,
    make: "BMW",
    model: "340i",
    trim: "xDrive",
    bodyClass: "Sedan/Saloon",
    driveType: "AWD/All-Wheel Drive",
    transmission: "Not encoded",
    cylinders: 6,
    displacementL: 3,
    fuelType: "Gasoline",
    plantCountry: "Germany",
    source: "NHTSA vPIC",
  },
};

export function findPublicListing(vin: string) {
  return LISTINGS[vin];
}

export function findVerifiedVehicle(vin: string) {
  return VERIFIED_VEHICLES[vin];
}
