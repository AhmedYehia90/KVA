"use client";

import {useLocale} from "next-intl";
import {useTransition} from "react";
import {
  localeNames,
  locales,
  type Locale
} from "@/i18n/config";

export function LanguageSelector() {
  const currentLocale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();

  function changeLocale(locale: Locale) {
    document.cookie = `KVA_LOCALE=${locale}; path=/; max-age=31536000; samesite=lax`;

    startTransition(() => {
      window.location.reload();
    });
  }

  return (
    <label className="languageSelector">
      <span className="srOnly">Display language</span>
      <select
        aria-label="Display language"
        value={currentLocale}
        disabled={isPending}
        onChange={(event) => changeLocale(event.target.value as Locale)}
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeNames[locale]}
          </option>
        ))}
      </select>
    </label>
  );
}
