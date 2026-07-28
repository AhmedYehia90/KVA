insert into public.ranks (code,name,minimum_hours,minimum_flights,priority) values
('CADET','Cadet',0,0,10),
('SO','Second Officer',25,10,20),
('FO','First Officer',100,40,30),
('SFO','Senior First Officer',250,100,40),
('CPT','Captain',500,200,50),
('SCPT','Senior Captain',1000,400,60),
('CP','Chief Pilot',2000,750,70)
on conflict (code) do nothing;

insert into public.fleet_types
(icao_code,manufacturer,model,engine_count,engine_type,range_nm,cruise_speed_kts,max_passengers) values
('E170','Embraer','Embraer 170',2,'Turbofan',2150,470,78),
('A21N','Airbus','Airbus A321neo',2,'Turbofan',4000,450,244),
('A359','Airbus','Airbus A350-900',2,'Turbofan',8100,488,440),
('B788','Boeing','Boeing 787-8',2,'Turbofan',7355,488,248),
('B77W','Boeing','Boeing 777-300ER',2,'Turbofan',7370,490,396),
('B748','Boeing','Boeing 747-8',4,'Turbofan',7730,493,467)
on conflict (icao_code) do nothing;

insert into public.airports
(icao_code,iata_code,name,city,country,latitude,longitude,timezone) values
('HECA','CAI','Cairo International Airport','Cairo','Egypt',30.121944,31.405556,'Africa/Cairo'),
('OMDB','DXB','Dubai International Airport','Dubai','United Arab Emirates',25.252778,55.364444,'Asia/Dubai'),
('OKKK','KWI','Kuwait International Airport','Kuwait City','Kuwait',29.226567,47.968928,'Asia/Kuwait'),
('OEJN','JED','King Abdulaziz International Airport','Jeddah','Saudi Arabia',21.679564,39.156536,'Asia/Riyadh'),
('LTFM','IST','Istanbul Airport','Istanbul','Türkiye',41.275278,28.751944,'Europe/Istanbul')
on conflict (icao_code) do nothing;

insert into public.awards (code,name,description,requirements) values
('FIRST_FLIGHT','First Flight','Awarded after the first approved PIREP.','{"approved_pireps":1}'),
('TEN_FLIGHTS','10 Flights','Awarded after ten approved PIREPs.','{"approved_pireps":10}'),
('100_HOURS','100 Flight Hours','Awarded after reaching 100 approved flight hours.','{"flight_hours":100}')
on conflict (code) do nothing;
