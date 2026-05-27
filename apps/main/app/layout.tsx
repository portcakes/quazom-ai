import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@quazom-ai/ui/globals.css";
import { Toaster } from "@quazom-ai/ui/components/ui/sonner";
import { TooltipProvider } from "@quazom-ai/ui/components/ui/tooltip";
import { TRPCReactProvider } from "@/trpc/client";
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { ThemeProvider } from "@/components/shared/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quazom — Your Personal Learning Companion",
  description: "Tell Quazom what you want to learn. We'll handcraft the modules, lessons, exercises, and quizzes—then keep you on track with a daily schedule, streaks, and notes that travel with you.",
  openGraph: {
    title: "Quazom — Your Personal Learning Companion",
    description: "Tell Quazom what you want to learn. We'll handcraft the modules, lessons, exercises, and quizzes—then keep you on track with a daily schedule, streaks, and notes that travel with you.",
    images: [
      { url: "https://www.quazom.ai/og-image.png" },
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <TRPCReactProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </TRPCReactProvider>
          <Toaster />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
