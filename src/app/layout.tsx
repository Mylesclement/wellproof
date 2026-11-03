import type { Metadata } from "next";
// Fonts ship with the app instead of being fetched from Google at build time,
// so builds don't depend on an outside service.
import "@fontsource-variable/archivo";
import "@fontsource-variable/source-sans-3";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: `${PRODUCT_NAME}: proof you can bank on`, template: `%s · ${PRODUCT_NAME}` },
  description: "A verified production record for oil operators, built so lenders and partners can trust the numbers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
