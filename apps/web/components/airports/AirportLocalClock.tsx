"use client";

import {useEffect, useMemo, useState} from "react";

export default function AirportLocalClock({
  timezone,
}: {
  timezone?: string | null;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const formatter = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone || "UTC",
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: "UTC",
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }
  }, [timezone]);

  return (
    <span suppressHydrationWarning>
      {formatter.format(now)}
      {timezone ? ` · ${timezone}` : " · UTC"}
    </span>
  );
}
