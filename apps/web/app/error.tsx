"use client";

import {useLocale} from "next-intl";
import {localizeUi} from "@/i18n/localize-ui";

export default function ErrorPage({reset}: {error: Error & {digest?: string}; reset: () => void}) {
  const locale = useLocale();
  return localizeUi(
    <main className="section"><section className="container" role="alert">
      <h1>Something went wrong</h1>
      <p>We could not load this page. Please try again.</p>
      <button className="button" type="button" onClick={reset}>Try again</button>
    </section></main>, locale,
  );
}
