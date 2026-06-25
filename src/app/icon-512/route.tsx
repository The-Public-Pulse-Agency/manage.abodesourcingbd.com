import { ImageResponse } from "next/og";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg,#d32f2f,#f0663f)",
          color: "#fff",
          fontSize: 180,
          fontWeight: 700,
          letterSpacing: -8,
          fontFamily: "monospace",
        }}
      >
        ABD
      </div>
    ),
    { width: 512, height: 512 },
  );
}
