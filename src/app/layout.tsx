import type { Metadata, Viewport } from "next"
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google"
import "./globals.css"

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
})
const sans = Source_Sans_3({ variable: "--font-sans", subsets: ["latin", "latin-ext"] })

export const metadata: Metadata = {
  title: "Livada · Host stand",
  description:
    "The host stand of Livada, a fictional restaurant in Cluj-Napoca, where an AI maître d' seats parties, merges tables and moves reservations by working the real controls.",
}

export const viewport: Viewport = { themeColor: "#1f3a2e" }

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
