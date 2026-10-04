import '@life-os/design-system/styles.css';
import '../globals.css';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getDirection, isLocale, locales } from '@/src/i18n/locales';
import { AppProviders } from '@/src/ui/providers/AppProviders';

export const metadata: Metadata = {
  title: 'Life OS',
  description: 'A family system for progressive independence.',
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return (
    <html lang={locale} dir={getDirection(locale)}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
