create extension if not exists pgcrypto;

create sequence if not exists public.pilot_number_seq
  as bigint start with 1 increment by 1 minvalue 1;

create sequence if not exists public.pirep_number_seq
  as bigint start with 1 increment by 1 minvalue 1;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
