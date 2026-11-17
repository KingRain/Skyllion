import { VT323 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const font = VT323({ weight: "400", subsets: ["latin"] });

export const metadata = {
  title: "Skyllion · the daily ascent",
  description: "One in a skyllion. Give the rarest valid answer and climb from the runway to orbit.",
};
// resizes-content: on Android the layout shrinks above the keyboard, so the answer dock stays visible.
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content", themeColor: "#060814" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={font.className}>{children}<Analytics /></body>
    </html>
  );
}
