import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "tennis-organizing-app",
  description: "テニス練習会向けのメンバー管理と対戦表作成アプリ",
  icons: {
    icon: [
      { url: "/favicon.ico?v=20260512-crop", sizes: "any" },
      { url: "/app-icon.png?v=20260512-crop", type: "image/png" },
    ],
    apple: "/app-icon.png?v=20260512-crop",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
