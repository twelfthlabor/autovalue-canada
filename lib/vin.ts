const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export function normalizeVin(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17);
}

export type VinStatus = "empty" | "incomplete" | "invalid-characters" | "invalid-check-digit" | "valid";

export function validateNorthAmericanVin(value: string): VinStatus {
  const vin = normalizeVin(value);
  if (!vin) return "empty";
  if (/[IOQ]/.test(vin)) return "invalid-characters";
  if (vin.length < 17) return "incomplete";

  const total = [...vin].reduce((sum, char, index) => {
    const numeric = /\d/.test(char) ? Number(char) : TRANSLITERATION[char];
    return sum + numeric * WEIGHTS[index];
  }, 0);
  const remainder = total % 11;
  const expected = remainder === 10 ? "X" : String(remainder);
  return vin[8] === expected ? "valid" : "invalid-check-digit";
}

export const vinStatusCopy: Record<VinStatus, string> = {
  empty: "Optional · stays in your browser",
  incomplete: "Enter all 17 characters",
  "invalid-characters": "VINs do not use I, O or Q",
  "invalid-check-digit": "Check the VIN—its check digit does not match",
  valid: "17-character check digit verified",
};
