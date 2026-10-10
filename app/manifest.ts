import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "התזונה שלי",
    short_name: "תזונה",
    description: "מעקב קלוריות וחלבון",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4ef",
    theme_color: "#f6f4ef",
    lang: "he",
    dir: "rtl",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
