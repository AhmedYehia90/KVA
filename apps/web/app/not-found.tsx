import Link from "next/link";
import {getLocale} from "next-intl/server";
import {localizeUi} from "@/i18n/localize-ui";

export default async function NotFound() {
  const locale = await getLocale();
  return localizeUi(
    <main className="section"><section className="container">
      <h1>Page not found</h1>
      <p>The page is unavailable or you do not have access.</p>
      <Link className="button" href="/">Return home</Link>
    </section></main>, locale,
  );
}
