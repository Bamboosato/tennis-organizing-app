import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { PwaSplashScreen } from "@/components/pwa/PwaSplashScreen";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { APP_ICON_192_SRC, APP_ICON_512_SRC } from "@/lib/constants/assets";
import "./globals.css";

export const metadata: Metadata = {
  title: "テニスサークル運営サポート",
  description: "テニス練習会向けのメンバー管理と対戦表作成アプリ",
  applicationName: "テニスサークル運営サポート",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "テニスサークル運営サポート",
  },
  icons: {
    icon: [
      {
        url: APP_ICON_192_SRC,
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: APP_ICON_512_SRC,
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: APP_ICON_192_SRC,
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <PwaSplashScreen />
        {children}
        <ServiceWorkerRegistration />
        <Analytics />
      </body>
    </html>
  );
}
