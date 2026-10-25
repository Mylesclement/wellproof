import type { Metadata } from "next";
import { Archivo, JetBrains_Mono, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { PRODUCT_NAME } from "@/lib/brand";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], weight: ["500", "700", "800"] });
const sourceSans = Source_Sans_3({ variable: "--font-source-sans", subsets: ["latin"], weight: ["400", "600"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "600"] });

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "A verified production record for oil operators, built so lenders and partners can trust the numbers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${archivo.variable} ${sourceSans.variable} ${jetbrains.variable} antialiased`}>{children}</body>
    </html>
  );
}
