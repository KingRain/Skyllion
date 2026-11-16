import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const font = Space_Grotesk({ subsets: ["latin"] });

export const metadata = {
  title: "Skyllion · the daily ascent",
  description: "One in a skyllion. Give the rarest valid answer and climb from the runway to orbit.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={font.className}>{children}</body>
    </html>
  );
}
