import type { Metadata } from "next";
import { Anton, Montserrat, Caveat } from "next/font/google";
import "./globals.css";

// DTE 2027 brand fonts (see design/brand.css):
// Anton — uppercase display headlines only
// Montserrat — all body and UI
// Caveat — short handwritten leads
const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-caveat",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tickets.danceteacherexpo.com.au"),
  title: "Tickets — Dance Teacher Expo 2027",
  // Pre-launch: keep the deployed test site out of search results. Remove at go-live.
  robots: { index: false, follow: false },
  description:
    "Australia's biggest professional development event for dance teachers and studio owners. Sat 17 & Sun 18 April 2027, Grand Pavilion, Rosehill Gardens, Sydney. Tickets open soon.",
  openGraph: {
    title: "Dance Teacher Expo 2027 — Tickets coming soon",
    description:
      "Two days, 50+ sessions, 1,000 dance educators. New home at Rosehill Gardens. Tickets open soon.",
    url: "https://tickets.danceteacherexpo.com.au",
    siteName: "Dance Teacher Expo 2027",
    locale: "en_AU",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-AU"
      className={`${anton.variable} ${montserrat.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
