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

/**
 * Listing facts are deliberately not kept in a local VIN registry.
 * VINs identify a vehicle; they do not contain a seller's current asking
 * price, odometer, inspection report or listing status. A production
 * connector can populate this shape from a licensed provider at request
 * time, but AutoValue must never present a stale scraped snapshot as live
 * inventory.
 */
export type ListingEvidence = {
  source: string;
  sourceUrl: string;
  listingId?: string;
  observedAt: string;
  seller?: string;
  sellerTrim?: string;
  province?: string;
  askingPrice?: number;
  odometerKm?: number;
  transmission?: string;
  fuel?: string;
  highlights?: Array<{ label: string; attribution: string }>;
};

export type VinLookupResponse = {
  vehicle: VinVehicle;
  /** Populated only by a future live/licensed inventory connector. */
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
