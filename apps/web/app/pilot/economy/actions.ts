"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

function url(kind:"message"|"error",value:string){
  return `/pilot/economy?${kind}=${encodeURIComponent(value)}`;
}

async function requirePilot(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/pilots/login");
  return {supabase,user};
}

export async function purchasePilotItemAction(formData:FormData){
  const itemId=formData.get("itemId");
  if(typeof itemId!=="string"||!itemId) redirect(url("error","A valid marketplace item is required."));
  const {supabase}=await requirePilot();
  const {error}=await supabase.rpc("purchase_pilot_marketplace_item",{p_item_id:itemId});
  revalidatePath("/pilot/economy");
  if(error) redirect(url("error",error.message));
  redirect(url("message","Pilot Marketplace purchase completed."));
}

export async function contributeRouteSupportAction(formData:FormData){
  const campaignId=formData.get("campaignId");
  const amount=Number(formData.get("amount")??0);
  if(typeof campaignId!=="string"||!campaignId) redirect(url("error","A valid route campaign is required."));
  if(!Number.isInteger(amount)||amount<=0) redirect(url("error","Contribution must be a positive whole number."));
  const {supabase}=await requirePilot();
  const {error}=await supabase.rpc("contribute_route_support",{p_campaign_id:campaignId,p_amount:amount});
  revalidatePath("/pilot/economy");
  if(error) redirect(url("error",error.message));
  redirect(url("message","Route-support contribution recorded."));
}
