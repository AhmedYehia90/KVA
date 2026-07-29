-- Add deterministic ordering for pilot ranks

alter table public.ranks
add column if not exists code text;

alter table public.ranks
add column if not exists sort_order integer;

update public.ranks
set
    code = case lower(name)
        when 'cadet' then 'CDT'
        when 'second officer' then 'SO'
        when 'first officer' then 'FO'
        when 'senior first officer' then 'SFO'
        when 'captain' then 'CPT'
        when 'senior captain' then 'SCPT'
        when 'chief pilot' then 'CP'
        else code
    end;

update public.ranks
set
    sort_order = case code
        when 'CDT' then 1
        when 'SO' then 2
        when 'FO' then 3
        when 'SFO' then 4
        when 'CPT' then 5
        when 'SCPT' then 6
        when 'CP' then 7
        else sort_order
    end;

alter table public.ranks
alter column code set not null;

alter table public.ranks
alter column sort_order set not null;

create unique index if not exists idx_ranks_code
on public.ranks(code);

create unique index if not exists idx_ranks_sort_order
on public.ranks(sort_order);