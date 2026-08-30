import { ImageResponse } from "next/og";

export const alt = "AutoValue Canada — see the market behind the asking price";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", background: "#f2efe7", color: "#10120f", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 25, fontWeight: 700 }}>
        <div style={{ width: 38, height: 38, border: "2px solid #10120f", borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 10, height: 10, borderRadius: 99, background: "#ff4b23" }} /></div>
        AutoValue <span style={{ fontSize: 10, letterSpacing: 3 }}>CANADA</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 920 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, letterSpacing: 3, fontWeight: 700, marginBottom: 28 }}><span style={{ width: 35, height: 3, background: "#ff4b23" }} />CANADIAN USED-VEHICLE EVIDENCE</div>
        <div style={{ display: "flex", flexWrap: "wrap", fontFamily: "Georgia", fontSize: 88, lineHeight: .94, letterSpacing: -5 }}>See the market behind the&nbsp;<span style={{ color: "#ff4b23", fontStyle: "italic" }}>asking price.</span></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #10120f", paddingTop: 18, fontSize: 14 }}><span>624,678 vehicles in the source snapshot</span><span>Observed ranges · sample strength · explicit limits</span></div>
      <div style={{ position: "absolute", width: 430, height: 430, border: "2px solid rgba(16,18,15,.12)", borderRadius: 999, right: -170, top: 80 }} />
    </div>,
    size,
  );
}
