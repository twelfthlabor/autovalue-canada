import { describe, expect, it } from "vitest";
import { normalizeVin, validateNorthAmericanVin } from "./vin";

describe("VIN validation", () => {
  it("normalizes spacing and case", () => {
    expect(normalizeVin(" 2t3dwrfv3lw077677 ")).toBe("2T3DWRFV3LW077677");
  });

  it("validates a North American VIN check digit", () => {
    expect(validateNorthAmericanVin("2T3DWRFV3LW077677")).toBe("valid");
  });

  it("rejects forbidden characters and altered check digits", () => {
    expect(validateNorthAmericanVin("2T3DWRFQ3LW077677")).toBe("invalid-characters");
    expect(validateNorthAmericanVin("2T3DWRFV4LW077677")).toBe("invalid-check-digit");
  });
});
