import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { THEME_SCRIPT } from "@/lib/theme";
import { getTheme } from "@/lib/theme-server";
import "./globals.css";

// Display — Geist carries headings and hero text, set tight and medium.
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Body / UI — Inter for everything readable: labels, tables, forms, prose.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Mono — reserved for record numbers and other machine-readable data.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "All In Logistics",
  description: "Freight forwarding operations platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  // Theme preference (src/lib/theme.ts). "system" is rendered as light and
  // corrected by THEME_SCRIPT before paint, so the dark tokens never flash.
  const theme = await getTheme();
  return (
    <html
      lang={locale}
      data-theme={theme === "system" ? "light" : theme}
      data-theme-pref={theme}
      suppressHydrationWarning
      className={`${geist.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface text-ink">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
