-- KVA Career & Economy Pack v1.0
-- Evidence-backed pilot career + split pilot/company economy.

create table if not exists public.pilot_career_accounts (
  pilot_id uuid primary key
    references public.profiles(id) on delete cascade,
  organization_id text not null default 'kalabsha-airlines'
    references public.platform_organizations(id) on delete restrict,
  career_xp bigint not null default 0 check (career_xp >= 0),
  completed_flights integer not null default 0 check (completed_flights >= 0),
  flight_minutes bigint not null default 0 check (flight_minutes >= 0),
  current_rank_code text not null default 'CADET',
  lifetime_salary bigint not null default 0 check (lifetime_salary >= 0),
  lifetime_bonus bigint not null default 0 check (lifetime_bonus >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pilot_wallets (
  pilot_id uuid primary key
    references public.profiles(id) on delete cascade,
  currency_code text not null default 'KVA',
  balance bigint not null default 0,
  total_earned bigint not null default 0 check (total_earned >= 0),
  total_spent bigint not null default 0 check (total_spent >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_economy_accounts (
  organization_id text primary key
    references public.platform_organizations(id) on delete cascade,
  currency_code text not null default 'KVA',
  balance bigint not null default 0,
  total_income bigint not null default 0 check (total_income >= 0),
  total_spent bigint not null default 0 check (total_spent >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.economy_salary_policies (
  organization_id text primary key
    references public.platform_organizations(id) on delete cascade,
  base_salary bigint not null default 500 check (base_salary >= 0),
  per_block_minute bigint not null default 10 check (per_block_minute >= 0),
  performance_threshold integer not null default 85 check (
    performance_threshold between 0 and 100
  ),
  performance_bonus bigint not null default 250 check (
    performance_bonus >= 0
  ),
  event_completion_reward bigint not null default 500 check (
    event_completion_reward >= 0
  ),
  milestone_reward bigint not null default 750 check (
    milestone_reward >= 0
  ),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.career_milestone_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null,
  metric text not null check (
    metric in ('flights', 'minutes')
  ),
  threshold bigint not null check (threshold > 0),
  reward_amount bigint not null default 750 check (reward_amount >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pilot_career_milestones (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null
    references public.profiles(id) on delete cascade,
  milestone_id uuid not null
    references public.career_milestone_definitions(id) on delete cascade,
  source_pirep_id uuid
    references public.pireps(id) on delete set null,
  reward_amount bigint not null default 0 check (reward_amount >= 0),
  achieved_at timestamptz not null default now(),
  unique(pilot_id, milestone_id)
);

create table if not exists public.pilot_marketplace_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  category text not null check (
    category in (
      'profile_cosmetic',
      'passport_frame',
      'career_display',
      'profile_theme',
      'collectible',
      'commemorative'
    )
  ),
  price bigint not null check (price > 0),
  repeatable boolean not null default false,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pilot_marketplace_purchases (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null
    references public.profiles(id) on delete cascade,
  item_id uuid not null
    references public.pilot_marketplace_items(id) on delete restrict,
  price_paid bigint not null check (price_paid > 0),
  purchased_at timestamptz not null default now()
);

create index if not exists idx_pilot_marketplace_purchases_pilot
on public.pilot_marketplace_purchases(pilot_id, purchased_at desc);

create table if not exists public.company_marketplace_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  item_kind text not null check (
    item_kind in (
      'aircraft_purchase',
      'aircraft_lease',
      'fleet_capacity',
      'operational_asset',
      'expansion',
      'service'
    )
  ),
  fleet_type_id uuid
    references public.fleet_types(id) on delete set null,
  price bigint not null check (price > 0),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_marketplace_purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null
    references public.platform_organizations(id) on delete cascade,
  item_id uuid not null
    references public.company_marketplace_items(id) on delete restrict,
  actor_id uuid not null
    references public.profiles(id) on delete restrict,
  price_paid bigint not null check (price_paid > 0),
  purchased_at timestamptz not null default now()
);

create index if not exists idx_company_marketplace_purchases_org
on public.company_marketplace_purchases(
  organization_id,
  purchased_at desc
);

create table if not exists public.company_economy_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null
    references public.platform_organizations(id) on delete cascade,
  purchase_id uuid not null unique
    references public.company_marketplace_purchases(id) on delete cascade,
  asset_kind text not null,
  fleet_type_id uuid
    references public.fleet_types(id) on delete set null,
  status text not null default 'acquired' check (
    status in ('acquired', 'active', 'retired', 'cancelled')
  ),
  metadata jsonb not null default '{}'::jsonb,
  acquired_at timestamptz not null default now()
);

create table if not exists public.route_support_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null
    references public.platform_organizations(id) on delete cascade,
  code text not null unique,
  title text not null,
  description text not null,
  departure_airport_id uuid not null
    references public.airports(id) on delete restrict,
  arrival_airport_id uuid not null
    references public.airports(id) on delete restrict,
  target_amount bigint not null check (target_amount > 0),
  funded_amount bigint not null default 0 check (funded_amount >= 0),
  status text not null default 'active' check (
    status in (
      'active',
      'goal_reached',
      'under_review',
      'approved',
      'rejected',
      'closed'
    )
  ),
  operations_note text,
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (departure_airport_id <> arrival_airport_id)
);

create index if not exists idx_route_support_campaigns_org
on public.route_support_campaigns(organization_id, status, created_at desc);

create table if not exists public.route_support_contributions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null
    references public.route_support_campaigns(id) on delete cascade,
  pilot_id uuid not null
    references public.profiles(id) on delete cascade,
  organization_id text not null
    references public.platform_organizations(id) on delete restrict,
  amount bigint not null check (amount > 0),
  contributed_at timestamptz not null default now()
);

create index if not exists idx_route_support_contributions_campaign
on public.route_support_contributions(campaign_id, contributed_at desc);

create index if not exists idx_route_support_contributions_pilot
on public.route_support_contributions(pilot_id, contributed_at desc);

create table if not exists public.career_promotion_history (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null
    references public.profiles(id) on delete cascade,
  source_pirep_id uuid
    references public.pireps(id) on delete set null,
  from_rank_code text,
  to_rank_code text not null,
  career_xp bigint not null check (career_xp >= 0),
  completed_flights integer not null check (completed_flights >= 0),
  flight_minutes bigint not null check (flight_minutes >= 0),
  promoted_at timestamptz not null default now()
);

create index if not exists idx_career_promotions_pilot
on public.career_promotion_history(pilot_id, promoted_at desc);

create table if not exists public.career_economy_pirep_awards (
  pirep_id uuid primary key
    references public.pireps(id) on delete cascade,
  pilot_id uuid not null
    references public.profiles(id) on delete cascade,
  organization_id text not null
    references public.platform_organizations(id) on delete restrict,
  salary_amount bigint not null default 0 check (salary_amount >= 0),
  performance_bonus bigint not null default 0 check (
    performance_bonus >= 0
  ),
  career_xp bigint not null default 0 check (career_xp >= 0),
  companion_score integer,
  awarded_at timestamptz not null default now()
);


create table if not exists public.economy_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_scope text not null check (
    owner_scope in ('pilot', 'company')
  ),
  pilot_id uuid references public.profiles(id) on delete set null,
  organization_id text
    references public.platform_organizations(id) on delete set null,
  transaction_type text not null,
  amount bigint not null check (amount <> 0),
  currency_code text not null default 'KVA',
  description text not null,
  idempotency_key text not null unique,
  source_pirep_id uuid references public.pireps(id) on delete set null,
  source_event_id uuid
    references public.global_aviation_events(id) on delete set null,
  pilot_marketplace_item_id uuid
    references public.pilot_marketplace_items(id) on delete set null,
  company_marketplace_item_id uuid
    references public.company_marketplace_items(id) on delete set null,
  route_campaign_id uuid
    references public.route_support_campaigns(id) on delete set null,
  company_asset_id uuid
    references public.company_economy_assets(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    (owner_scope = 'pilot' and pilot_id is not null)
    or
    (owner_scope = 'company' and organization_id is not null)
  )
);

create index if not exists idx_economy_ledger_pilot
on public.economy_ledger(pilot_id, created_at desc)
where pilot_id is not null;

create index if not exists idx_economy_ledger_company
on public.economy_ledger(organization_id, created_at desc)
where organization_id is not null;

create index if not exists idx_economy_ledger_type
on public.economy_ledger(transaction_type, created_at desc);

create table if not exists public.economy_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null
    references public.profiles(id) on delete restrict,
  organization_id text not null
    references public.platform_organizations(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_economy_admin_audit_org
on public.economy_admin_audit(organization_id, created_at desc);

alter table public.pilot_career_accounts enable row level security;
alter table public.pilot_wallets enable row level security;
alter table public.company_economy_accounts enable row level security;
alter table public.economy_salary_policies enable row level security;
alter table public.career_milestone_definitions enable row level security;
alter table public.pilot_career_milestones enable row level security;
alter table public.pilot_marketplace_items enable row level security;
alter table public.pilot_marketplace_purchases enable row level security;
alter table public.company_marketplace_items enable row level security;
alter table public.company_marketplace_purchases enable row level security;
alter table public.company_economy_assets enable row level security;
alter table public.route_support_campaigns enable row level security;
alter table public.route_support_contributions enable row level security;
alter table public.career_promotion_history enable row level security;
alter table public.career_economy_pirep_awards enable row level security;
alter table public.economy_ledger enable row level security;
alter table public.economy_admin_audit enable row level security;

drop policy if exists pilot_career_select_own
on public.pilot_career_accounts;

create policy pilot_career_select_own
on public.pilot_career_accounts
for select
to authenticated
using (pilot_id = auth.uid());

drop policy if exists pilot_wallet_select_own
on public.pilot_wallets;

create policy pilot_wallet_select_own
on public.pilot_wallets
for select
to authenticated
using (pilot_id = auth.uid());

drop policy if exists milestone_definitions_read
on public.career_milestone_definitions;

create policy milestone_definitions_read
on public.career_milestone_definitions
for select
to authenticated
using (active = true);

drop policy if exists pilot_milestones_select_own
on public.pilot_career_milestones;

create policy pilot_milestones_select_own
on public.pilot_career_milestones
for select
to authenticated
using (pilot_id = auth.uid());

drop policy if exists pilot_marketplace_items_read
on public.pilot_marketplace_items;

create policy pilot_marketplace_items_read
on public.pilot_marketplace_items
for select
to authenticated
using (active = true);

drop policy if exists pilot_marketplace_purchases_select_own
on public.pilot_marketplace_purchases;

create policy pilot_marketplace_purchases_select_own
on public.pilot_marketplace_purchases
for select
to authenticated
using (pilot_id = auth.uid());

drop policy if exists route_support_campaigns_read
on public.route_support_campaigns;

create policy route_support_campaigns_read
on public.route_support_campaigns
for select
to authenticated
using (status in ('active', 'goal_reached', 'under_review', 'approved'));

drop policy if exists route_support_contributions_select_own
on public.route_support_contributions;

create policy route_support_contributions_select_own
on public.route_support_contributions
for select
to authenticated
using (pilot_id = auth.uid());

drop policy if exists promotion_history_select_own
on public.career_promotion_history;

create policy promotion_history_select_own
on public.career_promotion_history
for select
to authenticated
using (pilot_id = auth.uid());

drop policy if exists career_economy_awards_select_own
on public.career_economy_pirep_awards;

create policy career_economy_awards_select_own
on public.career_economy_pirep_awards
for select
to authenticated
using (pilot_id = auth.uid());

drop policy if exists economy_ledger_select_own
on public.economy_ledger;

create policy economy_ledger_select_own
on public.economy_ledger
for select
to authenticated
using (
  owner_scope = 'pilot'
  and pilot_id = auth.uid()
);

-- Company economy, company marketplace, company assets and audit records
-- intentionally have no authenticated-client policies. They are accessed
-- only through the protected Operations Economy Console.


create or replace function public.ensure_pilot_economy_account(
  p_pilot_id uuid,
  p_organization_id text default 'kalabsha-airlines'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_hours numeric := 0;
  v_total_flights integer := 0;
  v_rank_code text := 'CADET';
begin
  select
    coalesce(profile.total_hours, 0),
    coalesce(profile.total_flights, 0)
  into
    v_total_hours,
    v_total_flights
  from public.profiles profile
  where profile.id = p_pilot_id;

  if not found then
    raise exception 'Pilot profile not found';
  end if;

  select rank.code
  into v_rank_code
  from public.ranks rank
  where rank.minimum_hours <= v_total_hours
    and rank.minimum_flights <= v_total_flights
  order by rank.priority desc
  limit 1;

  v_rank_code := coalesce(v_rank_code, 'CADET');

  insert into public.pilot_career_accounts (
    pilot_id,
    organization_id,
    career_xp,
    completed_flights,
    flight_minutes,
    current_rank_code,
    created_at,
    updated_at
  )
  values (
    p_pilot_id,
    p_organization_id,
    greatest(0, round(v_total_hours * 100)::bigint + v_total_flights * 100),
    v_total_flights,
    greatest(0, round(v_total_hours * 60)::bigint),
    v_rank_code,
    now(),
    now()
  )
  on conflict (pilot_id) do nothing;

  insert into public.pilot_wallets (
    pilot_id,
    currency_code,
    balance,
    total_earned,
    total_spent,
    updated_at
  )
  values (
    p_pilot_id,
    'KVA',
    0,
    0,
    0,
    now()
  )
  on conflict (pilot_id) do nothing;
end;
$$;

revoke all on function public.ensure_pilot_economy_account(uuid, text)
from public, anon, authenticated;

grant execute on function public.ensure_pilot_economy_account(uuid, text)
to service_role;


create or replace function public.post_economy_ledger_entry(
  p_owner_scope text,
  p_pilot_id uuid,
  p_organization_id text,
  p_transaction_type text,
  p_amount bigint,
  p_description text,
  p_idempotency_key text,
  p_actor_id uuid default null,
  p_source_pirep_id uuid default null,
  p_source_event_id uuid default null,
  p_pilot_marketplace_item_id uuid default null,
  p_company_marketplace_item_id uuid default null,
  p_route_campaign_id uuid default null,
  p_company_asset_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_ledger_id uuid;
  v_current_balance bigint;
  v_org text;
begin
  if p_owner_scope not in ('pilot', 'company') then
    raise exception 'Invalid economy owner scope';
  end if;

  if p_amount = 0 then
    raise exception 'Ledger amount cannot be zero';
  end if;

  if nullif(btrim(p_transaction_type), '') is null then
    raise exception 'Transaction type is required';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Idempotency key is required';
  end if;

  select ledger.id
  into v_existing_id
  from public.economy_ledger ledger
  where ledger.idempotency_key = p_idempotency_key;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  if p_owner_scope = 'pilot' then
    if p_pilot_id is null then
      raise exception 'Pilot ledger entry requires pilot_id';
    end if;

    v_org := coalesce(p_organization_id, 'kalabsha-airlines');

    perform public.ensure_pilot_economy_account(
      p_pilot_id,
      v_org
    );

    select wallet.balance
    into v_current_balance
    from public.pilot_wallets wallet
    where wallet.pilot_id = p_pilot_id
    for update;

    if p_amount < 0 and v_current_balance + p_amount < 0 then
      raise exception 'Insufficient pilot wallet balance';
    end if;

    insert into public.economy_ledger (
      owner_scope,
      pilot_id,
      organization_id,
      transaction_type,
      amount,
      description,
      idempotency_key,
      source_pirep_id,
      source_event_id,
      pilot_marketplace_item_id,
      company_marketplace_item_id,
      route_campaign_id,
      company_asset_id,
      actor_id,
      metadata
    )
    values (
      'pilot',
      p_pilot_id,
      v_org,
      p_transaction_type,
      p_amount,
      p_description,
      p_idempotency_key,
      p_source_pirep_id,
      p_source_event_id,
      p_pilot_marketplace_item_id,
      p_company_marketplace_item_id,
      p_route_campaign_id,
      p_company_asset_id,
      p_actor_id,
      coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into v_ledger_id;

    update public.pilot_wallets
    set
      balance = balance + p_amount,
      total_earned = total_earned + greatest(p_amount, 0),
      total_spent = total_spent + greatest(-p_amount, 0),
      updated_at = now()
    where pilot_id = p_pilot_id;
  else
    if p_organization_id is null then
      raise exception 'Company ledger entry requires organization_id';
    end if;

    insert into public.company_economy_accounts (
      organization_id,
      currency_code,
      balance,
      total_income,
      total_spent,
      updated_at
    )
    values (
      p_organization_id,
      'KVA',
      0,
      0,
      0,
      now()
    )
    on conflict (organization_id) do nothing;

    select account.balance
    into v_current_balance
    from public.company_economy_accounts account
    where account.organization_id = p_organization_id
    for update;

    if p_amount < 0 and v_current_balance + p_amount < 0 then
      raise exception 'Insufficient company economy balance';
    end if;

    insert into public.economy_ledger (
      owner_scope,
      pilot_id,
      organization_id,
      transaction_type,
      amount,
      description,
      idempotency_key,
      source_pirep_id,
      source_event_id,
      pilot_marketplace_item_id,
      company_marketplace_item_id,
      route_campaign_id,
      company_asset_id,
      actor_id,
      metadata
    )
    values (
      'company',
      p_pilot_id,
      p_organization_id,
      p_transaction_type,
      p_amount,
      p_description,
      p_idempotency_key,
      p_source_pirep_id,
      p_source_event_id,
      p_pilot_marketplace_item_id,
      p_company_marketplace_item_id,
      p_route_campaign_id,
      p_company_asset_id,
      p_actor_id,
      coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into v_ledger_id;

    update public.company_economy_accounts
    set
      balance = balance + p_amount,
      total_income = total_income + greatest(p_amount, 0),
      total_spent = total_spent + greatest(-p_amount, 0),
      updated_at = now()
    where organization_id = p_organization_id;
  end if;

  perform public.append_domain_event(
    p_event_type => 'economy.transaction_created',
    p_aggregate_type => 'economy_ledger',
    p_aggregate_id => v_ledger_id::text,
    p_actor_id => coalesce(p_actor_id, p_pilot_id)::text,
    p_organization_id => coalesce(p_organization_id, v_org, 'kalabsha-airlines'),
    p_payload => jsonb_build_object(
      'ledgerId', v_ledger_id,
      'ownerScope', p_owner_scope,
      'pilotId', p_pilot_id,
      'organizationId', coalesce(p_organization_id, v_org),
      'transactionType', p_transaction_type,
      'amount', p_amount,
      'currencyCode', 'KVA'
    ),
    p_metadata => jsonb_build_object(
      'source', 'career-economy.ledger',
      'privacy', case
        when p_owner_scope = 'pilot' then 'pilot_private'
        else 'internal'
      end
    )
  );

  return v_ledger_id;
end;
$$;

revoke all on function public.post_economy_ledger_entry(
  text, uuid, text, text, bigint, text, text, uuid, uuid, uuid,
  uuid, uuid, uuid, uuid, jsonb
) from public, anon, authenticated;

grant execute on function public.post_economy_ledger_entry(
  text, uuid, text, text, bigint, text, text, uuid, uuid, uuid,
  uuid, uuid, uuid, uuid, jsonb
) to service_role;


create or replace function public.evaluate_pilot_career_rank(
  p_pilot_id uuid,
  p_source_pirep_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.pilot_career_accounts%rowtype;
  v_rank_code text;
  v_previous_rank text;
begin
  select *
  into v_account
  from public.pilot_career_accounts
  where pilot_id = p_pilot_id
  for update;

  if not found then
    return null;
  end if;

  v_previous_rank := v_account.current_rank_code;

  select rank.code
  into v_rank_code
  from public.ranks rank
  where rank.minimum_hours <=
      (v_account.flight_minutes::numeric / 60)
    and rank.minimum_flights <= v_account.completed_flights
  order by rank.priority desc
  limit 1;

  v_rank_code := coalesce(v_rank_code, v_previous_rank, 'CADET');

  if v_rank_code is distinct from v_previous_rank then
    update public.pilot_career_accounts
    set
      current_rank_code = v_rank_code,
      updated_at = now()
    where pilot_id = p_pilot_id;

    -- Keep the existing profile/passport rank in sync when the legacy
    -- profiles.rank_id relationship exists.
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'rank_id'
    ) and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'ranks'
        and column_name = 'id'
    ) then
      execute
        'update public.profiles
         set rank_id = (
           select id from public.ranks where code = $1 limit 1
         )
         where id = $2'
      using v_rank_code, p_pilot_id;
    end if;

    insert into public.career_promotion_history (
      pilot_id,
      source_pirep_id,
      from_rank_code,
      to_rank_code,
      career_xp,
      completed_flights,
      flight_minutes,
      promoted_at
    )
    values (
      p_pilot_id,
      p_source_pirep_id,
      v_previous_rank,
      v_rank_code,
      v_account.career_xp,
      v_account.completed_flights,
      v_account.flight_minutes,
      now()
    );

    perform public.append_domain_event(
      p_event_type => 'career.promoted',
      p_aggregate_type => 'pilot_career',
      p_aggregate_id => p_pilot_id::text,
      p_actor_id => p_pilot_id::text,
      p_organization_id => v_account.organization_id,
      p_payload => jsonb_build_object(
        'pilotId', p_pilot_id,
        'fromRank', v_previous_rank,
        'toRank', v_rank_code,
        'careerXp', v_account.career_xp,
        'completedFlights', v_account.completed_flights,
        'flightMinutes', v_account.flight_minutes,
        'sourcePirepId', p_source_pirep_id
      ),
      p_metadata => jsonb_build_object(
        'source', 'career-economy.progression',
        'privacy', 'pilot_private'
      )
    );
  end if;

  return v_rank_code;
end;
$$;

revoke all on function public.evaluate_pilot_career_rank(uuid, uuid)
from public, anon, authenticated;


create or replace function public.evaluate_pilot_career_milestones(
  p_pilot_id uuid,
  p_source_pirep_id uuid,
  p_previous_flights integer,
  p_previous_minutes bigint
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.pilot_career_accounts%rowtype;
  v_milestone record;
  v_count integer := 0;
  v_reward bigint;
  v_company_key text;
  v_pilot_key text;
begin
  select *
  into v_account
  from public.pilot_career_accounts
  where pilot_id = p_pilot_id;

  if not found then
    return 0;
  end if;

  for v_milestone in
    select *
    from public.career_milestone_definitions
    where active = true
    order by threshold, code
  loop
    if (
      v_milestone.metric = 'flights'
      and p_previous_flights < v_milestone.threshold
      and v_account.completed_flights >= v_milestone.threshold
    ) or (
      v_milestone.metric = 'minutes'
      and p_previous_minutes < v_milestone.threshold
      and v_account.flight_minutes >= v_milestone.threshold
    ) then
      insert into public.pilot_career_milestones (
        pilot_id,
        milestone_id,
        source_pirep_id,
        reward_amount,
        achieved_at
      )
      values (
        p_pilot_id,
        v_milestone.id,
        p_source_pirep_id,
        v_milestone.reward_amount,
        now()
      )
      on conflict (pilot_id, milestone_id)
      do nothing;

      if found then
        v_reward := v_milestone.reward_amount;
        v_company_key := format(
          'milestone-company:%s:%s',
          p_pilot_id,
          v_milestone.id
        );
        v_pilot_key := format(
          'milestone-pilot:%s:%s',
          p_pilot_id,
          v_milestone.id
        );

        if v_reward > 0 then
          perform public.post_economy_ledger_entry(
            'company',
            null,
            v_account.organization_id,
            'MILESTONE_REWARD_EXPENSE',
            -v_reward,
            format(
              'Career milestone reward for %s',
              v_milestone.title
            ),
            v_company_key,
            p_pilot_id,
            p_source_pirep_id,
            null,
            null,
            null,
            null,
            null,
            jsonb_build_object(
              'milestoneCode', v_milestone.code,
              'pilotId', p_pilot_id
            )
          );

          perform public.post_economy_ledger_entry(
            'pilot',
            p_pilot_id,
            v_account.organization_id,
            'MILESTONE_REWARD',
            v_reward,
            format(
              'Career milestone reward: %s',
              v_milestone.title
            ),
            v_pilot_key,
            p_pilot_id,
            p_source_pirep_id,
            null,
            null,
            null,
            null,
            null,
            jsonb_build_object(
              'milestoneCode', v_milestone.code,
              'milestoneTitle', v_milestone.title
            )
          );
        end if;

        perform public.append_domain_event(
          p_event_type => 'career.milestone_achieved',
          p_aggregate_type => 'pilot_career',
          p_aggregate_id => p_pilot_id::text,
          p_actor_id => p_pilot_id::text,
          p_organization_id => v_account.organization_id,
          p_payload => jsonb_build_object(
            'pilotId', p_pilot_id,
            'milestoneCode', v_milestone.code,
            'milestoneTitle', v_milestone.title,
            'rewardAmount', v_reward,
            'sourcePirepId', p_source_pirep_id
          ),
          p_metadata => jsonb_build_object(
            'source', 'career-economy.milestones',
            'privacy', 'pilot_private'
          )
        );

        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.evaluate_pilot_career_milestones(
  uuid, uuid, integer, bigint
) from public, anon, authenticated;


create or replace function public.award_pirep_career_economy(
  p_pirep_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pirep public.pireps%rowtype;
  v_existing uuid;
  v_membership public.pilot_airline_memberships%rowtype;
  v_org text := 'kalabsha-airlines';
  v_policy public.economy_salary_policies%rowtype;
  v_score integer;
  v_salary bigint;
  v_bonus bigint := 0;
  v_xp bigint;
  v_previous_flights integer;
  v_previous_minutes bigint;
  v_award_id uuid;
begin
  select *
  into v_pirep
  from public.pireps
  where id = p_pirep_id;

  if not found then
    raise exception 'PIREP not found';
  end if;

  if v_pirep.status::text not in ('submitted', 'approved') then
    return null;
  end if;

  select award.pirep_id
  into v_existing
  from public.career_economy_pirep_awards award
  where award.pirep_id = v_pirep.id;

  if v_existing is not null then
    return v_existing;
  end if;

  select *
  into v_membership
  from public.pilot_airline_memberships membership
  where membership.pilot_id = v_pirep.pilot_id
    and membership.status = 'active'
  order by membership.is_primary desc, membership.joined_at
  limit 1;

  if found then
    v_org := v_membership.organization_id;
  end if;

  perform public.ensure_pilot_economy_account(
    v_pirep.pilot_id,
    v_org
  );

  insert into public.company_economy_accounts (
    organization_id,
    currency_code,
    balance,
    total_income,
    total_spent,
    updated_at
  )
  values (
    v_org,
    'KVA',
    0,
    0,
    0,
    now()
  )
  on conflict (organization_id) do nothing;

  select *
  into v_policy
  from public.economy_salary_policies
  where organization_id = v_org;

  if not found then
    insert into public.economy_salary_policies (
      organization_id
    )
    values (v_org)
    returning * into v_policy;
  end if;

  select debrief.overall_score
  into v_score
  from public.flight_companion_debriefs debrief
  where debrief.pirep_id = v_pirep.id
  limit 1;

  v_salary :=
    v_policy.base_salary +
    greatest(coalesce(v_pirep.block_minutes, 0), 0) *
      v_policy.per_block_minute;

  if v_score is not null
     and v_score >= v_policy.performance_threshold then
    v_bonus := v_policy.performance_bonus;
  end if;

  v_xp := 100 + greatest(coalesce(v_pirep.block_minutes, 0), 0);

  select
    account.completed_flights,
    account.flight_minutes
  into
    v_previous_flights,
    v_previous_minutes
  from public.pilot_career_accounts account
  where account.pilot_id = v_pirep.pilot_id
  for update;

  perform public.post_economy_ledger_entry(
    'company',
    null,
    v_org,
    'FLIGHT_SALARY_EXPENSE',
    -v_salary,
    format('Pilot salary expense for %s', v_pirep.flight_number),
    format('pirep-salary-company:%s', v_pirep.id),
    v_pirep.pilot_id,
    v_pirep.id,
    null,
    null,
    null,
    null,
    null,
    jsonb_build_object(
      'flightNumber', v_pirep.flight_number,
      'blockMinutes', v_pirep.block_minutes,
      'pilotId', v_pirep.pilot_id
    )
  );

  perform public.post_economy_ledger_entry(
    'pilot',
    v_pirep.pilot_id,
    v_org,
    'FLIGHT_SALARY',
    v_salary,
    format('Flight salary for %s', v_pirep.flight_number),
    format('pirep-salary-pilot:%s', v_pirep.id),
    v_pirep.pilot_id,
    v_pirep.id,
    null,
    null,
    null,
    null,
    null,
    jsonb_build_object(
      'flightNumber', v_pirep.flight_number,
      'blockMinutes', v_pirep.block_minutes
    )
  );

  if v_bonus > 0 then
    perform public.post_economy_ledger_entry(
      'company',
      null,
      v_org,
      'PERFORMANCE_BONUS_EXPENSE',
      -v_bonus,
      format('Performance bonus expense for %s', v_pirep.flight_number),
      format('pirep-bonus-company:%s', v_pirep.id),
      v_pirep.pilot_id,
      v_pirep.id,
      null,
      null,
      null,
      null,
      null,
      jsonb_build_object(
        'flightNumber', v_pirep.flight_number,
        'companionScore', v_score
      )
    );

    perform public.post_economy_ledger_entry(
      'pilot',
      v_pirep.pilot_id,
      v_org,
      'PERFORMANCE_BONUS',
      v_bonus,
      format('Performance bonus for %s', v_pirep.flight_number),
      format('pirep-bonus-pilot:%s', v_pirep.id),
      v_pirep.pilot_id,
      v_pirep.id,
      null,
      null,
      null,
      null,
      null,
      jsonb_build_object(
        'flightNumber', v_pirep.flight_number,
        'companionScore', v_score
      )
    );
  end if;

  update public.pilot_career_accounts
  set
    career_xp = career_xp + v_xp,
    completed_flights = completed_flights + 1,
    flight_minutes = flight_minutes +
      greatest(coalesce(v_pirep.block_minutes, 0), 0),
    lifetime_salary = lifetime_salary + v_salary,
    lifetime_bonus = lifetime_bonus + v_bonus,
    organization_id = v_org,
    updated_at = now()
  where pilot_id = v_pirep.pilot_id;

  insert into public.career_economy_pirep_awards (
    pirep_id,
    pilot_id,
    organization_id,
    salary_amount,
    performance_bonus,
    career_xp,
    companion_score,
    awarded_at
  )
  values (
    v_pirep.id,
    v_pirep.pilot_id,
    v_org,
    v_salary,
    v_bonus,
    v_xp,
    v_score,
    now()
  )
  returning pirep_id into v_award_id;

  perform public.append_domain_event(
    p_event_type => 'career.experience_awarded',
    p_aggregate_type => 'pilot_career',
    p_aggregate_id => v_pirep.pilot_id::text,
    p_actor_id => v_pirep.pilot_id::text,
    p_organization_id => v_org,
    p_payload => jsonb_build_object(
      'pilotId', v_pirep.pilot_id,
      'pirepId', v_pirep.id,
      'flightNumber', v_pirep.flight_number,
      'careerXp', v_xp,
      'blockMinutes', v_pirep.block_minutes
    ),
    p_metadata => jsonb_build_object(
      'source', 'career-economy.pirep',
      'privacy', 'pilot_private'
    )
  );

  perform public.append_domain_event(
    p_event_type => 'economy.salary_awarded',
    p_aggregate_type => 'pilot_wallet',
    p_aggregate_id => v_pirep.pilot_id::text,
    p_actor_id => v_pirep.pilot_id::text,
    p_organization_id => v_org,
    p_payload => jsonb_build_object(
      'pilotId', v_pirep.pilot_id,
      'pirepId', v_pirep.id,
      'flightNumber', v_pirep.flight_number,
      'salaryAmount', v_salary,
      'performanceBonus', v_bonus,
      'companionScore', v_score
    ),
    p_metadata => jsonb_build_object(
      'source', 'career-economy.salary',
      'privacy', 'pilot_private'
    )
  );

  if v_bonus > 0 then
    perform public.append_domain_event(
      p_event_type => 'economy.bonus_awarded',
      p_aggregate_type => 'pilot_wallet',
      p_aggregate_id => v_pirep.pilot_id::text,
      p_actor_id => v_pirep.pilot_id::text,
      p_organization_id => v_org,
      p_payload => jsonb_build_object(
        'pilotId', v_pirep.pilot_id,
        'pirepId', v_pirep.id,
        'flightNumber', v_pirep.flight_number,
        'bonusAmount', v_bonus,
        'companionScore', v_score
      ),
      p_metadata => jsonb_build_object(
        'source', 'career-economy.performance',
        'privacy', 'pilot_private'
      )
    );
  end if;

  perform public.evaluate_pilot_career_rank(
    v_pirep.pilot_id,
    v_pirep.id
  );

  perform public.evaluate_pilot_career_milestones(
    v_pirep.pilot_id,
    v_pirep.id,
    v_previous_flights,
    v_previous_minutes
  );

  return v_award_id;
end;
$$;

revoke all on function public.award_pirep_career_economy(uuid)
from public, anon, authenticated;


create or replace function public.handle_pirep_career_economy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status::text in ('submitted', 'approved') then
    begin
      perform public.award_pirep_career_economy(new.id);
    exception
      when others then
        raise warning
          'Career & Economy could not process PIREP %: %',
          new.id,
          sqlerrm;
    end;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_pirep_career_economy()
from public, anon, authenticated;

drop trigger if exists zz_after_pirep_career_economy
on public.pireps;

create trigger zz_after_pirep_career_economy
after insert or update of status
on public.pireps
for each row
execute function public.handle_pirep_career_economy();


create or replace function public.award_global_event_economy_reward(
  p_achievement_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_achievement public.global_aviation_event_achievements%rowtype;
  v_participation public.global_aviation_event_participations%rowtype;
  v_policy public.economy_salary_policies%rowtype;
  v_reward bigint;
begin
  select *
  into v_achievement
  from public.global_aviation_event_achievements
  where id = p_achievement_id;

  if not found then
    return;
  end if;

  select *
  into v_participation
  from public.global_aviation_event_participations
  where id = v_achievement.participation_id;

  if not found then
    return;
  end if;

  select *
  into v_policy
  from public.economy_salary_policies
  where organization_id = v_participation.organization_id;

  if not found then
    insert into public.economy_salary_policies (
      organization_id
    )
    values (v_participation.organization_id)
    returning * into v_policy;
  end if;

  v_reward := v_policy.event_completion_reward;

  if v_reward <= 0 then
    return;
  end if;

  perform public.post_economy_ledger_entry(
    'company',
    null,
    v_participation.organization_id,
    'EVENT_REWARD_EXPENSE',
    -v_reward,
    format(
      'Global event completion reward expense for %s',
      v_achievement.badge_name
    ),
    format('event-reward-company:%s', v_achievement.id),
    v_achievement.pilot_id,
    null,
    v_achievement.event_id,
    null,
    null,
    null,
    null,
    jsonb_build_object(
      'achievementId', v_achievement.id,
      'badgeCode', v_achievement.badge_code,
      'pilotId', v_achievement.pilot_id
    )
  );

  perform public.post_economy_ledger_entry(
    'pilot',
    v_achievement.pilot_id,
    v_participation.organization_id,
    'EVENT_REWARD',
    v_reward,
    format(
      'Global event completion reward: %s',
      v_achievement.badge_name
    ),
    format('event-reward-pilot:%s', v_achievement.id),
    v_achievement.pilot_id,
    null,
    v_achievement.event_id,
    null,
    null,
    null,
    null,
    jsonb_build_object(
      'achievementId', v_achievement.id,
      'badgeCode', v_achievement.badge_code,
      'badgeName', v_achievement.badge_name
    )
  );
end;
$$;

revoke all on function public.award_global_event_economy_reward(uuid)
from public, anon, authenticated;


create or replace function public.handle_global_event_economy_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.award_global_event_economy_reward(new.id);
  exception
    when others then
      raise warning
        'Career & Economy could not award global event reward %: %',
        new.id,
        sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.handle_global_event_economy_reward()
from public, anon, authenticated;

drop trigger if exists after_global_event_economy_reward
on public.global_aviation_event_achievements;

create trigger after_global_event_economy_reward
after insert
on public.global_aviation_event_achievements
for each row
execute function public.handle_global_event_economy_reward();


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

  if not v_item.repeatable
     and exists (
       select 1
       from public.pilot_marketplace_purchases purchase
       where purchase.pilot_id = v_user_id
         and purchase.item_id = v_item.id
     ) then
    raise exception 'You already own this marketplace item';
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
      'category', v_item.category
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


create or replace function public.contribute_route_support(
  p_campaign_id uuid,
  p_amount bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_campaign public.route_support_campaigns%rowtype;
  v_account public.pilot_career_accounts%rowtype;
  v_contribution_id uuid;
  v_new_funded bigint;
  v_goal_reached boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_amount <= 0 then
    raise exception 'Contribution amount must be positive';
  end if;

  select *
  into v_campaign
  from public.route_support_campaigns
  where id = p_campaign_id
  for update;

  if not found then
    raise exception 'Route support campaign not found';
  end if;

  if v_campaign.status not in ('active', 'goal_reached') then
    raise exception 'This route support campaign is not accepting contributions';
  end if;

  select *
  into v_account
  from public.pilot_career_accounts
  where pilot_id = v_user_id;

  if not found then
    perform public.ensure_pilot_economy_account(
      v_user_id,
      v_campaign.organization_id
    );

    select *
    into v_account
    from public.pilot_career_accounts
    where pilot_id = v_user_id;
  end if;

  if v_account.organization_id <> v_campaign.organization_id then
    raise exception 'Campaign belongs to a different airline organization';
  end if;

  insert into public.route_support_contributions (
    campaign_id,
    pilot_id,
    organization_id,
    amount,
    contributed_at
  )
  values (
    v_campaign.id,
    v_user_id,
    v_campaign.organization_id,
    p_amount,
    now()
  )
  returning id into v_contribution_id;

  perform public.post_economy_ledger_entry(
    'pilot',
    v_user_id,
    v_campaign.organization_id,
    'ROUTE_SUPPORT_CONTRIBUTION',
    -p_amount,
    format('Route support contribution: %s', v_campaign.title),
    format('route-support-pilot:%s', v_contribution_id),
    v_user_id,
    null,
    null,
    null,
    null,
    v_campaign.id,
    null,
    jsonb_build_object(
      'contributionId', v_contribution_id,
      'campaignCode', v_campaign.code,
      'campaignTitle', v_campaign.title
    )
  );

  perform public.post_economy_ledger_entry(
    'company',
    null,
    v_campaign.organization_id,
    'ROUTE_SUPPORT_FUNDS_RECEIVED',
    p_amount,
    format('Pilot route-support funds received: %s', v_campaign.title),
    format('route-support-company:%s', v_contribution_id),
    v_user_id,
    null,
    null,
    null,
    null,
    v_campaign.id,
    null,
    jsonb_build_object(
      'contributionId', v_contribution_id,
      'pilotId', v_user_id,
      'campaignCode', v_campaign.code
    )
  );

  update public.route_support_campaigns
  set
    funded_amount = funded_amount + p_amount,
    status = case
      when funded_amount + p_amount >= target_amount
        then 'goal_reached'
      else status
    end,
    updated_at = now()
  where id = v_campaign.id
  returning
    funded_amount,
    status = 'goal_reached'
  into
    v_new_funded,
    v_goal_reached;

  perform public.append_domain_event(
    p_event_type => 'route_support.contribution_created',
    p_aggregate_type => 'route_support_campaign',
    p_aggregate_id => v_campaign.id::text,
    p_actor_id => v_user_id::text,
    p_organization_id => v_campaign.organization_id,
    p_payload => jsonb_build_object(
      'campaignId', v_campaign.id,
      'campaignCode', v_campaign.code,
      'contributionId', v_contribution_id,
      'pilotId', v_user_id,
      'amount', p_amount,
      'fundedAmount', v_new_funded,
      'targetAmount', v_campaign.target_amount
    ),
    p_metadata => jsonb_build_object(
      'source', 'career-economy.route-support',
      'privacy', 'pilot_private'
    )
  );

  if v_goal_reached then
    perform public.append_domain_event(
      p_event_type => 'route_support.goal_reached',
      p_aggregate_type => 'route_support_campaign',
      p_aggregate_id => v_campaign.id::text,
      p_actor_id => v_user_id::text,
      p_organization_id => v_campaign.organization_id,
      p_payload => jsonb_build_object(
        'campaignId', v_campaign.id,
        'campaignCode', v_campaign.code,
        'fundedAmount', v_new_funded,
        'targetAmount', v_campaign.target_amount,
        'operationsDecisionRequired', true
      ),
      p_metadata => jsonb_build_object(
        'source', 'career-economy.route-support',
        'privacy', 'internal'
      )
    );
  end if;

  return v_contribution_id;
end;
$$;

revoke all on function public.contribute_route_support(uuid, bigint)
from public, anon;

grant execute on function public.contribute_route_support(uuid, bigint)
to authenticated;


create or replace function public.purchase_company_marketplace_item(
  p_item_id uuid,
  p_organization_id text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.company_marketplace_items%rowtype;
  v_purchase_id uuid;
  v_asset_id uuid;
  v_event_type text := 'company_marketplace.item_purchased';
begin
  if p_actor_id is null then
    raise exception 'Operations actor is required';
  end if;

  select *
  into v_item
  from public.company_marketplace_items
  where id = p_item_id
    and active = true;

  if not found then
    raise exception 'Company marketplace item is unavailable';
  end if;

  insert into public.company_marketplace_purchases (
    organization_id,
    item_id,
    actor_id,
    price_paid,
    purchased_at
  )
  values (
    p_organization_id,
    v_item.id,
    p_actor_id,
    v_item.price,
    now()
  )
  returning id into v_purchase_id;

  insert into public.company_economy_assets (
    organization_id,
    purchase_id,
    asset_kind,
    fleet_type_id,
    status,
    metadata,
    acquired_at
  )
  values (
    p_organization_id,
    v_purchase_id,
    v_item.item_kind,
    v_item.fleet_type_id,
    'acquired',
    jsonb_build_object(
      'itemCode', v_item.code,
      'itemName', v_item.name,
      'marketplaceItemId', v_item.id,
      'fleetMutationPerformed', false,
      'fleetDecisionAuthority', 'operations'
    ) || coalesce(v_item.metadata, '{}'::jsonb),
    now()
  )
  returning id into v_asset_id;

  perform public.post_economy_ledger_entry(
    'company',
    null,
    p_organization_id,
    'COMPANY_MARKETPLACE_PURCHASE',
    -v_item.price,
    format('Company Marketplace purchase: %s', v_item.name),
    format('company-marketplace:%s', v_purchase_id),
    p_actor_id,
    null,
    null,
    null,
    v_item.id,
    null,
    v_asset_id,
    jsonb_build_object(
      'purchaseId', v_purchase_id,
      'itemCode', v_item.code,
      'itemKind', v_item.item_kind,
      'fleetMutationPerformed', false
    )
  );

  perform public.append_domain_event(
    p_event_type => 'company_marketplace.item_purchased',
    p_aggregate_type => 'company_marketplace_purchase',
    p_aggregate_id => v_purchase_id::text,
    p_actor_id => p_actor_id::text,
    p_organization_id => p_organization_id,
    p_payload => jsonb_build_object(
      'purchaseId', v_purchase_id,
      'organizationId', p_organization_id,
      'itemId', v_item.id,
      'itemCode', v_item.code,
      'itemName', v_item.name,
      'itemKind', v_item.item_kind,
      'price', v_item.price,
      'companyAssetId', v_asset_id
    ),
    p_metadata => jsonb_build_object(
      'source', 'career-economy.company-marketplace',
      'privacy', 'internal'
    )
  );

  if v_item.item_kind = 'aircraft_purchase' then
    v_event_type := 'company.aircraft_purchased';
  elsif v_item.item_kind = 'aircraft_lease' then
    v_event_type := 'company.aircraft_leased';
  end if;

  if v_event_type <> 'company_marketplace.item_purchased' then
    perform public.append_domain_event(
      p_event_type => v_event_type,
      p_aggregate_type => 'company_economy_asset',
      p_aggregate_id => v_asset_id::text,
      p_actor_id => p_actor_id::text,
      p_organization_id => p_organization_id,
      p_payload => jsonb_build_object(
        'companyAssetId', v_asset_id,
        'purchaseId', v_purchase_id,
        'organizationId', p_organization_id,
        'itemCode', v_item.code,
        'itemName', v_item.name,
        'fleetTypeId', v_item.fleet_type_id,
        'price', v_item.price,
        'fleetMutationPerformed', false,
        'fleetManagementRemainsOperationsOnly', true
      ),
      p_metadata => jsonb_build_object(
        'source', 'career-economy.company-marketplace',
        'privacy', 'internal'
      )
    );
  end if;

  insert into public.economy_admin_audit (
    actor_id,
    organization_id,
    action,
    target_type,
    target_id,
    details,
    created_at
  )
  values (
    p_actor_id,
    p_organization_id,
    'company_marketplace_purchase',
    'company_marketplace_item',
    v_item.id::text,
    jsonb_build_object(
      'purchaseId', v_purchase_id,
      'companyAssetId', v_asset_id,
      'itemCode', v_item.code,
      'itemKind', v_item.item_kind,
      'price', v_item.price
    ),
    now()
  );

  return v_purchase_id;
end;
$$;

revoke all on function public.purchase_company_marketplace_item(
  uuid, text, uuid
) from public, anon, authenticated;

grant execute on function public.purchase_company_marketplace_item(
  uuid, text, uuid
) to service_role;


create or replace function public.upsert_economy_salary_policy(
  p_organization_id text,
  p_base_salary bigint,
  p_per_block_minute bigint,
  p_performance_threshold integer,
  p_performance_bonus bigint,
  p_event_completion_reward bigint,
  p_milestone_reward bigint,
  p_actor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_base_salary < 0
     or p_per_block_minute < 0
     or p_performance_bonus < 0
     or p_event_completion_reward < 0
     or p_milestone_reward < 0 then
    raise exception 'Economy policy values cannot be negative';
  end if;

  if p_performance_threshold < 0
     or p_performance_threshold > 100 then
    raise exception 'Performance threshold must be between 0 and 100';
  end if;

  insert into public.economy_salary_policies (
    organization_id,
    base_salary,
    per_block_minute,
    performance_threshold,
    performance_bonus,
    event_completion_reward,
    milestone_reward,
    updated_by,
    updated_at
  )
  values (
    p_organization_id,
    p_base_salary,
    p_per_block_minute,
    p_performance_threshold,
    p_performance_bonus,
    p_event_completion_reward,
    p_milestone_reward,
    p_actor_id,
    now()
  )
  on conflict (organization_id)
  do update set
    base_salary = excluded.base_salary,
    per_block_minute = excluded.per_block_minute,
    performance_threshold = excluded.performance_threshold,
    performance_bonus = excluded.performance_bonus,
    event_completion_reward = excluded.event_completion_reward,
    milestone_reward = excluded.milestone_reward,
    updated_by = excluded.updated_by,
    updated_at = now();

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
    'salary_policy_updated',
    'economy_salary_policy',
    p_organization_id,
    jsonb_build_object(
      'baseSalary', p_base_salary,
      'perBlockMinute', p_per_block_minute,
      'performanceThreshold', p_performance_threshold,
      'performanceBonus', p_performance_bonus,
      'eventCompletionReward', p_event_completion_reward,
      'milestoneReward', p_milestone_reward
    )
  );

  return true;
end;
$$;

revoke all on function public.upsert_economy_salary_policy(
  text, bigint, bigint, integer, bigint, bigint, bigint, uuid
) from public, anon, authenticated;

grant execute on function public.upsert_economy_salary_policy(
  text, bigint, bigint, integer, bigint, bigint, bigint, uuid
) to service_role;


create or replace function public.create_pilot_marketplace_item(
  p_code text,
  p_name text,
  p_description text,
  p_category text,
  p_price bigint,
  p_repeatable boolean,
  p_actor_id uuid,
  p_organization_id text default 'kalabsha-airlines'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_category not in (
    'profile_cosmetic',
    'passport_frame',
    'career_display',
    'profile_theme',
    'collectible',
    'commemorative'
  ) then
    raise exception 'Invalid Pilot Marketplace category';
  end if;

  if p_price <= 0 then
    raise exception 'Marketplace price must be positive';
  end if;

  insert into public.pilot_marketplace_items (
    code,
    name,
    description,
    category,
    price,
    repeatable,
    active,
    created_at,
    updated_at
  )
  values (
    upper(btrim(p_code)),
    btrim(p_name),
    btrim(p_description),
    p_category,
    p_price,
    p_repeatable,
    true,
    now(),
    now()
  )
  returning id into v_id;

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
    'pilot_marketplace_item_created',
    'pilot_marketplace_item',
    v_id::text,
    jsonb_build_object(
      'code', upper(btrim(p_code)),
      'name', btrim(p_name),
      'category', p_category,
      'price', p_price
    )
  );

  return v_id;
end;
$$;

revoke all on function public.create_pilot_marketplace_item(
  text, text, text, text, bigint, boolean, uuid, text
) from public, anon, authenticated;

grant execute on function public.create_pilot_marketplace_item(
  text, text, text, text, bigint, boolean, uuid, text
) to service_role;


create or replace function public.create_company_marketplace_item(
  p_code text,
  p_name text,
  p_description text,
  p_item_kind text,
  p_fleet_type_id uuid,
  p_price bigint,
  p_actor_id uuid,
  p_organization_id text default 'kalabsha-airlines'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_item_kind not in (
    'aircraft_purchase',
    'aircraft_lease',
    'fleet_capacity',
    'operational_asset',
    'expansion',
    'service'
  ) then
    raise exception 'Invalid Company Marketplace item kind';
  end if;

  if p_price <= 0 then
    raise exception 'Marketplace price must be positive';
  end if;

  insert into public.company_marketplace_items (
    code,
    name,
    description,
    item_kind,
    fleet_type_id,
    price,
    active,
    metadata,
    created_at,
    updated_at
  )
  values (
    upper(btrim(p_code)),
    btrim(p_name),
    btrim(p_description),
    p_item_kind,
    p_fleet_type_id,
    p_price,
    true,
    jsonb_build_object(
      'fleetAuthority', 'operations',
      'pilotPurchasable', false
    ),
    now(),
    now()
  )
  returning id into v_id;

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
    'company_marketplace_item_created',
    'company_marketplace_item',
    v_id::text,
    jsonb_build_object(
      'code', upper(btrim(p_code)),
      'name', btrim(p_name),
      'itemKind', p_item_kind,
      'fleetTypeId', p_fleet_type_id,
      'price', p_price
    )
  );

  return v_id;
end;
$$;

revoke all on function public.create_company_marketplace_item(
  text, text, text, text, uuid, bigint, uuid, text
) from public, anon, authenticated;

grant execute on function public.create_company_marketplace_item(
  text, text, text, text, uuid, bigint, uuid, text
) to service_role;


create or replace function public.create_route_support_campaign(
  p_code text,
  p_title text,
  p_description text,
  p_departure_airport_id uuid,
  p_arrival_airport_id uuid,
  p_target_amount bigint,
  p_actor_id uuid,
  p_organization_id text default 'kalabsha-airlines'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_target_amount <= 0 then
    raise exception 'Route support target must be positive';
  end if;

  if p_departure_airport_id = p_arrival_airport_id then
    raise exception 'Departure and arrival airports must be different';
  end if;

  insert into public.route_support_campaigns (
    organization_id,
    code,
    title,
    description,
    departure_airport_id,
    arrival_airport_id,
    target_amount,
    funded_amount,
    status,
    created_by,
    created_at,
    updated_at
  )
  values (
    p_organization_id,
    upper(btrim(p_code)),
    btrim(p_title),
    btrim(p_description),
    p_departure_airport_id,
    p_arrival_airport_id,
    p_target_amount,
    0,
    'active',
    p_actor_id,
    now(),
    now()
  )
  returning id into v_id;

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
    'route_support_campaign_created',
    'route_support_campaign',
    v_id::text,
    jsonb_build_object(
      'code', upper(btrim(p_code)),
      'title', btrim(p_title),
      'targetAmount', p_target_amount,
      'operationalAuthorityRequired', true
    )
  );

  return v_id;
end;
$$;

revoke all on function public.create_route_support_campaign(
  text, text, text, uuid, uuid, bigint, uuid, text
) from public, anon, authenticated;

grant execute on function public.create_route_support_campaign(
  text, text, text, uuid, uuid, bigint, uuid, text
) to service_role;


create or replace function public.review_route_support_campaign(
  p_campaign_id uuid,
  p_status text,
  p_note text,
  p_actor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.route_support_campaigns%rowtype;
begin
  if p_status not in (
    'under_review',
    'approved',
    'rejected',
    'closed'
  ) then
    raise exception 'Invalid route-support review status';
  end if;

  select *
  into v_campaign
  from public.route_support_campaigns
  where id = p_campaign_id
  for update;

  if not found then
    raise exception 'Route support campaign not found';
  end if;

  update public.route_support_campaigns
  set
    status = p_status,
    operations_note = nullif(btrim(p_note), ''),
    reviewed_by = p_actor_id,
    reviewed_at = now(),
    updated_at = now()
  where id = p_campaign_id;

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
    v_campaign.organization_id,
    'route_support_campaign_reviewed',
    'route_support_campaign',
    p_campaign_id::text,
    jsonb_build_object(
      'status', p_status,
      'note', nullif(btrim(p_note), ''),
      'fundedAmount', v_campaign.funded_amount,
      'targetAmount', v_campaign.target_amount,
      'routeActivationPerformed', false
    )
  );

  perform public.append_domain_event(
    p_event_type => 'route_support.operations_reviewed',
    p_aggregate_type => 'route_support_campaign',
    p_aggregate_id => p_campaign_id::text,
    p_actor_id => p_actor_id::text,
    p_organization_id => v_campaign.organization_id,
    p_payload => jsonb_build_object(
      'campaignId', p_campaign_id,
      'campaignCode', v_campaign.code,
      'status', p_status,
      'fundedAmount', v_campaign.funded_amount,
      'targetAmount', v_campaign.target_amount,
      'routeActivationPerformed', false,
      'operationsDecisionOnly', true
    ),
    p_metadata => jsonb_build_object(
      'source', 'career-economy.operations',
      'privacy', 'internal'
    )
  );

  return true;
end;
$$;

revoke all on function public.review_route_support_campaign(
  uuid, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.review_route_support_campaign(
  uuid, text, text, uuid
) to service_role;


create or replace function public.get_pilot_career_economy_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.pilot_career_accounts%rowtype;
  v_wallet public.pilot_wallets%rowtype;
  v_next_rank jsonb;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_account
  from public.pilot_career_accounts
  where pilot_id = v_user_id;

  if not found then
    raise exception 'Career account is not initialized';
  end if;

  select *
  into v_wallet
  from public.pilot_wallets
  where pilot_id = v_user_id;

  select jsonb_build_object(
    'code', rank.code,
    'name', rank.name,
    'minimumHours', rank.minimum_hours,
    'minimumFlights', rank.minimum_flights,
    'priority', rank.priority
  )
  into v_next_rank
  from public.ranks current_rank
  join public.ranks rank
    on rank.priority > current_rank.priority
  where current_rank.code = v_account.current_rank_code
  order by rank.priority
  limit 1;

  select jsonb_build_object(
    'career', jsonb_build_object(
      'careerXp', v_account.career_xp,
      'completedFlights', v_account.completed_flights,
      'flightMinutes', v_account.flight_minutes,
      'currentRankCode', v_account.current_rank_code,
      'lifetimeSalary', v_account.lifetime_salary,
      'lifetimeBonus', v_account.lifetime_bonus,
      'nextRank', v_next_rank
    ),
    'wallet', jsonb_build_object(
      'currencyCode', coalesce(v_wallet.currency_code, 'KVA'),
      'balance', coalesce(v_wallet.balance, 0),
      'totalEarned', coalesce(v_wallet.total_earned, 0),
      'totalSpent', coalesce(v_wallet.total_spent, 0)
    ),
    'recentTransactions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', ledger.id,
          'transactionType', ledger.transaction_type,
          'amount', ledger.amount,
          'description', ledger.description,
          'sourcePirepId', ledger.source_pirep_id,
          'sourceEventId', ledger.source_event_id,
          'routeCampaignId', ledger.route_campaign_id,
          'createdAt', ledger.created_at
        )
        order by ledger.created_at desc
      )
      from (
        select *
        from public.economy_ledger
        where owner_scope = 'pilot'
          and pilot_id = v_user_id
        order by created_at desc
        limit 20
      ) ledger
    ), '[]'::jsonb),
    'marketplace', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item.id,
          'code', item.code,
          'name', item.name,
          'description', item.description,
          'category', item.category,
          'price', item.price,
          'repeatable', item.repeatable,
          'owned', exists (
            select 1
            from public.pilot_marketplace_purchases purchase
            where purchase.pilot_id = v_user_id
              and purchase.item_id = item.id
          )
        )
        order by item.price, item.name
      )
      from public.pilot_marketplace_items item
      where item.active = true
    ), '[]'::jsonb),
    'routeCampaigns', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', campaign.id,
          'code', campaign.code,
          'title', campaign.title,
          'description', campaign.description,
          'departure', departure.icao_code,
          'departureName', departure.name,
          'arrival', arrival.icao_code,
          'arrivalName', arrival.name,
          'targetAmount', campaign.target_amount,
          'fundedAmount', campaign.funded_amount,
          'status', campaign.status,
          'myContribution', coalesce((
            select sum(contribution.amount)
            from public.route_support_contributions contribution
            where contribution.campaign_id = campaign.id
              and contribution.pilot_id = v_user_id
          ), 0),
          'operationsNote', case
            when campaign.status in ('approved', 'rejected', 'closed')
              then campaign.operations_note
            else null
          end
        )
        order by campaign.created_at desc
      )
      from public.route_support_campaigns campaign
      join public.airports departure
        on departure.id = campaign.departure_airport_id
      join public.airports arrival
        on arrival.id = campaign.arrival_airport_id
      where campaign.organization_id = v_account.organization_id
        and campaign.status in (
          'active',
          'goal_reached',
          'under_review',
          'approved'
        )
    ), '[]'::jsonb),
    'milestones', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', achieved.id,
          'code', definition.code,
          'title', definition.title,
          'description', definition.description,
          'rewardAmount', achieved.reward_amount,
          'achievedAt', achieved.achieved_at
        )
        order by achieved.achieved_at desc
      )
      from public.pilot_career_milestones achieved
      join public.career_milestone_definitions definition
        on definition.id = achieved.milestone_id
      where achieved.pilot_id = v_user_id
    ), '[]'::jsonb),
    'promotions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', promotion.id,
          'fromRank', promotion.from_rank_code,
          'toRank', promotion.to_rank_code,
          'careerXp', promotion.career_xp,
          'completedFlights', promotion.completed_flights,
          'flightMinutes', promotion.flight_minutes,
          'promotedAt', promotion.promoted_at
        )
        order by promotion.promoted_at desc
      )
      from (
        select *
        from public.career_promotion_history
        where pilot_id = v_user_id
        order by promoted_at desc
        limit 10
      ) promotion
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_pilot_career_economy_dashboard()
from public, anon;

grant execute on function public.get_pilot_career_economy_dashboard()
to authenticated;


-- Seed salary and reward policy for each current KVA OS organization.
insert into public.economy_salary_policies (
  organization_id,
  base_salary,
  per_block_minute,
  performance_threshold,
  performance_bonus,
  event_completion_reward,
  milestone_reward,
  updated_at
)
select
  organization.id,
  500,
  10,
  85,
  250,
  500,
  750,
  now()
from public.platform_organizations organization
on conflict (organization_id) do nothing;

-- Seed career accounts from verified profile totals without retroactively
-- paying historical salaries.
do $$
declare
  v_profile record;
  v_membership record;
  v_org text;
begin
  for v_profile in
    select profile.id
    from public.profiles profile
  loop
    v_org := 'kalabsha-airlines';

    select membership.organization_id
    into v_membership
    from public.pilot_airline_memberships membership
    where membership.pilot_id = v_profile.id
      and membership.status = 'active'
    order by membership.is_primary desc, membership.joined_at
    limit 1;

    if found then
      v_org := v_membership.organization_id;
    end if;

    perform public.ensure_pilot_economy_account(
      v_profile.id,
      v_org
    );
  end loop;
end
$$;

insert into public.company_economy_accounts (
  organization_id,
  currency_code,
  balance,
  total_income,
  total_spent,
  updated_at
)
select
  organization.id,
  'KVA',
  0,
  0,
  0,
  now()
from public.platform_organizations organization
on conflict (organization_id) do nothing;

-- Founder-company opening treasury. This is a ledger transaction, not a
-- direct editable balance.
select public.post_economy_ledger_entry(
  'company',
  null,
  'kalabsha-airlines',
  'COMPANY_OPENING_BALANCE',
  5000000,
  'KVA OS Career & Economy v1.0 opening treasury',
  'career-economy-v1:kalabsha-opening-balance',
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  jsonb_build_object(
    'source', 'career-economy-v1-bootstrap',
    'openingBalance', true
  )
)
where exists (
  select 1
  from public.platform_organizations organization
  where organization.id = 'kalabsha-airlines'
);

insert into public.career_milestone_definitions (
  code,
  title,
  description,
  metric,
  threshold,
  reward_amount,
  active
)
values
  (
    'FIRST_10_FLIGHTS',
    'Ten Flight Foundation',
    'Complete 10 evidence-backed flights in your KVA OS career.',
    'flights',
    10,
    750,
    true
  ),
  (
    'FIFTY_HOURS',
    'Fifty Hour Milestone',
    'Record 50 hours of evidence-backed flight time.',
    'minutes',
    3000,
    1000,
    true
  ),
  (
    'ONE_HUNDRED_FLIGHTS',
    'Century of Flights',
    'Complete 100 evidence-backed flights.',
    'flights',
    100,
    2000,
    true
  )
on conflict (code) do nothing;

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
values
  (
    'PILOT-FRAME-SKY-01',
    'Skyline Passport Frame',
    'A blue aviation frame for your Universal Pilot Passport presentation.',
    'passport_frame',
    400,
    false,
    true,
    jsonb_build_object('visualOnly', true)
  ),
  (
    'PILOT-THEME-NIGHT-01',
    'Night Operations Profile Theme',
    'A dark operations-inspired profile presentation theme.',
    'profile_theme',
    650,
    false,
    true,
    jsonb_build_object('visualOnly', true)
  ),
  (
    'PILOT-COLLECTIBLE-FOUNDERS-01',
    'KVA OS Founder Flight Collectible',
    'A commemorative digital collectible celebrating the KVA OS founding era.',
    'commemorative',
    900,
    false,
    true,
    jsonb_build_object('collectible', true)
  )
on conflict (code) do nothing;

-- Seed company-only aircraft opportunities from existing fleet types.
insert into public.company_marketplace_items (
  code,
  name,
  description,
  item_kind,
  fleet_type_id,
  price,
  active,
  metadata
)
select
  'COMPANY-A21N-PURCHASE-01',
  'A21N Fleet Acquisition',
  'Company-only acquisition opportunity. Purchasing records an economic asset; fleet registration remains a separate Operations decision.',
  'aircraft_purchase',
  fleet.id,
  1500000,
  true,
  jsonb_build_object(
    'pilotPurchasable', false,
    'fleetAuthority', 'operations',
    'fleetMutationPerformed', false
  )
from public.fleet_types fleet
where fleet.icao_code = 'A21N'
limit 1
on conflict (code) do nothing;

insert into public.company_marketplace_items (
  code,
  name,
  description,
  item_kind,
  fleet_type_id,
  price,
  active,
  metadata
)
select
  'COMPANY-A333-LEASE-01',
  'A333 Operating Lease',
  'Company-only lease opportunity. The economic lease does not automatically add or modify an aircraft registration.',
  'aircraft_lease',
  fleet.id,
  750000,
  true,
  jsonb_build_object(
    'pilotPurchasable', false,
    'fleetAuthority', 'operations',
    'fleetMutationPerformed', false
  )
from public.fleet_types fleet
where fleet.icao_code = 'A333'
limit 1
on conflict (code) do nothing;

-- Seed one route-interest campaign when both airports exist.
insert into public.route_support_campaigns (
  organization_id,
  code,
  title,
  description,
  departure_airport_id,
  arrival_airport_id,
  target_amount,
  funded_amount,
  status,
  created_at,
  updated_at
)
select
  'kalabsha-airlines',
  'ROUTE-INTEREST-HECA-OEJN',
  'Cairo → Jeddah Community Interest',
  'Pilots can support this campaign to demonstrate route interest. Reaching the target does not open the route automatically; Operations must review the result.',
  departure.id,
  arrival.id,
  3000,
  0,
  'active',
  now(),
  now()
from public.airports departure
cross join public.airports arrival
where departure.icao_code = 'HECA'
  and arrival.icao_code = 'OEJN'
  and exists (
    select 1
    from public.platform_organizations organization
    where organization.id = 'kalabsha-airlines'
  )
limit 1
on conflict (code) do nothing;

-- Evidence-backed event achievements that existed before Career & Economy v1.0
-- are eligible for their event-completion reward.
do $$
declare
  v_achievement record;
begin
  for v_achievement in
    select achievement.id
    from public.global_aviation_event_achievements achievement
    order by achievement.awarded_at, achievement.id
  loop
    begin
      perform public.award_global_event_economy_reward(
        v_achievement.id
      );
    exception
      when others then
        raise warning
          'Could not backfill economy reward for event achievement %: %',
          v_achievement.id,
          sqlerrm;
    end;
  end loop;
end
$$;
