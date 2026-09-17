// Saved checks and share links for one valuation scenario.
// Storage is versioned and every read is validated: a private-mode or quota
// failure, corrupted JSON or an older payload simply yields no saved scenarios.

import type { ConditionTier } from "./condition-model";

export type ScenarioInputs = {
  province: string;
  make: string;
  model: string;
  year: string;
  odometer: string;
  askingPrice: string;
  conditionTier: ConditionTier;
};

export type SavedScenario = {
  id: string;
  savedAt: number;
  inputs: ScenarioInputs;
  estimate?: number;
};

export type ScenarioStorage = Pick<Storage, "getItem" | "setItem">;

export const SCENARIO_STORAGE_KEY = "autovalue.scenarios.v1";

const CONDITION_TIERS: readonly ConditionTier[] = ["below-average", "rough", "average"];

// Short query keys keep a copied link readable and short.
const QUERY_KEYS: Record<keyof ScenarioInputs, string> = {
  province: "p",
  make: "mk",
  model: "md",
  year: "y",
  odometer: "km",
  askingPrice: "ask",
  conditionTier: "c",
};

const PROVINCE_CODE = /^[A-Z]{2}$/;
const MODEL_YEAR = /^(19[89]\d|20[0-3]\d)$/;
const MAX_TEXT = 40;

function text(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function isDistance(value: string) {
  return /^\d{1,7}$/.test(value);
}

/**
 * Whole-payload validation: every field the workbench can restore is checked,
 * optional fields may be absent but never invalid. Anything else is rejected so
 * a malformed payload is ignored instead of partially applied.
 */
export function normalizeScenarioInputs(raw: Record<string, unknown>): ScenarioInputs | undefined {
  const province = text(raw.province);
  const make = text(raw.make);
  const model = text(raw.model);
  const year = text(raw.year);
  if (!province || !PROVINCE_CODE.test(province)) return undefined;
  if (!make || make.length > MAX_TEXT || !model || model.length > MAX_TEXT) return undefined;
  if (!year || !MODEL_YEAR.test(year)) return undefined;
  const conditionTier = raw.conditionTier === undefined ? "average" : text(raw.conditionTier);
  if (!conditionTier || !CONDITION_TIERS.includes(conditionTier as ConditionTier)) return undefined;
  const odometer = text(raw.odometer);
  const askingPrice = text(raw.askingPrice);
  if (odometer !== undefined && !isDistance(odometer)) return undefined;
  if (askingPrice !== undefined && !isDistance(askingPrice)) return undefined;
  return {
    province,
    make,
    model,
    year,
    odometer: odometer ?? "",
    askingPrice: askingPrice ?? "",
    conditionTier: conditionTier as ConditionTier,
  };
}

export function encodeScenario(inputs: ScenarioInputs): string {
  const params = new URLSearchParams();
  for (const [field, key] of Object.entries(QUERY_KEYS) as Array<[keyof ScenarioInputs, string]>) {
    const value = inputs[field];
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function decodeScenario(search: string): ScenarioInputs | undefined {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return undefined;
  }
  const raw: Record<string, unknown> = {};
  for (const [field, key] of Object.entries(QUERY_KEYS) as Array<[keyof ScenarioInputs, string]>) {
    const value = params.get(key);
    if (value !== null) raw[field] = value;
  }
  return normalizeScenarioInputs(raw);
}

export function readSavedScenario(value: unknown): SavedScenario | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const id = text(record.id);
  const inputs = record.inputs && typeof record.inputs === "object" ? normalizeScenarioInputs(record.inputs as Record<string, unknown>) : undefined;
  if (!id || !inputs) return undefined;
  const savedAt = typeof record.savedAt === "number" && Number.isFinite(record.savedAt) ? record.savedAt : 0;
  const estimate = typeof record.estimate === "number" && Number.isFinite(record.estimate) && record.estimate > 0 ? record.estimate : undefined;
  return { id, savedAt, inputs, ...(estimate !== undefined ? { estimate } : {}) };
}

function browserStorage(): ScenarioStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function makeSavedScenario(inputs: ScenarioInputs, estimate?: number): SavedScenario {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: Date.now(),
    inputs,
    ...(estimate !== undefined && Number.isFinite(estimate) ? { estimate } : {}),
  };
}

export function loadScenarios(storage: ScenarioStorage | undefined = browserStorage()): SavedScenario[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(SCENARIO_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(readSavedScenario)
      .filter((scenario): scenario is SavedScenario => scenario !== undefined)
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export function saveScenarios(scenarios: SavedScenario[], storage: ScenarioStorage | undefined = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(scenarios));
    return true;
  } catch {
    return false;
  }
}
