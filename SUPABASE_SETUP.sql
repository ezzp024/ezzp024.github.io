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

alter table public.profiles add column if not exists avatar_url text;

create table if not exists public.threads (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  category text not null default 'general',
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.threads add column if not exists category text not null default 'general';

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

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  message text not null,
  thread_id bigint references public.threads(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.direct_messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null,
  recipient_name text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  target_type text not null,
  target_id bigint not null,
  reason text not null,
  status text not null default 'open',
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
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
alter table public.notifications enable row level security;
alter table public.direct_messages enable row level security;
alter table public.reports enable row level security;

drop policy if exists "profiles read all auth" on public.profiles;
create policy "profiles read all auth"
on public.profiles
for select
to anon, authenticated
using (true);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert"
on public.profiles
for insert
to authenticated
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

drop policy if exists "notifications read own" on public.notifications;
create policy "notifications read own"
on public.notifications
for select
to authenticated
using (recipient_id = auth.uid());

drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own"
on public.notifications
for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

drop policy if exists "notifications insert actor" on public.notifications;
create policy "notifications insert actor"
on public.notifications
for insert
to authenticated
with check (
  actor_id = auth.uid()
  and recipient_id is not null
);

drop policy if exists "messages read own" on public.direct_messages;
create policy "messages read own"
on public.direct_messages
for select
to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "messages send approved" on public.direct_messages;
create policy "messages send approved"
on public.direct_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and sender_id <> recipient_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.approved = true
  )
);

drop policy if exists "messages mark_read_recipient" on public.direct_messages;
create policy "messages mark_read_recipient"
on public.direct_messages
for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

drop policy if exists "reports read_own_or_admin" on public.reports;
create policy "reports read_own_or_admin"
on public.reports
for select
to authenticated
using (
  reporter_id = auth.uid()
  or exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.is_admin = true
  )
);

drop policy if exists "reports insert_self" on public.reports;
create policy "reports insert_self"
on public.reports
for insert
to authenticated
with check (reporter_id = auth.uid());

drop policy if exists "reports admin_update" on public.reports;
create policy "reports admin_update"
on public.reports
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

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars read public" on storage.objects;
create policy "avatars read public"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

drop policy if exists "avatars upload own" on storage.objects;
create policy "avatars upload own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Run this once to promote your admin account after signup:
-- update public.profiles
-- set is_admin = true, approved = true
-- where email = 'YOUR_ADMIN_EMAIL_HERE';
