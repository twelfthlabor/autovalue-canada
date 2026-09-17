import { ImageResponse } from "next/og";
import manifest from "@/public/data/manifest.json";

export const alt = "AutoValue Canada — Get a feel for the price.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", background: "#005da8", color: "white", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 64px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 700 }}>AutoValue <span style={{ fontSize: 12, letterSpacing: 3, color: "#cce5fa" }}>CANADA</span></div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 77, letterSpacing: -4, lineHeight: 1.06 }}><span>Get a feel</span><span style={{ color: "#b9e0ff" }}>for the price.</span></div>
      <svg width="1072" height="86" viewBox="0 0 1072 86"><path d="M0 14H190L260 24 320 24 410 38 500 40 600 55 720 59 820 66 950 69 1072 74" stroke="#b9e0ff" strokeWidth="3" fill="none"/><path d="M410 0V85" stroke="white"/><circle cx="410" cy="38" r="7" fill="white"/></svg>
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #ffffff40", paddingTop: 18, fontSize: 15, color: "#cce5fa" }}><span>{manifest.usedVehiclesRepresented.toLocaleString("en-CA")} vehicles represented</span><span>Explore the asking price. See what moves.</span></div>
    </div>, size,
  );
}
