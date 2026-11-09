import {localizeUi} from "@/i18n/localize-ui";
import {useLocale as useUiLocale} from "next-intl";
import {LiveFlights} from "@/components/LiveFlights";

export const dynamic = "force-dynamic";

export default function Page() {
  const uiLocale = useUiLocale();

  return localizeUi((
    <main>
      <LiveFlights />
    </main>
  ), uiLocale);
}
