import { Geist_Mono, Sora, Syne } from "next/font/google";

/**
 * next/font self-hosts these at build time (works the same on localhost and Vercel).
 * Apply `.variable` on <html> and prefer `.className` where a face must be guaranteed.
 */
export const fontSans = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export const fontDisplay = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["600", "700", "800"],
});

export const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});
