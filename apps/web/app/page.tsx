import { BookingWidget } from "@/components/BookingWidget";
import { Destinations } from "@/components/Destinations";
import { FleetPreview } from "@/components/FleetPreview";
import { Hero } from "@/components/Hero";
import { LiveFlights } from "@/components/LiveFlights";
import { News } from "@/components/News";
import { Partners } from "@/components/Partners";
import { Stats } from "@/components/Stats";

export default function Home() {
  return (
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
  );
}
