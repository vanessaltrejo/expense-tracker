import type { MetadataRoute } from "next";

/** Tells the phone the app's name, icon and colors, and to open it without browser bars. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pockets",
    short_name: "Pockets",
    description: "Cuánto debes y cuánto tienes libre de verdad.",
    lang: "es-MX",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f3ef",
    theme_color: "#1f4fa8",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
