create table if not exists public.babybingo_state (
  app_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.babybingo_state enable row level security;
grant select, insert, update on public.babybingo_state to anon, authenticated;

drop policy if exists "babybingo_state_select" on public.babybingo_state;
drop policy if exists "babybingo_state_insert" on public.babybingo_state;
drop policy if exists "babybingo_state_update" on public.babybingo_state;

create policy "babybingo_state_select"
  on public.babybingo_state
  for select
  to anon, authenticated
  using (true);

create policy "babybingo_state_insert"
  on public.babybingo_state
  for insert
  to anon, authenticated
  with check (true);

create policy "babybingo_state_update"
  on public.babybingo_state
  for update
  to anon, authenticated
  using (true)
  with check (true);

insert into storage.buckets (id, name, public)
values ('babybingo-photos', 'babybingo-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "babybingo_photos_select" on storage.objects;
drop policy if exists "babybingo_photos_insert" on storage.objects;
drop policy if exists "babybingo_photos_update" on storage.objects;
drop policy if exists "babybingo_photos_delete" on storage.objects;

create policy "babybingo_photos_select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'babybingo-photos');

create policy "babybingo_photos_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'babybingo-photos');

create policy "babybingo_photos_update"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'babybingo-photos')
  with check (bucket_id = 'babybingo-photos');

create policy "babybingo_photos_delete"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'babybingo-photos');

insert into public.babybingo_state (app_id, data)
values (
  'babybingo',
  jsonb_build_object(
    'prizePools', jsonb_build_object(
      'daily', '[]'::jsonb,
      'romantic', '[]'::jsonb,
      'thunder', '[]'::jsonb
    ),
    'drawRecords', '[]'::jsonb,
    'journals', '[]'::jsonb,
    'photos', '[]'::jsonb
  )
)
on conflict (app_id) do nothing;
