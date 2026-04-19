import type { Metadata } from "next";
import { Playfair_Display, Outfit } from "next/font/google";
import "./globals.css";

const serifFont = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
});

const sansFont = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Director's Palette — Virtual Masterpiece",
  description: "A hand-crafted cinematic color grading tool. Extract palettes from film, grade imagery with GPU shaders, export production-ready LUTs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${serifFont.variable} ${sansFont.variable} h-full`}
    >
      {/* suppressHydrationWarning prevents hydration mismatch from browser extensions injecting attributes */}
      <body className="h-full" suppressHydrationWarning>{children}</body>
    </html>
  );
}
