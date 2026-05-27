import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "テニスサークル運営サポート",
    short_name: "Tennis Organizing",
    description: "テニス練習会向けのメンバー管理と対戦表作成アプリです。",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f8ff",
    theme_color: "#1d4ed8",
    lang: "ja",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
