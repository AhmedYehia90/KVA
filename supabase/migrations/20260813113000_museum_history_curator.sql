-- KVA OS Pillar 09 — Museum / History RC3
-- Museum Curator / History Administration.
--
-- This migration adds audited, service-role-only write functions for curated
-- company history. It does not alter operational truth, fleet, routes, PIREPs,
-- Career XP, wallets, company balances or Economy Ledger.

create table if not exists public.museum_history_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null
    references public.profiles(id) on delete restrict,
  organization_id text not null
    references public.platform_organizations(id) on delete restrict,
  action text not null,
  history_entry_id uuid
    references public.museum_company_history_entries(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_museum_history_admin_audit_org
on public.museum_history_admin_audit(
  organization_id,
  created_at desc
);

alter table public.museum_history_admin_audit enable row level security;

drop policy if exists museum_history_admin_audit_staff_read
on public.museum_history_admin_audit;

create policy museum_history_admin_audit_staff_read
on public.museum_history_admin_audit
for select
to authenticated
using (public.is_staff());


create or replace function public.create_museum_company_history_entry(
  p_organization_id text,
  p_category text,
  p_title text,
  p_summary text,
  p_details text,
  p_occurred_on date,
  p_era_label text,
  p_source_label text,
  p_source_reference text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_category text := lower(btrim(coalesce(p_category, 'company_history')));
  v_title text := btrim(coalesce(p_title, ''));
  v_summary text := btrim(coalesce(p_summary, ''));
  v_evidence jsonb;
begin
  if p_actor_id is null then
    raise exception 'Administrative actor is required';
  end if;

  if btrim(coalesce(p_organization_id, '')) = '' then
    raise exception 'Organization is required';
  end if;

  if v_category not in (
    'company_history',
    'fleet_history',
    'network_history',
    'community_history',
    'event_history',
    'technology_history',
    'other'
  ) then
    raise exception 'Invalid museum history category';
  end if;

  if v_title = '' then
    raise exception 'History title is required';
  end if;

  if v_summary = '' then
    raise exception 'History summary is required';
  end if;

  v_evidence := jsonb_strip_nulls(
    jsonb_build_object(
      'sourceLabel', nullif(btrim(coalesce(p_source_label, '')), ''),
      'sourceReference', nullif(btrim(coalesce(p_source_reference, '')), ''),
      'curationMode', 'operations_admin'
    )
  );

  insert into public.museum_company_history_entries (
    organization_id,
    category,
    title,
    summary,
    details,
    occurred_on,
    era_label,
    evidence,
    is_published,
    created_by,
    created_at,
    updated_at
  )
  values (
    p_organization_id,
    v_category,
    v_title,
    v_summary,
    nullif(btrim(coalesce(p_details, '')), ''),
    p_occurred_on,
    nullif(btrim(coalesce(p_era_label, '')), ''),
    v_evidence,
    false,
    p_actor_id,
    now(),
    now()
  )
  returning id into v_id;

  insert into public.museum_history_admin_audit (
    actor_id,
    organization_id,
    action,
    history_entry_id,
    details
  )
  values (
    p_actor_id,
    p_organization_id,
    'curated_history_created',
    v_id,
    jsonb_build_object(
      'category', v_category,
      'title', v_title,
      'occurredOn', p_occurred_on,
      'published', false
    )
  );

  perform public.append_domain_event(
    p_event_type => 'museum.company_history_created',
    p_aggregate_type => 'museum_company_history_entry',
    p_aggregate_id => v_id::text,
    p_actor_id => p_actor_id::text,
    p_organization_id => p_organization_id,
    p_payload => jsonb_build_object(
      'historyEntryId', v_id,
      'category', v_category,
      'title', v_title,
      'occurredOn', p_occurred_on,
      'published', false
    ),
    p_metadata => jsonb_build_object(
      'source', 'museum-history.curator'
    )
  );

  return v_id;
end;
$$;

revoke all on function public.create_museum_company_history_entry(
  text, text, text, text, text, date, text, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.create_museum_company_history_entry(
  text, text, text, text, text, date, text, text, text, uuid
) to service_role;


create or replace function public.update_museum_company_history_entry(
  p_entry_id uuid,
  p_category text,
  p_title text,
  p_summary text,
  p_details text,
  p_occurred_on date,
  p_era_label text,
  p_source_label text,
  p_source_reference text,
  p_actor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.museum_company_history_entries%rowtype;
  v_category text := lower(btrim(coalesce(p_category, 'company_history')));
  v_title text := btrim(coalesce(p_title, ''));
  v_summary text := btrim(coalesce(p_summary, ''));
  v_evidence jsonb;
begin
  if p_actor_id is null then
    raise exception 'Administrative actor is required';
  end if;

  if p_entry_id is null then
    raise exception 'History entry is required';
  end if;

  if v_category not in (
    'company_history',
    'fleet_history',
    'network_history',
    'community_history',
    'event_history',
    'technology_history',
    'other'
  ) then
    raise exception 'Invalid museum history category';
  end if;

  if v_title = '' then
    raise exception 'History title is required';
  end if;

  if v_summary = '' then
    raise exception 'History summary is required';
  end if;

  select *
  into v_entry
  from public.museum_company_history_entries
  where id = p_entry_id
  for update;

  if not found then
    raise exception 'History entry not found';
  end if;

  v_evidence := jsonb_strip_nulls(
    coalesce(v_entry.evidence, '{}'::jsonb)
    || jsonb_build_object(
      'sourceLabel', nullif(btrim(coalesce(p_source_label, '')), ''),
      'sourceReference', nullif(btrim(coalesce(p_source_reference, '')), ''),
      'curationMode', 'operations_admin'
    )
  );

  update public.museum_company_history_entries
  set
    category = v_category,
    title = v_title,
    summary = v_summary,
    details = nullif(btrim(coalesce(p_details, '')), ''),
    occurred_on = p_occurred_on,
    era_label = nullif(btrim(coalesce(p_era_label, '')), ''),
    evidence = v_evidence,
    updated_at = now()
  where id = p_entry_id;

  insert into public.museum_history_admin_audit (
    actor_id,
    organization_id,
    action,
    history_entry_id,
    details
  )
  values (
    p_actor_id,
    v_entry.organization_id,
    'curated_history_updated',
    p_entry_id,
    jsonb_build_object(
      'category', v_category,
      'title', v_title,
      'occurredOn', p_occurred_on,
      'published', v_entry.is_published
    )
  );

  perform public.append_domain_event(
    p_event_type => 'museum.company_history_updated',
    p_aggregate_type => 'museum_company_history_entry',
    p_aggregate_id => p_entry_id::text,
    p_actor_id => p_actor_id::text,
    p_organization_id => v_entry.organization_id,
    p_payload => jsonb_build_object(
      'historyEntryId', p_entry_id,
      'category', v_category,
      'title', v_title,
      'occurredOn', p_occurred_on,
      'published', v_entry.is_published
    ),
    p_metadata => jsonb_build_object(
      'source', 'museum-history.curator'
    )
  );

  return true;
end;
$$;

revoke all on function public.update_museum_company_history_entry(
  uuid, text, text, text, text, date, text, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.update_museum_company_history_entry(
  uuid, text, text, text, text, date, text, text, text, uuid
) to service_role;


create or replace function public.set_museum_company_history_publication(
  p_entry_id uuid,
  p_publish boolean,
  p_actor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.museum_company_history_entries%rowtype;
  v_action text;
  v_event_type text;
begin
  if p_actor_id is null then
    raise exception 'Administrative actor is required';
  end if;

  if p_entry_id is null then
    raise exception 'History entry is required';
  end if;

  select *
  into v_entry
  from public.museum_company_history_entries
  where id = p_entry_id
  for update;

  if not found then
    raise exception 'History entry not found';
  end if;

  if v_entry.is_published = p_publish then
    return true;
  end if;

  update public.museum_company_history_entries
  set
    is_published = p_publish,
    updated_at = now()
  where id = p_entry_id;

  if p_publish then
    v_action := 'curated_history_published';
    v_event_type := 'museum.company_history_published';
  else
    v_action := 'curated_history_unpublished';
    v_event_type := 'museum.company_history_unpublished';
  end if;

  insert into public.museum_history_admin_audit (
    actor_id,
    organization_id,
    action,
    history_entry_id,
    details
  )
  values (
    p_actor_id,
    v_entry.organization_id,
    v_action,
    p_entry_id,
    jsonb_build_object(
      'title', v_entry.title,
      'published', p_publish
    )
  );

  perform public.append_domain_event(
    p_event_type => v_event_type,
    p_aggregate_type => 'museum_company_history_entry',
    p_aggregate_id => p_entry_id::text,
    p_actor_id => p_actor_id::text,
    p_organization_id => v_entry.organization_id,
    p_payload => jsonb_build_object(
      'historyEntryId', p_entry_id,
      'category', v_entry.category,
      'title', v_entry.title,
      'occurredOn', v_entry.occurred_on,
      'published', p_publish
    ),
    p_metadata => jsonb_build_object(
      'source', 'museum-history.curator'
    )
  );

  return true;
end;
$$;

revoke all on function public.set_museum_company_history_publication(
  uuid, boolean, uuid
) from public, anon, authenticated;

grant execute on function public.set_museum_company_history_publication(
  uuid, boolean, uuid
) to service_role;

comment on table public.museum_history_admin_audit
is 'Pillar 09 Operations audit trail for curated company-history administration.';

comment on function public.create_museum_company_history_entry(
  text, text, text, text, text, date, text, text, text, uuid
)
is 'Operations-only creation of a curated company-history draft with audit and Event Platform evidence.';

comment on function public.update_museum_company_history_entry(
  uuid, text, text, text, text, date, text, text, text, uuid
)
is 'Operations-only update of a curated company-history entry with audit and Event Platform evidence.';

comment on function public.set_museum_company_history_publication(
  uuid, boolean, uuid
)
is 'Operations-only Draft/Published transition for curated company history.';
