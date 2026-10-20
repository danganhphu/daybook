import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import { Toaster } from "@/shared/ui/toast/toaster";

import { appDescription, appName, canvasColor } from "./identity";

import "@/shared/ui/styles/main.scss";

// Geist has no Vietnamese subset; Inter does, and is one variable file for every weight
const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: appName,
  description: appDescription,
  // Dark status bar text on the light page, not drawn over it
  appleWebApp: { title: appName, statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: canvasColor };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi" className={inter.variable}>
      <body>
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
