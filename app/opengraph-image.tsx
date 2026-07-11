import { ImageResponse } from "next/og";

export const alt = "WallBang — The Next Generation Counter-Strike 2 Competitive Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0B0D10",
          padding: "64px",
          color: "#F3F5F7",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#E8242A",
            fontWeight: 600,
          }}
        >
          CS2 · India first
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2 }}>WallBang</div>
          <div style={{ fontSize: 34, color: "#9AA3AD", maxWidth: 900, lineHeight: 1.3 }}>
            The Next Generation Counter-Strike 2 Competitive Platform.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#9AA3AD" }}>wallbang.xyz</div>
      </div>
    ),
    { ...size },
  );
}
