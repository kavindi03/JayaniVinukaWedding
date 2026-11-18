-- Run in Supabase > SQL Editor. Enable anonymous sign-ins in Authentication settings.
create table if not exists public.photos(
  id uuid primary key default gen_random_uuid(),
  table_no int not null,
  guest_name text,
  guest_id uuid not null,
  path text not null,
  caption text,
  created_at timestamptz not null default now()
);

alter table public.photos enable row level security;
drop policy if exists "guests add" on public.photos;
drop policy if exists "couple reads" on public.photos;
drop policy if exists "couple deletes" on public.photos;
drop policy if exists "guests insert own photos" on public.photos;
drop policy if exists "guests read gallery" on public.photos;
drop policy if exists "guests delete own photos" on public.photos;
drop policy if exists "couple deletes photos" on public.photos;

create policy "guests insert own photos" on public.photos
  for insert to authenticated with check (guest_id = auth.uid());
create policy "guests read gallery" on public.photos
  for select to authenticated using (true);
create policy "guests delete own photos" on public.photos
  for delete to authenticated using (guest_id = auth.uid());
create policy "couple deletes photos" on public.photos
  for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'couple');

grant select, insert, delete on public.photos to authenticated;

insert into storage.buckets(id, name, public)
values ('memories', 'memories', true)
on conflict (id) do update set public = true;

drop policy if exists "guests upload" on storage.objects;
drop policy if exists "couple removes" on storage.objects;
drop policy if exists "guests upload memories" on storage.objects;
drop policy if exists "owners remove memories" on storage.objects;
drop policy if exists "couple removes memories" on storage.objects;

create policy "guests upload memories" on storage.objects
  for insert to authenticated with check (bucket_id = 'memories');
create policy "owners remove memories" on storage.objects
  for delete to authenticated
  using (bucket_id = 'memories' and owner_id = auth.uid()::text);
create policy "couple removes memories" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'memories'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'couple'
  );
