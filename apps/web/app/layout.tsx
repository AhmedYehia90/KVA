import type {Metadata} from "next";
import Link from "next/link";
import {NextIntlClientProvider, useTranslations} from "next-intl";
import {getLocale, getMessages} from "next-intl/server";
import "./globals.css";
import {Header} from "@/components/Header";
import {getDirection, type Locale} from "@/i18n/config";

export const metadata: Metadata = {
  title: {
    default: "Kalabsha Airlines",
    template: "%s | Kalabsha Airlines"
  },
  description:
    "Kalabsha Airlines is a modern virtual airline experience for pilots, dispatchers and aviation enthusiasts."
};

function Footer() {
  const t = useTranslations("Footer");

  return (
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
  );
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();

  return (
    <html lang={locale} dir={getDirection(locale)}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Header />
          {children}
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
