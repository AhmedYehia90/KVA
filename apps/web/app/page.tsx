import {localizeUi} from "@/i18n/localize-ui";
import {useLocale as useUiLocale} from "next-intl";
import { BookingWidget } from "@/components/BookingWidget";
import { Destinations } from "@/components/Destinations";
import { FleetPreview } from "@/components/FleetPreview";
import { Hero } from "@/components/Hero";
import { LiveFlights } from "@/components/LiveFlights";
import { News } from "@/components/News";
import { Partners } from "@/components/Partners";
import { Stats } from "@/components/Stats";

export const dynamic = "force-dynamic";

export default function Home() {
  const uiLocale = useUiLocale();

  return localizeUi((
    <main>
      <Hero />
      <BookingWidget />
      <Stats />
      <FleetPreview />
      <Destinations />
      <LiveFlights />
      <News />
      <Partners />
    </main>
  ), uiLocale);
}
