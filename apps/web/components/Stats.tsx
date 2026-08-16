import {getTranslations} from "next-intl/server";
import {createAdminClient} from "@/lib/supabase/admin";

export async function Stats() {
  const t = await getTranslations("Home.stats");
  const supabase = createAdminClient();

  const [aircraftResult, fleetTypesResult, airportsResult] = await Promise.all([
    supabase.from("aircraft").select("*", {count: "exact", head: true}),
    supabase
      .from("fleet_types")
      .select("*", {count: "exact", head: true})
      .eq("active", true),
    supabase
      .from("airports")
      .select("*", {count: "exact", head: true})
      .eq("active", true)
  ]);

  const unavailable =
    Boolean(aircraftResult.error) ||
    Boolean(fleetTypesResult.error) ||
    Boolean(airportsResult.error);

  const stats = [
    {
      value: unavailable ? "—" : String(aircraftResult.count ?? 0),
      key: "aircraft"
    },
    {
      value: unavailable ? "—" : String(fleetTypesResult.count ?? 0),
      key: "fleetTypes"
    },
    {
      value: unavailable ? "—" : String(airportsResult.count ?? 0),
      key: "destinations"
    },
    {value: "24/7", key: "operations"}
  ] as const;

  return (
    <section className="container stats" aria-label={t("aria")}>
      {stats.map((stat) => (
        <article className="stat" key={stat.key}>
          <strong>{stat.value}</strong>
          <span>{t(stat.key)}</span>
        </article>
      ))}
    </section>
  );
}
