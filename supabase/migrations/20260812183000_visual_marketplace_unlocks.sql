-- KVA OS Visual Marketplace Layer v1.1 RC4
-- Secure Pilot Marketplace unlock / availability rules.
--
-- Architecture:
--   * Uses existing pilot_marketplace_items.metadata JSONB.
--   * No new tables or columns.
--   * Pilot / Company authority separation is unchanged.
--   * Unified Economy Ledger remains the source of truth for balances.
--   * Unlock eligibility is enforced server-side before a purchase.

create or replace function public.get_pilot_marketplace_unlock_state(
  p_item_id uuid,
  p_pilot_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_item public.pilot_marketplace_items%rowtype;
  v_account public.pilot_career_accounts%rowtype;
  v_wallet public.pilot_wallets%rowtype;
  v_unlock jsonb := '{}'::jsonb;
  v_min_xp_text text;
  v_min_flights_text text;
  v_min_xp bigint := 0;
  v_min_flights integer := 0;
  v_required_rank_code text;
  v_required_rank_name text;
  v_required_milestone_code text;
  v_required_milestone_title text;
  v_current_rank_priority integer;
  v_required_rank_priority integer;
  v_rank_met boolean := true;
  v_xp_met boolean := true;
  v_flights_met boolean := true;
  v_milestone_met boolean := true;
  v_owned boolean := false;
  v_balance bigint := 0;
  v_state text := 'LOCKED';
begin
  if p_pilot_id is null then
    raise exception 'Pilot is required';
  end if;

  select *
  into v_item
  from public.pilot_marketplace_items
  where id = p_item_id
    and active = true;

  if not found then
    return jsonb_build_object(
      'state', 'UNAVAILABLE',
      'eligible', false,
      'requirementsMet', false
    );
  end if;

  select *
  into v_account
  from public.pilot_career_accounts
  where pilot_id = p_pilot_id;

  if not found then
    return jsonb_build_object(
      'state', 'LOCKED',
      'eligible', false,
      'requirementsMet', false,
      'reason', 'CAREER_ACCOUNT_REQUIRED'
    );
  end if;

  select *
  into v_wallet
  from public.pilot_wallets
  where pilot_id = p_pilot_id;

  v_balance := coalesce(v_wallet.balance, 0);
  v_unlock := coalesce(
    v_item.metadata #> '{visualMarketplace,unlock}',
    '{}'::jsonb
  );

  v_min_xp_text := nullif(btrim(v_unlock ->> 'minimumCareerXp'), '');
  v_min_flights_text := nullif(btrim(v_unlock ->> 'minimumFlights'), '');

  if v_min_xp_text ~ '^[0-9]+$' then
    v_min_xp := v_min_xp_text::bigint;
  end if;

  if v_min_flights_text ~ '^[0-9]+$' then
    v_min_flights := least(v_min_flights_text::bigint, 2147483647)::integer;
  end if;

  v_required_rank_code := upper(
    nullif(btrim(v_unlock ->> 'requiredRankCode'), '')
  );
  v_required_milestone_code := upper(
    nullif(btrim(v_unlock ->> 'requiredMilestoneCode'), '')
  );

  v_xp_met := v_account.career_xp >= v_min_xp;
  v_flights_met := v_account.completed_flights >= v_min_flights;

  if v_required_rank_code is not null then
    select rank.priority
    into v_current_rank_priority
    from public.ranks rank
    where rank.code = v_account.current_rank_code;

    select rank.priority, rank.name
    into v_required_rank_priority, v_required_rank_name
    from public.ranks rank
    where rank.code = v_required_rank_code;

    v_rank_met :=
      v_current_rank_priority is not null
      and v_required_rank_priority is not null
      and v_current_rank_priority >= v_required_rank_priority;
  end if;

  if v_required_milestone_code is not null then
    select definition.title
    into v_required_milestone_title
    from public.career_milestone_definitions definition
    where definition.code = v_required_milestone_code
      and definition.active = true;

    v_milestone_met :=
      v_required_milestone_title is not null
      and exists (
        select 1
        from public.pilot_career_milestones achieved
        join public.career_milestone_definitions definition
          on definition.id = achieved.milestone_id
        where achieved.pilot_id = p_pilot_id
          and definition.code = v_required_milestone_code
      );
  end if;

  select exists (
    select 1
    from public.pilot_marketplace_purchases purchase
    where purchase.pilot_id = p_pilot_id
      and purchase.item_id = v_item.id
  )
  into v_owned;

  if v_owned and not v_item.repeatable then
    v_state := 'OWNED';
  elsif v_required_milestone_code is not null and not v_milestone_met then
    v_state := 'REQUIRES_MILESTONE';
  elsif not (v_xp_met and v_flights_met and v_rank_met) then
    v_state := 'LOCKED';
  elsif v_balance < v_item.price then
    v_state := 'INSUFFICIENT_KVC';
  else
    v_state := 'AVAILABLE';
  end if;

  return jsonb_build_object(
    'state', v_state,
    'eligible', v_state = 'AVAILABLE',
    'owned', v_owned,
    'requirementsMet',
      v_xp_met and v_flights_met and v_rank_met and v_milestone_met,
    'requirements', jsonb_build_object(
      'minimumCareerXp', v_min_xp,
      'minimumFlights', v_min_flights,
      'requiredRankCode', v_required_rank_code,
      'requiredRankName', v_required_rank_name,
      'requiredMilestoneCode', v_required_milestone_code,
      'requiredMilestoneTitle', v_required_milestone_title
    ),
    'progress', jsonb_build_object(
      'careerXp', v_account.career_xp,
      'completedFlights', v_account.completed_flights,
      'currentRankCode', v_account.current_rank_code,
      'walletBalance', v_balance,
      'rankMet', v_rank_met,
      'careerXpMet', v_xp_met,
      'completedFlightsMet', v_flights_met,
      'milestoneMet', v_milestone_met
    )
  );
end;
$$;

revoke all on function public.get_pilot_marketplace_unlock_state(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.get_pilot_marketplace_unlock_state(uuid, uuid)
to service_role;


create or replace function public.get_pilot_visual_marketplace()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.pilot_career_accounts account
    where account.pilot_id = v_user_id
  ) then
    raise exception 'Career account is not initialized';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'code', item.code,
        'name', item.name,
        'description', item.description,
        'category', item.category,
        'price', item.price,
        'repeatable', item.repeatable,
        'metadata', item.metadata,
        'owned', exists (
          select 1
          from public.pilot_marketplace_purchases purchase
          where purchase.pilot_id = v_user_id
            and purchase.item_id = item.id
        ),
        'unlock',
          public.get_pilot_marketplace_unlock_state(item.id, v_user_id)
      )
      order by item.price, item.name
    ),
    '[]'::jsonb
  )
  into v_result
  from public.pilot_marketplace_items item
  where item.active = true;

  return v_result;
end;
$$;

revoke all on function public.get_pilot_visual_marketplace()
from public, anon;

grant execute on function public.get_pilot_visual_marketplace()
to authenticated;


create or replace function public.set_pilot_marketplace_unlock_requirements(
  p_item_id uuid,
  p_minimum_career_xp bigint,
  p_minimum_flights integer,
  p_required_rank_code text,
  p_required_milestone_code text,
  p_actor_id uuid,
  p_organization_id text default 'kalabsha-airlines'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.pilot_marketplace_items%rowtype;
  v_rank_code text := upper(nullif(btrim(p_required_rank_code), ''));
  v_milestone_code text := upper(nullif(btrim(p_required_milestone_code), ''));
  v_unlock jsonb;
  v_visual jsonb;
begin
  if p_actor_id is null then
    raise exception 'Operations actor is required';
  end if;

  if coalesce(p_minimum_career_xp, 0) < 0 then
    raise exception 'Minimum Career XP cannot be negative';
  end if;

  if coalesce(p_minimum_flights, 0) < 0 then
    raise exception 'Minimum flights cannot be negative';
  end if;

  select *
  into v_item
  from public.pilot_marketplace_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Pilot Marketplace item not found';
  end if;

  if v_rank_code is not null and not exists (
    select 1 from public.ranks rank where rank.code = v_rank_code
  ) then
    raise exception 'Unknown career rank code: %', v_rank_code;
  end if;

  if v_milestone_code is not null and not exists (
    select 1
    from public.career_milestone_definitions definition
    where definition.code = v_milestone_code
      and definition.active = true
  ) then
    raise exception 'Unknown career milestone code: %', v_milestone_code;
  end if;

  v_unlock := jsonb_strip_nulls(
    jsonb_build_object(
      'minimumCareerXp', greatest(coalesce(p_minimum_career_xp, 0), 0),
      'minimumFlights', greatest(coalesce(p_minimum_flights, 0), 0),
      'requiredRankCode', v_rank_code,
      'requiredMilestoneCode', v_milestone_code
    )
  );

  v_visual :=
    coalesce(v_item.metadata -> 'visualMarketplace', '{}'::jsonb)
    || jsonb_build_object('unlock', v_unlock);

  update public.pilot_marketplace_items
  set
    metadata =
      coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object('visualMarketplace', v_visual),
    updated_at = now()
  where id = p_item_id;

  insert into public.economy_admin_audit (
    actor_id,
    organization_id,
    action,
    target_type,
    target_id,
    details
  )
  values (
    p_actor_id,
    p_organization_id,
    'pilot_marketplace_unlock_updated',
    'pilot_marketplace_item',
    p_item_id::text,
    jsonb_build_object(
      'itemCode', v_item.code,
      'minimumCareerXp', greatest(coalesce(p_minimum_career_xp, 0), 0),
      'minimumFlights', greatest(coalesce(p_minimum_flights, 0), 0),
      'requiredRankCode', v_rank_code,
      'requiredMilestoneCode', v_milestone_code
    )
  );

  return true;
end;
$$;

revoke all on function public.set_pilot_marketplace_unlock_requirements(
  uuid, bigint, integer, text, text, uuid, text
) from public, anon, authenticated;

grant execute on function public.set_pilot_marketplace_unlock_requirements(
  uuid, bigint, integer, text, text, uuid, text
) to service_role;


create or replace function public.purchase_pilot_marketplace_item(
  p_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.pilot_marketplace_items%rowtype;
  v_account public.pilot_career_accounts%rowtype;
  v_purchase_id uuid;
  v_unlock_state jsonb;
  v_state text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_item
  from public.pilot_marketplace_items
  where id = p_item_id
    and active = true;

  if not found then
    raise exception 'Pilot marketplace item is unavailable';
  end if;

  select *
  into v_account
  from public.pilot_career_accounts
  where pilot_id = v_user_id;

  if not found then
    perform public.ensure_pilot_economy_account(
      v_user_id,
      'kalabsha-airlines'
    );

    select *
    into v_account
    from public.pilot_career_accounts
    where pilot_id = v_user_id;
  end if;

  v_unlock_state :=
    public.get_pilot_marketplace_unlock_state(v_item.id, v_user_id);
  v_state := v_unlock_state ->> 'state';

  if v_state = 'OWNED' then
    raise exception 'You already own this marketplace item';
  elsif v_state = 'REQUIRES_MILESTONE' then
    raise exception 'Required career milestone has not been achieved';
  elsif v_state = 'LOCKED' then
    raise exception 'Pilot Marketplace unlock requirements are not met';
  elsif v_state = 'INSUFFICIENT_KVC' then
    raise exception 'Insufficient pilot wallet balance';
  elsif v_state <> 'AVAILABLE' then
    raise exception 'Pilot marketplace item is unavailable';
  end if;

  insert into public.pilot_marketplace_purchases (
    pilot_id,
    item_id,
    price_paid,
    purchased_at
  )
  values (
    v_user_id,
    v_item.id,
    v_item.price,
    now()
  )
  returning id into v_purchase_id;

  perform public.post_economy_ledger_entry(
    'pilot',
    v_user_id,
    v_account.organization_id,
    'PILOT_MARKETPLACE_PURCHASE',
    -v_item.price,
    format('Pilot Marketplace purchase: %s', v_item.name),
    format('pilot-marketplace:%s', v_purchase_id),
    v_user_id,
    null,
    null,
    v_item.id,
    null,
    null,
    null,
    jsonb_build_object(
      'purchaseId', v_purchase_id,
      'itemCode', v_item.code,
      'itemName', v_item.name,
      'category', v_item.category,
      'unlockState', v_unlock_state
    )
  );

  perform public.post_economy_ledger_entry(
    'company',
    null,
    v_account.organization_id,
    'PILOT_MARKETPLACE_REVENUE',
    v_item.price,
    format('Pilot Marketplace revenue: %s', v_item.name),
    format('pilot-marketplace-company:%s', v_purchase_id),
    v_user_id,
    null,
    null,
    v_item.id,
    null,
    null,
    null,
    jsonb_build_object(
      'purchaseId', v_purchase_id,
      'pilotId', v_user_id,
      'itemCode', v_item.code
    )
  );

  perform public.append_domain_event(
    p_event_type => 'pilot_marketplace.item_purchased',
    p_aggregate_type => 'pilot_marketplace_purchase',
    p_aggregate_id => v_purchase_id::text,
    p_actor_id => v_user_id::text,
    p_organization_id => v_account.organization_id,
    p_payload => jsonb_build_object(
      'purchaseId', v_purchase_id,
      'pilotId', v_user_id,
      'itemId', v_item.id,
      'itemCode', v_item.code,
      'itemName', v_item.name,
      'price', v_item.price
    ),
    p_metadata => jsonb_build_object(
      'source', 'career-economy.pilot-marketplace',
      'privacy', 'pilot_private'
    )
  );

  return v_purchase_id;
end;
$$;

revoke all on function public.purchase_pilot_marketplace_item(uuid)
from public, anon;

grant execute on function public.purchase_pilot_marketplace_item(uuid)
to authenticated;


-- A progression-linked visual item using an already existing, evidence-backed
-- Career & Economy milestone. This does not create a new career rule.
insert into public.pilot_marketplace_items (
  code,
  name,
  description,
  category,
  price,
  repeatable,
  active,
  metadata
)
values (
  'PILOT-BADGE-TEN-FLIGHT-01',
  'Ten Flight Foundation Badge',
  'A career badge linked to the existing Ten Flight Foundation milestone.',
  'career_display',
  250,
  false,
  true,
  jsonb_build_object(
    'visualMarketplace',
    jsonb_build_object(
      'visualType', 'badge',
      'unlock',
      jsonb_build_object(
        'requiredMilestoneCode', 'FIRST_10_FLIGHTS'
      )
    )
  )
)
on conflict (code) do nothing;
