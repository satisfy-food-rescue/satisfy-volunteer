import type { Metadata, Viewport } from "next";
import { Nunito_Sans, Suez_One } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Fonts are theme tokens too: swap these two imports to rebrand the type.
const headline = Suez_One({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const body = Nunito_Sans({
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
  themeColor: "#00c951",
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
