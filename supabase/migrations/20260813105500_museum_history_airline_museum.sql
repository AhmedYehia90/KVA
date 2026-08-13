-- KVA OS Pillar 09 — Museum / History RC2
-- Airline Museum + company legacy projection.
--
-- Architecture:
--   1. Operational/economy tables remain authoritative for derived facts.
--   2. Curated company history is stored separately and explicitly labelled.
--   3. This feature never mutates fleet, routes, PIREPs, career or economy.

create table if not exists public.museum_company_history_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null
    references public.platform_organizations(id) on delete cascade,
  category text not null default 'company_history' check (
    category in (
      'company_history',
      'fleet_history',
      'network_history',
      'community_history',
      'event_history',
      'technology_history',
      'other'
    )
  ),
  title text not null,
  summary text not null,
  details text,
  occurred_on date,
  era_label text,
  evidence jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_museum_company_history_org
on public.museum_company_history_entries(
  organization_id,
  is_published,
  occurred_on desc,
  created_at desc
);

alter table public.museum_company_history_entries enable row level security;

drop policy if exists museum_company_history_org_read
on public.museum_company_history_entries;

create policy museum_company_history_org_read
on public.museum_company_history_entries
for select
to authenticated
using (
  is_published
  and exists (
    select 1
    from public.pilot_career_accounts account
    where account.pilot_id = auth.uid()
      and account.organization_id =
        museum_company_history_entries.organization_id
  )
);

drop policy if exists museum_company_history_staff_manage
on public.museum_company_history_entries;

create policy museum_company_history_staff_manage
on public.museum_company_history_entries
for all
to authenticated
using (public.is_staff())
with check (public.is_staff());


create or replace function public.get_airline_museum_history()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id text;
  v_account jsonb := '{}'::jsonb;
  v_summary jsonb := '{}'::jsonb;
  v_pilot_connection jsonb := '{}'::jsonb;
  v_timeline jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select account.organization_id
  into v_org_id
  from public.pilot_career_accounts account
  where account.pilot_id = v_user_id;

  if v_org_id is null then
    raise exception 'Pilot career organization not found';
  end if;

  select jsonb_build_object(
    'organizationId', company.organization_id,
    'currencyCode', company.currency_code,
    'balance', company.balance,
    'totalIncome', company.total_income,
    'totalSpent', company.total_spent
  )
  into v_account
  from public.company_economy_accounts company
  where company.organization_id = v_org_id;

  select jsonb_build_object(
    'organizationId', v_org_id,
    'displayName',
      case
        when v_org_id = 'kalabsha-airlines' then 'Kalabsha Airlines'
        else v_org_id
      end,
    'founderAirline', (v_org_id = 'kalabsha-airlines'),
    'companyAssets', (
      select count(*)::integer
      from public.company_economy_assets asset
      where asset.organization_id = v_org_id
        and asset.status not in ('cancelled', 'retired')
    ),
    'companyEconomicRecords', (
      select count(*)::integer
      from public.economy_ledger ledger
      where ledger.owner_scope = 'company'
        and ledger.organization_id = v_org_id
    ),
    'reviewedRouteSignals', (
      select count(*)::integer
      from public.route_support_campaigns campaign
      where campaign.organization_id = v_org_id
        and campaign.reviewed_at is not null
    ),
    'publishedCuratedHistory', (
      select count(*)::integer
      from public.museum_company_history_entries entry
      where entry.organization_id = v_org_id
        and entry.is_published
    ),
    'firstRecordedActivity', (
      select min(activity_at)
      from (
        select asset.acquired_at as activity_at
        from public.company_economy_assets asset
        where asset.organization_id = v_org_id

        union all

        select ledger.created_at
        from public.economy_ledger ledger
        where ledger.owner_scope = 'company'
          and ledger.organization_id = v_org_id

        union all

        select campaign.reviewed_at
        from public.route_support_campaigns campaign
        where campaign.organization_id = v_org_id
          and campaign.reviewed_at is not null
      ) activity
    ),
    'latestRecordedActivity', (
      select max(activity_at)
      from (
        select asset.acquired_at as activity_at
        from public.company_economy_assets asset
        where asset.organization_id = v_org_id

        union all

        select ledger.created_at
        from public.economy_ledger ledger
        where ledger.owner_scope = 'company'
          and ledger.organization_id = v_org_id

        union all

        select campaign.reviewed_at
        from public.route_support_campaigns campaign
        where campaign.organization_id = v_org_id
          and campaign.reviewed_at is not null
      ) activity
    ),
    'companyEconomy', coalesce(v_account, '{}'::jsonb)
  )
  into v_summary;

  select jsonb_build_object(
    'evidenceBackedRewardedFlights', (
      select count(*)::integer
      from public.career_economy_pirep_awards award
      where award.pilot_id = v_user_id
        and award.organization_id = v_org_id
    ),
    'routeSupportContributions', (
      select count(*)::integer
      from public.route_support_contributions contribution
      where contribution.pilot_id = v_user_id
        and contribution.organization_id = v_org_id
    ),
    'routeSupportAmount', (
      select coalesce(sum(contribution.amount), 0)::bigint
      from public.route_support_contributions contribution
      where contribution.pilot_id = v_user_id
        and contribution.organization_id = v_org_id
    ),
    'firstCompanyEvidenceAt', (
      select min(evidence_at)
      from (
        select award.awarded_at as evidence_at
        from public.career_economy_pirep_awards award
        where award.pilot_id = v_user_id
          and award.organization_id = v_org_id

        union all

        select contribution.contributed_at
        from public.route_support_contributions contribution
        where contribution.pilot_id = v_user_id
          and contribution.organization_id = v_org_id
      ) evidence
    )
  )
  into v_pilot_connection;

  with timeline_rows as (
    select
      'curated:' || entry.id::text as item_id,
      'curated_history'::text as item_kind,
      entry.occurred_on::timestamptz as occurred_at,
      entry.title,
      entry.summary as description,
      jsonb_build_object(
        'category', entry.category,
        'details', entry.details,
        'eraLabel', entry.era_label,
        'evidence', entry.evidence,
        'source', 'museum_company_history_entries',
        'derived', false
      ) as evidence,
      10 as sort_order
    from public.museum_company_history_entries entry
    where entry.organization_id = v_org_id
      and entry.is_published

    union all

    select
      'asset:' || asset.id::text,
      'company_asset',
      asset.acquired_at,
      case
        when asset.asset_kind = 'aircraft_purchase'
          then 'Aircraft acquisition recorded'
        when asset.asset_kind = 'aircraft_lease'
          then 'Aircraft lease recorded'
        else 'Company asset recorded'
      end,
      (
        coalesce(fleet.icao_code || ' · ', '') ||
        replace(asset.asset_kind, '_', ' ') ||
        '. Economic asset only; operational fleet registration remains a separate Operations decision.'
      )::text,
      jsonb_build_object(
        'assetId', asset.id,
        'assetKind', asset.asset_kind,
        'status', asset.status,
        'fleetTypeId', fleet.id,
        'fleetIcao', fleet.icao_code,
        'manufacturer', fleet.manufacturer,
        'model', fleet.model,
        'metadata', asset.metadata,
        'source', 'company_economy_assets',
        'derived', true
      ),
      20
    from public.company_economy_assets asset
    left join public.fleet_types fleet
      on fleet.id = asset.fleet_type_id
    where asset.organization_id = v_org_id

    union all

    select
      'route-review:' || campaign.id::text,
      'route_signal_review',
      campaign.reviewed_at,
      case
        when campaign.status = 'approved'
          then 'Route interest approved by Operations'
        when campaign.status = 'rejected'
          then 'Route interest rejected by Operations'
        else 'Route interest reviewed by Operations'
      end,
      (
        campaign.title || ' · ' ||
        coalesce(departure.icao_code, '----') || ' → ' ||
        coalesce(arrival.icao_code, '----') ||
        '. This is a company review of community interest and does not activate a route automatically.'
      )::text,
      jsonb_build_object(
        'campaignId', campaign.id,
        'campaignCode', campaign.code,
        'status', campaign.status,
        'operationsNote', campaign.operations_note,
        'departureIcao', departure.icao_code,
        'arrivalIcao', arrival.icao_code,
        'source', 'route_support_campaigns',
        'derived', true
      ),
      30
    from public.route_support_campaigns campaign
    left join public.airports departure
      on departure.id = campaign.departure_airport_id
    left join public.airports arrival
      on arrival.id = campaign.arrival_airport_id
    where campaign.organization_id = v_org_id
      and campaign.reviewed_at is not null

    union all

    select
      'economy:' || ledger.id::text,
      'company_economy',
      ledger.created_at,
      ledger.description,
      (
        ledger.transaction_type || ' · ' ||
        case when ledger.amount > 0 then '+' else '' end ||
        ledger.amount::text || ' ' || ledger.currency_code
      )::text,
      jsonb_build_object(
        'ledgerId', ledger.id,
        'transactionType', ledger.transaction_type,
        'amount', ledger.amount,
        'currencyCode', ledger.currency_code,
        'metadata', ledger.metadata,
        'source', 'economy_ledger',
        'derived', true
      ),
      40
    from public.economy_ledger ledger
    where ledger.owner_scope = 'company'
      and ledger.organization_id = v_org_id
  ),
  limited as (
    select *
    from timeline_rows
    order by occurred_at desc nulls last, sort_order, item_id
    limit 80
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item_id,
        'kind', item_kind,
        'occurredAt', occurred_at,
        'title', title,
        'description', description,
        'evidence', evidence
      )
      order by occurred_at desc nulls last, sort_order, item_id
    ),
    '[]'::jsonb
  )
  into v_timeline
  from limited;

  return jsonb_build_object(
    'schemaVersion', 1,
    'projection', 'museum-history.airline',
    'authority', 'read-only-derived-plus-curated',
    'summary', coalesce(v_summary, '{}'::jsonb),
    'pilotConnection', coalesce(v_pilot_connection, '{}'::jsonb),
    'timeline', coalesce(v_timeline, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_airline_museum_history()
from public, anon;

grant execute on function public.get_airline_museum_history()
to authenticated;

comment on function public.get_airline_museum_history()
is 'Pillar 09 Airline Museum: read-only company legacy projection plus explicitly curated published company-history entries.';
