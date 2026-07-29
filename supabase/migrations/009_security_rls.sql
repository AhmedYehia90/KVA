create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('dispatcher', 'staff', 'admin')
      and status = 'active'
  );
$$;

alter table public.ranks enable row level security;
alter table public.profiles enable row level security;
alter table public.fleet_types enable row level security;
alter table public.aircraft enable row level security;
alter table public.airports enable row level security;
alter table public.routes enable row level security;
alter table public.flights enable row level security;
alter table public.pireps enable row level security;
alter table public.awards enable row level security;
alter table public.pilot_awards enable row level security;
alter table public.events enable row level security;

create policy "Public read ranks" on public.ranks for select using (true);
create policy "Public read fleet types" on public.fleet_types for select using (active);
create policy "Public read airports" on public.airports for select using (active);
create policy "Public read routes" on public.routes for select using (active);
create policy "Public read awards" on public.awards for select using (true);
create policy "Public read events" on public.events for select using (active);

create policy "Read own profile or staff" on public.profiles
for select using (auth.uid() = id or public.is_staff());

create policy "Update own profile or staff" on public.profiles
for update using (auth.uid() = id or public.is_staff())
with check (auth.uid() = id or public.is_staff());

create policy "Authenticated read aircraft" on public.aircraft
for select to authenticated using (true);

create policy "Staff manage aircraft" on public.aircraft
for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "Pilot read own flights or staff" on public.flights
for select using (auth.uid() = pilot_id or public.is_staff());

create policy "Pilot create own flights" on public.flights
for insert with check (auth.uid() = pilot_id);

create policy "Staff manage flights" on public.flights
for all using (public.is_staff()) with check (public.is_staff());

create policy "Pilot read own pireps or staff" on public.pireps
for select using (auth.uid() = pilot_id or public.is_staff());

create policy "Pilot submit own pireps" on public.pireps
for insert with check (auth.uid() = pilot_id);

create policy "Staff manage pireps" on public.pireps
for all using (public.is_staff()) with check (public.is_staff());

create policy "Pilot read own awards or staff" on public.pilot_awards
for select using (auth.uid() = pilot_id or public.is_staff());

create policy "Staff manage pilot awards" on public.pilot_awards
for all using (public.is_staff()) with check (public.is_staff());
