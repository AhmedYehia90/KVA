"use server";

import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

export async function submitAutoPirepDraftAction(formData: FormData) {
  const draftId = formData.get("draftId");
  if (typeof draftId !== "string" || !draftId) {
    redirect("/pilot/pireps/drafts?error=Invalid%20draft.");
  }

  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) redirect("/pilots/login");

  const {data: draft, error: draftError} = await supabase
    .from("auto_pirep_drafts")
    .select("booking_id,suggested_block_minutes")
    .eq("id", draftId)
    .eq("pilot_id", user.id)
    .eq("status", "ready")
    .maybeSingle();

  if (draftError || !draft) {
    redirect(`/pilot/pireps/drafts?error=${encodeURIComponent(
      draftError?.message ?? "Draft not found."
    )}`);
  }

  const {data: pirepId, error} = await supabase.rpc("submit_booking_pirep", {
    p_booking_id: draft.booking_id,
    p_block_minutes: draft.suggested_block_minutes,
    p_landing_rate: null,
    p_fuel_used_kg: null,
    p_remarks: "Submitted from KVA Auto PIREP draft."
  });

  if (error) {
    redirect(`/pilot/pireps/drafts?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/pilot/pireps?submitted=${pirepId}`);
}
