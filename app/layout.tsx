import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import { fontVariables } from "./fonts"
import { Providers } from "@/components/providers"
import "../styles/globals.css"

export const metadata: Metadata = {
  title: "PinGlass - Создай свои лучшие Фото",
  description: "Создавайте впечатляющие AI-фотографии для соцсетей, бизнеса и творческих проектов",
  generator: 'v0.app',
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // WCAG 2.1 - allow zoom for accessibility
  userScalable: true, // WCAG 2.1 Level AA requirement
  themeColor: "#fef7f8", // Light pink theme
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className={`${fontVariables} light`} suppressHydrationWarning>
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body className="font-sans antialiased">
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
