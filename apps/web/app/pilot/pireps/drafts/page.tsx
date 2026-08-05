import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {submitAutoPirepDraftAction} from "./actions";

export default async function AutoPirepDraftsPage() {
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) redirect("/pilots/login");

  const {data, error} = await supabase
    .from("auto_pirep_drafts")
    .select("id,flight_number,suggested_block_minutes,status,created_at")
    .eq("pilot_id", user.id)
    .order("created_at", {ascending:false});

  if (error) throw new Error(`Unable to load Auto PIREP drafts: ${error.message}`);

  return (
    <main style={{minHeight:"75vh",padding:"80px 20px",background:"var(--bg)"}}>
      <section style={{maxWidth:900,margin:"0 auto"}}>
        <Link href="/pilot/pireps" style={{color:"var(--accent)",fontWeight:850}}>← PIREPs</Link>
        <p className="eyebrow" style={{marginTop:34}}>KVA Automation</p>
        <h1 style={{fontSize:"clamp(3rem,7vw,5.5rem)",margin:"12px 0 18px"}}>Auto PIREP Drafts</h1>
        <p style={{color:"var(--muted)",lineHeight:1.8}}>
          Completed flights create a draft with calculated block time.
        </p>

        <div style={{display:"grid",gap:14,marginTop:28}}>
          {(data ?? []).length ? (data ?? []).map((draft) => (
            <article key={draft.id} style={{
              display:"flex",justifyContent:"space-between",alignItems:"center",
              gap:20,flexWrap:"wrap",padding:22,border:"1px solid var(--border)",
              borderRadius:16,background:"var(--surface)"
            }}>
              <div>
                <strong style={{display:"block",fontSize:"1.3rem"}}>{draft.flight_number}</strong>
                <span style={{display:"block",marginTop:7,color:"var(--muted)"}}>
                  {draft.suggested_block_minutes} min · {draft.status}
                </span>
              </div>
              {draft.status === "ready" ? (
                <form action={submitAutoPirepDraftAction}>
                  <input type="hidden" name="draftId" value={draft.id} />
                  <button className="button" type="submit">Submit Auto PIREP</button>
                </form>
              ) : null}
            </article>
          )) : <p style={{color:"var(--muted)"}}>No drafts available.</p>}
        </div>
      </section>
    </main>
  );
}
