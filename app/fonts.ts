/**
 * Font configuration using next/font for optimal loading
 *
 * Benefits:
 * - Zero layout shift (font is loaded before render)
 * - No flash of unstyled text (FOUT)
 * - Automatic font subsetting
 * - Self-hosted fonts (no external requests)
 */
import { Inter, Playfair_Display, JetBrains_Mono } from 'next/font/google'

// Primary sans-serif font - used for body text and UI
export const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
})

// Display font for headings and decorative text
export const playfair = Playfair_Display({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-display',
  display: 'swap',
  preload: false, // Only preload primary font
})

// Monospace font for code and numbers
export const jetbrains = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
})

// Combined class name for all font variables
export const fontVariables = `${inter.variable} ${playfair.variable} ${jetbrains.variable}`
