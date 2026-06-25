import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 62,
          fontWeight: 700,
          letterSpacing: -3,
          fontFamily: "monospace",
        }}
      >
        ABD
      </div>
    ),
    { ...size },
  );
}
