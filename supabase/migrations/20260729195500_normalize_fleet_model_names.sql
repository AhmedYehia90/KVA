-- Keep manufacturer and model separate so the UI can safely render:
-- manufacturer || ' ' || model

update public.fleet_types
set model = case icao_code
  when 'E170' then 'E170'
  when 'A21N' then 'A321neo'
  when 'B788' then '787-8 Dreamliner'
  when 'A333' then 'A330-300'
  when 'B77W' then '777-300ER'
  when 'A359' then 'A350-900'
  when 'B748' then '747-8'
  else model
end
where icao_code in ('E170', 'A21N', 'B788', 'A333', 'B77W', 'A359', 'B748');
