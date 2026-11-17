import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--display" });
const body = Inter({ subsets: ["latin"], variable: "--body" });

export const metadata = {
  title: "Skyllion · the daily ascent",
  description: "One in a skyllion. Give the rarest valid answer and climb from the runway to orbit.",
};
// resizes-content: on Android the layout shrinks above the keyboard, so the answer dock stays visible.
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content", themeColor: "#fdfbf9" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
