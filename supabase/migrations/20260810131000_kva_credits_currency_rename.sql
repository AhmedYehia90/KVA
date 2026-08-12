-- KVA Career & Economy currency naming hotfix v1.0.3
-- Rename the virtual currency from KVA to KVA Credits (KVC).

alter table public.pilot_wallets
  alter column currency_code set default 'KVC';

alter table public.company_economy_accounts
  alter column currency_code set default 'KVC';

alter table public.economy_ledger
  alter column currency_code set default 'KVC';

update public.pilot_wallets
set currency_code = 'KVC',
    updated_at = now()
where currency_code = 'KVA';

update public.company_economy_accounts
set currency_code = 'KVC',
    updated_at = now()
where currency_code = 'KVA';

update public.economy_ledger
set currency_code = 'KVC'
where currency_code = 'KVA';

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
      currency_code,
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
      'KVC',
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
      currency_code = 'KVC',
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
      'KVC',
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
      currency_code,
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
      'KVC',
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
      currency_code = 'KVC',
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
      'currencyCode', 'KVC',
      'currencyName', 'KVA Credits'
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
