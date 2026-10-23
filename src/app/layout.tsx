import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AgriSentinel — Agentic Crop Health Intelligence",
  description:
    "Agentic crop health intelligence platform: autonomous telemetry monitoring, AI vision disease diagnosis, tool-grounded agronomy chatbot, and sustainability analytics for food security.",
  keywords: ["agriculture", "AI agent", "crop health", "precision farming", "food security", "sustainability", "NDVI", "plant disease detection"],
  authors: [{ name: "AgriSentinel Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "AgriSentinel — Agentic Crop Health Intelligence",
    description: "Autonomous crop health monitoring, AI diagnosis and sustainability analytics.",
    siteName: "AgriSentinel",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
