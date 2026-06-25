import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: -1,
          borderRadius: 7,
          fontFamily: "monospace",
        }}
      >
        ABD
      </div>
    ),
    { ...size },
  );
}
