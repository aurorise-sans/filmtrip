alter table public.photos
  add column if not exists country text,
  add column if not exists city text;
