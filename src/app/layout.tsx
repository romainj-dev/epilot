import React from 'react'
import type { Viewport } from 'next'
import { Geist } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { NextIntlClientProvider } from 'next-intl'
import { Toaster } from '@/components/ui/toast/Toaster'
import { QueryProvider } from '@/providers/QueryProvider'
import { defaultLocale } from '@/lib/i18n'
import './globals.css'
import { getTranslations } from 'next-intl/server'
import styles from './layout.module.scss'

const geist = Geist({
  subsets: ['latin'],
  fallback: ['Geist Fallback', 'system-ui', 'sans-serif'],
  weight: ['300', '400', '500', '700'],
})

export async function generateMetadata() {
  const t = await getTranslations('root')

  return {
    title: t('meta.title'),
    description: t('meta.description'),
  }
}

export const viewport: Viewport = {
  themeColor: '#0a0a14',
  colorScheme: 'dark',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang={defaultLocale}>
      <body className={`${geist.className} ${styles.body}`}>
        <QueryProvider>
          <NextIntlClientProvider>
            {children}
            <Toaster />
            <Analytics />
          </NextIntlClientProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
