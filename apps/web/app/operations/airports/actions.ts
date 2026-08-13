"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireOperationsConsoleAdmin} from "@/lib/operations/console-auth";
import {createAdminClient} from "@/lib/supabase/admin";

const ORG = "kalabsha-airlines";

function url(kind: "message" | "error", value: string) {
  return `/operations/airports?${kind}=${encodeURIComponent(value)}`;
}

function text(fd: FormData, key: string, required = false) {
  const value = fd.get(key);
  if (typeof value !== "string") {
    if (required) throw new Error(`${key} is required`);
    return "";
  }
  const cleaned = value.trim();
  if (required && !cleaned) throw new Error(`${key} is required`);
  return cleaned;
}

function dateTime(fd: FormData, key: string) {
  const value = text(fd, key);
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`${key} must be a valid date/time`);
  }
  return parsed.toISOString();
}

function id(fd: FormData, key: string) {
  const value = text(fd, key, true);
  return value;
}
async function airportIcaoById(
  admin: ReturnType<typeof createAdminClient>,
  airportId: string,
) {
  const {data, error} = await admin
    .from("airports")
    .select("icao_code")
    .eq("id", airportId)
    .maybeSingle();

  if (error) throw error;
  return data?.icao_code ?? "";
}

async function airportIcaoByNoticeId(
  admin: ReturnType<typeof createAdminClient>,
  noticeId: string,
) {
  const {data, error} = await admin
    .from("airport_world_notices")
    .select("airport:airports(icao_code)")
    .eq("id", noticeId)
    .maybeSingle();

  if (error) throw error;

  const airport = Array.isArray(data?.airport)
    ? data?.airport[0]
    : data?.airport;

  return airport?.icao_code ?? "";
}

function refresh(icao?: string) {
  revalidatePath("/operations/airports");
  revalidatePath("/airports");
  if (icao) revalidatePath(`/airports/${icao}`);
}

export async function createAirportNoticeAction(fd: FormData) {
  const user = await requireOperationsConsoleAdmin();
  const admin = createAdminClient();
  const airportId = id(fd, "airportId");
  const icao = await airportIcaoById(admin, airportId);

  try {
    const {error} = await admin.rpc("create_airport_world_notice", {
      p_airport_id: airportId,
      p_organization_id: ORG,
      p_category: text(fd, "category", true),
      p_severity: text(fd, "severity", true),
      p_title: text(fd, "title", true),
      p_message: text(fd, "message", true),
      p_starts_at: dateTime(fd, "startsAt"),
      p_ends_at: dateTime(fd, "endsAt"),
      p_source_label: text(fd, "sourceLabel"),
      p_source_reference: text(fd, "sourceReference"),
      p_actor_id: user.id,
    });

    if (error) throw error;
  } catch (error) {
    redirect(
      url(
        "error",
        error instanceof Error ? error.message : "Unable to create airport notice.",
      ),
    );
  }

  refresh(icao);
  redirect(url("message", "Airport notice draft created."));
}

export async function updateAirportNoticeAction(fd: FormData) {
  const user = await requireOperationsConsoleAdmin();
  const admin = createAdminClient();
  const noticeId = id(fd, "noticeId");
  const icao = await airportIcaoByNoticeId(admin, noticeId);

  try {
    const {error} = await admin.rpc("update_airport_world_notice", {
      p_notice_id: noticeId,
      p_category: text(fd, "category", true),
      p_severity: text(fd, "severity", true),
      p_title: text(fd, "title", true),
      p_message: text(fd, "message", true),
      p_starts_at: dateTime(fd, "startsAt"),
      p_ends_at: dateTime(fd, "endsAt"),
      p_source_label: text(fd, "sourceLabel"),
      p_source_reference: text(fd, "sourceReference"),
      p_actor_id: user.id,
    });

    if (error) throw error;
  } catch (error) {
    redirect(
      url(
        "error",
        error instanceof Error ? error.message : "Unable to update airport notice.",
      ),
    );
  }

  refresh(icao);
  redirect(url("message", "Airport notice updated."));
}

export async function setAirportNoticeLifecycleAction(fd: FormData) {
  const user = await requireOperationsConsoleAdmin();
  const admin = createAdminClient();
  const noticeId = id(fd, "noticeId");
  const icao = await airportIcaoByNoticeId(admin, noticeId);
  const status = text(fd, "status", true);

  try {
    const {error} = await admin.rpc("set_airport_world_notice_lifecycle", {
      p_notice_id: noticeId,
      p_status: status,
      p_actor_id: user.id,
    });

    if (error) throw error;
  } catch (error) {
    redirect(
      url(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to change airport notice lifecycle.",
      ),
    );
  }

  refresh(icao);

  const success =
    status === "published"
      ? "Airport notice published to Living Airports."
      : status === "closed"
        ? "Airport notice closed."
        : "Airport notice returned to Draft.";

  redirect(url("message", success));
}
