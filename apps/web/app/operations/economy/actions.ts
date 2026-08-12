"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireOperationsConsoleAdmin} from "@/lib/operations/console-auth";
import {createAdminClient} from "@/lib/supabase/admin";

const ORG="kalabsha-airlines";
function url(kind:"message"|"error",value:string){return `/operations/economy?${kind}=${encodeURIComponent(value)}`}
function text(fd:FormData,key:string){const v=fd.get(key);if(typeof v!=="string"||!v.trim())throw new Error(`${key} is required`);return v.trim()}
function amount(fd:FormData,key:string){const n=Number(fd.get(key));if(!Number.isInteger(n)||n<0)throw new Error(`${key} must be a non-negative whole number`);return n}

export async function updatePolicyAction(fd:FormData){
  const user=await requireOperationsConsoleAdmin();const admin=createAdminClient();
  try{
    const {error}=await admin.rpc("upsert_economy_salary_policy",{
      p_organization_id:ORG,p_base_salary:amount(fd,"baseSalary"),p_per_block_minute:amount(fd,"perBlockMinute"),
      p_performance_threshold:amount(fd,"performanceThreshold"),p_performance_bonus:amount(fd,"performanceBonus"),
      p_event_completion_reward:amount(fd,"eventReward"),p_milestone_reward:amount(fd,"milestoneReward"),p_actor_id:user.id
    });if(error)throw error;
  }catch(e){redirect(url("error",e instanceof Error?e.message:"Unable to update policy."))}
  revalidatePath("/operations/economy");redirect(url("message","Economy policy updated."));
}

export async function createPilotItemAction(fd:FormData){
  const user=await requireOperationsConsoleAdmin();const admin=createAdminClient();
  try{
    const {error}=await admin.rpc("create_pilot_marketplace_item",{p_code:text(fd,"code"),p_name:text(fd,"name"),p_description:text(fd,"description"),p_category:text(fd,"category"),p_price:amount(fd,"price"),p_repeatable:fd.get("repeatable")==="on",p_actor_id:user.id,p_organization_id:ORG});if(error)throw error;
  }catch(e){redirect(url("error",e instanceof Error?e.message:"Unable to create Pilot Marketplace item."))}
  revalidatePath("/operations/economy");revalidatePath("/pilot/economy");redirect(url("message","Pilot Marketplace item created."));
}

export async function createCompanyItemAction(fd:FormData){
  const user=await requireOperationsConsoleAdmin();const admin=createAdminClient();
  try{
    const raw=fd.get("fleetTypeId");const fleetTypeId=typeof raw==="string"&&raw?raw:null;
    const {error}=await admin.rpc("create_company_marketplace_item",{p_code:text(fd,"code"),p_name:text(fd,"name"),p_description:text(fd,"description"),p_item_kind:text(fd,"itemKind"),p_fleet_type_id:fleetTypeId,p_price:amount(fd,"price"),p_actor_id:user.id,p_organization_id:ORG});if(error)throw error;
  }catch(e){redirect(url("error",e instanceof Error?e.message:"Unable to create Company Marketplace item."))}
  revalidatePath("/operations/economy");redirect(url("message","Company Marketplace item created."));
}

export async function purchaseCompanyItemAction(fd:FormData){
  const user=await requireOperationsConsoleAdmin();const admin=createAdminClient();const itemId=fd.get("itemId");
  if(typeof itemId!=="string"||!itemId)redirect(url("error","A valid company item is required."));
  const {error}=await admin.rpc("purchase_company_marketplace_item",{p_item_id:itemId,p_organization_id:ORG,p_actor_id:user.id});
  if(error)redirect(url("error",error.message));
  revalidatePath("/operations/economy");redirect(url("message","Company Marketplace purchase recorded. Fleet mutation was not performed automatically."));
}

export async function createRouteCampaignAction(fd:FormData){
  const user=await requireOperationsConsoleAdmin();const admin=createAdminClient();
  try{
    const {error}=await admin.rpc("create_route_support_campaign",{p_code:text(fd,"code"),p_title:text(fd,"title"),p_description:text(fd,"description"),p_departure_airport_id:text(fd,"departureId"),p_arrival_airport_id:text(fd,"arrivalId"),p_target_amount:amount(fd,"targetAmount"),p_actor_id:user.id,p_organization_id:ORG});if(error)throw error;
  }catch(e){redirect(url("error",e instanceof Error?e.message:"Unable to create route campaign."))}
  revalidatePath("/operations/economy");revalidatePath("/pilot/economy");redirect(url("message","Route-support campaign created."));
}

export async function reviewRouteCampaignAction(fd:FormData){
  const user=await requireOperationsConsoleAdmin();const admin=createAdminClient();const campaignId=fd.get("campaignId");const status=fd.get("status");const note=fd.get("note");
  if(typeof campaignId!=="string"||!campaignId||typeof status!=="string")redirect(url("error","Campaign and status are required."));
  const {error}=await admin.rpc("review_route_support_campaign",{p_campaign_id:campaignId,p_status:status,p_note:typeof note==="string"?note:"",p_actor_id:user.id});
  if(error)redirect(url("error",error.message));
  revalidatePath("/operations/economy");revalidatePath("/pilot/economy");redirect(url("message",`Route campaign changed to ${status}. No route was opened automatically.`));
}
