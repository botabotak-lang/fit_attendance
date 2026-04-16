import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FIT 勤怠管理",
    short_name: "FIT勤怠",
    description: "FIT社向け勤怠打刻・月次集計",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/fit-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
