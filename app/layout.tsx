import type { Metadata, Viewport } from "next";
import { DisablePageZoom } from "@/components/DisablePageZoom";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://chinatrip.ai";
const siteName = "ChinaTrip AI";
const siteDescription =
  "An AI travel assistant for foreign visitors in China, with practical help for itineraries, payments, transport, apps, food, and local situations.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ChinaTrip AI - AI Travel Guide for China",
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "ChinaTrip AI - AI Travel Guide for China",
    description: siteDescription,
    url: "/",
    siteName,
    type: "website",
    images: [
      {
        url: "/home-social.jpg",
        width: 1200,
        height: 630,
        alt: "ChinaTrip AI travel guide for China",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ChinaTrip AI - AI Travel Guide for China",
    description: siteDescription,
    images: ["/home-social.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#14243a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <DisablePageZoom />
        <WebVitalsReporter />
        {children}
      </body>
    </html>
  );
}
