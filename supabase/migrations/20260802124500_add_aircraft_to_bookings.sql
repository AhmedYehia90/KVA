-- Add aircraft assignment to flight bookings

alter table public.flight_bookings
add column if not exists aircraft_id uuid
references public.aircraft(id)
on delete set null;

create index if not exists idx_flight_bookings_aircraft_id
on public.flight_bookings(aircraft_id);