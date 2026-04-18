import type { Metadata } from "next";
import { Architects_Daughter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const handFont = Architects_Daughter({
  variable: "--font-hand",
  weight: "400",
  subsets: ["latin"],
});

const monoFont = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Director's Palette — The Sketchbook Workstation",
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
      className={`${handFont.variable} ${monoFont.variable} h-full`}
    >
      {/* suppressHydrationWarning prevents hydration mismatch from browser extensions injecting attributes */}
      <body className="h-full" suppressHydrationWarning>{children}</body>
    </html>
  );
}
