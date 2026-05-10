import type { Metadata } from "next";
import { Libre_Baskerville, Lora, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next"

const libreBaskerville = Libre_Baskerville({
  variable: "--font-libre-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quazom — Personal curricula, built around you",
  description:
    "Tell Quazom what you want to learn and we'll craft a complete curriculum—modules, lessons, quizzes, and projects—then keep you on track with daily check-ins and streaks.",
  openGraph: {
    title: "Quazom — Personal curricula, built around you",
    description:
      "Tell Quazom what you want to learn and we'll craft a complete curriculum—modules, lessons, quizzes, and projects—then keep you on track with daily check-ins and streaks.",
    images: [
      { url: "https://quazom.ai/og-image.png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${libreBaskerville.variable} ${lora.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
      <Analytics />
    </html>
  );
}
