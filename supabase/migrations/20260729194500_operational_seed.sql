-- KVA operational seed v1.0
-- 13 airports, 7 fleet types, 25 aircraft, and 104 scheduled routes.

insert into public.fleet_types
  (icao_code, manufacturer, model, engine_count, engine_type, range_nm, cruise_speed_kts, max_passengers)
values
  ('E170','Embraer','Embraer 170',2,'Turbofan',2150,470,78),
  ('A21N','Airbus','Airbus A321neo',2,'Turbofan',4000,450,244),
  ('B788','Boeing','Boeing 787-8',2,'Turbofan',7355,488,248),
  ('A333','Airbus','Airbus A330-300',2,'Turbofan',6350,470,300),
  ('B77W','Boeing','Boeing 777-300ER',2,'Turbofan',7370,490,396),
  ('A359','Airbus','Airbus A350-900',2,'Turbofan',8100,488,440),
  ('B748','Boeing','Boeing 747-8',4,'Turbofan',7730,493,467)

on conflict (icao_code) do update set
  manufacturer = excluded.manufacturer,
  model = excluded.model,
  engine_count = excluded.engine_count,
  engine_type = excluded.engine_type,
  range_nm = excluded.range_nm,
  cruise_speed_kts = excluded.cruise_speed_kts,
  max_passengers = excluded.max_passengers,
  active = true;

insert into public.airports
  (icao_code, iata_code, name, city, country, latitude, longitude, timezone)
values
  ('HECA','CAI','Cairo International Airport','Cairo','Egypt',30.121944,31.405556,'Africa/Cairo'),
  ('HESH','SSH','Sharm El Sheikh International Airport','Sharm El Sheikh','Egypt',27.977286,34.39495,'Africa/Cairo'),
  ('HESN','ASW','Aswan International Airport','Aswan','Egypt',23.964356,32.819975,'Africa/Cairo'),
  ('HEGN','HRG','Hurghada International Airport','Hurghada','Egypt',27.178317,33.799436,'Africa/Cairo'),
  ('OKKK','KWI','Kuwait International Airport','Kuwait City','Kuwait',29.226567,47.968928,'Asia/Kuwait'),
  ('OMDB','DXB','Dubai International Airport','Dubai','United Arab Emirates',25.252778,55.364444,'Asia/Dubai'),
  ('OERK','RUH','King Khalid International Airport','Riyadh','Saudi Arabia',24.95764,46.698776,'Asia/Riyadh'),
  ('OEJN','JED','King Abdulaziz International Airport','Jeddah','Saudi Arabia',21.679564,39.156536,'Asia/Riyadh'),
  ('LCLK','LCA','Larnaca International Airport','Larnaca','Cyprus',34.875117,33.62485,'Asia/Nicosia'),
  ('LGAV','ATH','Athens International Airport','Athens','Greece',37.936358,23.944467,'Europe/Athens'),
  ('LEBL','BCN','Barcelona-El Prat Airport','Barcelona','Spain',41.297078,2.078464,'Europe/Madrid'),
  ('LTBA','ISL','Istanbul Ataturk Airport','Istanbul','Türkiye',40.976922,28.814606,'Europe/Istanbul'),
  ('EDDF','FRA','Frankfurt Airport','Frankfurt','Germany',50.037933,8.562152,'Europe/Berlin')

on conflict (icao_code) do update set
  iata_code = excluded.iata_code,
  name = excluded.name,
  city = excluded.city,
  country = excluded.country,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  timezone = excluded.timezone;

insert into public.aircraft
  (registration, fleet_type_id, status, current_airport_id, livery_version)
select
  seed.registration,
  ft.id,
  'active'::public.aircraft_status,
  base.id,
  '1.0'
from (values
  ('SU-KAAA','E170'),
  ('SU-KAAB','E170'),
  ('SU-KAAC','E170'),
  ('SU-KAAD','E170'),
  ('SU-KAAE','E170'),
  ('SU-KAAF','E170'),
  ('SU-KAAG','A21N'),
  ('SU-KAAH','A21N'),
  ('SU-KAAI','A21N'),
  ('SU-KAAJ','A21N'),
  ('SU-KAAK','A21N'),
  ('SU-KAAL','A21N'),
  ('SU-KAAM','A21N'),
  ('SU-KAAN','A21N'),
  ('SU-KAAO','A21N'),
  ('SU-KAAP','B788'),
  ('SU-KAAQ','B788'),
  ('SU-KAAR','B788'),
  ('SU-KAAS','A333'),
  ('SU-KAAT','A333'),
  ('SU-KAAU','B77W'),
  ('SU-KAAV','B77W'),
  ('SU-KAAW','A359'),
  ('SU-KAAX','A359'),
  ('SU-KAAY','B748')
) as seed(registration, fleet_icao)
join public.fleet_types ft on ft.icao_code = seed.fleet_icao
join public.airports base on base.icao_code = 'HECA'
on conflict (registration) do update set
  fleet_type_id = excluded.fleet_type_id,
  status = excluded.status,
  current_airport_id = coalesce(public.aircraft.current_airport_id, excluded.current_airport_id),
  livery_version = excluded.livery_version;

insert into public.routes
  (flight_number, departure_airport_id, arrival_airport_id, fleet_type_id, scheduled_minutes, distance_nm, active)
select
  seed.flight_number,
  dep.id,
  arr.id,
  ft.id,
  seed.scheduled_minutes,
  seed.distance_nm,
  true
from (values
  ('KVA101','HECA','HESH','A21N',60,203),
  ('KVA102','HESH','HECA','A21N',60,203),
  ('KVA103','HECA','HESH','E170',65,203),
  ('KVA104','HESH','HECA','E170',65,203),
  ('KVA105','HECA','HESH','E170',65,203),
  ('KVA106','HESH','HECA','E170',65,203),
  ('KVA107','HECA','HESH','A21N',60,203),
  ('KVA108','HESH','HECA','A21N',60,203),
  ('KVA109','HECA','HESH','E170',65,203),
  ('KVA110','HESH','HECA','E170',65,203),
  ('KVA111','HECA','HESN','A21N',85,377),
  ('KVA112','HESN','HECA','A21N',85,377),
  ('KVA113','HECA','HESN','E170',90,377),
  ('KVA114','HESN','HECA','E170',90,377),
  ('KVA115','HECA','HESN','E170',90,377),
  ('KVA116','HESN','HECA','E170',90,377),
  ('KVA117','HECA','HESN','A21N',85,377),
  ('KVA118','HESN','HECA','A21N',85,377),
  ('KVA119','HECA','HEGN','A21N',65,217),
  ('KVA120','HEGN','HECA','A21N',65,217),
  ('KVA121','HECA','HEGN','E170',65,217),
  ('KVA122','HEGN','HECA','E170',65,217),
  ('KVA123','HECA','HEGN','E170',65,217),
  ('KVA124','HEGN','HECA','E170',65,217),
  ('KVA125','HECA','HEGN','A21N',65,217),
  ('KVA126','HEGN','HECA','A21N',65,217),
  ('KVA127','HECA','HEGN','E170',65,217),
  ('KVA128','HEGN','HECA','E170',65,217),
  ('KVA129','HECA','OKKK','A21N',160,865),
  ('KVA130','OKKK','HECA','A21N',160,865),
  ('KVA131','HECA','OKKK','A21N',160,865),
  ('KVA132','OKKK','HECA','A21N',160,865),
  ('KVA133','HECA','OKKK','A333',155,865),
  ('KVA134','OKKK','HECA','A333',155,865),
  ('KVA135','HECA','OKKK','B788',155,865),
  ('KVA136','OKKK','HECA','B788',155,865),
  ('KVA137','HECA','OMDB','A21N',220,1304),
  ('KVA138','OMDB','HECA','A21N',220,1304),
  ('KVA139','HECA','OMDB','A21N',220,1304),
  ('KVA140','OMDB','HECA','A21N',220,1304),
  ('KVA141','HECA','OMDB','A333',210,1304),
  ('KVA142','OMDB','HECA','A333',210,1304),
  ('KVA143','HECA','OMDB','B788',210,1304),
  ('KVA144','OMDB','HECA','B788',210,1304),
  ('KVA145','HECA','OMDB','A21N',220,1304),
  ('KVA146','OMDB','HECA','A21N',220,1304),
  ('KVA147','HECA','OERK','A21N',160,870),
  ('KVA148','OERK','HECA','A21N',160,870),
  ('KVA149','HECA','OERK','A21N',160,870),
  ('KVA150','OERK','HECA','A21N',160,870),
  ('KVA151','HECA','OERK','A333',155,870),
  ('KVA152','OERK','HECA','A333',155,870),
  ('KVA153','HECA','OERK','B788',155,870),
  ('KVA154','OERK','HECA','B788',155,870),
  ('KVA155','HECA','OEJN','A21N',125,657),
  ('KVA156','OEJN','HECA','A21N',125,657),
  ('KVA157','HECA','OEJN','A21N',125,657),
  ('KVA158','OEJN','HECA','A21N',125,657),
  ('KVA159','HECA','OEJN','A333',120,657),
  ('KVA160','OEJN','HECA','A333',120,657),
  ('KVA161','HECA','OEJN','B788',115,657),
  ('KVA162','OEJN','HECA','B788',115,657),
  ('KVA163','HECA','LCLK','A21N',75,307),
  ('KVA164','LCLK','HECA','A21N',75,307),
  ('KVA165','HECA','LCLK','E170',80,307),
  ('KVA166','LCLK','HECA','E170',80,307),
  ('KVA167','HECA','LCLK','E170',80,307),
  ('KVA168','LCLK','HECA','E170',80,307),
  ('KVA169','HECA','LGAV','A21N',115,598),
  ('KVA170','LGAV','HECA','A21N',115,598),
  ('KVA171','HECA','LGAV','A21N',115,598),
  ('KVA172','LGAV','HECA','A21N',115,598),
  ('KVA173','HECA','LGAV','A333',110,598),
  ('KVA174','LGAV','HECA','A333',110,598),
  ('KVA175','HECA','LEBL','A21N',255,1569),
  ('KVA176','LEBL','HECA','A21N',255,1569),
  ('KVA177','HECA','LEBL','B788',240,1569),
  ('KVA178','LEBL','HECA','B788',240,1569),
  ('KVA179','HECA','LTBA','A21N',125,664),
  ('KVA180','LTBA','HECA','A21N',125,664),
  ('KVA181','HECA','LTBA','A21N',125,664),
  ('KVA182','LTBA','HECA','A21N',125,664),
  ('KVA183','HECA','LTBA','A333',120,664),
  ('KVA184','LTBA','HECA','A333',120,664),
  ('KVA185','HECA','EDDF','A21N',255,1578),
  ('KVA186','EDDF','HECA','A21N',255,1578),
  ('KVA187','HECA','EDDF','B788',240,1578),
  ('KVA188','EDDF','HECA','B788',240,1578),
  ('KVA189','HESH','OKKK','A21N',140,719),
  ('KVA190','OKKK','HESH','A21N',140,719),
  ('KVA191','HESH','OKKK','A21N',140,719),
  ('KVA192','OKKK','HESH','A21N',140,719),
  ('KVA193','HESH','OEJN','A21N',95,458),
  ('KVA194','OEJN','HESH','A21N',95,458),
  ('KVA195','HESH','OEJN','E170',100,458),
  ('KVA196','OEJN','HESH','E170',100,458),
  ('KVA197','HEGN','OMDB','A21N',200,1166),
  ('KVA198','OMDB','HEGN','A21N',200,1166),
  ('KVA199','HEGN','OMDB','A21N',200,1166),
  ('KVA200','OMDB','HEGN','A21N',200,1166),
  ('KVA201','HESN','OEJN','A21N',85,376),
  ('KVA202','OEJN','HESN','A21N',85,376),
  ('KVA203','LCLK','LGAV','A21N',100,502),
  ('KVA204','LGAV','LCLK','A21N',100,502)
) as seed(flight_number, departure_icao, arrival_icao, fleet_icao, scheduled_minutes, distance_nm)
join public.airports dep on dep.icao_code = seed.departure_icao
join public.airports arr on arr.icao_code = seed.arrival_icao
join public.fleet_types ft on ft.icao_code = seed.fleet_icao
on conflict (flight_number) do update set
  departure_airport_id = excluded.departure_airport_id,
  arrival_airport_id = excluded.arrival_airport_id,
  fleet_type_id = excluded.fleet_type_id,
  scheduled_minutes = excluded.scheduled_minutes,
  distance_nm = excluded.distance_nm,
  active = true;
