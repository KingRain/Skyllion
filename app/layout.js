import { Coral_Pixels, Pixelify_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import "./theme.css";

const display = Coral_Pixels({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap", adjustFontFallback: false });
const text = Pixelify_Sans({ subsets: ["latin"], variable: "--font-text", display: "swap" });

export const metadata = {
  title: "Skyllion · the daily ascent",
  description: "One in a skyllion. Give the rarest valid answer and climb from the runway to orbit.",
};
// resizes-content: on Android the layout shrinks above the keyboard, so the answer dock stays visible.
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content", themeColor: "#1b365b" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head><link rel="preload" href="/game-background.svg" as="image" type="image/svg+xml" /></head>
      <body className={`${display.variable} ${text.variable}`}>{children}<Analytics /></body>
    </html>
  );
}
