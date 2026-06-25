import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ABD Sourcing",
    short_name: "ABD",
    description: "Order & merchandising management — ABD Sourcing",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f9",
    theme_color: "#d32f2f",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
