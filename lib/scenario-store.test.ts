import { describe, expect, it } from "vitest";
import {
  SCENARIO_STORAGE_KEY,
  decodeScenario,
  encodeScenario,
  loadScenarios,
  makeSavedScenario,
  readSavedScenario,
  saveScenarios,
  type ScenarioInputs,
  type ScenarioStorage,
} from "./scenario-store";

const INPUTS: ScenarioInputs = {
  province: "ON",
  make: "Toyota",
  model: "RAV4",
  year: "2021",
  odometer: "120000",
  askingPrice: "25000",
  conditionTier: "rough",
};

function fakeStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  const storage: ScenarioStorage & { data: Record<string, string> } = {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
  };
  return storage;
}

describe("scenario URL encoding", () => {
  it("round-trips every input through the query string", () => {
    const query = encodeScenario(INPUTS);
    expect(query).toBe("p=ON&mk=Toyota&md=RAV4&y=2021&km=120000&ask=25000&c=rough");
    expect(decodeScenario(query)).toEqual(INPUTS);
  });

  it("omits empty optional fields and decodes them back as empty", () => {
    const query = encodeScenario({ ...INPUTS, odometer: "", askingPrice: "" });
    expect(query).not.toContain("km=");
    expect(query).not.toContain("ask=");
    expect(decodeScenario(query)).toEqual({ ...INPUTS, odometer: "", askingPrice: "" });
  });

  it("round-trips spaces and special characters", () => {
    const inputs = { ...INPUTS, make: "Mercedes-Benz", model: "CX 5 & co" };
    expect(decodeScenario(encodeScenario(inputs))).toEqual(inputs);
  });

  it("accepts a leading question mark or a bare query", () => {
    expect(decodeScenario(`?${encodeScenario(INPUTS)}`)).toEqual(INPUTS);
    expect(decodeScenario(encodeScenario(INPUTS))).toEqual(INPUTS);
  });

  it("defaults a missing condition tier to average", () => {
    expect(decodeScenario("p=ON&mk=Toyota&md=RAV4&y=2021")).toEqual({ ...INPUTS, odometer: "", askingPrice: "", conditionTier: "average" });
  });

  it("ignores unknown query parameters", () => {
    expect(decodeScenario("p=ON&mk=Toyota&md=RAV4&y=2021&utm_source=x&s=1")).toEqual({ ...INPUTS, odometer: "", askingPrice: "", conditionTier: "average" });
  });

  it("rejects missing or malformed payloads", () => {
    const rejected = [
      "",
      "?",
      "?s=1",
      "p=ON&mk=Toyota&md=RAV4", // no year
      "p=Ontario&mk=Toyota&md=RAV4&y=2021",
      "p=ON&mk=&md=RAV4&y=2021",
      "p=ON&mk=Toyota&md=RAV4&y=nope",
      "p=ON&mk=Toyota&md=RAV4&y=1799",
      "p=ON&mk=Toyota&md=RAV4&y=2021&km=not-a-number",
      "p=ON&mk=Toyota&md=RAV4&y=2021&km=12.5",
      "p=ON&mk=Toyota&md=RAV4&y=2021&ask=-100",
      "p=ON&mk=Toyota&md=RAV4&y=2021&c=excellent",
      "p=ON&mk=Toyota&md=RAV4&y=2021&km=99999999",
      "p=%E0%A4%A&mk=Toyota&md=RAV4&y=2021",
      `p=ON&mk=${"x".repeat(41)}&md=RAV4&y=2021`,
    ];
    for (const search of rejected) {
      expect(decodeScenario(search), search).toBeUndefined();
    }
  });

  it("rejects province codes outside the app's province list", () => {
    for (const province of ["ZZ", "XX", "US", "ONT", "ab", ""]) {
      expect(decodeScenario(`p=${province}&mk=Toyota&md=RAV4&y=2021`), province).toBeUndefined();
    }
    for (const province of ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"]) {
      expect(decodeScenario(`p=${province}&mk=Toyota&md=RAV4&y=2021`)?.province, province).toBe(province);
    }
  });

  it("treats explicitly empty optional fields as not entered", () => {
    expect(decodeScenario("p=ON&mk=Toyota&md=RAV4&y=2021&km=&ask=")).toEqual({ ...INPUTS, odometer: "", askingPrice: "", conditionTier: "average" });
  });

  it("does not let query keys reach the prototype", () => {
    const decoded = decodeScenario("p=ON&mk=Toyota&md=__proto__&y=2021&__proto__=polluted");
    expect(decoded?.model).toBe("__proto__");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("scenario storage", () => {
  it("round-trips a saved scenario under the versioned key", () => {
    const storage = fakeStorage();
    const scenario = makeSavedScenario(INPUTS, 28400);
    expect(scenario.id).toBeTruthy();
    expect(Number.isFinite(scenario.savedAt)).toBe(true);
    expect(saveScenarios([scenario], storage)).toBe(true);
    expect(Object.keys(storage.data)).toEqual([SCENARIO_STORAGE_KEY]);
    expect(loadScenarios(storage)).toEqual([scenario]);
  });

  it("keeps the newest scenario first and drops nothing valid", () => {
    const older = { ...makeSavedScenario(INPUTS, 1000), savedAt: 1000 };
    const newer = { ...makeSavedScenario(INPUTS, 2000), savedAt: 2000 };
    const storage = fakeStorage({ [SCENARIO_STORAGE_KEY]: JSON.stringify([older, newer]) });
    expect(loadScenarios(storage).map((scenario) => scenario.id)).toEqual([newer.id, older.id]);
  });

  it("returns an empty list for corrupted or old payloads", () => {
    const corrupted = [
      "not json",
      "{}",
      "42",
      JSON.stringify([null, 42, "x", {}]),
      JSON.stringify([{ id: "a", inputs: { ...INPUTS, year: "" } }]),
      JSON.stringify([{ id: "a" }]), // version 0 shape
      JSON.stringify([{ version: 0, province: "ON", make: "Toyota", model: "RAV4", year: "2021" }]),
    ];
    for (const raw of corrupted) {
      const storage = fakeStorage({ [SCENARIO_STORAGE_KEY]: raw });
      expect(loadScenarios(storage), raw).toEqual([]);
    }
  });

  it("ignores data stored under an older key", () => {
    const scenario = makeSavedScenario(INPUTS, 28400);
    const storage = fakeStorage({ "autovalue.scenarios.v0": JSON.stringify([scenario]) });
    expect(SCENARIO_STORAGE_KEY).toBe("autovalue.scenarios.v1");
    expect(loadScenarios(storage)).toEqual([]);
  });

  it("keeps valid entries when one stored scenario is corrupted", () => {
    const scenario = makeSavedScenario(INPUTS, 28400);
    const storage = fakeStorage({ [SCENARIO_STORAGE_KEY]: JSON.stringify([scenario, { id: "broken" }]) });
    expect(loadScenarios(storage)).toEqual([scenario]);
  });

  it("survives storage that is unavailable or throws", () => {
    expect(loadScenarios(undefined)).toEqual([]);
    expect(saveScenarios([makeSavedScenario(INPUTS)], undefined)).toBe(false);

    const throwing: ScenarioStorage = {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("quota"); },
    };
    expect(loadScenarios(throwing)).toEqual([]);
    expect(saveScenarios([makeSavedScenario(INPUTS)], throwing)).toBe(false);
  });

  it("keeps an estimate only when it is a usable number", () => {
    expect(readSavedScenario({ id: "a", savedAt: 1, inputs: INPUTS, estimate: 28400 })?.estimate).toBe(28400);
    expect(readSavedScenario({ id: "a", savedAt: 1, inputs: INPUTS, estimate: Number.NaN })?.estimate).toBeUndefined();
    expect(readSavedScenario({ id: "a", savedAt: 1, inputs: INPUTS, estimate: -5 })?.estimate).toBeUndefined();
    expect(makeSavedScenario(INPUTS, Number.POSITIVE_INFINITY).estimate).toBeUndefined();
  });
});
