# Kalabsha Airlines — Project Standards

## Identity
- Commercial name: Kalabsha Airlines
- ICAO code: KVA
- ATC callsign: Kalabsha
- Slogan: Fly To Dreams

## Localization
- Primary locales: English (`en`) and Arabic (`ar`)
- Initial additional locales: French (`fr`), German (`de`) and Spanish (`es`)
- Fallback locale: English
- Arabic direction: RTL
- Other current locales: LTR
- Every new user-facing string must be stored in a translation file.
- Operational terminology must use reviewed human translations.
- Editorial content may later use optional machine translation with a visible notice.
- The selected locale is stored in the `KVA_LOCALE` cookie for one year.
- Browser language is used only when no saved preference exists.

## Pilot identifiers
- Pilot ID example: `0001`
- Pilot callsign example: `KVA-P001`
- Username is separate and is used for login.

## Flight identifiers
- Flight number example: `KVA101`
- PIREP number example: `PR-2026-000001`
- Dispatch number example: `DSP-000001`
- ACARS session ID must remain separate from pilot callsign and flight number.

## PIREP fields
- `pilotCallsign`
- `flightNumber`
- `route`
- `aircraft`
- `durationMinutes`
- `status`

## Aircraft
- Registration format: `SU-KA` followed by two sequential letters.
- Examples: `SU-KAAA`, `SU-KAAB`, `SU-KAAC`
- Each aircraft has a fleet number, registration and aircraft type.

## Fleet numbers
- Embraer 170: `E170-01`
- Airbus A321neo: `A21N-01`
- Airbus A350-900: `A359-01`
- Boeing 787-8: `B788-01`
- Boeing 777-300ER: `B77W-01`
- Boeing 747-8 Intercontinental: `B748-01`

## Official fleet
- 5 × Embraer 170
- 6 × Airbus A321neo
- 1 × Airbus A350-900
- 2 × Boeing 787-8
- 2 × Boeing 777-300ER
- 1 × Boeing 747-8 Intercontinental
- Total: 17 aircraft
