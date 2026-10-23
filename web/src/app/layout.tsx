import type { Metadata, Viewport } from "next";
import { Geist_Mono, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Record each room on your phone. AI measures your furniture, estimates your shipment volume and lists the customs documents for your route.";

export const metadata: Metadata = {
  title: "MOVERSLY",
  description: DESCRIPTION,
  openGraph: { title: "MOVERSLY: measure your home with your phone", description: DESCRIPTION, siteName: "MOVERSLY", type: "website" },
  twitter: { card: "summary", title: "MOVERSLY: measure your home with your phone", description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f7fc",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${manrope.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
