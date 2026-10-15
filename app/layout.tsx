import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import "./globals.css";

// Geist has no Vietnamese subset; Inter does, and is one variable file for every weight
const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "daybook",
  description: "Ghi đơn hàng, khách và việc cần nhắc",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi" className={cn("font-sans", inter.variable)}>
      <body>{children}</body>
    </html>
  );
}
