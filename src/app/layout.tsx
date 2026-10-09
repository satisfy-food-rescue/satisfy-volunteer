import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Fonts are theme tokens too: swap this import to rebrand the type. The 2026
// brand refresh sets everything in Montserrat, the logo font, so headings,
// labels and body text share one family.
const brand = Montserrat({
  variable: "--font-brand",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Satisfy Volunteers", template: "%s · Satisfy Volunteers" },
  description:
    "Volunteer roster, training and absences for Satisfy Food Rescue, Rangiora.",
  // The label under the icon when the site is added to a home screen, instead
  // of the current page's title.
  applicationName: "Satisfy",
  appleWebApp: { title: "Satisfy" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#106379",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-NZ"
      className={`${brand.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-center" closeButton />
      </body>
    </html>
  );
}
