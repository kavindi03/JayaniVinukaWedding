-- Wedding Memories: run once in Supabase > SQL Editor (safe to re-run)
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
drop policy if exists "public read gallery" on public.photos;

-- guests (not logged in) can add photos; only the couple can read all or delete
create policy "guests add" on public.photos for insert to anon with check (true);
create policy "couple reads" on public.photos for select to authenticated using (true);
create policy "couple deletes" on public.photos for delete to authenticated using (true);
revoke select on public.photos from anon;

-- guests see only their own uploads, using their secret guest id
create or replace function public.my_photos(gid uuid) returns setof public.photos
language sql security definer set search_path = public
as $$ select * from public.photos where guest_id = gid order by created_at desc $$;
grant execute on function public.my_photos(uuid) to anon;

insert into storage.buckets(id, name, public)
values ('memories', 'memories', true)
on conflict (id) do update set public = true;

drop policy if exists "guests upload" on storage.objects;
drop policy if exists "couple removes" on storage.objects;
drop policy if exists "guests upload memories" on storage.objects;
drop policy if exists "owners remove memories" on storage.objects;
drop policy if exists "couple removes memories" on storage.objects;
drop policy if exists "couple lists files" on storage.objects;

create policy "guests upload" on storage.objects for insert to anon with check (bucket_id = 'memories');
create policy "couple lists files" on storage.objects for select to authenticated using (bucket_id = 'memories');
create policy "couple removes" on storage.objects for delete to authenticated using (bucket_id = 'memories');