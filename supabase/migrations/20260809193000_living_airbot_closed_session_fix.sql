-- KVA Living Airbot hotfix v1.0.2
-- Normalize legacy/closed bookings so their dispatcher sessions cannot remain active.

create or replace function public.normalize_living_airbot_closed_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_status text;
  v_booking_completed_at timestamptz;
begin
  select
    booking.status::text,
    booking.completed_at
  into
    v_booking_status,
    v_booking_completed_at
  from public.flight_bookings booking
  where booking.id = new.booking_id;

  if found and v_booking_status in ('completed', 'closed') then
    new.phase := 'completed';
    new.status := 'completed';
    new.completed_at := coalesce(
      new.completed_at,
      v_booking_completed_at,
      now()
    );
    new.next_step :=
      'The flight is complete. Submit or review the PIREP and post-flight systems.';
    new.summary := format(
      '%s flight is complete. The dispatcher session is closed from recorded KVA OS evidence.',
      new.flight_number
    );
    new.evidence := coalesce(new.evidence, '{}'::jsonb)
      || jsonb_build_object('bookingStatus', v_booking_status);
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_living_airbot_closed_session()
from public, anon, authenticated;

drop trigger if exists before_living_airbot_session_closed_normalization
on public.living_airbot_sessions;

create trigger before_living_airbot_session_closed_normalization
before insert or update on public.living_airbot_sessions
for each row
execute function public.normalize_living_airbot_closed_session();

-- Repair stale sessions created by historical backfill before this normalization existed.
update public.living_airbot_sessions session
set
  phase = 'completed',
  status = 'completed',
  completed_at = coalesce(
    session.completed_at,
    booking.completed_at,
    now()
  ),
  next_step =
    'The flight is complete. Submit or review the PIREP and post-flight systems.',
  summary = format(
    '%s flight is complete. The dispatcher session is closed from recorded KVA OS evidence.',
    session.flight_number
  ),
  evidence = coalesce(session.evidence, '{}'::jsonb)
    || jsonb_build_object('bookingStatus', booking.status::text),
  updated_at = now()
from public.flight_bookings booking
where booking.id = session.booking_id
  and booking.status::text in ('completed', 'closed')
  and (
    session.status <> 'completed'
    or session.phase <> 'completed'
  );
