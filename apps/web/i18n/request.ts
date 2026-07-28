import {cookies, headers} from "next/headers";
import {getRequestConfig} from "next-intl/server";
import {defaultLocale, isLocale, type Locale} from "./config";

function getBrowserLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;

  const candidates = acceptLanguage
    .split(",")
    .map((part) => part.trim().split(";")[0]?.split("-")[0])
    .filter(Boolean);

  return candidates.find((candidate) => isLocale(candidate)) ?? defaultLocale;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requestHeaders = await headers();

  const savedLocale = cookieStore.get("KVA_LOCALE")?.value;
  const locale = isLocale(savedLocale)
    ? savedLocale
    : getBrowserLocale(requestHeaders.get("accept-language"));

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});
