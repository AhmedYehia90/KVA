import {localizeMetadata} from "@/i18n/metadata";

import {localizeUi} from "@/i18n/localize-ui";
import {useLocale as useUiLocale} from "next-intl";
import {getLocale as getUiLocale} from "next-intl/server";
import type {Metadata} from "next";
import Link from "next/link";
import {NextIntlClientProvider, useTranslations} from "next-intl";
import {getLocale, getMessages} from "next-intl/server";
import "./globals.css";
import "./kva-premium-design-system.css";
import "./globals-auth.css";
import "@/styles/rtl.css";
import {Header} from "@/components/Header";
import {LocalizedValidation} from "@/components/LocalizedValidation";
import {getDirection, type Locale} from "@/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata({
  title: {
    default: "Kalabsha Airlines",
    template: "%s | Kalabsha Airlines"
  },
  description:
    "Kalabsha Airlines is a modern virtual airline experience for pilots, dispatchers and aviation enthusiasts."
}, await getUiLocale());
}

function Footer() {
  const uiLocale = useUiLocale();

  const t = useTranslations("Footer");

  return localizeUi((
    <footer className="footer">
      <div className="container">
        <div className="footerGrid">
          <div>
            <strong>Kalabsha Airlines</strong>
            <p className="muted">{t("description")}</p>
          </div>

          <div className="footerLinks" aria-label={t("navigationAria")}>
            <Link href="/fleet">{t("fleet")}</Link>
            <Link href="/live-flights">{t("liveFlights")}</Link>
            <Link href="/pilots">{t("pilots")}</Link>
            <Link href="/about">{t("about")}</Link>
          </div>
        </div>

        <div className="footerBottom">
          <span>{t("copyright")}</span>
          <span>Fly To Dreams</span>
        </div>
      </div>
    </footer>
  ), uiLocale);
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const uiLocale = await getUiLocale();

  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();

  return localizeUi((
    <html lang={locale} dir={getDirection(locale)}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <LocalizedValidation />
          <Header />
          {children}
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  ), uiLocale);
}
