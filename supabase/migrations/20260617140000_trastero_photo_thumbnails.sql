alter table public.trastero_fotos
    add column if not exists thumbnail_path text;

create unique index if not exists trastero_fotos_thumbnail_path_idx
    on public.trastero_fotos(thumbnail_path)
    where thumbnail_path is not null;
