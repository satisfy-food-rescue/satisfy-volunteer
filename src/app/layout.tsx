import type { Metadata, Viewport } from "next";
import { Montserrat, Roboto_Slab } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Fonts are theme tokens too: swap these two imports to rebrand the type.
// Brand Guidelines: Montserrat (the logo font) for headings and subheadings,
// Stag for body text. Stag is a commercial face with no web licence yet, so
// Roboto Slab stands in; with a licensed file, swap it for next/font/local.
const headline = Montserrat({
  variable: "--font-headline",
  subsets: ["latin"],
  display: "swap",
});

const body = Roboto_Slab({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Satisfy Volunteers", template: "%s · Satisfy Volunteers" },
  description:
    "Volunteer roster, training and absences for Satisfy Food Rescue, Rangiora.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#00a551",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-NZ"
      className={`${headline.variable} ${body.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-center" closeButton />
      </body>
    </html>
  );
}
