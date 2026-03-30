import type { Metadata } from 'next'
import { Inter, Plus_Jakarta_Sans, Fira_Code } from 'next/font/google'
import './globals.css'

// Inter — body text, cực kỳ phổ biến, dễ đọc trên màn hình
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600'],
})

// Plus Jakarta Sans — heading/display, hiện đại, rõ ràng
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700', '800'],
})

// Fira Code — mono cho mã pallet/barcode, dễ đọc hơn JetBrains
const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-code',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'WMS Staging Management',
  description: 'Warehouse Management — Staging Area Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${inter.variable} ${jakarta.variable} ${firaCode.variable}`}>
      <body>{children}</body>
    </html>
  )
}