"use client";

import { animate } from "animejs";
import { useEffect, useRef } from "react";
import { CONDITION_TIER_LABEL } from "@/lib/condition-model";
import { formatCad, formatNumber } from "@/lib/market";
import type { SavedScenario } from "@/lib/scenario-store";

type SavedScenariosProps = {
  scenarios: SavedScenario[];
  notice: string;
  disabled?: boolean;
  onSave: () => void;
  onCopyLink: () => void;
  onRestore: (scenario: SavedScenario) => void;
  onDelete: (id: string) => void;
};

export function SavedScenarios({ scenarios, notice, disabled, onSave, onCopyLink, onRestore, onDelete }: SavedScenariosProps) {
  const noticeRef = useRef<HTMLSpanElement>(null);

  // One brief reveal per confirmation; reduced motion renders it in place and
  // the estimate text is never animated.
  useEffect(() => {
    const element = noticeRef.current;
    if (!element || !notice) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    animate(element, { opacity: [0, 1], translateY: [-4, 0], duration: 240, ease: "out(3)" });
  }, [notice]);

  return (
    <section
      data-testid="saved-scenarios"
      aria-labelledby="saved-scenarios-title"
      style={{ marginTop: 18, padding: "16px 20px", background: "white", border: "1px solid transparent", borderRadius: "var(--radius-lg)", boxShadow: "var(--keyline), var(--shadow-card)" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p className="kicker" style={{ margin: 0 }}>SAVED CHECKS</p>
          <h2 id="saved-scenarios-title" style={{ margin: "3px 0 0", fontSize: 15, fontWeight: 650, letterSpacing: "-.3px" }}>Save a check, or share it.</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span ref={noticeRef} role="status" style={{ fontSize: 11, color: "var(--ink-2)" }}>{notice}</span>
          <button className="pin-button" type="button" disabled={disabled} onClick={onSave}><span aria-hidden="true">＋</span> Save this check</button>
          <button className="pin-button" type="button" disabled={disabled} onClick={onCopyLink}>Copy link</button>
        </div>
      </div>
      {scenarios.length === 0 ? <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--muted)" }}>No saved checks yet. Save one to compare scenarios later.</p> : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {scenarios.map((scenario) => {
            const { inputs } = scenario;
            const title = `${inputs.year} ${inputs.make} ${inputs.model}`;
            return (
              <li key={scenario.id} data-testid="saved-scenario" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 13, fontWeight: 550 }}>{title}</strong>
                  <small style={{ display: "block", fontSize: 10, color: "var(--muted)" }}>
                    {inputs.province} · {inputs.odometer ? `${formatNumber(Number(inputs.odometer))} km` : "market median km"} · {CONDITION_TIER_LABEL[inputs.conditionTier]} · ask {inputs.askingPrice ? formatCad(Number(inputs.askingPrice)) : "not entered"}
                  </small>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
                  <span style={{ textAlign: "right" }}>
                    <strong data-testid="saved-estimate" style={{ display: "block", fontSize: 15, fontWeight: 550, fontVariantNumeric: "tabular-nums" }}>{scenario.estimate ? formatCad(scenario.estimate) : "—"}</strong>
                    <small style={{ fontSize: 9, color: "var(--muted)" }}>estimate</small>
                  </span>
                  <button type="button" className="text-button" aria-label={`Restore ${title}`} onClick={() => onRestore(scenario)}>Restore</button>
                  <button type="button" className="text-button" aria-label={`Delete ${title}`} onClick={() => onDelete(scenario.id)}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
