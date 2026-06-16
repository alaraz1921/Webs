begin;

alter table public.trastero_fotos
    add column if not exists es_principal boolean not null default false;

create index if not exists trastero_fotos_principal_idx
    on public.trastero_fotos(tipo, relacion_id, es_principal);

with ranked as (
    select
        id,
        row_number() over (
            partition by user_id, tipo, relacion_id
            order by created_at desc, id desc
        ) as position
    from public.trastero_fotos
)
update public.trastero_fotos fotos
set es_principal = true
from ranked
where fotos.id = ranked.id
  and ranked.position = 1
  and fotos.es_principal = false;

commit;
