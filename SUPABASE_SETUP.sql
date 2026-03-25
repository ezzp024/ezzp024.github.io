-- Run this in Supabase SQL Editor

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null default 'Member',
  approved boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.threads (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.replies (
  id bigint generated always as identity primary key,
  thread_id bigint not null references public.threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.thread_upvotes (
  thread_id bigint not null references public.threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  effective_name text;
begin
  effective_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Member');

  insert into public.profiles (id, email, display_name, approved, is_admin)
  values (
    new.id,
    lower(new.email),
    effective_name,
    false,
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.threads enable row level security;
alter table public.replies enable row level security;
alter table public.thread_upvotes enable row level security;
alter table public.follows enable row level security;

drop policy if exists "profiles read all auth" on public.profiles;
create policy "profiles read all auth"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update"
on public.profiles
for update
to authenticated
using (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.is_admin = true
  )
);

drop policy if exists "threads read all" on public.threads;
create policy "threads read all"
on public.threads
for select
to anon, authenticated
using (true);

drop policy if exists "threads insert approved" on public.threads;
create policy "threads insert approved"
on public.threads
for insert
to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.approved = true
  )
);

drop policy if exists "replies read all" on public.replies;
create policy "replies read all"
on public.replies
for select
to anon, authenticated
using (true);

drop policy if exists "replies insert approved" on public.replies;
create policy "replies insert approved"
on public.replies
for insert
to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.approved = true
  )
);

drop policy if exists "upvotes read all" on public.thread_upvotes;
create policy "upvotes read all"
on public.thread_upvotes
for select
to anon, authenticated
using (true);

drop policy if exists "upvotes insert approved" on public.thread_upvotes;
create policy "upvotes insert approved"
on public.thread_upvotes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.approved = true
  )
);

drop policy if exists "follows read all" on public.follows;
create policy "follows read all"
on public.follows
for select
to anon, authenticated
using (true);

drop policy if exists "follows insert self" on public.follows;
create policy "follows insert self"
on public.follows
for insert
to authenticated
with check (
  follower_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.approved = true
  )
);

drop policy if exists "follows delete self" on public.follows;
create policy "follows delete self"
on public.follows
for delete
to authenticated
using (follower_id = auth.uid());

-- Run this once to promote your admin account after signup:
-- update public.profiles
-- set is_admin = true, approved = true
-- where email = 'YOUR_ADMIN_EMAIL_HERE';
