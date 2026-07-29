create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_rank_id uuid;
begin
  select id into default_rank_id
  from public.ranks
  where code = 'CADET'
  limit 1;

  insert into public.profiles (
    id,
    pilot_number,
    callsign,
    full_name,
    email,
    rank_id
  )
  values (
    new.id,
    null,
    null,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    default_rank_id
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
