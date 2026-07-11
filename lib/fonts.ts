import { Geist_Mono, Sora } from "next/font/google";

/**
 * next/font self-hosts at build time (identical on localhost and Vercel).
 * Syne was dropped for the wordmark — its lowercase "g" descender clips at display sizes.
 */
export const fontSans = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});
