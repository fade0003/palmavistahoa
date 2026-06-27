import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Palma Vista HOA — A MetroWest Community",
  description:
    "Official homeowners association portal for Palma Vista, a Mediterranean-style community in MetroWest, Orlando, Florida. Access governing documents, pay dues, and stay connected.",
  keywords: [
    "Palma Vista HOA",
    "MetroWest",
    "Orlando",
    "HOA",
    "homeowners association",
    "community documents",
  ],
  openGraph: {
    title: "Palma Vista HOA — A MetroWest Community",
    description:
      "Official portal for Palma Vista homeowners. Access documents, pay dues, and manage your account.",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-sans antialiased bg-slate-50 text-slate-800">
        {children}
      </body>
    </html>
  );
}
