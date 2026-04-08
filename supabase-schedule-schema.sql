-- ============================================================
-- Lampara Schedule & Booking — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Schedule slots (admin-managed day statuses)
create table if not exists public.schedule_slots (
    id         uuid primary key default gen_random_uuid(),
    date       date not null unique,
    status     text not null check (status in ('open', 'not_available', 'scheduled', 'pending')),
    location   text,          -- e.g. "Sta. Rosa, Laguna" (shown on scheduled days)
    notes      text,          -- internal admin note, not shown publicly
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Booking requests (submitted by clients)
create table if not exists public.bookings (
    id         uuid primary key default gen_random_uuid(),
    date       date not null,
    name       text not null,
    email      text not null,
    phone      text,
    address    text not null,
    message    text,
    status     text default 'pending' check (status in ('pending', 'confirmed', 'declined')),
    created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table public.schedule_slots enable row level security;
alter table public.bookings enable row level security;

-- schedule_slots: anyone can read, only authenticated users can write
create policy "Public read schedule_slots"
    on public.schedule_slots for select
    using (true);

create policy "Auth write schedule_slots"
    on public.schedule_slots for all
    using (auth.role() = 'authenticated');

-- bookings: anyone can insert, only authenticated users can read/update
create policy "Public insert bookings"
    on public.bookings for insert
    with check (true);

create policy "Auth manage bookings"
    on public.bookings for all
    using (auth.role() = 'authenticated');

-- ============================================================
-- Auto-update updated_at on schedule_slots
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger on_schedule_slots_updated
    before update on public.schedule_slots
    for each row execute procedure public.handle_updated_at();
